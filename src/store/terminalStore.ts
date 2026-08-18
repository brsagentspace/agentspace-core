/**
 * @file terminalStore.ts
 * @description Zustand store for the tiled terminal workspace.
 *
 * Holds terminal sessions and the react-mosaic (v7, n-ary) layout tree.
 * Tree surgery (split/remove) happens in MultiTerminalPanel via mosaic's
 * updateTree utilities; this store is the single source of truth.
 *
 * @module store
 */

import { create } from 'zustand';
import type { MosaicNode } from 'react-mosaic-component';

export interface TerminalSession {
  id: string;
  /** Owning agent id (matches store agents, e.g. 'agent_1'); '' = plain shell */
  agentId: string;
  title: string;
  statusColor: string;
  command?: string;
}

interface TerminalState {
  sessions: Record<string, TerminalSession>;
  mosaicNodes: MosaicNode<string> | null;
  /** When set, the mosaic renders only this session (tmux-style zoom). */
  zoomedId: string | null;
  nextIndex: number;
  setMosaicNodes: (nodes: MosaicNode<string> | null) => void;
  setZoomedId: (id: string | null) => void;
  /** Creates a session record and returns its id (layout is caller's job). */
  createSession: (partial?: Partial<TerminalSession>) => string;
  removeSession: (id: string) => void;
  /** Restores the default workspace (used when switching projects). */
  resetToDefault: () => void;
}

const defaultSessions = (): Record<string, TerminalSession> => ({
  architect: { id: 'architect', agentId: 'agent_1', title: 'Architect (Tier 1)', statusColor: '#10b981', command: 'langgraph plan init' },
  frontend: { id: 'frontend', agentId: 'agent_2', title: 'Frontend-Bot', statusColor: '#8b5cf6', command: 'npm run dev' },
  backend: { id: 'backend', agentId: 'agent_3', title: 'Backend-Bot', statusColor: '#3b82f6', command: 'cargo run' },
});

const defaultTree = (): MosaicNode<string> => ({
  type: 'split',
  direction: 'column',
  children: [
    { type: 'split', direction: 'row', children: ['architect', 'frontend'] },
    'backend',
  ],
});

export const useTerminalStore = create<TerminalState>((set, get) => ({
  sessions: defaultSessions(),
  mosaicNodes: defaultTree(),
  zoomedId: null,
  nextIndex: 1,

  setMosaicNodes: (nodes) => set({ mosaicNodes: nodes }),
  setZoomedId: (id) => set({ zoomedId: id }),

  createSession: (partial) => {
    const n = get().nextIndex;
    const id = `term_${Date.now()}_${n}`;
    const session: TerminalSession = {
      id,
      agentId: '',
      title: `Terminal ${n}`,
      statusColor: '#6b7280',
      ...partial,
    };
    set((state) => ({
      sessions: { ...state.sessions, [id]: session },
      nextIndex: n + 1,
    }));
    return id;
  },

  removeSession: (id) =>
    set((state) => {
      const sessions = { ...state.sessions };
      delete sessions[id];
      return { sessions, zoomedId: state.zoomedId === id ? null : state.zoomedId };
    }),

  resetToDefault: () =>
    set({
      sessions: defaultSessions(),
      mosaicNodes: defaultTree(),
      zoomedId: null,
      nextIndex: 1,
    }),
}));
