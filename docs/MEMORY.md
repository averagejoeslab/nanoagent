# Memory

nanoagent has a three-layer memory system: an episodic trace (persistent storage), semantic recall (retrieval), and working memory (context management).

## Episodic Trace

Every completed turn is saved as an episode to `~/.nanoagent/trace.jsonl`. System-wide — same memory regardless of which directory you run from.

### What Is a Turn?

A turn is the complete message chain from user input through all tool calls to the final response:

```
user: "Fix the bug in app.ts"
assistant: [tool_use: read "app.ts"]
user: [tool_result: file contents]
assistant: [tool_use: edit "app.ts", old, new]
user: [tool_result: "ok"]
assistant: "Fixed the null check on line 42."
```

That's one turn — 6 messages. The whole chain is saved. Not just the final answer.

### TraceTurn Format

```typescript
type TraceTurn = {
  timestamp: string;    // ISO 8601
  messages: Message[];  // full message chain
  embedding: number[];  // 384-dim vector for semantic search
};
```

One TraceTurn per line in the JSONL file.

### Embedding

Each turn is embedded when saved. `turnTextForEmbedding` extracts:
- User's query (full text)
- Tool names and inputs (first 100 chars of input JSON)
- Tool result snippets (first 200 chars)
- Assistant reasoning (full text blocks)

The embedding captures the gist of what happened — what was asked, what tools were used, and what the outcome was.

## Semantic Recall

When the user asks something, the agent searches the entire trace for relevant past episodes.

### Two-Stage Retrieval

**Stage 1: Vector search (local, fast)**
1. Embed the user's query → 384-dim vector
2. Cosine similarity against all episode embeddings
3. Sort by score, take top 10

**Stage 2: LLM reranking (API call, precise)**
1. If the best score is below `RECALL_THRESHOLD` (0.3), skip — nothing is relevant
2. Render the 10 candidates with timestamps and message chains
3. Include the last 3 recent turns as context for the reranker
4. LLM reads the candidates and summarizes what's relevant to the current query
5. Result: a concise memory summary

The summary is injected into the system prompt. The LLM sees it before reasoning about the current task.

The reranking call uses `useTools = false` — no tool schemas are sent, saving ~400 tokens.

### Why Search All Turns?

Recall searches the entire trace, not just turns outside the buffer. This eliminates the need for a preliminary scan to split turns into "buffered" vs "evicted" sets. The budget determines what's in the buffer. Recall is independent of the budget.

## Working Memory

Working memory is everything in the context window for a given API call.

### Assembly Order

`assembleWorkingMemory` runs these steps in order — each depends on the previous:

```
1. Load episodic trace (all turns)
2. Recall (searches all turns, produces summary)
3. Assemble system prompt (base + recalled memories)
4. Compute workingBudget (CONTEXT_WINDOW - MAX_TOKENS - TOOL_SCHEMA_TOKENS - systemTokens)
5. Fill turns buffer (newest first, up to workingBudget - inputTokens)
6. Flatten buffer into messages, append user input
```

Recall runs first because its output (the summary) goes into the system prompt, which affects the system prompt's token count, which affects the budget. Everything cascades.

### The Messages Array

```
[turn₁ messages][turn₂ messages][turn₃ messages][user input]
 ←──────────── turns buffer (evictable) ───────→ ← current →
                                                 bufferEnd
```

`bufferEnd` is the index where the turns buffer ends and the current turn begins. Everything before it can be evicted. Everything after it is protected.

`bufferTurnSizes` is an array tracking how many messages each buffered turn contributed. A turn with 3 tool calls is 7 messages. This lets eviction remove whole turns.

### Mid-Turn Eviction

During the agentic loop, tool results grow the messages array. Before every API call, `evictOldestTurns` checks the total:

```typescript
while (total > workingBudget && bufferTurnSizes.length > 0) {
  const turnSize = bufferTurnSizes.shift()!;
  // remove turnSize messages from the front
  bufferEnd -= turnSize;
}
```

**Whole turns only.** Never break a turn apart. Orphaned tool results without their tool_use blocks would break the API.

**Never touch the current turn.** Tool results are the ground truth the LLM is working with.

### Budget Math

```
workingBudget = CONTEXT_WINDOW - MAX_TOKENS - TOOL_SCHEMA_TOKENS - systemTokens
bufferBudget  = workingBudget - inputTokens
```

Every component is measured with `countTokens`. No magic constants, no estimates. The budget adapts automatically when the system prompt size changes (e.g., recalled memories are large or empty).

## Token Counting

Uses `js-tiktoken` with `cl100k_base` encoding:

```typescript
countTokens(text: string): number           // raw text
messageTokens(msg: Message): number         // single message (string or JSON content)
totalMessageTokens(messages: Message[]): number  // array of messages
turnTokens(turn: TraceTurn): number         // all messages in a turn
```

`TOOL_SCHEMA_TOKENS` is computed once at startup since the tool set doesn't change during a session.
