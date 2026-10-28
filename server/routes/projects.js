const express = require("express");
const pool = require("../db.js");
const { requireAuth, optionalAuth, requireProjectAccess } = require("../middleware/auth.js");
const { getStarterFiles } = require("../services/starterTemplates.js");

const router = express.Router();

// GET /api/projects - list user's projects
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT p.*,
             u.username AS owner_username,
             u.avatar_color AS owner_avatar_color,
             COALESCE(pm.role, 'owner') AS user_role,
             COUNT(DISTINCT pf.id) AS file_count
      FROM projects p
      JOIN users u ON p.owner_id = u.id
      LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $1
      LEFT JOIN project_files pf ON p.id = pf.project_id
      WHERE p.owner_id = $1 OR pm.user_id = $1
      GROUP BY p.id, u.username, u.avatar_color, pm.role
      ORDER BY p.updated_at DESC
    `;

    const result = await pool.query(query, [userId]);
    res.json({ projects: result.rows });
  } catch (err) {
    console.error("[Projects List] Error:", err.message);
    res.status(500).json({ error: "Failed to fetch projects." });
  }
});

// POST /api/projects - create new project
router.post("/", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, description = "", template = "javascript", visibility = "private" } = req.body;
    const userId = req.user.id;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Project name is required." });
    }

    await client.query("BEGIN");

    // Insert project
    const projRes = await client.query(
      `INSERT INTO projects (name, description, owner_id, visibility)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name.trim(), description.trim(), userId, visibility]
    );

    const project = projRes.rows[0];

    // Insert starter files
    const starterFiles = getStarterFiles(template);
    const createdFiles = [];

    for (const f of starterFiles) {
      const fileRes = await client.query(
        `INSERT INTO project_files (project_id, name, path, language, content, is_entry_point)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [project.id, f.name, f.path, f.language, f.content, f.is_entry_point]
      );
      createdFiles.push(fileRes.rows[0]);
    }

    // Default sample test case
    await client.query(
      `INSERT INTO project_test_cases (project_id, name, input, expected_output)
       VALUES ($1, $2, $3, $4)`,
      [project.id, "Default Test Case", "9", "Indices: [0, 1]"]
    );

    // Initial checkpoint
    const snapshot = {};
    for (const f of createdFiles) {
      snapshot[f.id] = { name: f.name, path: f.path, content: f.content, language: f.language };
    }
    await client.query(
      `INSERT INTO project_checkpoints (project_id, user_id, message, files_snapshot)
       VALUES ($1, $2, $3, $4)`,
      [project.id, userId, "Initial project creation", JSON.stringify(snapshot)]
    );

    await client.query("COMMIT");

    res.status(201).json({
      message: "Project created successfully.",
      project: {
        ...project,
        files: createdFiles,
        user_role: "owner",
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[Projects Create] Error:", err.message);
    res.status(500).json({ error: "Failed to create project." });
  } finally {
    client.release();
  }
});

// GET /api/projects/:id - get project details
router.get("/:id", optionalAuth, async (req, res, next) => {
  const middleware = await requireProjectAccess("viewer");
  middleware(req, res, async () => {
    try {
      const projectId = req.project.id;

      // Fetch files
      const filesRes = await pool.query(
        `SELECT * FROM project_files WHERE project_id = $1 ORDER BY is_entry_point DESC, name ASC`,
        [projectId]
      );

      // Fetch members
      const membersRes = await pool.query(
        `SELECT u.id, u.username, u.email, u.avatar_color, pm.role, pm.joined_at
         FROM project_members pm
         JOIN users u ON pm.user_id = u.id
         WHERE pm.project_id = $1
         UNION ALL
         SELECT u.id, u.username, u.email, u.avatar_color, 'owner' as role, p.created_at as joined_at
         FROM projects p
         JOIN users u ON p.owner_id = u.id
         WHERE p.id = $1`,
        [projectId]
      );

      // Fetch checkpoints summary
      const checkpointsRes = await pool.query(
        `SELECT pc.id, pc.message, pc.created_at, u.username AS author
         FROM project_checkpoints pc
         LEFT JOIN users u ON pc.user_id = u.id
         WHERE pc.project_id = $1
         ORDER BY pc.created_at DESC`,
        [projectId]
      );

      // Fetch test cases
      const testCasesRes = await pool.query(
        `SELECT * FROM project_test_cases WHERE project_id = $1 ORDER BY id ASC`,
        [projectId]
      );

      res.json({
        project: req.project,
        user_role: req.projectRole,
        files: filesRes.rows,
        members: membersRes.rows,
        checkpoints: checkpointsRes.rows,
        test_cases: testCasesRes.rows,
      });
    } catch (err) {
      console.error("[Project Get] Error:", err.message);
      res.status(500).json({ error: "Failed to retrieve project details." });
    }
  });
});

// PUT /api/projects/:id - update project
router.put("/:id", requireAuth, async (req, res, next) => {
  const middleware = await requireProjectAccess("owner");
  middleware(req, res, async () => {
    try {
      const { name, description, visibility } = req.body;
      const projectId = req.project.id;

      const updateRes = await pool.query(
        `UPDATE projects
         SET name = COALESCE($1, name),
             description = COALESCE($2, description),
             visibility = COALESCE($3, visibility),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING *`,
        [name ? name.trim() : null, description !== undefined ? description.trim() : null, visibility, projectId]
      );

      res.json({ project: updateRes.rows[0] });
    } catch (err) {
      console.error("[Project Update] Error:", err.message);
      res.status(500).json({ error: "Failed to update project." });
    }
  });
});

// DELETE /api/projects/:id - delete project
router.delete("/:id", requireAuth, async (req, res, next) => {
  const middleware = await requireProjectAccess("owner");
  middleware(req, res, async () => {
    try {
      const projectId = req.project.id;

      // Delete project (cascade removes files, members, checkpoints, test cases)
      await pool.query("DELETE FROM projects WHERE id = $1", [projectId]);

      // Clean up yjs updates for all rooms related to this project
      await pool.query("DELETE FROM yjs_updates WHERE room_id LIKE $1", [`${projectId}%`]);

      res.json({ message: "Project deleted successfully." });
    } catch (err) {
      console.error("[Project Delete] Error:", err.message);
      res.status(500).json({ error: "Failed to delete project." });
    }
  });
});

// POST /api/projects/:id/members - invite member
router.post("/:id/members", requireAuth, async (req, res, next) => {
  const middleware = await requireProjectAccess("owner");
  middleware(req, res, async () => {
    try {
      const { identifier, role = "editor" } = req.body;
      const projectId = req.project.id;

      if (!identifier) {
        return res.status(400).json({ error: "Username or email is required." });
      }

      const userRes = await pool.query(
        "SELECT id, username, email, avatar_color FROM users WHERE username = $1 OR email = $1",
        [identifier.trim().toLowerCase()]
      );

      if (userRes.rows.length === 0) {
        return res.status(404).json({ error: "User not found." });
      }

      const invitee = userRes.rows[0];

      if (invitee.id === req.project.owner_id) {
        return res.status(400).json({ error: "User is already the project owner." });
      }

      await pool.query(
        `INSERT INTO project_members (project_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (project_id, user_id)
         DO UPDATE SET role = EXCLUDED.role`,
        [projectId, invitee.id, role]
      );

      res.json({
        message: "Collaborator added successfully.",
        member: { ...invitee, role },
      });
    } catch (err) {
      console.error("[Add Member] Error:", err.message);
      res.status(500).json({ error: "Failed to add member." });
    }
  });
});

// DELETE /api/projects/:id/members/:userId - remove member
router.delete("/:id/members/:userId", requireAuth, async (req, res, next) => {
  const middleware = await requireProjectAccess("owner");
  middleware(req, res, async () => {
    try {
      const { projectId, userId } = req.params;
      await pool.query(
        "DELETE FROM project_members WHERE project_id = $1 AND user_id = $2",
        [projectId, userId]
      );
      res.json({ message: "Member removed from project." });
    } catch (err) {
      console.error("[Remove Member] Error:", err.message);
      res.status(500).json({ error: "Failed to remove member." });
    }
  });
});

module.exports = router;

