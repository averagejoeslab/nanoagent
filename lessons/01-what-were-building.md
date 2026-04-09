# Lesson 1: What We're Building

## Beyond Chatbots

You've used ChatGPT or Claude. You type, it responds. That's a chatbot — it generates text but can't *do* anything.

An **agent** is different. It can:

- Read files on your disk
- Edit code
- Run commands
- Chain operations together to complete tasks

The difference: a chatbot *describes* what to do. An agent *does* it.

## The ReAct Pattern

Every agent follows the same loop, called **ReAct** (Reasoning + Acting):

1. **REASON**: The LLM thinks about what to do
2. **ACT**: It calls a tool to take action
3. **OBSERVE**: It sees the result
4. **REPEAT**: It continues until the task is complete

```
User: "Fix the bug in app.ts"

[REASON] I need to read the file first
[ACT]    read("app.ts") → file contents
[OBSERVE] I see a null check is missing on line 42
[REASON]  I'll add the check
[ACT]    edit("app.ts", old, new) → "ok"
[REASON]  Done, the bug is fixed
[STOP]   "Fixed the null check on line 42."
```

The LLM decides what tools to use, when to use them, and when to stop. Your job is to provide the tools and run the loop.

## Tools Are the Difference

LLMs can generate text but can't interact with the world. **Tools bridge this gap.** A tool is a function the agent can call:

- `read` — read a file
- `write` — create or update a file
- `edit` — find and replace in a file
- `glob` — find files by pattern
- `grep` — search file contents
- `bash` — run a shell command

You define the tools. The LLM decides when to use them.

## What We'll Build

In this series, we'll build **nanoagent** — a coding agent in a single TypeScript file. Step by step:

1. Call an LLM
2. Give it a tool
3. Let it act
4. Close the loop
5. Add more tools
6. Make it interactive
7. Run tools in parallel
8. Count tokens and manage the context window
9. Give it persistent memory
10. Make memories searchable with embeddings
11. Add semantic recall
12. Orchestrate working memory
13. Sandbox command execution

Each lesson adds one thing. Each lesson produces a working agent. By the end, you'll have a ~650-line agent with tools, memory, recall, and sandboxing.

## Next Steps

In the next lesson, we'll make our first API call to Claude. That's the brain of the agent — everything else is built around it.

---

**Key Takeaways:**
- Chatbots generate text. Agents take actions through tools.
- The ReAct pattern — reason, act, observe, repeat — is the universal agent loop.
- Tools let the LLM interact with the real world.
- We're building a coding agent, one concept at a time.
