/**
 * @file MultiTerminalPanel.tsx
 * @description Tiled terminal workspace (react-mosaic v7 + xterm).
 *
 * Terminal instances live in terminalRegistry (outside React) so mosaic
 * tree changes never destroy scrollback; panes only attach the terminal's
 * DOM element. Toolbar: copy, split right/down, zoom (tmux-style), close.
 * The strip's "Oturumlar" menu lists the Space's recorded Claude
 * conversations and loads any of them into a pane (`claude --resume`).
 *
 * @module components/terminal
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, SplitSquareHorizontal, SplitSquareVertical, Maximize2, Minimize2, X, Plus, TerminalSquare, History } from 'lucide-react';
import { Mosaic, MosaicWindow, createRemoveUpdate, updateTree } from 'react-mosaic-component';
import type { MosaicNode, MosaicPath, MosaicDirection } from 'react-mosaic-component';
import { useTerminalStore, engineCommand } from '../../store/terminalStore';
import type { TerminalSession } from '../../store/terminalStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useProjectStore } from '../../store/projectStore';
import { getOrCreateTerminal, attachTerminal, disposeTerminal } from './terminalRegistry';
import { SessionsMenu } from './SessionsMenu';
import { paneTitleFor, type ClaudeSessionInfo } from '../../services/claudeSessions';

import '@xterm/xterm/css/xterm.css';
import 'react-mosaic-component/react-mosaic-component.css';
import './MultiTerminalPanel.css';

/** Selectable CLI engines (matches src-tauri cli_engine detection). */
const ENGINES = ['claude', 'codex', 'gemini'];

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

  /** Restarts a session's terminal on a different CLI engine. */
  const switchEngine = (session: TerminalSession, engine: string) => {
    if ((session.engine ?? activeEngine) === engine) return;
    disposeTerminal(session.id);
    // Give the pty_kill IPC a beat before the same session id respawns.
    window.setTimeout(() => {
      useTerminalStore.getState().setSessionEngine(session.id, engine);
    }, 90);
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

  // ── Sessions menu ──
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const closeSessions = useCallback(() => setSessionsOpen(false), []);
  // Subscribed (not read once) so a later-picked Space folder re-targets the menu.
  const cwd = useProjectStore(s => s.projects.find(p => p.id === s.activeProjectId)?.rootPath?.trim() || null);
  const openPanes = useMemo(() => {
    const map: Record<string, string> = {};
    Object.values(sessions).forEach(s => { if (s.claudeSessionId) map[s.claudeSessionId] = s.id; });
    return map;
  }, [sessions]);

  /** Loads a recorded conversation into a pane, or focuses the pane already running it. */
  const openClaudeSession = (info: ClaudeSessionInfo) => {
    setSessionsOpen(false);
    const existing = openPanes[info.id];
    if (existing && sessions[existing]) {
      setZoomedId(existing);
      return;
    }
    if (zoomedId) setZoomedId(null);
    const newId = createSession({
      title: paneTitleFor(info),
      statusColor: '#8b5cf6',
      engine: 'claude',
      command: 'claude',
      claudeSessionId: info.id,
    });
    appendToTree(newId);
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
        <select
          className="term-chip term-chip-select"
          title="Bu oturumun CLI motoru — değiştirince oturum yeniden başlar"
          value={session.engine ?? activeEngine}
          onMouseDown={e => e.stopPropagation()}
          onChange={e => switchEngine(session, e.target.value)}
        >
          {ENGINES.map(engine => (
            <option key={engine} value={engine}>CLI: {engine}</option>
          ))}
        </select>
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
        <button
          className={`term-strip-btn${sessionsOpen ? ' is-active' : ''}`}
          title="Bu Space'in kayıtlı Claude oturumları — kapatılmış olsa bile bir terminale yükle"
          onClick={() => setSessionsOpen(v => !v)}
        >
          <History size={12} /> OTURUMLAR
        </button>
        <span className="term-strip-spacer" />
        <button className="term-action" title="Yeni terminal" onClick={addTerminal}>
          <Plus size={14} />
        </button>
        {sessionsOpen && (
          <SessionsMenu cwd={cwd} openPanes={openPanes} onOpen={openClaudeSession} onClose={closeSessions} />
        )}
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
