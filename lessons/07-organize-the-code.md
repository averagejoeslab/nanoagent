# Lesson 7: Organize the Code

## The Problem

Our agent works, but the code is growing. We have tools, an executor, an LLM interface, and a loop — all mixed together. Before adding more features, let's give it structure.

## Types

Define the shapes of our data:

```typescript
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

`Message` is what the API expects. `content` is a string for user messages or an array for assistant responses (which can contain `text` and `tool_use` blocks) and tool results.

`Tool` is our registry entry: a description, parameter names, and the function to call.

## Auto-Generated Schemas

We've been hand-writing tool schemas. Instead, generate them from the tool definitions:

```typescript
function buildToolSchema() {
  return Object.entries(TOOLS).map(([name, { desc, params }]) => {
    const required = params.filter((p) => !p.endsWith("?")).map((p) => p.replace("?", ""));
    const allParams = params.map((p) => p.replace("?", ""));
    const properties = Object.fromEntries(allParams.map((p) => {
      if (p === "all") return [p, { type: "boolean" }];
      if (p === "offset" || p === "limit") return [p, { type: "integer" }];
      return [p, { type: "string" }];
    }));
    return { name, description: desc, input_schema: { type: "object", properties, required } };
  });
}
```

Now adding a tool to the `TOOLS` record is all you need — the schema is auto-generated. The `?` suffix on params marks them optional.

## Section Structure

Organize the file into sections with visual separators. Each section depends only on sections above it:

```typescript
// ─── IMPORTS ─────────────────────────────────────────────────────────────────
// ─── CONFIG ──────────────────────────────────────────────────────────────────
// ─── TYPES ───────────────────────────────────────────────────────────────────
// ─── TOOLS ───────────────────────────────────────────────────────────────────
// ─── TOOL SCHEMA ─────────────────────────────────────────────────────────────
// ─── LLM INTERFACE ──────────────────────────────────────────────────────────
// ─── TOOL EXECUTION ─────────────────────────────────────────────────────────
// ─── AGENTIC LOOP ────────────────────────────────────────────────────────────
// ─── MAIN ────────────────────────────────────────────────────────────────────
```

This structure will grow as we add features (memory, sandboxing), but the principle stays: each section depends only on what's above it.

## ANSI Colors

Add color constants for readable terminal output:

```typescript
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

Use them in the agentic loop:

```typescript
// Text output
console.log(`\n${ANSI.cyan}⏺${ANSI.reset} ${block.text}`);

// Tool calls
console.log(`\n${ANSI.green}⏺ ${call.name}${ANSI.reset}(${ANSI.dim}${preview}${ANSI.reset})`);

// Tool results
console.log(`  ${ANSI.dim}⎿  ${resultPreview}${ANSI.reset}`);
```

## Config Constants

Pull magic values into named constants:

```typescript
const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 8192;
const SHELL_TIMEOUT = 30000;
```

## What the File Looks Like Now

```
Imports          → node:fs, node:child_process
Config           → API_URL, MODEL, MAX_TOKENS, ANSI
Types            → Message, Tool
Tools            → read, write, edit, glob, grep, bash
Tool Schema      → buildToolSchema()
LLM Interface    → callLLM()
Tool Execution   → executeTool()
Agentic Loop     → agenticLoop()
Main             → entry point
```

Every section is self-contained. Dependency flows downward. Adding a new feature means adding a new section in the right place.

## Next Steps

The agent works from a script, but you have to edit the code to change the prompt. Let's add an interactive REPL and a CLI mode.

---

**Key Takeaways:**
- Define types for `Message` and `Tool` to make the code self-documenting
- Auto-generate tool schemas from tool definitions — never hand-write schemas
- Organize into sections with visual separators and top-down dependencies
- Pull constants to the top. Add colors for readable output.
- Structure grows as features are added, but the principle doesn't change
