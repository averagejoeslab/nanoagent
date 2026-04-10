# Lesson 6: Use It

We have a working agent with six tools. Let's make it something you can actually use — an interactive REPL and a one-off CLI mode.

## The REPL

```typescript
import * as readline from "node:readline";

const ANSI = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  blue: "\x1b[34m", cyan: "\x1b[36m", green: "\x1b[32m", red: "\x1b[31m",
};

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

Check for a command-line argument. If present, run it and exit:

```typescript
const oneOffPrompt = process.argv[2];

if (oneOffPrompt) {
  const messages: Message[] = [{ role: "user", content: oneOffPrompt }];
  await agenticLoop(messages, systemPrompt);
  return;
}

// Otherwise, start the REPL...
```

Two ways to use the same agent:
```bash
# Interactive
bun run nanoagent.ts

# Scripted
bun run nanoagent.ts "Read package.json and tell me the version"
```

## Make the Loop Readable

Add colors to the agentic loop so you can see what's happening:

```typescript
// Text output
console.log(`\n${ANSI.cyan}⏺${ANSI.reset} ${block.text}`);

// Tool calls
const preview = String(Object.values(call.input)[0] ?? "").slice(0, 50);
console.log(`\n${ANSI.green}⏺ ${call.name}${ANSI.reset}(${ANSI.dim}${preview}${ANSI.reset})`);

// Tool results
const lines = result.split("\n");
const preview = lines[0].slice(0, 60) + (lines.length > 1 ? ` +${lines.length - 1} lines` : "");
console.log(`  ${ANSI.dim}⎿  ${preview}${ANSI.reset}`);
```

## Try It

```bash
bun run nanoagent.ts
```

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

Play with it. Ask it to read files, create files, search for patterns, run commands. It works.

## What We Have

A working coding agent with:
- 6 tools (read, write, edit, glob, grep, bash)
- An agentic loop that chains operations
- Parallel tool execution
- Interactive REPL + one-off CLI

This is a real, usable agent. But try this: quit with `/q`, restart, and ask "What were we just working on?"

It has no idea. Every restart is a blank slate. Let's fix that.
