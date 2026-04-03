# Lesson 9: Clean Architecture

## The Critical Insight

Here's the most important lesson in this entire tutorial:

**Out of 10 sections in your agent, only 1 is domain-specific. The other 9 are universal.**

This means you can build agents for ANY domain by changing just 10% of the code.

## The Universal vs Domain-Specific Split

Let's look at the complete architecture:

```
┌─────────────────────────────────────────────────────┐
│ Section 1: Imports               [UNIVERSAL]        │
│ Section 2: Config                [UNIVERSAL]        │
│ Section 3: Types                 [UNIVERSAL]        │
│ Section 4: Tools                 [YOUR DOMAIN] ←──┐ │
│ Section 5: Tool Execution        [UNIVERSAL]       │ │
│ Section 6: Memory                [UNIVERSAL]       │ │
│ Section 7: LLM Interface         [UNIVERSAL]       │ │
│ Section 8: Agentic Loop          [UNIVERSAL]       │ │
│ Section 9: REPL/UI               [UNIVERSAL]       │ │
└─────────────────────────────────────────────────────┘
                                              Only this changes!
```

**This is revolutionary:** You only customize ONE section to build agents for different domains.

## What Changes Between Domains

Here's the same agent with different TOOLS sections:

**Coding Agent:**
```typescript
// Section 4: Tools
const TOOLS = {
  read: { /* read files */ },
  write: { /* write files */ },
  bash: { /* run commands */ },
  // ... other file tools
};
```

**Support Agent:**
```typescript
// Section 4: Tools  
const TOOLS = {
  read_ticket: { /* get ticket data */ },
  update_ticket: { /* change ticket */ },
  send_email: { /* email customer */ },
  // ... other support tools
};
```

**Analytics Agent:**
```typescript
// Section 4: Tools
const TOOLS = {
  query_db: { /* run SQL */ },
  create_chart: { /* generate viz */ },
  export_data: { /* save results */ },
  // ... other analytics tools
};
```

**DevOps Agent:**
```typescript
// Section 4: Tools
const TOOLS = {
  get_logs: { /* fetch logs */ },
  restart_service: { /* restart */ },
  deploy: { /* deploy version */ },
  // ... other DevOps tools
};
```

**Sections 1-3 and 5-9? Identical across all these agents.**

## The Problem (Before Organization)

Our code works, but it's getting messy:
- All in one giant file
- Mixed concerns (tools, API calls, UI)
- Hard to understand what each part does
- Difficult to see what's universal vs specific

Let's organize it properly while keeping it in a single file.

## The Goal

Clean sections with clear labels:
1. **Imports** - Dependencies [UNIVERSAL]
2. **Config** - Constants and settings [UNIVERSAL]
3. **Types** - TypeScript interfaces [UNIVERSAL]
4. **Tools** - Tool implementations [YOUR DOMAIN]
5. **Tool Execution** - Helper functions [UNIVERSAL]
6. **Memory** - Conversation storage [UNIVERSAL]
7. **LLM Interface** - API communication [UNIVERSAL]
8. **Agentic Loop** - Core ReAct pattern [UNIVERSAL]
9. **REPL/UI** - User interface [UNIVERSAL]

## Section 1: Imports

Put all imports at the top:

```typescript
#!/usr/bin/env bun
/**
 * nanoagent - minimal agentic coding assistant
 * Demonstrates the ReAct pattern: Reason → Act → Observe → Repeat
 */

// ─── IMPORTS ─────────────────────────────────────────────────────────────────
import { readFile, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import * as readline from "node:readline";
```

## Section 2: Config

All constants in one place:

```typescript
// ─── CONFIG ──────────────────────────────────────────────────────────────────
const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 8192;
const SHELL_TIMEOUT = 30000;

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  red: "\x1b[31m",
};
```

## Section 3: Types

Define proper TypeScript types:

```typescript
// ─── TYPES ───────────────────────────────────────────────────────────────────
type Message = {
  role: "user" | "assistant";
  content: string | any[];
};

type Tool = {
  desc: string;
  params: string[];
  fn: (args: any) => Promise<string> | string;
};
```

## Section 4: Tools [YOUR DOMAIN]

**This is the ONLY section that changes between agent types.**

All tool implementations:

```typescript
// ─── TOOLS ───────────────────────────────────────────────────────────────────
const TOOLS: Record<string, Tool> = {
  read: {
    desc: "Read file with line numbers",
    params: ["path"],
    fn: async (args) => {
      const lines = (await readFile(args.path, "utf-8")).split("\n");
      const start = args.offset ?? 0;
      const end = start + (args.limit ?? lines.length);
      return lines.slice(start, end).map((line, i) => 
        `${String(start + i + 1).padStart(4)}| ${line}`
      ).join("\n");
    },
  },
  write: {
    desc: "Write content to file",
    params: ["path", "content"],
    fn: async (args) => {
      await writeFile(args.path, args.content, "utf-8");
      return "ok";
    },
  },
  // ... other tools
};
```

**For a support agent, you'd replace this entire section with:**
```typescript
// ─── TOOLS ───────────────────────────────────────────────────────────────────
const TOOLS: Record<string, Tool> = {
  read_ticket: {
    desc: "Get ticket details by ID",
    params: ["ticket_id"],
    fn: async (args) => {
      const ticket = await db.tickets.find(args.ticket_id);
      return JSON.stringify(ticket);
    },
  },
  update_ticket: {
    desc: "Update ticket status",
    params: ["ticket_id", "status"],
    fn: async (args) => {
      await db.tickets.update(args.ticket_id, { status: args.status });
      return "ok";
    },
  },
  // ... other support tools
};
```

**Everything else stays the same.**

## Section 5: Tool Execution

Helper functions for tools:

```typescript
// ─── TOOL EXECUTION ──────────────────────────────────────────────────────────
async function executeTool(name: string, input: any): Promise<string> {
  const tool = TOOLS[name];
  if (!tool) return `error: unknown tool ${name}`;
  return await tool.fn(input);
}

function buildToolSchema() {
  return Object.entries(TOOLS).map(([name, { desc, params }]) => ({
    name,
    description: desc,
    input_schema: {
      type: "object",
      properties: Object.fromEntries(params.map((p) => [p, { type: "string" }])),
      required: params,
    },
  }));
}
```

## Section 6: LLM Interface

API communication:

```typescript
// ─── LLM INTERFACE ───────────────────────────────────────────────────────────
async function callLLM(messages: Message[], systemPrompt: string) {
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
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}
```

## Section 7: Agentic Loop

The core ReAct pattern with clear comments:

```typescript
// ─── AGENTIC LOOP ────────────────────────────────────────────────────────────
/**
 * The ReAct Pattern:
 * 1. REASON: LLM decides what to do based on context
 * 2. ACT: LLM calls tools to take action
 * 3. OBSERVE: Tool results are added to context
 * 4. REPEAT: Loop continues until LLM responds without tools
 */
async function agenticLoop(messages: Message[], systemPrompt: string): Promise<void> {
  while (true) {
    // REASON: Ask LLM what to do next
    const response = await callLLM(messages, systemPrompt);
    
    // Check for text output
    const textBlocks = response.content.filter((b: any) => b.type === "text");
    for (const block of textBlocks) {
      console.log(`\n${ANSI.cyan}⏺${ANSI.reset} ${block.text}`);
    }
    
    // ACT: Execute any tool calls (in parallel when multiple)
    const toolCalls = response.content.filter((b: any) => b.type === "tool_use");
    const toolResults: any[] = [];
    
    if (toolCalls.length > 0) {
      // Display what tools are being called
      for (const call of toolCalls) {
        const preview = String(Object.values(call.input)[0] ?? "").slice(0, 50);
        console.log(`\n${ANSI.green}⏺ ${call.name}${ANSI.reset}(${ANSI.dim}${preview}${ANSI.reset})`);
      }
      
      // Execute all tools in parallel
      const results = await Promise.all(
        toolCalls.map(call => executeTool(call.name, call.input))
      );
      
      // Display results and build tool_result blocks
      for (let i = 0; i < toolCalls.length; i++) {
        const call = toolCalls[i];
        const result = results[i];
        
        const lines = result.split("\n");
        const resultPreview = lines[0].slice(0, 60) + (lines.length > 1 ? ` +${lines.length - 1} lines` : "");
        console.log(`  ${ANSI.dim}⎿  ${resultPreview}${ANSI.reset}`);
        
        toolResults.push({ type: "tool_result", tool_use_id: call.id, content: result });
      }
    }
    
    // Add assistant response to conversation
    messages.push({ role: "assistant", content: response.content });
    
    // OBSERVE: If no tools were called, agent is done
    if (toolResults.length === 0) break;
    
    // REPEAT: Feed tool results back to LLM
    messages.push({ role: "user", content: toolResults });
  }
}
```

## Section 8: REPL/UI

User interface code:

```typescript
// ─── REPL / UI ───────────────────────────────────────────────────────────────
async function main() {
  console.log(`
${ANSI.bold}${ANSI.cyan}nanoagent${ANSI.reset}
${ANSI.dim}${MODEL}${ANSI.reset} | ${ANSI.dim}${process.cwd()}${ANSI.reset}
`);

  const messages: Message[] = [];
  const systemPrompt = `Concise coding assistant. cwd: ${process.cwd()}`;
  const separator = () => console.log(`${ANSI.dim}${"─".repeat(80)}${ANSI.reset}`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  while (true) {
    separator();
    const input = await new Promise<string>((resolve) => {
      rl.question(`${ANSI.bold}${ANSI.blue}❯${ANSI.reset} `, (answer) => resolve(answer.trim()));
    });
    separator();
    
    if (!input) continue;
    if (input === "/q" || input === "exit") break;
    if (input === "/c") {
      messages.length = 0;
      console.log(`${ANSI.green}⏺ Cleared conversation${ANSI.reset}`);
      continue;
    }
    
    messages.push({ role: "user", content: input });
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

## Benefits of This Structure

**Easy to navigate:**
- Clear section headers with visual separators
- Related code grouped together
- Logical flow top to bottom

**Easy to understand:**
- Types document interfaces
- Comments explain the ReAct pattern
- Each section has single responsibility
- **Labels show what's universal vs domain-specific**

**Easy to modify:**
- Want to add a tool? Go to TOOLS section (only domain-specific part)
- Want to change UI? Go to REPL/UI section (universal - works for all agents)
- Want to tweak the loop? Go to AGENTIC LOOP section (universal - same for all)

**Easy to port to new domains:**
- Copy the entire file
- Replace ONLY the TOOLS section
- Everything else works as-is

**Still a single file:**
- No complex module system
- Easy to share and deploy
- Fast to read and understand

## The Power of This Architecture

**Want to build a support agent?**
1. Copy nanoagent.ts
2. Replace section 4 (TOOLS) with support tools
3. Done. Sections 1-3 and 5-9 work unchanged.

**Want to build an analytics agent?**
1. Copy nanoagent.ts
2. Replace section 4 (TOOLS) with analytics tools
3. Done. Sections 1-3 and 5-9 work unchanged.

**Want to build a DevOps agent?**
1. Copy nanoagent.ts
2. Replace section 4 (TOOLS) with DevOps tools
3. Done. Sections 1-3 and 5-9 work unchanged.

**This is the universal agent pattern.**

## The File Now

Your complete agent in ~255 lines:
- Organized into 8 clear sections
- Proper TypeScript types
- Clean separation of concerns
- Well-commented ReAct pattern
- Professional structure

## What We've Built

The same functionality as before, but now:
- Readable and maintainable
- Easy to extend
- Clear teaching example
- Production-quality organization
- **Crystal clear which parts are universal vs domain-specific**

## The 90/10 Rule

**90% of your agent is universal:**
- Imports, config, types
- Tool execution machinery
- Memory management
- LLM interface
- Agentic loop
- UI/REPL

**10% is domain-specific:**
- The TOOLS section

**This is why agents are so powerful.** The hard parts (ReAct loop, memory, LLM orchestration) are solved once. You just plug in your domain's tools.

## Visualization

```
agent.ts (660 lines)
├─ Imports (15 lines)           [UNIVERSAL]
├─ Config (25 lines)            [UNIVERSAL]
├─ Types (20 lines)             [UNIVERSAL]
├─ Tools (150 lines)            [YOUR DOMAIN] ← Change this
├─ Tool Execution (30 lines)    [UNIVERSAL]
├─ Memory (80 lines)            [UNIVERSAL]
├─ LLM Interface (40 lines)     [UNIVERSAL]
├─ Agentic Loop (100 lines)     [UNIVERSAL]
└─ REPL/UI (200 lines)          [UNIVERSAL]

590 lines stay the same
70 lines change for your domain
```

## Next Steps

In the next lesson, we'll add error handling and finishing touches.

These polish improvements are also universal - work for all agents.

---

**Key Takeaways:**
- **Only section 4 (TOOLS) is domain-specific**
- **Sections 1-3 and 5-9 are universal across all agents**
- This is the 90/10 rule: 90% universal, 10% domain
- Clean architecture doesn't require multiple files
- Section headers with visual separators improve navigation
- [UNIVERSAL] and [YOUR DOMAIN] labels show what changes
- You can build agents for any domain by changing one section
- The hard parts (loop, memory, LLM) are solved once
- **This is why the agent pattern is so powerful**
