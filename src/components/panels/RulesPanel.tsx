/**
 * @file RulesPanel.tsx
 * @description Side panel displaying active Blueprint rules and agent roles in real-time.
 *
 * Automatically fetches and parses the active YAML blueprint via BlueprintEngine,
 * presenting architecture guidelines, forbidden patterns, code standards,
 * and agent team allocations.
 *
 * @module components/panels
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAgentSpaceStore } from '../../store';
import { resolveBlueprint } from '../../lib/blueprintEngine';
import type { BlueprintDefinition } from '../../types/blueprint';
import './RulesPanel.css';

/**
 * Renders the interactive rules panel sidebar.
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

      {/* ── Body ────────────────────────────────────────── */}
      <div className="rules-panel__body">
        {!activeBlueprintId ? (
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

            {/* Strict Forbidden Rules */}
            {blueprint.code_standards?.forbidden &&
              blueprint.code_standards.forbidden.length > 0 && (
                <section className="rules-section">
                  <h4 className="rules-section__title rules-section__title--danger">
                    {tBlueprints('panel.section_forbidden') || 'Strictly Forbidden'}
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
                <h4 className="rules-section__title">Testing & Quality Gates</h4>
                <div className="rules-testing-row">
                  <span className="rules-testing-label">Coverage Floor:</span>
                  <span className="rules-testing-value">
                    {blueprint.testing.coverage_minimum || 70}%
                  </span>
                </div>
                {blueprint.testing.framework && (
                  <div className="rules-testing-row">
                    <span className="rules-testing-label">Framework:</span>
                    <span className="rules-testing-value">{blueprint.testing.framework}</span>
                  </div>
                )}
              </section>
            )}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
