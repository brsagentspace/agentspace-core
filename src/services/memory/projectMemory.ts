/**
 * @file projectMemory.ts
 * @description Builds the memory graph for the ACTIVE project.
 *
 * Composition: agent anchor nodes from the project's live team
 * + (optionally) the demo seed remapped onto the team
 * + runtime journal entries recorded while the app runs.
 *
 * @module services/memory
 */

import { JsonMemoryStore } from './MemoryStore';
import type { MemoryGraphData } from './MemoryStore';
import { useMemoryJournalStore } from '../../store/memoryJournalStore';
import type { Agent } from '../../types';
import type { GraphNode, GraphNodeType, GraphRelationType } from '../../types/knowledgeGraph';

const seedStore = new JsonMemoryStore();

/** Maps a seed agent id ('agent_3') onto the project's team member. */
function remapAgentId(seedId: string, team: Agent[]): string | null {
  const direct = team.find(a => a.id === seedId || a.id.endsWith(`_${seedId}`));
  return direct?.id ?? null;
}

export async function loadProjectMemory(
  projectId: string | null,
  team: Agent[],
  includeDemoSeed: boolean,
): Promise<MemoryGraphData> {
  const agents: Record<string, string> = Object.fromEntries(team.map(a => [a.id, a.name]));

  const anchorNodes: GraphNode[] = team.map(a => ({
    id: a.id,
    type: 'Agent' as GraphNodeType,
    name: a.name,
    summary: `${a.name} ajanının hafıza kümesi`,
    attributes: { agentId: a.id },
    timestamps: { validTime: new Date(0).toISOString(), ingestionTime: new Date(0).toISOString() },
  }));

  const data: MemoryGraphData = {
    nodes: [...anchorNodes],
    relations: [],
    indexedFiles: 0,
    indexedChunks: 0,
    agents,
  };

  if (includeDemoSeed && team.length > 0) {
    const seed = await seedStore.load();
    const seedAgentIds = new Set(Object.keys(seed.agents));
    const idMap = new Map<string, string>();
    let rr = 0;
    seedAgentIds.forEach(sid => {
      const mapped = remapAgentId(sid, team) ?? team[rr++ % team.length].id;
      idMap.set(sid, mapped);
    });

    seed.nodes.forEach(n => {
      if (n.type === 'Agent') return; // anchors come from the live team
      const owner = idMap.get(n.attributes.agentId as string) ?? team[0].id;
      data.nodes.push({ ...n, attributes: { ...n.attributes, agentId: owner } });
    });
    seed.relations.forEach(r => {
      data.relations.push({
        ...r,
        sourceId: idMap.get(r.sourceId) ?? r.sourceId,
        targetId: idMap.get(r.targetId) ?? r.targetId,
      });
    });
    data.indexedFiles = seed.indexedFiles;
    data.indexedChunks = seed.indexedChunks;
  }

  if (projectId) {
    const journal = useMemoryJournalStore.getState().byProject[projectId] ?? [];
    journal.forEach(entry => {
      data.nodes.push(entry.node);
      data.relations.push(...entry.relations);
    });
    data.indexedFiles += journal.length;
    data.indexedChunks += journal.length * 4;
  }

  return data;
}

const OWNER_REL: Record<string, GraphRelationType> = {
  Decision: 'DECIDED_BY',
  Lesson: 'LEARNED_FROM',
  Task: 'SUPERVISED_BY',
  Artifact: 'PRODUCED_ARTIFACT',
};

let seq = 0;

/** Records a live memory into the project journal (shows up on the map). */
export function recordProjectMemory(
  projectId: string,
  agentId: string,
  type: GraphNodeType,
  name: string,
  summary: string,
): void {
  const now = new Date().toISOString();
  const id = `jmem_${Date.now()}_${seq++}`;
  useMemoryJournalStore.getState().record(projectId, {
    node: {
      id, type, name, summary,
      attributes: { agentId, source: 'journal' },
      timestamps: { validTime: now, ingestionTime: now },
    },
    relations: [{
      id: `jrel_${Date.now()}_${seq++}`,
      sourceId: id,
      targetId: agentId,
      type: OWNER_REL[type] ?? 'SUPERVISED_BY',
      timestamps: { validTime: now, ingestionTime: now },
    }],
  });
}
