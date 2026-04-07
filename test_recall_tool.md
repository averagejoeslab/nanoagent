# Recall Tool - User-Controlled Memory Search

## Overview

The new `recall` tool gives Claude **explicit control** over episodic memory search. This complements the automatic semantic recall that happens on every turn.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MEMORY SYSTEM                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  AUTOMATIC (every turn):                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ User Query → Semantic Search → Top 10 Memories      │  │
│  │            → LLM Rerank → Injected into System      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  MANUAL (when Claude decides):                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ recall(query="what I need") → Same semantic search  │  │
│  │            → Returns as tool result                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## When Would Claude Use This?

### Scenario 1: Refining the Search
```
User: "Remember that bug we discussed?"

Claude'\''s automatic recall searches for: "Remember that bug we discussed?"
- But that'\''s not specific enough!

Claude uses: recall(query="bug python database connection timeout")
- Much more targeted search
```

### Scenario 2: Multiple Searches
```
User: "Combine the authentication and database code we wrote"

Claude needs TWO separate memories:
1. Automatic recall finds authentication (based on full query)
2. Claude calls: recall(query="database connection pooling code")
```

### Scenario 3: Not Satisfied with Automatic Results
```
User: "What was that thing we did yesterday?"

Automatic recall returns: memories about React components

Claude thinks: "That doesn'\''t seem relevant to the vague query"
Claude uses: recall(query="code written yesterday afternoon date-specific")
```

## Tool Definition

```typescript
recall: {
  desc: "Search episodic memory for relevant past conversations. Use this to find information from earlier in the session that is no longer in the working memory buffer. Craft a search query that describes what you'\''re looking for.",
  params: ["query"],
  fn: async (args) => {
    const evicted = (globalThis as any).__nanoagent_evicted_turns || [];
    if (!evicted.length) {
      return "No episodic memories available yet (all conversation is still in working memory).";
    }
    
    const result = await recallMemories(args.query, evicted);
    if (!result) {
      return "No relevant memories found for this query.";
    }
    
    return result;
  },
}
```

## Example Usage

### Conversation Flow

```
Turn 1-20: Discussion about Python data processing
Turn 21-40: Discussion about React UI components  
Turn 41-60: Discussion about Docker deployment
[Turns 1-20 get evicted from working memory buffer]

Turn 61:
User: "Can you update the data processing pipeline?"

Automatic recall: Searches for "update the data processing pipeline"
→ Might not find the specific Python code from turn 1-20

Claude'\''s reasoning:
"I should search more specifically for the implementation details"

Claude uses tool:
<tool_use>
  <tool_name>recall</tool_name>
  <parameters>
    <query>Python data processing pipeline pandas dataframe transformations</query>
  </parameters>
</tool_use>

Result:
## What I remember from earlier:

You built a data processing pipeline using pandas that read CSV files, 
performed cleaning operations (removing duplicates, handling nulls), 
applied transformations using groupby and aggregate functions, and 
exported results to parquet format. The main file was process_data.py 
with helper functions in utils/transforms.py. (December 15, 2:30 PM)
```

## Benefits

1. **Precision**: Claude can craft better search queries than the raw user input
2. **Multiple retrievals**: Can search for different aspects separately
3. **Fallback**: If automatic recall fails, Claude has a backup option
4. **Explicitness**: Claude can explain why it'\''s searching memory
5. **Control**: Claude decides WHEN memory search is needed

## Implementation Details

```typescript
// When loadTrace() runs, it stores evicted turns globally:
const evictedTurns = allTurns.filter((_, idx) => !bufferIndices.has(idx));
(globalThis as any).__nanoagent_evicted_turns = evictedTurns;

// The recall tool accesses them:
const evicted = (globalThis as any).__nanoagent_evicted_turns || [];

// Same semantic search as automatic recall:
await recallMemories(args.query, evicted);
```

## Comparison: Automatic vs Manual Recall

| Feature | Automatic Recall | Manual Recall Tool |
|---------|-----------------|-------------------|
| **Trigger** | Every user input | Claude'\''s decision |
| **Query** | Raw user message | Claude'\''s crafted query |
| **Location** | System prompt context | Tool result |
| **Cost** | Every turn | Only when needed |
| **Control** | Nanoagent | Claude |
| **Visibility** | Hidden from Claude | Explicit in conversation |

## Example Scenarios

### ✅ Good Use Cases

```typescript
// User'\''s query is vague, Claude gets specific
recall(query="FastAPI endpoint authentication JWT tokens middleware")

// Need info from 2 different topics
recall(query="database migration scripts alembic")
recall(query="pytest fixtures mock database")

// Automatic recall found wrong stuff
recall(query="the bug we fixed NOT the feature we added")

// Time-based search
recall(query="code we wrote on Monday morning")
```

### ❌ Probably Not Needed

```typescript
// User'\''s query is already specific
User: "Show me the FastAPI authentication code"
// Automatic recall will handle this fine

// Info is in working memory buffer
User: "What did I just say?"
// No need to search evicted turns

// No evicted turns yet
// Early in conversation, everything is in buffer
```

## Testing the Tool

To test the recall tool in a real scenario:

1. **Create a long conversation** (50+ turns)
2. **Discuss multiple distinct topics** (Python, React, Docker, etc.)
3. **Wait for eviction** (early turns drop out of buffer)
4. **Ask a vague question** about early content
5. **Watch Claude** decide to use `recall` tool with better query

## Code Location

- **Tool definition**: `nanoagent.ts` lines ~402-420
- **recallMemories()**: `nanoagent.ts` lines 476-545
- **Global storage**: `nanoagent.ts` lines 595-599

## Summary

The `recall` tool transforms episodic memory from a **passive system** (nanoagent decides) to a **collaborative system** (nanoagent + Claude decide together). It gives Claude agency to actively search its own memory when it recognizes that automatic recall might not be sufficient.

