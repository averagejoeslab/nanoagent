# Lesson 1: What is an AI Agent?

## Introduction

Welcome! In this series, you'll learn how to build an AI agent from scratch. By the end, you'll have created nanoagent - a minimal but fully functional coding assistant that can read files, write code, search your codebase, and execute shell commands autonomously.

But first, let's understand what an agent actually is.

## What is a Chatbot?

You've probably used ChatGPT or Claude. You type a message, it responds. That's a **chatbot**:

- You ask a question
- The LLM (Large Language Model) generates text
- Conversation ends
- No actions taken

Chatbots are great for information and ideas, but they can't *do* anything in the real world.

## What is an Agent?

An **AI agent** goes beyond text generation. It can:

- Use tools (read files, run commands, search the web)
- Take actions autonomously
- Chain multiple operations together
- Complete tasks end-to-end

**Example:**

**Chatbot:**
> You: "Create a hello world function"
> 
> ChatGPT: "Here's a hello world function: `function hello() { console.log('Hello, world!'); }`"

That's it. You got code, but nothing happened.

**Agent:**
> You: "Create a hello world function in hello.ts"
> 
> Agent: *Calls write_file tool*
> 
> Agent: "I've created hello.ts with a hello world function."

The file now exists on your disk. The agent took action.

## The ReAct Pattern

Agents follow a pattern called **ReAct** (Reasoning + Acting):

1. **REASON**: The agent thinks about what to do
2. **ACT**: The agent uses a tool to take action
3. **OBSERVE**: The agent sees the result
4. **REPEAT**: The agent continues until the task is complete

This loop is what makes agents powerful. They can chain operations:

1. Read a file (ACT)
2. See it has a bug (OBSERVE)
3. Decide to fix it (REASON)
4. Edit the file (ACT)
5. Verify the fix (ACT)
6. Done (STOP)

## Why Do We Need Tools?

LLMs are trained on text. They can generate code, but they can't run it. They can describe a file edit, but they can't actually change the file.

**Tools bridge this gap.** A tool is a function the agent can call to interact with the real world:

- `read_file` - Read a file's contents
- `write_file` - Create or modify a file
- `run_command` - Execute a shell command
- `search_web` - Fetch information from the internet

You define the tools. The agent decides when to use them.

## What We're Building

**nanoagent** is a minimal coding assistant with:

- 6 tools (read, write, edit, glob, grep, bash)
- ReAct loop that chains operations
- Interactive terminal interface
- ~255 lines of TypeScript

It's small enough to understand completely, powerful enough to do real work.

## Next Steps

In the next lesson, we'll make our first API call to Claude and see a real LLM response.

---

**Key Takeaways:**
- Chatbots generate text, agents take actions
- Agents use the ReAct pattern: Reason → Act → Observe → Repeat
- Tools let agents interact with the real world
- nanoagent is a minimal but complete agent implementation
