const jwt = require("jsonwebtoken");
const pool = require("../db.js");

const JWT_SECRET = process.env.JWT_SECRET || "codeforge-secure-jwt-secret-key-2026";

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authentication token required." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const userRes = await pool.query(
      "SELECT id, username, email, avatar_color, created_at FROM users WHERE id = $1",
      [decoded.userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: "User no longer exists." });
    }

    req.user = userRes.rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired authentication token." });
  }
}

// Optional auth helper: attaches user if token is provided, doesn't reject if not
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      const userRes = await pool.query(
        "SELECT id, username, email, avatar_color, created_at FROM users WHERE id = $1",
        [decoded.userId]
      );
      if (userRes.rows.length > 0) {
        req.user = userRes.rows[0];
      }
    }
  } catch {
    // Continue unauthenticated
  }
  next();
}

// Project authorization helper
async function requireProjectAccess(roleRequired = "viewer") {
  return async (req, res, next) => {
    try {
      const projectId = req.params.projectId || req.params.id;
      const userId = req.user ? req.user.id : null;

      if (!projectId) {
        return res.status(400).json({ error: "Project ID is required." });
      }

      const projectRes = await pool.query(
        "SELECT * FROM projects WHERE id = $1",
        [projectId]
      );

      if (projectRes.rows.length === 0) {
        return res.status(404).json({ error: "Project not found." });
      }

      const project = projectRes.rows[0];

      // Allow viewer access if unauthenticated and only reading project
      if (!userId && roleRequired === "viewer") {
        req.project = project;
        req.projectRole = "viewer";
        return next();
      }

      if (!userId) {
        return res.status(401).json({ error: "Authentication required to access this project." });
      }

      // Check owner
      if (project.owner_id === userId) {
        req.project = project;
        req.projectRole = "owner";
        return next();
      }

      // Check membership
      let memberRes = await pool.query(
        "SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2",
        [projectId, userId]
      );

      // Auto-enroll collaborator via direct link
      if (memberRes.rows.length === 0) {
        await pool.query(
          `INSERT INTO project_members (project_id, user_id, role)
           VALUES ($1, $2, 'editor')
           ON CONFLICT (project_id, user_id) DO NOTHING`,
          [projectId, userId]
        );
        memberRes = await pool.query(
          "SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2",
          [projectId, userId]
        );
      }

      const memberRole = (memberRes.rows[0] && memberRes.rows[0].role) || "editor";
      req.project = project;
      req.projectRole = memberRole;
      next();
    } catch (err) {
      console.error("[ProjectAuth] Error:", err.message);
      res.status(500).json({ error: "Internal authorization error." });
    }
  };
}

module.exports = {
  JWT_SECRET,
  requireAuth,
  optionalAuth,
  requireProjectAccess,
};
