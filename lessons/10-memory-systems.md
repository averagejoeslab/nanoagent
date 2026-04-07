# Lesson 10: Memory Systems

## The Problem

Try this with your current agent:

```
❯ Create a file called notes.txt with "Important info"
⏺ I've created notes.txt

❯ /q
```

Now restart and try:

```
❯ What did I just ask you to do?
⏺ I don't have any previous context...
```

Your agent has **no memory** between sessions. Every restart is a blank slate.

## Why Agents Need Memory

Without memory, agents can't:
- Reference previous work
- Build on past conversations
- Learn from history
- Maintain context across sessions

**This problem is universal across all domains.**

### Memory Examples by Domain

**Coding Agent:**
```
Session 1: Create config.json with defaults
Session 2 (restart): Update debug flag in config
❌ What config? I don't remember...
```

**Support Agent:**
```
Session 1: Create ticket #456 for John's billing issue
Session 2 (restart): Update ticket status to resolved
❌ What ticket? I don't remember...
```

**Analytics Agent:**
```
Session 1: Generate Q1 sales report
Session 2 (restart): Compare Q1 to Q2
❌ Where is Q1 report? I don't remember...
```

**With memory, all these agents know their previous actions.**

---

# Part 1: Basic Memory (Get It Working)

## Storage: JSONL Trace File

**JSONL** (JSON Lines) is perfect for append-only logs. Each line is a complete turn:

```jsonl
{"timestamp":"2026-03-31T00:00:00Z","user":"Create hello.ts","assistant":[...]}
{"timestamp":"2026-03-31T00:01:00Z","user":"Read it back","assistant":[...]}
```

**Why JSONL?**
- Append-only (fast writes)
- Each line is independent (easy to read/skip)
- No need to parse entire file
- Works identically across all domains

### The Turn: Atomic Unit

A **turn** is one complete exchange:
- User input (one message)
- All assistant responses until next user input
  - Text blocks
  - Tool calls
  - Tool results
  - Final response

**Example turn:**
```json
{
  "timestamp": "2026-03-31T05:30:00.000Z",
  "user": "Create hello.ts",
  "assistant": [
    {
      "type": "tool_use",
      "id": "toolu_abc123",
      "name": "write",
      "input": {"path": "hello.ts", "content": "..."}
    },
    {
      "type": "text",
      "text": "I've created hello.ts"
    }
  ]
}
```

## Token Budgeting: Understanding Limits

### What Are Tokens?

**Tokens** are how LLMs measure text. Roughly:
- 1 token ≈ 4 characters
- 1 token ≈ 0.75 words
- "Hello, world!" ≈ 4 tokens

**Why tokens matter:**
- LLMs have fixed context windows (200k for Claude Sonnet 4.5)
- API pricing is per token
- Processing time increases with token count
- **You must stay within limits**

### Calculating the Budget

```typescript
const CONTEXT_WINDOW = 200000;        // Claude's maximum
const MAX_TOKENS = 8192;              // Reserved for response
const SYSTEM_PROMPT_OVERHEAD = 500;   // System prompt
const SAFETY_BUFFER = 10000;          // Extra headroom

const MEMORY_BUDGET = CONTEXT_WINDOW - MAX_TOKENS - SYSTEM_PROMPT_OVERHEAD - SAFETY_BUFFER;
// Result: ~181,300 tokens for conversation history
```

## Implementing Basic Memory

Add memory functions to your agent:

```typescript
// ─── MEMORY ──────────────────────────────────────────────────────────────────
import { mkdir } from "node:fs/promises";
import { Tiktoken } from "js-tiktoken/lite";
import cl100k_base from "js-tiktoken/ranks/cl100k_base";

const TRACE_FILE = ".nanoagent/trace.jsonl";
const CONTEXT_WINDOW = 200000;
const SYSTEM_PROMPT_OVERHEAD = 500;
const MEMORY_BUDGET = CONTEXT_WINDOW - MAX_TOKENS - SYSTEM_PROMPT_OVERHEAD - 10000;

const tokenizer = new Tiktoken(cl100k_base);

function countTokens(text: string): number {
  return tokenizer.encode(text).length;
}

async function saveToTrace(turn: { 
  timestamp: string; 
  user: string; 
  assistant: any 
}) {
  await mkdir(".nanoagent", { recursive: true });
  const line = JSON.stringify(turn) + "\n";
  await Bun.write(TRACE_FILE, line, { append: true });
}

async function loadTrace(): Promise<{ 
  messages: Message[]; 
  stats: { total: number; loaded: number; tokens: number } 
}> {
  try {
    const content = await readFile(TRACE_FILE, "utf-8");
    const lines = content.trim().split("\n");
    
    const messages: Message[] = [];
    let tokens = 0;
    let loaded = 0;
    
    // Load from most recent backwards until budget exceeded
    for (let i = lines.length - 1; i >= 0; i--) {
      const turn = JSON.parse(lines[i]);
      
      const userTokens = countTokens(turn.user);
      const assistantTokens = countTokens(JSON.stringify(turn.assistant));
      const turnTokens = userTokens + assistantTokens;
      
      if (tokens + turnTokens > MEMORY_BUDGET) break;
      
      messages.unshift({ role: "assistant", content: turn.assistant });
      messages.unshift({ role: "user", content: turn.user });
      tokens += turnTokens;
      loaded++;
    }
    
    return { messages, stats: { total: lines.length, loaded, tokens } };
  } catch {
    return { messages: [], stats: { total: 0, loaded: 0, tokens: 0 } };
  }
}
```

## The Sliding Window

**Critical:** Recompute the buffer on **every turn**, not once at startup.

```typescript
// REPL loop
while (true) {
  const input = await getUserInput();
  
  // Recompute working buffer from episodic trace
  const { messages } = await loadTrace();
  
  messages.push({ role: "user", content: input });
  await agenticLoop(messages, systemPrompt);
  
  await saveToTrace({
    timestamp: new Date().toISOString(),
    user: input,
    assistant: messages[messages.length - 1].content,
  });
}
```

**Why recompute?**
- Turn 1: Load 50 recent turns
- Turn 100: Recompute → still 50 recent turns (window slid forward)
- Without recompute: Would grow to 150 turns (50 + 100 new)

## Testing Basic Memory

**Session 1:**
```
❯ Create memory-test.txt with "I remember this"
⏺ Created memory-test.txt

❯ /q
```

**Session 2 (restart):**
```
nanoagent
Loaded 1/1 turns (342 tokens)

❯ What file did I create last time?
⏺ You created memory-test.txt with "I remember this"
```

**It works!** The agent remembers across sessions.

---

# Part 2: The Limitation

## When Simple Memory Breaks

Your basic memory works great... until it doesn't.

**Problem scenario:**

```
Turn 1:
❯ The database is PostgreSQL on port 5433
⏺ Got it, I'll remember that

Turn 2-99:
❯ [Various other work...]

Turn 100:
❯ What database are we using and what port?
⏺ I don't have that information...
```

**What happened?**

The working buffer holds ~50 recent turns (within token budget). Turn 1 fell out of the window. The agent can only see turns 51-100.

## The Core Problem

**Recency ≠ Relevance**

- Simple memory loads **recent** turns
- But you often need **relevant** turns
- Important info from Turn 1 is gone by Turn 100

**Examples where this breaks:**

**Coding:**
- Turn 5: "API key is in .env as OPENAI_KEY"
- Turn 200: "What's the API key variable name?"
- ❌ Can't access Turn 5

**Support:**
- Turn 10: "Customer prefers email over phone"
- Turn 150: "How should I contact this customer?"
- ❌ Can't access Turn 10

**Analytics:**
- Turn 1: "Revenue target is $50k"
- Turn 80: "Are we on track for target?"
- ❌ Can't access Turn 1

## What We Need

**Search by meaning, not by position.**

We need to:
1. Keep ALL turns in storage (we do this - trace.jsonl)
2. Find relevant old turns by semantic similarity
3. Surface them alongside recent turns

This is **semantic search** + **episodic recall**.

---

# Part 3: Semantic Memory Upgrade

## Dual Memory Architecture

Instead of one memory system, we'll have two:

**1. Working Buffer (Recent Context)**
- Recent turns that fit in token budget
- Loaded chronologically (newest first)
- Always present (provides conversation continuity)
- Goes in `messages` array

**2. Episodic Recall (Relevant Context)**
- Old turns beyond the buffer
- Loaded by semantic search (relevance)
- Only when needed (query-driven)
- Goes in `system prompt` as background knowledge

**Why separate them?**
- Working buffer: Maintains conversation flow
- Episodic recall: Retrieves relevant old facts
- Together: Best of both worlds

## Adding Embeddings

First, install the Anthropic SDK:

```bash
bun add @anthropic-ai/sdk
```

Add to your imports:

```typescript
import Anthropic from "@anthropic-ai/sdk";
```

Add embedding functions:

```typescript
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function embed(text: string): Promise<number[]> {
  const response = await anthropic.embeddings.create({
    model: "voyage-3",
    input: text,
  });
  return response.data[0].embedding;
}

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

**What are embeddings?**
- Vector representations of text (~1024 numbers)
- Similar text → similar vectors
- Enables semantic search by comparing vectors

## Update saveToTrace

Generate embeddings when saving:

```typescript
async function saveToTrace(turn: { timestamp: string; user: string; assistant: any }) {
  await mkdir(".nanoagent", { recursive: true });
  
  // Generate embedding for the turn
  const text = turn.user + ' ' + JSON.stringify(turn.assistant);
  const embedding = await embed(text);
  
  const line = JSON.stringify({ ...turn, embedding }) + "\n";
  await Bun.write(TRACE_FILE, line, { append: true });
}
```

Now each turn in trace.jsonl includes its embedding:

```json
{
  "timestamp": "2026-03-31T05:30:00Z",
  "user": "Database is PostgreSQL on port 5433",
  "assistant": [...],
  "embedding": [0.123, -0.456, 0.789, ...]
}
```

## Two-Stage Retrieval

Add the recall function:

```typescript
async function recallMemories(query: string, evictedTurns: any[]): Promise<string> {
  if (!evictedTurns.length || !evictedTurns.some((t) => t.embedding)) {
    return "";
  }

  // Stage 1: Semantic search for top candidates
  const queryVec = await embed(query);
  const K = 10;

  const candidates = evictedTurns
    .filter((t) => t.embedding)
    .map((turn) => ({
      turn,
      score: cosineSimilarity(queryVec, turn.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, K)
    .map((c) => c.turn);

  if (!candidates.length) return "";

  // Stage 2: LLM rerank and summarize
  const candidatesText = candidates
    .map((turn, idx) => {
      const date = new Date(turn.timestamp).toLocaleString();
      let assistantText = "";
      if (typeof turn.assistant === "string") {
        assistantText = turn.assistant;
      } else if (Array.isArray(turn.assistant)) {
        assistantText = turn.assistant
          .map((block: any) => {
            if (block.type === "text") return block.text;
            if (block.type === "tool_use") return `[Used tool: ${block.name}]`;
            return "";
          })
          .filter(Boolean)
          .join("\n");
      }

      return `[Turn ${idx}] ${date}\nUser: ${turn.user}\nAssistant: ${assistantText}`;
    })
    .join("\n\n---\n\n");

  const rerankPrompt = `You are extracting relevant memories for a coding assistant.

Current user query: "${query}"

Here are candidate memories from past conversations (full turns with context):

${candidatesText}

Your task:
1. Identify which turns contain information relevant to the current query
2. Extract and summarize the key information from those relevant turns
3. Return a concise memory summary that would help answer the query

Return format:
## What I remember from earlier:

[One paragraph or a few bullet points summarizing the relevant information, with dates when important]

Do NOT return turn indices. Return the actual relevant information extracted and summarized from the turns.`;

  const response = await callLLM(
    [{ role: "user", content: rerankPrompt }],
    "You extract and summarize relevant information from past conversations."
  );

  return response.content[0].text.trim();
}
```

**How it works:**

1. **Stage 1: Vector Search (Fast, Broad)**
   - Embed the query
   - Compare to all evicted turn embeddings
   - Get top 10 by cosine similarity
   - ~100ms, cheap

2. **Stage 2: LLM Rerank (Accurate, Focused)**
   - Send 10 candidates to LLM with full context
   - LLM analyzes and summarizes relevant info
   - Returns concise memory summary
   - ~1-2s, ~$0.006

## Update loadTrace

Now returns both working buffer and recalled memories:

```typescript
async function loadTrace(currentQuery?: string): Promise<{ 
  messages: Message[]; 
  recalledMemories: string; 
  stats: { total: number; loaded: number; tokens: number } 
}> {
  try {
    const content = await readFile(TRACE_FILE, "utf-8");
    const lines = content.trim().split("\n");
    const allTurns = lines.map((line) => JSON.parse(line));

    // Part 1: Working memory buffer (recent turns)
    const messages: Message[] = [];
    let tokens = 0;
    let loaded = 0;

    for (let i = allTurns.length - 1; i >= 0; i--) {
      const turn = allTurns[i];
      const userTokens = countTokens(turn.user);
      const assistantTokens = countTokens(JSON.stringify(turn.assistant));
      const turnTokens = userTokens + assistantTokens;

      if (tokens + turnTokens > MEMORY_BUDGET) break;

      messages.unshift({ role: "assistant", content: turn.assistant });
      messages.unshift({ role: "user", content: turn.user });
      tokens += turnTokens;
      loaded++;
    }

    // Get indices of buffered turns
    const bufferIndices = new Set(
      Array.from({ length: loaded }, (_, i) => allTurns.length - loaded + i)
    );

    // Part 2: Episodic recall (evicted turns via semantic search)
    const evictedTurns = allTurns.filter((_, idx) => !bufferIndices.has(idx));
    const recalledMemories = currentQuery
      ? await recallMemories(currentQuery, evictedTurns)
      : "";

    return {
      messages,
      recalledMemories,
      stats: {
        total: allTurns.length,
        loaded,
        tokens,
      },
    };
  } catch {
    return {
      messages: [],
      recalledMemories: "",
      stats: { total: 0, loaded: 0, tokens: 0 },
    };
  }
}
```

## System Prompt Injection

**Key decision:** Recalled memories go in the **system prompt**, not the conversation history.

**Why?**
- System prompt = background knowledge
- Conversation history = dialog flow
- Mixing them confuses temporal context

**In one-off mode:**

```typescript
if (oneOffPrompt) {
  const { messages, recalledMemories } = await loadTrace(oneOffPrompt);
  
  const systemPrompt = `Concise coding assistant. cwd: ${process.cwd()}

${recalledMemories}`;
  
  messages.push({ role: "user", content: oneOffPrompt });
  await agenticLoop(messages, systemPrompt);
  
  await saveToTrace({
    timestamp: new Date().toISOString(),
    user: oneOffPrompt,
    assistant: messages[messages.length - 1].content,
  });
}
```

**In REPL mode:**

```typescript
while (true) {
  const input = await getUserInput();
  
  const { messages, recalledMemories } = await loadTrace(input);
  
  const systemPromptWithMemories = `${systemPrompt}

${recalledMemories}`;
  
  messages.push({ role: "user", content: input });
  await agenticLoop(messages, systemPromptWithMemories);
  
  await saveToTrace({
    timestamp: new Date().toISOString(),
    user: input,
    assistant: messages[messages.length - 1].content,
  });
}
```

## Testing Semantic Memory

**Session 1:**
```
❯ The database is PostgreSQL on port 5433 with connection pool size 10
⏺ Got it, I've noted that information
```

**Sessions 2-100:**
```
❯ [Various other work creating 99 more turns...]
```

**Session 101:**
```
❯ What's our database configuration?

[Behind the scenes:]
1. Working buffer: Loads turns 52-101 (recent 50)
2. Semantic search: Queries evicted turns 1-51
3. Finds Turn 1 (high similarity to "database configuration")
4. LLM summarizes: "The database is PostgreSQL on port 5433 with connection pool size 10"
5. Injects into system prompt

⏺ The database is PostgreSQL running on port 5433 with a connection pool size of 10
```

**It works!** The agent found relevant info from 100 turns ago.

---

# Summary: What You've Built

## Hybrid Memory System

Your agent now has two complementary memory systems:

**Working Memory Buffer:**
- ✅ Recent conversation context
- ✅ Fast (no search needed)
- ✅ Maintains conversation flow
- ✅ Bounded by token budget (~50 turns)

**Episodic Recall:**
- ✅ Semantic search over old turns
- ✅ Finds relevant info by meaning
- ✅ LLM summarizes for clarity
- ✅ Only runs when needed (query-driven)

**Together:**
- ✅ Conversation continuity (working buffer)
- ✅ Long-term factual recall (semantic search)
- ✅ Best of both worlds

## When Each System Activates

**Working buffer:** Always
- Loads on every turn
- Provides recent context
- No API calls needed

**Episodic recall:** When queried
- Only if `currentQuery` provided
- Searches evicted turns
- ~$0.006 per recall

## Cost & Performance

**Per turn:**
- Embedding generation: ~$0.0001
- Storage: Free (local JSONL)

**Per recall:**
- Embedding query: ~$0.0001
- LLM rerank + summary: ~$0.006
- **Total: ~$0.006 per semantic recall**

**For 1000 turns with 100 recalls: ~$0.70**

Very affordable for powerful semantic memory.

## Trade-offs

**What you gain:**
- ✅ Semantic recall (find relevant old info)
- ✅ Scales beyond context window
- ✅ LLM-generated summaries (concise)
- ✅ Hybrid approach (recent + relevant)

**What you lose:**
- ❌ Small cost per recall (~$0.006)
- ❌ Latency for semantic search (~1-2s)
- ❌ Requires embeddings API

**For most production use cases, totally worth it.**

## When to Use This

**Use semantic recall when:**
- Long-running projects (>100 turns)
- Important facts scattered across history
- Users ask about old context
- Domain requires long-term memory

**Stick with simple recency when:**
- Short sessions (<50 turns)
- All relevant info is recent
- Cost-sensitive use case
- Latency-critical application

## Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│ EPISODIC MEMORY (Persistent)                    │
│ .nanoagent/trace.jsonl                          │
│                                                 │
│ Turn 1   ──┐                                   │
│ Turn 2     │ EVICTED (semantic search)         │
│ ...        │                                    │
│ Turn 51  ──┘                                   │
│ Turn 52  ──┐                                   │
│ Turn 53    │ BUFFERED (working memory)         │
│ ...        │                                    │
│ Turn 100   │                                    │
│ Turn 101 ──┘ (newest)                          │
│                                                 │
│ Each turn includes embedding                    │
└─────────────────────────────────────────────────┘
                     ↓
         loadTrace(currentQuery)
                     ↓
    ┌────────────────┴────────────────┐
    │                                 │
    ↓                                 ↓
┌─────────────────┐      ┌──────────────────────┐
│ Working Buffer  │      │ Episodic Recall      │
│ (messages)      │      │ (recalledMemories)   │
│                 │      │                      │
│ Turns 52-101    │      │ Semantic search      │
│ Recent 50 turns │      │ → Top 10 by vector   │
│ Chronological   │      │ → LLM summarize      │
│                 │      │ → Inject to prompt   │
└─────────────────┘      └──────────────────────┘
         ↓                          ↓
    messages array          system prompt
         └──────────┬───────────────┘
                    ↓
              agenticLoop()
```

## Next Steps

In Lesson 11, we'll add production-grade security with Docker sandboxing.

---

**Key Takeaways:**

- **Start simple**: Basic recency window works great initially
- **Upgrade when needed**: Add semantic search as you scale
- **Dual architecture**: Working buffer + episodic recall
- **Two-stage retrieval**: Fast vector search + accurate LLM rerank
- **System prompt injection**: Background knowledge, not conversation
- **Cost effective**: ~$0.006 per recall for powerful semantic memory
- **Universal pattern**: Works across all agent types

You now have a production-grade memory system that scales from 10 turns to 10,000 turns while maintaining both recent context and semantic recall of relevant history.
