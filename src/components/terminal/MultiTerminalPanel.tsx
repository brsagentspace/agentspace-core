/**
 * @file MultiTerminalPanel.tsx
 * @description Tiled terminal workspace (react-mosaic + xterm).
 *
 * Terminal instances live in terminalRegistry (outside React) so mosaic
 * tree changes never destroy scrollback; panes only attach the terminal's
 * DOM element. Toolbar actions use lucide icons.
 *
 * @module components/terminal
 */

import React, { useEffect, useRef } from 'react';
import { Copy } from 'lucide-react';
import { Mosaic, MosaicWindow } from 'react-mosaic-component';
import { useTerminalStore } from '../../store/terminalStore';
import type { TerminalSession } from '../../store/terminalStore';
import { useSettingsStore } from '../../store/settingsStore';
import { getOrCreateTerminal, attachTerminal } from './terminalRegistry';

import '@xterm/xterm/css/xterm.css';
import 'react-mosaic-component/react-mosaic-component.css';
import './MultiTerminalPanel.css';

/** Attaches the session's persistent terminal into this pane. */
function TerminalPane({ session }: { session: TerminalSession }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeEngine = useSettingsStore(s => s.activeEngine);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const entry = getOrCreateTerminal(session, activeEngine);
    attachTerminal(entry, el);
    const ro = new ResizeObserver(() => entry.fit.fit());
    ro.observe(el);
    return () => ro.disconnect();
  }, [session, activeEngine]);

  return (
    <div className="term-pane">
      <div ref={containerRef} />
    </div>
  );
}

export function MultiTerminalPanel() {
  const { sessions, mosaicNodes, setMosaicNodes } = useTerminalStore();
  const activeEngine = useSettingsStore(s => s.activeEngine);

  const copySelection = (session: TerminalSession) => {
    const { term } = getOrCreateTerminal(session, activeEngine);
    const selection = term.getSelection();
    if (selection) void navigator.clipboard.writeText(selection);
  };

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <Mosaic<string>
        className="mosaic-agentspace"
        renderTile={(id, path) => {
          const session = sessions[id];
          if (!session) return <div className="term-pane" />;

          const controls: React.ReactNode[] = [
            <div
              key="status"
              className="term-status-dot"
              style={{ background: session.statusColor }}
            />,
            <button
              key="copy"
              className="term-action"
              title="Seçimi kopyala"
              onClick={() => copySelection(session)}
            >
              <Copy size={13} />
            </button>,
          ];

          return (
            <MosaicWindow<string> path={path} title={session.title} toolbarControls={controls}>
              <TerminalPane session={session} />
            </MosaicWindow>
          );
        }}
        value={mosaicNodes}
        onChange={setMosaicNodes}
      />
    </div>
  );
}
