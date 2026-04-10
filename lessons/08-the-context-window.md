# Lesson 8: The Context Window

You've been using the agent for a while. Lots of turns in the trace. You load all of them. The API returns an error — the input is too large.

Every API call has a size limit: the **context window** (200,000 tokens for Claude Sonnet). Everything you send — system prompt, tool schemas, messages — has to fit inside it.

## What Are Tokens?

Tokens are how LLMs measure text. A token is roughly 4 characters or ¾ of a word. "Hello world" is 2 tokens. A 1000-line source file might be 10,000 tokens.

We need to count them accurately. Install `js-tiktoken`:

```bash
bun add js-tiktoken
```

```typescript
import { Tiktoken } from "js-tiktoken/lite";
import cl100k_base from "js-tiktoken/ranks/cl100k_base";

const tokenizer = new Tiktoken(cl100k_base);

function countTokens(text: string): number {
  return tokenizer.encode(text).length;
}

function messageTokens(msg: Message): number {
  return countTokens(
    typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)
  );
}

function totalMessageTokens(messages: Message[]): number {
  return messages.reduce((sum, msg) => sum + messageTokens(msg), 0);
}
```

## What Fills the Window

Every API call consumes:

```
┌──────────────────────────────────────┐
│  CONTEXT_WINDOW (200,000 tokens)     │
├──────────────────────────────────────┤
│  System prompt                       │
│  Tool schemas                        │
│  Messages (conversation)             │
│  ──────────────────────────────      │
│  MAX_TOKENS (reserved for output)    │
└──────────────────────────────────────┘
```

The budget for messages is what's left:

```typescript
const CONTEXT_WINDOW = 200000;
const TOOL_SCHEMA_TOKENS = countTokens(JSON.stringify(TOOL_SCHEMAS));

const systemTokens = countTokens(systemPrompt);
const workingBudget = CONTEXT_WINDOW - MAX_TOKENS - TOOL_SCHEMA_TOKENS - systemTokens;
```

No magic constants. Measure everything, compute what's left.

## Loading Only What Fits

Instead of loading all turns, load the most recent ones that fit in the budget:

```typescript
function turnTokens(turn: TraceTurn): number {
  return turn.messages.reduce((sum, msg) => sum + messageTokens(msg), 0);
}

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
```

Scan backwards from the newest turn. Add turns until the budget is full. The most recent turns are always loaded. Older turns that don't fit are excluded.

## The Turns Buffer

The turns we loaded are the **turns buffer** — the recent history that fits in the context window. Flatten it into the messages array:

```typescript
const messages: Message[] = [];
for (const turn of bufferTurns) {
  messages.push(...turn.messages);
}
messages.push({ role: "user", content: input });
```

The agent now works with long histories. Recent turns are in context. The budget is respected.

## What We Lost

Turns that don't fit in the buffer are gone from context. The agent can't see them. If you worked on something 50 turns ago and the buffer only holds 20 turns, that work is invisible.

We need a way to find relevant old turns even when they don't fit in the buffer. That requires making memories searchable.
