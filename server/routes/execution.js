const express = require("express");
const pool = require("../db.js");
const { optionalAuth, requireProjectAccess } = require("../middleware/auth.js");
const { executeCodeIsolated } = require("../services/isolatedRunner.js");

const router = express.Router();

// POST /api/execute - standalone execution
router.post("/", optionalAuth, async (req, res) => {
  try {
    const { language = "javascript", code, stdin = "", timeoutMs = 5000, testCases = [] } = req.body;

    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "Code content is required." });
    }

    const result = await executeCodeIsolated({
      language: language.toLowerCase(),
      code,
      stdin,
      timeoutMs,
      testCases,
    });

    res.json(result);
  } catch (err) {
    console.error("[Execution API] Error:", err.message);
    res.status(500).json({
      stdout: "",
      stderr: `Execution error: ${err.message}`,
      exitCode: 1,
      durationMs: 0,
      timedOut: false,
    });
  }
});

// POST /api/projects/:projectId/execute - project-scoped execution
router.post("/projects/:projectId/execute", optionalAuth, async (req, res, next) => {
  const middleware = await requireProjectAccess("viewer");
  middleware(req, res, async () => {
    try {
      const { projectId } = req.params;
      const { language = "javascript", code, stdin = "", timeoutMs = 5000, includeProjectTestCases = false } = req.body;

      if (!code || typeof code !== "string") {
        return res.status(400).json({ error: "Code content is required." });
      }

      let testCases = req.body.testCases || [];

      // Optionally pull saved test cases from DB for this project
      if (includeProjectTestCases) {
        const tcRes = await pool.query(
          "SELECT id, name, input, expected_output FROM project_test_cases WHERE project_id = $1 ORDER BY id ASC",
          [projectId]
        );
        testCases = tcRes.rows;
      }

      const result = await executeCodeIsolated({
        language: language.toLowerCase(),
        code,
        stdin,
        timeoutMs,
        testCases,
      });

      res.json(result);
    } catch (err) {
      console.error("[Project Execution API] Error:", err.message);
      res.status(500).json({
        stdout: "",
        stderr: `Execution error: ${err.message}`,
        exitCode: 1,
        durationMs: 0,
        timedOut: false,
      });
    }
  });
});

module.exports = router;

