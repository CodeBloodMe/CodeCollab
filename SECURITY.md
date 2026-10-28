# CodeForge — Security Policy & Sandbox Architecture Specification

---

## 1. Threat Model & Security Posture

CodeForge operates as a multi-user collaborative platform where users are permitted to submit and execute arbitrary code. In such systems, untrusted code execution presents the single highest risk of remote code execution (RCE), denial of service (DoS), server compromise, and unauthorized data access.

### Identified Threat Vectors & Mitigations

| Threat | Attack Vector | CodeForge Mitigation |
| :--- | :--- | :--- |
| **Host Process Takeover** | Escaping Node.js `vm` context via prototype traversal | **Completely eliminated in-process VM execution.** Code execution is dispatched to isolated ephemeral Docker containers. |
| **Fork Bombs & Resource Starvation** | Creating millions of child processes or allocating gigabytes of RAM | Container limits: `--pids-limit 64`, `--memory 128m` (swap disabled), `--cpus 0.5`. |
| **Network & SSRF Attacks** | Port scanning internal VPC / AWS metadata endpoints (`169.254.169.254`) or joining botnets | Execution containers run with `--network none`. Sockets cannot connect to any external or internal address. |
| **Filesystem Tampering & Host Mount Exposure** | Overwriting system binaries or reading host `.env` / credentials | Containers run with read-only root filesystems, non-root user `runner` (UID 1001), and strictly isolated memory-backed `/tmp` tmpfs. No host paths are mounted. |
| **Infinite Execution Loops** | `while (true) {}` freezing server workers | Strict wall-clock timeouts (default 5000ms, max 15000ms). Processes exceeding timeout are forcefully killed via `SIGKILL` and `docker rm -f`. |
| **Output Buffer Overflow DoS** | `while (true) { console.log("A"); }` exhausting server memory | Output streams are capped at **64 KB**. Streams exceeding this threshold are truncated with a security notice. |
| **Unauthorized Project Access** | Guessing room IDs or URL endpoints to read private code | Server-side role-based authorization enforces `owner`, `editor`, and `viewer` permissions. Private projects reject unauthenticated/unauthorized users. |

---

## 2. Sandbox Container Isolation Specifications

The execution sandbox is powered by the `codeforge-runner:latest` container:

```bash
docker run \
  --name codeforge-exec-<id> \
  --rm \
  --network none \
  --memory 128m \
  --cpus 0.5 \
  --pids-limit 64 \
  --user 1001:1001 \
  codeforge-runner:latest \
  bash -c "<script>"
```

### Parameter Breakdown:
1. `--network none`: Disables the container's network stack completely. The container cannot perform DNS lookups, make HTTP requests, or open network sockets.
2. `--memory 128m`: Enforces a hard memory ceiling of 128 Megabytes. Any attempt to allocate more memory triggers the kernel Out-Of-Memory (OOM) killer, terminating the container with an exit code without affecting the host.
3. `--cpus 0.5`: Throttles CPU execution to 50% of a single core. Prevents crypto-mining or thread-locking.
4. `--pids-limit 64`: Enforces a hard limit of 64 simultaneous processes/threads. Neutralizes fork bombs immediately.
5. `--user 1001:1001`: Forces execution under the non-privileged `runner` user. Root privileges inside the container are strictly disabled.
6. `--rm`: Guarantees automatic removal of the container filesystem upon completion.

---

## 3. Authentication & Authorization Security

### 3.1. Credential Security
- User passwords are salted and hashed using `bcryptjs` with 10 rounds of cryptographic salting. Plaintext passwords are never persisted or logged.
- API endpoints authenticate requests using JSON Web Tokens (JWT) signed with HMAC-SHA256 (`HS256`).

### 3.2. Authorization Matrix

| Action | Owner | Editor | Viewer | Unauthenticated |
| :--- | :---: | :---: | :---: | :---: |
| **Read Project Files** | ✅ | ✅ | ✅ | ❌ (Unless public) |
| **Edit Project Files** | ✅ | ✅ | ❌ | ❌ |
| **Create Checkpoints** | ✅ | ✅ | ❌ | ❌ |
| **Restore Checkpoints** | ✅ | ✅ | ❌ | ❌ |
| **Execute Code** | ✅ | ✅ | ✅ | ❌ (Unless public) |
| **Invite / Remove Members**| ✅ | ❌ | ❌ | ❌ |
| **Delete Project** | ✅ | ❌ | ❌ | ❌ |

---

## 4. Operational & Code Hygiene

- **Environment Variable Protection:** All database passwords, ports, and JWT secrets are ingested exclusively from environment variables (`.env`). `.env` is explicitly declared in `.gitignore` and `.dockerignore`.
- **Structured Error Logging:** Application error handlers intercept internal database and system errors and log them server-side while returning generic, safe error descriptions to API consumers to prevent database schema enumeration.
- **Graceful Termination:** On SIGINT/SIGTERM, active database pools and server connections are cleanly drained.

