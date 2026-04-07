"""
Simple semantic recall/memory system using sentence transformers
"""

class SemanticRecall:
    """
    A simple semantic memory system that stores text and retrieves similar items.
    Uses basic string matching in this demo version.
    """
    
    def __init__(self):
        self.memories = []
    
    def store(self, text):
        """Store a memory"""
        self.memories.append(text)
    
    def search(self, query, top_k=5):
        """
        Search for similar memories. 
        Simple implementation using keyword matching and overlap.
        """
        results = []
        query_words = set(query.lower().split())
        
        for memory in self.memories:
            memory_words = set(memory.lower().split())
            # Calculate simple word overlap score
            overlap = len(query_words & memory_words)
            total = len(query_words | memory_words)
            score = overlap / total if total > 0 else 0
            
            results.append({
                'text': memory,
                'score': score
            })
        
        # Sort by score descending
        results.sort(key=lambda x: x['score'], reverse=True)
        
        return results[:top_k]
    
    def get_all(self):
        """Return all stored memories"""
        return self.memories.copy()
