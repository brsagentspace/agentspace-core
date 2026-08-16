/**
 * @file RulesPanel.tsx
 * @description Side panel displaying the active blueprint's rules.
 *
 * When a blueprint is selected via the TopBar, this panel will load
 * and display the corresponding rules from the LlamaIndex RAG pipeline
 * (Phase 5). In Phase 1 it renders appropriate placeholder states.
 *
 * @module components/panels
 */

import { useTranslation } from 'react-i18next';
import { useAgentSpaceStore } from '../../store';
import './RulesPanel.css';

/**
 * Renders the rules panel sidebar.
 *
 * Shows an empty state when no blueprint is selected, or a loading
 * placeholder when a blueprint is active but the RAG pipeline is not
 * yet integrated.
 *
 * @returns The rules panel aside element.
 */
export function RulesPanel() {
  const { t } = useTranslation('layout');

  const activeBlueprint = useAgentSpaceStore((s) => s.activeBlueprint);

  return (
    <aside className="rules-panel" aria-label={t('rules_panel.title')}>
      {/* ── Header ──────────────────────────────────────── */}
      <div className="rules-panel__header">
        <span className="rules-panel__title">{t('rules_panel.title')}</span>
        {activeBlueprint && (
          <span className="rules-panel__badge" aria-label="Active blueprint">
            {activeBlueprint}
          </span>
        )}
      </div>

      {/* ── Body ────────────────────────────────────────── */}
      <div className="rules-panel__body">
        {!activeBlueprint ? (
          /* Empty state — no blueprint selected */
          <div className="rules-panel__empty" role="status">
            <p>{t('rules_panel.empty_message')}</p>
            <p className="rules-panel__empty-sub">{t('rules_panel.empty_hint')}</p>
          </div>
        ) : (
          /* Loading state — blueprint selected, RAG not yet active */
          <div className="rules-panel__placeholder" role="status">
            <p className="rules-panel__loading">
              <span className="rules-panel__dot-anim" aria-hidden="true" />
              {t('rules_panel.loading')}
            </p>
            <p className="rules-panel__sub">{t('rules_panel.loading_hint')}</p>
          </div>
        )}
      </div>
    </aside>
  );
}
