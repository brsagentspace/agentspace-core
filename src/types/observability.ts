/**
 * @file observability.ts
 * @description TypeScript interface definitions for Langfuse LLM Observability & Cost Tracking.
 *
 * Implements trace records, generation spans, token breakdown (input, output, cache-read),
 * pricing calculations, and latency metrics across agent execution tiers.
 *
 * @module types/observability
 */

export interface LLMGeneration {
  id: string;
  traceId: string;
  name: string;
  model: string;
  agentId: string;
  agentName: string;
  promptTokens: number;
  completionTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  estimatedCostUSD: number;
  latencyMs: number;
  status: 'success' | 'error' | 'running';
  timestamp: string;
}

export interface LLMTrace {
  id: string;
  name: string;
  userId?: string;
  sessionId?: string;
  generations: LLMGeneration[];
  totalCostUSD: number;
  totalTokens: number;
  cacheHitRate: number;
  startTime: string;
  endTime?: string;
}

export interface TelemetrySummary {
  totalRequests: number;
  totalTokens: number;
  totalCostUSD: number;
  cacheSavingsUSD: number;
  averageLatencyMs: number;
  tierBreakdown: {
    tier1Tokens: number;
    tier2Tokens: number;
    tier3Tokens: number;
  };
}
