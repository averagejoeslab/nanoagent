# Lesson 2: Your First LLM Call

## Prerequisites

Before we write any code, you need:

1. **Bun** - A fast JavaScript/TypeScript runtime
2. **Anthropic API Key** - Access to Claude

## Installing Bun

Visit [bun.sh](https://bun.sh) and follow the installation instructions for your operating system.

**macOS/Linux:**
```bash
curl -fsSL https://bun.sh/install | bash
```

**Windows:**
```bash
powershell -c "irm bun.sh/install.ps1 | iex"
```

Verify installation:
```bash
bun --version
```

## Getting an API Key

1. Visit [console.anthropic.com](https://console.anthropic.com)
2. Sign up or log in
3. Go to API Keys section
4. Create a new key
5. Copy it (you won't see it again)

## Your First Script

Create a file called `agent.ts`:

```typescript
// agent.ts
const API_KEY = "your_api_key_here"; // Replace with your actual key
const API_URL = "https://api.anthropic.com/v1/messages";

async function callClaude(message: string) {
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
      messages: [
        {
          role: "user",
          content: message,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

// Test it
const result = await callClaude("Hello, Claude!");
console.log(JSON.stringify(result, null, 2));
```

## Run It

```bash
bun agent.ts
```

You should see a JSON response that looks like this:

```json
{
  "id": "msg_01...",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "Hello! How can I help you today?"
    }
  ],
  "model": "claude-sonnet-4-5",
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 10,
    "output_tokens": 12
  }
}
```

## Understanding the Response

**Key parts:**

- `content`: An array of content blocks (text, tool_use, etc.)
- `content[0].type`: "text" means Claude just responded with text
- `content[0].text`: The actual response
- `stop_reason`: "end_turn" means Claude finished naturally

**Extract just the text:**

```typescript
const result = await callClaude("Hello, Claude!");
const text = result.content.find((block: any) => block.type === "text")?.text;
console.log(text);
```

Output:
```
Hello! How can I help you today?
```

## Using Environment Variables (Better Practice)

Instead of hardcoding your API key, use a `.env` file:

**Create `.env`:**
```
ANTHROPIC_API_KEY=your_api_key_here
```

**Update agent.ts:**
```typescript
const API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
```

**Run with env loading:**
```bash
bun agent.ts
```

Bun automatically loads `.env` files. No extra library needed!

## What's Happening?

1. You send a message to Claude via HTTP POST
2. Claude processes your message
3. Claude generates a response
4. You receive JSON with the response

This is the foundation. Every agent interaction starts with an API call like this.

## Next Steps

In the next lesson, we'll add our first tool and see how Claude can request to use it.

---

**Key Takeaways:**
- Anthropic's Messages API accepts HTTP POST requests
- You send messages with `role: "user"` and `content`
- Claude responds with `content` blocks (text or tool_use)
- Always use environment variables for API keys
