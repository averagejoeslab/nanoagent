# Lesson 1: What Is an Agent?

You've used ChatGPT or Claude. You type a message, it responds with text. That's a **chatbot** — it can explain things, write code, answer questions. But it can't *do* anything.

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

## Agents Use Tools

An **AI agent** is an LLM that can take actions through **tools**. A tool is a function the agent can call — read a file, write a file, run a command, query a database, send an email.

The LLM decides *what* to do. Your code does *how*.

For a coding agent, the tools might be:
- `read` — read a file
- `write` — create or update a file
- `edit` — find and replace in a file
- `bash` — run a shell command

You define the tools. The LLM decides when to use them.

## The ReAct Loop

Every agent follows the same loop, called **ReAct** (Reasoning + Acting):

1. **REASON**: The LLM thinks about what to do
2. **ACT**: It calls a tool
3. **OBSERVE**: It sees the result
4. **REPEAT**: It continues until the task is complete

```
User: "Fix the bug in app.ts"

[REASON]  I need to read the file first
[ACT]     read("app.ts") → file contents
[OBSERVE] I see a null check is missing on line 42
[REASON]  I'll fix it
[ACT]     edit("app.ts", old, new) → "ok"
[STOP]    "Fixed the null check on line 42."
```

The LLM decides what tools to use, when to use them, and when to stop. Your job is to provide the tools and run the loop.

## What We're Building

In this series, we'll build **nanoagent** — a coding agent in a single TypeScript file. By lesson 6, you'll have a working agent you can use. By lesson 12, it will have persistent memory, semantic recall, and sandboxed command execution.

Each lesson builds on the last. Each lesson ends with something that works.

## What You'll Need

- [Bun](https://bun.sh) (`curl -fsSL https://bun.sh/install | bash`)
- An Anthropic API key ([console.anthropic.com](https://console.anthropic.com))

Let's start by talking to Claude.
