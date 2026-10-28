const test = require("node:test");
const assert = require("node:assert/strict");
const { executeCodeIsolated } = require("./services/isolatedRunner.js");

test("Isolated Docker Runner: JavaScript execution", async () => {
  const code = `
    const a = 15;
    const b = 27;
    console.log("SUM=" + (a + b));
  `;

  const result = await executeCodeIsolated({
    language: "javascript",
    code,
    timeoutMs: 6000,
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.timedOut, false);
  assert.ok(result.stdout.includes("SUM=42"));
});

test("Isolated Docker Runner: Python execution with stdin input", async () => {
  const code = `
import sys
line = sys.stdin.read().strip()
print(f"PROCESSED:{line.upper()}")
  `;

  const result = await executeCodeIsolated({
    language: "python",
    code,
    stdin: "codeforge sandbox",
    timeoutMs: 6000,
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.timedOut, false);
  assert.ok(result.stdout.includes("PROCESSED:CODEFORGE SANDBOX"));
});

test("Isolated Docker Runner: C++ compilation and execution", async () => {
  const code = `
#include <iostream>
int main() {
    std::cout << "CPP RUNNER SUCCESS: " << (10 * 10) << std::endl;
    return 0;
}
  `;

  const result = await executeCodeIsolated({
    language: "cpp",
    code,
    timeoutMs: 8000,
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.timedOut, false);
  assert.ok(result.stdout.includes("CPP RUNNER SUCCESS: 100"));
});

test("Isolated Docker Runner: Wall-clock timeout terminates infinite loop", async () => {
  const code = `
    while (true) {}
  `;

  const result = await executeCodeIsolated({
    language: "javascript",
    code,
    timeoutMs: 2000, // Short timeout for test speed
  });

  assert.equal(result.timedOut, true);
  assert.ok(result.exitCode !== 0);
  assert.ok(result.stderr.includes("Time Limit Exceeded"));
});

test("Isolated Docker Runner: Test cases evaluation against problem specification", async () => {
  const code = `
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on('line', (line) => {
  const n = parseInt(line.trim(), 10);
  console.log(n * 2);
  process.exit(0);
});
  `;

  const testCases = [
    { id: 1, name: "Double 5", input: "5", expected_output: "10" },
    { id: 2, name: "Double 21", input: "21", expected_output: "42" },
    { id: 3, name: "Double 0", input: "0", expected_output: "0" },
  ];

  const result = await executeCodeIsolated({
    language: "javascript",
    code,
    testCases,
    timeoutMs: 5000,
  });

  assert.ok(result.testResults);
  assert.equal(result.testResults.length, 3);
  assert.equal(result.testResults[0].passed, true);
  assert.equal(result.testResults[1].passed, true);
  assert.equal(result.testResults[2].passed, true);
});

