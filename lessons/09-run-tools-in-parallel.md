# Lesson 9: Run Tools in Parallel

## The Problem

When Claude requests multiple tools in one response, we execute them sequentially:

```
Claude: [tool_use: read "src/a.ts"], [tool_use: read "src/b.ts"], [tool_use: read "src/c.ts"]

Sequential: read a.ts (200ms) → read b.ts (200ms) → read c.ts (200ms) = 600ms
```

These are independent operations. They can run at the same time.

## The Fix

Replace the sequential loop with `Promise.all`:

```typescript
// Before (sequential)
for (const call of toolCalls) {
  const result = await executeTool(call.name, call.input);
  toolResults.push({ type: "tool_result", tool_use_id: call.id, content: result });
}

// After (parallel)
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
```

Same behavior. Same results. Less waiting.

```
Parallel: read a.ts + read b.ts + read c.ts = 200ms (all at once)
```

## Updated Agentic Loop

```typescript
async function agenticLoop(messages: Message[], systemPrompt: string): Promise<void> {
  while (true) {
    const response = await callLLM(messages, systemPrompt);

    for (const block of response.content.filter((b: any) => b.type === "text")) {
      console.log(`\n${ANSI.cyan}⏺${ANSI.reset} ${block.text}`);
    }

    const toolCalls = response.content.filter((b: any) => b.type === "tool_use");
    const toolResults: any[] = [];

    if (toolCalls.length > 0) {
      // Display what's being called
      for (const call of toolCalls) {
        const preview = String(Object.values(call.input)[0] ?? "").slice(0, 50);
        console.log(`\n${ANSI.green}⏺ ${call.name}${ANSI.reset}(${ANSI.dim}${preview}${ANSI.reset})`);
      }

      // Execute all tools in parallel
      const results = await Promise.all(
        toolCalls.map((call: any) => executeTool(call.name, call.input))
      );

      // Display results
      for (let i = 0; i < toolCalls.length; i++) {
        const lines = results[i].split("\n");
        const preview = lines[0].slice(0, 60) + (lines.length > 1 ? ` +${lines.length - 1} lines` : "");
        console.log(`  ${ANSI.dim}⎿  ${preview}${ANSI.reset}`);
        toolResults.push({ type: "tool_result", tool_use_id: toolCalls[i].id, content: results[i] });
      }
    }

    messages.push({ role: "assistant", content: response.content });
    if (toolResults.length === 0) break;
    messages.push({ role: "user", content: toolResults });
  }
}
```

## Why This Works

Claude already decides which tools can run independently. When it returns multiple `tool_use` blocks in one response, they're independent by definition — Claude wouldn't batch them otherwise. We just need to execute them concurrently.

If a tool fails, `Promise.all` still resolves because `executeTool` catches errors and returns them as strings. No tool throws — so no promise rejects.

## Next Steps

Our agent is stateless. Every restart is a blank slate. Before we can add memory, we need to understand the constraint everything is built around: the context window.

---

**Key Takeaways:**
- Replace sequential `for` loops with `Promise.all` for concurrent execution
- Claude batches independent tool calls. Execute them concurrently.
- `executeTool` never throws, so `Promise.all` always resolves
- Same results, less latency
