# Lesson 5: The Loop

## The Problem

Our current agent can only handle one tool call. But what if Claude needs to chain operations?

**Examples across domains:**

**Coding:**
> "Read config.json, check if debug mode is enabled, and if it is, create a file called debug.log"

**Support:**
> "Read ticket #123, check if customer is premium, and if so, escalate to manager"

**Analytics:**
> "Query the sales table, filter by region='West', and create a summary report"

**DevOps:**
> "Check server logs, find any errors, and restart the affected service"

All of these need:
1. Read data
2. Analyze data
3. Decide what to do
4. Take action

One tool call won't cut it.

## The ReAct Loop

Remember the pattern from Lesson 1?

**ReAct: Reason → Act → Observe → Repeat**

We need to loop until Claude has nothing left to do.

**This loop is universal.** It works the same whether you're reading files, managing tickets, querying databases, or monitoring servers.

## The Stop Condition

How do we know when to stop looping?

**Answer:** When Claude responds without any \`tool_use\` blocks.

If \`stop_reason === "end_turn"\` and there are no tools in the response, we're done.

**This is domain-agnostic.**

## Building the Loop

\`\`\`typescript
async function agenticLoop(userMessage: string) {
  const messages = [{ role: "user", content: userMessage }];

  while (true) {
    // REASON: Ask Claude what to do
    const response = await callClaude(messages);
    
    // Check for tool calls
    const toolCalls = response.content.filter(
      (block: any) => block.type === "tool_use"
    );

    // Add Claude's response to conversation
    messages.push({ role: "assistant", content: response.content });

    // OBSERVE: If no tools, we're done
    if (toolCalls.length === 0) {
      const textBlock = response.content.find(
        (b: any) => b.type === "text"
      );
      return textBlock?.text ?? "";
    }

    // ACT: Execute tools
    const toolResults = [];
    for (const call of toolCalls) {
      let result = "";
      
      if (call.name === "read_file") {
        result = await readFileTool(call.input.path);
      }
      
      toolResults.push({
        type: "tool_result",
        tool_use_id: call.id,
        content: result,
      });
    }

    // REPEAT: Send results back and loop
    messages.push({ role: "user", content: toolResults });
  }
}
\`\`\`

## How It Works

**First iteration:**
1. Send user message
2. Claude returns tool_use
3. Execute tool
4. Add result to messages
5. Continue loop

**Second iteration:**
1. Send messages (including previous tool result)
2. Claude analyzes result
3. Maybe requests another tool, maybe finishes
4. Continue or exit loop

## 💡 Universal ReAct Examples

**Coding Agent:**
\`\`\`
User: "Read test.txt and tell me how many lines it has"

[Loop 1]
→ Claude: I'll use read_file with path=test.txt
→ Execute: readFileTool("test.txt") → "Hello\\nWorld\\n"
→ Loop continues

[Loop 2]
→ Claude: The file has 2 lines of text
→ No tool calls
→ Exit loop
\`\`\`

**Support Agent:**
\`\`\`
User: "Read ticket #456 and escalate if customer is VIP"

[Loop 1]
→ Claude: I'll use read_ticket with id=456
→ Execute: readTicketTool("456") → {customer_type: "VIP", ...}
→ Loop continues

[Loop 2]
→ Claude: Customer is VIP, escalating
→ Tool: escalate_ticket(456)
→ Loop continues

[Loop 3]
→ Claude: Ticket escalated successfully
→ No tool calls
→ Exit loop
\`\`\`

**Analytics Agent:**
\`\`\`
User: "Query sales for region='East' and calculate average"

[Loop 1]
→ Claude: I'll use query_database
→ Execute: queryDatabaseTool("SELECT * FROM sales WHERE region='East'")
→ Loop continues

[Loop 2]
→ Claude: Calculating average from 150 records
→ No tool calls (just math)
→ Exit loop with "Average: $45,320"
\`\`\`

**DevOps Agent:**
\`\`\`
User: "Check logs for errors and restart service if needed"

[Loop 1]
→ Claude: I'll use get_logs
→ Execute: getLogsTool("api-service")
→ Loop continues

[Loop 2]
→ Claude: Found 23 errors, restarting service
→ Tool: restart_service("api-service")
→ Loop continues

[Loop 3]
→ Claude: Service restarted successfully
→ No tool calls
→ Exit loop
\`\`\`

**See the pattern?** The loop mechanics are identical across all domains.

## Test with Multiple Operations

Create two test files:

\`\`\`bash
echo "name: test" > config.txt
echo "Debug enabled" > app.log
\`\`\`

Test the loop:

\`\`\`typescript
const result = await agenticLoop(
  "Read config.txt, then read app.log, and tell me what both files contain"
);
console.log(result);
\`\`\`

Claude will:
1. Call read_file for config.txt
2. Call read_file for app.log
3. Summarize both files

## Full Code

\`\`\`typescript
import { readFile } from "node:fs/promises";

const API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const API_URL = "https://api.anthropic.com/v1/messages";

const TOOLS = [
  {
    name: "read_file",
    description: "Read the contents of a file at the given path",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "The file path to read" },
      },
      required: ["path"],
    },
  },
];

async function readFileTool(path: string): Promise<string> {
  try {
    return await readFile(path, "utf-8");
  } catch (err: any) {
    return \`error: \${err.message}\`;
  }
}

async function callClaude(messages: any[]) {
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
      messages,
      tools: TOOLS,
    }),
  });

  if (!response.ok) throw new Error(\`API error: \${response.status}\`);
  return response.json();
}

async function agenticLoop(userMessage: string) {
  const messages = [{ role: "user", content: userMessage }];

  while (true) {
    const response = await callClaude(messages);
    const toolCalls = response.content.filter(
      (b: any) => b.type === "tool_use"
    );

    messages.push({ role: "assistant", content: response.content });

    if (toolCalls.length === 0) {
      const textBlock = response.content.find((b: any) => b.type === "text");
      return textBlock?.text ?? "";
    }

    const toolResults = [];
    for (const call of toolCalls) {
      let result = "";
      
      if (call.name === "read_file") {
        result = await readFileTool(call.input.path);
      }
      
      toolResults.push({
        type: "tool_result",
        tool_use_id: call.id,
        content: result,
      });
    }

    messages.push({ role: "user", content: toolResults });
  }
}

// Test
const result = await agenticLoop(
  "Read config.txt, then read app.log, and tell me what both files contain"
);
console.log(result);
\`\`\`

## What We've Built

You now have a real agentic loop! Claude can:
- Chain multiple tool calls
- Make decisions based on previous results
- Keep going until the task is complete

**This works identically for:**
- Coding agents (reading/writing files)
- Support agents (managing tickets)
- Analytics agents (querying/analyzing data)
- DevOps agents (monitoring/deploying services)

## Next Steps

In the next lesson, we'll add more tools so Claude can do more than just read.

You'll see how tool *categories* apply across domains.

---

**Key Takeaways:**
- Agents loop until there are no more tool calls
- Each iteration adds to the conversation history
- \`while (true)\` with a break condition when \`toolCalls.length === 0\`
- This is the core of the ReAct pattern
- Your agent can now chain operations autonomously
- **The loop mechanics are identical across all domains**
- Only the tool implementations change
