# Lesson 12: Token Budgeting and Memory Management

## The Problem You've Discovered

If you've been using your agent extensively since Lesson 11, you've probably noticed:

- Slower responses after many conversations
- Higher API costs
- Maybe even errors: "context length exceeded"

Let's understand why.

## What Are Tokens?

**Tokens** are how LLMs measure text. Roughly:
- 1 token ≈ 4 characters
- 1 token ≈ 0.75 words
- "Hello, world!" ≈ 4 tokens

**Why tokens matter:**
- LLMs have fixed context windows (e.g., 200k tokens for Claude Sonnet 4.5)
- API pricing is per token
- Processing time increases with token count

## Measuring Your Memory

Let's see how big your conversation history has become.

**Check your trace file:**
```bash
$ wc -l .nanoagent/trace.jsonl
247 .nanoagent/trace.jsonl
```

After 247 turns, how many tokens is that?

Without measurement, you don't know. Could be 50k tokens, could be 500k tokens.

## Installing Token Counting

We need a way to count tokens. Add `js-tiktoken` to your project:

```bash
bun add js-tiktoken
```

This library uses the same tokenizer as Claude (cl100k_base encoding).

## Adding Token Counting

Import tiktoken at the top:

```typescript
// ─── IMPORTS ─────────────────────────────────────────────────────────────────
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execSync } from "node:child_process";
import * as readline from "node:readline";
import { Tiktoken } from "js-tiktoken/lite";
import cl100k_base from "js-tiktoken/ranks/cl100k_base";
```

Create a token counter:

```typescript
// ─── MEMORY ──────────────────────────────────────────────────────────────────
const tokenizer = new Tiktoken(cl100k_base);

function countTokens(text: string): number {
  return tokenizer.encode(text).length;
}
```

## Setting a Memory Budget

Define how much memory you want to allocate:

```typescript
// ─── CONFIG ──────────────────────────────────────────────────────────────────
const CONTEXT_WINDOW = 200000; // Claude Sonnet 4.5's max
const SYSTEM_PROMPT_OVERHEAD = 500;
const MEMORY_BUDGET = CONTEXT_WINDOW - MAX_TOKENS - SYSTEM_PROMPT_OVERHEAD - 10000;
// Reserve 10k tokens for safety
```

**Breakdown:**
- `CONTEXT_WINDOW`: Total tokens Claude can handle (200k)
- `MAX_TOKENS`: Reserved for response (8192)
- `SYSTEM_PROMPT_OVERHEAD`: System prompt tokens (~500)
- `10000`: Safety buffer
- **Result**: ~181k tokens for conversation history

## Bounded Loading

Update `loadTrace()` to respect the budget:

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

1. **Load backwards**: Start from most recent turn
2. **Count tokens**: For each turn, count user + assistant tokens
3. **Check budget**: If adding this turn exceeds budget, stop
4. **Prepend**: Since we're going backwards, add to beginning of array
5. **Return stats**: Total turns in file, how many loaded, token count

## Display Memory Stats

Update `main()` to show what's happening:

```typescript
async function main() {
  console.log(`
${ANSI.bold}${ANSI.cyan}nanoagent${ANSI.reset}
${ANSI.dim}${MODEL}${ANSI.reset} | ${ANSI.dim}${process.cwd()}${ANSI.reset}
`);

  const { messages, stats } = await loadTrace();
  
  if (stats.loaded > 0) {
    console.log(`${ANSI.dim}Loaded ${stats.loaded}/${stats.total} turns (${stats.tokens.toLocaleString()} tokens)${ANSI.reset}`);
    if (stats.loaded < stats.total) {
      console.log(`${ANSI.dim}${stats.total - stats.loaded} older turns excluded to stay within memory budget${ANSI.reset}`);
    }
  }
  
  // ... rest of main
}
```

## Test It

**After 300 conversations:**

```
nanoagent
claude-sonnet-4-5 | /tmp/demo
Loaded 127/300 turns (180,421 tokens)
173 older turns excluded to stay within memory budget
```

Now you know:
- You have 300 total turns saved
- Only 127 fit in the budget
- They use 180k tokens
- 173 old turns are excluded

## What Happens to Old Turns?

**They're still saved**, just not loaded into working memory.

The trace file has all 300 turns. Your agent just doesn't load the oldest 173 into context because they don't fit.

**This is a sliding window:**
- Recent conversations: ✅ In memory
- Old conversations: ✅ Saved to disk, ❌ Not in active memory

## The Trade-off

**What you gain:**
- Fast responses (less context to process)
- Lower API costs (fewer input tokens)
- No context overflow errors
- Sustainable long-term use

**What you lose:**
- Agent doesn't remember conversations from weeks ago
- Can't reference very old work
- Limited by token budget

## When Budget Fills Up

After enough conversations, even your most recent turns will hit the budget:

```
Loaded 50/1000 turns (180,945 tokens)
950 older turns excluded to stay within memory budget
```

At this point, you're operating in a **fixed-size sliding window**.

## Is This Good Enough?

For many use cases, yes!

**Works well when:**
- Most work is short-term
- Recent context is what matters
- You don't need ancient history

**Limitations:**
- Can't remember conversation from last month
- Loses important information mixed with unimportant
- No semantic search (can't find "that time we fixed the bug")

## Advanced Memory Systems

This is where it gets interesting. Future directions:

1. **Importance filtering**: Keep important turns longer
2. **Semantic search**: Find relevant old conversations
3. **Consolidation**: Summarize old turns into facts
4. **Hybrid memory**: Short-term + long-term storage

We're not implementing those yet. This lesson is about understanding the constraints.

## What You've Built

Your agent now has:
- Token-aware memory management
- Bounded loading with budget
- Sliding window behavior
- Transparency (shows what's loaded)
- Sustainable long-term operation

## Measuring Success

Run your agent for a week. Check:

```bash
$ wc -l .nanoagent/trace.jsonl
1247 .nanoagent/trace.jsonl
```

```
Loaded 92/1247 turns (179,234 tokens)
```

**You have a working agent that:**
- Remembers recent context
- Doesn't crash from too much memory
- Operates within API limits
- Shows you exactly what's happening

## Next Steps

This concludes the core lessons. You've built a complete, production-ready agent with:

✅ Tool use
✅ ReAct loop
✅ Parallel execution
✅ Clean architecture
✅ Episodic memory
✅ Token-based budgeting

**Where to go from here:**

- Build domain-specific agents
- Add more tools
- Experiment with different memory strategies
- Implement importance scoring
- Add semantic search with embeddings
- Build consolidation systems

The foundation is solid. Now you can build anything.

---

**Key Takeaways:**
- Tokens are the unit of measurement for LLMs
- Context windows are finite (200k for Claude Sonnet 4.5)
- Token counting with tiktoken measures memory usage
- Sliding window: load recent turns that fit in budget
- Trade-off: speed/cost vs. total recall
- This approach is good enough for many use cases
- Advanced memory systems build on this foundation
