/**
 * @file projectController.ts
 * @description Cross-store orchestration for project (Space) switching.
 *
 * Keeps projectStore pure: this module moves agent teams in/out of the
 * simulation store, resets the terminal workspace and stamps timestamps
 * when a project is created, opened or left.
 *
 * @module services
 */

import { useAgentSpaceStore, INITIAL_AGENTS } from '../store';
import { useProjectStore } from '../store/projectStore';
import { useTerminalStore } from '../store/terminalStore';
import { disposeAllTerminals } from '../components/terminal/terminalRegistry';
import { stopWorkflow } from './workflowSimulator';
import type { ProjectMeta } from '../store/projectStore';

/** Persists the open project's agent team and terminal workspace. */
function saveActiveProjectState(): void {
  const { activeProjectId, saveAgents, saveTerminal } = useProjectStore.getState();
  if (!activeProjectId) return;
  saveAgents(activeProjectId, useAgentSpaceStore.getState().agents);
  const t = useTerminalStore.getState();
  saveTerminal(activeProjectId, {
    sessions: t.sessions,
    mosaicNodes: t.mosaicNodes,
    nextIndex: t.nextIndex,
  });
}

/** Opens a project: loads its team and restores its terminal workspace. */
export function openProject(id: string): void {
  const project = useProjectStore.getState().projects.find(p => p.id === id);
  if (!project) return;

  stopWorkflow();
  saveActiveProjectState();

  const { agentsByProject, terminalByProject, setActiveProjectId, touchProject } = useProjectStore.getState();
  useAgentSpaceStore.getState().setAgents(agentsByProject[id] ?? []);

  disposeAllTerminals();
  const snap = terminalByProject[id];
  if (snap) useTerminalStore.getState().restoreSnapshot(snap);
  else useTerminalStore.getState().resetToDefault();

  setActiveProjectId(id);
  touchProject(id);
}

/** Creates a project (optionally seeded with the starter team) and opens it. */
export function createProject(name: string, blueprint: string, withStarterTeam: boolean): string {
  const meta: ProjectMeta = {
    id: `proj_${Date.now()}`,
    name,
    blueprint,
    createdAt: new Date().toISOString(),
    lastOpenedAt: new Date().toISOString(),
    demoMemory: withStarterTeam,
  };
  const starterTeam = withStarterTeam
    ? INITIAL_AGENTS.map(a => ({ ...a, id: `${meta.id}_${a.id}` }))
    : [];
  useProjectStore.getState().addProject(meta, starterTeam);
  openProject(meta.id);
  return meta.id;
}

/** Returns to the home screen, persisting the open project's state. */
export function goHome(): void {
  stopWorkflow();
  saveActiveProjectState();
  useProjectStore.getState().setActiveProjectId(null);
}

/** Persists the live team immediately (e.g. right after adding an agent). */
export function persistTeamNow(): void {
  const { activeProjectId, saveAgents } = useProjectStore.getState();
  if (!activeProjectId) return;
  saveAgents(activeProjectId, useAgentSpaceStore.getState().agents);
}

/** Re-applies the persisted active project after a page load. */
export function hydrateActiveProject(): void {
  const { activeProjectId, agentsByProject, terminalByProject } = useProjectStore.getState();
  if (!activeProjectId) return;
  useAgentSpaceStore.getState().setAgents(agentsByProject[activeProjectId] ?? []);
  const snap = terminalByProject[activeProjectId];
  if (snap) useTerminalStore.getState().restoreSnapshot(snap);
}
