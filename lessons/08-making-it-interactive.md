# Lesson 8: Making it Interactive (REPL)

## The Problem

Right now, you have to edit your code and restart the script for each request. That's tedious.

We need a **REPL** (Read-Eval-Print Loop) - an interactive prompt where you can type commands and get responses.

**This UI pattern is universal.** Whether you're building a coding assistant, support bot, or DevOps console, the REPL works the same way.

## What is a REPL?

Think of your terminal shell:
```bash
$ ls
file1.txt file2.txt
$ echo "hello"
hello
$
```

That's a REPL. We want the same for our agent.

### REPL Examples by Domain

**Coding Agent:**
```
❯ Create a file hello.ts
⏺ I've created hello.ts with a hello world function

❯ Read hello.ts
⏺ The file contains: function hello() { console.log("Hello!"); }
```

**Support Agent:**
```
❯ Show me urgent tickets
⏺ Found 3 urgent tickets: #445, #446, #447

❯ Escalate #445
⏺ Ticket #445 escalated to senior support
```

**Analytics Agent:**
```
❯ Query sales for last month
⏺ Retrieved 1,247 sales records

❯ Calculate average
⏺ Average sale: $342.50
```

**DevOps Agent:**
```
❯ Check API service health
⏺ Service healthy: 0 errors, 99.9% uptime

❯ Show recent deployments
⏺ Last 3 deployments: v2.1.0, v2.0.9, v2.0.8
```

**Same REPL pattern. Different domain operations.**

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

### Use Cases by Domain

**Coding Agent:**
```bash
# Scripts
bun nanoagent.ts "Run tests and create a summary in test-results.md"

# CI/CD
bun nanoagent.ts "Update version in package.json to 2.0.0"

# Build automation
bun nanoagent.ts "Verify build artifacts and create manifest"
```

**Support Agent:**
```bash
# Triage automation
bun support-agent.ts "Process all unassigned tickets and categorize them"

# Daily reports
bun support-agent.ts "Generate support metrics report for yesterday"

# Escalation handling
bun support-agent.ts "Check all VIP tickets and escalate if response time > 1 hour"
```

**Analytics Agent:**
```bash
# Scheduled reports
bun analytics-agent.ts "Generate daily sales summary and email to team"

# Data validation
bun analytics-agent.ts "Check data pipeline for anomalies in last hour"

# Ad-hoc analysis
bun analytics-agent.ts "Compare Q1 vs Q2 revenue by region"
```

**DevOps Agent:**
```bash
# Health checks
bun devops-agent.ts "Check all production services and alert if any are down"

# Deployment automation
bun devops-agent.ts "Deploy version 2.1.0 to staging environment"

# Log analysis
bun devops-agent.ts "Analyze last hour of logs for error patterns"
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
