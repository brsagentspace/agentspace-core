/**
 * @file StatusBar.tsx
 * @description Bottom application status bar.
 *
 * Displays real-time system metrics: active agent count, CPU usage,
 * RAM consumption, token budget progress, and prompt cache hit rate.
 * All values are sourced from the Zustand global store.
 *
 * @module components/layout
 */

import { useTranslation } from 'react-i18next';
import { useAgentSpaceStore } from '../../store';
import './StatusBar.css';

/** Application version — sourced from package.json in production. */
const APP_VERSION = '0.1.0';

/**
 * Renders the bottom status bar with live system metrics.
 *
 * @returns The status bar footer element.
 */
export function StatusBar() {
  const { t } = useTranslation('layout');

  const stats = useAgentSpaceStore((s) => s.stats);
  const agents = useAgentSpaceStore((s) => s.agents);

  const activeAgentCount = agents.filter((a) => a.status === 'working').length;
  const tokenUsedPercent = Math.round(
    (stats.tokenBudget.used / stats.tokenBudget.total) * 100
  );
  const tokenRemainingK = (stats.tokenBudget.remaining / 1000).toFixed(1);
  const cachePercent = (stats.tokenBudget.cacheHitRate * 100).toFixed(0);

  return (
    <footer className="status-bar" role="status" aria-label="System status">
      {/* ── Active agents ─────────────────────────────── */}
      <div className="status-item">
        <span className="status-dot status-dot--green" aria-hidden="true" />
        <span className="status-label">{t('status_bar.agents_label')}</span>
        <span className="status-value">
          {t('status_bar.agents_active', { count: activeAgentCount })}
        </span>
      </div>

      <div className="status-divider" aria-hidden="true" />

      {/* ── CPU ───────────────────────────────────────── */}
      <div className="status-item">
        <span className="status-label">{t('status_bar.cpu_label')}</span>
        <span className="status-value">{stats.cpuUsage.toFixed(1)}%</span>
      </div>

      <div className="status-divider" aria-hidden="true" />

      {/* ── RAM ───────────────────────────────────────── */}
      <div className="status-item">
        <span className="status-label">{t('status_bar.ram_label')}</span>
        <span className="status-value">{stats.ramUsageMB} MB</span>
      </div>

      <div className="status-divider" aria-hidden="true" />

      {/* ── Token budget ──────────────────────────────── */}
      <div className="status-item status-item--token">
        <span className="status-label">{t('status_bar.token_budget_label')}</span>

        <div
          className="token-bar"
          role="progressbar"
          aria-valuenow={tokenUsedPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('status_bar.token_budget_label')}
        >
          <div
            className={[
              'token-bar__fill',
              tokenUsedPercent > 80 ? 'token-bar__fill--warn' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ width: `${tokenUsedPercent}%` }}
          />
        </div>

        <span className="status-value">
          {t('status_bar.token_remaining', { amount: tokenRemainingK })}
        </span>
      </div>

      <div className="status-divider" aria-hidden="true" />

      {/* ── Prompt cache hit rate ──────────────────────── */}
      <div className="status-item">
        <span className="status-label">{t('status_bar.cache_label')}</span>
        <span className="status-value status-value--green">{cachePercent}%</span>
      </div>

      {/* ── Right-aligned version ─────────────────────── */}
      <div className="status-spacer" />
      <div className="status-item">
        <span className="status-label status-label--muted">
          {t('status_bar.version', { version: APP_VERSION })}
        </span>
      </div>
    </footer>
  );
}
