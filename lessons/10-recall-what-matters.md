# Lesson 10: Recall What Matters

We can find similar turns with cosine search. But similar isn't the same as relevant. We need the LLM to read the candidates and decide what's actually useful.

## Two-Stage Retrieval

**Stage 1: Vector search** — fast, approximate. Cosine similarity narrows thousands of turns to 10 candidates. Local computation, no API call.

**Stage 2: LLM reranking** — slow, precise. The LLM reads the 10 candidates with the current query and summarizes what's relevant. One API call, but accurate.

## Skip When Nothing Is Relevant

If the best cosine score is below a threshold, nothing is relevant. Skip the expensive reranking call:

```typescript
const RECALL_THRESHOLD = 0.3;

if (!scored.length || scored[0].score < RECALL_THRESHOLD) return "";
```

This saves an API call whenever the user's query has no relation to past work.

## The Recall Function

```typescript
async function recallMemories(query: string, allTurns: TraceTurn[]): Promise<string> {
  if (!allTurns.length || !allTurns.some((t) => t.embedding?.length > 0)) return "";

  const queryVec = await embed(query);
  const scored = allTurns
    .filter((t) => t.embedding?.length > 0)
    .map((turn) => ({ turn, score: cosineSimilarity(queryVec, turn.embedding) }))
    .sort((a, b) => b.score - a.score);

  if (!scored.length || scored[0].score < RECALL_THRESHOLD) return "";

  const candidates = scored.slice(0, 10).map((c) => c.turn);

  // Render each candidate with timestamp and full message chain
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
    false,  // no tools needed
  );

  return response.content[0].text.trim();
}
```

The reranking call uses `useTools = false` — it's text-in, text-out. No tool schemas needed, saving ~400 tokens. Add the parameter to `callLLM`:

```typescript
async function callLLM(messages: Message[], systemPrompt: string, useTools = true) {
  const body: any = { model: MODEL, max_tokens: MAX_TOKENS, system: systemPrompt, messages };
  if (useTools) body.tools = TOOL_SCHEMAS;
  // ...
}
```

## Inject Into the System Prompt

The recall returns a summary like:

> On April 8, you fixed a null check bug in app.ts on line 42. The issue was that `user.name` was accessed without checking if `user` existed.

Inject it into the system prompt so the LLM sees it before reasoning:

```typescript
const systemPrompt = recalledMemories
  ? `${baseSystemPrompt}\n\n${recalledMemories}`
  : baseSystemPrompt;
```

## Try It

Have a conversation. Quit. Have 20 more conversations about other things. Then ask about the first one. The agent recalls it — even though it's far outside the recent buffer.

## What We Have

Two-stage retrieval: fast vector search, then precise LLM reranking. Relevant memories from any point in history, injected into context. But we have all these pieces — token counting, episodic trace, embeddings, recall — running separately. They need to be orchestrated. The system prompt size affects the budget. Recall produces text that goes into the system prompt. The order matters. Let's tie it all together.
