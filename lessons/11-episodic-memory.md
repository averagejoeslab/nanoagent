# Lesson 11: Episodic Memory

## The Problem

Restart the agent and ask "What did we just work on?" — it has no idea. Every session starts blank. We need persistent memory.

## What Is a Turn?

A **turn** is one complete interaction: the user's input through all tool calls and results to the final response. Not just the final answer — the whole chain.

A simple turn (2 messages):
```
user: "What time is it?"
assistant: "I don't have a clock, but you can run `date`."
```

A complex turn (7 messages):
```
user: "Fix the bug in app.ts"
assistant: [tool_use: read "app.ts"]
user: [tool_result: file contents]
assistant: [tool_use: edit "app.ts", old, new]
user: [tool_result: "ok"]
assistant: [tool_use: bash "bun test"]
user: [tool_result: "All tests passed"]
assistant: "Fixed the null check on line 42. Tests pass."
```

Both are single turns. The whole chain matters — when this turn is loaded as history, the LLM sees exactly what happened: what it read, what it changed, what the result was.

## The Trace File

We store turns in a JSONL file (one JSON object per line):

```typescript
type TraceTurn = {
  timestamp: string;
  messages: Message[];  // the full turn
  embedding: number[];  // for search (Lesson 12)
};
```

Each line in `~/.nanoagent/trace.jsonl` is a complete episode of the agent's experience.

## Saving Episodes

After each turn completes, save the full message chain:

```typescript
import { mkdir, appendFile } from "node:fs/promises";
import { homedir } from "node:os";

const TRACE_FILE = `${homedir()}/.nanoagent/trace.jsonl`;

async function saveEpisode(messages: Message[]): Promise<void> {
  await mkdir(`${homedir()}/.nanoagent`, { recursive: true });
  const turn: TraceTurn = {
    timestamp: new Date().toISOString(),
    messages,
    embedding: [],  // we'll fill this in Lesson 12
  };
  await appendFile(TRACE_FILE, JSON.stringify(turn) + "\n");
}
```

Call it after the agentic loop with the current turn's messages:

```typescript
// In main, after agenticLoop completes:
await saveEpisode(messages.slice(bufferEnd));
//                 ^^^^^^^^^^^^^^^^^^^^^^^^
//                 just the current turn, not loaded history
```

## Loading the Trace

```typescript
async function loadEpisodicTrace(): Promise<TraceTurn[]> {
  try {
    const content = await readFile(TRACE_FILE, "utf-8");
    return content.trim().split("\n").map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}
```

## Measuring Turn Size

Each turn consumes tokens when loaded into context. Measure it:

```typescript
function turnTokens(turn: TraceTurn): number {
  return turn.messages.reduce((sum, msg) => sum + messageTokens(msg), 0);
}
```

## Loading History Into Context

Load recent turns into the messages array, newest first, up to the budget:

```typescript
const allTurns = await loadEpisodicTrace();
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

// Flatten into messages
const messages: Message[] = [];
for (const turn of bufferTurns) {
  messages.push(...turn.messages);
}

// Append current user input
messages.push({ role: "user", content: input });
```

Recent turns that fit in the budget are loaded as full conversation history. Older turns that don't fit are excluded — for now. In Lesson 13, we'll add semantic recall to retrieve relevant old turns even when they don't fit in the buffer.

## System-Wide Memory

The trace lives at `~/.nanoagent/trace.jsonl` — not in the project directory. This means the agent has the same memory regardless of where you run it from. It remembers past sessions, past projects, past conversations.

## Next Steps

We can save and load turns, but old turns that fall outside the buffer are gone. We need a way to search them by meaning. That requires embeddings.

---

**Key Takeaways:**
- A turn is the complete message chain — user input through all tool calls to final response
- Save whole turns, not just the final answer. The tool chain is valuable context.
- JSONL format: one `TraceTurn` per line with timestamp, messages, and embedding
- Load recent turns newest-first up to the token budget
- System-wide trace at `~/.nanoagent/trace.jsonl` — memory across sessions and projects
