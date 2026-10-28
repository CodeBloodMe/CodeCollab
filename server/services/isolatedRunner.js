const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const MAX_OUTPUT_BYTES = 64 * 1024; // 64 KB maximum output buffer to prevent DoS
const DEFAULT_TIMEOUT_MS = 5000;
const MAX_TIMEOUT_MS = 15000;
const MAX_CONCURRENT_JOBS = 5;

let activeJobs = 0;
const pendingQueue = [];

function checkDockerCommand() {
  // Determine if docker should be invoked via wsl or directly
  if (process.platform === "win32") {
    return { cmd: "wsl", prefixArgs: ["-d", "Ubuntu", "-e", "docker"] };
  }
  return { cmd: "docker", prefixArgs: [] };
}

/**
 * Executes code inside the isolated codeforge-runner Docker container.
 *
 * Security & Isolation Guarantees:
 * - Isolated non-root user identity (UID 1001:1001)
 * - Complete network isolation (--network none)
 * - Memory limit (--memory 128m)
 * - CPU quota (--cpus 0.5)
 * - Process limit (--pids-limit 64)
 * - Ephemeral container auto-cleanup (--rm)
 * - Output truncation protection (max 64KB stdout/stderr)
 * - Strict wall-clock timeout
 */
async function runSingleExecution({ language, code, stdin = "", timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const timeout = Math.min(Math.max(timeoutMs, 1000), MAX_TIMEOUT_MS);
  const codeB64 = Buffer.from(code, "utf8").toString("base64");
  const stdinB64 = Buffer.from(stdin || "", "utf8").toString("base64");

  let bashScript = "";
  switch (language) {
    case "javascript":
    case "js":
      bashScript = `echo '${codeB64}' | base64 -d > /tmp/solution.js && echo '${stdinB64}' | base64 -d | node /tmp/solution.js`;
      break;
    case "python":
    case "py":
      bashScript = `echo '${codeB64}' | base64 -d > /tmp/solution.py && echo '${stdinB64}' | base64 -d | python3 /tmp/solution.py`;
      break;
    case "cpp":
    case "c++":
      bashScript = `echo '${codeB64}' | base64 -d > /tmp/solution.cpp && g++ -O2 /tmp/solution.cpp -o /tmp/solution.out && echo '${stdinB64}' | base64 -d | /tmp/solution.out`;
      break;
    case "java":
      // Detect main class name or default to Main
      const classMatch = code.match(/public\s+class\s+([A-Za-z0-9_]+)/);
      const className = classMatch ? classMatch[1] : "Main";
      bashScript = `echo '${codeB64}' | base64 -d > /tmp/${className}.java && javac /tmp/${className}.java && echo '${stdinB64}' | base64 -d | java -cp /tmp ${className}`;
      break;
    default:
      throw new Error(`Unsupported programming language: ${language}`);
  }

  const { cmd, prefixArgs } = checkDockerCommand();
  const containerName = `codeforge-exec-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  const dockerArgs = [
    ...prefixArgs,
    "run",
    "--name", containerName,
    "--rm",
    "--network", "none",
    "--memory", "128m",
    "--cpus", "0.5",
    "--pids-limit", "64",
    "--user", "1001:1001",
    "codeforge-runner:latest",
    "bash",
    "-c",
    bashScript,
  ];

  return new Promise((resolve) => {
    const startTime = process.hrtime.bigint();
    let stdoutBuffer = "";
    let stderrBuffer = "";
    let timedOut = false;
    let finished = false;

    const child = spawn(cmd, dockerArgs, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timer = setTimeout(() => {
      timedOut = true;
      if (!finished) {
        // Kill the docker container via docker rm -f
        try {
          const { cmd: kCmd, prefixArgs: kPrefix } = checkDockerCommand();
          spawn(kCmd, [...kPrefix, "rm", "-f", containerName], { windowsHide: true });
        } catch {
          // Ignore cleanup errors
        }
        child.kill("SIGKILL");
      }
    }, timeout);

    child.stdout.on("data", (chunk) => {
      if (stdoutBuffer.length < MAX_OUTPUT_BYTES) {
        stdoutBuffer += chunk.toString("utf8");
        if (stdoutBuffer.length >= MAX_OUTPUT_BYTES) {
          stdoutBuffer += "\n[CodeForge: Output truncated exceeding 64KB limit]";
        }
      }
    });

    child.stderr.on("data", (chunk) => {
      if (stderrBuffer.length < MAX_OUTPUT_BYTES) {
        stderrBuffer += chunk.toString("utf8");
        if (stderrBuffer.length >= MAX_OUTPUT_BYTES) {
          stderrBuffer += "\n[CodeForge: Error log truncated exceeding 64KB limit]";
        }
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      finished = true;
      const endTime = process.hrtime.bigint();
      const durationMs = Number((endTime - startTime) / 1000000n);

      resolve({
        stdout: "",
        stderr: `Execution spawn error: ${err.message}`,
        exitCode: 1,
        durationMs,
        timedOut: false,
      });
    });

    child.on("close", (code, signal) => {
      clearTimeout(timer);
      finished = true;
      const endTime = process.hrtime.bigint();
      const durationMs = Number((endTime - startTime) / 1000000n);

      if (timedOut) {
        resolve({
          stdout: stdoutBuffer,
          stderr: `Time Limit Exceeded (${timeout}ms). Program execution was terminated.`,
          exitCode: 124,
          durationMs,
          timedOut: true,
        });
      } else {
        resolve({
          stdout: stdoutBuffer,
          stderr: stderrBuffer,
          exitCode: code !== null ? code : 1,
          durationMs,
          timedOut: false,
        });
      }
    });
  });
}

/**
 * Primary entry point for code execution with queueing and test cases.
 */
async function executeCodeIsolated({ language, code, stdin = "", timeoutMs = DEFAULT_TIMEOUT_MS, testCases = [] }) {
  if (activeJobs >= MAX_CONCURRENT_JOBS) {
    if (pendingQueue.length >= 20) {
      throw new Error("Execution worker capacity reached. Please try again shortly.");
    }
    await new Promise((resolve, reject) => {
      pendingQueue.push({ resolve, reject });
    });
  }

  activeJobs += 1;
  try {
    // 1. Run main execution (with custom stdin or without)
    const mainResult = await runSingleExecution({ language, code, stdin, timeoutMs });

    // 2. If test cases were supplied, run them sequentially against the submitted code
    const testResults = [];
    if (Array.isArray(testCases) && testCases.length > 0) {
      for (const tc of testCases) {
        const tcRun = await runSingleExecution({
          language,
          code,
          stdin: tc.input || "",
          timeoutMs,
        });

        const actualTrimmed = (tcRun.stdout || "").trim();
        const expectedTrimmed = (tc.expected_output || "").trim();
        const passed = tcRun.exitCode === 0 && actualTrimmed === expectedTrimmed;

        testResults.push({
          id: tc.id,
          name: tc.name || "Test Case",
          input: tc.input || "",
          expected: expectedTrimmed,
          actual: actualTrimmed,
          passed,
          durationMs: tcRun.durationMs,
          exitCode: tcRun.exitCode,
          stderr: tcRun.stderr,
          timedOut: tcRun.timedOut,
        });
      }
    }

    return {
      stdout: mainResult.stdout,
      stderr: mainResult.stderr,
      exitCode: mainResult.exitCode,
      durationMs: mainResult.durationMs,
      timedOut: mainResult.timedOut,
      testResults: testResults.length > 0 ? testResults : undefined,
    };
  } finally {
    activeJobs -= 1;
    if (pendingQueue.length > 0) {
      const next = pendingQueue.shift();
      next.resolve();
    }
  }
}

module.exports = {
  executeCodeIsolated,
  runSingleExecution,
};

