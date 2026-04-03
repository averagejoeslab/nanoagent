# Lesson 7: Making it Interactive (REPL)

## The Problem

Right now, you have to edit your code and restart the script for each request. That's tedious.

We need a **REPL** (Read-Eval-Print Loop) - an interactive prompt where you can type commands and get responses.

## What is a REPL?

Think of your terminal shell:
```bash
$ ls
file1.txt file2.txt
$ echo "hello"
hello
$
```

That's a REPL. We want the same for our agent:
```
❯ Create a file hello.ts
⏺ I've created hello.ts with a hello world function

❯ Read hello.ts
⏺ The file contains: function hello() { console.log("Hello!"); }

❯
```

## Using Node's Readline

Node.js has a built-in `readline` module for interactive input:

```typescript
import * as readline from "node:readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Ask a question
rl.question("What is your name? ", (answer) => {
  console.log(`Hello, ${answer}!`);
  rl.close();
});
```

## Building the Main Loop

```typescript
async function main() {
  console.log("nanoagent - Type your requests below\n");
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  while (true) {
    const input = await new Promise<string>((resolve) => {
      rl.question("❯ ", (answer) => resolve(answer.trim()));
    });
    
    if (!input) continue; // Empty input, skip
    if (input === "exit" || input === "/q") {
      console.log("Goodbye!");
      break;
    }
    
    const response = await agenticLoop(input);
    console.log(`⏺ ${response}\n`);
  }
  
  rl.close();
}

main().catch((e) => {
  console.error(`Error: ${e}`);
  process.exit(1);
});
```

## Adding Commands

Let's add some special commands:

```typescript
async function main() {
  console.log("nanoagent");
  console.log("Commands: /q (quit), /c (clear)\n");
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const messages: any[] = []; // Store conversation

  while (true) {
    const input = await new Promise<string>((resolve) => {
      rl.question("❯ ", (answer) => resolve(answer.trim()));
    });
    
    if (!input) continue;
    
    // Handle commands
    if (input === "/q" || input === "exit") {
      console.log("Goodbye!");
      break;
    }
    
    if (input === "/c") {
      messages.length = 0; // Clear conversation
      console.log("⏺ Cleared conversation\n");
      continue;
    }
    
    // Regular message - use agenticLoop but keep conversation
    const response = await agenticLoop(input);
    console.log(`⏺ ${response}\n`);
  }
  
  rl.close();
}
```

## Adding ANSI Colors

Make the output prettier with colors:

```typescript
const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
};

// Usage
console.log(`${ANSI.bold}${ANSI.cyan}nanoagent${ANSI.reset}`);
console.log(`${ANSI.dim}Commands: /q (quit), /c (clear)${ANSI.reset}\n`);

// In the loop
rl.question(`${ANSI.bold}${ANSI.blue}❯${ANSI.reset} `, ...);
console.log(`${ANSI.cyan}⏺${ANSI.reset} ${response}\n`);
```

## Showing Tool Calls

Let's make it visible when Claude uses tools:

```typescript
async function agenticLoop(userMessage: string) {
  const messages = [{ role: "user", content: userMessage }];

  while (true) {
    const response = await callClaude(messages);
    const toolCalls = response.content.filter(
      (b: any) => b.type === "tool_use"
    );

    messages.push({ role: "assistant", content: response.content });

    if (toolCalls.length === 0) {
      const textBlock = response.content.find((b: any) => b.type === "text");
      return textBlock?.text ?? "";
    }

    const toolResults = [];
    for (const call of toolCalls) {
      // Show what tool is being called
      console.log(
        `${ANSI.green}⏺ ${call.name}${ANSI.reset}(${ANSI.dim}${call.input.path || call.input.cmd || ""}${ANSI.reset})`
      );
      
      const tool = TOOLS_REGISTRY[call.name];
      if (!tool) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: `error: unknown tool`,
        });
        continue;
      }
      
      const params = Object.values(call.input);
      const result = await tool.fn(...params);
      
      // Show result preview
      const preview = result.slice(0, 60);
      console.log(`  ${ANSI.dim}⎿  ${preview}${ANSI.reset}`);
      
      toolResults.push({
        type: "tool_result",
        tool_use_id: call.id,
        content: result,
      });
    }

    messages.push({ role: "user", content: toolResults });
  }
}
```

## Add a Separator

Make output cleaner with separators:

```typescript
function separator() {
  console.log(`${ANSI.dim}${"─".repeat(80)}${ANSI.reset}`);
}

// In main loop
while (true) {
  separator();
  const input = await new Promise<string>(...);
  separator();
  // ...
}
```

## Full Interactive Example

```
────────────────────────────────────────────────────────────────────────────────
❯ Create hello.ts with a hello world function
────────────────────────────────────────────────────────────────────────────────

⏺ write(hello.ts)
  ⎿  ok

⏺ I've created hello.ts with a hello world function

────────────────────────────────────────────────────────────────────────────────
❯ Read it back to me
────────────────────────────────────────────────────────────────────────────────

⏺ read(hello.ts)
  ⎿  function hello() { console.log("Hello, world!"); }

⏺ The file contains a simple hello function that logs "Hello, world!"

────────────────────────────────────────────────────────────────────────────────
❯ /q
Goodbye!
```

## One-Off Mode for Automation

Interactive mode is great for development, but what about automation?

You can run a single command without entering the REPL:

```bash
bun nanoagent.ts "Create a hello.ts file with a hello function"
```

### Implementation

Check for command-line arguments:

```typescript
async function main() {
  const oneOffPrompt = process.argv[2];
  
  // One-off mode: run single prompt and exit
  if (oneOffPrompt) {
    const messages = [{ role: "user", content: oneOffPrompt }];
    const systemPrompt = `Concise coding assistant. cwd: ${process.cwd()}`;
    
    await agenticLoop(messages, systemPrompt);
    return;
  }
  
  // Otherwise, start interactive REPL
  console.log("nanoagent");
  // ... rest of REPL code
}
```

### Use Cases

**Scripts:**
```bash
#!/bin/bash
bun nanoagent.ts "Run tests and create a summary in test-results.md"
bun nanoagent.ts "Update version in package.json to 2.0.0"
```

**CI/CD Pipelines:**
```yaml
# .github/workflows/deploy.yml
- name: Generate deployment docs
  run: bun nanoagent.ts "Create deployment.md with current config details"

- name: Update changelog
  run: bun nanoagent.ts "Add today's changes to CHANGELOG.md from git log"
```

**Cron Jobs:**
```bash
# Daily report
0 9 * * * cd /project && bun nanoagent.ts "Analyze yesterday's logs and email summary"
```

**Build Automation:**
```json
{
  "scripts": {
    "prepare-release": "bun nanoagent.ts 'Update README with latest API docs'",
    "post-build": "bun nanoagent.ts 'Verify build artifacts and create manifest'"
  }
}
```

### How It Works

1. **Check argv**: If `process.argv[2]` exists, it's the prompt
2. **Run once**: Execute the agentic loop with that prompt
3. **Exit**: Return immediately after completion
4. **No REPL**: Never enters interactive mode

### Benefits

- **Scriptable**: Use in bash scripts, CI/CD, cron jobs
- **Composable**: Chain with other commands
- **Same tools**: Full agent capabilities in one-off mode
- **Same behavior**: Memory, tool use, everything works the same

### Example Session

**One-off:**
```bash
$ bun nanoagent.ts "List all TypeScript files"

⏺ glob(*.ts)
  ⎿  nanoagent.ts

⏺ Found 1 TypeScript file: nanoagent.ts

$ echo "Done"
Done
```

**Interactive:**
```bash
$ bun nanoagent.ts

nanoagent
claude-sonnet-4-5 | /tmp/demo

❯ List all TypeScript files

⏺ glob(*.ts)
  ⎿  nanoagent.ts

⏺ Found 1 TypeScript file: nanoagent.ts

❯ /q
```

Same result, different modes.

## What We've Built

Your agent now has two modes:

**Interactive (REPL):**
- Type requests and get responses
- See tool calls as they happen
- Use commands (/q, /c)
- Have multi-turn conversations
- Visual feedback with colors and separators

**One-Off (Automation):**
- Run single commands from CLI
- Use in scripts and CI/CD
- Same capabilities, no interaction
- Exit after completion

## Real-World CI/CD Example

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
      
      - name: Generate release notes
        run: |
          bun nanoagent.ts "Read CHANGELOG.md and create a GitHub release notes summary for version ${{ github.ref_name }}"
      
      - name: Update documentation
        run: |
          bun nanoagent.ts "Update README.md with the new version number and latest features"
      
      - name: Create release
        uses: actions/create-release@v1
        with:
          tag_name: ${{ github.ref }}
          release_name: Release ${{ github.ref }}
          body_path: ./release-notes.md
```

Your agent becomes part of your development workflow.

## Next Steps

In the next lesson, we'll add parallel tool execution so multiple tools can run at once.

---

**Key Takeaways:**
- REPLs make agents user-friendly for development
- One-off mode makes agents scriptable for automation
- Check `process.argv[2]` for command-line prompt
- Same agent, two modes: interactive and automated
- Use in CI/CD, cron jobs, build scripts, anywhere
- readline module handles interactive input
- Commands like /q and /c improve UX
- ANSI colors make output clearer
- Showing tool calls helps users understand what's happening
