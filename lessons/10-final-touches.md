# Lesson 10: Final Touches

## Congratulations!

You've built a complete AI agent from scratch. Let's add the final polish to make it production-ready.

## Error Handling

Right now, errors might crash your agent. Let's handle them gracefully.

### Tool Errors

Tools already return error strings, but let's be consistent:

```typescript
const TOOLS: Record<string, Tool> = {
  read: {
    desc: "Read file with line numbers",
    params: ["path"],
    fn: async (args) => {
      try {
        const lines = (await readFile(args.path, "utf-8")).split("\n");
        const start = args.offset ?? 0;
        const end = start + (args.limit ?? lines.length);
        return lines.slice(start, end).map((line, i) => 
          `${String(start + i + 1).padStart(4)}| ${line}`
        ).join("\n");
      } catch (err: any) {
        return `error: ${err.message}`;
      }
    },
  },
  // Same pattern for all tools
};
```

### API Errors

Show helpful messages when the API fails:

```typescript
async function callLLM(messages: Message[], systemPrompt: string) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages,
        tools: buildToolSchema(),
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error ${response.status}: ${error}`);
    }
    
    return response.json();
  } catch (err: any) {
    if (err.message.includes("API error")) throw err;
    throw new Error(`Network error: ${err.message}`);
  }
}
```

## Config Validation

Check that required environment variables exist:

```typescript
async function main() {
  // Validate API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(`${ANSI.red}Error: ANTHROPIC_API_KEY not set${ANSI.reset}`);
    console.error(`${ANSI.dim}Create a .env file with: ANTHROPIC_API_KEY=your_key_here${ANSI.reset}`);
    process.exit(1);
  }

  console.log(`
${ANSI.bold}${ANSI.cyan}nanoagent${ANSI.reset}
${ANSI.dim}${MODEL}${ANSI.reset} | ${ANSI.dim}${process.cwd()}${ANSI.reset}
`);
  
  // ... rest of main
}
```

## Better Tool Result Display

Make long results easier to read:

```typescript
// In agenticLoop, when displaying results
for (let i = 0; i < toolCalls.length; i++) {
  const call = toolCalls[i];
  const result = results[i];
  
  const lines = result.split("\n");
  const firstLine = lines[0].slice(0, 60);
  const extra = lines.length > 1 ? ` +${lines.length - 1} lines` : "";
  const resultPreview = firstLine + extra;
  
  console.log(`  ${ANSI.dim}⎿  ${resultPreview}${ANSI.reset}`);
  
  toolResults.push({ type: "tool_result", tool_use_id: call.id, content: result });
}
```

## Startup Banner

Show helpful information on startup:

```typescript
async function main() {
  // ... validation ...
  
  console.log(`
${ANSI.bold}${ANSI.cyan}nanoagent${ANSI.reset}
${ANSI.dim}${MODEL}${ANSI.reset} | ${ANSI.dim}${process.cwd()}${ANSI.reset}
`);

  console.log(`${ANSI.dim}Commands: /sleep, /c (clear), /q (quit)${ANSI.reset}\n`);
  
  // ... rest of main
}
```

## Documentation

Add a clear header to your file:

```typescript
#!/usr/bin/env bun
/**
 * nanoagent - minimal agentic coding assistant
 * Demonstrates the ReAct pattern: Reason → Act → Observe → Repeat
 * 
 * Usage:
 *   bun nanoagent.ts
 * 
 * Environment:
 *   ANTHROPIC_API_KEY - Your Anthropic API key (required)
 * 
 * Tools:
 *   read  - Read file with line numbers
 *   write - Write content to file
 *   edit  - Replace text in file
 *   glob  - Find files by pattern
 *   grep  - Search files with regex
 *   bash  - Run shell command
 */
```

## Create a README

Document how to use your agent:

```markdown
# nanoagent

A minimal interactive terminal-based coding assistant with agentic tool use.

## Quick Start

1. Install Bun:
```bash
curl -fsSL https://bun.sh/install | bash
```

2. Set your API key:
```bash
echo "ANTHROPIC_API_KEY=your_key_here" > .env
```

3. Run:
```bash
bun nanoagent.ts
```

## Features

- 6 powerful tools (read, write, edit, glob, grep, bash)
- ReAct pattern for autonomous multi-step operations
- Interactive REPL with color output
- Parallel tool execution
- ~255 lines of well-organized code

## Usage

Type your requests and nanoagent will use tools to complete them:

```
❯ Create a hello.ts file with a hello world function

⏺ write(hello.ts)
  ⎿  ok

⏺ I've created hello.ts with a hello world function
```

## Commands

- `/q` or `exit` - Quit
- `/c` - Clear conversation
```

## Final Code Structure

Your complete nanoagent:

```
┌─ Shebang & Documentation (lines 1-20)
├─ Imports (lines 21-25)
├─ Config (lines 26-40)
├─ Types (lines 41-50)
├─ Tools (lines 51-115)
├─ Tool Execution (lines 116-135)
├─ LLM Interface (lines 136-156)
├─ Agentic Loop (lines 157-215)
└─ REPL/UI (lines 216-255)
```

## What You've Built

A complete AI agent that:

✅ Uses the ReAct pattern correctly
✅ Executes tools in parallel when possible
✅ Has proper error handling
✅ Clean, organized code structure
✅ Production-quality implementation
✅ Easy to understand and modify
✅ ~255 lines of TypeScript

## You Are Done!

You built an AI agent from zero to production. You understand:

- How LLMs and tools work together
- The ReAct pattern
- Agentic loops and orchestration
- Parallel execution
- Clean code architecture

## What's Next?

**Extend nanoagent:**
- Add more tools
- Implement conversation persistence
- Add memory systems
- Build a web interface

**Build new agents:**
- Data analysis agent
- DevOps automation agent
- Customer service agent
- Research assistant

**Share your work:**
- Post on GitHub
- Write a blog post
- Make tutorial videos
- Help others learn

## Final Thoughts

You didn't just follow a tutorial. You built an agent piece by piece, understanding each component. That knowledge transfers to any agentic system.

The patterns you learned:
- Tool use
- ReAct loops
- Parallel execution
- Clean architecture

These apply to all agents, from simple scripts to complex multi-agent systems.

Now go build something amazing.

---

**Congratulations! You're an AI agent developer.**
