# QUICK REFERENCE - Episodic Memory System

## Files Created
- test_episodic_recall.js        (runnable test)
- EPISODIC_RECALL_TEST.md         (results)
- MEMORY_ARCHITECTURE.txt         (diagrams)
- README_EPISODIC_MEMORY.md       (full docs)

## What It Tests
✓ Semantic recall from nanoagent.ts (lines 476-545)
✓ Embedding + cosine similarity search
✓ Two-stage memory: buffer + episodic recall

## Run It
```bash
node test_episodic_recall.js
```

## How It Works
1. Recent turns → working buffer (token-limited)
2. Old turns → episodic storage (unlimited)
3. Query comes in → semantic search over evicted turns
4. Top K candidates → LLM reranks & summarizes
5. Recalled memories → injected into system prompt

## Key Innovation
Traditional: Lose context after 200k tokens
nanoagent: Unlimited memory via semantic search ✨

