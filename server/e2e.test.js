const test = require("node:test");
const assert = require("node:assert/strict");
const Y = require("yjs");
const pool = require("./db.js");
const { ysocketio } = require("./server.js");
const { executeCodeIsolated } = require("./services/isolatedRunner.js");

const mockNsp = {
  name: "/yjs|test-e2e-project",
  emit: () => {},
  disconnectSockets: () => {},
};

test("E2E: Concurrent multi-client CRDT editing convergence and reload", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL not set");
    return;
  }

  const projectId = `proj-conv-${Date.now()}`;
  const fileId = `file-${Math.random().toString(36).substring(2, 8)}`;
  const docRoom = `${projectId}:${fileId}`;

  try {
    // 1. Client A and Client B instantiate Y.Doc
    const docA = new Y.Doc();
    const docB = new Y.Doc();

    const textA = docA.getText("codemirror");
    const textB = docB.getText("codemirror");

    // Connect CRDT listeners to simulate real-time socket exchange
    docA.on("update", (update) => {
      Y.applyUpdate(docB, update);
    });

    docB.on("update", (update) => {
      Y.applyUpdate(docA, update);
    });

    // 2. Client A edits at start
    textA.insert(0, "function main() {\n");

    // 3. Client B edits concurrently
    textB.insert(textB.length, "  console.log('CodeForge');\n}");

    // 4. Client A and B must converge to exact same text
    assert.equal(textA.toString(), textB.toString());
    assert.ok(textA.toString().includes("CodeForge"));

    // 5. Persist to server YSocketIO and PostgreSQL
    const serverDoc = await ysocketio.initDocument(docRoom, mockNsp);
    const serverText = serverDoc.getText("codemirror");
    serverText.insert(0, textA.toString());

    await ysocketio.persistence.writeState(docRoom, serverDoc);

    // Verify row was stored in PostgreSQL
    const checkDb = await pool.query(
      "SELECT count(*) FROM yjs_updates WHERE room_id = $1",
      [docRoom]
    );
    assert.ok(Number(checkDb.rows[0].count) >= 1);

    // 6. Simulate client reconnecting / server reload
    await serverDoc.destroy();
    assert.equal(ysocketio.documents.has(docRoom), false);

    const reloadedDoc = await ysocketio.initDocument(docRoom, mockNsp);
    assert.equal(
      reloadedDoc.getText("codemirror").toString(),
      textA.toString()
    );

    await reloadedDoc.destroy();
  } finally {
    await pool.query("DELETE FROM yjs_updates WHERE room_id = $1", [docRoom]);
  }
});

test("E2E: Isolated container executes multi-file logic with test runner", async () => {
  const pythonProgram = `
import sys

def fibonacci(n):
    if n <= 0:
        return 0
    elif n == 1:
        return 1
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b

if __name__ == '__main__':
    for line in sys.stdin:
        if line.strip():
            n = int(line.strip())
            print(fibonacci(n))
  `;

  const testCases = [
    { id: 1, name: "Fib 0", input: "0\n", expected_output: "0" },
    { id: 2, name: "Fib 1", input: "1\n", expected_output: "1" },
    { id: 3, name: "Fib 7", input: "7\n", expected_output: "13" },
    { id: 4, name: "Fib 10", input: "10\n", expected_output: "55" },
  ];

  const result = await executeCodeIsolated({
    language: "python",
    code: pythonProgram,
    testCases,
    timeoutMs: 6000,
  });

  assert.equal(result.exitCode, 0);
  assert.ok(result.testResults);
  assert.equal(result.testResults.length, 4);
  assert.ok(result.testResults.every((t) => t.passed));
});

