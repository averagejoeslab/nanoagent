# Architecture

nanoagent is a single TypeScript file (~650 lines) organized into 15 sections. Each section depends only on sections above it.

## Sections

```
 1. Imports           Node.js modules, Tiktoken, Xenova transformers
 2. Config            API_URL, MODEL, MAX_TOKENS, CONTEXT_WINDOW, RECALL_THRESHOLD, sandbox settings
 3. Types             Message, Tool, ExecResult, TraceTurn
 4. Utilities         Tokenizer (countTokens, messageTokens, totalMessageTokens), getCurrentTimestamp
 5. Sandbox           Sandbox class, getSandbox singleton, Docker lifecycle
 6. Tools             read, write, edit, glob, grep, bash
 7. Tool Schema       buildToolSchema, TOOL_SCHEMAS, TOOL_SCHEMA_TOKENS
 8. Embeddings        initializeEmbedder, embed, cosineSimilarity
 9. Episodic Trace    loadEpisodicTrace, turnTokens, turnTextForEmbedding, saveEpisode
10. LLM Interface     callLLM (with optional useTools flag)
11. Recall            recallMemories (vector search + LLM reranking)
12. Working Memory    assembleWorkingMemory, evictOldestTurns
13. Tool Execution    executeTool
14. Agentic Loop      agenticLoop (ReAct: reason → act → observe → repeat)
15. Main              Startup, REPL mode, one-off mode
```

## Execution Flow

### Startup

```
1. Validate ANTHROPIC_API_KEY
2. Initialize embedder (load Xenova/all-MiniLM-L6-v2)
3. Build baseSystemPrompt (cwd + timestamp + sandbox notice)
4. Branch: argv[2] → one-off mode, else → REPL mode
```

`TOOL_SCHEMAS` and `TOOL_SCHEMA_TOKENS` are computed at module load (top-level). They never change during a session.

### Per Turn

Both REPL and one-off mode run the same flow:

```
assembleWorkingMemory(input, baseSystemPrompt)
  │
  ├── 1. Load full episodic trace from ~/.nanoagent/trace.jsonl
  ├── 2. Get last 3 turns as recent context
  ├── 3. Recall: embed query → cosine search all turns → threshold check → LLM rerank
  ├── 4. Assemble system prompt (base + recalled memories)
  ├── 5. Compute workingBudget = CONTEXT_WINDOW - MAX_TOKENS - TOOL_SCHEMA_TOKENS - systemTokens
  ├── 6. Fill turns buffer: newest turns first, up to (workingBudget - inputTokens)
  ├── 7. Flatten buffer into messages, track bufferTurnSizes
  ├── 8. Record bufferEnd, append user input
  └── Return { systemPrompt, messages, workingBudget, bufferEnd, bufferTurnSizes }
          │
          ▼
agenticLoop(messages, systemPrompt, workingBudget, bufferEnd, bufferTurnSizes)
  │
  └── while (true):
      ├── evictOldestTurns (if messages exceed workingBudget)
      ├── callLLM(messages, systemPrompt)
      ├── Display text blocks
      ├── Execute tool calls in parallel (Promise.all)
      ├── Push assistant response + tool results onto messages
      └── Break if no tool calls
          │
          ▼
saveEpisode(messages.slice(bufferEnd))
  │
  ├── Generate embedding from turn text
  └── Append TraceTurn to trace.jsonl
```

### What Fills the Context Window

```
┌────────────────────────────────────────────────────┐
│ CONTEXT_WINDOW (200,000 tokens)                    │
├────────────────────────────────────────────────────┤
│ System prompt (base + recalled memories)  measured │
│ Tool schemas (6 tools)                    measured │
│ Messages:                                          │
│   ┌──────────────────────────────────────────────┐ │
│   │ Turns buffer (recent episodes)   ← evictable │ │
│   │ Current turn (input + tools)     ← protected │ │
│   └──────────────────────────────────────────────┘ │
│ Output reserve (MAX_TOKENS = 8192)                 │
└────────────────────────────────────────────────────┘

workingBudget = CONTEXT_WINDOW - MAX_TOKENS - TOOL_SCHEMA_TOKENS - systemTokens
```

Every component is measured with real token counts. No magic constants.

### Shutdown

REPL mode: close readline, stop sandbox container (synchronous `docker stop`).

One-off mode: save episode, exit. Sandbox cleanup runs via `process.on("exit")`.

## Data Flow

```
User input
    ↓
assembleWorkingMemory
    ├── loadEpisodicTrace → TraceTurn[]
    ├── recallMemories → string (summary injected into system prompt)
    └── fills turns buffer within workingBudget
    ↓
agenticLoop
    ├── evictOldestTurns (before each API call)
    ├── callLLM → response with text + tool_use blocks
    ├── executeTool → string results (passthrough)
    └── accumulates messages until no tool calls
    ↓
saveEpisode
    ├── turnTextForEmbedding → text representation
    ├── embed → 384-dim vector
    └── appendFile → trace.jsonl
```

## Key Design Decisions

**File tools use direct APIs, bash uses Docker.** File tools are structurally constrained. Bash can do anything. Only the execution boundary is sandboxed.

**Recall runs before budget computation.** The recalled memories go into the system prompt, which affects the budget. So recall must complete before the budget is known.

**Whole-turn eviction only.** A turn with 7 messages (tool calls + results) is evicted as one unit. Breaking it would orphan tool results from their tool_use blocks.

**Tool results are never truncated.** The current turn is ground truth. Evict history instead.

**Tools return strings, executor passes through.** No error codes, no wrapping. The LLM reads the raw string and self-corrects.
