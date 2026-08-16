/**
 * @file rag.ts
 * @description TypeScript interface definitions for the 3-Stage RAG Retrieval Cascade.
 *
 * Covers Contextual Retrieval chunks, BM25 inverted index tokens,
 * cross-encoder reranker scoring, and token-optimized retrieval results.
 *
 * @module types/rag
 */

export interface ContextualChunk {
  id: string;
  sourceDocId: string;
  sourceDocName: string;
  contextHeader: string;
  content: string;
  fullText: string;
  tokenCount: number;
  metadata?: Record<string, unknown>;
}

export interface BM25Document {
  id: string;
  tokens: string[];
  length: number;
  chunk: ContextualChunk;
}

export interface RerankerCandidate {
  chunk: ContextualChunk;
  bm25Score: number;
  semanticScore: number;
  finalScore: number;
}

export interface RAGQueryOptions {
  topKStage1?: number; // BM25 candidates (default: 30)
  topKStage2?: number; // Reranked candidates (default: 8)
  topKFinal?: number;  // Final LLM context chunks (default: 3)
}

export interface RAGSearchResult {
  query: string;
  totalCandidates: number;
  topChunks: ContextualChunk[];
  compiledPromptContext: string;
  totalTokensSaved: number;
}
