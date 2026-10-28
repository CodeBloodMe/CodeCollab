# CodeForge — Real-Time Collaborative Development Platform

[![Node.js](https://img.shields.io/badge/Node.js-v20%2B-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue.svg)](https://react.dev/)
[![Yjs CRDT](https://img.shields.io/badge/CRDT-Yjs_13.6-orange.svg)](https://yjs.dev/)
[![Docker](https://img.shields.io/badge/Sandbox-Docker_Isolated-2496ed.svg)](https://docker.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)
[![AWS QP1 Ready](https://img.shields.io/badge/AWS_Free_Tier-QP1_Certified-FF9900.svg?logo=amazon-aws)](./AWS_DEPLOYMENT.md)

**CodeForge** is an advanced, production-grade browser-based collaborative Integrated Development Environment (IDE) built and packaged for the **VIT University BCSE355L (Cloud Architecture Design) Case Study QP 1**. It combines deterministic real-time collaborative editing using Conflict-Free Replicated Data Types (CRDTs), durable multi-file project persistence, textual version history checkpoints, an isolated multi-language code execution sandbox, and a fully verified **AWS Multi-AZ Application Load Balanced architecture**.

---

## 🏛️ System Architecture

```
[ Web Browser Client ]
        │
        ├── (1) Real-Time WebSocket CRDT Sync ──> [ Socket.IO & YSocketIO Namespace ]
        │   (/yjs|<projectId>:<fileId>)           (Deterministic CRDT Merge)
        │                                                   │
        ├── (2) REST API Requests ──────────────> [ Express API Router ]
        │   (/api/auth, /api/projects, /api/execute) (JWT & Role Authorization)
        │                                                   │
        │                                                   ▼
        │                                     [ PostgreSQL 16 Persistence ]
        │                                     - users & memberships
        │                                     - projects & project_files
        │                                     - checkpoints & test_cases
        │                                     - yjs_updates (CRDT state)
        │                                                   │
        └── (3) Isolated Execution Jobs ───────> [ Dedicated Execution Worker ]
            (stdin, timeout, test cases)                    │
                                                            ▼
                                              [ Docker Container Sandbox ]
                                              (image: codeforge-runner)
                                              - non-root user (1001:1001)
                                              - network: none
                                              - memory: 128MB, cpus: 0.5
                                              - pids-limit: 64, tmpfs workspace
                                              - Languages: JS, Python, C++, Java
```

---

## ⚡ Key Capabilities

### 1. Reliable Real-Time Collaborative Editing (Yjs CRDT)
- **CRDT-Powered Synchronization:** Edits converge deterministically across multiple concurrent editors without last-write-wins collisions or full document broadcasting.
- **File-Level Scoping:** Every source file within a project operates in an isolated CRDT document namespace (`/yjs|<projectId>:<fileId>`).
- **Presence & Awareness:** Real-time collaborator cursor positions, active file tracking, and unique participant avatar colors.
- **Reconnection Recovery:** When a client disconnects or the backend restarts, document state is fully reconstructed from durable PostgreSQL binary updates.

### 2. Multi-File Project Workspaces
- **Project Hierarchy:** Create, rename, and manage projects with private or public visibility.
- **File Explorer:** Add, rename, and delete files with live syntax highlighting for JavaScript, Python, C++, Java, Markdown, and JSON.
- **Starter Templates:** Instant initialization with realistic multi-file starter templates for data structures and algorithms.
- **Tab Bar:** Smooth multi-tab file navigation preserving cursor and editor states.

### 3. Secure Multi-Language Code Execution Sandbox
- **Docker-Isolated Worker:** Replaces insecure in-process `vm` runners with short-lived, isolated Docker containers (`codeforge-runner:latest`).
- **Multi-Language Support:** First-class compilation and execution for **JavaScript** (Node.js 24), **Python 3** (Python 3.14), **C++** (G++ 15), and **Java** (OpenJDK 17).
- **Strict Security Boundaries:**
  - Non-root user identity (`UID 1001:1001`).
  - Network disabled (`--network none`).
  - Memory capped at `128MB` with swap disabled.
  - CPU allocation limited to `0.5 cores`.
  - Process limit set to `64` to prevent fork-bomb attacks.
  - Ephemeral in-memory tmpfs mounts; no host sensitive directories exposed.
  - Wall-clock timeout enforcement (1s – 15s) with automated container termination.
  - Output truncation guard (max 64KB) to mitigate memory exhaustion.

### 4. Automated Test Runner & Custom Stdin
- **Test-Case Specification:** Define expected input/output assertions for projects.
- **Evaluation Runner:** Evaluates all test cases in the isolated container, comparing actual vs expected stdout with precise execution duration metrics.
- **Interactive Stdin:** Feed custom multi-line standard input directly to user programs.

### 5. Version History, Diff Inspector, & Safe Rollback
- **Semantic Checkpoints:** Capture explicit snapshots of all project files with author attribution and commit messages.
- **Textual Diff Viewer:** Side-by-side / unified diff inspection displaying exact added and removed lines between versions.
- **Non-Destructive Restoration:** Restoring an earlier checkpoint records a new audit checkpoint, ensuring project history is never silently erased.

---

## 🚀 Quick Start (Local Setup)

### Prerequisites
- **Node.js** v20+ or v22+
- **Docker & Docker Compose** (or Docker via WSL2 on Windows)
- **PostgreSQL 16** (runnable via Docker container)

### 1. 1-Click Launch (Windows)
Double-click [`start-codeforge.bat`](./start-codeforge.bat) in the repository root. This will:
1. Ensure the PostgreSQL database container is running.
2. Launch the backend API server on `http://localhost:5000`.
3. Launch the Vite frontend web IDE on `http://localhost:5173`.

To stop services: run [`stop-codeforge.bat`](./stop-codeforge.bat).

---

### 2. AWS Multi-AZ Cluster Simulation (VIT QP 1 Demonstration)
To test and demonstrate the complete multi-AZ architecture with dual EC2 instances and Application Load Balancer locally:
```cmd
start-aws-cluster.bat
```
This automatically launches:
- **EC2 Server 1:** Running on port `5001` (`us-east-1a`).
- **EC2 Server 2:** Running on port `5002` (`us-east-1b`).
- **AWS Application Load Balancer:** Running on port `5000` with round-robin traffic routing and WebSocket upgrades.

To verify live 50/50 round-robin load distribution across both AZs:
```powershell
powershell -ExecutionPolicy Bypass -File aws\verify-alb.ps1 -AlbUrl "http://localhost:5000" -Count 10
```

To stop the cluster: run [`stop-aws-cluster.bat`](./stop-aws-cluster.bat).

---

### 3. Manual CLI Setup

#### Step A: Database
```bash
docker run -d --name codeforge-db -p 5432:5432 \
  -e POSTGRES_USER=codeforge \
  -e POSTGRES_PASSWORD=codeforge_password \
  -e POSTGRES_DB=codeforge_db \
  postgres:16-alpine
```

#### Step B: Build Runner Image
```bash
docker build -t codeforge-runner:latest ./runner
```

#### Step C: Backend
```bash
cd server
npm install
node migrate.js
node server.js
```
*Backend active on `http://localhost:5000` (Health: `http://localhost:5000/api/health`)*

#### Step D: Frontend
```bash
cd client
npm install
npm run dev
```
*Frontend active on `http://localhost:5173`*

---

## 🧪 Automated Testing

CodeForge includes a comprehensive automated test suite verifying database migrations, authentication, project file CRUD, version checkpoint diffing, isolated code execution, and Yjs CRDT multi-client convergence.

```bash
cd server
npm test
```

### Verified Test Results (18/18 Passed):
- `ok 1 - User registration and login flow`
- `ok 2 - Version history checkpoint creation, diff computation, and non-destructive restore`
- `ok 3 - PostgreSQL connection check`
- `ok 4 - Schema migration creates yjs_updates table safely and repeatably`
- `ok 5 - Inserting and retrieving a sample Yjs document update`
- `ok 6 - startServer rejects when DATABASE_URL is missing`
- `ok 7 - E2E: Concurrent multi-client CRDT editing convergence and reload`
- `ok 8 - E2E: Isolated container executes multi-file logic with test runner`
- `ok 9 - Isolated Docker Runner: JavaScript execution`
- `ok 10 - Isolated Docker Runner: Python execution with stdin input`
- `ok 11 - Isolated Docker Runner: C++ compilation and execution`
- `ok 12 - Isolated Docker Runner: Wall-clock timeout terminates infinite loop`
- `ok 13 - Isolated Docker Runner: Test cases evaluation against problem specification`
- `ok 14 - Yjs room state persists and reloads across simulated restart/reload`
- `ok 15 - Concurrent room initialization prevents duplicate documents and hooks`
- `ok 16 - Concurrent edits from multiple clients are persisted without lost updates`
- `ok 17 - getAvailablePort skips a busy port and returns the next free port`
- `ok 18 - Project and file persistence, ownership, and starter templates`

---

## 📚 Complete Documentation Links

* ☁️ [AWS Deployment Guide (`AWS_DEPLOYMENT.md`)](./AWS_DEPLOYMENT.md) — Comprehensive guide for S3 Static Website Hosting, dual EC2 instances across `us-east-1a` and `us-east-1b`, RDS PostgreSQL, and ALB round-robin configuration for VIT BCSE355L QP 1.
* 📘 [System Architecture (`ARCHITECTURE.md`)](./ARCHITECTURE.md) — Detailed design of CRDT synchronization, storage schema, execution boundaries, and AWS cloud topology.
* 🛡️ [Security Specifications (`SECURITY.md`)](./SECURITY.md) — Container sandboxing parameters, threat models, and authorization checks.
* 📋 [Implementation Report (`IMPLEMENTATION_REPORT.md`)](./IMPLEMENTATION_REPORT.md) — Detailed audit report, code modifications, verified test commands, and AWS deployment readiness.
