# Episodic Memory Test Suite for nanoagent.ts

## 📁 Files Created

1. **test_episodic_recall.js** (7.1K) - Main test script (runnable with Node.js)
2. **test_episodic_recall.ts** (6.4K) - TypeScript version for Bun
3. **EPISODIC_RECALL_TEST.md** (4.9K) - Detailed test results and analysis
4. **MEMORY_ARCHITECTURE.txt** (5.9K) - Visual architecture diagram

## 🚀 Quick Start

```bash
# Run the test
node test_episodic_recall.js

# View the results
cat EPISODIC_RECALL_TEST.md

# See the architecture
cat MEMORY_ARCHITECTURE.txt
```

## 🧠 What This Tests

This test suite validates the **semantic recall system** in `nanoagent.ts` that provides long-term episodic memory beyond the context window.

### Key Features Tested

✅ **Embedding Generation** - Converting conversation turns to vector representations  
✅ **Semantic Search** - Finding relevant memories using cosine similarity  
✅ **Top-K Retrieval** - Selecting most relevant candidates  
✅ **Two-Stage Memory** - Buffer for recent turns + semantic search for evicted turns

## 📊 Test Scenarios

The test simulates 7 past conversations covering:
- Python CSV parsing
- PostgreSQL database connections
- React component development
- Java debugging
- Docker compose setup
- Flask REST APIs
- Unit testing

Then queries them with semantically similar questions to validate retrieval accuracy.

## 🔍 Sample Results

```
Query: "How do I work with CSV files in Python?"
Top Match: "Create a Python script to parse CSV files" (similarity: 0.3162)

Query: "Docker setup"
Top Match: "Set up Docker compose for microservices" (similarity: 0.4523)
```

## 🏗️ Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│ Working Buffer  │────►│ Semantic Recall  │◄────│ Episodic Store │
│ (Recent 20)     │     │ (Top K=10)       │     │ (All 100+)     │
└─────────────────┘     └──────────────────┘     └────────────────┘
                                │
                                ▼
                        ┌───────────────┐
                        │ LLM Reranking │
                        └───────────────┘
```

See `MEMORY_ARCHITECTURE.txt` for full diagram.

## 📝 How It Maps to nanoagent.ts

| Test Component | nanoagent.ts Function | Lines |
|----------------|----------------------|-------|
| embed() | embed(text) | 446-453 |
| cosineSimilarity() | cosineSimilarity(a, b) | 455-462 |
| Semantic search | recallMemories(query, evictedTurns) | 476-545 |
| Working buffer | loadTrace(currentQuery) | 547-599 |
| Storage | saveToTrace(turn) | 465-474 |

## 🎯 Key Insights

1. **Unlimited Memory**: Not constrained by 200k context window
2. **Semantic Matching**: Finds relevant info even with different wording
3. **Automatic Eviction**: Old turns don'\''t disappear, they'\''re searchable
4. **Two-Stage Design**: Recent (buffer) + Relevant (semantic search)

## 🔬 Implementation Details

### Embedding Model
- **Production**: Xenova/all-MiniLM-L6-v2 (384 dimensions)
- **Test**: Bag-of-words term frequency (simplified for demo)

### Similarity Metric
- Cosine similarity between query and turn embeddings
- Scores range from 0 (unrelated) to 1 (identical)

### Retrieval Process
1. Embed the current query
2. Compute similarity with all evicted turns
3. Select top K candidates (K=10)
4. LLM reranks and summarizes
5. Inject into system prompt

## 💡 Why This Matters

Traditional chatbots lose context after filling their context window. With episodic recall:

- ✅ Remember conversations from weeks ago
- ✅ Pull in relevant context automatically
- ✅ No manual copy-paste of old info
- ✅ Persistent memory across sessions

## 📚 References

- Main implementation: `nanoagent.ts` lines 438-599
- Storage format: `.nanoagent/trace.jsonl` (JSONL with embeddings)
- Memory budget: 189,500 tokens for buffer
- Context window: 200,000 tokens total

## 🧪 Running Your Own Tests

Modify the `pastConversations` array in the test script to add your own scenarios:

```javascript
{
  timestamp: '\''2024-01-01T10:00:00Z'\'',
  user: '\''Your question here'\'',
  assistant: [
    { type: '\''text'\'', text: '\''Response here'\'' }
  ]
}
```

Then run `node test_episodic_recall.js` to see how semantic search performs!

---

**Created by:** Testing the episodic memory system from nanoagent.ts  
**Date:** Based on nanoagent.ts implementation  
**Purpose:** Validate semantic recall over evicted episodic memory

