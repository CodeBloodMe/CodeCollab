const fs = require("node:fs");
const path = require("node:path");
const defaultPool = require("./db.js");

const MIGRATIONS_DIR = path.resolve(__dirname, "migrations");

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function getAppliedMigrations(client) {
  const result = await client.query(`
    SELECT name FROM schema_migrations ORDER BY id ASC;
  `);
  return new Set(result.rows.map((r) => r.name));
}

async function runMigrations(pool = defaultPool) {
  const client = await pool.connect();
  const appliedMigrations = [];

  try {
    await ensureMigrationTable(client);
    const applied = await getAppliedMigrations(client);

    if (!fs.existsSync(MIGRATIONS_DIR)) {
      return appliedMigrations;
    }

    const migrationFiles = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of migrationFiles) {
      if (applied.has(file)) {
        continue;
      }

      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, "utf8");

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (name) VALUES ($1);",
          [file]
        );
        await client.query("COMMIT");
        appliedMigrations.push(file);
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed: ${err.message}`);
      }
    }

    return appliedMigrations;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then((applied) => {
      console.log(`[Migrations] Done. Applied count: ${applied.length}`);
      return defaultPool.end();
    })
    .catch((err) => {
      console.error("[Migrations] Error:", err.message);
      defaultPool.end();
      process.exit(1);
    });
}

module.exports = {
  runMigrations,
};
