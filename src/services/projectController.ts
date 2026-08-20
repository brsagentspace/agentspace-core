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

import { useAgentSpaceStore } from '../store';
import { starterTeamForDomain } from '../store/starterTeams';
import { useProjectStore } from '../store/projectStore';
import { useTerminalStore } from '../store/terminalStore';
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
  const team = agentsByProject[id] ?? [];
  useAgentSpaceStore.getState().setAgents(team);
  useAgentSpaceStore.getState().setActiveBlueprint(project.blueprint);

  disposeAllTerminals();
  const snap = terminalByProject[id];
  if (snap) useTerminalStore.getState().restoreSnapshot(snap);
  else useTerminalStore.getState().resetToDefault(team);

  setActiveProjectId(id);
  touchProject(id);
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
  const { activeProjectId, agentsByProject, terminalByProject, projects } = useProjectStore.getState();
  if (!activeProjectId) return;
  useAgentSpaceStore.getState().setAgents(agentsByProject[activeProjectId] ?? []);
  const project = projects.find(p => p.id === activeProjectId);
  if (project) useAgentSpaceStore.getState().setActiveBlueprint(project.blueprint);
  const snap = terminalByProject[activeProjectId];
  if (snap) useTerminalStore.getState().restoreSnapshot(snap);
}
