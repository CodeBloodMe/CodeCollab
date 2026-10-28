const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("./db.js");
const { JWT_SECRET } = require("./middleware/auth.js");

test("User registration and login flow", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not configured in environment");
    return;
  }

  const testUser = `testuser_${Date.now()}`;
  const testEmail = `${testUser}@example.com`;
  const password = "securePassword123";

  try {
    // 1. Password hashing
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    assert.ok(hash !== password);
    assert.equal(await bcrypt.compare(password, hash), true);
    assert.equal(await bcrypt.compare("wrongpass", hash), false);

    // 2. Insert user
    const insertRes = await pool.query(
      `INSERT INTO users (username, email, password_hash, avatar_color)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, email, avatar_color`,
      [testUser, testEmail, hash, "#38bdf8"]
    );

    const user = insertRes.rows[0];
    assert.equal(user.username, testUser);
    assert.equal(user.email, testEmail);

    // 3. JWT creation and verification
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "1h" });
    const decoded = jwt.verify(token, JWT_SECRET);
    assert.equal(decoded.userId, user.id);

    // 4. Duplicate user constraint
    await assert.rejects(
      async () => {
        await pool.query(
          `INSERT INTO users (username, email, password_hash)
           VALUES ($1, $2, $3)`,
          [testUser, "other@example.com", hash]
        );
      },
      /unique/i
    );
  } finally {
    await pool.query("DELETE FROM users WHERE username = $1", [testUser]);
  }
});

