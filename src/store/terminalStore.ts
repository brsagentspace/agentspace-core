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
import { useSettingsStore } from './settingsStore';
import type { Agent } from '../types';

export interface TerminalSession {
  id: string;
  /** Owning agent id (matches store agents, e.g. 'agent_1'); '' = plain shell */
  agentId: string;
  title: string;
  statusColor: string;
  command?: string;
  /** CLI engine this session runs (claude/codex/gemini); falls back to global */
  engine?: string;
  /**
   * Claude Code conversation id bound to this pane. First launch passes it
   * as `--session-id`; later launches (app restart, engine switch back to
   * claude) `--resume` it, so the conversation outlives the process.
   */
  claudeSessionId?: string;
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
  /** Switches a session's CLI engine (caller restarts its terminal). */
  setSessionEngine: (id: string, engine: string) => void;
  /** Remembers the Claude conversation a pane is running. */
  setClaudeSessionId: (id: string, claudeSessionId: string) => void;
  /**
   * Replaces every session object (panes re-mount their terminals) and
   * drops the Claude session ids — used when the Space's working folder
   * changes, since Claude keeps transcripts per cwd.
   */
  restartAllSessions: () => void;
  /** Restores the default workspace (used when switching projects). */
  /** Rebuilds the workspace — one pane per agent when a team is given. */
  resetToDefault: (team?: Agent[]) => void;
  /** Restores a previously saved workspace snapshot (project switching). */
  restoreSnapshot: (snap: TerminalSnapshot) => void;
}

/** Serializable terminal workspace state, saved per project. */
export interface TerminalSnapshot {
  sessions: Record<string, TerminalSession>;
  mosaicNodes: MosaicNode<string> | null;
  nextIndex: number;
}

/** Agent sessions launch the active CLI engine (claude/codex/gemini). */
export function engineCommand(): string {
  return useSettingsStore.getState().activeEngine || 'claude';
}

const defaultSessions = (): Record<string, TerminalSession> => {
  const cmd = engineCommand();
  return {
    architect: { id: 'architect', agentId: 'agent_1', title: 'Architect (Tier 1)', statusColor: '#10b981', command: cmd, engine: cmd },
    frontend: { id: 'frontend', agentId: 'agent_2', title: 'Frontend-Bot', statusColor: '#8b5cf6', command: cmd, engine: cmd },
    backend: { id: 'backend', agentId: 'agent_3', title: 'Backend-Bot', statusColor: '#3b82f6', command: cmd, engine: cmd },
  };
};

const defaultTree = (): MosaicNode<string> => ({
  type: 'split',
  direction: 'column',
  children: [
    { type: 'split', direction: 'row', children: ['architect', 'frontend'] },
    'backend',
  ],
});

const AGENT_COLOR_HEX: Record<string, string> = {
  blue: '#3b82f6', yellow: '#f59e0b', red: '#ef4444', green: '#10b981',
};

/** Team-driven workspace: one pane per agent (first three), 2-over-1 layout. */
function teamWorkspace(team: Agent[]): { sessions: Record<string, TerminalSession>; tree: MosaicNode<string> } {
  const cmd = engineCommand();
  const members = team.slice(0, 3);
  const sessions: Record<string, TerminalSession> = {};
  members.forEach((a, i) => {
    const id = `agent_pane_${i + 1}`;
    sessions[id] = {
      id, agentId: a.id, title: a.name,
      statusColor: AGENT_COLOR_HEX[a.color] ?? '#8b5cf6',
      command: cmd, engine: cmd,
    };
  });
  const ids = Object.keys(sessions);
  const tree: MosaicNode<string> = ids.length === 3
    ? { type: 'split', direction: 'column', children: [{ type: 'split', direction: 'row', children: [ids[0], ids[1]] }, ids[2]] }
    : ids.length === 2
      ? { type: 'split', direction: 'row', children: [ids[0], ids[1]] }
      : ids[0];
  return { sessions, tree };
}

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
      engine: partial?.engine ?? partial?.command ?? engineCommand(),
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

  setSessionEngine: (id, engine) =>
    set((state) => {
      const session = state.sessions[id];
      if (!session) return state;
      return {
        sessions: {
          ...state.sessions,
          [id]: { ...session, engine, command: engine },
        },
      };
    }),

  setClaudeSessionId: (id, claudeSessionId) =>
    set((state) => {
      const session = state.sessions[id];
      if (!session || session.claudeSessionId === claudeSessionId) return state;
      return { sessions: { ...state.sessions, [id]: { ...session, claudeSessionId } } };
    }),

  restartAllSessions: () =>
    set((state) => {
      const sessions: Record<string, TerminalSession> = {};
      Object.values(state.sessions).forEach(({ claudeSessionId: _dropped, ...rest }) => {
        sessions[rest.id] = { ...rest };
      });
      return { sessions };
    }),

  resetToDefault: (team) => {
    if (team && team.length > 0) {
      const { sessions, tree } = teamWorkspace(team);
      set({ sessions, mosaicNodes: tree, zoomedId: null, nextIndex: 1 });
      return;
    }
    set({
      sessions: defaultSessions(),
      mosaicNodes: defaultTree(),
      zoomedId: null,
      nextIndex: 1,
    });
  },

  restoreSnapshot: (snap) =>
    set({
      sessions: snap.sessions,
      mosaicNodes: snap.mosaicNodes,
      zoomedId: null,
      nextIndex: snap.nextIndex,
    }),
}));
