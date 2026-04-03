# Lesson 10: Episodic Memory

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

## What is Episodic Memory?

**Episodic memory** is the record of specific experiences over time. For humans, it's remembering:
- What you had for breakfast
- Conversations you've had
- Things that happened to you

For agents, it's remembering:
- Previous user requests
- Actions taken
- Results received

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

## Implementing Episodic Memory

We need two things:
1. **Save** conversations to disk
2. **Load** conversations on startup

**This implementation is universal** - works the same for all agent types.

### Storage Format: JSONL

**JSONL** (JSON Lines) is perfect for append-only logs:

**Coding Agent:**
```jsonl
{"timestamp":"2026-03-31T00:00:00Z","user":"Create hello.ts","assistant":[...]}
{"timestamp":"2026-03-31T00:01:00Z","user":"Read it back","assistant":[...]}
```

**Support Agent:**
```jsonl
{"timestamp":"2026-03-31T00:00:00Z","user":"Create ticket for John","assistant":[...]}
{"timestamp":"2026-03-31T00:01:00Z","user":"Update ticket status","assistant":[...]}
```

**Analytics Agent:**
```jsonl
{"timestamp":"2026-03-31T00:00:00Z","user":"Query sales data","assistant":[...]}
{"timestamp":"2026-03-31T00:01:00Z","user":"Generate report","assistant":[...]}
```

**DevOps Agent:**
```jsonl
{"timestamp":"2026-03-31T00:00:00Z","user":"Check service health","assistant":[...]}
{"timestamp":"2026-03-31T00:01:00Z","user":"Restart service","assistant":[...]}
```

Each line is a complete JSON object. Easy to append, easy to read.

**The format is identical across domains.**

### Creating the Trace File

Add memory functions after tool execution:

```typescript
// ─── MEMORY ──────────────────────────────────────────────────────────────────
import { mkdir } from "node:fs/promises";

const TRACE_FILE = ".nanoagent/trace.jsonl";

async function saveToTrace(turn: { 
  timestamp: string; 
  user: string; 
  assistant: any 
}) {
  await mkdir(".nanoagent", { recursive: true });
  const line = JSON.stringify(turn) + "\n";
  await Bun.write(TRACE_FILE, line, { append: true });
}

async function loadTrace(): Promise<Message[]> {
  try {
    const content = await readFile(TRACE_FILE, "utf-8");
    const lines = content.trim().split("\n");
    
    const messages: Message[] = [];
    for (const line of lines) {
      const turn = JSON.parse(line);
      messages.push({ role: "user", content: turn.user });
      messages.push({ role: "assistant", content: turn.assistant });
    }
    return messages;
  } catch {
    return []; // No trace file yet
  }
}
```

### Load on Startup

Update `main()` to load existing conversations:

```typescript
async function main() {
  console.log(`
${ANSI.bold}${ANSI.cyan}nanoagent${ANSI.reset}
${ANSI.dim}${MODEL}${ANSI.reset} | ${ANSI.dim}${process.cwd()}${ANSI.reset}
`);

  // Load previous conversations
  const messages: Message[] = await loadTrace();
  
  if (messages.length > 0) {
    console.log(`${ANSI.dim}Restored ${messages.length / 2} turns from previous sessions${ANSI.reset}`);
  }
  
  // ... rest of main
}
```

### Save After Each Turn

After the agent responds, save to trace:

```typescript
messages.push({ role: "user", content: input });
await agenticLoop(messages, systemPrompt);

// Save this turn to trace
await saveToTrace({
  timestamp: new Date().toISOString(),
  user: input,
  assistant: messages[messages.length - 1].content,
});

console.log();
```

## Testing Memory

**Session 1:**
```
nanoagent
claude-sonnet-4-5 | /tmp/demo

❯ Create a file called memory-test.txt with the content "I remember this"

⏺ write(memory-test.txt)
  ⎿  ok

⏺ I've created memory-test.txt with your requested content

❯ /q
```

**Session 2:**
```
nanoagent
claude-sonnet-4-5 | /tmp/demo
Restored 1 turns from previous sessions

❯ What file did I create last time?

⏺ You created a file called memory-test.txt with the content "I remember this"

❯ Read it to verify

⏺ read(memory-test.txt)
  ⎿  I remember this

⏺ The file contains: "I remember this"
```

It works! The agent remembers across sessions.

## What Gets Stored

Each turn saves:
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

Everything needed to reconstruct the conversation.

## The Growing Trace

Your trace file grows with every interaction:

```bash
$ wc -l .nanoagent/trace.jsonl
50 .nanoagent/trace.jsonl
```

After 50 conversations, you have 50 lines. After 1000, you have 1000 lines.

## Memory Grows Unbounded

**This is intentional.** As you use your agent more:
- The trace file gets larger
- More context loads on startup
- API calls include more history
- Eventually, you'll hit limits

**You'll notice:**
- Slower startup times
- Higher API costs (more input tokens)
- Eventually: "context length exceeded" errors

## Why Unbounded?

We're letting you discover the problem naturally. After extended use, you'll think:
> "My agent is getting slow. Why is it loading so much history?"

Then you'll understand why memory management matters.

## What You've Built

Your agent now has:
- Persistent memory across sessions
- Conversation continuity
- Historical context
- Growing trace log

## The Challenge Ahead

Use your agent extensively. Create files, search code, run commands. Have long conversations.

**Watch what happens:**
1. First 10 turns: instant
2. At 50 turns: still fast
3. At 100 turns: noticeably slower
4. At 200 turns: significant delays
5. At 500 turns: ???

You'll discover the limits yourself.

## Next Steps

In future lessons (advanced topics), you'll learn:
- Memory management strategies
- Sliding windows
- Importance filtering
- Semantic search
- Consolidation

But for now, let it grow. Experience the problem firsthand.

---

**Key Takeaways:**
- Episodic memory = recorded history of interactions
- JSONL is perfect for append-only conversation logs
- Load on startup, save after each turn
- Unbounded growth reveals real constraints
- Experience the problem before learning solutions
- Memory management is critical for production agents
- **Memory implementation is universal across all agent types**
- Only the content stored changes by domain (file operations vs tickets vs queries)

## Try It

Add memory to your agent. Use it extensively. See what happens when your trace file hits 100+ turns.

**Then ask yourself:**
- How much history do I really need?
- Which conversations matter most?
- How can I keep relevant context without everything?

Those questions lead to advanced memory systems (next lesson).

**This problem occurs in all domains:**
- Coding agents with 1000+ file operations
- Support agents with 1000+ ticket interactions
- Analytics agents with 1000+ queries
- DevOps agents with 1000+ deployments

**The solution (token budgeting) is also universal.**
