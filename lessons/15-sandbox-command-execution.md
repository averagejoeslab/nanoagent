# Lesson 15: Sandbox Command Execution

## The Problem

Our agent has six tools. Five of them — `read`, `write`, `edit`, `glob`, `grep` — use direct Node/Bun APIs. They can only do what their interface allows: read a file, write a file, search by pattern.

`bash` is different. It runs arbitrary shell commands. The LLM could execute:
- `curl` to download scripts from the internet
- `rm -rf /` to destroy the filesystem
- `cat ~/.ssh/id_rsa` to read private keys
- Anything the shell can do

We need to contain it.

## Why Only Bash Needs Sandboxing

File tools are **structurally constrained**. `read` can only read a file. `edit` can only replace a string. They can't access the network, spawn processes, or escalate privileges.

`bash` is **structurally unconstrained**. It can do literally anything.

This is the same design Claude Code and Codex CLI use: direct APIs for file tools, sandbox for command execution. The execution boundary is where the risk is.

## Docker Sandbox

We use a Docker container with strict security:

```typescript
class Sandbox {
  containerId: string | null = null;
  private isRunning = false;

  async start(): Promise<void> {
    if (this.isRunning) return;

    const name = `nanoagent-sandbox-${randomBytes(8).toString("hex")}`;
    const cwd = process.cwd();

    const args = [
      "docker", "run", "-d", "--rm", "--name", name,
      // Security
      "--cap-drop", "ALL",              // drop all Linux capabilities
      "--security-opt", "no-new-privileges", // no privilege escalation
      "--network", "none",              // no network access
      // Filesystem
      "--read-only",                    // read-only root filesystem
      "--tmpfs", "/tmp:rw,noexec,nosuid,size=100m",  // writable /tmp
      "-v", `${cwd}:/workspace`,        // mount project directory
      "--user", `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
      "-w", "/workspace",
      // Resources
      "--memory", "512m",
      "--memory-swap", "512m",
      "--cpus", "1.0",
      "--pids-limit", "100",
      "nanoagent-sandbox",
    ];

    const result = spawnSync(args[0], args.slice(1), {
      encoding: "utf-8",
      timeout: 10000,
    });
    if (result.status !== 0) throw new Error(`Failed to start sandbox`);

    this.containerId = result.stdout.trim();
    if (!/^[a-f0-9]{12,64}$/.test(this.containerId)) {
      throw new Error(`Invalid container ID`);
    }
    this.isRunning = true;
  }
```

## What the Security Flags Do

| Flag | What it prevents |
|------|-----------------|
| `--cap-drop ALL` | No Linux capabilities (no raw sockets, no mount, no ptrace) |
| `--no-new-privileges` | Can't escalate privileges via setuid binaries |
| `--network none` | No network — no curl, no wget, no exfiltration |
| `--read-only` | Can't modify the container's own filesystem |
| `--tmpfs /tmp` | Writable temp space (100MB, non-executable) |
| `-v ${cwd}:/workspace` | Only the project directory is accessible |
| `--memory 512m` | Can't consume all host memory |
| `--cpus 1.0` | Can't consume all host CPUs |
| `--pids-limit 100` | Can't fork-bomb |

## Executing Commands in the Sandbox

```typescript
async exec(command: string, timeout = SHELL_TIMEOUT): Promise<ExecResult> {
  if (!this.isRunning || !this.containerId) throw new Error("Sandbox not running");

  return new Promise((resolve) => {
    let stdout = "", stderr = "", timedOut = false;
    const proc = spawn("docker", ["exec", this.containerId!, "bash", "-c", command]);
    const timer = setTimeout(() => { timedOut = true; proc.kill("SIGKILL"); }, timeout);

    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code ?? -1, timedOut });
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve({ stdout: stdout.trim(), stderr: err.message, exitCode: -1, timedOut });
    });
  });
}
```

## Lifecycle

**Lazy initialization:** The container isn't created until the first `bash` call. If the LLM never calls `bash`, no container is ever started.

**Singleton:** One container per session, reused across all `bash` calls. State persists — a file created in one command is visible in the next.

**Retry on failure:** If the container dies, the `bash` tool detects exitCode -1, stops the old container, creates a new one, and retries.

**Synchronous cleanup:** On process exit, `docker stop` runs synchronously to ensure the container is removed:

```typescript
process.on("exit", () => {
  if (globalSandbox?.containerId) {
    try {
      execSync(`docker stop ${globalSandbox.containerId}`, { stdio: "ignore", timeout: 5000 });
    } catch {}
  }
});
process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
```

## Container ID Validation

Docker returns a hex string as the container ID. Validate it before using it in shell commands:

```typescript
if (!/^[a-f0-9]{12,64}$/.test(this.containerId)) {
  throw new Error(`Invalid container ID`);
}
```

## spawnSync for Startup

Use `spawnSync` (not `execSync`) to start the container. `execSync` joins args into a shell string, which breaks if the working directory path has spaces. `spawnSync` passes args as an array, bypassing the shell:

```typescript
const result = spawnSync(args[0], args.slice(1), { encoding: "utf-8", timeout: 10000 });
```

## The Updated Bash Tool

```typescript
bash: {
  desc: "Run shell command (sandboxed)",
  params: ["cmd"],
  fn: async (args) => {
    let sandbox = await getSandbox();

    if (!sandbox) {
      // Sandbox disabled — run directly
      try {
        return execSync(args.cmd, { encoding: "utf-8", timeout: SHELL_TIMEOUT }).trim() || "(empty)";
      } catch (err: any) {
        return (err.stdout || err.stderr || String(err)).trim();
      }
    }

    let result = await sandbox.exec(args.cmd);

    // Retry if container died
    if (result.exitCode === -1 && !result.timedOut) {
      await globalSandbox?.stop();
      globalSandbox = null;
      sandbox = (await getSandbox())!;
      result = await sandbox.exec(args.cmd);
    }

    if (result.timedOut) return `error: command timed out after ${SHELL_TIMEOUT}ms`;
    if (result.exitCode !== 0) return result.stderr || result.stdout || `error: exit code ${result.exitCode}`;
    return result.stdout || "(empty)";
  },
},
```

Same passthrough pattern as every other tool. Returns a string — stdout, stderr, or error message. The LLM reads it and continues.

## What We've Built

A 650-line coding agent with:
- 6 tools (read, write, edit, glob, grep, bash)
- ReAct loop with parallel tool execution
- Token-accurate context window management
- Episodic memory with semantic recall
- Working memory assembly with mid-turn eviction
- Docker-sandboxed command execution (no network, no capabilities, resource limits)

The same architecture — with different tools — builds any agent.

---

**Key Takeaways:**
- Only `bash` needs sandboxing. File tools use direct APIs with constrained interfaces.
- Docker container with: no network, no capabilities, read-only filesystem, resource limits
- Lazy init (first bash call), singleton (one per session), synchronous cleanup (on exit)
- `spawnSync` for startup (handles paths with spaces)
- Container ID validated against hex pattern before use in commands
- Retry-on-failure instead of health checks
