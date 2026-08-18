/**
 * @file projectStore.ts
 * @description Project (Space) registry with localStorage persistence.
 *
 * A project owns its agent team (and later: memory vault path, rules,
 * terminal layout). Cross-store orchestration (loading a project's agents
 * into the simulation, resetting terminals) lives in
 * services/projectController.ts — this store is pure state.
 *
 * @module store
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Agent } from '../types';

export interface ProjectMeta {
  id: string;
  name: string;
  blueprint: string;
  createdAt: string;
  lastOpenedAt: string;
}

interface ProjectState {
  projects: ProjectMeta[];
  activeProjectId: string | null;
  /** Saved agent team per project */
  agentsByProject: Record<string, Agent[]>;

  addProject: (meta: ProjectMeta, agents: Agent[]) => void;
  setActiveProjectId: (id: string | null) => void;
  saveAgents: (projectId: string, agents: Agent[]) => void;
  touchProject: (id: string) => void;
  deleteProject: (id: string) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      projects: [],
      activeProjectId: null,
      agentsByProject: {},

      addProject: (meta, agents) =>
        set((s) => ({
          projects: [...s.projects, meta],
          agentsByProject: { ...s.agentsByProject, [meta.id]: agents },
        })),

      setActiveProjectId: (id) => set({ activeProjectId: id }),

      saveAgents: (projectId, agents) =>
        set((s) => ({
          agentsByProject: { ...s.agentsByProject, [projectId]: agents },
        })),

      touchProject: (id) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, lastOpenedAt: new Date().toISOString() } : p,
          ),
        })),

      deleteProject: (id) =>
        set((s) => {
          const agentsByProject = { ...s.agentsByProject };
          delete agentsByProject[id];
          return {
            projects: s.projects.filter((p) => p.id !== id),
            agentsByProject,
            activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
          };
        }),
    }),
    { name: 'agentspace-projects' },
  ),
);
