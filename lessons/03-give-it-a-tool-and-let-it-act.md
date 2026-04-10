# Lesson 3: Give It a Tool and Let It Act

Claude can talk. Now let's give it something to do.

## Defining a Tool

A tool has three parts: a name, a description (the LLM reads this to decide when to use it), and an input schema:

```typescript
const tools = [
  {
    name: "read",
    description: "Read a file and return its contents with line numbers",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
      },
      required: ["path"],
    },
  },
];
```

Pass `tools` in the API call:

```typescript
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
      tools,   // tell Claude what tools exist
    }),
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}
```

Now when you ask "Read hello.txt", Claude's response contains a `tool_use` block:

```json
{
  "type": "tool_use",
  "id": "toolu_abc123",
  "name": "read",
  "input": { "path": "hello.txt" }
}
```

Claude is saying: "I want to call `read` with `path: hello.txt`." It can't execute anything. It's asking you to do it.

## Implementing the Tool

Write the actual function:

```typescript
import { readFile } from "node:fs/promises";

async function readTool(args: { path: string }): Promise<string> {
  const lines = (await readFile(args.path, "utf-8")).split("\n");
  return lines.map((line, i) =>
    `${String(i + 1).padStart(4)}| ${line}`
  ).join("\n");
}
```

The tool returns a string. Always a string. That's the contract.

## Executing and Returning the Result

Extract the `tool_use` block, run the function, and send the result back as a `tool_result`:

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

The executor catches errors and returns them as strings. No special error handling, no error codes. The LLM reads "error: ENOENT: no such file" and tries a different path. It reads file contents and continues working. Raw strings in, raw strings out.

## The Full Round-Trip

```typescript
// 1. User asks
const messages: Message[] = [{ role: "user", content: "Read hello.txt" }];

// 2. Claude requests a tool
const response = await callLLM(messages, "Concise coding assistant.");
const toolCalls = response.content.filter((b: any) => b.type === "tool_use");

// 3. Execute and build results
const toolResults = [];
for (const call of toolCalls) {
  const result = await executeTool(call.name, call.input);
  toolResults.push({
    type: "tool_result",
    tool_use_id: call.id,   // must match the tool_use id
    content: result,
  });
}

// 4. Send results back
messages.push({ role: "assistant", content: response.content });
messages.push({ role: "user", content: toolResults });

// 5. Claude responds with the answer
const followUp = await callLLM(messages, "Concise coding assistant.");
console.log(followUp.content[0].text);
```

Create a test file and try it:
```bash
echo "Hello from the file!" > hello.txt
bun run nanoagent.ts
```

Claude reads the file through your tool and tells you what's in it. The agent *acted*.

## What We Have

The LLM decides what to do. Your code does it. The result goes back. The LLM responds. That's one complete action cycle. But it only handles a single round of tool calls. What if Claude needs to read a file, then edit it, then test it? We need a loop.
