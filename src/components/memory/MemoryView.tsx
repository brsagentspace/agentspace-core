/**
 * @file MemoryView.tsx
 * @description Agent Memory Map screen.
 *
 * Loads the memory graph through the MemoryStore abstraction and renders
 * header stats, the agent legend and the detail panel. The GPU canvas
 * (cosmos.gl) mounts into .memory-canvas-host (Phase 2, issue #3).
 *
 * @module components/memory
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { agentColor } from '../../services/memory/MemoryStore';
import type { MemoryGraphData } from '../../services/memory/MemoryStore';
import { loadProjectMemory } from '../../services/memory/projectMemory';
import { BM25Index } from '../../services/rag/BM25Index';
import { useProjectStore } from '../../store/projectStore';
import { useAgentSpaceStore } from '../../store';
import { useMemoryJournalStore } from '../../store/memoryJournalStore';
import { MemoryMapCanvas } from './MemoryMapCanvas';
import './MemoryView.css';

export function MemoryView() {
  const { t } = useTranslation('memory');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<MemoryGraphData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timePct, setTimePct] = useState(100);
  const [focusTarget, setFocusTarget] = useState<{ id: string; nonce: number } | null>(null);

  const projectId = useProjectStore(s => s.activeProjectId);
  const demoMemory = useProjectStore(
    s => s.projects.find(p => p.id === s.activeProjectId)?.demoMemory ?? true,
  );
  // Stable team key: ignores status churn, changes when members change.
  const teamKey = useAgentSpaceStore(s => s.agents.map(a => `${a.id}:${a.name}`).join('|'));
  const journalCount = useMemoryJournalStore(
    s => (projectId ? (s.byProject[projectId]?.length ?? 0) : 0),
  );

  useEffect(() => {
    let alive = true;
    const team = useAgentSpaceStore.getState().agents;
    loadProjectMemory(projectId, team, demoMemory)
      .then(d => { if (alive) setData(d); })
      .catch(e => { if (alive) setError(String(e)); });
    return () => { alive = false; };
  }, [projectId, demoMemory, teamKey, journalCount]);

  const agentIds = useMemo(() => Object.keys(data?.agents ?? {}), [data]);

  /** BM25 index over memory titles+summaries (RetrievalCascade's index). */
  const bm25 = useMemo(() => {
    if (!data) return null;
    const index = new BM25Index();
    data.nodes.forEach(n => {
      if (n.type === 'Agent') return;
      const text = `${n.name} ${n.summary}`;
      index.addChunk({
        id: n.id, sourceDocId: n.id, sourceDocName: n.name,
        contextHeader: '', content: text, fullText: text, tokenCount: 0,
      });
    });
    return index;
  }, [data]);

  /** Hybrid matching: BM25 ranked hits ∪ substring hits. Null = no filter. */
  const searchMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!data || !bm25 || q.length < 2) return null;
    const ids = new Set(bm25.search(q, 300).map(r => r.chunk.id));
    data.nodes.forEach(n => {
      if (n.name.toLowerCase().includes(q) || n.summary.toLowerCase().includes(q)) {
        ids.add(n.id);
      }
    });
    return ids;
  }, [data, bm25, query]);

  const agentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    data?.nodes.forEach(n => {
      if (n.type === 'Agent') return;
      const owner = n.attributes.agentId as string | undefined;
      if (owner) counts[owner] = (counts[owner] ?? 0) + 1;
    });
    return counts;
  }, [data]);

  const memoryCount = data ? data.nodes.filter(n => n.type !== 'Agent').length : 0;

  /** Bi-temporal window: min/max ingestion time across memories. */
  const timeRange = useMemo(() => {
    if (!data) return null;
    const times = data.nodes
      .filter(n => n.type !== 'Agent')
      .map(n => Date.parse(n.timestamps.ingestionTime));
    return { min: Math.min(...times), max: Math.max(...times) };
  }, [data]);

  const timeCutoff = useMemo(() => {
    if (!timeRange || timePct >= 100) return null;
    return timeRange.min + (timeRange.max - timeRange.min) * (timePct / 100);
  }, [timeRange, timePct]);

  const focusNode = (id: string) => {
    setSelectedId(id);
    setFocusTarget(prev => ({ id, nonce: (prev?.nonce ?? 0) + 1 }));
  };

  const selectedNode = useMemo(
    () => data?.nodes.find(n => n.id === selectedId) ?? null,
    [data, selectedId],
  );

  /** Relations touching the selected node, resolved to neighbor nodes. */
  const selectedLinks = useMemo(() => {
    if (!data || !selectedNode) return [];
    const byId = new Map(data.nodes.map(n => [n.id, n]));
    return data.relations
      .filter(r => r.sourceId === selectedNode.id || r.targetId === selectedNode.id)
      .map(r => {
        const otherId = r.sourceId === selectedNode.id ? r.targetId : r.sourceId;
        return { relation: r, other: byId.get(otherId) };
      })
      .filter(l => l.other)
      .slice(0, 30);
  }, [data, selectedNode]);

  return (
    <div className="memory-view">
      <div className="memory-header">
        <div className="memory-header-titles">
          <h2 className="memory-title">{t('title')}</h2>
          <span className="memory-subtitle">{t('subtitle')}</span>
        </div>
        <div className="memory-stats">
          <span className="memory-stat-chip">
            {t('stats', { nodes: memoryCount, edges: data?.relations.length ?? 0 })}
          </span>
          <span className="memory-stat-chip">
            {t('indexed', { files: data?.indexedFiles ?? 0, chunks: data?.indexedChunks ?? 0 })}
          </span>
        </div>
        <input
          className="memory-search"
          value={query}
          placeholder={t('search_placeholder')}
          onChange={e => setQuery(e.target.value)}
        />
        <div className="memory-time" title={t('time_tooltip')}>
          <input
            type="range"
            min={0}
            max={100}
            value={timePct}
            onChange={e => setTimePct(Number(e.target.value))}
          />
          <span className="memory-time-label">
            {timeCutoff === null ? t('time_now') : new Date(timeCutoff).toISOString().slice(0, 10)}
          </span>
        </div>
      </div>

      <div className="memory-body">
        {data ? (
          <MemoryMapCanvas
            data={data}
            agentFilter={agentFilter}
            searchMatches={searchMatches}
            selectedId={selectedId}
            onSelect={setSelectedId}
            timeCutoff={timeCutoff}
            focusTarget={focusTarget}
          />
        ) : (
          <div className="memory-canvas-placeholder">{error ?? t('loading')}</div>
        )}

        <div className="memory-legend">
          <div className="memory-legend-title">{t('legend_title')}</div>
          <button
            className={`memory-legend-row ${agentFilter === null ? 'selected' : ''}`}
            onClick={() => setAgentFilter(null)}
          >
            <span className="memory-legend-dot" style={{ background: '#8b5cf6' }} />
            {t('legend_all')}
            <span className="memory-legend-count">{memoryCount}</span>
          </button>
          {agentIds.map(id => (
            <button
              key={id}
              className={`memory-legend-row ${agentFilter === id ? 'selected' : ''}`}
              onClick={() => setAgentFilter(agentFilter === id ? null : id)}
            >
              <span className="memory-legend-dot" style={{ background: agentColor(agentIds, id) }} />
              {data?.agents[id]}
              <span className="memory-legend-count">{agentCounts[id] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="memory-detail">
          {selectedNode ? (
            <>
              <button className="memory-detail-close" onClick={() => setSelectedId(null)}>×</button>
              <h3>{selectedNode.name}</h3>
              <p className="memory-detail-summary">{selectedNode.summary}</p>
              <dl className="memory-detail-meta">
                <dt>{t('panel_type')}</dt>
                <dd>{selectedNode.type}</dd>
                <dt>{t('panel_agent')}</dt>
                <dd>{data?.agents[(selectedNode.attributes.agentId as string) ?? selectedNode.id] ?? '—'}</dd>
                <dt>{t('panel_valid_time')}</dt>
                <dd>{selectedNode.timestamps.validTime.slice(0, 10)}</dd>
                <dt>{t('panel_ingestion_time')}</dt>
                <dd>{selectedNode.timestamps.ingestionTime.slice(0, 10)}</dd>
              </dl>
              <div className="memory-detail-links-title">
                {t('panel_links')} · {selectedLinks.length}
              </div>
              {selectedLinks.map(({ relation, other }) => (
                <button
                  key={relation.id}
                  className="memory-detail-link"
                  onClick={() => focusNode(other!.id)}
                >
                  [[{other!.name}]] · {relation.type}
                </button>
              ))}
            </>
          ) : (
            <div className="memory-detail-empty">{t('panel_empty')}</div>
          )}
        </div>
      </div>
    </div>
  );
}
