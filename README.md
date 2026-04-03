# nanoagent

A minimal agentic coding assistant with autonomous tool use and persistent memory. Built with TypeScript and Bun, nanoagent provides both interactive REPL and one-off command modes where Claude can read, edit, search files, and execute shell commands.

## Features

- 🤖 **Agentic Loop**: Claude continuously executes tools until tasks complete
- 📁 **File Operations**: Read, write, and edit files with line numbers
- 🔍 **Code Search**: Grep patterns and glob file matching
- 💻 **Shell Integration**: Execute bash commands directly
- 🐳 **Docker Sandboxing**: Production-grade isolation for bash commands (filesystem, network, resource limits)
- 🧠 **Episodic Memory**: Persistent conversation history across sessions with token-based budgeting
- 🎨 **Rich Terminal UI**: Colored output and clear tool execution feedback
- 🔄 **Two Modes**: Interactive REPL for development, one-off mode for automation/CI/CD
- ⚡ **Bun Runtime**: Fast TypeScript execution and standalone binary compilation

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.3.4 or later
- [Docker](https://www.docker.com/) (for sandboxed execution)
- Anthropic API key

### Installation

1. Clone the repository:

```bash
git clone https://github.com/averagejoeslab/nanoagent.git
cd nanoagent
```

2. Install dependencies:

```bash
bun install
```

3. Set up your API key:

```bash
echo "ANTHROPIC_API_KEY=your_key_here" > .env
```

4. Build the sandbox image:

```bash
docker build -f Dockerfile.sandbox -t nanoagent-sandbox .
```

The sandbox provides secure isolation for bash commands with filesystem restrictions, no network access, and resource limits.

### Running

#### Interactive mode (REPL)

```bash
bun nanoagent.ts
```

Start an interactive session with conversation history and commands. Bash commands run in a sandboxed Docker container by default (look for the 🐳 emoji).

#### One-off mode (automation)

```bash
bun nanoagent.ts "Create a hello.ts file with a hello function"
```

Run a single command and exit. Perfect for scripts and CI/CD.

#### Compile to standalone binary

```bash
bun build nanoagent.ts --compile --outfile nanoagent
./nanoagent
```

## Usage

### Interactive Mode

Once running, you'll see the nanoagent prompt (`❯`). Simply type your coding request, and Claude will use tools autonomously to complete the task.

**REPL Commands:**
- `/q` or `exit` - Quit the application
- `/c` - Clear conversation history
- `Enter` (empty) - Skip to next prompt

**Example Session:**

```
nanoagent 🐳
claude-sonnet-4-5 | /tmp/demo | sandboxed
Loaded 15/50 turns (12,345 tokens)

────────────────────────────────────────────────────────────────────────────────
❯ Create a hello world function in hello.ts
────────────────────────────────────────────────────────────────────────────────

⏺ write(hello.ts)
  ⎿  ok

⏺ I've created a hello.ts file with a simple hello world function

────────────────────────────────────────────────────────────────────────────────
❯ /q
```

### One-Off Mode

Perfect for automation, CI/CD pipelines, and scripts:

```bash
# In a script
bun nanoagent.ts "Update version in package.json to 2.0.0"

# In CI/CD
bun nanoagent.ts "Generate CHANGELOG.md from git log since last tag"

# Chained commands
bun nanoagent.ts "Run tests and create summary in test-results.md"
```

## Tool Capabilities

nanoagent provides Claude with six powerful tools:

| Tool | Description | Parameters | Sandboxed |
|------|-------------|------------|-----------|
| `read` | Read file with line numbers | `path`, `offset?`, `limit?` | No |
| `write` | Write content to file | `path`, `content` | No |
| `edit` | Replace text in file | `path`, `old`, `new`, `all?` | No |
| `glob` | Find files by pattern | `pat`, `path?` | No |
| `grep` | Search files with regex | `pat`, `path?` | No |
| `bash` | Execute shell commands (sandboxed) | `cmd` | Yes 🐳 |

All tools execute with the current working directory as context. The `bash` tool runs in an isolated Docker container by default for security.

## Security & Sandboxing

nanoagent uses **production-grade Docker sandboxing** for bash command execution, providing industry-standard security isolation:

### Security Features

- **Filesystem Isolation**: Read-only host filesystem, limited writable tmpfs
- **Network Isolation**: No network access (`--network none`)
- **Resource Limits**: 512MB RAM, 1 CPU core, 100 process limit
- **Capability Dropping**: All Linux capabilities removed
- **Seccomp Profile**: Syscall filtering enabled

This prevents:
- Access to sensitive files (~/.ssh, ~/.aws, .env)
- Network exfiltration
- Resource exhaustion
- Privilege escalation

### Disabling Sandbox

For development or trusted environments:

```bash
DISABLE_SANDBOX=true bun nanoagent.ts
```

**⚠️ Warning**: Running without sandbox allows direct host access. Only disable for trusted prompts.

See [SANDBOX.md](SANDBOX.md) for complete documentation and security model details.

## Architecture

### Single-File Design

The entire application is contained in `nanoagent.ts` (~660 lines) with clear sections:

- Imports (Node.js modules, tiktoken for token counting)
- Config (API URL, model, memory budget, ANSI colors, sandbox settings)
- Types (Message, Tool, ExecResult)
- Sandbox Runtime (Docker container lifecycle management)
- Tools (read, write, edit, glob, grep, bash)
- Tool execution (executeTool, buildToolSchema)
- Memory (saveToTrace, loadTrace with token-based budgeting)
- LLM interface (callLLM)
- Agentic loop (agenticLoop with ReAct pattern)
- REPL/UI (main function with interactive and one-off modes)

### Agentic Loop

The ReAct pattern (Reason → Act → Observe → Repeat):

1. **REASON**: User provides request, Claude decides what to do
2. **ACT**: Claude responds with text and/or tool calls (executed in parallel when multiple)
3. **OBSERVE**: Tool results are added to context
4. **REPEAT**: Loop continues until Claude responds without tools
5. Task complete ✅

Claude orchestrates the sequence. If it returns multiple tool calls in one response, they execute in parallel. If it needs sequential execution, it returns one tool at a time across multiple loop iterations.

## Configuration

### Model

Default: `claude-sonnet-4-5`

To change the model, edit the `MODEL` constant in `nanoagent.ts`:

```typescript
const MODEL = "claude-sonnet-4-5";
```

### API Endpoint

The application uses Anthropic's Messages API:

```
https://api.anthropic.com/v1/messages
```

### Environment Variables

- `ANTHROPIC_API_KEY` (required) - Your Anthropic API key
- `SANDBOX` (optional) - Set to `false` to disable sandboxing

## Development

### Type Checking

```bash
bun --print "import './nanoagent.ts'"
```

### Building for Different Platforms

```bash
# macOS ARM64 (default on Apple Silicon)
bun build nanoagent.ts --compile --outfile nanoagent

# x86_64 (Intel)
bun build nanoagent.ts --compile --target=x86_64 --outfile nanoagent-x64

# Linux ARM64
bun build nanoagent.ts --compile --target=linux-arm64 --outfile nanoagent-linux-arm64
```

### Project Structure

```
nanoagent/
├── nanoagent.ts         # Main application (single file, ~660 lines)
├── Dockerfile.sandbox   # Docker sandbox image definition
├── package.json         # Dependencies (js-tiktoken)
├── .env                # API key (gitignored)
├── .nanoagent/         # Memory trace (gitignored)
│   └── trace.jsonl     # Episodic memory
├── lessons/            # Tutorial series (13 lessons)
├── SANDBOX.md          # Sandbox documentation
└── README.md           # This file
```

## Technical Details

### Dependencies

- `js-tiktoken` - Token counting for memory budgeting

### Runtime

Built with Bun, which provides:

- Fast TypeScript execution
- Built-in bundler and compiler
- Native APIs (Glob, file I/O)
- Standalone binary compilation (~60MB, runtime included)

### API Integration

- **Model**: claude-sonnet-4-5
- **Context window**: 200,000 tokens
- **Max tokens**: 8,192
- **Memory budget**: ~181,000 tokens (with safety margin)
- **System prompt**: "Concise coding assistant. cwd: {working_directory}"
- **Tool schema**: Auto-generated from TOOLS registry
- **Tool execution**: Parallel when Claude returns multiple tool_use blocks
- **Message format**: Anthropic Messages API with tool use

### Memory System

- **Episodic trace**: Saves all conversations to `.nanoagent/trace.jsonl`
- **Token-based loading**: Loads recent turns that fit within memory budget
- **Sliding window**: Older conversations excluded when budget exceeded
- **Persistence**: Memory survives across sessions and restarts

## Error Handling

- Tool errors return as strings (prefixed with `"error: "`)
- API errors display with status and message
- Shell commands timeout after 30 seconds
- File operations handle permissions gracefully

## Limitations

- Tool results limited (grep: 50 matches, text previews: 60 chars)
- Shell commands limited to 30-second execution
- No streaming output (results display after completion)
- Memory sliding window (very old conversations excluded when budget full)
- No semantic search or importance filtering (yet)

## Learning

The `lessons/` directory contains a comprehensive 13-lesson tutorial series that builds nanoagent from zero:

1. What is an AI Agent
2. Your First LLM Call
3. Adding One Tool
4. Executing the Tool
5. The Loop
6. Adding More Tools
7. Making it Interactive (REPL + one-off mode)
8. Parallel Execution
9. Clean Architecture
10. Final Touches
11. Episodic Memory
12. Token Budgeting and Memory Management
13. Production Sandboxing

Each lesson is a complete guide assuming no prior knowledge.

## Contributing

This is a minimal implementation designed for simplicity and clarity. The entire codebase is ~660 lines in a single file, making it easy to understand, modify, and extend.

To add a new tool:

1. Implement the function in the `TOOLS` registry
2. Define the description and parameters
3. Claude will automatically have access

## License

MIT

---

**Model**: claude-sonnet-4-5 | **Runtime**: Bun | **Language**: TypeScript
