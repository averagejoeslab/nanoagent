# Lesson 5: Close the Loop

## The Problem

Our agent can handle one round of tool calls. But real tasks need multiple steps:

> "Read app.ts, find the bug, fix it, then verify the fix compiles"

That's at least 3 tool calls. We need to loop until Claude is done.

## The Agentic Loop

Wrap everything in `while (true)`. Break when Claude responds without tool calls:

```typescript
async function agenticLoop(messages: any[], systemPrompt: string) {
  while (true) {
    // REASON: Ask Claude what to do
    const response = await callLLM(messages, systemPrompt);

    // Display text output
    for (const block of response.content.filter((b: any) => b.type === "text")) {
      console.log(block.text);
    }

    // ACT: Execute tool calls
    const toolCalls = response.content.filter((b: any) => b.type === "tool_use");
    const toolResults: any[] = [];

    for (const call of toolCalls) {
      const result = await executeTool(call.name, call.input);
      toolResults.push({ type: "tool_result", tool_use_id: call.id, content: result });
    }

    // Add response to conversation
    messages.push({ role: "assistant", content: response.content });

    // OBSERVE: If no tools called, we're done
    if (toolResults.length === 0) break;

    // REPEAT: Feed results back
    messages.push({ role: "user", content: toolResults });
  }
}
```

That's the ReAct pattern from Lesson 1, implemented in code.

## How It Works

**Iteration 1:**
```
User: "Read config.json and check if debug is enabled"
Claude: [tool_use: read, path: "config.json"]
→ execute read → returns file contents
→ push results, loop
```

**Iteration 2:**
```
Claude sees the file contents
Claude: "Debug mode is set to true in config.json."
→ no tool calls
→ break
```

For a more complex task:

**Iteration 1:** Claude reads the file
**Iteration 2:** Claude edits the file
**Iteration 3:** Claude runs a test
**Iteration 4:** Claude reports the result (no tools → break)

Claude decides how many iterations. The loop just keeps going until there's nothing left to do.

## The Stop Condition

```typescript
if (toolResults.length === 0) break;
```

When Claude responds with only text (no `tool_use` blocks), the task is complete. This is the only exit condition.

## Test It

```typescript
const messages = [
  { role: "user", content: "Read hello.txt and tell me what's in it" }
];

await agenticLoop(messages, "Concise coding assistant.");
```

Claude will:
1. Call `read` on hello.txt
2. See the contents
3. Respond with a summary (no tools → done)

## What We've Built

This is a working agent. It can:
- Receive a task from the user
- Reason about what tools to use
- Execute tools and observe results
- Chain multiple operations
- Stop when the task is complete

It only has one tool (`read`), but the loop handles any number of tool calls. In the next lesson, we'll add more tools.

## Next Steps

One tool isn't very useful. We need to read, write, search, and execute. Let's expand the toolkit.

---

**Key Takeaways:**
- `while (true)` + break when no tool calls = the agentic loop
- The LLM decides how many iterations. The loop just runs.
- Each iteration: reason → act → observe → repeat
- This is the core of every agent. Everything else builds on it.
