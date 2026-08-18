/**
 * @file MemoryStore.ts
 * @description Storage abstraction for the agent memory graph.
 *
 * The UI depends only on the MemoryStore interface; implementations decide
 * where memories actually live. V1 ships JsonMemoryStore (static demo seed).
 * A Tauri-fs markdown vault and a Graphiti REST client can be swapped in
 * later without touching the map UI.
 *
 * @module services/memory
 */

import type { GraphNode, GraphRelation } from '../../types/knowledgeGraph';

export interface MemoryGraphData {
  nodes: GraphNode[];
  relations: GraphRelation[];
  /** Search-index stats shown in the header bar */
  indexedFiles: number;
  indexedChunks: number;
  /** Agents present in the graph: id → display name */
  agents: Record<string, string>;
}

export interface MemoryStore {
  load(): Promise<MemoryGraphData>;
}

/** Loads a pre-generated memory graph JSON (see scripts/generate-memory-seed.mjs). */
export class JsonMemoryStore implements MemoryStore {
  constructor(private readonly url: string = '/demo/memory-graph.json') {}

  async load(): Promise<MemoryGraphData> {
    const res = await fetch(this.url);
    if (!res.ok) throw new Error(`memory seed fetch failed: ${res.status}`);
    return res.json() as Promise<MemoryGraphData>;
  }
}

/** Node colors per owning agent — shared by legend and the GPU canvas. */
export const AGENT_PALETTE: string[] = [
  '#a78bfa', // purple
  '#60a5fa', // blue
  '#34d399', // green
  '#fbbf24', // amber
  '#f472b6', // pink
  '#22d3ee', // cyan
  '#fb923c', // orange
  '#c4b5fd', // lavender
];

export function agentColor(agentIds: string[], agentId: string): string {
  const idx = Math.max(0, agentIds.indexOf(agentId));
  return AGENT_PALETTE[idx % AGENT_PALETTE.length];
}
