# Nanoagent Sandbox Implementation

## Overview

Nanoagent now supports **production-grade sandboxing** using Docker containers. This provides industry-standard security isolation for AI agent execution.

## What's Sandboxed

All dangerous operations run in isolated Docker containers:

- ✅ **bash commands** - Execute in container with no host access
- ✅ **file operations** - read/write/edit in sandbox workspace
- ✅ **grep/glob** - Search operations isolated
- ✅ **Resource limits** - Memory, CPU, process limits enforced
- ✅ **Network isolation** - No network access (--network none)
- ✅ **Filesystem isolation** - Can't access ~/.ssh, ~/.aws, system files

## Security Model

### 5 Layers of Protection

**1. Filesystem Isolation**
- Root filesystem: read-only
- Writable space: 500MB tmpfs (in-memory, ephemeral)
- Host files: mounted read-only at /mnt/host
- No access to: ~/.ssh, ~/.aws, .env, system directories

**2. Network Isolation**
- `--network none` - Zero network interfaces
- Can't exfiltrate data
- Can't download malware
- Can't make unauthorized API calls

**3. Resource Limits**
- Memory: 512MB (no swap)
- CPU: 1.0 cores
- PIDs: 100 processes max
- Timeout: 30 seconds per command

**4. Capability Dropping**
- `--cap-drop ALL` - No Linux capabilities
- `--user 1000:1000` - Non-root user
- `--security-opt no-new-privileges` - No privilege escalation

**5. Seccomp Profile**
- Default Docker seccomp applied
- Blocks ~44 dangerous syscalls
- Prevents kernel exploits

## Architecture

```
User
  ↓
Nanoagent (host)
  ↓
Sandbox Runtime (manages Docker lifecycle)
  ↓
Docker Container (isolated execution)
  ↓
Tool Execution (bash/read/write/etc)
```

### Persistent Session

The sandbox container persists across multiple tool calls:
- Faster execution (no container startup overhead)
- State preserved between operations
- Files written in sandbox stay available
- Automatically cleaned up on exit

## Usage

### Basic Usage (Sandbox Enabled by Default)

```bash
# One-off mode
bun nanoagent-sandboxed.ts "list all TypeScript files"

# Interactive mode
bun nanoagent-sandboxed.ts
> create a hello world script and run it
```

### Disable Sandbox (Not Recommended)

```bash
SANDBOX=false bun nanoagent-sandboxed.ts "your prompt"
```

## Files

### Core Implementation

**`Dockerfile.sandbox`**
- Defines the sandbox container image
- Based on node:20-slim
- Includes bash, curl, git, python3
- Runs as non-root user (UID 1000)

**`sandbox-runtime.ts`**
- Manages sandbox lifecycle (create/start/stop)
- Executes commands in container
- Handles file operations
- Provides health checks
- Automatic cleanup on exit

**`nanoagent-sandboxed.ts`**
- Modified nanoagent with sandbox integration
- Tools route through sandbox when enabled
- Fallback to host execution if sandbox disabled
- Shows sandbox status in prompt (🐳)

## API Reference

### Sandbox Class

```typescript
import { Sandbox } from "./sandbox-runtime";

const sandbox = new Sandbox({
  memory: "512m",    // Memory limit
  cpus: "1.0",       // CPU limit
  pidsLimit: 100,    // Process limit
  timeout: 30000,    // Command timeout (ms)
  network: false,    // Enable network
});

await sandbox.start();

// Execute command
const result = await sandbox.exec("echo hello");
// result: { stdout, stderr, exitCode, timedOut }

// File operations
await sandbox.writeFile("/workspace/test.txt", "content");
const content = await sandbox.readFile("/workspace/test.txt");

// Cleanup
await sandbox.stop();
```

### Global Singleton

```typescript
import { getSandbox } from "./sandbox-runtime";

// Get or create global sandbox instance
const sandbox = await getSandbox();
// Automatically starts on first call
// Reused across all operations
// Cleaned up on process exit
```

## Building the Sandbox Image

The sandbox image is built automatically on first use, but you can pre-build it:

```bash
docker build -f Dockerfile.sandbox -t nanoagent-sandbox .
```

## Security Best Practices

### What the Sandbox Protects Against

✅ **Malicious bash commands** - Can't access system files, credentials
✅ **Prompt injection attacks** - Limited damage scope
✅ **Resource exhaustion** - Memory/CPU limits enforced
✅ **Network exfiltration** - No network access
✅ **File system tampering** - Read-only host filesystem
✅ **ReDoS attacks** - Grep timeouts, process limits

### What the Sandbox Does NOT Protect Against

❌ **Context injection** - AI can still be manipulated via prompts
❌ **Data in prompts** - Sensitive data in user input still visible
❌ **API key leakage** - AI responses could echo API keys if in context

### Recommendations

1. **Never put secrets in prompts** - Use environment variables
2. **Review AI-generated commands** - Before approving in production
3. **Monitor sandbox usage** - Log all tool executions
4. **Keep sandbox updated** - Rebuild image regularly
5. **Consider network proxy** - For controlled external access

## Troubleshooting

### Sandbox Won't Start

```bash
# Check Docker is running
docker ps

# Check for port conflicts
docker ps -a | grep nanoagent

# Clean up old containers
docker rm -f $(docker ps -a -q --filter "name=nanoagent-sandbox")

# Rebuild image
docker build -f Dockerfile.sandbox -t nanoagent-sandbox .
```

### Slow Performance

The first command is slower (container startup ~1-2 seconds).
Subsequent commands are fast (container reused).

To improve cold start:
1. Pre-build image: `docker build -f Dockerfile.sandbox -t nanoagent-sandbox .`
2. Keep sandbox running: Container persists across operations

### Permission Errors

The sandbox runs as UID 1000. If you get permission errors:

```bash
# Check your user ID
id -u  # Should be 1000

# If different, modify Dockerfile.sandbox:
# USER <your-uid>:<your-gid>
```

## Comparison with Industry Standards

| Feature | Nanoagent | Claude Code | LangChain | E2B |
|---------|-----------|-------------|-----------|-----|
| Filesystem Isolation | ✅ | ✅ | ✅ | ✅ |
| Network Isolation | ✅ | ✅ | ✅ | ✅ |
| Resource Limits | ✅ | ✅ | ✅ | ✅ |
| Capability Dropping | ✅ | ✅ | ✅ | ✅ |
| Seccomp Profile | ✅ | ✅ | ✅ | ✅ |
| Persistent Sessions | ✅ | ✅ | ✅ | ✅ |
| Network Proxy | ❌ | ✅ | Optional | ✅ |
| gVisor/Firecracker | ❌ | Optional | Optional | ✅ |

**Nanoagent implements the same core security model as production AI agent platforms.**

## Future Enhancements

Potential improvements (not currently implemented):

- **Network proxy** - Controlled external access with domain allowlists
- **gVisor runtime** - Enhanced kernel-level isolation
- **Firecracker microVMs** - Hardware-level isolation
- **Multi-sandbox support** - Different isolation levels per task
- **Kubernetes deployment** - Distributed sandbox orchestration
- **Audit logging** - Complete tool execution logging
- **Snapshot/restore** - Save sandbox state

## References

- **Anthropic Claude Code Sandboxing**: https://www.anthropic.com/engineering/claude-code-sandboxing
- **Docker Security Best Practices**: https://docs.docker.com/engine/security/
- **LangChain Deep Agents Sandboxes**: https://docs.langchain.com/oss/python/deepagents/sandboxes
- **OpenSandbox (Alibaba)**: https://github.com/alibaba/OpenSandbox

## License

Same as nanoagent (MIT)
