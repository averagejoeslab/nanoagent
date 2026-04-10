# nanoagent

A minimal agentic coding assistant in a single TypeScript file. Built with Bun, nanoagent implements the ReAct pattern with token-accurate context management, episodic memory with semantic recall, and sandboxed command execution.

## Quick Start

```bash
# Install
git clone https://github.com/averagejoeslab/nanoagent.git
cd nanoagent
bun install

# Set your API key
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env

# Run
bun nanoagent.ts
```

## Usage

### Interactive REPL

```bash
bun nanoagent.ts
```

```
nanoagent 🐳
claude-sonnet-4-5 | /path/to/project | sandboxed
42 episodes in trace

────────────────────────────────────────────────────────────────────────────────
❯ Find and fix the bug in app.ts
────────────────────────────────────────────────────────────────────────────────

⏺ read(app.ts)
  ⎿     1| const user = getUser(id); +25 lines

⏺ I see a missing null check on line 12.

⏺ edit(app.ts)
  ⎿  ok

⏺ Fixed. Added a null check before accessing user.name.
```

Commands: `/q` to quit, `/c` to clear memory, `exit` to quit.

### One-Off Mode

```bash
bun nanoagent.ts "Read package.json and tell me the version"
```

### Compile to Binary

```bash
bun build nanoagent.ts --compile --outfile nanoagent
./nanoagent
```

## Tools

Six tools, all using direct Node/Bun APIs except `bash` which runs in a Docker sandbox:

| Tool | What it does | Sandboxed |
|------|-------------|-----------|
| `read` | Read file with line numbers, optional pagination | No |
| `write` | Write content to file | No |
| `edit` | Find and replace in file, with ambiguity guard | No |
| `glob` | Find files by pattern | No |
| `grep` | Search file contents by regex | No |
| `bash` | Run shell commands | Yes |

File tools use direct APIs — they can only do what their interface allows. `bash` can do anything, so it runs inside a Docker container with no network, no capabilities, and resource limits. See [docs/SANDBOX.md](docs/SANDBOX.md) for details.

## Memory

nanoagent has persistent episodic memory stored at `~/.nanoagent/trace.jsonl`.

### How It Works

Each completed turn (the full message chain — user input through all tool calls to final response) is saved as an episode with a vector embedding.

On each new turn:
1. **Recall** — embed the query, cosine-search all past episodes, LLM reranks the top 10 and summarizes what's relevant. Skipped if nothing scores above threshold.
2. **System prompt** — base prompt + recalled memories.
3. **Budget** — compute the exact working memory budget from real token counts (system prompt + tool schemas + output reserve). No magic constants.
4. **Turns buffer** — fill with the most recent episodes that fit.
5. **Agentic loop** — before every API call, evict the oldest whole turns from the buffer if tool results have grown the context past budget.

The current turn is never touched. Only buffered history is evictable. Turns are evicted as whole units — never broken apart.

## Architecture

~650 lines, single file, 15 sections in dependency order:

```
Imports → Config → Types → Utilities → Sandbox → Tools → Tool Schema →
Embeddings → Episodic Trace → LLM Interface → Recall → Working Memory →
Tool Execution → Agentic Loop → Main
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | (required) | Anthropic API key |
| `DISABLE_SANDBOX` | `false` | Set to `true` to run bash on host |

## Prerequisites

- [Bun](https://bun.sh) v1.3+
- [Docker](https://www.docker.com/) (for sandbox — auto-builds image on first use)
- Anthropic API key

## Project Structure

```
nanoagent/
├── nanoagent.ts           # The agent (~650 lines)
├── Dockerfile.sandbox     # Sandbox container image
├── lessons/               # 12-lesson tutorial series
├── docs/                  # Reference documentation
├── package.json           # Dependencies
└── .env.example           # Environment template
```

## Lessons

The `lessons/` directory teaches you to build nanoagent from scratch in 12 lessons:

1. What Is an Agent
2. Call Claude
3. Give It a Tool and Let It Act
4. Close the Loop
5. Expand the Toolkit
6. Use It
7. Give It Memory
8. The Context Window
9. Make Memories Searchable
10. Recall What Matters
11. Working Memory
12. Sandbox Command Execution

Each lesson adds one concept. Each lesson ends with a working agent.

## License

MIT
