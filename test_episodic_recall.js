#!/usr/bin/env node
/**
 * Test script for semantic recall over episodic memory
 * Tests the recallMemories function that searches evicted turns
 */

// Simple embedding simulation (in real nanoagent.ts, this uses Xenova transformers)
// For this test, we use a simple bag-of-words approach to demonstrate the concept

function tokenize(text) {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);
}

// Simulate embeddings with term frequency vectors
function createVocabulary(texts) {
  const vocab = new Set();
  for (const text of texts) {
    tokenize(text).forEach(word => vocab.add(word));
  }
  return Array.from(vocab);
}

function textToVector(text, vocab) {
  const tokens = tokenize(text);
  const freq = {};
  tokens.forEach(t => freq[t] = (freq[t] || 0) + 1);
  
  // Create vector based on vocabulary
  return vocab.map(word => freq[word] || 0);
}

function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB)) || 0;
}

// ─── TEST EPISODIC MEMORY ────────────────────────────────────────────────────
async function testEpisodicRecall() {
  console.log('\n=== Testing Semantic Recall Over Episodic Memory ===\n');

  // Simulate some evicted turns (past conversations no longer in buffer)
  const pastConversations = [
    {
      timestamp: '2024-01-01T10:00:00Z',
      user: 'Create a Python script to parse CSV files',
      assistant: [
        { type: 'text', text: 'I will create a CSV parser using the pandas library.' },
        { type: 'tool_use', name: 'write', input: { path: 'parse_csv.py' } }
      ]
    },
    {
      timestamp: '2024-01-01T11:00:00Z',
      user: 'How do I connect to a PostgreSQL database?',
      assistant: [
        { type: 'text', text: 'You can use psycopg2 or SQLAlchemy. Here is an example with psycopg2.' }
      ]
    },
    {
      timestamp: '2024-01-01T12:00:00Z',
      user: 'Write a React component for a login form',
      assistant: [
        { type: 'text', text: 'I will create a functional React component with form validation.' },
        { type: 'tool_use', name: 'write', input: { path: 'LoginForm.tsx' } }
      ]
    },
    {
      timestamp: '2024-01-01T13:00:00Z',
      user: 'Debug my sorting algorithm in Java',
      assistant: [
        { type: 'text', text: 'Let me check your Java code. The issue is in your comparison logic.' }
      ]
    },
    {
      timestamp: '2024-01-01T14:00:00Z',
      user: 'Set up Docker compose for microservices',
      assistant: [
        { type: 'text', text: 'I will create a docker-compose.yml with your service definitions.' },
        { type: 'tool_use', name: 'write', input: { path: 'docker-compose.yml' } }
      ]
    },
    {
      timestamp: '2024-01-01T15:00:00Z',
      user: 'Create a REST API endpoint in Python Flask',
      assistant: [
        { type: 'text', text: 'I will create a Flask app with RESTful routes.' }
      ]
    },
    {
      timestamp: '2024-01-01T16:00:00Z',
      user: 'Write unit tests for my CSV parser',
      assistant: [
        { type: 'text', text: 'I will write pytest tests for your CSV parsing functions.' }
      ]
    }
  ];

  // Create vocabulary from all conversations
  const allTexts = pastConversations.map(turn => 
    turn.user + ' ' + JSON.stringify(turn.assistant)
  );
  const vocab = createVocabulary(allTexts);
  
  console.log(`Created vocabulary with ${vocab.length} terms\n`);

  // Generate "embeddings" (term frequency vectors) for all past conversations
  console.log('Generating embeddings for past conversations...');
  const evictedTurns = pastConversations.map((turn) => {
    const text = turn.user + ' ' + JSON.stringify(turn.assistant);
    const embedding = textToVector(text, vocab);
    return { ...turn, embedding };
  });
  console.log(`Embedded ${evictedTurns.length} past conversations\n`);

  // Test queries
  const queries = [
    'How do I work with CSV files in Python?',
    'Show me React components you created',
    'Database connection code',
    'Docker setup',
    'What sorting issues did we fix?',
    'Testing CSV code'
  ];

  for (const query of queries) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`Query: "${query}"`);
    console.log('─'.repeat(80));

    // Semantic search
    const queryVec = textToVector(query, vocab);
    const K = 3; // Top 3 candidates

    const candidates = evictedTurns
      .map((turn) => ({
        turn,
        score: cosineSimilarity(queryVec, turn.embedding),
      }))
      .filter(c => c.score > 0) // Only show matches
      .sort((a, b) => b.score - a.score)
      .slice(0, K);

    if (candidates.length === 0) {
      console.log('\nNo relevant matches found');
      continue;
    }

    console.log('\nTop matches (sorted by semantic similarity):');
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
          .map((block) => {
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

  console.log('\n\n=== Test Complete ===\n');
  console.log('Summary:');
  console.log('✓ Loaded and embedded past conversations');
  console.log('✓ Performed semantic search using cosine similarity');
  console.log('✓ Retrieved top K relevant memories for each query');
  console.log('✓ This simulates the episodic recall system in nanoagent.ts');
  console.log('\nHow it works in nanoagent.ts:');
  console.log('1. Recent turns stay in the working memory buffer');
  console.log('2. Older evicted turns are indexed with embeddings');
  console.log('3. When a new query comes in, it searches evicted turns semantically');
  console.log('4. Top K candidates are retrieved by cosine similarity');
  console.log('5. An LLM then reranks and summarizes the retrieved memories');
  console.log('\nThis provides long-term memory beyond the context window!');
}

// ─── RUN TEST ────────────────────────────────────────────────────────────────
testEpisodicRecall().catch(console.error);
