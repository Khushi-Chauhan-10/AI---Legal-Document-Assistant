import os
import pickle
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer

# Lazy load embeddings model
encoder = None

def get_encoder():
    global encoder
    if encoder is None:
        # Load lightweight SentenceTransformer model
        encoder = SentenceTransformer("all-MiniLM-L6-v2")
    return encoder

class VectorStore:
    def __init__(self, doc_id: str, storage_dir: str = "storage"):
        self.doc_id = doc_id
        self.storage_dir = storage_dir
        self.index_dir = os.path.join(storage_dir, "indices", doc_id)
        self.index_path = os.path.join(self.index_dir, "faiss.index")
        self.chunks_path = os.path.join(self.index_dir, "chunks.pkl")
        
        # Ensure directories exist
        os.makedirs(self.index_dir, exist_ok=True)
        
        self.encoder = get_encoder()
        self.dimension = 384  # Dimension of all-MiniLM-L6-v2 embeddings
        self.index = None
        self.chunks = []
        
        self.load()

    def build(self, chunks: list[dict]):
        """Builds a FAISS index from document chunks."""
        self.chunks = chunks
        if not chunks:
            self.index = faiss.IndexFlatL2(self.dimension)
            self.save()
            return
            
        texts = [chunk["content"] for chunk in chunks]
        embeddings = self.encoder.encode(texts, show_progress_bar=False)
        embeddings = np.array(embeddings).astype("float32")
        
        # Normalize vectors for cosine similarity (flat L2 on normalized vectors is cosine distance)
        faiss.normalize_L2(embeddings)
        
        self.index = faiss.IndexFlatIP(self.dimension)  # Inner Product for cosine similarity on normalized vectors
        self.index.add(embeddings)
        self.save()

    def search(self, query: str, top_k: int = 4) -> list[dict]:
        """Searches for relevant chunks based on semantic similarity."""
        if not self.index or self.index.ntotal == 0:
            return []
            
        query_vector = self.encoder.encode([query], show_progress_bar=False)
        query_vector = np.array(query_vector).astype("float32")
        faiss.normalize_L2(query_vector)
        
        # Search index
        top_k = min(top_k, self.index.ntotal)
        distances, indices = self.index.search(query_vector, top_k)
        
        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx != -1 and idx < len(self.chunks):
                chunk = self.chunks[idx].copy()
                chunk["score"] = float(dist)
                results.append(chunk)
                
        return results

    def save(self):
        """Saves index and chunk metadata to disk."""
        if self.index:
            faiss.write_index(self.index, self.index_path)
        with open(self.chunks_path, "wb") as f:
            pickle.dump(self.chunks, f)

    def load(self):
        """Loads index and chunk metadata from disk if they exist."""
        if os.path.exists(self.index_path) and os.path.exists(self.chunks_path):
            try:
                self.index = faiss.read_index(self.index_path)
                with open(self.chunks_path, "rb") as f:
                    self.chunks = pickle.load(f)
            except Exception:
                # Re-initialize if corrupted
                self.index = faiss.IndexFlatIP(self.dimension)
                self.chunks = []
        else:
            self.index = faiss.IndexFlatIP(self.dimension)
            self.chunks = []
            
    def delete(self):
        """Deletes files associated with this index."""
        if os.path.exists(self.index_path):
            os.remove(self.index_path)
        if os.path.exists(self.chunks_path):
            os.remove(self.chunks_path)
        try:
            os.rmdir(self.index_dir)
        except OSError:
            pass
