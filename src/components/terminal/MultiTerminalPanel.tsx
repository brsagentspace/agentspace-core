import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Mosaic, MosaicWindow, MosaicNode } from 'react-mosaic-component';
import { useTerminalStore, TerminalSession } from '../../store/terminalStore';

import '@xterm/xterm/css/xterm.css';
import 'react-mosaic-component/react-mosaic-component.css';

/**
 * A single terminal pane instance wrapper
 */
function TerminalPane({ session }: { session: TerminalSession }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const term = new Terminal({
      theme: { background: '#1e1e28', foreground: '#f8f8fb', cursor: '#8b5cf6' },
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 12,
      cursorBlink: true,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    
    // Fit takes a tiny bit of time after render
    setTimeout(() => fitAddon.fit(), 10);

    term.writeln(`\x1b[38;2;139;92;246m${session.title}\x1b[0m initialized (Dynamic Multiplexer).`);
    if (session.command) {
      term.writeln(`$ ${session.command}`);
      term.write('> ');
    }

    // Basic echoing so user can type in the terminal
    term.onData((data) => {
      const char = data;
      if (char === '\r') {
        term.write('\r\n> ');
      } else if (char === '\x7f') {
        // Backspace
        term.write('\b \b');
      } else {
        term.write(char);
      }
    });

    const resizeObserver = new ResizeObserver(() => fitAddon.fit());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      term.dispose();
    };
  }, [session]);

  return (
    <div style={{ width: '100%', height: '100%', background: '#1e1e28', overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', paddingLeft: 8, paddingTop: 4 }} />
    </div>
  );
}

export function MultiTerminalPanel() {
  const { sessions, mosaicNodes, setMosaicNodes } = useTerminalStore();

  const ELEMENT_MAP: Record<string, JSX.Element> = {};
  const TITLE_MAP: Record<string, string> = {};

  // Build maps for Mosaic Window
  Object.keys(sessions).forEach((key) => {
    ELEMENT_MAP[key] = <TerminalPane session={sessions[key]} />;
    TITLE_MAP[key] = sessions[key].title;
  });

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', background: '#13141a' }} className="mosaic-dark-theme">
      <Mosaic<string>
        renderTile={(id, path) => {
          const session = sessions[id];
          if (!session) return <div>Invalid Session</div>;

          return (
            <MosaicWindow<string>
              path={path}
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f8f8fb', fontSize: 11 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: session.statusColor }}></div>
                  {TITLE_MAP[id]}
                </div>
              }
              toolbarControls={[
                <span key="copy" style={{ cursor: 'pointer', padding: '0 4px' }}>📋</span>,
                <span key="settings" style={{ cursor: 'pointer', padding: '0 4px' }}>⚙️</span>
              ]}
              className="custom-mosaic-window"
            >
              {ELEMENT_MAP[id]}
            </MosaicWindow>
          );
        }}
        value={mosaicNodes}
        onChange={(newNode) => setMosaicNodes(newNode)}
        className="mosaic-blueprint-theme bp3-dark"
      />
    </div>
  );
}
