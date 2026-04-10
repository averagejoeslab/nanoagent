# Lesson 7: Give It Memory

You restarted the agent. "What were we working on?" — nothing. It has no idea. Every session starts blank.

We need to save what happened and load it back.

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

Both are single turns. We save the whole chain — when loaded as history, the LLM sees exactly what happened: what it read, what it changed, what the result was.

## The Trace File

Store turns in a JSONL file (one JSON object per line) at `~/.nanoagent/trace.jsonl`:

```typescript
import { mkdir, appendFile } from "node:fs/promises";
import { homedir } from "node:os";

const TRACE_FILE = `${homedir()}/.nanoagent/trace.jsonl`;

type TraceTurn = {
  timestamp: string;
  messages: Message[];   // the full turn
  embedding: number[];   // for search (Lesson 9)
};
```

System-wide, not per-project. The agent has the same memory regardless of where you run it.

## Saving Turns

After each turn completes, save the full message chain:

```typescript
async function saveEpisode(messages: Message[]): Promise<void> {
  await mkdir(`${homedir()}/.nanoagent`, { recursive: true });
  const turn: TraceTurn = {
    timestamp: new Date().toISOString(),
    messages,
    embedding: [],  // we'll fill this in Lesson 9
  };
  await appendFile(TRACE_FILE, JSON.stringify(turn) + "\n");
}
```

Call it after the agentic loop:
```typescript
await agenticLoop(messages, systemPrompt);
await saveEpisode(messages);  // save the whole turn
```

## Loading History

On each new turn, load past turns and prepend them to the messages:

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

Load all turns and flatten them into the messages array:

```typescript
const allTurns = await loadEpisodicTrace();
const messages: Message[] = [];

for (const turn of allTurns) {
  messages.push(...turn.messages);
}

messages.push({ role: "user", content: input });
await agenticLoop(messages, systemPrompt);
await saveEpisode(messages.slice(/* just the current turn */));
```

## Try It

```
❯ Create a file called notes.txt with "Remember this"
⏺ write(notes.txt)
  ⎿  ok
⏺ Done.
```

Quit with `/q`. Restart.

```
❯ What did I ask you to do last time?
⏺ You asked me to create notes.txt with the content "Remember this".
```

It remembers. The trace file persists across sessions.

## The Problem With Loading Everything

This works. But keep using the agent. After 100 turns with file reads and tool results, the trace is huge. Load all of it and the API will reject the request — the context window is finite.

We need to understand that limit and work within it. That's next.
