/**
 * @file BM25Index.ts
 * @description In-memory Okapi BM25 keyword retrieval engine for Stage 1 candidate filtering.
 *
 * Implements tokenization, term frequency (TF), inverse document frequency (IDF),
 * document length normalization, and fast candidate ranking.
 *
 * @module services/rag/BM25Index
 */

import type { BM25Document, ContextualChunk } from '../../types/rag';

export class BM25Index {
  private k1: number = 1.2;
  private b: number = 0.75;

  private documents: Map<string, BM25Document> = new Map();
  private invertedIndex: Map<string, Set<string>> = new Map();
  private docFrequencies: Map<string, number> = new Map();
  private totalDocLength: number = 0;

  /**
   * Tokenizes text into normalized lowercase tokens.
   */
  public tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1);
  }

  /**
   * Indexes a contextual chunk into the BM25 store.
   */
  public addChunk(chunk: ContextualChunk): void {
    const tokens = this.tokenize(chunk.fullText);
    const doc: BM25Document = {
      id: chunk.id,
      tokens,
      length: tokens.length,
      chunk,
    };

    this.documents.set(chunk.id, doc);
    this.totalDocLength += tokens.length;

    const uniqueTokens = new Set(tokens);
    uniqueTokens.forEach((token) => {
      if (!this.invertedIndex.has(token)) {
        this.invertedIndex.set(token, new Set());
      }
      this.invertedIndex.get(token)!.add(chunk.id);
      this.docFrequencies.set(token, (this.docFrequencies.get(token) || 0) + 1);
    });
  }

  /**
   * Clears the entire index.
   */
  public clear(): void {
    this.documents.clear();
    this.invertedIndex.clear();
    this.docFrequencies.clear();
    this.totalDocLength = 0;
  }

  /**
   * Queries the index and returns top-K documents scored by BM25.
   */
  public search(query: string, topK: number = 30): Array<{ chunk: ContextualChunk; score: number }> {
    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0 || this.documents.size === 0) return [];

    const n = this.documents.size;
    const avgDocLength = this.totalDocLength / (n || 1);
    const scores: Map<string, number> = new Map();

    queryTokens.forEach((token) => {
      const docIds = this.invertedIndex.get(token);
      if (!docIds) return;

      const df = this.docFrequencies.get(token) || 0;
      // IDF with smoothing
      const idf = Math.log((n - df + 0.5) / (df + 0.5) + 1);

      docIds.forEach((docId) => {
        const doc = this.documents.get(docId);
        if (!doc) return;

        // Calculate Term Frequency (TF)
        const tf = doc.tokens.filter((t) => t === token).length;
        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + this.b * (doc.length / avgDocLength));
        const tokenScore = idf * (numerator / denominator);

        scores.set(docId, (scores.get(docId) || 0) + tokenScore);
      });
    });

    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([docId, score]) => ({
        chunk: this.documents.get(docId)!.chunk,
        score,
      }));
  }
}
