# Lesson 2: Call Claude

The brain of our agent is an LLM. Before we can build an agent, we need to talk to it.

## Setup

Set your API key:
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

Create `nanoagent.ts`:
```typescript
#!/usr/bin/env bun
```

## The API Call

The Anthropic Messages API is a single HTTP POST. You send messages, you get a response:

```typescript
const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 8192;

type Message = {
  role: "user" | "assistant";
  content: string | any[];
};

async function callLLM(messages: Message[], systemPrompt: string) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages,
    }),
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}
```

## What's in the Request

| Field | Purpose |
|-------|---------|
| `model` | Which Claude model to use |
| `max_tokens` | Maximum tokens in the response |
| `system` | System prompt — tells the LLM who it is |
| `messages` | The conversation — array of `{ role, content }` |

The API is stateless. You send the full conversation every time. There's no session.

## Try It

```typescript
const response = await callLLM(
  [{ role: "user", content: "Say hello in one word." }],
  "You are a concise assistant."
);
console.log(response.content[0].text);
```

```bash
bun run nanoagent.ts
```

You should see "Hello." (or similar). Claude responded.

## What's in the Response

The response contains `content` — an array of blocks:
- `"text"` — Claude's text response
- `"tool_use"` — Claude wants to call a tool (next lesson)

Right now we only get text blocks. That changes when we give Claude tools.

## What We Have

A `callLLM` function and a `Message` type. Everything we build from here calls this function. Let's give it a tool.
