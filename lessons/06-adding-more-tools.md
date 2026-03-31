# Lesson 6: Adding More Tools

## Beyond Reading Files

Our agent can read files, but to be useful it needs to:
- Write files
- Edit existing files
- Search for files
- Search within files
- Run shell commands

Let's add all six tools that make up nanoagent.

## Tool 1: Write File

```typescript
import { writeFile } from "node:fs/promises";

async function writeFileTool(path: string, content: string): Promise<string> {
  try {
    await writeFile(path, content, "utf-8");
    return "ok";
  } catch (err: any) {
    return `error: ${err.message}`;
  }
}
```

**Schema:**
```typescript
{
  name: "write",
  description: "Write content to a file",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path to write to" },
      content: { type: "string", description: "Content to write" },
    },
    required: ["path", "content"],
  },
}
```

## Tool 2: Edit File

```typescript
async function editFileTool(
  path: string,
  old: string,
  newText: string
): Promise<string> {
  try {
    const content = await readFile(path, "utf-8");
    
    if (!content.includes(old)) {
      return "error: old_string not found";
    }
    
    const result = content.replace(old, newText);
    await writeFile(path, result, "utf-8");
    return "ok";
  } catch (err: any) {
    return `error: ${err.message}`;
  }
}
```

**Schema:**
```typescript
{
  name: "edit",
  description: "Replace old text with new text in a file",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path to edit" },
      old: { type: "string", description: "Text to find" },
      new: { type: "string", description: "Text to replace with" },
    },
    required: ["path", "old", "new"],
  },
}
```

## Tool 3: Glob (Find Files)

```typescript
async function globTool(pattern: string): Promise<string> {
  const files: string[] = [];
  for await (const file of new Bun.Glob(`./${pattern}`).scan()) {
    files.push(file);
  }
  return files.join("\n") || "none";
}
```

**Schema:**
```typescript
{
  name: "glob",
  description: "Find files matching a pattern (e.g. '*.ts', 'src/**/*.js')",
  input_schema: {
    type: "object",
    properties: {
      pat: { type: "string", description: "Glob pattern" },
    },
    required: ["pat"],
  },
}
```

## Tool 4: Grep (Search in Files)

```typescript
async function grepTool(pattern: string): Promise<string> {
  const regex = new RegExp(pattern);
  const hits: string[] = [];
  
  for await (const file of new Bun.Glob("./**").scan()) {
    if (file.includes("node_modules")) continue;
    
    try {
      const content = await readFile(file, "utf-8");
      content.split("\n").forEach((line, i) => {
        if (regex.test(line)) {
          hits.push(`${file}:${i + 1}:${line.trim()}`);
        }
      });
    } catch {}
  }
  
  return hits.slice(0, 50).join("\n") || "none";
}
```

**Schema:**
```typescript
{
  name: "grep",
  description: "Search for a regex pattern in files",
  input_schema: {
    type: "object",
    properties: {
      pat: { type: "string", description: "Regex pattern to search for" },
    },
    required: ["pat"],
  },
}
```

## Tool 5: Bash (Shell Commands)

```typescript
import { execSync } from "node:child_process";

function bashTool(cmd: string): string {
  try {
    const result = execSync(cmd, {
      encoding: "utf-8",
      timeout: 30000,
    }).trim();
    return result || "(empty)";
  } catch (err: any) {
    return (err.stdout || err.stderr || String(err)).trim();
  }
}
```

**Schema:**
```typescript
{
  name: "bash",
  description: "Run a shell command and return output",
  input_schema: {
    type: "object",
    properties: {
      cmd: { type: "string", description: "Shell command to execute" },
    },
    required: ["cmd"],
  },
}
```

## Creating a Tool Registry

Instead of if/else chains, use a registry:

```typescript
const TOOLS_REGISTRY: Record<string, {
  fn: (...args: any[]) => Promise<string> | string;
  schema: any;
}> = {
  read: {
    fn: readFileTool,
    schema: {
      name: "read",
      description: "Read file contents",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path" },
        },
        required: ["path"],
      },
    },
  },
  write: {
    fn: writeFileTool,
    schema: {
      name: "write",
      description: "Write content to file",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
      },
    },
  },
  // ... add edit, glob, grep, bash
};

// Extract just the schemas for API call
const TOOLS = Object.values(TOOLS_REGISTRY).map(t => t.schema);
```

## Executing Any Tool

Update your loop to handle any tool:

```typescript
for (const call of toolCalls) {
  const tool = TOOLS_REGISTRY[call.name];
  
  if (!tool) {
    toolResults.push({
      type: "tool_result",
      tool_use_id: call.id,
      content: `error: unknown tool ${call.name}`,
    });
    continue;
  }
  
  // Call the function with spread parameters
  const params = Object.values(call.input);
  const result = await tool.fn(...params);
  
  toolResults.push({
    type: "tool_result",
    tool_use_id: call.id,
    content: result,
  });
}
```

## Test All Tools

```typescript
const result = await agenticLoop(`
  Create a file called hello.ts with a hello world function.
  Then find all .ts files in the current directory.
  Then search for the word 'function' in all files.
`);

console.log(result);
```

Claude will:
1. Use `write` to create hello.ts
2. Use `glob` to find *.ts files
3. Use `grep` to search for "function"
4. Summarize the results

## What We've Built

Your agent now has six powerful tools:
- `read` - Read files
- `write` - Create/overwrite files  
- `edit` - Modify existing files
- `glob` - Find files by pattern
- `grep` - Search within files
- `bash` - Execute shell commands

This is enough to do real coding work!

## Next Steps

In the next lesson, we'll add an interactive REPL so you can have conversations with your agent.

---

**Key Takeaways:**
- Tool registry pattern keeps code organized
- Each tool has a function + schema
- Generic execution works for any tool
- Six tools give substantial capability
- Agents become useful with multiple complementary tools
