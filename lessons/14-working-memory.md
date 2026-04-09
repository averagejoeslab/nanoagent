# Lesson 14: Working Memory

## The Problem

We have all the pieces:
- Token counting (Lesson 10)
- Episodic trace — save/load whole turns (Lesson 11)
- Embeddings — searchable vectors (Lesson 12)
- Recall — find relevant episodes (Lesson 13)

But they're not connected. We need to orchestrate them into a single function that assembles the working memory for each turn, and enforce the budget during the agentic loop as tool results grow.

## What Is Working Memory?

Working memory is everything in the context window for a given API call:

```
┌────────────────────────────────────────────────────┐
│ System prompt (base + recalled memories)           │
│ Tool schemas                                       │
│ ┌────────────────────────────────────────────────┐ │
│ │ Messages                                       │ │
│ │ ┌──────────────────────────────────────┐       │ │
│ │ │ Turns buffer (recent past episodes)  │ ← evictable
│ │ └──────────────────────────────────────┘       │ │
│ │ ┌──────────────────────────────────────┐       │ │
│ │ │ Current turn (input + tool results)  │ ← protected
│ │ └──────────────────────────────────────┘       │ │
│ └────────────────────────────────────────────────┘ │
│ Output reserve (MAX_TOKENS)                        │
└────────────────────────────────────────────────────┘
```

The **turns buffer** is evictable — oldest turns are removed when space runs out. The **current turn** is protected — tool results are never dropped or truncated.

## Assembly: The Right Order

The key insight: **recall runs first, independent of budget.** Then we compute the budget with everything known.

```typescript
async function assembleWorkingMemory(input: string, baseSystemPrompt: string): Promise<{
  systemPrompt: string;
  messages: Message[];
  workingBudget: number;
  bufferEnd: number;
  bufferTurnSizes: number[];
}> {
  const allTurns = await loadEpisodicTrace();

  // Step 1: Get recent turns for context
  const recentTurns = allTurns.slice(-3);

  // Step 2: Recall from all turns (independent of budget)
  const recalledMemories = await recallMemories(input, allTurns, recentTurns);

  // Step 3: Assemble full system prompt
  const systemPrompt = recalledMemories
    ? `${baseSystemPrompt}\n\n${recalledMemories}`
    : baseSystemPrompt;

  // Step 4: Compute exact working memory budget
  const systemTokens = countTokens(systemPrompt);
  const workingBudget = CONTEXT_WINDOW - MAX_TOKENS - TOOL_SCHEMA_TOKENS - systemTokens;

  // Step 5: Fill turns buffer (newest first, reserving space for user input)
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

  // Step 6: Flatten turns buffer into messages, track turn sizes for eviction
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

Why this order?
1. **Recall runs on all turns** — no dependency on budget
2. **System prompt assembled** — size depends on recalled memories
3. **Budget computed** — depends on system prompt size
4. **Buffer filled** — depends on budget
5. **User input appended** — after buffer, tracked by `bufferEnd`

Every step depends on the previous step. Nothing is estimated.

## Mid-Turn Eviction

During the agentic loop, tool results grow the messages array. Before each API call, evict the oldest buffered turns if over budget:

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

**Whole turns only.** A turn with 7 messages (tool calls + results) is evicted as one unit. We never break a turn apart — that would orphan tool results from their tool calls.

**Never touch the current turn.** Everything from `bufferEnd` onwards is the active task. Tool results are ground truth the LLM is working with. Truncating them would mean the LLM reasons from incomplete data.

## Updated Agentic Loop

Add `evictOldestTurns` at the top of each iteration:

```typescript
async function agenticLoop(
  messages: Message[],
  systemPrompt: string,
  workingBudget: number,
  bufferEnd: number,
  bufferTurnSizes: number[],
): Promise<void> {
  while (true) {
    // Enforce budget: evict oldest turns from buffer if over
    bufferEnd = evictOldestTurns(messages, workingBudget, bufferEnd, bufferTurnSizes);

    const response = await callLLM(messages, systemPrompt);
    // ... rest of loop unchanged ...
  }
}
```

## Unified Main Flow

Both modes now use the same flow:

```typescript
const ctx = await assembleWorkingMemory(input, baseSystemPrompt);
await agenticLoop(ctx.messages, ctx.systemPrompt, ctx.workingBudget, ctx.bufferEnd, ctx.bufferTurnSizes);
await saveEpisode(ctx.messages.slice(ctx.bufferEnd));
```

`assembleWorkingMemory` → `agenticLoop` → `saveEpisode`. Before the turn, during the turn, after the turn.

## The Messages Array Over Time

```
After assembly:
[turn₁ msgs][turn₂ msgs][turn₃ msgs][USER INPUT]
 ←────── buffer (evictable) ──────→  ← current →
                                    bufferEnd

After 2 tool calls (context grew):
[turn₁ msgs][turn₂ msgs][turn₃ msgs][USER INPUT][asst][results][asst][results]
 ←────── buffer (evictable) ──────→  ←──────── current turn (protected) ───────→

After eviction (oldest turn removed to fit):
[turn₂ msgs][turn₃ msgs][USER INPUT][asst][results][asst][results]
 ←── buffer (smaller) ──→  ←──────── current turn (protected) ───────→
```

The buffer shrinks as the current turn grows. The budget holds.

## Next Steps

The agent can reason, act, remember, and recall. But `bash` can run any command — including malicious ones. We need to contain it.

---

**Key Takeaways:**
- `assembleWorkingMemory` orchestrates: recall → prompt → budget → buffer → input
- Recall runs first, independent of budget. Budget is computed from real counts.
- `bufferEnd` marks where evictable history ends and the protected current turn begins
- `evictOldestTurns` removes whole turns before each API call to enforce the budget
- The current turn is never touched — tool results are ground truth
- Both modes use the same flow: assemble → loop → save
