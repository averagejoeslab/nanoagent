# Lesson 8: Make It Interactive

## The Problem

Right now you have to edit the source code to change the prompt. We need two modes:
- **REPL** — interactive conversation in the terminal
- **One-off** — run a single prompt from the command line (for scripting)

## The REPL

Use Node's `readline` for interactive input:

```typescript
import * as readline from "node:readline";

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(`${ANSI.red}Error: ANTHROPIC_API_KEY not set${ANSI.reset}`);
    process.exit(1);
  }

  const systemPrompt = `Concise coding assistant. cwd: ${process.cwd()}`;
  const separator = () => console.log(`${ANSI.dim}${"─".repeat(80)}${ANSI.reset}`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log(`\n${ANSI.bold}${ANSI.cyan}nanoagent${ANSI.reset}`);
  console.log(`${ANSI.dim}${MODEL}${ANSI.reset} | ${ANSI.dim}${process.cwd()}${ANSI.reset}\n`);

  while (true) {
    separator();
    const input = await new Promise<string>((resolve) => {
      rl.question(`${ANSI.bold}${ANSI.blue}❯${ANSI.reset} `, (answer) => resolve(answer.trim()));
    });
    separator();

    if (!input) continue;
    if (input === "/q" || input === "exit") break;
    if (input === "/c") {
      console.log(`${ANSI.green}⏺ Cleared conversation${ANSI.reset}`);
      continue;
    }

    const messages: Message[] = [{ role: "user", content: input }];
    await agenticLoop(messages, systemPrompt);
    console.log();
  }

  rl.close();
}

main().catch((e) => {
  console.error(`${ANSI.red}Fatal: ${e}${ANSI.reset}`);
  process.exit(1);
});
```

## One-Off Mode

Check `process.argv[2]` for a prompt passed as a command line argument:

```typescript
const oneOffPrompt = process.argv[2];

if (oneOffPrompt) {
  const messages: Message[] = [{ role: "user", content: oneOffPrompt }];
  await agenticLoop(messages, systemPrompt);
  return;
}

// Otherwise, start the REPL...
```

Now the agent works both ways:
```bash
# Interactive
bun run nanoagent.ts

# One-off
bun run nanoagent.ts "Read package.json and tell me the version"
```

## Commands

The REPL handles a few built-in commands:
- `/q` or `exit` — quit
- `/c` — clear conversation (we'll use this more when we add memory)
- Empty input — skip

## Both Modes, Same Agent

Both modes call the same `agenticLoop` with the same tools. The only difference is where the input comes from. This is important — the agent's behavior is identical whether it's interactive or scripted.

## What It Looks Like

```
nanoagent
claude-sonnet-4-5 | /path/to/project

────────────────────────────────────────────────────────────────────────────────
❯ What files are in this directory?
────────────────────────────────────────────────────────────────────────────────

⏺ glob(*)
  ⎿  nanoagent.ts +2 lines

⏺ There are 3 files: nanoagent.ts, package.json, and bun.lockb.
```

## Next Steps

When Claude requests multiple tools at once, we execute them one at a time. We can do better.

---

**Key Takeaways:**
- `readline` provides the interactive REPL loop
- `process.argv[2]` enables one-off mode for scripting
- Both modes use the same `agenticLoop` — identical behavior
- Validate the API key early. Fail fast if it's missing.
