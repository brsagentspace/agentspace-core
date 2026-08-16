import { create } from "zustand";
import type { Agent, Project, SystemStats } from "../types";

interface AgentSpaceStore {
  // Active project
  activeProject: Project | null;
  setActiveProject: (project: Project | null) => void;

  // Agents
  agents: Agent[];
  addAgent: (agent: Agent) => void;
  updateAgent: (id: string, patch: Partial<Agent>) => void;
  removeAgent: (id: string) => void;

  // System stats
  stats: SystemStats;
  updateStats: (patch: Partial<SystemStats>) => void;

  // Active terminal tab
  activeTerminalId: string | null;
  setActiveTerminalId: (id: string | null) => void;

  // Blueprint
  activeBlueprint: string | null;
  setActiveBlueprint: (blueprint: string | null) => void;
}

export const useAgentSpaceStore = create<AgentSpaceStore>((set) => ({
  activeProject: null,
  setActiveProject: (project) => set({ activeProject: project }),

  agents: [],
  addAgent: (agent) =>
    set((state) => ({ agents: [...state.agents, agent] })),
  updateAgent: (id, patch) =>
    set((state) => ({
      agents: state.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    })),
  removeAgent: (id) =>
    set((state) => ({ agents: state.agents.filter((a) => a.id !== id) })),

  stats: {
    activeAgents: 0,
    cpuUsage: 0,
    ramUsageMB: 0,
    tokenBudget: {
      used: 0,
      total: 100000,
      remaining: 100000,
      cacheHitRate: 0,
    },
  },
  updateStats: (patch) =>
    set((state) => ({ stats: { ...state.stats, ...patch } })),

  activeTerminalId: null,
  setActiveTerminalId: (id) => set({ activeTerminalId: id }),

  activeBlueprint: null,
  setActiveBlueprint: (blueprint) => set({ activeBlueprint: blueprint }),
}));
