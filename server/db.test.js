const test = require("node:test");
const assert = require("node:assert/strict");
const Y = require("yjs");
const pool = require("./db.js");
const { runMigrations } = require("./migrate.js");

test("PostgreSQL connection check", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not configured in environment");
    return;
  }

  const result = await pool.query("SELECT 1 AS connected");
  assert.equal(result.rows[0].connected, 1);
});

test("Schema migration creates yjs_updates table safely and repeatably", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not configured in environment");
    return;
  }

  // Initial migration run
  await runMigrations(pool);

  // Verify that yjs_updates table exists
  const tableCheck = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'yjs_updates';"
  );
  assert.equal(tableCheck.rows.length, 1);

  // Verify that schema_migrations tracking table exists
  const migrationTableCheck = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schema_migrations';"
  );
  assert.equal(migrationTableCheck.rows.length, 1);

  // Repeated run should be safe and idempotent (no new migrations applied)
  const repeatedRun = await runMigrations(pool);
  assert.deepEqual(repeatedRun, []);
});

test("Inserting and retrieving a sample Yjs document update", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not configured in environment");
    return;
  }

  const testRoomId = `test_room_${Date.now()}`;

  // Create a sample Yjs document update
  const initialDoc = new Y.Doc();
  const ytext = initialDoc.getText("codemirror");
  ytext.insert(0, "console.log('Sample test payload');");
  const sampleUpdate = Buffer.from(Y.encodeStateAsUpdate(initialDoc));

  // Insert update into database
  const insertResult = await pool.query(
    "INSERT INTO yjs_updates (room_id, update_data) VALUES ($1, $2) RETURNING id, room_id, created_at;",
    [testRoomId, sampleUpdate]
  );

  assert.equal(insertResult.rows.length, 1);
  assert.equal(insertResult.rows[0].room_id, testRoomId);
  assert.ok(insertResult.rows[0].id);
  assert.ok(insertResult.rows[0].created_at instanceof Date);

  // Retrieve update by room_id
  const selectResult = await pool.query(
    "SELECT id, room_id, update_data, created_at FROM yjs_updates WHERE room_id = $1 ORDER BY id ASC;",
    [testRoomId]
  );

  assert.equal(selectResult.rows.length, 1);
  assert.equal(selectResult.rows[0].room_id, testRoomId);
  assert.ok(Buffer.isBuffer(selectResult.rows[0].update_data));
  assert.equal(Buffer.compare(selectResult.rows[0].update_data, sampleUpdate), 0);

  // Verify update reconstructs the Y.Doc state
  const restoredDoc = new Y.Doc();
  Y.applyUpdate(restoredDoc, selectResult.rows[0].update_data);
  assert.equal(
    restoredDoc.getText("codemirror").toString(),
    "console.log('Sample test payload');"
  );

  // Clean up sample test room record
  await pool.query("DELETE FROM yjs_updates WHERE room_id = $1;", [testRoomId]);
});

test("startServer rejects when DATABASE_URL is missing", async () => {
  const { startServer } = require("./server.js");
  const origDbUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

  try {
    await assert.rejects(
      async () => {
        await startServer(0);
      },
      {
        message: /DATABASE_URL is not set/,
      }
    );
  } finally {
    process.env.DATABASE_URL = origDbUrl;
  }
});

test.after(async () => {
  await pool.end();
});
