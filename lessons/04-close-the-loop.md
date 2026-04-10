# Lesson 4: Close the Loop

Our agent handles one round of tool calls. But real tasks need multiple steps:

> "Read app.ts, find the bug, fix it, verify it compiles"

That's at least three tool calls. We need to loop until Claude is done.

## The Agentic Loop

Wrap the reason-act-observe cycle in `while (true)`. Break when Claude responds without any tool calls:

```typescript
async function agenticLoop(messages: Message[], systemPrompt: string): Promise<void> {
  while (true) {
    // REASON: Ask Claude what to do
    const response = await callLLM(messages, systemPrompt);

    // Display text
    for (const block of response.content.filter((b: any) => b.type === "text")) {
      console.log(block.text);
    }

    // ACT: Execute tool calls
    const toolCalls = response.content.filter((b: any) => b.type === "tool_use");
    const toolResults: any[] = [];

    if (toolCalls.length > 0) {
      // When Claude requests multiple tools, they're independent — run them concurrently
      const results = await Promise.all(
        toolCalls.map((call: any) => executeTool(call.name, call.input))
      );

      for (let i = 0; i < toolCalls.length; i++) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolCalls[i].id,
          content: results[i],
        });
      }
    }

    // OBSERVE: Add response to conversation
    messages.push({ role: "assistant", content: response.content });

    // If no tools were called, Claude is done
    if (toolResults.length === 0) break;

    // REPEAT: Feed results back
    messages.push({ role: "user", content: toolResults });
  }
}
```

That's the ReAct pattern from Lesson 1, in code.

## How It Works

```
Iteration 1:
  Claude: "I'll read the file" → [tool_use: read "app.ts"]
  Execute → file contents
  Push results, loop

Iteration 2:
  Claude sees the file contents
  Claude: "I see the bug, fixing it" → [tool_use: edit "app.ts", old, new]
  Execute → "ok"
  Push results, loop

Iteration 3:
  Claude: "Fixed the null check on line 42."
  No tool calls → break
```

Claude decides how many iterations. The loop just keeps going until there's nothing left to do.

## Parallel Execution

Notice the `Promise.all` — when Claude requests multiple tools in one response, they're independent by definition. We run them all at once instead of one at a time. Same results, less waiting.

## The Stop Condition

```typescript
if (toolResults.length === 0) break;
```

When Claude responds with only text and no `tool_use` blocks, the task is complete. That's the only exit condition.

## What We Have

A working agent. It can receive a task, reason about it, chain multiple tool calls, and stop when it's done. It only has one tool (`read`), but the loop handles any number. Let's give it a full toolkit.
