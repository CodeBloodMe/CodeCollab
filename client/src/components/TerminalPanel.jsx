import React, { useState } from "react";
import {
  Terminal,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  RotateCw,
  Plus,
  Trash2,
  Sliders,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const TerminalPanel = ({
  executionResult = { stdout: "", stderr: "", exitCode: null, durationMs: null },
  isRunning,
  onRunCode,
  testCases = [],
  onCreateTestCase,
  onDeleteTestCase,
  onRunTestCases,
  customStdin,
  setCustomStdin,
}) => {
  const [activeTab, setActiveTab] = useState("terminal"); // "terminal" | "tests" | "stdin"
  const [newTcName, setNewTcName] = useState("");
  const [newTcInput, setNewTcInput] = useState("");
  const [newTcExpected, setNewTcExpected] = useState("");
  const [isAddingTc, setIsAddingTc] = useState(false);

  const handleAddTcSubmit = (e) => {
    e.preventDefault();
    if (!newTcName.trim() || !newTcExpected.trim()) return;
    onCreateTestCase({
      name: newTcName.trim(),
      input: newTcInput,
      expected_output: newTcExpected.trim(),
    });
    setNewTcName("");
    setNewTcInput("");
    setNewTcExpected("");
    setIsAddingTc(false);
  };

  const testResults = executionResult.testResults || [];
  const passedCount = testResults.filter((t) => t.passed).length;

  return (
    <div className="h-full flex flex-col bg-slate-950 border-t border-slate-800 text-slate-300 font-mono text-xs select-none">
      {/* Tab Header & Control Bar */}
      <div className="h-9 px-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("terminal")}
            className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === "terminal"
                ? "bg-slate-800 text-cyan-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Terminal className="size-3.5" />
            <span>Terminal Output</span>
            {executionResult.exitCode !== null && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                  executionResult.exitCode === 0
                    ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                    : "bg-rose-950 text-rose-400 border border-rose-800/60"
                }`}
              >
                code {executionResult.exitCode}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("tests")}
            className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === "tests"
                ? "bg-slate-800 text-cyan-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <CheckCircle2 className="size-3.5" />
            <span>Test Cases ({testCases.length})</span>
            {testResults.length > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                  passedCount === testResults.length
                    ? "bg-emerald-950 text-emerald-400"
                    : "bg-amber-950 text-amber-400"
                }`}
              >
                {passedCount}/{testResults.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("stdin")}
            className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === "stdin"
                ? "bg-slate-800 text-cyan-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sliders className="size-3.5" />
            <span>Custom Stdin</span>
          </button>
        </div>

        {/* Execution Meta summary */}
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          {executionResult.durationMs !== null && (
            <div className="flex items-center gap-1 text-slate-400">
              <Clock className="size-3" />
              <span>{executionResult.durationMs}ms</span>
            </div>
          )}

          {activeTab === "tests" && (
            <button
              onClick={onRunTestCases}
              disabled={isRunning || testCases.length === 0}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-[11px] transition disabled:opacity-50"
            >
              {isRunning ? <RotateCw className="size-3 animate-spin" /> : <Play className="size-3 fill-current" />}
              <span>Evaluate All Tests</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-auto p-3">
        {activeTab === "terminal" ? (
          <div className="h-full flex flex-col font-mono text-xs leading-relaxed select-text">
            {isRunning ? (
              <div className="flex items-center gap-2 text-cyan-400 animate-pulse">
                <RotateCw className="size-4 animate-spin" />
                <span>Executing in isolated sandbox container...</span>
              </div>
            ) : !executionResult.stdout && !executionResult.stderr ? (
              <div className="text-slate-600 italic">
                Program output and compiler errors will appear here after clicking "Run Program".
              </div>
            ) : (
              <div className="space-y-2">
                {executionResult.stdout && (
                  <pre className="text-slate-200 whitespace-pre-wrap">
                    {executionResult.stdout}
                  </pre>
                )}
                {executionResult.stderr && (
                  <pre className="text-rose-400 whitespace-pre-wrap">
                    {executionResult.stderr}
                  </pre>
                )}
                <div className="pt-2 text-[10px] text-slate-500 border-t border-slate-900 flex items-center justify-between">
                  <span>Isolated runner boundary: non-root, net=none, 128MB RAM</span>
                  <span>Execution finished with exit code {executionResult.exitCode}</span>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === "tests" ? (
          /* Test Cases Evaluator */
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-semibold text-slate-300">
                Test Case Specifications & Assertions
              </span>
              <button
                onClick={() => setIsAddingTc(!isAddingTc)}
                className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
              >
                <Plus className="size-3.5" />
                <span>Add Test Case</span>
              </button>
            </div>

            {isAddingTc && (
              <form
                onSubmit={handleAddTcSubmit}
                className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2 font-sans"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Case Name (e.g. Edge Case)"
                    value={newTcName}
                    onChange={(e) => setNewTcName(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200"
                  />
                  <input
                    type="text"
                    placeholder="Input (stdin)"
                    value={newTcInput}
                    onChange={(e) => setNewTcInput(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 font-mono"
                  />
                  <input
                    type="text"
                    placeholder="Expected Output"
                    value={newTcExpected}
                    onChange={(e) => setNewTcExpected(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 font-mono"
                  />
                </div>
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsAddingTc(false)}
                    className="px-2 py-1 text-xs text-slate-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold"
                  >
                    Save Test
                  </button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {testCases.map((tc) => {
                const evalResult = testResults.find((r) => r.id === tc.id || r.name === tc.name);
                return (
                  <div
                    key={tc.id}
                    className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200 font-sans text-xs">
                        {tc.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {evalResult && (
                          <span
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              evalResult.passed
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                                : "bg-rose-950 text-rose-400 border border-rose-800/60"
                            }`}
                          >
                            {evalResult.passed ? (
                              <CheckCircle2 className="size-3" />
                            ) : (
                              <XCircle className="size-3" />
                            )}
                            {evalResult.passed ? "PASSED" : "FAILED"}
                          </span>
                        )}
                        <button
                          onClick={() => onDeleteTestCase(tc.id)}
                          className="text-slate-600 hover:text-rose-400 p-0.5"
                          title="Delete test case"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-850">
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase">
                          Expected
                        </span>
                        <pre className="text-slate-300 font-mono overflow-hidden text-ellipsis">
                          {tc.expected_output || "(empty)"}
                        </pre>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase">
                          Actual
                        </span>
                        <pre
                          className={`font-mono overflow-hidden text-ellipsis ${
                            evalResult
                              ? evalResult.passed
                                ? "text-emerald-400"
                                : "text-rose-400 font-bold"
                              : "text-slate-600"
                          }`}
                        >
                          {evalResult ? evalResult.actual || "(empty)" : "Not run yet"}
                        </pre>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Custom Stdin */
          <div className="h-full flex flex-col space-y-2">
            <span className="text-xs text-slate-400">
              Pass standard input (stdin) lines to your program during execution:
            </span>
            <textarea
              value={customStdin}
              onChange={(e) => setCustomStdin(e.target.value)}
              placeholder="e.g. 5&#10;10 20 30 40 50"
              className="flex-1 w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-100 font-mono text-xs outline-none focus:border-cyan-400 resize-none"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default TerminalPanel;

