/**
 * @file SessionsMenu.tsx
 * @description "Oturumlar" popover in the terminal strip.
 *
 * Lists every Claude Code conversation recorded for the Space's working
 * folder (title, last prompt, age, turns, context / total tokens) and lets
 * the user load one into a pane — even if the pane that ran it was closed
 * long ago. Conversations already open in a pane are marked and focusing
 * them is preferred over starting a second `claude --resume` on the same
 * transcript.
 *
 * @module components/terminal
 */

import { useEffect, useRef, useState } from 'react';
import { History, RefreshCw, X, ExternalLink, Radio } from 'lucide-react';
import {
  IS_TAURI, listClaudeSessions, formatRelative, formatTokens, totalTokens, shortModel,
  type ClaudeSessionInfo,
} from '../../services/claudeSessions';

interface SessionsMenuProps {
  /** Working directory the panes run in (null → home). */
  cwd: string | null;
  /** Claude session ids currently bound to open panes → pane id. */
  openPanes: Record<string, string>;
  onOpen: (session: ClaudeSessionInfo) => void;
  onClose: () => void;
}

export function SessionsMenu({ cwd, openPanes, onOpen, onClose }: SessionsMenuProps) {
  const [sessions, setSessions] = useState<ClaudeSessionInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const load = () => {
    setError(null);
    listClaudeSessions(cwd)
      .then(setSessions)
      .catch((err: unknown) => { setSessions([]); setError(String(err)); });
  };

  useEffect(load, [cwd]);

  // Close on outside click / Escape.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const q = query.trim().toLocaleLowerCase('tr-TR');
  const visible = (sessions ?? []).filter(s =>
    !q || `${s.title} ${s.first_prompt} ${s.last_prompt}`.toLocaleLowerCase('tr-TR').includes(q),
  );

  return (
    <div className="sessions-menu" ref={rootRef} role="dialog" aria-label="Claude oturumları">
      <div className="sessions-menu-head">
        <History size={13} />
        <span className="sessions-menu-title">CLAUDE OTURUMLARI</span>
        <span className="sessions-menu-count">{sessions ? sessions.length : '…'}</span>
        <button className="term-action" title="Yenile" onClick={load}><RefreshCw size={12} /></button>
        <button className="term-action" title="Kapat" onClick={onClose}><X size={13} /></button>
      </div>
      <div className="sessions-menu-cwd" title={cwd ?? 'Ev dizini'}>
        {cwd ?? '~ (Space klasörü seçilmemiş — ev dizini)'}
      </div>
      {sessions && sessions.length > 5 && (
        <input
          className="sessions-menu-search"
          placeholder="Başlık veya istekte ara…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />
      )}
      <div className="sessions-menu-list">
        {!IS_TAURI && (
          <div className="sessions-menu-empty">
            Oturum listesi yalnızca masaüstü uygulamada (npm run tauri dev) okunur.
          </div>
        )}
        {IS_TAURI && sessions === null && <div className="sessions-menu-empty">Okunuyor…</div>}
        {error && <div className="sessions-menu-empty sessions-menu-error">{error}</div>}
        {IS_TAURI && sessions && sessions.length === 0 && !error && (
          <div className="sessions-menu-empty">Bu klasörde kayıtlı Claude oturumu yok.</div>
        )}
        {IS_TAURI && sessions && sessions.length > 0 && visible.length === 0 && (
          <div className="sessions-menu-empty">Eşleşen oturum yok.</div>
        )}
        {visible.map(s => {
          const paneId = openPanes[s.id];
          return (
            <button
              key={s.id}
              className={`sessions-row${paneId ? ' is-open' : ''}`}
              onClick={() => onOpen(s)}
              title={paneId ? 'Açık paneline git' : 'Bir terminale yükle (claude --resume)'}
            >
              <div className="sessions-row-top">
                <span className="sessions-row-title">{s.title}</span>
                {s.live && <span className="sessions-badge sessions-badge-live"><Radio size={9} /> çalışıyor</span>}
                {paneId && <span className="sessions-badge">panelde</span>}
                <span className="sessions-row-age">{formatRelative(s.modified_at)}</span>
              </div>
              {s.last_prompt && s.last_prompt !== s.title && (
                <div className="sessions-row-prompt">› {s.last_prompt}</div>
              )}
              <div className="sessions-row-meta">
                <span>{s.turns} tur</span>
                <span>bağlam {formatTokens(s.context_tokens)}</span>
                <span>toplam {formatTokens(totalTokens(s))}</span>
                {s.model && <span>{shortModel(s.model)}</span>}
                {s.git_branch && <span className="sessions-row-branch">{s.git_branch}</span>}
                <ExternalLink size={10} className="sessions-row-go" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
