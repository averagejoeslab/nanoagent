# Lesson 10: The Context Window

## The Problem

Every API call sends everything to Claude: the system prompt, tool schemas, all messages, and reserves space for the response. This all has to fit inside the **context window** — a fixed-size budget (200,000 tokens for Claude Sonnet).

Right now our agent doesn't track this. Long conversations or large file reads can overflow the window and the API rejects the request.

## What Are Tokens?

Tokens are how LLMs measure text. A token is roughly 4 characters or ¾ of a word. "Hello world" is 2 tokens. A 1000-line file might be 10,000 tokens.

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
```

## Counting Messages

A single message can be a string (user text) or an array (tool_use/tool_result blocks). We need to handle both:

```typescript
function messageTokens(msg: Message): number {
  return countTokens(
    typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)
  );
}

function totalMessageTokens(messages: Message[]): number {
  return messages.reduce((sum, msg) => sum + messageTokens(msg), 0);
}
```

## What Fills the Context Window

Every API call consumes:

```
┌──────────────────────────────────────┐
│  CONTEXT_WINDOW (200,000 tokens)     │
├──────────────────────────────────────┤
│  System prompt tokens                │
│  Tool schema tokens                  │
│  Message tokens (conversation)       │
│  ──────────────────────────────      │
│  MAX_TOKENS (reserved for output)    │
└──────────────────────────────────────┘
```

The budget for messages is what's left after everything else:

```typescript
const CONTEXT_WINDOW = 200000;
const TOOL_SCHEMA_TOKENS = countTokens(JSON.stringify(TOOL_SCHEMAS));

// Per turn:
const systemTokens = countTokens(systemPrompt);
const workingBudget = CONTEXT_WINDOW - MAX_TOKENS - TOOL_SCHEMA_TOKENS - systemTokens;
```

`workingBudget` is the exact number of tokens available for all messages. No magic constants. No guessing. Measure everything, compute what's left.

## Why Magic Constants Are Wrong

You might be tempted to write:
```typescript
const BUDGET = 180000; // "should be enough"
```

This breaks when:
- The system prompt changes size (e.g., recalled memories are injected)
- Tool schemas change (you add a tool)
- The model's context window changes

Instead, compute from real counts every time. The budget adapts automatically.

## The Tool Schema Cost

Tool schemas are sent on every API call. They consume tokens too. Compute this once at startup since tools don't change during a session:

```typescript
const TOOL_SCHEMAS = buildToolSchema();
const TOOL_SCHEMA_TOKENS = countTokens(JSON.stringify(TOOL_SCHEMAS));
```

For our 6 tools, this is roughly 300-400 tokens. Not huge, but not free.

## Next Steps

We can measure and budget the context window. But our agent still forgets everything between sessions. Let's give it persistent memory.

---

**Key Takeaways:**
- The context window is finite. Everything competes for space.
- Count tokens with Tiktoken — don't guess
- `workingBudget = CONTEXT_WINDOW - MAX_TOKENS - TOOL_SCHEMA_TOKENS - systemTokens`
- Compute from real counts every time. No magic constants.
- Tool schemas cost tokens on every call. Measure them once.
