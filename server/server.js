const express = require("express");
const http = require("http");
const net = require("node:net");
const os = require("os");
const cors = require("cors");
const { Server } = require("socket.io");
const { YSocketIO } = require("y-socket.io/dist/server");
const executeCode = require("./services/executeCode.js");
const pool = require("./db.js");
const { setupYjsPersistence } = require("./services/yjsPersistence.js");
const { runMigrations } = require("./migrate.js");

// Route imports
const authRoutes = require("./routes/auth.js");
const projectRoutes = require("./routes/projects.js");
const fileRoutes = require("./routes/files.js");
const checkpointRoutes = require("./routes/checkpoints.js");
const testCaseRoutes = require("./routes/testCases.js");
const executionRoutes = require("./routes/execution.js");

const allowedOrigins = [
  "https://code-collab-chi-nine.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:3000",
];

const INSTANCE_ID = process.env.INSTANCE_ID || process.env.HOSTNAME || os.hostname() || "codeforge-server1";
const INSTANCE_ROLE = process.env.INSTANCE_ROLE || "Primary Compute Node";
const AZ_ZONE = process.env.AZ_ZONE || process.env.AWS_REGION || "us-east-1a";

const app = express();

// Trust reverse proxy (AWS Application Load Balancer / Nginx)
app.set("trust proxy", 1);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or dev tools)
      if (!origin || allowedOrigins.includes(origin) || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:") || origin.includes(".amazonaws.com")) {
        return callback(null, true);
      }
      callback(null, true); // Dev-friendly fallback
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["X-Instance-ID", "X-Served-By", "X-Availability-Zone"],
  })
);
app.use(express.json({ limit: "50mb" }));

// Ingress middleware: attach instance identity to every response for AWS verification
app.use((_req, res, next) => {
  res.setHeader("X-Instance-ID", INSTANCE_ID);
  res.setHeader("X-Served-By", `${INSTANCE_ROLE} (${INSTANCE_ID})`);
  res.setHeader("X-Availability-Zone", AZ_ZONE);
  next();
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const ysocketio = new YSocketIO(io);
setupYjsPersistence(ysocketio, pool);
ysocketio.initialize();

console.log("[YSocketIO startup]", {
  renderCommit: process.env.RENDER_GIT_COMMIT || "unavailable",
  renderService: process.env.RENDER_SERVICE_NAME || "unavailable",
  workingDirectory: process.cwd(),
  serverEntry: __filename,
  packageEntry: require.resolve("y-socket.io/dist/server"),
  packageVersion: require("y-socket.io/package.json").version,
  constructionSucceeded: true,
  initializeSucceeded: true,
  namespaceRegistered: Boolean(ysocketio.nsp),
  namespacePattern: "/^\\/yjs\\|.*$/",
});

ysocketio.on("document-loaded", (doc) => {
  console.log(`[YSocketIO Server] Document loaded for room: "${doc.name}"`);
});

ysocketio.on("document-update", (doc, update) => {
  console.log(`[YSocketIO Server] Document update on room: "${doc.name}" (${update.length} bytes)`);
});

ysocketio.on("all-document-connections-closed", (doc) => {
  console.log(`[YSocketIO Server] All connections closed for room: "${doc.name}"`);
});

const yjsNsp = io.of(/^\/yjs\|.*$/);
yjsNsp.on("connection", (socket) => {
  console.log(`[YSocketIO Server] Client ${socket.id} connected to Yjs namespace: ${socket.nsp.name}`);
});

// Socket presence map
const userSocketMap = {};

const PORT = Number(process.env.PORT) || 5000;

function isPortTaken(port, host) {
  return new Promise((resolve) => {
    const probe = net.createServer();

    probe.once("error", (error) => {
      if (error.code === "EADDRNOTAVAIL") {
        resolve(false);
        return;
      }
      resolve(true);
    });

    probe.once("listening", () => {
      probe.close(() => resolve(false));
    });

    probe.listen(port, host);
  });
}

async function getAvailablePort(startPort = PORT) {
  let candidatePort = startPort;

  while (true) {
    const ipv4Busy = await isPortTaken(candidatePort, "127.0.0.1");
    if (!ipv4Busy) {
      const ipv6Busy = await isPortTaken(candidatePort, "::1");
      if (!ipv6Busy) {
        return candidatePort;
      }
    }
    candidatePort += 1;
  }
}

async function startServer(port = PORT) {
  if (!process.env.DATABASE_URL) {
    const errorMsg = "[Startup] FATAL: DATABASE_URL is not set. Refusing to start without persistence.";
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  try {
    const applied = await runMigrations(pool);
    console.log(`[Startup] PostgreSQL connected and migrations verified (newly applied: ${applied.length}).`);
  } catch (err) {
    console.error("[Startup] FATAL: Database migration failed:", err.message);
    throw err;
  }

  const availablePort = await getAvailablePort(port);

  if (availablePort !== port) {
    console.warn(`[Server] Port ${port} is busy. Starting on port ${availablePort} instead.`);
  }

  return new Promise((resolve) => {
    server.listen(availablePort, "0.0.0.0", () => {
      console.log(`Server running on port ${availablePort}`);
      resolve(availablePort);
    });
  });
}

// Health & Telemetry endpoints for AWS Application Load Balancer (ALB)
const serverStartTime = Date.now();

app.get(["/health", "/api/health"], (_req, res) => {
  res.json({
    status: "healthy",
    app: "CodeForge API",
    version: "2.0.0",
    instance_id: INSTANCE_ID,
    instance_role: INSTANCE_ROLE,
    availability_zone: AZ_ZONE,
    uptime_seconds: Math.floor((Date.now() - serverStartTime) / 1000),
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (req, res) => {
  res.send("CodeForge Collaborative IDE API Running");
});

// Mount CodeForge REST Routers
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/projects", fileRoutes);
app.use("/api/projects", checkpointRoutes);
app.use("/api/projects", testCaseRoutes);
app.use("/api/execute", executionRoutes);

// Legacy backward-compatible /run endpoint
app.post("/run", async (req, res) => {
  try {
    const { code, language = "javascript" } = req.body;
    const result = await executeCode(code, language);
    res.json(result);
  } catch (error) {
    console.error("Error running code:", error);
    res.status(500).json({
      stdout: "",
      stderr: "Internal Execution Error",
      exitCode: 1,
    });
  }
});

function getAllConnectedClients(roomId) {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map((socketId) => {
    const data = userSocketMap[socketId];
    return {
      socketId,
      username: (data && data.username) || "Unknown user",
      color: (data && data.color) || "#38bdf8",
      activeFileId: (data && data.activeFileId) || null,
    };
  });
}

// Socket.IO Collaboration Events
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("join", ({ roomId, username, color }) => {
    userSocketMap[socket.id] = { username, color: color || "#38bdf8", roomId };
    socket.join(roomId);

    console.log(`${username} joined room: ${roomId}`);

    io.to(roomId).emit("joined", {
      clients: getAllConnectedClients(roomId),
      socketId: socket.id,
      username,
      color: color || "#38bdf8",
    });
  });

  socket.on("active-file-change", ({ roomId, fileId }) => {
    if (userSocketMap[socket.id]) {
      userSocketMap[socket.id].activeFileId = fileId;
    }
    io.to(roomId).emit("collaborator-file-change", {
      socketId: socket.id,
      fileId,
      username: userSocketMap[socket.id] ? userSocketMap[socket.id].username : "Anonymous",
    });
  });

  socket.on("chat-message", ({ roomId, message, username, color }) => {
    io.to(roomId).emit("chat-message", {
      id: Date.now().toString(),
      sender: username,
      color: color || "#38bdf8",
      text: message,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  });

  socket.on("disconnecting", () => {
    const userInfo = userSocketMap[socket.id] || { username: "Unknown user" };

    for (const roomId of socket.rooms) {
      if (roomId !== socket.id) {
        io.to(roomId).emit("joined", {
          clients: getAllConnectedClients(roomId).filter((c) => c.socketId !== socket.id),
          socketId: socket.id,
          username: userInfo.username,
        });
      }
    }

    delete userSocketMap[socket.id];
    console.log(`${userInfo.username} disconnected:`, socket.id);
  });
});

if (require.main === module) {
  startServer(PORT).catch(() => {
    process.exit(1);
  });
}

module.exports = {
  app,
  server,
  getAvailablePort,
  startServer,
  ysocketio,
};
