# Lesson 2: Talk to the LLM

## The Problem

We need a brain for our agent. The LLM is that brain — it reads context, reasons about what to do, and decides which tools to call. Before we can build an agent, we need to talk to the LLM.

## Setup

You'll need:
- [Bun](https://bun.sh) installed (`curl -fsSL https://bun.sh/install | bash`)
- An Anthropic API key (from [console.anthropic.com](https://console.anthropic.com))

Set your API key:
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

## Making the Call

The Anthropic Messages API is a single HTTP POST. You send messages, you get a response.

```typescript
#!/usr/bin/env bun

const API_URL = "https://api.anthropic.com/v1/messages";
const API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

const response = await fetch(API_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": API_KEY,
    "anthropic-version": "2023-06-01",
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: "You are a concise coding assistant.",
    messages: [
      { role: "user", content: "What is TypeScript?" }
    ],
  }),
});

const data = await response.json();
console.log(data.content[0].text);
```

Run it:
```bash
bun run agent.ts
```

You'll get a response from Claude.

## What's in the Request

| Field | Purpose |
|-------|---------|
| `model` | Which Claude model to use |
| `max_tokens` | Maximum tokens in the response |
| `system` | System prompt — sets the agent's personality |
| `messages` | The conversation — array of `{ role, content }` |

Messages alternate between `"user"` and `"assistant"` roles. The API is stateless — you send the full conversation every time.

## What's in the Response

The response contains `content` — an array of blocks. Each block has a `type`:

- `"text"` — Claude's text response
- `"tool_use"` — Claude wants to call a tool (we'll use this in the next lesson)

For now, we only care about text:
```typescript
const text = data.content.find((b: any) => b.type === "text");
console.log(text?.text);
```

## Wrapping It in a Function

Let's make a reusable `callLLM` function:

```typescript
async function callLLM(messages: any[], systemPrompt: string) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 8192,
      system: systemPrompt,
      messages,
    }),
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

// Test it
const response = await callLLM(
  [{ role: "user", content: "Say hello in one word." }],
  "You are a concise assistant."
);
console.log(response.content[0].text);
```

This function is the foundation. Every agent feature we build calls `callLLM`.

## Next Steps

The LLM can talk, but it can't do anything. In the next lesson, we'll give it a tool — and it will ask to use it.

---

**Key Takeaways:**
- The Anthropic Messages API is a single HTTP POST
- You send `messages` (the conversation) and get back `content` blocks
- The API is stateless — send the full conversation every call
- `callLLM` is the foundation every agent feature builds on
