# CodeForge — System Architecture & Design Specification

**Document Version:** 2.0.0  
**Target Platform:** CodeForge Real-Time Collaborative Development Environment  

---

## 1. Architectural Overview

CodeForge is engineered as a multi-tier, distributed, and resilient collaborative IDE platform. It decouples high-frequency real-time document synchronization (via CRDTs over WebSockets) from persistent transactional business logic (RESTful API over PostgreSQL) and untrusted program execution (isolated container sandbox worker).

```mermaid
flowchart TD
    subgraph Client ["Client Layer (Web IDE)"]
        UI["React 19 SPA"]
        CM["CodeMirror 6 Editor"]
        YCollab["y-codemirror.next Extension"]
        Awareness["Yjs Awareness (Cursors)"]
        YDoc["Y.Doc CRDT Client"]
        YCollab --> CM
        Awareness --> YCollab
        YDoc --> YCollab
        UI --> CM
    end

    subgraph Gateway ["Transport & Gateway Layer"]
        WSS["WebSocket (/yjs|<projectId>:<fileId>)"]
        REST["HTTP REST (/api/*)"]
    end

    subgraph Backend ["Application Server (Node.js & Express)"]
        YSocket["YSocketIO Server"]
        AuthM["JWT & Role Authorization"]
        ProjMgr["Project & File Manager"]
        HistMgr["Checkpoint & Diff Engine"]
        ExecCtl["Execution Controller & Queue"]
    end

    subgraph Data ["Persistent Storage (PostgreSQL 16)"]
        UsersT["users & project_members"]
        ProjectsT["projects & project_files"]
        CheckpointsT["project_checkpoints & test_cases"]
        YjsUpdatesT["yjs_updates (BYTEA CRDT updates)"]
    end

    subgraph Sandbox ["Execution Engine"]
        Worker["Isolated Execution Worker"]
        DockerRunner["Docker Container (codeforge-runner)"]
        Worker --> DockerRunner
    end

    UI --> REST
    YDoc --> WSS
    WSS --> YSocket
    REST --> AuthM
    AuthM --> ProjMgr
    AuthM --> HistMgr
    AuthM --> ExecCtl
    YSocket --> YjsUpdatesT
    ProjMgr --> ProjectsT
    ProjMgr --> UsersT
    HistMgr --> CheckpointsT
    ExecCtl --> Worker
    DockerRunner --> |stdout / stderr / duration| ExecCtl
```

---

## 2. Collaborative Synchronization Subsystem (Yjs CRDT)

### 2.1. Scoping and Document Namespacing
Rather than treating an entire room as a single flat string buffer, CodeForge namespaces collaborative documents per project and file:
$$\text{Room Identifier} = \text{projectId} : \text{fileId}$$

- **Namespace Routing:** Socket connections connect to `io(/^\/yjs\|.*$/)`. The document name is derived by stripping `/yjs|`.
- **CRDT Document Lifecycle:**
  1. On first client join, `YSocketIO` invokes `setupYjsPersistence.initDocument()`.
  2. The server acquires a per-room lock (`initLocks`) to eliminate duplicate simultaneous instantiation race conditions.
  3. All historical binary updates for that room are loaded sequentially from `yjs_updates` in PostgreSQL (`ORDER BY id ASC`) and merged into the server's in-memory `Y.Doc`.
  4. The client receives the synchronized document vector and applies subsequent diffs.

### 2.2. Concurrency & Convergence
Yjs operates as an operation-based and state-based Conflict-Free Replicated Data Type. Edits made by multiple clients concurrently are deterministically resolved via internal Lamport timestamps and unique client IDs:
- **No Broadcast Flooding:** Only binary delta updates (`update_data BYTEA`) are transmitted over the wire rather than the entire document string.
- **Durable Write Queue:** Each room maintains a serialized promise write queue (`writeQueues`) ensuring asynchronous database writes to `yjs_updates` are executed without data interleaving or out-of-order writes.
- **Server Restart Resilience:** Because state is continuously persisted as CRDT deltas, if the backend server crashes or restarts, subsequent client reconnections reconstruct the converged state with 0% data loss.

---

## 3. Data Storage & Schema Design

PostgreSQL 16 serves as the single source of truth for both relational application entities and CRDT state.

### Entity Relationship Model

```mermaid
erDiagram
    users ||--o{ projects : "owns"
    users ||--o{ project_members : "participates"
    projects ||--o{ project_members : "has"
    projects ||--o{ project_files : "contains"
    projects ||--o{ project_checkpoints : "records"
    projects ||--o{ project_test_cases : "specifies"
    project_files ||--o{ yjs_updates : "persists CRDT updates"

    users {
        int id PK
        string username UK
        string email UK
        string password_hash
        string avatar_color
        timestamp created_at
    }

    projects {
        uuid id PK
        string name
        text description
        int owner_id FK
        string visibility
        timestamp created_at
        timestamp updated_at
    }

    project_files {
        uuid id PK
        uuid project_id FK
        string name
        string path
        string language
        text content
        boolean is_entry_point
        timestamp updated_at
    }

    project_checkpoints {
        int id PK
        uuid project_id FK
        int user_id FK
        string message
        jsonb files_snapshot
        timestamp created_at
    }

    yjs_updates {
        bigint id PK
        string room_id
        bytea update_data
        timestamp created_at
    }
```

---

## 4. Isolated Execution Engine

The code execution boundary is isolated behind a dedicated execution worker (`services/isolatedRunner.js`).

```mermaid
sequenceDiagram
    autonumber
    actor User as Web Client
    participant API as Express API Router
    participant Queue as Execution Queue
    participant Worker as Isolated Worker
    participant Docker as codeforge-runner (Container)

    User->>API: POST /api/execute (language, code, stdin, testCases)
    API->>API: Validate input & authenticate
    API->>Queue: Enqueue execution job (concurrency limit = 5)
    Queue->>Worker: Dispatch job
    Worker->>Docker: docker run --rm --network none --memory 128m --cpus 0.5 ...
    activate Docker
    Note over Docker: User: 1001:1001 (non-root)<br/>Tmpfs workspace: rw, 16MB<br/>Network: Disabled
    Docker-->>Worker: Stream stdout / stderr (capped at 64KB)
    deactivate Docker
    Worker->>Worker: Compute durationMs & compare test assertions
    Worker-->>API: { stdout, stderr, exitCode, durationMs, testResults }
    API-->>User: Return HTTP 200 JSON
```

### Security Boundary Guarantees:
1. **Network Denial:** `--network none` prevents all outbound network requests, SSRF, reverse shells, or botnet attacks.
2. **Process Sandboxing:** `--pids-limit 64` prevents fork bombs.
3. **Memory Ceilings:** `--memory 128m` with swap disabled prevents memory exhaustion DoS.
4. **CPU Restrictions:** `--cpus 0.5` throttles compute-heavy mining loops.
5. **Least Privilege Identity:** Containers execute under non-root UID `1001:1001` (`runner`).
6. **Ephemeral Lifetime:** `--rm` guarantees containers are destroyed on termination.

---

## 5. Version History & Checkpointing

- **Snapshot Ingestion:** Checkpoints capture a full semantic JSON snapshot of all project files (`files_snapshot JSONB`) indexed by file UUID.
- **Textual Diffing:** Textual differences are generated using the Myers diff algorithm (`diff` library). Both raw patches (`createPatch`) and structured line-by-line colored diffs (`diffLines`) are computed on demand.
- **Non-Destructive Restoration:** When a user restores Checkpoint #K, CodeForge restores file records in PostgreSQL and updates the shared Yjs document state. Crucially, it records a **new Checkpoint #N** stating `"Restored from Checkpoint #K"`, preserving a continuous, unalterable historical audit trail.

---

## 6. AWS Cloud Architecture Deployment (VIT BCSE355L QP 1)

CodeForge has been engineered specifically for the **VIT University Fall Semester 2026-2027 Case Study QP 1** (BCSE355L - Cloud Architecture Design).

```mermaid
flowchart TD
    subgraph Client ["Client Presentation Tier"]
        Browser["User Browser"]
        S3["Amazon S3 Bucket<br/>Static Website Hosting<br/>HTML5 / CSS / React 19 Bundle"]
    end

    subgraph LoadBalancing ["Traffic Routing Tier"]
        ALB["AWS Application Load Balancer (ALB)<br/>Dual-AZ Ingress (Port 80/443)<br/>Round-Robin Balancing + WS Upgrades"]
    end

    subgraph Compute ["Multi-AZ Dynamic Processing Tier"]
        subgraph AZ1 ["Availability Zone: us-east-1a"]
            Server1["EC2 Instance: Server 1<br/>t2.micro / t3.micro<br/>Port 5000<br/>Node.js + Yjs Engine"]
            Runner1["Docker Runner Sandbox<br/>codeforge-runner:latest"]
            Server1 -.-> Runner1
        end

        subgraph AZ2 ["Availability Zone: us-east-1b"]
            Server2["EC2 Instance: Server 2<br/>t2.micro / t3.micro<br/>Port 5000<br/>Node.js + Yjs Engine"]
            Runner2["Docker Runner Sandbox<br/>codeforge-runner:latest"]
            Server2 -.-> Runner2
        end
    end

    subgraph Persistence ["Shared Database Tier"]
        RDS["Amazon RDS PostgreSQL 16<br/>db.t3.micro / db.t4g.micro (Port 5432)<br/>Shared CRDT & Transactional Database"]
    end

    Browser -->|"Static Assets (GET)"| S3
    Browser -->|"API & WebSockets"| ALB
    ALB -->|"Round-Robin #1, #3, #5"| Server1
    ALB -->|"Round-Robin #2, #4, #6"| Server2
    Server1 -->|"State Sync"| RDS
    Server2 -->|"State Sync"| RDS
```

### 6.1. Architectural Tier Breakdown
1. **Presentation Tier (Amazon S3):**
   - Pure static client bundle generated by Vite (`dist/index.html`, `dist/assets/*`).
   - S3 Static Website Hosting configured with public read bucket policy (`aws/s3-bucket-policy.json`) and permissive CORS (`aws/s3-cors.json`).
   - Zero compute costs on the presentation layer.

2. **Ingress & Traffic Routing Tier (AWS ALB):**
   - Internet-facing Application Load Balancer deployed across subnets in `us-east-1a` and `us-east-1b`.
   - Distributes incoming traffic using the round-robin routing algorithm.
   - Target group performs active health checking on `/api/health` with 5s timeout and 30s probe intervals.
   - Forwards WebSocket upgrade handshakes (`Upgrade: websocket`) for real-time CRDT synchronization.

3. **Compute Tier (Dual EC2 Instances in Multi-AZ):**
   - Two EC2 instances (`Server1` in `us-east-1a` and `Server2` in `us-east-1b`).
   - Provisioned automatically via cloud-init / user data scripts (`aws/setup-server1.sh`, `aws/setup-server2.sh`).
   - Managed as resilient systemd daemon services (`codeforge.service`).
   - Both nodes inject live telemetry response headers:
     * `X-Instance-ID`: Node identifier (e.g. `ec2-server1-us-east-1a`)
     * `X-Served-By`: Node role and hostname
     * `X-Availability-Zone`: Geographical AZ (e.g. `us-east-1a` / `us-east-1b`)

4. **Persistence Tier (Amazon RDS PostgreSQL 16):**
   - Central relational database shared by both compute nodes.
   - Decoupled from node lifecycles so any server can terminate or restart without state disruption.
   - Stores users, projects, files, checkpoints, test cases, and sequential Yjs binary CRDT update logs.

5. **Live Verification & Diagnostic Toolkit:**
   - **In-App ALB Modal:** Navigation bar badge and interactive prober with 1-click round-robin verification.
   - **PowerShell Prober:** `aws/verify-alb.ps1` for Windows environments.
   - **Bash Prober:** `aws/verify-alb.sh` for Linux/macOS environments.
   - **Local Multi-AZ Simulator:** `start-aws-cluster.bat` & `docker-compose.aws-simulation.yml`.


