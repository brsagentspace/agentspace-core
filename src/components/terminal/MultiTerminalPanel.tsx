/**
 * @file MultiTerminalPanel.tsx
 * @description Tiled terminal workspace (react-mosaic v7 + xterm).
 *
 * Terminal instances live in terminalRegistry (outside React) so mosaic
 * tree changes never destroy scrollback; panes only attach the terminal's
 * DOM element. Toolbar: copy, split right/down, zoom (tmux-style), close.
 *
 * @module components/terminal
 */

import React, { useEffect, useRef } from 'react';
import { Copy, SplitSquareHorizontal, SplitSquareVertical, Maximize2, Minimize2, X, Plus, TerminalSquare } from 'lucide-react';
import { Mosaic, MosaicWindow, createRemoveUpdate, updateTree } from 'react-mosaic-component';
import type { MosaicNode, MosaicPath, MosaicDirection } from 'react-mosaic-component';
import { useTerminalStore, engineCommand } from '../../store/terminalStore';
import type { TerminalSession } from '../../store/terminalStore';
import { useSettingsStore } from '../../store/settingsStore';
import { getOrCreateTerminal, attachTerminal, disposeTerminal } from './terminalRegistry';

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
  const {
    sessions, mosaicNodes, zoomedId,
    setMosaicNodes, setZoomedId, createSession, removeSession,
  } = useTerminalStore();
  const activeEngine = useSettingsStore(s => s.activeEngine);

  const copySelection = (session: TerminalSession) => {
    const { term } = getOrCreateTerminal(session, activeEngine);
    const selection = term.getSelection();
    if (selection) void navigator.clipboard.writeText(selection);
  };

  const splitPane = (id: string, path: MosaicPath, direction: MosaicDirection) => {
    if (zoomedId) setZoomedId(null);
    const newId = createSession();
    const newNode: MosaicNode<string> = { type: 'split', direction, children: [id, newId] };
    setMosaicNodes(
      path.length === 0 && (mosaicNodes === id || mosaicNodes === null)
        ? newNode
        : updateTree(mosaicNodes!, [{ path, spec: { $set: newNode } }]),
    );
  };

  const closePane = (id: string, path: MosaicPath) => {
    if (zoomedId === id) setZoomedId(null);
    if (path.length === 0) {
      setMosaicNodes(null);
    } else {
      setMosaicNodes(updateTree(mosaicNodes!, [createRemoveUpdate(mosaicNodes!, path)]));
    }
    removeSession(id);
    disposeTerminal(id);
  };

  const appendToTree = (newId: string) => {
    setMosaicNodes(
      mosaicNodes === null
        ? newId
        : { type: 'split', direction: 'row', children: [mosaicNodes, newId], splitPercentages: [65, 35] },
    );
  };

  const addTerminal = () => {
    if (zoomedId) setZoomedId(null);
    appendToTree(createSession());
  };

  // Office bridge: clicking an agent focuses (or creates) their terminal.
  const focusRef = useRef({ sessions, mosaicNodes });
  focusRef.current = { sessions, mosaicNodes };
  useEffect(() => {
    const onFocus = (e: Event) => {
      const { agentId, name, statusColor } = (e as CustomEvent).detail as {
        agentId: string; name: string; statusColor: string;
      };
      const existing = Object.values(focusRef.current.sessions).find(s => s.agentId === agentId);
      if (existing) {
        useTerminalStore.getState().setZoomedId(existing.id);
        return;
      }
      const newId = useTerminalStore.getState().createSession({
        agentId, title: name, statusColor, command: engineCommand(),
      });
      const tree = focusRef.current.mosaicNodes;
      useTerminalStore.getState().setMosaicNodes(
        tree === null
          ? newId
          : { type: 'split', direction: 'row', children: [tree, newId], splitPercentages: [65, 35] },
      );
      useTerminalStore.getState().setZoomedId(newId);
    };
    window.addEventListener('agentspace:focus-terminal', onFocus);
    return () => window.removeEventListener('agentspace:focus-terminal', onFocus);
  }, []);

  /** Prototype-styled toolbar: dot + title left, CLI chip + actions right. */
  const renderToolbar = (session: TerminalSession, path: MosaicPath): React.ReactElement => {
    const isZoomed = zoomedId === session.id;
    return (
      <div className="term-toolbar">
        <span className="term-status-dot" style={{ background: session.statusColor }} />
        <span className="term-toolbar-title">{session.title}</span>
        <span className="term-chip">CLI: {activeEngine}</span>
        <div className="term-toolbar-actions">
          <button className="term-action" title="Seçimi kopyala" onClick={() => copySelection(session)}>
            <Copy size={13} />
          </button>
          {!isZoomed && (
            <button className="term-action" title="Sağa böl" onClick={() => splitPane(session.id, path, 'row')}>
              <SplitSquareHorizontal size={13} />
            </button>
          )}
          {!isZoomed && (
            <button className="term-action" title="Aşağı böl" onClick={() => splitPane(session.id, path, 'column')}>
              <SplitSquareVertical size={13} />
            </button>
          )}
          <button
            className="term-action"
            title={isZoomed ? 'Düzene dön' : 'Tam ekran (zoom)'}
            onClick={() => setZoomedId(isZoomed ? null : session.id)}
          >
            {isZoomed ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          <button className="term-action" title="Kapat" onClick={() => closePane(session.id, path)}>
            <X size={14} />
          </button>
        </div>
      </div>
    );
  };

  const sessionCount = Object.keys(sessions).length;
  const value = zoomedId ?? mosaicNodes;

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div className="term-strip">
        <TerminalSquare size={13} />
        <span>TERMİNALLER · {sessionCount}</span>
        <button className="term-action" title="Yeni terminal" onClick={addTerminal}>
          <Plus size={14} />
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        {value === null ? (
          <div className="term-empty">
            <button className="term-empty-btn" onClick={addTerminal}>
              <Plus size={14} /> Yeni terminal
            </button>
          </div>
        ) : (
          <Mosaic<string>
            className="mosaic-agentspace"
            renderTile={(id, path) => {
              const session = sessions[id];
              if (!session) return <div className="term-pane" />;
              return (
                <MosaicWindow<string>
                  path={path}
                  title={session.title}
                  renderToolbar={() => renderToolbar(session, path)}
                >
                  <TerminalPane session={session} />
                </MosaicWindow>
              );
            }}
            value={value}
            onChange={(next) => {
              // Ignore layout churn while zoomed — the saved tree stays intact.
              if (!zoomedId) setMosaicNodes(next);
            }}
          />
        )}
      </div>
    </div>
  );
}
