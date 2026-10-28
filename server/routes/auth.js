const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db.js");
const { JWT_SECRET, requireAuth } = require("../middleware/auth.js");

const router = express.Router();

const AVATAR_COLORS = [
  "#38bdf8", "#818cf8", "#c084fc", "#f472b6",
  "#fb7185", "#34d399", "#4ade80", "#facc15"
];

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "Username, email, and password are required." });
    }

    if (username.length < 3 || username.length > 32) {
      return res.status(400).json({ error: "Username must be between 3 and 32 characters." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    // Check duplicate
    const existing = await pool.query(
      "SELECT id FROM users WHERE username = $1 OR email = $2",
      [username.trim().toLowerCase(), email.trim().toLowerCase()]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Username or email is already registered." });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const insertRes = await pool.query(
      `INSERT INTO users (username, email, password_hash, avatar_color)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, email, avatar_color, created_at`,
      [username.trim().toLowerCase(), email.trim().toLowerCase(), passwordHash, color]
    );

    const user = insertRes.rows[0];
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({
      message: "Account created successfully.",
      user,
      token,
    });
  } catch (err) {
    console.error("[Auth Register] Error:", err.message);
    res.status(500).json({ error: "Registration failed." });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { identifier, email, username, password } = req.body;
    const loginId = (identifier || email || username || "").trim().toLowerCase();

    if (!loginId || !password) {
      return res.status(400).json({ error: "Identifier and password are required." });
    }

    const userRes = await pool.query(
      "SELECT * FROM users WHERE email = $1 OR username = $1",
      [loginId]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: "Invalid username/email or password." });
    }

    const user = userRes.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid username/email or password." });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });

    delete user.password_hash;

    res.json({
      message: "Login successful.",
      user,
      token,
    });
  } catch (err) {
    console.error("[Auth Login] Error:", err.message);
    res.status(500).json({ error: "Login failed." });
  }
});

// GET /api/auth/me
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;

