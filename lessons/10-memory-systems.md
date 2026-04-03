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
Session 1:
❯ Create a config.json with default settings
⏺ Created config.json

Session 2 (after restart):
❯ Update the debug flag in the config to true
⏺ What config? I don't remember creating one... ❌
```

**Support Agent:**
```
Session 1:
❯ Create ticket for customer John about billing issue
⏺ Created ticket #456

Session 2 (after restart):
❯ Update the billing ticket status to resolved
⏺ What ticket? I don't remember creating one... ❌
```

**Analytics Agent:**
```
Session 1:
❯ Create a sales report for Q1
⏺ Generated report saved as q1_sales.csv

Session 2 (after restart):
❯ Compare Q1 to Q2 sales
⏺ Where is the Q1 report? I don't remember... ❌
```

**DevOps Agent:**
```
Session 1:
❯ Deploy version 2.1.0 to staging
⏺ Deployed successfully

Session 2 (after restart):
❯ What version is in staging?
⏺ I don't know, I don't remember the deployment... ❌
```

**With memory, all these agents know their previous actions.**

## Two-Tier Memory Architecture

Agents need two types of memory:

**1. Episodic Memory (Persistent Storage)**
- Complete historical record of all interactions
- Stored permanently on disk
- Never deleted, always growing
- Source of truth

**2. Working Memory (Active Context)**
- Recent conversations currently in use
- Bounded by token limits
- Computed dynamically from episodic memory
- Slides as conversation grows

**Why separate them?**
- LLMs have limited context windows (200k tokens for Claude Sonnet 4.5)
- Loading all history would exceed limits
- Recent context is usually most relevant
- Old conversations preserved but not actively loaded

## Episodic Memory: Persistent Storage

### Storage Format: JSONL

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
      "text": "I've created hello.ts with a hello function"
    }
  ]
}
```

### Implementing Episodic Storage

Add memory functions to your agent:

```typescript
// ─── MEMORY ──────────────────────────────────────────────────────────────────
import { mkdir } from "node:fs/promises";
import { Tiktoken } from "js-tiktoken/lite";
import cl100k_base from "js-tiktoken/ranks/cl100k_base";

const TRACE_FILE = ".nanoagent/trace.jsonl";
const CONTEXT_WINDOW = 200000; // Claude Sonnet 4.5's max
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
```

**What this does:**
- `TRACE_FILE`: Where episodic memory is stored
- `MEMORY_BUDGET`: How many tokens we can load into working memory
- `tokenizer`: Counts tokens using Claude's encoding
- `saveToTrace()`: Appends each turn to the JSONL file

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

**Breakdown:**
- Start with 200k total
- Subtract 8k for agent's response
- Subtract 500 for system prompt
- Subtract 10k safety buffer
- **~181k tokens available for memory**

## Working Memory Buffer: Computed View

The working memory buffer is **computed on every turn** from episodic storage.

### Bounded Loading

```typescript
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
      
      // Count tokens for this turn
      const userTokens = countTokens(turn.user);
      const assistantTokens = countTokens(JSON.stringify(turn.assistant));
      const turnTokens = userTokens + assistantTokens;
      
      // Check if adding this turn would exceed budget
      if (tokens + turnTokens > MEMORY_BUDGET) {
        break; // Stop loading, we've hit the limit
      }
      
      // Add to beginning (since we're going backwards)
      messages.unshift({ role: "assistant", content: turn.assistant });
      messages.unshift({ role: "user", content: turn.user });
      tokens += turnTokens;
      loaded++;
    }
    
    return { 
      messages, 
      stats: { 
        total: lines.length, 
        loaded, 
        tokens 
      } 
    };
  } catch {
    return { 
      messages: [], 
      stats: { total: 0, loaded: 0, tokens: 0 } 
    };
  }
}
```

**How it works:**

1. **Read all turns** from trace.jsonl
2. **Start from newest** (end of file, working backwards)
3. **Count tokens** for each turn
4. **Check budget** before adding
5. **Stop when full** (can't fit more)
6. **Return bounded set** with stats

**Key insight:** This returns a **computed view**, not the full history.

## Sliding Window Mechanics

### The Critical Difference

**Traditional approach (wrong):**
```typescript
// On startup: load once
const { messages } = await loadTrace();

// During session: keep growing
while (true) {
  const input = await getUserInput();
  messages.push({ role: "user", content: input });
  await agenticLoop(messages, systemPrompt);
  await saveToTrace(...);
  // messages keeps growing unbounded!
}
```

**Our approach (correct):**
```typescript
// During session: recompute on EVERY turn
while (true) {
  const input = await getUserInput();
  
  // Recompute working buffer from episodic
  const { messages } = await loadTrace();
  
  messages.push({ role: "user", content: input });
  await agenticLoop(messages, systemPrompt);
  await saveToTrace(...);
  
  // Next turn: recompute again (window slides)
}
```

**Why this matters:**

**Without recomputation (wrong):**
- Turn 1: Load 50 turns from episodic
- Turn 100: Now have 150 turns in RAM (50 + 100 new)
- Turn 500: Now have 550 turns in RAM (exceeds limits!)

**With recomputation (correct):**
- Turn 1: Compute buffer → 50 recent turns
- Turn 100: Compute buffer → 50 recent turns (turns 51-100)
- Turn 500: Compute buffer → 50 recent turns (turns 451-500)
- **Window slides automatically!**

### Visual Example

**Episodic memory (trace.jsonl):**
```
Turn 1:   saved ✓
Turn 2:   saved ✓
...
Turn 100: saved ✓
Turn 101: saved ✓ (just added)
```

**Working memory (computed on turn 101):**
```
Budget allows ~50 turns
Load backwards from turn 101:
  Turn 101 ✓ (newest)
  Turn 100 ✓
  Turn 99  ✓
  ...
  Turn 52  ✓
  Turn 51  ✓
  Turn 50  ✗ (would exceed budget, stop here)
  
Loaded: turns 52-101 (50 turns)
Excluded: turns 1-51 (old, but still in trace.jsonl)
```

**Turn 102:**
```
Recompute buffer:
  Turn 102 ✓ (newest)
  Turn 101 ✓
  ...
  Turn 53  ✓
  Turn 52  ✗ (exceeds budget)
  
Loaded: turns 53-102 (50 turns)
Window slid forward by 1!
```

## The Complete Memory Flow

### Startup

```typescript
// Load initial state for display only
const initialLoad = await loadTrace();

if (initialLoad.stats.loaded > 0) {
  console.log(`Loaded ${initialLoad.stats.loaded}/${initialLoad.stats.total} turns (${initialLoad.stats.tokens.toLocaleString()} tokens)`);
  if (initialLoad.stats.loaded < initialLoad.stats.total) {
    console.log(`${initialLoad.stats.total - initialLoad.stats.loaded} older turns excluded to stay within memory budget`);
  }
}
```

**Output:**
```
nanoagent
claude-sonnet-4-5 | /tmp/demo
Loaded 127/300 turns (180,421 tokens)
173 older turns excluded to stay within memory budget
```

### Each Turn

```typescript
while (true) {
  const input = await getUserInput();
  
  // 1. Recompute working buffer from episodic trace
  const { messages } = await loadTrace();
  
  // 2. Add new user input to working buffer
  messages.push({ role: "user", content: input });
  
  // 3. Process with agent (bounded context)
  await agenticLoop(messages, systemPrompt);
  
  // 4. Save turn to episodic memory
  await saveToTrace({
    timestamp: new Date().toISOString(),
    user: input,
    assistant: messages[messages.length - 1].content,
  });
  
  // 5. Next iteration: recompute again (window slides)
}
```

**The flow:**
1. **Recompute** buffer from episodic (bounded)
2. **Add** new input to buffer
3. **Process** with LLM using bounded context
4. **Save** to episodic (grows unbounded)
5. **Repeat** (buffer recomputed fresh each time)

## Testing Memory

**Session 1:**
```
nanoagent
claude-sonnet-4-5 | /tmp/demo

❯ Create a file called memory-test.txt with "I remember this"

⏺ write(memory-test.txt)
  ⎿  ok

⏺ I've created memory-test.txt with your requested content

❯ /q
```

**Check what was saved:**
```bash
$ cat .nanoagent/trace.jsonl
{"timestamp":"2026-04-02T22:00:00.000Z","user":"Create a file called memory-test.txt with \"I remember this\"","assistant":[{"type":"tool_use",...},{"type":"text",...}]}
```

**Session 2 (after restart):**
```
nanoagent
claude-sonnet-4-5 | /tmp/demo
Loaded 1/1 turns (342 tokens)

❯ What file did I create last time?

⏺ You created a file called memory-test.txt with the content "I remember this"

❯ Read it to verify

⏺ read(memory-test.txt)
  ⎿  I remember this

⏺ The file contains: "I remember this"
```

**It works!** The agent remembers across sessions.

## Understanding the Stats

After extended use:

```bash
$ wc -l .nanoagent/trace.jsonl
847 .nanoagent/trace.jsonl
```

```
nanoagent
Loaded 92/847 turns (179,234 tokens)
755 older turns excluded to stay within memory budget
```

**What this tells you:**
- **847 total turns** saved in episodic memory
- **92 turns loaded** into working buffer
- **179k tokens** in working memory
- **755 turns excluded** (old, but preserved in trace.jsonl)

**Your agent operates in a sliding window of ~92 recent turns.**

## Memory Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│ EPISODIC MEMORY (Persistent)                                │
│ .nanoagent/trace.jsonl                                      │
│                                                             │
│ Turn 1    ──┐                                              │
│ Turn 2      │                                              │
│ ...         │ OLD (excluded from working buffer)           │
│ Turn 755  ──┘                                              │
│ Turn 756  ──┐                                              │
│ Turn 757    │                                              │
│ ...         │ RECENT (loaded into working buffer)          │
│ Turn 846    │                                              │
│ Turn 847  ──┘ (newest)                                     │
│                                                             │
│ All turns preserved forever                                │
└─────────────────────────────────────────────────────────────┘
                            ↓
              loadTrace() computes bounded view
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ WORKING MEMORY (Computed)                                   │
│ messages[] array                                            │
│                                                             │
│ Turn 756: { role: "user", content: "..." }                 │
│           { role: "assistant", content: [...] }             │
│ Turn 757: { role: "user", content: "..." }                 │
│           { role: "assistant", content: [...] }             │
│ ...                                                         │
│ Turn 847: { role: "user", content: "..." }                 │
│           { role: "assistant", content: [...] }             │
│                                                             │
│ 92 recent turns (179k tokens)                              │
│ Recomputed on every turn                                   │
└─────────────────────────────────────────────────────────────┘
```

## What You've Built

Your agent now has a complete memory system:

✅ **Episodic Memory**
- Persistent JSONL storage
- Complete historical record
- Never deleted, always growing
- Source of truth

✅ **Token Budgeting**
- Context window awareness
- Token counting
- Budget calculation
- Bounded loading

✅ **Working Memory Buffer**
- Computed view over episodic
- Loads recent turns within budget
- Recomputed on every turn
- Sliding window behavior

✅ **Universal Architecture**
- Works across all agent types
- Only stored content differs by domain
- Same memory patterns everywhere

## The Trade-offs

**What you gain:**
- ✅ Fast responses (less context to process)
- ✅ Lower API costs (fewer input tokens)
- ✅ No context overflow errors
- ✅ Sustainable long-term use
- ✅ Automatic memory management

**What you lose:**
- ❌ Can't reference very old conversations
- ❌ Fixed window size
- ❌ No semantic search across full history

**For most use cases, this is excellent.**

## When This Works Well

**Coding Agent:**
- Most work in current project
- Recent file changes most relevant
- Old refactorings less important

**Support Agent:**
- Recent tickets most critical
- Current customer context matters
- Old resolved tickets less relevant

**Analytics Agent:**
- Recent queries most valuable
- Current data trends matter
- Historical reports less needed

**DevOps Agent:**
- Recent deployments critical
- Current system state matters
- Old logs less relevant

## Advanced Memory (Future)

This is a solid foundation. Advanced topics build on this:

1. **Importance Filtering**
   - Keep critical turns longer
   - Evict less important turns first

2. **Semantic Search**
   - Find relevant old conversations
   - Embeddings + vector search

3. **Consolidation**
   - Summarize old turns into facts
   - Store in semantic memory

4. **Hybrid Systems**
   - Short-term (working buffer)
   - Long-term (semantic/procedural)

We won't implement those now. This lesson teaches the essential architecture.

## Next Steps

In the next lesson, we'll add production-grade security with Docker sandboxing.

---

**Key Takeaways:**
- **Two-tier architecture**: Episodic (persistent) + Working (computed)
- **Turn is atomic unit**: User input + all assistant responses
- **JSONL for episodic**: Append-only, one turn per line
- **Token budgeting**: Respect context window limits
- **Working buffer**: Recomputed on every turn from episodic
- **Sliding window**: Automatic, bounded by token budget
- **Universal pattern**: Same architecture across all domains
- **Complete but simple**: Production-ready memory system

You now have a memory system that scales to thousands of conversations while staying within LLM limits.
