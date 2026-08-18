/**
 * @file memoryJournalStore.ts
 * @description Runtime memory journal — records produced while the app runs.
 *
 * The demo seed is static; this journal captures live events (agent joins,
 * completed work cycles) per project, persisted to localStorage. The
 * memory map merges seed + journal via services/memory/projectMemory.
 *
 * @module store
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GraphNode, GraphRelation } from '../types/knowledgeGraph';

export interface JournalEntry {
  node: GraphNode;
  relations: GraphRelation[];
}

interface MemoryJournalState {
  byProject: Record<string, JournalEntry[]>;
  record: (projectId: string, entry: JournalEntry) => void;
  clearProject: (projectId: string) => void;
}

export const useMemoryJournalStore = create<MemoryJournalState>()(
  persist(
    (set) => ({
      byProject: {},

      record: (projectId, entry) =>
        set((s) => ({
          byProject: {
            ...s.byProject,
            [projectId]: [...(s.byProject[projectId] ?? []), entry],
          },
        })),

      clearProject: (projectId) =>
        set((s) => {
          const byProject = { ...s.byProject };
          delete byProject[projectId];
          return { byProject };
        }),
    }),
    { name: 'agentspace-memory-journal' },
  ),
);
