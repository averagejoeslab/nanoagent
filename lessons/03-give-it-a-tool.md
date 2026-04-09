# Lesson 3: Give It a Tool

## The Problem

Our LLM can talk, but it can't *do* anything. Ask it to read a file and it'll describe how to read a file. We need it to actually read the file.

Tools make this possible. A tool is a function you define. You tell the LLM what tools exist. When it needs one, it asks for it.

## Defining a Tool

A tool has three parts:
1. **Name** — what to call it
2. **Description** — what it does (the LLM reads this to decide when to use it)
3. **Input schema** — what parameters it accepts (JSON Schema)

```typescript
const tools = [
  {
    name: "read",
    description: "Read a file and return its contents",
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

## Sending Tools to the LLM

Pass the `tools` array in your API call:

```typescript
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
      tools,   // <-- tell the LLM what tools exist
    }),
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}
```

## What Happens

When you ask "Read the file hello.txt", Claude's response now contains a `tool_use` block instead of (or alongside) text:

```json
{
  "content": [
    {
      "type": "tool_use",
      "id": "toolu_abc123",
      "name": "read",
      "input": { "path": "hello.txt" }
    }
  ]
}
```

Claude is saying: "I want to call the `read` tool with `path: hello.txt`."

It doesn't execute anything. It can't. It's asking *you* to execute it and send back the result.

## The Key Insight

The LLM decides *what* to do. Your code decides *how* to do it.

Claude sees the tool descriptions and decides which tool fits the task. But the actual execution — reading a file, running a command, whatever — is your code. The LLM never touches your filesystem, your database, or your network. You do.

## Test It

Create a test file:
```bash
echo "Hello from the file!" > hello.txt
```

```typescript
const response = await callLLM(
  [{ role: "user", content: "Read hello.txt" }],
  "Concise coding assistant."
);

// Look at what Claude returned
for (const block of response.content) {
  if (block.type === "text") {
    console.log("Text:", block.text);
  } else if (block.type === "tool_use") {
    console.log("Tool request:", block.name, block.input);
  }
}
```

Output:
```
Tool request: read { path: "hello.txt" }
```

Claude asked to read the file. But nothing was read yet — we need to execute the tool and return the result. That's the next lesson.

## Next Steps

Claude can ask for tools. Now we need to actually run them and send the results back.

---

**Key Takeaways:**
- Tools are defined with a name, description, and JSON Schema for inputs
- Pass the `tools` array in every API call
- Claude returns `tool_use` blocks when it wants to use a tool
- Claude decides *what* to do. Your code does *how*.
- Nothing executes until you run the function and return the result
