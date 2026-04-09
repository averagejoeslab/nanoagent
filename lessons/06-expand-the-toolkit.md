# Lesson 6: Expand the Toolkit

## The Problem

Our agent can read files. That's it. A useful coding agent needs to:
- **Read** the world: read files, find files, search contents
- **Change** the world: write files, edit files
- **Execute** in the world: run shell commands

## Six Tools

Here are the six tools we need, implemented as a tool registry:

```typescript
import { readFile, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";

const TOOLS: Record<string, { desc: string; params: string[]; fn: (args: any) => Promise<string> | string }> = {
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

## What Each Tool Does

| Tool | Category | Returns on success | Returns on error |
|------|----------|-------------------|-----------------|
| `read` | Read | File content with line numbers | Throws (executor catches) |
| `write` | Change | `"ok"` | Throws |
| `edit` | Change | `"ok"` | `"error: old_string not found"` or `"error: old_string appears N times..."` |
| `glob` | Read | File paths, one per line, or `"none"` | Throws |
| `grep` | Read | `file:line:content` matches, or `"none"` | Throws |
| `bash` | Execute | stdout, or `"(empty)"` | stderr or error message |

Every tool returns a string. The `edit` tool has built-in safety — it won't silently replace the wrong occurrence when multiple matches exist.

## Updating the Executor

The executor now looks up tools by name from the registry:

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

One function handles all tools. Add a new tool to `TOOLS` and it works automatically.

## The Three Categories

Every tool in any agent falls into one of three categories:

| Category | Coding tools | What they do |
|----------|-------------|-------------|
| **Read** | `read`, `glob`, `grep` | Observe the world without changing it |
| **Change** | `write`, `edit` | Modify the world |
| **Execute** | `bash` | Run arbitrary operations |

The execute category (`bash`) is the most powerful and dangerous — it can do anything the shell can do. We'll secure it with sandboxing in a later lesson.

## Next Steps

We have tools and a loop. The code works but it's getting messy. Let's organize it properly.

---

**Key Takeaways:**
- Six tools cover reading, writing, searching, and executing
- All tools return strings. The executor passes them through.
- The tool registry pattern: define tools in a record, look up by name
- `edit` has safety guards against ambiguous replacements
- `bash` is the most powerful tool — and the most dangerous
