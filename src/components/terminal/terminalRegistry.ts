/**
 * @file terminalRegistry.ts
 * @description Module-level registry of live xterm instances.
 *
 * Terminals live OUTSIDE React: mosaic tree changes remount panes, and a
 * terminal recreated on every remount would lose its scrollback. Panes only
 * attach/detach the terminal's DOM element; the instance (and its buffer)
 * survives until the session is explicitly disposed.
 *
 * @module components/terminal
 */

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import type { TerminalSession } from '../../store/terminalStore';
import { activeProjectRootPath } from '../../store/projectStore';

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

const entries = new Map<string, RegistryEntry>();

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

async function connectPty(session: TerminalSession, entry: RegistryEntry): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  await ensurePtyListeners();
  await invoke('pty_spawn', {
    id: session.id,
    cols: entry.term.cols || 80,
    rows: entry.term.rows || 24,
    cwd: activeProjectRootPath(),
  });
  entry.term.onData((data) => { void invoke('pty_write', { id: session.id, data }); });
  entry.term.onResize(({ cols, rows }) => { void invoke('pty_resize', { id: session.id, cols, rows }); });
  if (session.command) {
    void invoke('pty_write', { id: session.id, data: `${session.command}\n` });
  }
}

/**
 * Returns the live terminal for a session, creating (and booting) it on
 * first request.
 */
export function getOrCreateTerminal(session: TerminalSession, activeEngine: string): RegistryEntry {
  const existing = entries.get(session.id);
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
  if (cwd) term.writeln(`\x1b[38;2;144;144;162mÇalışma klasörü: ${cwd}\x1b[0m`);

  const entry = { term, fit };
  entries.set(session.id, entry);

  if (IS_TAURI) {
    // Real shell via the Tauri PTY bridge.
    void connectPty(session, entry).catch((err) => {
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

function killPty(sessionId: string): void {
  if (!IS_TAURI) return;
  void import('@tauri-apps/api/core').then(({ invoke }) =>
    invoke('pty_kill', { id: sessionId }).catch(() => undefined),
  );
}

/** Permanently destroys a session's terminal (called when the session is closed). */
export function disposeTerminal(sessionId: string): void {
  const entry = entries.get(sessionId);
  if (!entry) return;
  entry.term.dispose();
  entries.delete(sessionId);
  killPty(sessionId);
}

/** Destroys every live terminal (used when switching projects). */
export function disposeAllTerminals(): void {
  entries.forEach((entry, id) => {
    entry.term.dispose();
    killPty(id);
  });
  entries.clear();
}
