# Lesson 3: Adding One Tool

## What is a Tool?

A tool is a function that connects your agent to the real world. You define:

1. The function itself (what it does)
2. A schema (how to call it)

Claude looks at your tool schemas and decides when to use them based on the user's request.

**Every agent needs tools. The pattern is universal.**

## The Universal Read Pattern

Almost every agent needs to **read data from somewhere**. The operation is different, but the pattern is identical:

**Coding Agent:** Read files from disk  
**Support Agent:** Read tickets from database  
**Analytics Agent:** Read data from SQL  
**DevOps Agent:** Read logs from services  

**Different sources. Same pattern: get data → return it.**

## Building Our First Tool

We'll build a file reader for our coding agent example. But as you read the code, think about how you'd adapt it for your domain.

```typescript
// agent.ts
import { readFile } from "node:fs/promises";

const API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const API_URL = "https://api.anthropic.com/v1/messages";

// Our tool function
async function readFileTool(path: string): Promise<string> {
  try {
    const content = await readFile(path, "utf-8");
    return content;
  } catch (err: any) {
    return `error: ${err.message}`;
  }
}
```

**For your domain, this becomes:**

```typescript
// Support Agent
async function readTicketTool(ticketId: string): Promise<string> {
  try {
    const ticket = await database.tickets.findOne({ id: ticketId });
    return JSON.stringify(ticket);
  } catch (err: any) {
    return `error: ${err.message}`;
  }
}

// Analytics Agent
async function queryDatabaseTool(sql: string): Promise<string> {
  try {
    const results = await database.query(sql);
    return JSON.stringify(results);
  } catch (err: any) {
    return `error: ${err.message}`;
  }
}

// DevOps Agent
async function getLogsTool(service: string): Promise<string> {
  try {
    const logs = await kubectl.logs(service, { tail: 100 });
    return logs;
  } catch (err: any) {
    return `error: ${err.message}`;
  }
}
```

**Same structure:**
1. Accept parameters
2. Try to get the data
3. Return data or error string
4. Never throw exceptions (LLM can't catch them)

## Defining the Tool Schema

Tools need a schema that describes them to Claude:

```typescript
const TOOLS = [
  {
    name: "read_file",
    description: "Read the contents of a file at the given path",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The file path to read",
        },
      },
      required: ["path"],
    },
  },
];
```

**Schema breakdown:**

- `name`: How Claude refers to the tool
- `description`: When to use it (be clear!)
- `input_schema`: What parameters it takes (JSON Schema format)
- `required`: Which parameters must be provided

## 💡 Other Domain Examples

**Support Agent Tool Schema:**
```typescript
{
  name: "read_ticket",
  description: "Get details of a support ticket by ID",
  input_schema: {
    type: "object",
    properties: {
      ticket_id: {
        type: "string",
        description: "The ticket ID to retrieve",
      },
    },
    required: ["ticket_id"],
  },
}
```

**Analytics Agent Tool Schema:**
```typescript
{
  name: "query_database",
  description: "Execute a SQL SELECT query and return results",
  input_schema: {
    type: "object",
    properties: {
      sql: {
        type: "string",
        description: "The SQL query to execute (SELECT only)",
      },
    },
    required: ["sql"],
  },
}
```

**DevOps Agent Tool Schema:**
```typescript
{
  name: "get_logs",
  description: "Fetch recent logs from a service",
  input_schema: {
    type: "object",
    properties: {
      service: {
        type: "string",
        description: "The service name to fetch logs from",
      },
    },
    required: ["service"],
  },
}
```

**See the pattern?** The schema structure is identical across all domains.

## Sending Tools to Claude

Update your `callClaude` function to include tools:

```typescript
async function callClaude(message: string) {
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
      messages: [
        {
          role: "user",
          content: message,
        },
      ],
      tools: TOOLS, // Add this line
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}
```

**This works for all agents.** You just change what's in the `TOOLS` array.

## Test It

Create a test file:

```bash
echo "Hello from file!" > test.txt
```

Run your agent:

```typescript
const result = await callClaude("Read the file test.txt");
console.log(JSON.stringify(result, null, 2));
```

## Understanding the Response

You'll see something different now:

```json
{
  "content": [
    {
      "type": "tool_use",
      "id": "toolu_01ABC...",
      "name": "read_file",
      "input": {
        "path": "test.txt"
      }
    }
  ],
  "stop_reason": "tool_use"
}
```

**Key differences:**

- `type: "tool_use"` instead of `type: "text"`
- Claude is **requesting** to use the tool
- `input` contains the parameters Claude wants to call with
- `stop_reason: "tool_use"` means Claude wants you to execute a tool

## Claude Didn't Execute Anything

Important: Claude doesn't run your code. It just says "I want to call this tool with these parameters."

**You** are responsible for:
1. Detecting the tool_use block
2. Calling your function
3. Sending the result back

We'll do that in the next lesson!

## Extract the Tool Call

Add a helper to see what Claude wants:

```typescript
const result = await callClaude("Read the file test.txt");

// Find tool_use blocks
const toolCalls = result.content.filter(
  (block: any) => block.type === "tool_use"
);

if (toolCalls.length > 0) {
  const call = toolCalls[0];
  console.log(`Claude wants to call: ${call.name}`);
  console.log(`With parameters:`, call.input);
}
```

Output:
```
Claude wants to call: read_file
With parameters: { path: 'test.txt' }
```

## The Universal Pattern

**What we just learned works for ALL agents:**

1. Define a function (your domain logic)
2. Define a schema (describes the function)
3. Send tools array to Claude
4. Claude returns tool_use when it wants to use a tool
5. You execute the function (next lesson)

**The only thing that changes is your function implementation.** The pattern stays the same.

## Full Code So Far

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

async function callClaude(message: string) {
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
      messages: [{ role: "user", content: message }],
      tools: TOOLS,
    }),
  });

  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

// Test
const result = await callClaude("Read the file test.txt");
const toolCalls = result.content.filter((b: any) => b.type === "tool_use");

if (toolCalls.length > 0) {
  console.log(`Claude wants to call: ${toolCalls[0].name}`);
  console.log(`With parameters:`, toolCalls[0].input);
}
```

## Next Steps

In the next lesson, we'll actually execute the tool and send the result back to Claude.

This execution pattern is also universal - same for all domains.

---

**Key Takeaways:**
- Tools are functions that connect agents to the real world
- Tool schemas tell Claude what each tool does
- Claude returns `tool_use` blocks when it wants to use a tool
- You still need to execute the tool yourself (next lesson!)
- **The tool pattern is universal across all domains**
- Only the function implementation changes
- Schema structure stays the same
