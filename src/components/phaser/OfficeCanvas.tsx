/**
 * @file OfficeCanvas.tsx
 * @description 2D office simulation canvas mounted with Phaser 3.
 *
 * Mounts the Phaser.Game instance into a DOM container and keeps the
 * game scene synchronized with the Zustand store's active agents in real time.
 *
 * @module components/phaser
 */

import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { useTranslation } from 'react-i18next';
import { useAgentSpaceStore } from '../../store';
import { OfficeScene } from './scenes/OfficeScene';
import './OfficeCanvas.css';

/**
 * Renders the Phaser 2D Office canvas container.
 *
 * @returns The canvas wrapper container.
 */
export function OfficeCanvas() {
  const { t } = useTranslation('layout');
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<OfficeScene | null>(null);

  const agents = useAgentSpaceStore((s) => s.agents);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create scene instance
    const scene = new OfficeScene();
    sceneRef.current = scene;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: '100%',
      height: '100%',
      backgroundColor: '#09090d',
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      render: {
        pixelArt: false,
        antialias: true,
      },
      scene: [scene],
    };

    const game = new Phaser.Game(config);
    gameRef.current = game;

    const onSceneReady = () => {
      scene.syncAgents(useAgentSpaceStore.getState().agents);
    };
    window.addEventListener('phaser-scene-ready', onSceneReady);

    return () => {
      window.removeEventListener('phaser-scene-ready', onSceneReady);
      game.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  // Sync agents whenever store updates
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.syncAgents(agents);
    }
  }, [agents]);

  return (
    <div
      ref={containerRef}
      className="office-canvas"
      role="region"
      aria-label={t('office_canvas.placeholder_label')}
    />
  );
}
