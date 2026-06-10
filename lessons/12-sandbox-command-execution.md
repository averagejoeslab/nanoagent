# Lesson 12: Sandbox Command Execution

Five of our tools — `read`, `write`, `edit`, `glob`, `grep` — use direct Node/Bun APIs. Each can only do what its interface allows: read a file, write a file, search by pattern. But the interface says nothing about *where*. `read` will happily read `~/.ssh/id_rsa`. `write` will happily write to `~/.bashrc` — and whatever it writes there runs the next time you open a terminal. An interface constraint without a path constraint isn't much of a constraint at all.

`bash` is worse. It runs arbitrary shell commands. The LLM could execute:
- `curl` to download and run malicious scripts
- `rm -rf /` to destroy the filesystem
- `cat ~/.ssh/id_rsa` to read your private keys
- Anything the shell can do

So we need two boundaries: confine the file tools to the project directory, and contain `bash` in a sandbox.

## Confining the File Tools

The file tools get a path guard. Every path is resolved to its real location and rejected if it lands outside the working directory:

```typescript
import { realpath } from "node:fs/promises";
import { resolve, dirname, basename, sep } from "node:path";

let workspaceRoot: string | null = null;

async function safePath(p: string): Promise<string> {
  workspaceRoot ??= await realpath(process.cwd());
  const target = resolve(workspaceRoot, p);
  let real: string;
  try {
    real = await realpath(target);
  } catch {
    real = resolve(await realpath(dirname(target)), basename(target));
  }
  if (real !== workspaceRoot && !real.startsWith(workspaceRoot + sep)) {
    throw new Error(`path escapes working directory: ${p}`);
  }
  return real;
}
```

Three things are happening here:

1. **`resolve` normalizes** — `../../../etc/passwd` becomes an absolute path that fails the prefix check.
2. **`realpath` follows symlinks** — a link *inside* the project pointing *outside* it resolves to its real target, which fails the check. Without this, the path check is decoration.
3. **The catch handles files that don't exist yet** — `write` creates new files, and you can't `realpath` a file that isn't there. So we resolve the parent directory instead and check that.

Each tool runs its path through the guard — for `read` it's a one-word change:

```typescript
const lines = (await readFile(await safePath(args.path), "utf-8")).split("\n");
```

Same for `write` and `edit`. `glob` and `grep` validate their directory param, `glob` rejects patterns containing `..`, and `grep` checks each file before reading it — so a symlink sitting inside the project can't leak files from outside it.

When the guard throws, `executeTool`'s catch turns it into a string — `Error: path escapes working directory: ...` — and the LLM reads it and self-corrects, same as any other tool error.

## Docker Sandbox

A Docker container with strict security flags:

```typescript
import { spawnSync } from "node:child_process";

class Sandbox {
  containerId: string | null = null;
  private isRunning = false;

  async start(): Promise<void> {
    if (this.isRunning) return;

    const name = `nanoagent-sandbox-${randomBytes(8).toString("hex")}`;
    const cwd = process.cwd();

    // Build sandbox image if needed
    try {
      execSync("docker image inspect nanoagent-sandbox", { stdio: "ignore" });
    } catch {
      execSync("docker build -f Dockerfile.sandbox -t nanoagent-sandbox .", { cwd, stdio: "inherit" });
    }

    const args = [
      "docker", "run", "-d", "--rm", "--name", name,
      "--cap-drop", "ALL",                    // no Linux capabilities
      "--security-opt", "no-new-privileges",  // no privilege escalation
      "--network", "none",                    // no network access
      "--read-only",                          // read-only filesystem
      "--tmpfs", "/tmp:rw,noexec,nosuid,size=100m",
      "-v", `${cwd}:/workspace`,              // mount project directory
      "--user", `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
      "-w", "/workspace",
      "--memory", "512m",
      "--memory-swap", "512m",
      "--cpus", "1.0",
      "--pids-limit", "100",
      "nanoagent-sandbox",
    ];

    const result = spawnSync(args[0], args.slice(1), { encoding: "utf-8", timeout: 10000 });
    if (result.status !== 0) throw new Error(`Failed to start sandbox`);

    this.containerId = result.stdout.trim();
    if (!/^[a-f0-9]{12,64}$/.test(this.containerId)) throw new Error(`Invalid container ID`);
    this.isRunning = true;
  }
```

## What the Flags Do

| Flag | What it prevents |
|------|-----------------|
| `--cap-drop ALL` | No raw sockets, no mount, no ptrace |
| `--no-new-privileges` | No setuid escalation |
| `--network none` | No network — no curl, no exfiltration |
| `--read-only` | Can't modify the container filesystem |
| `--tmpfs /tmp` | Writable temp (100MB, non-executable) |
| `-v ${cwd}:/workspace` | Only the project directory is accessible |
| `--memory 512m` | Can't exhaust host memory |
| `--pids-limit 100` | Can't fork-bomb |

## Running Commands Inside

```typescript
  async exec(command: string, timeout = 30000): Promise<ExecResult> {
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

**Lazy initialization.** The container isn't created until the first `bash` call. If the LLM never calls `bash`, no container is ever started.

**Singleton.** One container per session. State persists — files created by one command are visible to the next.

**Retry on failure.** If the container dies, the `bash` tool detects it, creates a new container, and retries.

**Synchronous cleanup.** On process exit, `docker stop` runs synchronously so the container is always removed:

```typescript
process.on("exit", () => {
  if (globalSandbox?.containerId) {
    try { execSync(`docker stop ${globalSandbox.containerId}`, { stdio: "ignore", timeout: 5000 }); } catch {}
  }
});
process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
```

## Why spawnSync, Not execSync

`execSync` joins arguments into a shell string — if the working directory has spaces, it breaks. `spawnSync` passes arguments as an array, bypassing the shell:

```typescript
const result = spawnSync(args[0], args.slice(1), { encoding: "utf-8", timeout: 10000 });
```

## Why Only Bash Gets a Container

Notice the two boundaries are the *same boundary*. The file tools are confined to the working directory by `safePath`; the container mounts only the working directory at `/workspace`. Whichever tool the LLM picks, it can touch the project and nothing else.

So why does `bash` need a whole container when the file tools got by with ten lines? Because file tools have narrow interfaces — `read` can only read, `edit` can only replace — and a path guard closes the one hole the interface leaves open. `bash` has no interface to guard: it can open sockets, spawn processes, exhaust memory, escalate privileges. There's no string check for that. The only way to constrain arbitrary command execution is to run it somewhere with nothing to steal and no way out. That's what the container is.

This is the same design Claude Code and Codex CLI use: structured tools with tight interfaces run directly, arbitrary execution gets isolated.

## The Updated Bash Tool

```typescript
bash: {
  desc: "Run shell command (sandboxed)",
  params: ["cmd"],
  fn: async (args) => {
    let sandbox = await getSandbox();

    if (!sandbox) {
      try {
        return execSync(args.cmd, { encoding: "utf-8", timeout: 30000 }).trim() || "(empty)";
      } catch (err: any) {
        return (err.stdout || err.stderr || String(err)).trim();
      }
    }

    let result = await sandbox.exec(args.cmd);

    if (result.exitCode === -1 && !result.timedOut) {
      await globalSandbox?.stop();
      globalSandbox = null;
      sandbox = (await getSandbox())!;
      result = await sandbox.exec(args.cmd);
    }

    if (result.timedOut) return `error: command timed out after ${30000}ms`;
    if (result.exitCode !== 0) return result.stderr || result.stdout || `error: exit code ${result.exitCode}`;
    return result.stdout || "(empty)";
  },
},
```

Same passthrough pattern as every other tool. Returns a string.

## What We've Built

A coding agent in ~650 lines of TypeScript:

- **6 tools** — read, write, edit, glob, grep, bash
- **ReAct loop** with parallel tool execution
- **Episodic memory** — whole turns saved with embeddings
- **Semantic recall** — vector search + LLM reranking
- **Working memory** — token-accurate budgeting with mid-turn eviction
- **Path confinement** — file tools can't escape the working directory
- **Docker sandbox** — bash runs with no network, no capabilities, resource limits

The architecture is clean. The context window is managed. The memory is persistent and searchable. File access is confined to the project. Command execution is contained.

You built an agent.
