#!/usr/bin/env bun
/**
 * Test script for semantic recall over episodic memory
 * Tests the recallMemories function that searches evicted turns
 */

import { pipeline } from '\''@xenova/transformers'\'';

// ─── EMBEDDING & SIMILARITY ──────────────────────────────────────────────────
let embedder: any = null;

async function embed(text: string): Promise<number[]> {
  if (!embedder) {
    console.log('\''Loading embedding model...'\'');
    embedder = await pipeline('\''feature-extraction'\'', '\''Xenova/all-MiniLM-L6-v2'\'');
  }
  const output = await embedder(text, { pooling: '\''mean'\'', normalize: true });
  return Array.from(output.data);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ─── TEST EPISODIC MEMORY ────────────────────────────────────────────────────
async function testEpisodicRecall() {
  console.log('\''\n=== Testing Semantic Recall Over Episodic Memory ===\n'\'');

  // Simulate some evicted turns (past conversations no longer in buffer)
  const pastConversations = [
    {
      timestamp: '\''2024-01-01T10:00:00Z'\'',
      user: '\''Create a Python script to parse CSV files'\'',
      assistant: [
        { type: '\''text'\'', text: '\''I\'\''ll create a CSV parser using the pandas library.'\'' },
        { type: '\''tool_use'\'', name: '\''write'\'', input: { path: '\''parse_csv.py'\'' } }
      ]
    },
    {
      timestamp: '\''2024-01-01T11:00:00Z'\'',
      user: '\''How do I connect to a PostgreSQL database?'\'',
      assistant: [
        { type: '\''text'\'', text: '\''You can use psycopg2 or SQLAlchemy. Here\'\''s an example with psycopg2.'\'' }
      ]
    },
    {
      timestamp: '\''2024-01-01T12:00:00Z'\'',
      user: '\''Write a React component for a login form'\'',
      assistant: [
        { type: '\''text'\'', text: '\''I\'\''ll create a functional React component with form validation.'\'' },
        { type: '\''tool_use'\'', name: '\''write'\'', input: { path: '\''LoginForm.tsx'\'' } }
      ]
    },
    {
      timestamp: '\''2024-01-01T13:00:00Z'\'',
      user: '\''Debug my sorting algorithm in Java'\'',
      assistant: [
        { type: '\''text'\'', text: '\''Let me check your Java code. The issue is in your comparison logic.'\'' }
      ]
    },
    {
      timestamp: '\''2024-01-01T14:00:00Z'\'',
      user: '\''Set up Docker compose for microservices'\'',
      assistant: [
        { type: '\''text'\'', text: '\''I\'\''ll create a docker-compose.yml with your service definitions.'\'' },
        { type: '\''tool_use'\'', name: '\''write'\'', input: { path: '\''docker-compose.yml'\'' } }
      ]
    },
    {
      timestamp: '\''2024-01-01T15:00:00Z'\'',
      user: '\''Create a REST API endpoint in Python Flask'\'',
      assistant: [
        { type: '\''text'\'', text: '\''I\'\''ll create a Flask app with RESTful routes.'\'' }
      ]
    }
  ];

  // Generate embeddings for all past conversations
  console.log('\''Generating embeddings for past conversations...'\'');
  const evictedTurns = await Promise.all(
    pastConversations.map(async (turn) => {
      const text = turn.user + '\'' '\'' + JSON.stringify(turn.assistant);
      const embedding = await embed(text);
      return { ...turn, embedding };
    })
  );
  console.log(`Embedded ${evictedTurns.length} past conversations\n`);

  // Test queries
  const queries = [
    '\''How do I work with CSV files in Python?'\'',
    '\''Show me React components you created'\'',
    '\''Database connection code'\'',
    '\''Docker setup'\'',
    '\''What sorting issues did we fix?'\''
  ];

  for (const query of queries) {
    console.log(`\n${'\''─'\''.repeat(80)}`);
    console.log(`Query: "${query}"`);
    console.log('\''─'\''.repeat(80));

    // Semantic search
    const queryVec = await embed(query);
    const K = 3; // Top 3 candidates

    const candidates = evictedTurns
      .map((turn) => ({
        turn,
        score: cosineSimilarity(queryVec, turn.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, K);

    console.log('\''\nTop matches:'\'');
    for (let i = 0; i < candidates.length; i++) {
      const { turn, score } = candidates[i];
      const date = new Date(turn.timestamp).toLocaleString();
      const userPreview = turn.user.slice(0, 60);
      console.log(`\n[${i + 1}] Similarity: ${score.toFixed(4)}`);
      console.log(`    Date: ${date}`);
      console.log(`    User: ${userPreview}`);
      
      // Extract assistant text
      let assistantText = "";
      if (typeof turn.assistant === "string") {
        assistantText = turn.assistant;
      } else if (Array.isArray(turn.assistant)) {
        assistantText = turn.assistant
          .map((block: any) => {
            if (block.type === "text") return block.text;
            if (block.type === "tool_use") return `[Used tool: ${block.name}]`;
            return "";
          })
          .filter(Boolean)
          .join(" ");
      }
      
      const assistantPreview = assistantText.slice(0, 80);
      console.log(`    Assistant: ${assistantPreview}...`);
    }
  }

  console.log('\''\n\n=== Test Complete ===\n'\'');
  console.log('\''Summary:'\'');
  console.log('\''- Loaded and embedded past conversations'\'');
  console.log('\''- Performed semantic search using cosine similarity'\'');
  console.log('\''- Retrieved top K relevant memories for each query'\'');
  console.log('\''- This simulates the episodic recall system in nanoagent.ts'\'');
  console.log('\''\nIn the full system:'\'');
  console.log('\''- Recent turns stay in the working memory buffer'\'');
  console.log('\''- Older evicted turns are searched semantically when relevant'\'');
  console.log('\''- An LLM then reranks and summarizes the retrieved memories'\'');
}

// ─── RUN TEST ────────────────────────────────────────────────────────────────
testEpisodicRecall().catch(console.error);

