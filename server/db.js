const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");

// Securely load environment variables from local .env if DATABASE_URL is not yet defined
if (!process.env.DATABASE_URL) {
  const envCandidates = [
    path.resolve(__dirname, ".env"),
    path.resolve(process.cwd(), ".env"),
  ];

  for (const envPath of envCandidates) {
    if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
      try {
        process.loadEnvFile(envPath);
        if (process.env.DATABASE_URL) {
          break;
        }
      } catch {
        // Ignore parsing or file read issues
      }
    }
  }
}

const connectionString = process.env.DATABASE_URL;

// Neon PostgreSQL requires SSL connections.
// If connecting to local development without SSL (e.g. localhost), allow non-SSL.
const isLocal =
  Boolean(connectionString) &&
  (connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1")) &&
  !connectionString.includes("sslmode=require");

const pool = new Pool({
  connectionString,
  ssl: connectionString ? (isLocal ? false : { rejectUnauthorized: false }) : false,
});

pool.on("error", (err) => {
  console.error("[PostgreSQL Pool] Unexpected error on idle client:", err.message);
});

// Provide both direct pool instance and helper property access
pool.pool = pool;

module.exports = pool;
