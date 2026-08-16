/**
 * @file TerminalInstance.tsx
 * @description Renders an individual xterm.js terminal instance.
 *
 * Handles terminal initialization, theme customization, auto-resizing via
 * FitAddon, lifecycle management, and output streaming for an active agent session.
 *
 * @module components/terminal
 */

import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import './TerminalInstance.css';

interface TerminalInstanceProps {
  /** Unique ID of the agent associated with this terminal */
  agentId: string;
  /** Display name of the agent */
  agentName: string;
  /** Initial or ongoing log stream lines */
  initialLogs?: string[];
}

/**
 * Custom dark terminal color theme matching AgentSpace aesthetics.
 */
const TERMINAL_THEME = {
  background: '#0a0a0f',
  foreground: '#d4d4e0',
  cursor: '#3b82f6',
  cursorAccent: '#0a0a0f',
  selectionBackground: '#3b82f640',
  black: '#1a1a24',
  red: '#ef4444',
  green: '#3fb950',
  yellow: '#f59e0b',
  blue: '#3b82f6',
  magenta: '#a855f7',
  cyan: '#06b6d4',
  white: '#e2e2e8',
  brightBlack: '#4a4a5e',
  brightRed: '#f87171',
  brightGreen: '#4ade80',
  brightYellow: '#fbbf24',
  brightBlue: '#60a5fa',
  brightMagenta: '#c084fc',
  brightCyan: '#22d3ee',
  brightWhite: '#ffffff',
};

/**
 * Renders an xterm.js interactive terminal.
 *
 * @param props - Terminal component props
 * @returns JSX Element containing the mounted terminal
 */
export function TerminalInstance({ agentId, agentName, initialLogs }: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize xterm Terminal instance
    const term = new Terminal({
      theme: TERMINAL_THEME,
      fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, monospace",
      fontSize: 12,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'block',
      convertEol: true,
      allowTransparency: true,
      disableStdin: false,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    // Welcome banner & session prompt
    term.writeln(`\x1b[38;2;59;130;246m● AgentSpace Session Initialized\x1b[0m`);
    term.writeln(`\x1b[90mAgent: \x1b[37m${agentName} \x1b[90m(ID: ${agentId})\x1b[0m`);
    term.writeln(`\x1b[90mType commands or observe live agent task execution.\x1b[0m\n`);

    if (initialLogs && initialLogs.length > 0) {
      initialLogs.forEach((line) => term.writeln(line));
    } else {
      term.writeln(`\x1b[32m✔\x1b[0m Environment ready. Awaiting next cycle...`);
      term.write(`\x1b[34m${agentName.toLowerCase()}@agentspace\x1b[0m:\x1b[36m~/workspace\x1b[0m$ `);
    }

    // Handle user input
    let currentInput = '';
    term.onData((data) => {
      // Enter key
      if (data === '\r') {
        term.writeln('');
        if (currentInput.trim().length > 0) {
          term.writeln(`\x1b[90m[exec]\x1b[0m command not recognized in sandbox: "${currentInput.trim()}"`);
        }
        currentInput = '';
        term.write(`\x1b[34m${agentName.toLowerCase()}@agentspace\x1b[0m:\x1b[36m~/workspace\x1b[0m$ `);
      }
      // Backspace
      else if (data === '\u007F') {
        if (currentInput.length > 0) {
          currentInput = currentInput.slice(0, -1);
          term.write('\b \b');
        }
      }
      // Printable characters
      else if (data >= ' ') {
        currentInput += data;
        term.write(data);
      }
    });

    // Auto-fit on window or container resize
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch {
        // Ignored during unmounting transitions
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      term.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [agentId, agentName]);

  return <div ref={containerRef} className="terminal-instance" />;
}
