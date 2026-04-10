# Tools

nanoagent gives the LLM six tools. Five use direct Node/Bun APIs. One (`bash`) runs in a Docker sandbox.

## The Six Tools

### read

Read a file and return its contents with line numbers.

```
Params: path, offset? (0-indexed), limit?
Returns: "   1| first line\n   2| second line\n..."
```

`offset` and `limit` enable pagination for large files. Without them, the entire file is returned.

### write

Write content to a file. Creates the file if it doesn't exist, overwrites if it does.

```
Params: path, content
Returns: "ok"
```

### edit

Find and replace text in a file.

```
Params: path, old, new, all?
Returns: "ok" | "error: old_string not found" | "error: old_string appears N times. Use all=true to replace all"
```

Safety guard: if `old` matches more than once and `all` is not `true`, the edit is refused with an error. This prevents accidentally replacing the wrong occurrence. The LLM sees the error and either provides more context to make the match unique, or passes `all=true` if it wants to replace all occurrences.

### glob

Find files matching a pattern.

```
Params: pat, path? (defaults to ".")
Returns: file paths (one per line) | "none"
```

Uses Bun's native `Glob` API.

### grep

Search file contents by regex.

```
Params: pat, path? (defaults to ".")
Returns: "file:line:content" (one per line, max 50) | "none"
```

Skips `node_modules`. Returns at most 50 matches.

### bash

Run a shell command. Sandboxed by default.

```
Params: cmd
Returns: stdout | stderr | "error: command timed out..." | "(empty)"
```

When sandbox is enabled, runs inside a Docker container with no network, no capabilities, and resource limits. When disabled (`DISABLE_SANDBOX=true`), runs directly on the host via `execSync`.

Includes retry-on-failure: if the container dies, a new one is created and the command is retried once.

30-second timeout. Commands that exceed it are killed with `SIGKILL`.

## The Passthrough Pattern

Every tool returns a string. The executor passes it through to the LLM with no transformation:

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

- Successes are strings: file contents, `"ok"`, stdout
- Errors are strings: `"error: old_string not found"`, stderr, exception messages
- The executor catches exceptions and stringifies them

The LLM reads whatever comes back and decides what to do. If a file doesn't exist, it sees `"Error: ENOENT: no such file"` and tries a different path. If an edit fails, it reads the error and adjusts. No special error handling needed — the LLM self-corrects from the string.

## Tool Registry

Tools are defined in a `Record<string, Tool>`:

```typescript
type Tool = {
  desc: string;
  params: string[];
  fn: (args: any) => Promise<string> | string;
};

const TOOLS: Record<string, Tool> = {
  read: { desc: "...", params: ["path", "offset?", "limit?"], fn: async (args) => { ... } },
  // ...
};
```

The `?` suffix marks optional parameters.

## Auto-Generated Schemas

`buildToolSchema()` generates the Anthropic API tool schemas from the registry:

```typescript
const TOOL_SCHEMAS = buildToolSchema();
```

Add a tool to `TOOLS` and the schema is generated automatically. You never hand-write JSON schemas.

`TOOL_SCHEMA_TOKENS` is computed once at startup — the token cost of sending all tool schemas on every API call.

## Adding a New Tool

1. Add an entry to the `TOOLS` record:

```typescript
myTool: {
  desc: "What it does (the LLM reads this)",
  params: ["requiredParam", "optionalParam?"],
  fn: async (args) => {
    // do something
    return "result as string";
  },
},
```

2. That's it. The schema is auto-generated. The executor handles it. The LLM sees it.

## Why File Tools Aren't Sandboxed

File tools (`read`, `write`, `edit`, `glob`, `grep`) use direct Node/Bun APIs: `readFile`, `writeFile`, `Bun.Glob`, `RegExp`. They can only do what their interface allows — read a file, write a file, search by pattern. They can't access the network, spawn processes, or escalate privileges.

`bash` can do anything the shell can do. That's the execution boundary — the one tool that's structurally unconstrained. See [SANDBOX.md](SANDBOX.md) for how it's contained.
