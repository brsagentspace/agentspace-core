/**
 * @file terminalRegistry.ts
 * @description Module-level registry of live xterm instances.
 *
 * Terminals live OUTSIDE React: mosaic tree changes remount panes, and a
 * terminal recreated on every remount would lose its scrollback. Panes only
 * attach/detach the terminal's DOM element; the instance (and its buffer)
 * survives until the session is explicitly disposed.
 *
 * Entries are keyed per Space (`<projectId>__<sessionId>`), so switching
 * Spaces merely detaches a Space's terminals: their PTYs, CLI processes and
 * scrollback keep running in the background and are re-attached untouched
 * when the Space is opened again.
 *
 * @module components/terminal
 */

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { useTerminalStore, type TerminalSession } from '../../store/terminalStore';
import { activeProject, activeProjectRootPath, useProjectStore } from '../../store/projectStore';
import { useAgentSpaceStore } from '../../store';
import { resolveBlueprint } from '../../lib/blueprintEngine';
import {
  buildAgentBrief, buildAgentEnv, engineLaunchCommand, type BriefContext,
} from '../../services/agentBrief';
import { planClaudeLaunch } from '../../services/claudeSessions';

/** True when running inside the Tauri shell (real PTY available). */
const IS_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** Dark theme aligned with the app palette (see App.css / MemoryView). */
const TERMINAL_THEME = {
  background: '#0d0f15',
  foreground: '#e8e8f0',
  cursor: '#8b5cf6',
  cursorAccent: '#0d0f15',
  selectionBackground: 'rgba(139, 92, 246, 0.35)',
  black: '#1a1b26',
  brightBlack: '#4a4a5c',
  blue: '#60a5fa',
  brightBlue: '#93c5fd',
  green: '#34d399',
  brightGreen: '#6ee7b7',
  magenta: '#a78bfa',
  brightMagenta: '#c4b5fd',
  cyan: '#22d3ee',
  brightCyan: '#67e8f9',
  red: '#f87171',
  brightRed: '#fca5a5',
  yellow: '#fbbf24',
  brightYellow: '#fcd34d',
  white: '#d8d8e8',
  brightWhite: '#f8f8fb',
};

interface RegistryEntry {
  term: Terminal;
  fit: FitAddon;
}

/** Keyed by `ptyKey(projectId, sessionId)`. */
const entries = new Map<string, RegistryEntry>();

const KEY_SEP = '__';

/** Registry / PTY id for a pane — Space-scoped, since pane ids repeat across Spaces. */
function ptyKey(projectId: string, sessionId: string): string {
  return `${projectId}${KEY_SEP}${sessionId}`;
}

function currentProjectId(): string {
  return activeProject()?.id ?? 'none';
}

/** Stores the Claude id on the pane, whichever Space it now belongs to. */
function rememberClaudeSessionId(projectId: string, sessionId: string, claudeSessionId: string): void {
  if (currentProjectId() === projectId) {
    useTerminalStore.getState().setClaudeSessionId(sessionId, claudeSessionId);
    return;
  }
  // The Space was switched away while the PTY was still booting — patch its saved snapshot.
  const store = useProjectStore.getState();
  const snap = store.terminalByProject[projectId];
  const session = snap?.sessions[sessionId];
  if (!snap || !session || session.claudeSessionId === claudeSessionId) return;
  store.saveTerminal(projectId, {
    ...snap,
    sessions: { ...snap.sessions, [sessionId]: { ...session, claudeSessionId } },
  });
}

// ── Tauri PTY bridge ─────────────────────────────────────────────────────────
// One global event listener routes pty-output chunks to the owning terminal.

let ptyListenersReady = false;

async function ensurePtyListeners(): Promise<void> {
  if (ptyListenersReady || !IS_TAURI) return;
  ptyListenersReady = true;
  const { listen } = await import('@tauri-apps/api/event');
  await listen<{ id: string; data: string }>('pty-output', (e) => {
    entries.get(e.payload.id)?.term.write(e.payload.data);
  });
  await listen<{ id: string }>('pty-exit', (e) => {
    entries.get(e.payload.id)?.term.writeln('\r\n\x1b[38;2;144;144;162m[oturum kapandı]\x1b[0m');
  });
}

/**
 * Collects the Space / agent / blueprint context for a session. Returns null
 * outside a project; a blueprint that fails to resolve degrades to a brief
 * without the rules block instead of blocking the terminal.
 */
async function briefContextFor(session: TerminalSession): Promise<BriefContext | null> {
  const project = activeProject();
  if (!project) return null;
  const team = useAgentSpaceStore.getState().agents;
  const agent = team.find(a => a.id === session.agentId) ?? null;
  const blueprint = await resolveBlueprint(project.blueprint).catch(() => null);
  return { project, agent, team, blueprint };
}

async function connectPty(session: TerminalSession, entry: RegistryEntry, projectId: string, key: string): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  await ensurePtyListeners();
  const ctx = await briefContextFor(session);
  const cwd = activeProjectRootPath();
  await invoke('pty_spawn', {
    id: key,
    cols: entry.term.cols || 80,
    rows: entry.term.rows || 24,
    cwd,
    env: ctx ? buildAgentEnv(ctx) : null,
    brief: ctx ? buildAgentBrief(ctx) : null,
  });
  entry.term.onData((data) => { void invoke('pty_write', { id: key, data }); });
  entry.term.onResize(({ cols, rows }) => { void invoke('pty_resize', { id: key, cols, rows }); });
  if (session.command) {
    // Agent sessions store the bare engine name; claude additionally
    // ingests the brief as an appended system prompt and keeps its
    // conversation across restarts via a pane-bound session id.
    const isEngine = !!session.engine && session.command === session.engine;
    let launch = session.command;
    if (isEngine && session.engine === 'claude') {
      const plan = await planClaudeLaunch(cwd, session.claudeSessionId);
      rememberClaudeSessionId(projectId, session.id, plan.sessionId);
      launch = engineLaunchCommand('claude', ctx, plan);
      entry.term.writeln(
        plan.mode === 'resume'
          ? `\x1b[38;2;52;211;153m↻ Claude oturumu kaldığı yerden devam ediyor (${plan.sessionId.slice(0, 8)}).\x1b[0m`
          : `\x1b[38;2;144;144;162mYeni Claude oturumu: ${plan.sessionId.slice(0, 8)}\x1b[0m`,
      );
    } else if (isEngine) {
      launch = engineLaunchCommand(session.engine!, ctx);
    }
    void invoke('pty_write', { id: key, data: `${launch}\n` });
  }
}

/**
 * Returns the live terminal for a session, creating (and booting) it on
 * first request.
 */
export function getOrCreateTerminal(session: TerminalSession, activeEngine: string): RegistryEntry {
  const projectId = currentProjectId();
  const key = ptyKey(projectId, session.id);
  const existing = entries.get(key);
  if (existing) return existing;

  const term = new Terminal({
    theme: TERMINAL_THEME,
    fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, monospace",
    fontSize: 12,
    lineHeight: 1.25,
    cursorBlink: true,
    scrollback: 5000,
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.loadAddon(new WebLinksAddon());

  const engineLabel = session.engine ?? activeEngine;
  term.writeln(`\x1b[38;2;139;92;246m${session.title}\x1b[0m oturumu hazır.`);
  term.writeln(`\x1b[38;2;144;144;162mCLI motoru: [${engineLabel}] bağlı.\x1b[0m`);
  const cwd = activeProjectRootPath();
  const project = activeProject();
  if (cwd) {
    term.writeln(`\x1b[38;2;144;144;162mÇalışma klasörü: ${cwd}\x1b[0m`);
  } else if (project) {
    term.writeln('\x1b[38;2;251;191;36m⚠ Bu Space için çalışma klasörü seçilmedi — ev dizininde açıldı. Şeritteki "Klasör seç" ile ayarla.\x1b[0m');
  }
  if (project) {
    const agent = useAgentSpaceStore.getState().agents.find(a => a.id === session.agentId);
    const who = agent ? ` · ajan ${agent.name} (${agent.role})` : '';
    term.writeln(`\x1b[38;2;144;144;162mBağlam: Space "${project.name}"${who} · blueprint ${project.blueprint}\x1b[0m`);
  }

  const entry = { term, fit };
  entries.set(key, entry);

  if (IS_TAURI) {
    // Real shell via the Tauri PTY bridge.
    void connectPty(session, entry, projectId, key).catch((err) => {
      term.writeln(`\x1b[38;2;248;113;113mPTY başlatılamadı: ${String(err)}\x1b[0m`);
    });
  } else {
    // Browser dev fallback: demo echo.
    term.writeln('\x1b[38;2;251;191;36m⚠ Tarayıcı demo modu — gerçek shell yalnızca masaüstü uygulamada (npm run tauri dev).\x1b[0m');
    if (session.command) term.writeln(`$ ${session.command}`);
    term.write('> ');
    term.onData((data) => {
      if (data === '\r') term.write('\r\n> ');
      else if (data === '\x7f') term.write('\b \b');
      else term.write(data);
    });
  }

  return entry;
}

/** Attaches a terminal to a container element (initial open or re-parent). */
export function attachTerminal(entry: RegistryEntry, container: HTMLElement): void {
  if (!entry.term.element) {
    entry.term.open(container);
  } else {
    container.appendChild(entry.term.element);
  }
  requestAnimationFrame(() => entry.fit.fit());
}

function killPty(key: string): void {
  if (!IS_TAURI) return;
  void import('@tauri-apps/api/core').then(({ invoke }) =>
    invoke('pty_kill', { id: key }).catch(() => undefined),
  );
}

function disposeKey(key: string): void {
  const entry = entries.get(key);
  if (!entry) return;
  entry.term.dispose();
  entries.delete(key);
  killPty(key);
}

/** Permanently destroys a pane's terminal in the open Space (pane closed / engine switch). */
export function disposeTerminal(sessionId: string): void {
  disposeKey(ptyKey(currentProjectId(), sessionId));
}

/**
 * Destroys every terminal of one Space — its processes included. Used when
 * the Space is deleted or its working folder changes; NOT on Space switch,
 * which keeps them alive in the background.
 */
export function disposeProjectTerminals(projectId: string): void {
  const prefix = `${projectId}${KEY_SEP}`;
  Array.from(entries.keys())
    .filter(key => key.startsWith(prefix))
    .forEach(disposeKey);
}

/** Number of terminals (and their processes) a Space keeps running. */
export function liveTerminalCount(projectId: string): number {
  const prefix = `${projectId}${KEY_SEP}`;
  let n = 0;
  entries.forEach((_entry, key) => { if (key.startsWith(prefix)) n += 1; });
  return n;
}
