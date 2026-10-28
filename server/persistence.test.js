const test = require("node:test");
const assert = require("node:assert/strict");
const Y = require("yjs");
const pool = require("./db.js");
const { ysocketio } = require("./server.js");

const mockNsp = {
  name: "/yjs|test-mock",
  emit: () => {},
  disconnectSockets: () => {},
};

test("Yjs room state persists and reloads across simulated restart/reload", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not configured in environment");
    return;
  }

  const roomId = `test-room-reload-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  try {
    // 1. Initial room join and edit
    const doc1 = await ysocketio.initDocument(roomId, mockNsp);
    const ytext1 = doc1.getText("codemirror");
    ytext1.insert(0, "function calculateTotal() { return 42; }");

    // Wait for the persistence write queue to flush
    await ysocketio.persistence.writeState(roomId, doc1);

    // Verify row was persisted in PostgreSQL
    const checkDb = await pool.query(
      "SELECT count(*) AS count FROM yjs_updates WHERE room_id = $1;",
      [roomId]
    );
    assert.ok(Number(checkDb.rows[0].count) >= 1);

    // 2. Simulate server restart / all clients disconnecting
    await doc1.destroy();
    assert.equal(ysocketio.documents.has(roomId), false);

    // 3. New client reconnects, initializing the room again
    const doc2 = await ysocketio.initDocument(roomId, mockNsp);
    assert.equal(
      doc2.getText("codemirror").toString(),
      "function calculateTotal() { return 42; }"
    );

    await doc2.destroy();
  } finally {
    // Cleanup test data
    await pool.query("DELETE FROM yjs_updates WHERE room_id = $1;", [roomId]);
  }
});

test("Concurrent room initialization prevents duplicate documents and hooks", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not configured in environment");
    return;
  }

  const roomId = `test-room-concurrent-init-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  try {
    // Pre-seed an update in the database
    const seedDoc = new Y.Doc();
    seedDoc.getText("codemirror").insert(0, "// Base initial code\n");
    const seedUpdate = Buffer.from(Y.encodeStateAsUpdate(seedDoc));
    await pool.query(
      "INSERT INTO yjs_updates (room_id, update_data) VALUES ($1, $2);",
      [roomId, seedUpdate]
    );

    // Trigger two simultaneous initDocument calls for the same room
    const [docA, docB] = await Promise.all([
      ysocketio.initDocument(roomId, mockNsp),
      ysocketio.initDocument(roomId, mockNsp),
    ]);

    // Ensure both callers receive the exact same document instance
    assert.equal(docA, docB);
    assert.equal(docA.getText("codemirror").toString(), "// Base initial code\n");

    await docA.destroy();
  } finally {
    await pool.query("DELETE FROM yjs_updates WHERE room_id = $1;", [roomId]);
  }
});

test("Concurrent edits from multiple clients are persisted without lost updates", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not configured in environment");
    return;
  }

  const roomId = `test-room-concurrent-edits-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  try {
    const serverDoc = await ysocketio.initDocument(roomId, mockNsp);

    // Simulate two client documents branching from the current state
    const client1 = new Y.Doc();
    const client2 = new Y.Doc();

    const baseState = Y.encodeStateAsUpdate(serverDoc);
    Y.applyUpdate(client1, baseState);
    Y.applyUpdate(client2, baseState);

    // Client 1 makes edit
    client1.getText("codemirror").insert(0, "// Client 1 edit\n");
    const update1 = Buffer.from(
      Y.encodeStateAsUpdate(client1, Y.encodeStateVector(serverDoc))
    );

    // Client 2 makes concurrent edit
    client2.getText("codemirror").insert(0, "// Client 2 edit\n");
    const update2 = Buffer.from(
      Y.encodeStateAsUpdate(client2, Y.encodeStateVector(serverDoc))
    );

    // Apply concurrent updates to server document
    Y.applyUpdate(serverDoc, update1);
    Y.applyUpdate(serverDoc, update2);

    // Wait for persistence queue to finish writing
    await ysocketio.persistence.writeState(roomId, serverDoc);

    // Query persisted updates from database
    const dbUpdates = await pool.query(
      "SELECT update_data FROM yjs_updates WHERE room_id = $1 ORDER BY id ASC;",
      [roomId]
    );
    assert.ok(dbUpdates.rows.length >= 2);

    // Verify a fresh document reconstructed from DB converges to server document
    const restoredDoc = new Y.Doc();
    for (const row of dbUpdates.rows) {
      Y.applyUpdate(restoredDoc, row.update_data);
    }

    assert.equal(
      restoredDoc.getText("codemirror").toString(),
      serverDoc.getText("codemirror").toString()
    );

    await serverDoc.destroy();
  } finally {
    await pool.query("DELETE FROM yjs_updates WHERE room_id = $1;", [roomId]);
  }
});

test.after(async () => {
  await pool.end();
});
