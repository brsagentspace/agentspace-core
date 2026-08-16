/**
 * @file TopBar.tsx
 * @description Top navigation bar for the AgentSpace application.
 *
 * Contains the application logo, active project name display,
 * blueprint selector dropdown, and settings button.
 * Blueprint selection is persisted in the Zustand global store.
 *
 * @module components/layout
 */

import { useTranslation } from 'react-i18next';
import { useAgentSpaceStore } from '../../store';
import './TopBar.css';

/**
 * Blueprint option descriptor used to populate the selector dropdown.
 * The `id` must match the YAML filename in agentspace-skills/blueprints/.
 */
interface BlueprintOption {
  id: string;
  /** i18n key path within the `blueprints` namespace, e.g. "mobile_react_native.name" */
  labelKey: string;
}

/** All available blueprint options. Add new blueprints here when created. */
const BLUEPRINT_OPTIONS: BlueprintOption[] = [
  { id: 'mobile-react-native',       labelKey: 'mobile_react_native.name' },
  { id: 'web-nextjs-fullstack',       labelKey: 'web_nextjs_fullstack.name' },
  { id: 'backend-node-microservice',  labelKey: 'backend_node_microservice.name' },
  { id: 'backend-rust-service',       labelKey: 'backend_rust_service.name' },
  { id: 'ml-python-pipeline',         labelKey: 'ml_python_pipeline.name' },
];

/**
 * Renders the top navigation bar.
 *
 * @returns The header element containing logo, project info, blueprint selector
 *          and settings button.
 */
export function TopBar() {
  const { t } = useTranslation('layout');
  const { t: tBlueprints } = useTranslation('blueprints');

  const activeBlueprint = useAgentSpaceStore((s) => s.activeBlueprint);
  const setActiveBlueprint = useAgentSpaceStore((s) => s.setActiveBlueprint);
  const activeProject = useAgentSpaceStore((s) => s.activeProject);

  /**
   * Handles blueprint selector change events.
   * An empty string value clears the active blueprint.
   *
   * @param event - The native select change event.
   */
  const handleBlueprintChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setActiveBlueprint(event.target.value || null);
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

      {/* ── Settings button ─────────────────────────────── */}
      <button
        className="top-bar__btn"
        type="button"
        title={t('top_bar.settings_tooltip')}
        aria-label={t('top_bar.settings_tooltip')}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
        </svg>
      </button>
    </header>
  );
}
