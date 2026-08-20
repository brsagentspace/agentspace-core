/**
 * @file projectController.ts
 * @description Cross-store orchestration for project (Space) switching.
 *
 * Keeps projectStore pure: this module moves agent teams in/out of the
 * simulation store, resets the terminal workspace and stamps timestamps
 * when a project is created, opened or left. The terminal workspace is
 * also mirrored into projectStore on every change (debounced), so an
 * app crash or plain quit never loses the pane layout or the Claude
 * session ids the panes resume from.
 *
 * @module services
 */

import { useAgentSpaceStore } from '../store';
import { starterTeamForDomain } from '../store/starterTeams';
import { useProjectStore } from '../store/projectStore';
import { useTerminalStore, type TerminalSnapshot } from '../store/terminalStore';
import { disposeAllTerminals } from '../components/terminal/terminalRegistry';
import { stopWorkflow } from './workflowSimulator';
import type { ProjectMeta } from '../store/projectStore';
import type { SpaceDomain } from '../types';

export interface CreateProjectOptions {
  name: string;
  blueprint: string;
  domain: SpaceDomain;
  /** Absolute working directory; empty string means "not set" */
  rootPath?: string;
  withStarterTeam: boolean;
}

/** Snapshot of the live terminal workspace (layout + session meta). */
function terminalSnapshot(): TerminalSnapshot {
  const t = useTerminalStore.getState();
  return { sessions: t.sessions, mosaicNodes: t.mosaicNodes, nextIndex: t.nextIndex };
}

/** Persists the open project's agent team and terminal workspace. */
function saveActiveProjectState(): void {
  const { activeProjectId, saveAgents, saveTerminal } = useProjectStore.getState();
  if (!activeProjectId) return;
  saveAgents(activeProjectId, useAgentSpaceStore.getState().agents);
  saveTerminal(activeProjectId, terminalSnapshot());
}

// ── Continuous terminal persistence ─────────────────────────────────────────
// While a project is switching, the terminal store briefly holds the OLD
// project's panes (or the new one's before activeProjectId flips); writes
// are suspended so nothing lands under the wrong project id.

let terminalPersistSuspended = false;
let terminalPersistTimer: number | null = null;

function scheduleTerminalPersist(): void {
  if (terminalPersistSuspended || terminalPersistTimer !== null) return;
  terminalPersistTimer = window.setTimeout(() => {
    terminalPersistTimer = null;
    if (terminalPersistSuspended) return;
    const { activeProjectId, saveTerminal } = useProjectStore.getState();
    if (activeProjectId) saveTerminal(activeProjectId, terminalSnapshot());
  }, 250);
}

if (typeof window !== 'undefined') {
  useTerminalStore.subscribe((state, prev) => {
    if (state.sessions !== prev.sessions || state.mosaicNodes !== prev.mosaicNodes || state.nextIndex !== prev.nextIndex) {
      scheduleTerminalPersist();
    }
  });
}

/** Runs a project switch with terminal persistence paused, then saves once. */
function withTerminalPersistPaused(fn: () => void): void {
  terminalPersistSuspended = true;
  if (terminalPersistTimer !== null) {
    window.clearTimeout(terminalPersistTimer);
    terminalPersistTimer = null;
  }
  try {
    fn();
  } finally {
    terminalPersistSuspended = false;
  }
  saveActiveProjectState();
}

/** Opens a project: loads its team and restores its terminal workspace. */
export function openProject(id: string): void {
  const project = useProjectStore.getState().projects.find(p => p.id === id);
  if (!project) return;

  stopWorkflow();
  withTerminalPersistPaused(() => {
    saveActiveProjectState();

    const { agentsByProject, terminalByProject, setActiveProjectId, touchProject } = useProjectStore.getState();
    const team = agentsByProject[id] ?? [];
    useAgentSpaceStore.getState().setAgents(team);
    useAgentSpaceStore.getState().setActiveBlueprint(project.blueprint);

    disposeAllTerminals();
    const snap = terminalByProject[id];
    if (snap) useTerminalStore.getState().restoreSnapshot(snap);
    else useTerminalStore.getState().resetToDefault(team);

    setActiveProjectId(id);
    touchProject(id);
  });
}

/** Creates a project (optionally seeded with the domain's starter team) and opens it. */
export function createProject(opts: CreateProjectOptions): string {
  const rootPath = opts.rootPath?.trim() || undefined;
  const meta: ProjectMeta = {
    id: `proj_${Date.now()}`,
    name: opts.name,
    blueprint: opts.blueprint,
    domain: opts.domain,
    rootPath,
    vaultPaths: [],
    createdAt: new Date().toISOString(),
    lastOpenedAt: new Date().toISOString(),
    // The demo seed is software work (features, migrations) — media Spaces start empty.
    demoMemory: opts.withStarterTeam && opts.domain === 'software',
  };
  const starterTeam = opts.withStarterTeam
    ? starterTeamForDomain(opts.domain).map(a => ({ ...a, id: `${meta.id}_${a.id}` }))
    : [];
  useProjectStore.getState().addProject(meta, starterTeam);
  openProject(meta.id);
  return meta.id;
}

/** Returns to the home screen, persisting the open project's state. */
export function goHome(): void {
  stopWorkflow();
  withTerminalPersistPaused(() => {
    saveActiveProjectState();
    useProjectStore.getState().setActiveProjectId(null);
  });
}

/**
 * Sets (or changes) a Space's working folder after creation. When the Space
 * is open, its terminals restart in the new folder: the PTYs are killed and
 * every pane re-mounts with a fresh Claude session, because Claude Code
 * stores transcripts per cwd and the old ids would not resolve there.
 */
export function setProjectRootPath(id: string, rootPath: string): void {
  const trimmed = rootPath.trim();
  const { projects, activeProjectId, updateProject } = useProjectStore.getState();
  const project = projects.find(p => p.id === id);
  if (!project || (project.rootPath ?? '') === trimmed) return;
  updateProject(id, { rootPath: trimmed || undefined });
  if (id !== activeProjectId) return;
  disposeAllTerminals();
  // Give the pty_kill IPC a beat before the same session ids respawn.
  window.setTimeout(() => useTerminalStore.getState().restartAllSessions(), 90);
}

/** Persists the live team immediately (e.g. right after adding an agent). */
export function persistTeamNow(): void {
  const { activeProjectId, saveAgents } = useProjectStore.getState();
  if (!activeProjectId) return;
  saveAgents(activeProjectId, useAgentSpaceStore.getState().agents);
}

/** Re-applies the persisted active project after a page load. */
export function hydrateActiveProject(): void {
  const { activeProjectId, agentsByProject, terminalByProject, projects } = useProjectStore.getState();
  if (!activeProjectId) return;
  useAgentSpaceStore.getState().setAgents(agentsByProject[activeProjectId] ?? []);
  const project = projects.find(p => p.id === activeProjectId);
  if (project) useAgentSpaceStore.getState().setActiveBlueprint(project.blueprint);
  const snap = terminalByProject[activeProjectId];
  if (snap) withTerminalPersistPaused(() => useTerminalStore.getState().restoreSnapshot(snap));
}
