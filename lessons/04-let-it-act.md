# Lesson 4: Let It Act

## The Problem

Claude asked to use a tool. Nothing happened. We need to:
1. Execute the function Claude asked for
2. Send the result back to Claude
3. Let Claude respond with the answer

## Implementing the Tool

First, write the actual function:

```typescript
import { readFile } from "node:fs/promises";

async function readTool(args: { path: string }): Promise<string> {
  const content = await readFile(args.path, "utf-8");
  const lines = content.split("\n");
  return lines.map((line, i) =>
    `${String(i + 1).padStart(4)}| ${line}`
  ).join("\n");
}
```

The tool returns a string. Always a string. That's the contract.

## Executing the Tool

When Claude returns a `tool_use` block, extract it and run the function:

```typescript
const response = await callLLM(messages, systemPrompt);

const toolCalls = response.content.filter((b: any) => b.type === "tool_use");

for (const call of toolCalls) {
  if (call.name === "read") {
    const result = await readTool(call.input);
    console.log(result);
  }
}
```

## Sending the Result Back

Claude needs the result to continue reasoning. Send it as a `tool_result` message:

```typescript
const toolResults = [];

for (const call of toolCalls) {
  let result = "";
  if (call.name === "read") {
    result = await readTool(call.input);
  }

  toolResults.push({
    type: "tool_result",
    tool_use_id: call.id,  // must match the tool_use id
    content: result,
  });
}

// Add Claude's response, then the results
messages.push({ role: "assistant", content: response.content });
messages.push({ role: "user", content: toolResults });

// Now call Claude again — it can see the tool results
const followUp = await callLLM(messages, systemPrompt);
console.log(followUp.content[0].text);
```

## The Tool Executor

Let's make a generic executor. Tools return strings. The executor passes them through. If a tool throws, the executor catches it and passes the error as a string. Either way, the LLM sees a string and decides what to do — self-correcting on errors.

```typescript
async function executeTool(name: string, input: any): Promise<string> {
  try {
    if (name === "read") return await readTool(input);
    return `error: unknown tool ${name}`;
  } catch (err: any) {
    return String(err);
  }
}
```

No special error handling. No error codes. No wrapping. The LLM reads "error: ENOENT: no such file" and tries a different path. The LLM reads "ok" and moves on. Raw strings in, raw strings out.

## Full Example

```typescript
import { readFile } from "node:fs/promises";

const API_URL = "https://api.anthropic.com/v1/messages";

const tools = [{
  name: "read",
  description: "Read a file and return its contents with line numbers",
  input_schema: {
    type: "object",
    properties: { path: { type: "string" } },
    required: ["path"],
  },
}];

async function readTool(args: any): Promise<string> {
  const lines = (await readFile(args.path, "utf-8")).split("\n");
  return lines.map((line, i) => `${String(i + 1).padStart(4)}| ${line}`).join("\n");
}

async function executeTool(name: string, input: any): Promise<string> {
  try {
    if (name === "read") return await readTool(input);
    return `error: unknown tool ${name}`;
  } catch (err: any) {
    return String(err);
  }
}

async function callLLM(messages: any[], systemPrompt: string) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 8192,
      system: systemPrompt,
      messages,
      tools,
    }),
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

// Test: ask Claude to read a file
const messages: any[] = [{ role: "user", content: "Read hello.txt" }];
const response = await callLLM(messages, "Concise coding assistant.");

// Execute the tool
const toolCalls = response.content.filter((b: any) => b.type === "tool_use");
const toolResults = [];

for (const call of toolCalls) {
  const result = await executeTool(call.name, call.input);
  toolResults.push({ type: "tool_result", tool_use_id: call.id, content: result });
}

// Send results back
messages.push({ role: "assistant", content: response.content });
messages.push({ role: "user", content: toolResults });

// Get Claude's final response
const followUp = await callLLM(messages, "Concise coding assistant.");
console.log(followUp.content[0].text);
```

## Next Steps

This works for one round of tool calls. But what if Claude needs to chain operations — read a file, then edit it, then verify? We need a loop.

---

**Key Takeaways:**
- Tools return raw strings. The executor passes them through.
- `tool_result` messages must reference the `tool_use_id` they're responding to
- Errors are strings too — the LLM reads them and self-corrects
- The flow: LLM requests tool → you execute → you send result → LLM continues
