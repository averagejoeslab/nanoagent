# Lesson 1: What We're Building

## What Is an Agent?

You've used ChatGPT or Claude. You type a message, it responds with text. That's a **chatbot** — it can describe things, explain things, generate code. But it can't *do* anything.

**Chatbot:**
> You: "Create a hello world function in hello.ts"
>
> Chatbot: "Here's the code: `function hello() { console.log('Hello!'); }`"

The code was generated. But no file was created. Nothing happened on your computer.

**Agent:**
> You: "Create a hello world function in hello.ts"
>
> Agent: *writes the file to disk*
>
> Agent: "I've created hello.ts with a hello world function."

The file now exists. The agent *acted*.

An **AI agent** is an LLM that can take actions in the real world through **tools**. A tool is a function the agent can call — read a file, write a file, run a command, query a database, send an email. The LLM decides what to do. Your code does it.

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

The LLM decides what tools to use, when to use them, and when to stop. Your job is to provide the tools and run the loop. This pattern is the same regardless of what the agent does — coding, customer support, data analysis, DevOps. Only the tools change.

## Why Tools?

LLMs are trained on text. They can generate code but can't run it. They can describe a file edit but can't change the file. They can write a SQL query but can't execute it.

**Tools bridge this gap.** You define functions the agent can call:

- `read` — read a file's contents
- `write` — create or update a file
- `edit` — find and replace in a file
- `glob` — find files by pattern
- `grep` — search file contents
- `bash` — run a shell command

You define the tools. The LLM decides when to use them.

## What We're Building

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
- A chatbot generates text. An agent takes actions through tools.
- The ReAct pattern — reason, act, observe, repeat — is the universal agent loop.
- Tools let the LLM interact with the real world. You define them, the LLM uses them.
- We're building a coding agent, one concept at a time, from scratch.
