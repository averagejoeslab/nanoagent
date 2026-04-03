# Lesson 1: What is an AI Agent?

## Introduction

Welcome! In this series, you'll learn how to build AI agents from scratch. By the end, you'll understand the universal pattern that powers agents across all domains - from coding assistants to customer support bots to DevOps automation.

**We'll build a coding agent as our example**, but the patterns you learn apply to any domain. The same architecture that reads files can read support tickets, query databases, or monitor servers.

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

- Use tools (read data, write data, execute actions)
- Take actions autonomously
- Chain multiple operations together
- Complete tasks end-to-end

### Example Across Domains

**Chatbot:**
> You: "Create a hello world function"
> 
> ChatGPT: "Here's a hello world function: `function hello() { console.log('Hello, world!'); }`"

That's it. You got code, but nothing happened.

**Agent (Coding Domain):**
> You: "Create a hello world function in hello.ts"
> 
> Agent: *Calls write_file tool*
> 
> Agent: "I've created hello.ts with a hello world function."

The file now exists on your disk.

**Agent (Support Domain):**
> Customer: "I need help with my account"
> 
> Agent: *Calls read_ticket tool*
> 
> Agent: *Calls check_customer_status tool*
> 
> Agent: "I see you're a premium customer. Escalating to priority support."

**Agent (DevOps Domain):**
> Engineer: "Check if service X is healthy"
> 
> Agent: *Calls get_logs tool*
> 
> Agent: *Calls check_metrics tool*
> 
> Agent: "Service has 15% error rate. Restarting now." *Calls restart_service tool*

**The pattern is identical. Only the tools change.**

## The ReAct Pattern

Agents follow a pattern called **ReAct** (Reasoning + Acting):

1. **REASON**: The agent thinks about what to do
2. **ACT**: The agent uses a tool to take action
3. **OBSERVE**: The agent sees the result
4. **REPEAT**: The agent continues until the task is complete

This loop is what makes agents powerful. They can chain operations:

**Coding Agent:**
1. Read a file (ACT)
2. See it has a bug (OBSERVE)
3. Decide to fix it (REASON)
4. Edit the file (ACT)
5. Verify the fix (ACT)
6. Done (STOP)

**Support Agent:**
1. Read ticket (ACT)
2. See customer is angry (OBSERVE)
3. Decide to prioritize (REASON)
4. Update ticket priority (ACT)
5. Notify manager (ACT)
6. Done (STOP)

**Same pattern. Different tools.**

## Why Do We Need Tools?

LLMs are trained on text. They can generate code, but they can't run it. They can describe a file edit, but they can't actually change the file. They can suggest a SQL query, but they can't execute it.

**Tools bridge this gap.** A tool is a function the agent can call to interact with the real world:

**Coding Agent Tools:**
- `read_file` - Read a file's contents
- `write_file` - Create or modify a file
- `bash` - Execute a shell command

**Support Agent Tools:**
- `read_ticket` - Get ticket details
- `update_ticket` - Change ticket status
- `send_email` - Email the customer

**Analytics Agent Tools:**
- `query_database` - Run SQL query
- `create_chart` - Generate visualization
- `export_data` - Save results

**DevOps Agent Tools:**
- `get_logs` - Fetch service logs
- `restart_service` - Restart a service
- `deploy` - Deploy new version

You define the tools. The agent decides when to use them.

## The Universal Agent Pattern

Here's the key insight: **All agents follow the same pattern.**

```
┌─────────────────────────────────────────┐
│  User Input                              │
│  "Complete this task"                    │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  LLM (Claude, GPT, etc.)                │
│  Reasons about what to do                │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  Tool Selection                          │
│  "I need to use tool X"                  │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  YOUR TOOLS (Domain-Specific)           │
│  • Coding: read/write/bash               │
│  • Support: tickets/email                │
│  • Analytics: queries/charts             │
│  • DevOps: logs/deploy/restart           │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  Result back to LLM                      │
└─────────────────────────────────────────┘
                  ↓
         Loop until complete
```

**The architecture is identical. Only the tools in the middle change.**

## What We're Building

In this tutorial series, we'll build **nanoagent** - a coding assistant. But you're not learning "how to build a coding agent." You're learning **the universal agent pattern**.

**Nanoagent will have:**
- 6 tools (read, write, edit, glob, grep, bash)
- ReAct loop that chains operations
- Interactive terminal interface
- ~660 lines of TypeScript

**But the same structure builds:**
- Customer support agents (different tools)
- Data analysis agents (different tools)
- DevOps automation (different tools)
- Research assistants (different tools)
- Social media managers (different tools)

**We use coding as our example because:**
1. It's tangible - you can see files being created
2. It's useful - you can use it immediately
3. It's simple - file operations are easy to understand
4. It's universal - the patterns transfer to any domain

## What You'll Learn

By the end of this series, you'll know:

**Universal Patterns (Apply Everywhere):**
- How to connect LLMs to tools
- The ReAct loop architecture
- Parallel tool execution
- Memory management
- Production security (sandboxing)

**Implementation (Coding Example):**
- Specific tools: read/write/edit/glob/grep/bash
- File system operations
- Shell command execution

**Transferable Skills:**
- How to design tools for YOUR domain
- How to adapt the pattern to your use case
- What changes vs what stays the same

## Next Steps

In the next lesson, we'll make our first API call to Claude and see a real LLM response. This is the foundation for all agents, regardless of domain.

---

**Key Takeaways:**
- Chatbots generate text, agents take actions
- Agents use the ReAct pattern: Reason → Act → Observe → Repeat
- Tools let agents interact with the real world
- The agent pattern is universal across all domains
- Only the tools change - the architecture stays the same
- We're building a coding agent to teach you the universal pattern
- You'll be able to build agents for ANY domain after this
