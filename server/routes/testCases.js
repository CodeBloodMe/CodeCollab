const express = require("express");
const pool = require("../db.js");
const { requireAuth, requireProjectAccess } = require("../middleware/auth.js");

const router = express.Router({ mergeParams: true });

// GET /api/projects/:projectId/test-cases
router.get("/:projectId/test-cases", requireAuth, async (req, res, next) => {
  const middleware = await requireProjectAccess("viewer");
  middleware(req, res, async () => {
    try {
      const { projectId } = req.params;
      const result = await pool.query(
        "SELECT * FROM project_test_cases WHERE project_id = $1 ORDER BY id ASC",
        [projectId]
      );
      res.json({ test_cases: result.rows });
    } catch (err) {
      console.error("[Get TestCases] Error:", err.message);
      res.status(500).json({ error: "Failed to fetch test cases." });
    }
  });
});

// POST /api/projects/:projectId/test-cases
router.post("/:projectId/test-cases", requireAuth, async (req, res, next) => {
  const middleware = await requireProjectAccess("editor");
  middleware(req, res, async () => {
    try {
      const { projectId } = req.params;
      const { name, input = "", expected_output = "" } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Test case name is required." });
      }

      const insertRes = await pool.query(
        `INSERT INTO project_test_cases (project_id, name, input, expected_output)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [projectId, name.trim(), input, expected_output]
      );

      res.status(201).json({ test_case: insertRes.rows[0] });
    } catch (err) {
      console.error("[Create TestCase] Error:", err.message);
      res.status(500).json({ error: "Failed to create test case." });
    }
  });
});

// PUT /api/projects/:projectId/test-cases/:testCaseId
router.put("/:projectId/test-cases/:testCaseId", requireAuth, async (req, res, next) => {
  const middleware = await requireProjectAccess("editor");
  middleware(req, res, async () => {
    try {
      const { projectId, testCaseId } = req.params;
      const { name, input, expected_output } = req.body;

      const updateRes = await pool.query(
        `UPDATE project_test_cases
         SET name = COALESCE($1, name),
             input = COALESCE($2, input),
             expected_output = COALESCE($3, expected_output)
         WHERE id = $4 AND project_id = $5
         RETURNING *`,
        [name ? name.trim() : null, input, expected_output, testCaseId, projectId]
      );

      if (updateRes.rows.length === 0) {
        return res.status(404).json({ error: "Test case not found." });
      }

      res.json({ test_case: updateRes.rows[0] });
    } catch (err) {
      console.error("[Update TestCase] Error:", err.message);
      res.status(500).json({ error: "Failed to update test case." });
    }
  });
});

// DELETE /api/projects/:projectId/test-cases/:testCaseId
router.delete("/:projectId/test-cases/:testCaseId", requireAuth, async (req, res, next) => {
  const middleware = await requireProjectAccess("editor");
  middleware(req, res, async () => {
    try {
      const { projectId, testCaseId } = req.params;

      const deleteRes = await pool.query(
        "DELETE FROM project_test_cases WHERE id = $1 AND project_id = $2 RETURNING *",
        [testCaseId, projectId]
      );

      if (deleteRes.rows.length === 0) {
        return res.status(404).json({ error: "Test case not found." });
      }

      res.json({ message: "Test case deleted successfully." });
    } catch (err) {
      console.error("[Delete TestCase] Error:", err.message);
      res.status(500).json({ error: "Failed to delete test case." });
    }
  });
});

module.exports = router;

