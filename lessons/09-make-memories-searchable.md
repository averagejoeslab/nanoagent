# Lesson 9: Make Memories Searchable

You worked on a bug last week. 50 turns ago. It fell out of the buffer. You ask about it — the agent doesn't know. Recent memory works. Old memory is gone.

We need to search by *meaning*, not just recency.

## Embeddings

An **embedding** converts text into a vector — an array of 384 numbers. Texts about similar topics produce vectors that point in similar directions.

We use a local model that runs in-process — no API calls, no network:

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

## Cosine Similarity

Compare two embeddings by measuring the angle between them:

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
- Relevant turns typically score above 0.3

## Embed Each Turn When Saving

Extract the essence of a turn for embedding — the query, tool names, result snippets, and reasoning:

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

Tool results are clipped at 200 chars — embeddings capture the gist, not the raw data.

## Search the Trace

Given a query, find the most relevant past turns:

```typescript
const queryVec = await embed("fix the null check bug");

const scored = allTurns
  .filter((t) => t.embedding?.length > 0)
  .map((turn) => ({ turn, score: cosineSimilarity(queryVec, turn.embedding) }))
  .sort((a, b) => b.score - a.score);

const top10 = scored.slice(0, 10);
```

If the user asks about a bug they fixed last week, the embedding search finds that turn — even if it's far outside the recent buffer.

## What We Have

Every turn is saved with an embedding. The trace is searchable by meaning. But raw cosine scores are noisy — a turn about "fixing a bug in app.ts" and one about "fixing a bug in server.ts" might score similarly. We need the LLM to read the candidates and extract what actually matters.
