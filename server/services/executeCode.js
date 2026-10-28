const { executeCodeIsolated } = require("./isolatedRunner.js");

/**
 * Backward-compatible adapter for existing executeCode callers,
 * backed by the isolated Docker execution sandbox.
 */
async function executeCode(code, language = "javascript", stdin = "", timeoutMs = 5000, testCases = []) {
  return await executeCodeIsolated({
    language,
    code,
    stdin,
    timeoutMs,
    testCases,
  });
}

module.exports = executeCode;
