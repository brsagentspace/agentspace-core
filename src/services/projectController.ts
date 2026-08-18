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
import type { ProjectMeta } from '../store/projectStore';

/** Persists the currently open project's agent team back into the registry. */
function saveActiveProjectAgents(): void {
  const { activeProjectId, saveAgents } = useProjectStore.getState();
  if (!activeProjectId) return;
  saveAgents(activeProjectId, useAgentSpaceStore.getState().agents);
}

/** Opens a project: loads its team and gives it a fresh terminal workspace. */
export function openProject(id: string): void {
  const project = useProjectStore.getState().projects.find(p => p.id === id);
  if (!project) return;

  saveActiveProjectAgents();

  const { agentsByProject, setActiveProjectId, touchProject } = useProjectStore.getState();
  useAgentSpaceStore.getState().setAgents(agentsByProject[id] ?? []);

  disposeAllTerminals();
  useTerminalStore.getState().resetToDefault();

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
  saveActiveProjectAgents();
  useProjectStore.getState().setActiveProjectId(null);
}

/** Re-applies the persisted active project after a page load. */
export function hydrateActiveProject(): void {
  const { activeProjectId, agentsByProject } = useProjectStore.getState();
  if (!activeProjectId) return;
  useAgentSpaceStore.getState().setAgents(agentsByProject[activeProjectId] ?? []);
}
