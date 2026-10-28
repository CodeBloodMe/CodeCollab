const test = require("node:test");
const assert = require("node:assert/strict");
const pool = require("./db.js");
const { getStarterFiles } = require("./services/starterTemplates.js");

test("Project and file persistence, ownership, and starter templates", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not configured in environment");
    return;
  }

  const username = `proj_user_${Date.now()}`;
  let userId;
  let projectId;

  try {
    // 1. Create User
    const userRes = await pool.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, 'dummyhash')
       RETURNING id`,
      [username, `${username}@test.com`]
    );
    userId = userRes.rows[0].id;

    // 2. Create Project
    const projRes = await pool.query(
      `INSERT INTO projects (name, description, owner_id, visibility)
       VALUES ('Algorithms Suite', 'Sorting and Searching', $1, 'private')
       RETURNING *`,
      [userId]
    );
    const project = projRes.rows[0];
    projectId = project.id;
    assert.equal(project.name, "Algorithms Suite");

    // 3. Create Files from Starter Templates
    const starterFiles = getStarterFiles("python");
    assert.ok(starterFiles.length >= 2);

    for (const f of starterFiles) {
      await pool.query(
        `INSERT INTO project_files (project_id, name, path, language, content, is_entry_point)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [projectId, f.name, f.path, f.language, f.content, f.is_entry_point]
      );
    }

    const filesCount = await pool.query(
      "SELECT count(*) FROM project_files WHERE project_id = $1",
      [projectId]
    );
    assert.equal(Number(filesCount.rows[0].count), starterFiles.length);

    // 4. Update file content
    const fileRes = await pool.query(
      "SELECT id FROM project_files WHERE project_id = $1 AND name = 'main.py'",
      [projectId]
    );
    const fileId = fileRes.rows[0].id;

    await pool.query(
      "UPDATE project_files SET content = 'print(42)' WHERE id = $1",
      [fileId]
    );

    const reloaded = await pool.query(
      "SELECT content FROM project_files WHERE id = $1",
      [fileId]
    );
    assert.equal(reloaded.rows[0].content, "print(42)");

    // 5. Check authorization barrier (other user cannot access private project)
    const otherUserRes = await pool.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ('other_${username}', 'other_${username}@test.com', 'dummyhash')
       RETURNING id`
    );
    const otherUserId = otherUserRes.rows[0].id;

    const accessCheck = await pool.query(
      `SELECT p.id FROM projects p
       LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $1
       WHERE p.id = $2 AND (p.owner_id = $1 OR pm.user_id = $1 OR p.visibility = 'public')`,
      [otherUserId, projectId]
    );
    assert.equal(accessCheck.rows.length, 0); // Correctly denied

    await pool.query("DELETE FROM users WHERE id = $1", [otherUserId]);
  } finally {
    if (userId) {
      await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    }
  }
});

