# Lesson 8: Parallel Execution

## The Problem

Currently, tools execute sequentially:

```typescript
for (const call of toolCalls) {
  const result = await tool.fn(...params); // Waits for each
  toolResults.push(...);
}
```

**This is slow across all domains:**

**Coding:** 3 file reads = 30ms sequential  
**Support:** 3 ticket queries = 300ms sequential  
**Analytics:** 3 database queries = 3000ms sequential  
**DevOps:** 3 service health checks = 1500ms sequential  

But these operations are independent! They could run simultaneously.

**This optimization is universal.**

## The Solution: Promise.all

```typescript
// Sequential (slow)
for (const call of toolCalls) {
  const result = await executeTool(call);
}

// Parallel (fast)
const results = await Promise.all(
  toolCalls.map(call => executeTool(call))
);
```

## How Claude Orchestrates

Here's the key insight: **Claude already decides what can run in parallel.**

If Claude returns multiple `tool_use` blocks in a single response, those tools are independent and can run together.

If Claude needs sequential execution, it returns one tool, waits for the result, then returns another tool in the next response.

## 💡 Parallel Execution Across Domains

**Coding Agent - Parallel:**
```
User: "Read file1.txt, file2.txt, and file3.txt"
Claude returns 3 tool_use blocks at once:
[
  { type: "tool_use", name: "read", input: { path: "file1.txt" } },
  { type: "tool_use", name: "read", input: { path: "file2.txt" } },
  { type: "tool_use", name: "read", input: { path: "file3.txt" } }
]
→ All execute simultaneously
```

**Support Agent - Parallel:**
```
User: "Show me details for tickets #123, #124, and #125"
Claude returns 3 tool_use blocks:
[
  { type: "tool_use", name: "read_ticket", input: { id: "123" } },
  { type: "tool_use", name: "read_ticket", input: { id: "124" } },
  { type: "tool_use", name: "read_ticket", input: { id: "125" } }
]
→ All execute simultaneously
```

**Analytics Agent - Parallel:**
```
User: "Query users, orders, and products tables"
Claude returns 3 tool_use blocks:
[
  { type: "tool_use", name: "query", input: { table: "users" } },
  { type: "tool_use", name: "query", input: { table: "orders" } },
  { type: "tool_use", name: "query", input: { table: "products" } }
]
→ All execute simultaneously
```

**DevOps Agent - Parallel:**
```
User: "Check health of api, worker, and database services"
Claude returns 3 tool_use blocks:
[
  { type: "tool_use", name: "health_check", input: { service: "api" } },
  { type: "tool_use", name: "health_check", input: { service: "worker" } },
  { type: "tool_use", name: "health_check", input: { service: "database" } }
]
→ All execute simultaneously
```

**When they must be sequential:**
```
User: "Read config.json and use it to create output.txt"

[First response]
Claude: { type: "tool_use", name: "read", input: { path: "config.json" } }

[After receiving result]
Claude: { type: "tool_use", name: "write", input: { path: "output.txt", content: "..." } }
```

Claude waits for the first result because it needs the data to decide what to write.

## Implementing Parallel Execution

```typescript
async function agenticLoop(userMessage: string) {
  const messages = [{ role: "user", content: userMessage }];

  while (true) {
    const response = await callClaude(messages);
    const toolCalls = response.content.filter(
      (b: any) => b.type === "tool_use"
    );

    messages.push({ role: "assistant", content: response.content });

    if (toolCalls.length === 0) {
      const textBlock = response.content.find((b: any) => b.type === "text");
      return textBlock?.text ?? "";
    }

    // Show all tool calls first
    for (const call of toolCalls) {
      console.log(
        `${ANSI.green}⏺ ${call.name}${ANSI.reset}(${ANSI.dim}${call.input.path || ""}${ANSI.reset})`
      );
    }

    // Execute all tools in parallel
    const results = await Promise.all(
      toolCalls.map(async (call) => {
        const tool = TOOLS_REGISTRY[call.name];
        if (!tool) return "error: unknown tool";
        
        const params = Object.values(call.input);
        return await tool.fn(...params);
      })
    );

    // Build tool results with matched IDs
    const toolResults = [];
    for (let i = 0; i < toolCalls.length; i++) {
      const call = toolCalls[i];
      const result = results[i];
      
      const preview = result.slice(0, 60);
      console.log(`  ${ANSI.dim}⎿  ${preview}${ANSI.reset}`);
      
      toolResults.push({
        type: "tool_result",
        tool_use_id: call.id,
        content: result,
      });
    }

    messages.push({ role: "user", content: toolResults });
  }
}
```

## The Difference

**Before (Sequential):**
```
⏺ read(file1.txt)
  ⎿  content of file 1
⏺ read(file2.txt)
  ⎿  content of file 2
⏺ read(file3.txt)
  ⎿  content of file 3
```
Time: sum of all operations

**After (Parallel):**
```
⏺ read(file1.txt)
⏺ read(file2.txt)
⏺ read(file3.txt)
  ⎿  content of file 1
  ⎿  content of file 2
  ⎿  content of file 3
```
Time: max of all operations

## When Does This Matter?

**High impact across domains:**

**Coding:**
- Multiple file reads (30ms → 10ms)
- Multiple grep searches (500ms → 200ms)

**Support:**
- Multiple ticket queries (300ms → 100ms)
- Checking multiple customer records (600ms → 200ms)

**Analytics:**
- Multiple database queries (3s → 1s)
- Multiple data transformations (5s → 2s)

**DevOps:**
- Multiple service health checks (1.5s → 500ms)
- Multiple log fetches (2s → 700ms)

**Low impact:**
- Single tool calls (nothing to parallelize)
- Very fast tools (10ms → 5ms not noticeable)

**Doesn't change behavior:**
- Claude already orchestrates the sequence
- Parallel execution is just faster, not different
- **Works identically across all domains**

## Error Handling with Promise.all

One failure shouldn't crash everything:

```typescript
const results = await Promise.all(
  toolCalls.map(async (call) => {
    try {
      const tool = TOOLS_REGISTRY[call.name];
      if (!tool) return "error: unknown tool";
      
      const params = Object.values(call.input);
      return await tool.fn(...params);
    } catch (err: any) {
      return `error: ${err.message}`;
    }
  })
);
```

Now if one file read fails, others still complete.

## Test Parallel Execution

Create test files:
```bash
echo "File 1" > test1.txt
echo "File 2" > test2.txt
echo "File 3" > test3.txt
```

Try it:
```
❯ Read test1.txt, test2.txt, and test3.txt

⏺ read(test1.txt)
⏺ read(test2.txt)
⏺ read(test3.txt)
  ⎿  File 1
  ⎿  File 2
  ⎿  File 3

⏺ All three files contain numbered content...
```

All three reads happened simultaneously!

## What We've Built

Your agent now:
- Executes independent tools in parallel
- Still maintains correct sequential order when needed
- Runs faster on multi-tool requests
- Lets Claude orchestrate the flow

## Next Steps

In the next lesson, we'll organize our code into clean sections with proper types.

---

**Key Takeaways:**
- Promise.all executes multiple async operations simultaneously
- Claude decides what can run in parallel (multiple tool_use blocks)
- Claude decides what must be sequential (separate responses)
- Parallel execution is faster but doesn't change behavior
- Always match tool results to their original IDs
