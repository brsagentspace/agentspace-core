import { create } from 'zustand';

export interface TerminalSession {
  id: string;
  agentId: string;
  title: string;
  statusColor: string;
  command?: string;
}

interface TerminalState {
  sessions: Record<string, TerminalSession>;
  // react-mosaic tree structure (e.g. { direction: 'row', first: 'nova', second: 'emre' })
  mosaicNodes: any; 
  setMosaicNodes: (nodes: any) => void;
  addSession: (session: TerminalSession) => void;
  removeSession: (id: string) => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
  sessions: {
    architect: { id: 'architect', agentId: 'agent-1', title: 'Architect (Tier 1)', statusColor: '#10b981', command: 'langgraph plan init' },
    frontend: { id: 'frontend', agentId: 'agent-2', title: 'Frontend-Bot', statusColor: '#8b5cf6', command: 'npm run dev' },
    backend: { id: 'backend', agentId: 'agent-3', title: 'Backend-Bot', statusColor: '#3b82f6', command: 'cargo run' },
  },
  mosaicNodes: {
    direction: 'column',
    first: {
      direction: 'row',
      first: 'architect',
      second: 'frontend',
    },
    second: 'backend',
  },
  setMosaicNodes: (nodes) => set({ mosaicNodes: nodes }),
  addSession: (session) => set((state) => ({ sessions: { ...state.sessions, [session.id]: session } })),
  removeSession: (id) => set((state) => {
    const newSessions = { ...state.sessions };
    delete newSessions[id];
    return { sessions: newSessions };
  }),
}));
