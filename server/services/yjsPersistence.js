const Y = require("yjs");
const defaultPool = require("../db.js");

const DB_INIT_ORIGIN = Symbol("db-init");

function createYjsPersistence(pool = defaultPool) {
  const writeQueues = new Map();

  function queueSaveUpdate(docName, update) {
    const currentQueue = writeQueues.get(docName) || Promise.resolve();
    const nextQueue = currentQueue
      .then(async () => {
        const buffer = Buffer.isBuffer(update) ? update : Buffer.from(update);
        await pool.query(
          "INSERT INTO yjs_updates (room_id, update_data) VALUES ($1, $2);",
          [docName, buffer]
        );
      })
      .catch((err) => {
        console.error("[Yjs Persistence] Failed to save update:", err.message);
      });

    writeQueues.set(docName, nextQueue);
    return nextQueue.finally(() => {
      if (writeQueues.get(docName) === nextQueue) {
        writeQueues.delete(docName);
      }
    });
  }

  async function bindState(docName, ydoc) {
    if (ydoc._persistenceBound) {
      return;
    }
    ydoc._persistenceBound = true;

    let isRestoring = true;
    const pendingUpdates = [];

    // Register update listener before applying DB updates, filtering DB_INIT_ORIGIN
    ydoc.on("update", (update, origin) => {
      if (origin === DB_INIT_ORIGIN) {
        return;
      }

      if (isRestoring) {
        pendingUpdates.push(update);
        return;
      }

      queueSaveUpdate(docName, update);
    });

    try {
      // Query saved updates ordered by insertion sequence
      const res = await pool.query(
        "SELECT update_data FROM yjs_updates WHERE room_id = $1 ORDER BY id ASC;",
        [docName]
      );

      if (res.rows.length > 0) {
        for (const row of res.rows) {
          Y.applyUpdate(ydoc, row.update_data, DB_INIT_ORIGIN);
        }
      } else if (docName.includes(":")) {
        // Seed initial file content from project_files if this file has no Yjs updates yet
        const fileId = docName.split(":")[1];
        const fileRes = await pool.query(
          "SELECT content FROM project_files WHERE id = $1",
          [fileId]
        );
        if (fileRes.rows.length > 0 && fileRes.rows[0].content) {
          const ytext = ydoc.getText("codemirror");
          if (ytext.length === 0) {
            ytext.insert(0, fileRes.rows[0].content);
            const initialUpdate = Y.encodeStateAsUpdate(ydoc);
            await pool.query(
              "INSERT INTO yjs_updates (room_id, update_data) VALUES ($1, $2);",
              [docName, Buffer.from(initialUpdate)]
            );
          }
        }
      }
    } catch (err) {
      console.error("[Yjs Persistence] Failed to load updates for room:", err.message);
    } finally {
      isRestoring = false;
    }

    // Flush any concurrent updates that arrived while restoring
    for (const pending of pendingUpdates) {
      queueSaveUpdate(docName, pending);
    }
  }

  async function writeState(docName, ydoc) {
    const pendingQueue = writeQueues.get(docName);
    if (pendingQueue) {
      await pendingQueue;
    }
  }

  return {
    provider: pool,
    bindState,
    writeState,
    queueSaveUpdate,
    writeQueues,
  };
}

function setupYjsPersistence(ysocketio, pool = defaultPool) {
  const persistence = createYjsPersistence(pool);
  ysocketio.persistence = persistence;

  // Wrap initDocument to prevent concurrent duplicate initialization of the same room
  const originalInitDocument = ysocketio.initDocument.bind(ysocketio);
  const initLocks = new Map();

  ysocketio.initDocument = async function (docName, nsp, gcEnabled) {
    if (this._documents.has(docName)) {
      return this._documents.get(docName);
    }

    if (initLocks.has(docName)) {
      return await initLocks.get(docName);
    }

    const initPromise = (async () => {
      try {
        return await originalInitDocument(docName, nsp, gcEnabled);
      } finally {
        initLocks.delete(docName);
      }
    })();

    initLocks.set(docName, initPromise);
    return await initPromise;
  };

  return persistence;
}

module.exports = {
  createYjsPersistence,
  setupYjsPersistence,
  DB_INIT_ORIGIN,
};

