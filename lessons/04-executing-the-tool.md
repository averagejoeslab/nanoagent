# Lesson 4: Executing the Tool

## Where We Left Off

Claude told us it wants to call `read_file` with `{ path: "test.txt" }`. Now we need to:

1. Actually call our function
2. Send the result back to Claude
3. Get Claude's final response

**This execution pattern works for ALL agents, regardless of domain.**

## Executing the Tool

When Claude returns a `tool_use` block, extract the parameters and call your function:

```typescript
const result = await callClaude("Read the file test.txt");

// Find tool_use blocks
const toolCalls = result.content.filter(
  (block: any) => block.type === "tool_use"
);

if (toolCalls.length > 0) {
  const call = toolCalls[0];
  
  // Execute our function
  if (call.name === "read_file") {
    const toolResult = await readFileTool(call.input.path);
    console.log("Tool result:", toolResult);
  }
}
```

Output:
```
Tool result: Hello from file!
```

Great! We executed the tool. But Claude doesn't know the result yet.

**This works identically for other domains:**

```typescript
// Support agent
if (call.name === "read_ticket") {
  const toolResult = await readTicketTool(call.input.ticket_id);
}

// Analytics agent
if (call.name === "query_database") {
  const toolResult = await queryDatabaseTool(call.input.sql);
}

// DevOps agent
if (call.name === "get_logs") {
  const toolResult = await getLogsTool(call.input.service);
}
```

**Same pattern. Different function calls.**

## Sending the Result Back

You need to send the tool result back to Claude in a specific format:

```typescript
{
  role: "user",
  content: [
    {
      type: "tool_result",
      tool_use_id: "toolu_01ABC...", // Match the ID from tool_use
      content: "Hello from file!"      // The actual result
    }
  ]
}
```

**This format is universal.** Whether you're returning file contents, ticket data, SQL results, or server logs, the structure is identical.

## Building the Conversation

Claude's Messages API uses a conversation format. Each exchange is a message:

1. User asks something
2. Assistant responds (maybe with tool_use)
3. User provides tool_result
4. Assistant responds with final answer

**Here's the full flow:**

```typescript
async function executeToolCall(message: string) {
  const messages = [
    {
      role: "user",
      content: message,
    },
  ];

  // First call - Claude might request tool
  let response = await callClaude(messages);
  
  // Check for tool calls
  const toolCalls = response.content.filter(
    (block: any) => block.type === "tool_use"
  );

  if (toolCalls.length > 0) {
    // Add Claude's response to conversation
    messages.push({
      role: "assistant",
      content: response.content,
    });

    // Execute the tool
    const call = toolCalls[0];
    let toolResult = "";
    
    if (call.name === "read_file") {
      toolResult = await readFileTool(call.input.path);
    }

    // Send result back
    messages.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: call.id,
          content: toolResult,
        },
      ],
    });

    // Get final response
    response = await callClaude(messages);
  }

  // Extract and return final text
  const textBlock = response.content.find(
    (block: any) => block.type === "text"
  );
  return textBlock?.text ?? "";
}
```

## Update callClaude to Accept Messages

We need to modify `callClaude` to accept the full conversation:

```typescript
async function callClaude(messages: any[]) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      messages: messages, // Changed from single message
      tools: TOOLS,
    }),
  });

  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}
```

**This works for all agents.** The conversation structure doesn't change by domain.

## Test the Full Flow

```typescript
const answer = await executeToolCall("Read the file test.txt");
console.log(answer);
```

Output:
```
The file test.txt contains: "Hello from file!"
```

Success! Claude:
1. Requested to use the tool
2. Received the result
3. Gave you a natural language response

## Full Code

```typescript
import { readFile } from "node:fs/promises";

const API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const API_URL = "https://api.anthropic.com/v1/messages";

const TOOLS = [
  {
    name: "read_file",
    description: "Read the contents of a file at the given path",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "The file path to read" },
      },
      required: ["path"],
    },
  },
];

async function readFileTool(path: string): Promise<string> {
  try {
    return await readFile(path, "utf-8");
  } catch (err: any) {
    return `error: ${err.message}`;
  }
}

async function callClaude(messages: any[]) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      messages,
      tools: TOOLS,
    }),
  });

  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

async function executeToolCall(message: string) {
  const messages = [{ role: "user", content: message }];
  let response = await callClaude(messages);
  
  const toolCalls = response.content.filter(
    (b: any) => b.type === "tool_use"
  );

  if (toolCalls.length > 0) {
    messages.push({ role: "assistant", content: response.content });

    const call = toolCalls[0];
    let toolResult = "";
    
    if (call.name === "read_file") {
      toolResult = await readFileTool(call.input.path);
    }

    messages.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: call.id,
          content: toolResult,
        },
      ],
    });

    response = await callClaude(messages);
  }

  const textBlock = response.content.find((b: any) => b.type === "text");
  return textBlock?.text ?? "";
}

// Test
const answer = await executeToolCall("Read the file test.txt");
console.log(answer);
```

## What We've Built

You now have a working agent that can:
- Receive a request
- Decide to use a tool
- Execute that tool
- Return a natural language response

**This architecture works for any domain:**
- Coding agent reading files
- Support agent reading tickets
- Analytics agent querying databases
- DevOps agent fetching logs

**The mechanics are identical.**

But it can only do this **once**. If Claude needs multiple tool calls, it won't work yet.

## Next Steps

In the next lesson, we'll add the loop so Claude can chain multiple operations together.

The loop is also universal - same pattern for all agents.

---

**Key Takeaways:**
- Tool execution is your responsibility, not Claude's
- Send results back with `tool_result` content type
- Match `tool_use_id` to connect results to requests
- Conversation is built as an array of messages
- Claude can now use tools to complete simple tasks
- **This execution pattern works identically across all domains**
- Only the tool function calls change
