#!/usr/bin/env python3
"""
Test script that imports and uses semantic_recall
"""

from semantic_recall import SemanticRecall
import os

def main():
    print("=" * 60)
    print("Testing Semantic Recall")
    print("=" * 60)
    
    # Initialize semantic recall
    print("\n1. Initializing SemanticRecall...")
    recall = SemanticRecall()
    
    # Store some memories
    print("\n2. Storing memories...")
    memories = [
        "Python is a high-level programming language",
        "Machine learning involves training models on data",
        "The quick brown fox jumps over the lazy dog",
        "Semantic search uses meaning rather than keywords",
        "Natural language processing enables computers to understand text"
    ]
    
    for i, memory in enumerate(memories, 1):
        recall.store(memory)
        print(f"   Stored memory {i}: {memory[:50]}...")
    
    # Perform some searches
    print("\n3. Performing semantic searches...")
    queries = [
        "programming languages",
        "AI and data science",
        "understanding human language"
    ]
    
    for query in queries:
        print(f"\n   Query: '{query}'")
        results = recall.search(query, top_k=2)
        for j, result in enumerate(results, 1):
            text = result['text'][:60]
            score = result['score']
            print(f"      {j}. {text}... (score: {score:.4f})")
    
    # Write results to output file
    print("\n4. Writing results to output.txt...")
    with open('output.txt', 'w') as f:
        f.write("Semantic Recall Test Results\n")
        f.write("=" * 60 + "\n\n")
        
        f.write("Stored Memories:\n")
        for i, memory in enumerate(memories, 1):
            f.write(f"{i}. {memory}\n")
        
        f.write("\n" + "=" * 60 + "\n")
        f.write("Search Results:\n\n")
        
        for query in queries:
            f.write(f"Query: '{query}'\n")
            results = recall.search(query, top_k=2)
            for j, result in enumerate(results, 1):
                text = result['text']
                score = result['score']
                f.write(f"  {j}. {text} (score: {score:.4f})\n")
            f.write("\n")
    
    print("\n5. Complete! Results written to output.txt")
    print("=" * 60)

if __name__ == "__main__":
    main()
