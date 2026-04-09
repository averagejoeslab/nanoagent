# Lesson 13: Recall What Matters

## The Problem

We can find similar episodes with cosine search. But similarity isn't the same as relevance. A turn about "fixing a bug in app.ts" and a turn about "fixing a bug in server.ts" might score similarly — but only one is relevant if the user is asking about app.ts.

We need the LLM to read the candidates and extract what actually matters.

## Two-Stage Retrieval

**Stage 1: Vector search** — fast, approximate. Cosine similarity narrows thousands of episodes to 10 candidates. Cheap (local computation, no API call).

**Stage 2: LLM reranking** — slow, precise. The LLM reads the 10 candidates and summarizes what's relevant to the current query. Expensive (API call) but accurate.

## Similarity Threshold

If no candidates are relevant, skip the expensive reranking call entirely:

```typescript
const RECALL_THRESHOLD = 0.3;

const scored = allTurns
  .filter((t) => t.embedding)
  .map((turn) => ({ turn, score: cosineSimilarity(queryVec, turn.embedding) }))
  .sort((a, b) => b.score - a.score);

// If the best match is below threshold, nothing is relevant
if (!scored.length || scored[0].score < RECALL_THRESHOLD) return "";
```

This saves an API call on turns where the user's query has no relation to past work.

## LLM Reranking

Send the top 10 candidates to the LLM with the current query. The LLM reads the full turns (with timestamps, tool usage, and results) and returns a concise summary:

```typescript
async function recallMemories(query: string, allTurns: TraceTurn[]): Promise<string> {
  if (!allTurns.length || !allTurns.some((t) => t.embedding)) return "";

  const queryVec = await embed(query);
  const scored = allTurns
    .filter((t) => t.embedding)
    .map((turn) => ({ turn, score: cosineSimilarity(queryVec, turn.embedding) }))
    .sort((a, b) => b.score - a.score);

  if (!scored.length || scored[0].score < RECALL_THRESHOLD) return "";

  const candidates = scored.slice(0, 10).map((c) => c.turn);

  // Render each candidate with timestamps and tool usage
  const candidatesText = candidates
    .map((turn, idx) => {
      const date = new Date(turn.timestamp).toLocaleString();
      const summary = turn.messages.map((msg) => {
        const role = msg.role === "user" ? "User" : "Assistant";
        if (typeof msg.content === "string") return `${role}: ${msg.content}`;
        return `${role}: ${(msg.content as any[]).map((b) => {
          if (b.type === "text") return b.text;
          if (b.type === "tool_use") return `[Used tool: ${b.name}]`;
          if (b.type === "tool_result") return `[Tool result: ${
            typeof b.content === "string" ? b.content.slice(0, 200) : "..."
          }]`;
          return "";
        }).filter(Boolean).join("\n")}`;
      }).join("\n");
      return `[Turn ${idx}] ${date}\n${summary}`;
    })
    .join("\n\n---\n\n");

  const response = await callLLM(
    [{ role: "user", content: `You are extracting relevant memories for a coding assistant.

Current user query: "${query}"

Here are candidate memories from past conversations:

${candidatesText}

Extract and summarize the relevant information. Return a concise memory summary.` }],
    "You extract and summarize relevant information from past conversations.",
    false,  // no tools needed for reranking
  );

  return response.content[0].text.trim();
}
```

Notice `useTools = false` — the reranking call is text-in, text-out. No tool schemas needed, saving ~400 tokens.

## Recent Context

The reranker works better when it understands the current conversation flow. Pass the last 3 turns as context so it can judge relevance in context, not in isolation:

```typescript
async function recallMemories(
  query: string,
  allTurns: TraceTurn[],
  recentTurns: TraceTurn[] = [],
): Promise<string> {
  // ... vector search ...

  // Add recent context to the reranking prompt
  const recentContext = recentTurns.length > 0
    ? recentTurns.map((turn) => /* render turn */).join("\n\n---\n\n")
    : "";

  const contextSection = recentContext
    ? `Recent conversation context (last 3 turns):\n\n${recentContext}\n\n---\n\n`
    : "";

  // Include in prompt:
  // `${contextSection}Current user query: "${query}"`
}
```

## What Recall Returns

A concise summary injected into the system prompt:

```
## What I remember from earlier:

On April 8, you fixed a null check bug in app.ts on line 42. The issue was
that `user.name` was accessed without checking if `user` existed. You also
added a test case for this in app.test.ts.
```

The LLM sees this as context before it starts reasoning about the current task.

## Next Steps

We have all the pieces: token counting, episodic trace, embeddings, and recall. Now we need to orchestrate them into a single working memory system that manages the context window end to end.

---

**Key Takeaways:**
- Two-stage retrieval: fast vector search, then precise LLM reranking
- Similarity threshold skips the expensive reranking when nothing is relevant
- The reranker reads full turns (timestamps, tools, results) and summarizes what matters
- Recent conversation context helps the reranker judge relevance
- `useTools = false` saves tokens on the reranking call
- Result is a concise summary injected into the system prompt
