/**
 * @file OfficeCanvas.tsx
 * @description 2D office simulation canvas container.
 *
 * This component is a Phase 1 placeholder. In Phase 2, it will mount
 * a Phaser.js game instance inside this container and render the
 * isometric office environment with animated robot agents.
 *
 * The canvas element will be appended to the ref div by Phaser's
 * renderer — React does not manage the canvas DOM node directly.
 *
 * @module components/phaser
 */

import { useTranslation } from 'react-i18next';
import './OfficeCanvas.css';

/**
 * Renders the office canvas container.
 *
 * Phase 1: Displays a placeholder with a subtle grid background.
 * Phase 2: Will mount a Phaser.js WebGL/Canvas context here.
 *
 * @returns The canvas wrapper div element.
 */
export function OfficeCanvas() {
  const { t } = useTranslation('layout');

  return (
    <div className="office-canvas" role="region" aria-label={t('office_canvas.placeholder_label')}>
      <div className="office-canvas__placeholder">
        {/* Subtle dot-grid background */}
        <div className="office-canvas__grid" aria-hidden="true" />

        {/* Phase 1 status message */}
        <div className="office-canvas__message" role="status">
          <span className="office-canvas__icon" aria-hidden="true">⬡</span>
          <p>{t('office_canvas.placeholder_label')}</p>
          <p className="office-canvas__sub">{t('office_canvas.placeholder_hint')}</p>
        </div>
      </div>
    </div>
  );
}
