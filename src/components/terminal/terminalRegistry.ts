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

  term.writeln(`\x1b[38;2;139;92;246m${session.title}\x1b[0m oturumu hazır.`);
  term.writeln(`\x1b[38;2;144;144;162mCLI motoru: [${activeEngine}] bağlı.\x1b[0m`);
  if (session.command) {
    term.writeln(`$ ${session.command}`);
  }
  term.write('> ');

  // Demo echo until the real PTY bridge (Tauri) lands.
  term.onData((data) => {
    if (data === '\r') term.write('\r\n> ');
    else if (data === '\x7f') term.write('\b \b');
    else term.write(data);
  });

  const entry = { term, fit };
  entries.set(session.id, entry);
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

/** Permanently destroys a session's terminal (called when the session is closed). */
export function disposeTerminal(sessionId: string): void {
  const entry = entries.get(sessionId);
  if (!entry) return;
  entry.term.dispose();
  entries.delete(sessionId);
}

/** Destroys every live terminal (used when switching projects). */
export function disposeAllTerminals(): void {
  entries.forEach((entry) => entry.term.dispose());
  entries.clear();
}
