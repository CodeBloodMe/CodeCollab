const express = require("express");
const pool = require("../db.js");
const { requireAuth, requireProjectAccess } = require("../middleware/auth.js");

const router = express.Router({ mergeParams: true });

function detectLanguage(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  switch (ext) {
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
      return "javascript";
    case "py":
      return "python";
    case "cpp":
    case "cc":
    case "cxx":
    case "h":
    case "hpp":
      return "cpp";
    case "java":
      return "java";
    case "json":
      return "json";
    case "md":
      return "markdown";
    case "html":
      return "html";
    case "css":
      return "css";
    default:
      return "text";
  }
}

// POST /api/projects/:projectId/files - create file
router.post("/:projectId/files", requireAuth, async (req, res, next) => {
  const middleware = await requireProjectAccess("editor");
  middleware(req, res, async () => {
    try {
      const { projectId } = req.params;
      const { name, path = "/", content = "", is_entry_point = false } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: "File name is required." });
      }

      const cleanName = name.trim();
      const cleanPath = path.trim().startsWith("/") ? path.trim() : "/" + path.trim();
      const language = detectLanguage(cleanName);

      const existing = await pool.query(
        "SELECT id FROM project_files WHERE project_id = $1 AND path = $2 AND name = $3",
        [projectId, cleanPath, cleanName]
      );

      if (existing.rows.length > 0) {
        return res.status(409).json({ error: "A file with this name already exists in this folder." });
      }

      const fileRes = await pool.query(
        `INSERT INTO project_files (project_id, name, path, language, content, is_entry_point)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [projectId, cleanName, cleanPath, language, content, is_entry_point]
      );

      await pool.query("UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = $1", [projectId]);

      res.status(201).json({ file: fileRes.rows[0] });
    } catch (err) {
      console.error("[Create File] Error:", err.message);
      res.status(500).json({ error: "Failed to create file." });
    }
  });
});

// GET /api/projects/:projectId/files/:fileId - get file
router.get("/:projectId/files/:fileId", requireAuth, async (req, res, next) => {
  const middleware = await requireProjectAccess("viewer");
  middleware(req, res, async () => {
    try {
      const { projectId, fileId } = req.params;

      const fileRes = await pool.query(
        "SELECT * FROM project_files WHERE id = $1 AND project_id = $2",
        [fileId, projectId]
      );

      if (fileRes.rows.length === 0) {
        return res.status(404).json({ error: "File not found." });
      }

      res.json({ file: fileRes.rows[0] });
    } catch (err) {
      console.error("[Get File] Error:", err.message);
      res.status(500).json({ error: "Failed to retrieve file." });
    }
  });
});

// PUT /api/projects/:projectId/files/:fileId - rename/move file
router.put("/:projectId/files/:fileId", requireAuth, async (req, res, next) => {
  const middleware = await requireProjectAccess("editor");
  middleware(req, res, async () => {
    try {
      const { projectId, fileId } = req.params;
      const { name, path, is_entry_point } = req.body;

      const currentRes = await pool.query(
        "SELECT * FROM project_files WHERE id = $1 AND project_id = $2",
        [fileId, projectId]
      );

      if (currentRes.rows.length === 0) {
        return res.status(404).json({ error: "File not found." });
      }

      const current = currentRes.rows[0];
      const newName = name ? name.trim() : current.name;
      const newPath = path !== undefined ? (path.startsWith("/") ? path : "/" + path) : current.path;
      const newLanguage = name ? detectLanguage(newName) : current.language;

      if (is_entry_point) {
        // Reset other entry points
        await pool.query(
          "UPDATE project_files SET is_entry_point = FALSE WHERE project_id = $1",
          [projectId]
        );
      }

      const updateRes = await pool.query(
        `UPDATE project_files
         SET name = $1, path = $2, language = $3, is_entry_point = COALESCE($4, is_entry_point), updated_at = CURRENT_TIMESTAMP
         WHERE id = $5 AND project_id = $6
         RETURNING *`,
        [newName, newPath, newLanguage, is_entry_point, fileId, projectId]
      );

      await pool.query("UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = $1", [projectId]);

      res.json({ file: updateRes.rows[0] });
    } catch (err) {
      console.error("[Update File] Error:", err.message);
      res.status(500).json({ error: "Failed to update file." });
    }
  });
});

// PUT /api/projects/:projectId/files/:fileId/content - explicit content save
router.put("/:projectId/files/:fileId/content", requireAuth, async (req, res, next) => {
  const middleware = await requireProjectAccess("editor");
  middleware(req, res, async () => {
    try {
      const { projectId, fileId } = req.params;
      const { content = "" } = req.body;

      const updateRes = await pool.query(
        `UPDATE project_files
         SET content = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND project_id = $3
         RETURNING *`,
        [content, fileId, projectId]
      );

      if (updateRes.rows.length === 0) {
        return res.status(404).json({ error: "File not found." });
      }

      await pool.query("UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = $1", [projectId]);

      res.json({ message: "File saved successfully.", file: updateRes.rows[0] });
    } catch (err) {
      console.error("[Save Content] Error:", err.message);
      res.status(500).json({ error: "Failed to save file content." });
    }
  });
});

// DELETE /api/projects/:projectId/files/:fileId - delete file
router.delete("/:projectId/files/:fileId", requireAuth, async (req, res, next) => {
  const middleware = await requireProjectAccess("editor");
  middleware(req, res, async () => {
    try {
      const { projectId, fileId } = req.params;

      const deleteRes = await pool.query(
        "DELETE FROM project_files WHERE id = $1 AND project_id = $2 RETURNING *",
        [fileId, projectId]
      );

      if (deleteRes.rows.length === 0) {
        return res.status(404).json({ error: "File not found." });
      }

      // Cleanup Yjs updates for this file room
      const fileRoom = `${projectId}:${fileId}`;
      await pool.query("DELETE FROM yjs_updates WHERE room_id = $1", [fileRoom]);
      await pool.query("UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = $1", [projectId]);

      res.json({ message: "File deleted successfully.", deletedFile: deleteRes.rows[0] });
    } catch (err) {
      console.error("[Delete File] Error:", err.message);
      res.status(500).json({ error: "Failed to delete file." });
    }
  });
});

module.exports = router;

