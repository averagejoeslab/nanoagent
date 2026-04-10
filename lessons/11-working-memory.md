# Lesson 11: Working Memory

We have all the pieces: token counting, episodic trace, embeddings, recall. But they're running separately. And there's a new problem.

Try a complex task — read several large files, edit them, run tests. The agentic loop adds tool results to the messages each iteration. The context grows. Eventually the API rejects the request — even though the buffer was within budget when the turn started.

We need two things:
1. **Assembly** — orchestrate all the pieces in the right order before the turn
2. **Eviction** — shed old turns during the turn as tool results grow the context

## Working Memory

Working memory is everything in the context window for a given API call:

```
┌────────────────────────────────────────────────┐
│ System prompt (base + recalled memories)       │
│ Tool schemas                                   │
│ ┌────────────────────────────────────────────┐ │
│ │ Turns buffer (past episodes) ← evictable   │ │
│ │ Current turn (input + tools) ← protected   │ │
│ └────────────────────────────────────────────┘ │
│ Output reserve (MAX_TOKENS)                    │
└────────────────────────────────────────────────┘
```

The turns buffer is expendable — oldest turns are removed when space runs out. The current turn is sacred — tool results are never dropped.

## Assembly: The Right Order

**Recall runs first**, independent of budget. It searches all turns and produces a summary. Then the budget is computed with everything known:

```typescript
async function assembleWorkingMemory(input: string, baseSystemPrompt: string): Promise<{
  systemPrompt: string;
  messages: Message[];
  workingBudget: number;
  bufferEnd: number;
  bufferTurnSizes: number[];
}> {
  const allTurns = await loadEpisodicTrace();

  // Step 1: Recall (independent of budget)
  const recalledMemories = await recallMemories(input, allTurns);

  // Step 2: Assemble system prompt (size depends on recall)
  const systemPrompt = recalledMemories
    ? `${baseSystemPrompt}\n\n${recalledMemories}`
    : baseSystemPrompt;

  // Step 3: Compute budget (depends on system prompt size)
  const systemTokens = countTokens(systemPrompt);
  const workingBudget = CONTEXT_WINDOW - MAX_TOKENS - TOOL_SCHEMA_TOKENS - systemTokens;

  // Step 4: Fill turns buffer (depends on budget)
  const inputTokens = countTokens(input);
  const bufferBudget = workingBudget - inputTokens;

  const bufferTurns: TraceTurn[] = [];
  let bufferTokens = 0;

  for (let i = allTurns.length - 1; i >= 0; i--) {
    const turn = allTurns[i];
    const tokens = turnTokens(turn);
    if (bufferTokens + tokens > bufferBudget) break;
    bufferTurns.unshift(turn);
    bufferTokens += tokens;
  }

  // Step 5: Flatten and track turn sizes for eviction
  const messages: Message[] = [];
  const bufferTurnSizes: number[] = [];
  for (const turn of bufferTurns) {
    bufferTurnSizes.push(turn.messages.length);
    messages.push(...turn.messages);
  }

  const bufferEnd = messages.length;
  messages.push({ role: "user", content: input });

  return { systemPrompt, messages, workingBudget, bufferEnd, bufferTurnSizes };
}
```

Each step depends on the previous step. Nothing is estimated.

`bufferEnd` marks where the turns buffer ends and the current turn begins. Everything before it is evictable. Everything after it is protected.

`bufferTurnSizes` tracks how many messages each buffered turn contributed — a turn with 3 tool calls is 7 messages. We evict whole turns, never partial.

## Mid-Turn Eviction

Before every API call in the agentic loop, check the budget and evict the oldest turns if needed:

```typescript
function evictOldestTurns(
  messages: Message[],
  workingBudget: number,
  bufferEnd: number,
  bufferTurnSizes: number[],
): number {
  let total = totalMessageTokens(messages);

  while (total > workingBudget && bufferTurnSizes.length > 0) {
    const turnSize = bufferTurnSizes.shift()!;
    for (let i = 0; i < turnSize; i++) {
      total -= messageTokens(messages[0]);
      messages.splice(0, 1);
    }
    bufferEnd -= turnSize;
  }

  return bufferEnd;
}
```

**Whole turns only.** Never break a turn apart — that would orphan tool results from their tool calls.

**Never touch the current turn.** Tool results are ground truth the LLM is working with.

## Updated Agentic Loop

```typescript
async function agenticLoop(
  messages: Message[],
  systemPrompt: string,
  workingBudget: number,
  bufferEnd: number,
  bufferTurnSizes: number[],
): Promise<void> {
  while (true) {
    bufferEnd = evictOldestTurns(messages, workingBudget, bufferEnd, bufferTurnSizes);

    const response = await callLLM(messages, systemPrompt);
    // ... rest of loop unchanged ...
  }
}
```

## The Unified Flow

Both modes — REPL and one-off — use the same three steps:

```typescript
const ctx = await assembleWorkingMemory(input, baseSystemPrompt);
await agenticLoop(ctx.messages, ctx.systemPrompt, ctx.workingBudget, ctx.bufferEnd, ctx.bufferTurnSizes);
await saveEpisode(ctx.messages.slice(ctx.bufferEnd));
```

Assemble → loop → save. Before the turn, during the turn, after the turn.

`ctx.messages.slice(ctx.bufferEnd)` captures just the current turn — from the user's input through all tool calls to the final response. That's what gets saved as the next episode in the trace.

## What We Have

Foolproof context management. Every token is counted. The budget is enforced on every API call. History gracefully shrinks as the current task grows. The current turn is never touched. The agent handles long, complex tasks without crashing.

One thing remains. The `bash` tool can run any command — `rm -rf /`, `curl malicious-site.com`, anything. Let's contain it.
