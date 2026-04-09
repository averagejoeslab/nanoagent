# Lesson 12: Make Memories Searchable

## The Problem

We can load recent turns into context. But what about older turns that don't fit? If you worked on a bug last week and encounter the same bug today, the agent has no way to find that relevant episode. Recency isn't relevance.

## Embeddings

An **embedding** converts text into a vector — an array of numbers (384 dimensions in our case). Texts about similar topics produce vectors that point in similar directions.

We use a local embedding model that runs in-process — no API calls, no network:

```bash
bun add @xenova/transformers
```

```typescript
import { pipeline } from '@xenova/transformers';

let embedder: any = null;

async function initializeEmbedder(): Promise<void> {
  if (!embedder) {
    console.log("Loading embedding model...");
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
}

async function embed(text: string): Promise<number[]> {
  const output = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}
```

`embed("fix the null check bug")` → `[0.032, -0.118, 0.045, ...]` (384 numbers)

## Cosine Similarity

To compare two embeddings, compute the cosine of the angle between them:

```typescript
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
```

- `1.0` = identical meaning
- `0.0` = unrelated
- `-1.0` = opposite meaning

In practice, relevant turns score above 0.3; highly relevant above 0.6.

## Embedding Each Episode

When saving a turn, generate an embedding from its content:

```typescript
function turnTextForEmbedding(messages: Message[]): string {
  return messages.map((msg) => {
    if (typeof msg.content === "string") return msg.content;
    return (msg.content as any[]).map((b) => {
      if (b.type === "text") return b.text;
      if (b.type === "tool_use") return `[${b.name}: ${JSON.stringify(b.input).slice(0, 100)}]`;
      if (b.type === "tool_result") return typeof b.content === "string" ? b.content.slice(0, 200) : "";
      return "";
    }).filter(Boolean).join("\n");
  }).join("\n");
}

async function saveEpisode(messages: Message[]): Promise<void> {
  await mkdir(`${homedir()}/.nanoagent`, { recursive: true });
  const embedding = await embed(turnTextForEmbedding(messages));
  const turn: TraceTurn = { timestamp: new Date().toISOString(), messages, embedding };
  await appendFile(TRACE_FILE, JSON.stringify(turn) + "\n");
}
```

`turnTextForEmbedding` captures the essence of the turn: the user's query, which tools were used, what the inputs were, snippets of results, and the assistant's reasoning. Tool results are clipped at 200 chars — embeddings work best on the gist, not the raw data.

## Searching the Trace

Given a query, find the most relevant past episodes:

```typescript
const queryVec = await embed("fix the null check bug");

const scored = allTurns
  .filter((t) => t.embedding)
  .map((turn) => ({ turn, score: cosineSimilarity(queryVec, turn.embedding) }))
  .sort((a, b) => b.score - a.score);

// Top 10 most relevant
const candidates = scored.slice(0, 10);
```

If the user asks about a bug they fixed last week, the embedding search finds that episode — even if it's thousands of turns old and far outside the recent buffer.

## Next Steps

We can find relevant episodes. But raw cosine scores are noisy. We need the LLM to read the candidates and extract what's actually useful. That's recall.

---

**Key Takeaways:**
- Embeddings convert text to vectors. Similar text → similar vectors.
- `Xenova/all-MiniLM-L6-v2` runs locally — no API calls needed
- Cosine similarity measures relevance between 0 (unrelated) and 1 (identical)
- Each episode gets an embedding when saved, computed from the full turn content
- Vector search finds relevant episodes regardless of how old they are
