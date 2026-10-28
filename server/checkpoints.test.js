const test = require("node:test");
const assert = require("node:assert/strict");
const diff = require("diff");
const pool = require("./db.js");

test("Version history checkpoint creation, diff computation, and non-destructive restore", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not configured in environment");
    return;
  }

  const username = `check_user_${Date.now()}`;
  let userId;
  let projectId;

  try {
    const userRes = await pool.query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, 'hash') RETURNING id",
      [username, `${username}@test.com`]
    );
    userId = userRes.rows[0].id;

    const projRes = await pool.query(
      "INSERT INTO projects (name, owner_id) VALUES ('Versioned Project', $1) RETURNING id",
      [userId]
    );
    projectId = projRes.rows[0].id;

    // Create file
    const fileRes = await pool.query(
      `INSERT INTO project_files (project_id, name, path, language, content)
       VALUES ($1, 'app.js', '/', 'javascript', 'const version = 1;\nconsole.log(version);')
       RETURNING id`,
      [projectId]
    );
    const fileId = fileRes.rows[0].id;

    // 1. Create Checkpoint #1
    const snapshotV1 = {
      [fileId]: {
        id: fileId,
        name: "app.js",
        path: "/",
        content: "const version = 1;\nconsole.log(version);",
      },
    };
    const cp1Res = await pool.query(
      `INSERT INTO project_checkpoints (project_id, user_id, message, files_snapshot)
       VALUES ($1, $2, 'Release v1.0', $3)
       RETURNING id`,
      [projectId, userId, JSON.stringify(snapshotV1)]
    );
    const cp1Id = cp1Res.rows[0].id;

    // 2. Modify file to Version 2
    const v2Content = "const version = 2;\nconsole.log('Upgraded to v2');\nconst isLive = true;";
    await pool.query("UPDATE project_files SET content = $1 WHERE id = $2", [v2Content, fileId]);

    // 3. Compute textual diff
    const patch = diff.createPatch("app.js", snapshotV1[fileId].content, v2Content);
    assert.ok(patch.includes("-const version = 1;"));
    assert.ok(patch.includes("+const version = 2;"));

    // 4. Create Checkpoint #2
    const snapshotV2 = {
      [fileId]: { id: fileId, name: "app.js", path: "/", content: v2Content },
    };
    const cp2Res = await pool.query(
      `INSERT INTO project_checkpoints (project_id, user_id, message, files_snapshot)
       VALUES ($1, $2, 'Release v2.0', $3)
       RETURNING id`,
      [projectId, userId, JSON.stringify(snapshotV2)]
    );

    // 5. Restore Checkpoint #1 non-destructively
    // Restoring updates the file content to v1, but records a NEW Checkpoint #3 ("Restored from...")
    await pool.query("UPDATE project_files SET content = $1 WHERE id = $2", [snapshotV1[fileId].content, fileId]);
    const cp3Res = await pool.query(
      `INSERT INTO project_checkpoints (project_id, user_id, message, files_snapshot)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [projectId, userId, `Restored from Checkpoint #${cp1Id}`, JSON.stringify(snapshotV1)]
    );

    // Verify all 3 checkpoints exist (history preserved)
    const allCp = await pool.query(
      "SELECT id, message FROM project_checkpoints WHERE project_id = $1 ORDER BY id ASC",
      [projectId]
    );
    assert.equal(allCp.rows.length, 3);
    assert.equal(allCp.rows[0].message, "Release v1.0");
    assert.equal(allCp.rows[1].message, "Release v2.0");
    assert.ok(allCp.rows[2].message.includes("Restored from"));

    // Verify file content is currently restored to v1
    const finalFile = await pool.query("SELECT content FROM project_files WHERE id = $1", [fileId]);
    assert.equal(finalFile.rows[0].content, snapshotV1[fileId].content);
  } finally {
    if (userId) {
      await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    }
  }
});

