/**
 * @file RulesPanel.tsx
 * @description Side panel displaying active Blueprint rules and 3-Stage RAG semantic search.
 *
 * Provides instant Contextual Retrieval across architectural decisions, blueprint guidelines,
 * and SaaS standards with real-time token savings metrics.
 *
 * @module components/panels
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Sparkles, X, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useAgentSpaceStore } from '../../store';
import { resolveBlueprint } from '../../lib/blueprintEngine';
import { ragPipeline } from '../../services/rag/RetrievalCascade';
import type { BlueprintDefinition } from '../../types/blueprint';
import type { RAGSearchResult } from '../../types/rag';
import './RulesPanel.css';

/**
 * Renders the interactive rules panel sidebar with 3-Stage RAG Search.
 *
 * @returns The rules panel aside element.
 */
export function RulesPanel() {
  const { t } = useTranslation('layout');
  const { t: tBlueprints } = useTranslation('blueprints');

  const activeBlueprintId = useAgentSpaceStore((s) => s.activeBlueprint);
  const [blueprint, setBlueprint] = useState<BlueprintDefinition | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // RAG Search State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [ragResult, setRagResult] = useState<RAGSearchResult | null>(null);

  useEffect(() => {
    if (!activeBlueprintId) {
      setBlueprint(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    resolveBlueprint(activeBlueprintId)
      .then((data) => {
        if (isMounted) {
          setBlueprint(data);
          setIsLoading(false);
        }
      })
      .catch((err: Error) => {
        if (isMounted) {
          setError(err.message);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeBlueprintId]);

  // Handle RAG Semantic Search
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (query.trim().length > 1) {
      const result = ragPipeline.search(query);
      setRagResult(result);
    } else {
      setRagResult(null);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setRagResult(null);
  };

  return (
    <aside className="rules-panel" aria-label={t('rules_panel.title')}>
      {/* ── Header ──────────────────────────────────────── */}
      <div className="rules-panel__header">
        <div className="rules-panel__header-left">
          <span className="rules-panel__title">{t('rules_panel.title')}</span>
          {blueprint && (
            <span className="rules-panel__version">v{blueprint.version}</span>
          )}
        </div>
        {activeBlueprintId && (
          <span className="rules-panel__badge" aria-label="Active blueprint">
            {blueprint?.name || activeBlueprintId}
          </span>
        )}
      </div>

      {/* ── RAG Search Bar ──────────────────────────────── */}
      <div className="rules-panel__search-box">
        <Search size={12} className="rules-panel__search-icon" aria-hidden="true" />
        <input
          type="text"
          className="rules-panel__search-input"
          placeholder="RAG: Search rules & decisions..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
        {searchQuery && (
          <button
            type="button"
            className="rules-panel__search-clear"
            onClick={handleClearSearch}
            aria-label="Clear search"
          >
            <X size={11} />
          </button>
        )}
      </div>

      {/* ── Body ────────────────────────────────────────── */}
      <div className="rules-panel__body">
        {/* RAG Search Results Mode */}
        {ragResult && ragResult.topChunks.length > 0 ? (
          <div className="rules-panel__rag-results">
            <div className="rules-panel__rag-meta">
              <span className="rules-panel__rag-count">
                <Sparkles size={11} className="rules-panel__rag-icon" />
                {ragResult.topChunks.length} Contextual Chunks
              </span>
              <span className="rules-panel__rag-tokens">
                ~{ragResult.totalTokensSaved} tokens saved
              </span>
            </div>

            {ragResult.topChunks.map((chunk, idx) => (
              <div key={chunk.id || idx} className="rules-rag-card">
                <div className="rules-rag-card__header">
                  <span className="rules-rag-card__source">{chunk.sourceDocName}</span>
                  <span className="rules-rag-card__badge">Top #{idx + 1}</span>
                </div>
                <div className="rules-rag-card__context">{chunk.contextHeader}</div>
                <div className="rules-rag-card__content">{chunk.content}</div>
              </div>
            ))}
          </div>
        ) : searchQuery.trim().length > 1 && ragResult?.topChunks.length === 0 ? (
          <div className="rules-panel__empty" role="status">
            <p>No matching rules found in RAG index.</p>
            <p className="rules-panel__empty-sub">Try searching "auth", "Tauri", "SaaS", or "emoji".</p>
          </div>
        ) : !activeBlueprintId ? (
          <div className="rules-panel__empty" role="status">
            <p>{t('rules_panel.empty_message')}</p>
            <p className="rules-panel__empty-sub">{t('rules_panel.empty_hint')}</p>
          </div>
        ) : isLoading ? (
          <div className="rules-panel__loading-container" role="status">
            <p className="rules-panel__loading">
              <span className="rules-panel__dot-anim" aria-hidden="true" />
              {t('rules_panel.loading')}
            </p>
          </div>
        ) : error ? (
          <div className="rules-panel__error" role="alert">
            <p className="rules-panel__error-title">Blueprint Load Error</p>
            <p className="rules-panel__error-sub">{error}</p>
          </div>
        ) : blueprint ? (
          <div className="rules-panel__content">
            {/* Architecture Overview */}
            {blueprint.architecture && (
              <section className="rules-section">
                <h4 className="rules-section__title">
                  {tBlueprints('panel.section_architecture') || 'Architecture'}
                </h4>
                <div className="rules-badge-group">
                  <span className="rules-tag rules-tag--accent">
                    {blueprint.architecture.pattern}
                  </span>
                  <span className="rules-tag">
                    {blueprint.project_type.toUpperCase()}
                  </span>
                </div>
                {blueprint.architecture.description && (
                  <p className="rules-section__desc">
                    {blueprint.architecture.description}
                  </p>
                )}
              </section>
            )}

            {/* Approved principles (media blueprints lean on these) */}
            {blueprint.code_standards?.principles &&
              blueprint.code_standards.principles.length > 0 && (
                <section className="rules-section">
                  <h4 className="rules-section__title">
                    <CheckCircle2 size={12} aria-hidden="true" />
                    <span>{tBlueprints('panel.section_principles')}</span>
                  </h4>
                  <ul className="rules-list">
                    {blueprint.code_standards.principles.map((rule, idx) => (
                      <li key={idx} className="rules-list__item">
                        <span className="rules-list__icon" aria-hidden="true">✔</span>
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

            {/* Strict Forbidden Rules */}
            {blueprint.code_standards?.forbidden &&
              blueprint.code_standards.forbidden.length > 0 && (
                <section className="rules-section">
                  <h4 className="rules-section__title rules-section__title--danger">
                    <ShieldAlert size={12} aria-hidden="true" />
                    <span>{tBlueprints('panel.section_forbidden') || 'Strictly Forbidden'}</span>
                  </h4>
                  <ul className="rules-list rules-list--forbidden">
                    {blueprint.code_standards.forbidden.map((rule, idx) => (
                      <li key={idx} className="rules-list__item">
                        <span className="rules-list__icon" aria-hidden="true">✕</span>
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

            {/* Agent Roles Allocation */}
            {blueprint.agent_roles && Object.keys(blueprint.agent_roles).length > 0 && (
              <section className="rules-section">
                <h4 className="rules-section__title">
                  {tBlueprints('panel.section_agents') || 'Agent Team'}
                </h4>
                <div className="rules-agents-grid">
                  {Object.entries(blueprint.agent_roles).map(([roleKey, roleDef]) => (
                    <div key={roleKey} className="rules-agent-card">
                      <div className="rules-agent-card__header">
                        <span className={`rules-agent-card__dot rules-agent-card__dot--${roleDef.color}`} />
                        <span className="rules-agent-card__role">{roleKey}</span>
                        <span className="rules-agent-card__count">x{roleDef.count}</span>
                      </div>
                      <span className="rules-agent-card__tier">Tier-{roleDef.model_tier}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Testing Requirements */}
            {blueprint.testing && (
              <section className="rules-section">
                <h4 className="rules-section__title">{tBlueprints('panel.section_testing')}</h4>
                {blueprint.testing.coverage_minimum !== undefined && (
                  <div className="rules-testing-row">
                    <span className="rules-testing-label">Coverage Floor:</span>
                    <span className="rules-testing-value">{blueprint.testing.coverage_minimum}%</span>
                  </div>
                )}
                {blueprint.testing.framework && (
                  <div className="rules-testing-row">
                    <span className="rules-testing-label">Framework:</span>
                    <span className="rules-testing-value">{blueprint.testing.framework}</span>
                  </div>
                )}
                {blueprint.testing.rules && blueprint.testing.rules.length > 0 && (
                  <ul className="rules-list">
                    {blueprint.testing.rules.map((rule, idx) => (
                      <li key={idx} className="rules-list__item">
                        <span className="rules-list__icon" aria-hidden="true">•</span>
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
