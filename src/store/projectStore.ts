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
import type { Agent, SpaceDomain } from '../types';
import type { TerminalSnapshot } from './terminalStore';

export interface ProjectMeta {
  id: string;
  name: string;
  blueprint: string;
  createdAt: string;
  lastOpenedAt: string;
  /** Seed the memory map with the demo graph (set at creation) */
  demoMemory?: boolean;
  /** What kind of work this Space hosts; legacy records are 'software' */
  domain?: SpaceDomain;
  /**
   * Working directory on this machine (terminal cwd, default vault root).
   * Only the PATH is stored — never project files; the repo is public.
   */
  rootPath?: string;
  /** Markdown folders loaded into the memory map (absolute paths) */
  vaultPaths?: string[];
}

/** Domain of a project, tolerant of records created before the field existed. */
export function projectDomain(meta: ProjectMeta | undefined | null): SpaceDomain {
  return meta?.domain ?? 'software';
}

interface ProjectState {
  projects: ProjectMeta[];
  activeProjectId: string | null;
  /** Saved agent team per project */
  agentsByProject: Record<string, Agent[]>;
  /** Saved terminal workspace (layout + session meta) per project */
  terminalByProject: Record<string, TerminalSnapshot>;

  addProject: (meta: ProjectMeta, agents: Agent[]) => void;
  setActiveProjectId: (id: string | null) => void;
  saveAgents: (projectId: string, agents: Agent[]) => void;
  saveTerminal: (projectId: string, snap: TerminalSnapshot) => void;
  touchProject: (id: string) => void;
  updateProject: (id: string, patch: Partial<Omit<ProjectMeta, 'id'>>) => void;
  deleteProject: (id: string) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      projects: [],
      activeProjectId: null,
      agentsByProject: {},
      terminalByProject: {},

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

      saveTerminal: (projectId, snap) =>
        set((s) => ({
          terminalByProject: { ...s.terminalByProject, [projectId]: snap },
        })),

      touchProject: (id) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, lastOpenedAt: new Date().toISOString() } : p,
          ),
        })),

      updateProject: (id, patch) =>
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),

      deleteProject: (id) =>
        set((s) => {
          const agentsByProject = { ...s.agentsByProject };
          delete agentsByProject[id];
          const terminalByProject = { ...s.terminalByProject };
          delete terminalByProject[id];
          return {
            projects: s.projects.filter((p) => p.id !== id),
            agentsByProject,
            terminalByProject,
            activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
          };
        }),
    }),
    { name: 'agentspace-projects' },
  ),
);
