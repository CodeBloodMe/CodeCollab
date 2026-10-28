// ==============================================================================
// CodeForge AWS Application Load Balancer (ALB) Simulator
// VIT BCSE355L - Cloud Architecture Design QP 1
//
// Simulates an AWS ALB distributing incoming HTTP and WebSocket traffic
// in round-robin fashion between Server 1 (us-east-1a) and Server 2 (us-east-1b).
// ==============================================================================

const http = require("http");
const net = require("net");

const PORT = Number(process.env.ALB_PORT) || 5000;

const TARGETS = [
  {
    name: "Server 1",
    host: "127.0.0.1",
    port: 5001,
    instanceId: "ec2-server1-us-east-1a",
    zone: "us-east-1a",
  },
  {
    name: "Server 2",
    host: "127.0.0.1",
    port: 5002,
    instanceId: "ec2-server2-us-east-1b",
    zone: "us-east-1b",
  },
];

let counter = 0;

function getNextTarget() {
  const target = TARGETS[counter % TARGETS.length];
  counter++;
  return target;
}

const server = http.createServer((req, res) => {
  const target = getNextTarget();

  const options = {
    hostname: target.host,
    port: target.port,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      "x-forwarded-for": req.socket.remoteAddress,
      "x-forwarded-proto": "http",
      "x-forwarded-port": String(PORT),
      "x-alb-routed-to": target.instanceId,
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", (err) => {
    console.error(`[ALB Proxy Error] Failed routing to ${target.name} (${target.port}):`, err.message);
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "502 Bad Gateway",
          message: `ALB could not reach backend target ${target.name} on port ${target.port}. Is the instance running?`,
          target: target.instanceId,
          availabilityZone: target.zone,
        })
      );
    }
  });

  req.pipe(proxyReq, { end: true });
});

// WebSocket Upgrade Proxying (for Socket.IO / Yjs)
server.on("upgrade", (req, clientSocket, head) => {
  const target = getNextTarget();

  const targetSocket = net.connect(target.port, target.host, () => {
    targetSocket.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`);
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      targetSocket.write(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`);
    }
    targetSocket.write("\r\n");

    if (head.length > 0) {
      targetSocket.write(head);
    }

    clientSocket.pipe(targetSocket);
    targetSocket.pipe(clientSocket);
  });

  targetSocket.on("error", (err) => {
    console.error(`[ALB WebSocket Proxy Error] Failed forwarding to ${target.name}:`, err.message);
    clientSocket.destroy();
  });

  clientSocket.on("error", () => {
    targetSocket.destroy();
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("====================================================================");
  console.log(`[AWS ALB Simulator] Listening on http://0.0.0.0:${PORT}`);
  console.log("Registered Round-Robin Target Group:");
  TARGETS.forEach((t) => {
    console.log(`  - ${t.name}: http://${t.host}:${t.port} [AZ: ${t.zone}, ID: ${t.instanceId}]`);
  });
  console.log("WebSocket & Sticky Upgrades: ENABLED");
  console.log("====================================================================");
});

