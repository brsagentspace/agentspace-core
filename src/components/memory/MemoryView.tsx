/**
 * @file MemoryView.tsx
 * @description Agent Memory Map screen — skeleton (Phase 0).
 *
 * Layout: header (title + stats + search), full-bleed canvas host,
 * agent legend overlay (bottom-left) and a detail panel (right).
 * The actual GPU graph canvas arrives in Phase 2 (issue #3).
 *
 * @module components/memory
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './MemoryView.css';

export function MemoryView() {
  const { t } = useTranslation('memory');
  const [query, setQuery] = useState('');

  return (
    <div className="memory-view">
      <div className="memory-header">
        <div className="memory-header-titles">
          <h2 className="memory-title">{t('title')}</h2>
          <span className="memory-subtitle">{t('subtitle')}</span>
        </div>
        <div className="memory-stats">
          <span className="memory-stat-chip">{t('stats', { nodes: 0, edges: 0 })}</span>
          <span className="memory-stat-chip">{t('indexed', { files: 0, chunks: 0 })}</span>
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
        <div className="memory-canvas-placeholder">{t('canvas_placeholder')}</div>

        <div className="memory-legend">
          <div className="memory-legend-title">{t('legend_title')}</div>
          <button className="memory-legend-row selected">
            <span className="memory-legend-dot" style={{ background: '#8b5cf6' }} />
            {t('legend_all')}
          </button>
        </div>

        <div className="memory-detail">
          <div className="memory-detail-empty">{t('panel_empty')}</div>
        </div>
      </div>
    </div>
  );
}
