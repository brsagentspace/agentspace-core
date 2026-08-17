/**
 * @file index.ts
 * @description Zustand global application store for AgentSpace.
 *
 * Manages active projects, multi-agent status, terminal tabs, system stats,
 * and blueprint selections across the entire desktop application.
 *
 * @module store
 */

import { create } from 'zustand';
import type { Agent, Project, SystemStats } from '../types';

interface AgentSpaceStore {
  /** Active project instance or null if in overview mode */
  activeProject: Project | null;
  setActiveProject: (project: Project | null) => void;

  /** Active AI agents operating within the simulation */
  agents: Agent[];
  addAgent: (agent: Agent) => void;
  updateAgent: (id: string, patch: Partial<Agent>) => void;
  removeAgent: (id: string) => void;

  /** Real-time system and resource consumption metrics */
  stats: SystemStats;
  updateStats: (patch: Partial<SystemStats>) => void;

  /** Selected terminal session ID */
  activeTerminalId: string | null;
  setActiveTerminalId: (id: string | null) => void;

  /** Selected blueprint ID (e.g., 'mobile-react-native') */
  activeBlueprint: string | null;
  setActiveBlueprint: (blueprint: string | null) => void;
}

/** Initial demo agent team to populate the office simulation */
const INITIAL_AGENTS: Agent[] = [
  {
    id: 'agent_1',
    name: 'Architect-01',
    role: 'architect',
    status: 'working',
    color: 'blue',
    modelTier: 1,
    currentTask: 'Designing domain boundaries & Graphiti schema',
    tokensUsed: 14200,
    position: { x: 220, y: 180 },
  },
  {
    id: 'agent_2',
    name: 'Frontend-Dev',
    role: 'frontend',
    status: 'thinking',
    color: 'yellow',
    modelTier: 2,
    currentTask: 'Building responsive UI components',
    tokensUsed: 8900,
    position: { x: 440, y: 180 },
  },
  {
    id: 'agent_3',
    name: 'Backend-Core',
    role: 'backend',
    status: 'working',
    color: 'green',
    modelTier: 2,
    currentTask: 'Implementing Layered Architecture services',
    tokensUsed: 11450,
    position: { x: 220, y: 360 },
  },
  {
    id: 'agent_4',
    name: 'QA-Sentinel',
    role: 'qa',
    status: 'done',
    color: 'red',
    modelTier: 3,
    currentTask: 'Running test suites and accessibility audit',
    tokensUsed: 3100,
    position: { x: 440, y: 360 },
  },
  {
    id: 'agent_5',
    name: 'Researcher-X',
    role: 'researcher',
    status: 'thinking',
    color: 'blue',
    modelTier: 2,
    currentTask: 'Analyzing Graphiti knowledge graph patterns',
    tokensUsed: 6700,
    position: { x: 600, y: 180 },
  },
  {
    id: 'agent_6',
    name: 'Data-Analyst',
    role: 'data',
    status: 'idle',
    color: 'green',
    modelTier: 3,
    currentTask: 'Processing token usage metrics',
    tokensUsed: 2200,
    position: { x: 600, y: 360 },
  },
];

export const useAgentSpaceStore = create<AgentSpaceStore>((set) => ({
  activeProject: {
    id: 'proj_default',
    name: 'AgentSpace Core Project',
    blueprint: 'web-nextjs-fullstack',
    agents: INITIAL_AGENTS,
    createdAt: new Date(),
    status: 'active',
  },
  setActiveProject: (project) => set({ activeProject: project }),

  agents: INITIAL_AGENTS,
  addAgent: (agent) =>
    set((state) => ({ agents: [...state.agents, agent] })),
  updateAgent: (id, patch) =>
    set((state) => ({
      agents: state.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    })),
  removeAgent: (id) =>
    set((state) => ({ agents: state.agents.filter((a) => a.id !== id) })),

  stats: {
    activeAgents: 2,
    cpuUsage: 14.2,
    ramUsageMB: 482,
    tokenBudget: {
      used: 37650,
      total: 100000,
      remaining: 62350,
      cacheHitRate: 0.84,
    },
  },
  updateStats: (patch) =>
    set((state) => ({ stats: { ...state.stats, ...patch } })),

  activeTerminalId: 'agent_1',
  setActiveTerminalId: (id) => set({ activeTerminalId: id }),

  activeBlueprint: 'web-nextjs-fullstack',
  setActiveBlueprint: (blueprint) => set({ activeBlueprint: blueprint }),
}));
