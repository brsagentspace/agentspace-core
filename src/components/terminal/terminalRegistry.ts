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
 * Sizing rules (TUI apps such as Claude Code / Codex redraw from the
 * terminal size, so a wrong size corrupts their screen):
 *  - a hidden pane (display:none, zero box) never re-fits — the PTY keeps
 *    the last real size instead of collapsing to FitAddon's 100px fallback;
 *  - fits are debounced so a split drag sends one SIGWINCH, not dozens;
 *  - input/resize are wired BEFORE the PTY spawns and the PTY is synced to
 *    the terminal's real size right after, so the CLI never boots at 80×24.
 *
 * @module components/terminal
 */

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebglAddon } from '@xterm/addon-webgl';
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

/**
 * Bundled via @fontsource (App.css) so the cell metrics never depend on the
 * network. No ligature fonts in the stack: xterm measures per cell.
 */
const TERMINAL_FONT_FAMILY = "'JetBrains Mono', Menlo, Monaco, monospace";
const TERMINAL_FONT_SIZE = 12;

/** Trailing debounce for container-driven fits (one SIGWINCH per drag). */
const FIT_DEBOUNCE_MS = 60;

interface RegistryEntry {
  term: Terminal;
  fit: FitAddon;
  /** Pending debounced fit, if any. */
  fitTimer: number | null;
  /** Container an `open()` is waiting on (font preload) — null once opened. */
  pendingContainer: HTMLElement | null;
  /** PTY spawned and not yet reported dead — exit events for anything else are stale. */
  ptyLive: boolean;
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

// ── Font preload ─────────────────────────────────────────────────────────────
// xterm measures the cell box once at open(); if the web font arrives later
// the grid keeps the fallback font's metrics and glyphs overflow their cells.

let fontReady: Promise<void> | null = null;

/** Resolves once the terminal font is usable (or immediately if it can't load). */
function ensureTerminalFont(): Promise<void> {
  if (!fontReady) {
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    fontReady = (fonts
      ? Promise.all([
        fonts.load(`${TERMINAL_FONT_SIZE}px "JetBrains Mono"`),
        fonts.load(`500 ${TERMINAL_FONT_SIZE}px "JetBrains Mono"`),
      ])
      : Promise.resolve([])
    ).then(() => undefined, () => undefined);
  }
  return fontReady;
}

// Kick it off at module load so the first pane rarely has to wait.
void ensureTerminalFont();

// ── Sizing ───────────────────────────────────────────────────────────────────

/** Fits now, unless the terminal is unopened, detached or hidden (zero box). */
function fitIfVisible(entry: RegistryEntry): void {
  const el = entry.term.element;
  const host = el?.parentElement;
  if (!el || !host || !el.isConnected) return;
  const { width, height } = host.getBoundingClientRect();
  // display:none ancestors give a 0×0 box; FitAddon would then read the
  // parent's computed "100%" as 100px and shrink the PTY to ~11×6.
  if (width < 1 || height < 1) return;
  entry.fit.fit();
}

/** Debounced fit — collapses resize storms into one terminal/PTY resize. */
function scheduleFit(entry: RegistryEntry): void {
  if (entry.fitTimer !== null) window.clearTimeout(entry.fitTimer);
  entry.fitTimer = window.setTimeout(() => {
    entry.fitTimer = null;
    fitIfVisible(entry);
  }, FIT_DEBOUNCE_MS);
}

/** Reacts to a container size change (ResizeObserver callback). */
export function onContainerResize(entry: RegistryEntry, rect: DOMRectReadOnly): void {
  // Hidden: keep the PTY size; the pane re-fits when it's shown again.
  if (rect.width < 1 || rect.height < 1) return;
  scheduleFit(entry);
}

// ── Rendering ────────────────────────────────────────────────────────────────

/**
 * GPU renderer for the redraw-heavy TUIs; silently stays on the DOM renderer
 * if WebGL is unavailable, and falls back again on context loss.
 */
function tryWebgl(term: Terminal): void {
  try {
    const webgl = new WebglAddon();
    webgl.onContextLoss(() => webgl.dispose());
    term.loadAddon(webgl);
  } catch {
    // DOM renderer it is.
  }
}

/**
 * Shift+Enter → ESC CR ("meta+enter"). xterm.js can't tell Shift+Enter from
 * Enter otherwise, so Claude Code / Codex would submit instead of inserting
 * a newline. Option stays a character key (Turkish layouts type @ with it).
 */
function installKeyHandler(term: Terminal): void {
  term.attachCustomKeyEventHandler((ev) => {
    if (ev.type === 'keydown' && ev.key === 'Enter' && ev.shiftKey && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      term.input('\x1b\r');
      return false;
    }
    return true;
  });
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

/** Records whether the pane's process is running, whichever Space it belongs to. */
function rememberExited(projectId: string, sessionId: string, exited: boolean): void {
  if (currentProjectId() === projectId) {
    useTerminalStore.getState().setSessionExited(sessionId, exited);
    return;
  }
  const store = useProjectStore.getState();
  const snap = store.terminalByProject[projectId];
  const session = snap?.sessions[sessionId];
  if (!snap || !session || !!session.exited === exited) return;
  store.saveTerminal(projectId, {
    ...snap,
    sessions: { ...snap.sessions, [sessionId]: { ...session, exited } },
  });
}

/** Splits a PTY id back into its Space and pane ids. */
function splitKey(key: string): [string, string] | null {
  const sep = key.indexOf(KEY_SEP);
  return sep > 0 ? [key.slice(0, sep), key.slice(sep + KEY_SEP.length)] : null;
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
    const entry = entries.get(e.payload.id);
    // A respawn reuses the id: an exit from the killed predecessor must not
    // mark the fresh terminal dead.
    if (!entry || !entry.ptyLive) return;
    entry.ptyLive = false;
    entry.term.writeln('\r\n\x1b[38;2;144;144;162m[oturum kapandı — başlıktaki ↻ ile yeniden başlat]\x1b[0m');
    const ids = splitKey(e.payload.id);
    if (ids) rememberExited(ids[0], ids[1], true);
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

  // Wire input and resize BEFORE the process exists: the first fit usually
  // lands while the spawn is in flight, and its resize used to be lost
  // (leaving the CLI at 80×24). Keystrokes typed meanwhile are replayed.
  let live = false;
  const typedEarly: string[] = [];
  entry.term.onData((data) => {
    if (live) void invoke('pty_write', { id: key, data });
    else typedEarly.push(data);
  });
  entry.term.onResize(({ cols, rows }) => {
    if (live) void invoke('pty_resize', { id: key, cols, rows });
  });

  await invoke('pty_spawn', {
    id: key,
    cols: entry.term.cols || 80,
    rows: entry.term.rows || 24,
    cwd,
    env: ctx ? buildAgentEnv(ctx) : null,
    brief: ctx ? buildAgentBrief(ctx) : null,
  });
  if (entries.get(key) !== entry) {
    // Disposed while spawning — don't leave an orphan shell behind.
    void invoke('pty_kill', { id: key }).catch(() => undefined);
    return;
  }
  live = true;
  entry.ptyLive = true;
  rememberExited(projectId, session.id, false);
  // Sync the PTY to whatever size the terminal reached during the spawn.
  await invoke('pty_resize', { id: key, cols: entry.term.cols, rows: entry.term.rows }).catch(() => undefined);
  typedEarly.splice(0).forEach((data) => { void invoke('pty_write', { id: key, data }); });

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
    fontFamily: TERMINAL_FONT_FAMILY,
    fontSize: TERMINAL_FONT_SIZE,
    lineHeight: 1.25,
    cursorBlink: true,
    scrollback: 5000,
    allowProposedApi: true,
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.loadAddon(new WebLinksAddon());
  // Unicode 11 width tables: emoji / symbols (⏺ ✅ ⚡ …) take 2 cells, the
  // same as Claude Code's string-width and Codex's unicode-width assume.
  // The built-in table is Unicode 6, which puts the cursor one cell off per
  // such glyph and corrupts the TUI redraw.
  term.loadAddon(new Unicode11Addon());
  term.unicode.activeVersion = '11';
  installKeyHandler(term);

  const engineLabel = session.command ? (session.engine ?? activeEngine) : 'shell';
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

  const entry: RegistryEntry = { term, fit, fitTimer: null, pendingContainer: null, ptyLive: false };
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

/**
 * Attaches a terminal to a container element (initial open or re-parent).
 * The first open waits for the bundled font so the cell grid is measured
 * with the real metrics; re-attaching an already open terminal is a no-op
 * when it is already inside that container (no focus loss on re-render).
 */
export function attachTerminal(entry: RegistryEntry, container: HTMLElement): void {
  const { term } = entry;
  if (!term.element) {
    entry.pendingContainer = container;
    void ensureTerminalFont().then(() => {
      const target = entry.pendingContainer;
      entry.pendingContainer = null;
      // Disposed or re-attached elsewhere while the font loaded.
      if (!target || !target.isConnected || term.element) return;
      term.open(target);
      tryWebgl(term);
      fitIfVisible(entry);
    });
    return;
  }
  if (term.element.parentElement !== container) {
    container.appendChild(term.element);
  }
  requestAnimationFrame(() => fitIfVisible(entry));
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
  if (entry.fitTimer !== null) window.clearTimeout(entry.fitTimer);
  entry.pendingContainer = null;
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

/** Terminals alive across all Spaces — the close guard asks before killing them. */
export function totalLiveTerminals(): number {
  return entries.size;
}
