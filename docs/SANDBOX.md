# Sandbox

nanoagent sandboxes the `bash` tool inside a Docker container. File tools (`read`, `write`, `edit`, `glob`, `grep`) use direct Node/Bun APIs and are not sandboxed — they can only do what their interface allows.

`bash` runs arbitrary shell commands. It's the only tool that can access the network, spawn processes, or do anything the shell can do. That's why it's the only tool that needs containment.

## What's Sandboxed

| Tool | Runs in | Why |
|------|---------|-----|
| `read`, `write`, `edit`, `glob`, `grep` | Host (direct APIs) | Structurally constrained — can only read/write/search files |
| `bash` | Docker container | Structurally unconstrained — can do anything |

## Security Flags

```
--cap-drop ALL                    No Linux capabilities
--security-opt no-new-privileges  No privilege escalation
--network none                    No network access
--read-only                       Read-only container filesystem
--tmpfs /tmp:rw,noexec,nosuid,size=100m   Writable temp (100MB, non-executable)
-v ${cwd}:/workspace              Project directory mounted read-write
--user ${uid}:${gid}              Runs as host user (not root)
--memory 512m                     Memory limit
--memory-swap 512m                No swap
--cpus 1.0                        CPU limit
--pids-limit 100                  Process limit
```

## What This Prevents

- **Network exfiltration** — `curl`, `wget`, DNS lookups all fail
- **Credential theft** — no access to `~/.ssh`, `~/.aws`, or anything outside the project
- **Resource exhaustion** — can't consume all host memory, CPU, or PIDs
- **Privilege escalation** — no capabilities, no setuid, non-root user
- **Fork bombs** — PID limit of 100
- **Filesystem damage** — container root is read-only, only `/tmp` and `/workspace` are writable

## What This Does NOT Prevent

- **Modifying project files** — the workspace is mounted read-write (the agent needs to edit code)
- **Reading project files** — the agent needs to read code to work on it
- **Prompt injection** — the LLM can still be manipulated through crafted file contents
- **Data in context** — sensitive data in the conversation is visible to the LLM

## Container Lifecycle

**Lazy initialization.** No container is created until the first `bash` call. If the LLM only uses file tools, no container is ever started.

**Singleton.** One container per session, reused across all `bash` calls. Files created by one command are visible to the next.

**Auto-build.** The sandbox image is built automatically from `Dockerfile.sandbox` on first use if it doesn't exist.

**Retry on failure.** If the container dies, the `bash` tool creates a new one and retries the command.

**Synchronous cleanup.** On process exit (including SIGINT/SIGTERM), `docker stop` runs synchronously to ensure the container is removed.

## Container Image

`Dockerfile.sandbox`:

```dockerfile
FROM node:20-slim

RUN apt-get update && apt-get install -y \
    bash curl git python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
CMD ["sleep", "infinity"]
```

The container runs `sleep infinity` to stay alive for the session. Commands are executed via `docker exec`.

## Building

The image builds automatically on first `bash` call. To pre-build:

```bash
docker build -f Dockerfile.sandbox -t nanoagent-sandbox .
```

## Disabling

For trusted environments:

```bash
DISABLE_SANDBOX=true bun nanoagent.ts
```

When disabled, `bash` runs directly on the host via `execSync`. File tools are unaffected — they always use direct APIs.

## Implementation Details

- `spawnSync` (not `execSync`) starts the container — handles paths with spaces
- Container ID validated against `/^[a-f0-9]{12,64}$/` before use in shell commands
- `--rm` flag ensures Docker auto-removes the container if the process crashes
- Timeout of 30 seconds per command, enforced via `setTimeout` + `SIGKILL`
