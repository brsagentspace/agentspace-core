/**
 * @file TopBar.tsx
 * @description Top navigation bar for the AgentSpace application.
 *
 * Contains application logo, active project name, blueprint selector dropdown,
 * multi-agent workflow trigger, Langfuse telemetry launcher, and settings controls.
 *
 * @module components/layout
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Loader2, Settings, Activity } from 'lucide-react';
import { useAgentSpaceStore } from '../../store';
import { agentOrchestrator } from '../../services/agentOrchestrator';
import './TopBar.css';

/**
 * Blueprint option descriptor used to populate the selector dropdown.
 */
interface BlueprintOption {
  id: string;
  labelKey: string;
}

interface TopBarProps {
  onOpenTelemetry?: () => void;
}

/** All available blueprint options. */
const BLUEPRINT_OPTIONS: BlueprintOption[] = [
  { id: 'mobile-react-native',       labelKey: 'mobile_react_native.name' },
  { id: 'web-nextjs-fullstack',       labelKey: 'web_nextjs_fullstack.name' },
  { id: 'backend-node-microservice',  labelKey: 'backend_node_microservice.name' },
  { id: 'backend-rust-service',       labelKey: 'backend_rust_service.name' },
  { id: 'ml-python-pipeline',         labelKey: 'ml_python_pipeline.name' },
];

/**
 * Renders the top navigation bar with multi-agent execution triggers and telemetry.
 *
 * @returns Header JSX element
 */
export function TopBar({ onOpenTelemetry }: TopBarProps) {
  const { t } = useTranslation('layout');
  const { t: tBlueprints } = useTranslation('blueprints');

  const activeBlueprint = useAgentSpaceStore((s) => s.activeBlueprint);
  const setActiveBlueprint = useAgentSpaceStore((s) => s.setActiveBlueprint);
  const activeProject = useAgentSpaceStore((s) => s.activeProject);

  const [isExecuting, setIsExecuting] = useState(false);

  const handleBlueprintChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setActiveBlueprint(event.target.value || null);
  };

  const handleTriggerCycle = async () => {
    if (isExecuting) return;
    setIsExecuting(true);
    try {
      await agentOrchestrator.runWorkflowCycle('Implement Secure Authentication Flow & Rate Limiting');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <header className="top-bar" role="banner">
      {/* ── Logo ────────────────────────────────────────── */}
      <div className="top-bar__logo">
        <span className="top-bar__logo-icon" aria-hidden="true">⬡</span>
        <span className="top-bar__logo-text">AgentSpace</span>
      </div>

      <div className="top-bar__divider" aria-hidden="true" />

      {/* ── Active project ──────────────────────────────── */}
      <div className="top-bar__project">
        <span className="top-bar__label">{t('top_bar.project_label')}</span>
        <span className="top-bar__value">
          {activeProject?.name ?? t('top_bar.project_placeholder')}
        </span>
      </div>

      <div className="top-bar__divider" aria-hidden="true" />

      {/* ── Blueprint selector ──────────────────────────── */}
      <div className="top-bar__blueprint">
        <label className="top-bar__label" htmlFor="blueprint-select">
          {t('top_bar.blueprint_label')}
        </label>
        <select
          id="blueprint-select"
          className="top-bar__select"
          value={activeBlueprint ?? ''}
          onChange={handleBlueprintChange}
        >
          <option value="">{t('top_bar.blueprint_placeholder')}</option>
          {BLUEPRINT_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {tBlueprints(option.labelKey)}
            </option>
          ))}
        </select>
      </div>

      <div className="top-bar__spacer" />

      {/* ── Run Workflow Button ─────────────────────────── */}
      <button
        className="top-bar__run-btn"
        type="button"
        onClick={handleTriggerCycle}
        disabled={isExecuting}
        title="Trigger Multi-Agent Iteration"
      >
        {isExecuting ? (
          <>
            <Loader2 size={12} className="top-bar__spin" aria-hidden="true" />
            <span>Ajanlar Çalışıyor...</span>
          </>
        ) : (
          <>
            <Play size={12} fill="currentColor" aria-hidden="true" />
            <span>Workflow Başlat</span>
          </>
        )}
      </button>

      <div className="top-bar__divider" aria-hidden="true" />

      {/* ── Telemetry Dashboard Button ──────────────────── */}
      <button
        className="top-bar__btn"
        type="button"
        onClick={onOpenTelemetry}
        title="Langfuse Telemetry & Cost Dashboard"
        aria-label="Open Telemetry Dashboard"
      >
        <Activity size={14} aria-hidden="true" />
      </button>

      {/* ── Settings button ─────────────────────────────── */}
      <button
        className="top-bar__btn"
        type="button"
        title={t('top_bar.settings_tooltip')}
        aria-label={t('top_bar.settings_tooltip')}
      >
        <Settings size={14} aria-hidden="true" />
      </button>
    </header>
  );
}
