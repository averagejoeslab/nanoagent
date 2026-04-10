# Lesson 5: Expand the Toolkit

One tool isn't enough. A coding agent needs to read, write, search, and execute. Let's add five more tools and organize them properly.

## The Tool Registry

Instead of hand-writing schemas for each tool, define tools in a registry and generate schemas automatically:

```typescript
type Tool = {
  desc: string;
  params: string[];
  fn: (args: any) => Promise<string> | string;
};

const TOOLS: Record<string, Tool> = {
  // tools go here
};
```

Each tool has a description, parameter names (suffix `?` for optional), and a function that returns a string. The registry makes adding tools easy and keeps schemas in sync.

## Six Tools

```typescript
import { readFile, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";

const TOOLS: Record<string, Tool> = {
  read: {
    desc: "Read file with line numbers. Use offset/limit to paginate large files (0-indexed line numbers)",
    params: ["path", "offset?", "limit?"],
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
  edit: {
    desc: "Replace old with new in file. Use all=true to replace all occurrences",
    params: ["path", "old", "new", "all?"],
    fn: async (args) => {
      const content = await readFile(args.path, "utf-8");
      if (!content.includes(args.old)) return "error: old_string not found";
      const escaped = args.old.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const count = (content.match(new RegExp(escaped, "g")) ?? []).length;
      if (!args.all && count > 1)
        return `error: old_string appears ${count} times. Use all=true to replace all`;
      const result = args.all
        ? content.replaceAll(args.old, args.new)
        : content.replace(args.old, args.new);
      await writeFile(args.path, result, "utf-8");
      return "ok";
    },
  },
  glob: {
    desc: "Find files by pattern. Defaults to current directory if path not specified",
    params: ["pat", "path?"],
    fn: async (args) => {
      const files: string[] = [];
      for await (const file of new Bun.Glob(`${args.path ?? "."}/${args.pat}`).scan()) {
        files.push(file);
      }
      return files.join("\n") || "none";
    },
  },
  grep: {
    desc: "Search files for regex. Defaults to current directory if path not specified",
    params: ["pat", "path?"],
    fn: async (args) => {
      const pattern = new RegExp(args.pat);
      const hits: string[] = [];
      for await (const file of new Bun.Glob(`${args.path ?? "."}/**`).scan()) {
        if (file.includes("node_modules")) continue;
        try {
          const content = await readFile(file, "utf-8");
          content.split("\n").forEach((line, i) => {
            if (pattern.test(line)) hits.push(`${file}:${i + 1}:${line.trim()}`);
          });
        } catch {}
      }
      return hits.slice(0, 50).join("\n") || "none";
    },
  },
  bash: {
    desc: "Run shell command",
    params: ["cmd"],
    fn: (args) => {
      try {
        return execSync(args.cmd, { encoding: "utf-8", timeout: 30000 }).trim() || "(empty)";
      } catch (err: any) {
        return (err.stdout || err.stderr || String(err)).trim();
      }
    },
  },
};
```

Every tool returns a string. `edit` has built-in safety — it won't silently replace the wrong occurrence when multiple matches exist. `bash` returns stdout on success, stderr on failure. The LLM reads whatever comes back and decides what to do next.

## Auto-Generated Schemas

Generate the API tool schemas from the registry:

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

const TOOL_SCHEMAS = buildToolSchema();
```

Add a tool to the registry → schema is generated automatically. Update `callLLM` to use `TOOL_SCHEMAS`:

```typescript
body: JSON.stringify({
  model: MODEL,
  max_tokens: MAX_TOKENS,
  system: systemPrompt,
  messages,
  tools: TOOL_SCHEMAS,
}),
```

## Generic Executor

The executor looks up any tool by name:

```typescript
async function executeTool(name: string, input: any): Promise<string> {
  try {
    const tool = TOOLS[name];
    if (!tool) return `error: unknown tool ${name}`;
    return await tool.fn(input);
  } catch (err: any) {
    return String(err);
  }
}
```

One function handles all tools. The passthrough pattern from Lesson 3 — tools return strings, executor passes them through, LLM self-corrects on errors.

## What We Have

Six tools, auto-generated schemas, a generic executor. The agent can read files, write files, edit code, search a codebase, and run commands. But we're still running it from a script. Let's make it interactive.
