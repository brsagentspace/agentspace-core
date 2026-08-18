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
import { JsonMemoryStore, agentColor } from '../../services/memory/MemoryStore';
import type { MemoryGraphData } from '../../services/memory/MemoryStore';
import './MemoryView.css';

const store = new JsonMemoryStore();

export function MemoryView() {
  const { t } = useTranslation('memory');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<MemoryGraphData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    store.load()
      .then(d => { if (alive) setData(d); })
      .catch(e => { if (alive) setError(String(e)); });
    return () => { alive = false; };
  }, []);

  const agentIds = useMemo(() => Object.keys(data?.agents ?? {}), [data]);

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
      </div>

      <div className="memory-body">
        <div className="memory-canvas-host" />
        <div className="memory-canvas-placeholder">
          {error ?? (data ? t('canvas_placeholder') : t('loading'))}
        </div>

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
          <div className="memory-detail-empty">{t('panel_empty')}</div>
        </div>
      </div>
    </div>
  );
}
