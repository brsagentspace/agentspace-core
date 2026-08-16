/**
 * @file knowledgeGraph.ts
 * @description TypeScript interface definitions for Graphiti Bi-temporal Knowledge Graph.
 *
 * Implements bi-temporal timestamps (valid_time and ingestion_time),
 * episodic memory models, entity nodes, decisions, and cross-agent relations.
 *
 * @module types/knowledgeGraph
 */

export type GraphNodeType = 'Project' | 'Agent' | 'Task' | 'Decision' | 'Lesson' | 'Artifact';

export type GraphRelationType =
  | 'DECIDED_BY'
  | 'LEARNED_FROM'
  | 'PRODUCED_ARTIFACT'
  | 'DEPENDS_ON'
  | 'APPLIES_RULE'
  | 'SUPERVISED_BY';

export interface BiTemporalTimestamps {
  /** When the event/decision actually occurred in reality */
  validTime: string;
  /** When the knowledge was ingested into the graph database */
  ingestionTime: string;
}

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  name: string;
  summary: string;
  attributes: Record<string, unknown>;
  timestamps: BiTemporalTimestamps;
}

export interface GraphRelation {
  id: string;
  sourceId: string;
  targetId: string;
  type: GraphRelationType;
  weight?: number;
  timestamps: BiTemporalTimestamps;
}

export interface DecisionRecord {
  id: string;
  agentId: string;
  agentName: string;
  title: string;
  context: string;
  chosenOption: string;
  rationale: string;
  rejectedAlternatives: string[];
  timestamps: BiTemporalTimestamps;
}

export interface EpisodeRecord {
  id: string;
  agentId: string;
  taskId: string;
  content: string;
  decisions: string[];
  lessons: string[];
  timestamps: BiTemporalTimestamps;
}

export interface GraphitiQueryResult {
  nodes: GraphNode[];
  relations: GraphRelation[];
  episodes: EpisodeRecord[];
}
