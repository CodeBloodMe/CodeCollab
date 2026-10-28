const express = require("express");
const diff = require("diff");
const pool = require("../db.js");
const { requireAuth, requireProjectAccess } = require("../middleware/auth.js");

const router = express.Router({ mergeParams: true });

// GET /api/projects/:projectId/checkpoints - list checkpoints
router.get("/:projectId/checkpoints", requireAuth, async (req, res, next) => {
  const middleware = await requireProjectAccess("viewer");
  middleware(req, res, async () => {
    try {
      const { projectId } = req.params;

      const result = await pool.query(
        `SELECT pc.id, pc.project_id, pc.message, pc.created_at, pc.user_id,
                u.username AS author_username, u.avatar_color AS author_avatar_color,
                jsonb_object_keys(pc.files_snapshot) AS file_count
         FROM project_checkpoints pc
         LEFT JOIN users u ON pc.user_id = u.id
         WHERE pc.project_id = $1
         ORDER BY pc.created_at DESC`,
        [projectId]
      );

      // Deduplicate rows from jsonb_object_keys or count files
      const checkpointsRes = await pool.query(
        `SELECT pc.id, pc.project_id, pc.message, pc.created_at, pc.user_id,
                u.username AS author_username, u.avatar_color AS author_avatar_color,
                (SELECT count(*) FROM jsonb_object_keys(pc.files_snapshot)) AS files_count
         FROM project_checkpoints pc
         LEFT JOIN users u ON pc.user_id = u.id
         WHERE pc.project_id = $1
         ORDER BY pc.created_at DESC`,
        [projectId]
      );

      res.json({ checkpoints: checkpointsRes.rows });
    } catch (err) {
      console.error("[Get Checkpoints] Error:", err.message);
      res.status(500).json({ error: "Failed to fetch checkpoints." });
    }
  });
});

// POST /api/projects/:projectId/checkpoints - create checkpoint
router.post("/:projectId/checkpoints", requireAuth, async (req, res, next) => {
  const middleware = await requireProjectAccess("editor");
  middleware(req, res, async () => {
    try {
      const { projectId } = req.params;
      const { message = "Manual checkpoint" } = req.body;
      const userId = req.user.id;

      // Fetch all files
      const filesRes = await pool.query(
        "SELECT * FROM project_files WHERE project_id = $1",
        [projectId]
      );

      if (filesRes.rows.length === 0) {
        return res.status(400).json({ error: "Cannot create a checkpoint for an empty project." });
      }

      const snapshot = {};
      for (const file of filesRes.rows) {
        snapshot[file.id] = {
          id: file.id,
          name: file.name,
          path: file.path,
          language: file.language,
          content: file.content || "",
          is_entry_point: file.is_entry_point,
        };
      }

      const insertRes = await pool.query(
        `INSERT INTO project_checkpoints (project_id, user_id, message, files_snapshot)
         VALUES ($1, $2, $3, $4)
         RETURNING id, project_id, user_id, message, created_at`,
        [projectId, userId, message.trim(), JSON.stringify(snapshot)]
      );

      res.status(201).json({
        message: "Checkpoint created successfully.",
        checkpoint: {
          ...insertRes.rows[0],
          author_username: req.user.username,
          author_avatar_color: req.user.avatar_color,
          files_count: filesRes.rows.length,
        },
      });
    } catch (err) {
      console.error("[Create Checkpoint] Error:", err.message);
      res.status(500).json({ error: "Failed to create checkpoint." });
    }
  });
});

// GET /api/projects/:projectId/checkpoints/:checkpointId - get details
router.get("/:projectId/checkpoints/:checkpointId", requireAuth, async (req, res, next) => {
  const middleware = await requireProjectAccess("viewer");
  middleware(req, res, async () => {
    try {
      const { projectId, checkpointId } = req.params;

      const result = await pool.query(
        `SELECT pc.*, u.username AS author_username, u.avatar_color AS author_avatar_color
         FROM project_checkpoints pc
         LEFT JOIN users u ON pc.user_id = u.id
         WHERE pc.id = $1 AND pc.project_id = $2`,
        [checkpointId, projectId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Checkpoint not found." });
      }

      res.json({ checkpoint: result.rows[0] });
    } catch (err) {
      console.error("[Get Checkpoint] Error:", err.message);
      res.status(500).json({ error: "Failed to fetch checkpoint details." });
    }
  });
});

// POST /api/projects/:projectId/checkpoints/:checkpointId/restore - non-destructive restore
router.post("/:projectId/checkpoints/:checkpointId/restore", requireAuth, async (req, res, next) => {
  const middleware = await requireProjectAccess("editor");
  middleware(req, res, async () => {
    const client = await pool.connect();
    try {
      const { projectId, checkpointId } = req.params;
      const userId = req.user.id;

      // 1. Fetch checkpoint
      const checkRes = await client.query(
        "SELECT * FROM project_checkpoints WHERE id = $1 AND project_id = $2",
        [checkpointId, projectId]
      );

      if (checkRes.rows.length === 0) {
        return res.status(404).json({ error: "Checkpoint not found." });
      }

      const checkpoint = checkRes.rows[0];
      const snapshot = checkpoint.files_snapshot;

      await client.query("BEGIN");

      const restoredFiles = [];

      for (const [key, snapFile] of Object.entries(snapshot)) {
        // Upsert file
        const upsertRes = await client.query(
          `INSERT INTO project_files (id, project_id, name, path, language, content, is_entry_point)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE
           SET name = EXCLUDED.name,
               path = EXCLUDED.path,
               language = EXCLUDED.language,
               content = EXCLUDED.content,
               is_entry_point = EXCLUDED.is_entry_point,
               updated_at = CURRENT_TIMESTAMP
           RETURNING *`,
          [
            snapFile.id || key,
            projectId,
            snapFile.name,
            snapFile.path || "/",
            snapFile.language || "javascript",
            snapFile.content || "",
            Boolean(snapFile.is_entry_point),
          ]
        );
        restoredFiles.push(upsertRes.rows[0]);
      }

      // Record a new checkpoint for the restore operation to preserve complete audit history
      const restoreMessage = `Restored state from Checkpoint #${checkpoint.id} ("${checkpoint.message}")`;
      const newCheckRes = await client.query(
        `INSERT INTO project_checkpoints (project_id, user_id, message, files_snapshot)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [projectId, userId, restoreMessage, JSON.stringify(snapshot)]
      );

      await client.query("UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = $1", [projectId]);
      await client.query("COMMIT");

      res.json({
        message: "Project successfully restored from checkpoint.",
        restored_checkpoint_id: checkpoint.id,
        new_checkpoint: newCheckRes.rows[0],
        files: restoredFiles,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("[Restore Checkpoint] Error:", err.message);
      res.status(500).json({ error: "Failed to restore checkpoint." });
    } finally {
      client.release();
    }
  });
});

// POST /api/projects/:projectId/checkpoints/diff - textual diff between files or checkpoints
router.post("/:projectId/checkpoints/diff", requireAuth, async (req, res, next) => {
  const middleware = await requireProjectAccess("viewer");
  middleware(req, res, async () => {
    try {
      const { projectId } = req.params;
      const { fileId, checkpointIdA, checkpointIdB } = req.body;

      if (!fileId) {
        return res.status(400).json({ error: "fileId is required to compute diff." });
      }

      let contentA = "";
      let contentB = "";
      let fileName = "file";

      // If checkpointIdA is provided, fetch content from snapshot A
      if (checkpointIdA) {
        const resA = await pool.query(
          "SELECT files_snapshot FROM project_checkpoints WHERE id = $1 AND project_id = $2",
          [checkpointIdA, projectId]
        );
        if (resA.rows.length > 0) {
          const snap = resA.rows[0].files_snapshot;
          contentA = snap[fileId] ? snap[fileId].content : "";
          if (snap[fileId]) fileName = snap[fileId].name;
        }
      }

      // If checkpointIdB is provided, fetch from snapshot B; otherwise use current file content
      if (checkpointIdB) {
        const resB = await pool.query(
          "SELECT files_snapshot FROM project_checkpoints WHERE id = $1 AND project_id = $2",
          [checkpointIdB, projectId]
        );
        if (resB.rows.length > 0) {
          const snap = resB.rows[0].files_snapshot;
          contentB = snap[fileId] ? snap[fileId].content : "";
          if (snap[fileId]) fileName = snap[fileId].name;
        }
      } else {
        const currentRes = await pool.query(
          "SELECT name, content FROM project_files WHERE id = $1 AND project_id = $2",
          [fileId, projectId]
        );
        if (currentRes.rows.length > 0) {
          contentB = currentRes.rows[0].content || "";
          fileName = currentRes.rows[0].name;
        }
      }

      // Compute structured patch and diff parts
      const patch = diff.createPatch(fileName, contentA, contentB, "Version A", "Version B");
      const diffLines = diff.diffLines(contentA, contentB);

      res.json({
        file_name: fileName,
        patch,
        diff_lines: diffLines,
        summary: {
          added_lines: diffLines.filter((p) => p.added).reduce((acc, p) => acc + (p.count || 0), 0),
          removed_lines: diffLines.filter((p) => p.removed).reduce((acc, p) => acc + (p.count || 0), 0),
        },
      });
    } catch (err) {
      console.error("[Diff Checkpoint] Error:", err.message);
      res.status(500).json({ error: "Failed to compute diff." });
    }
  });
});

module.exports = router;

