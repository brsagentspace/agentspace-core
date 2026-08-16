/**
 * @file OfficeScene.ts
 * @description Phaser 3 scene for the 2D office simulation.
 *
 * Handles isometric/top-down office tile rendering, desk placements,
 * robot agent sprite lifecycle (idle, walking, thinking, working),
 * speech/thought bubbles, and real-time synchronization with the Zustand store.
 *
 * @module components/phaser/scenes
 */

import Phaser from 'phaser';
import type { Agent, AgentStatus } from '../../../types';

/**
 * Visual configuration for the office layout.
 */
interface DeskSlot {
  id: string;
  x: number;
  y: number;
  label: string;
  assignedAgentId: string | null;
}

/**
 * Representation of an active robot sprite with its UI elements (label, thought bubble, status dot).
 */
interface AgentVisual {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  label: Phaser.GameObjects.Text;
  statusBubble: Phaser.GameObjects.Container;
  bubbleText: Phaser.GameObjects.Text;
  glow: Phaser.GameObjects.Arc;
  targetX: number;
  targetY: number;
}

export class OfficeScene extends Phaser.Scene {
  /** Map of agent ID to active visual game objects */
  private agentVisuals: Map<string, AgentVisual> = new Map();

  /** Predefined office desk stations */
  private deskSlots: DeskSlot[] = [
    { id: 'desk_1', x: 220, y: 180, label: 'Station Alpha (Architect)', assignedAgentId: null },
    { id: 'desk_2', x: 440, y: 180, label: 'Station Beta (Frontend)', assignedAgentId: null },
    { id: 'desk_3', x: 220, y: 360, label: 'Station Gamma (Backend)', assignedAgentId: null },
    { id: 'desk_4', x: 440, y: 360, label: 'Station Delta (QA)', assignedAgentId: null },
    { id: 'desk_5', x: 660, y: 270, label: 'Station Epsilon (ML / Data)', assignedAgentId: null },
  ];

  /** Grid and environment graphics container */
  private officeContainer!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'OfficeScene' });
  }

  /**
   * Preload static assets including robot textures and tilemap.
   */
  preload(): void {
    // Top-down robot sprites
    this.load.image('robot_blue', '/assets/robots/robot_blue.png');
    this.load.image('robot_red', '/assets/robots/robot_red.png');
    this.load.image('robot_yellow', '/assets/robots/robot_yellow.png');
    this.load.image('robot_green', '/assets/robots/robot_green.png');

    // Tiles
    this.load.image('tiles_packed', '/assets/tiles/tilemap_packed.png');
  }

  /**
   * Initialize scene objects, office environment, and lighting/grid effects.
   */
  create(): void {
    this.cameras.main.setBackgroundColor('#09090d');

    this.officeContainer = this.add.container(0, 0);

    this.renderOfficeEnvironment();
    this.renderDesks();

    // Pulse animation for thinking state
    this.tweens.add({
      targets: this.officeContainer,
      alpha: { from: 0.98, to: 1 },
      duration: 3000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Notify ready to external subscribers if any
    this.events.emit('scene-ready');
  }

  /**
   * Renders the stylized floor tiles and room boundaries.
   */
  private renderOfficeEnvironment(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    // Floor background with dark tech styling
    const floor = this.add.graphics();
    floor.fillStyle(0x0e0e15, 1);
    floor.fillRoundedRect(40, 40, width - 80, height - 80, 16);

    // Floor border outline
    floor.lineStyle(2, 0x1f1f2e, 1);
    floor.strokeRoundedRect(40, 40, width - 80, height - 80, 16);

    // Tech grid dots across office area
    floor.fillStyle(0x28283d, 0.4);
    for (let x = 70; x < width - 70; x += 32) {
      for (let y = 70; y < height - 70; y += 32) {
        floor.fillCircle(x, y, 1.5);
      }
    }

    // Zone indicators / Division line
    const dividers = this.add.graphics();
    dividers.lineStyle(1, 0x222233, 0.8);
    dividers.lineBetween(width * 0.58, 60, width * 0.58, height - 60);

    // Zone Labels
    this.add.text(60, 56, 'AGENTS WORKSPACE', {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '10px',
      color: '#3b82f6',
      letterSpacing: 2,
    });

    this.add.text(width * 0.61, 56, 'COLLABORATION HUB', {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '10px',
      color: '#4a4a5e',
      letterSpacing: 2,
    });
  }

  /**
   * Renders desk furniture and monitor screens.
   */
  private renderDesks(): void {
    this.deskSlots.forEach((desk) => {
      const g = this.add.graphics();

      // Desk wood/metal surface
      g.fillStyle(0x181824, 1);
      g.fillRoundedRect(desk.x - 45, desk.y - 30, 90, 60, 8);
      g.lineStyle(1.5, 0x2e2e42, 1);
      g.strokeRoundedRect(desk.x - 45, desk.y - 30, 90, 60, 8);

      // Computer Monitor Base & Screen
      g.fillStyle(0x0a0a0f, 1);
      g.fillRoundedRect(desk.x - 22, desk.y - 22, 44, 14, 3);
      g.lineStyle(1, 0x3b82f6, 0.8);
      g.strokeRoundedRect(desk.x - 22, desk.y - 22, 44, 14, 3);

      // Keyboard & Mouse
      g.fillStyle(0x222230, 1);
      g.fillRoundedRect(desk.x - 16, desk.y - 2, 32, 10, 2);
      g.fillRoundedRect(desk.x + 22, desk.y - 1, 8, 12, 3);

      // Desk label
      this.add.text(desk.x, desk.y + 38, desk.label.split(' ')[1] || 'Desk', {
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '9px',
        color: '#55556a',
      }).setOrigin(0.5);
    });
  }

  /**
   * Syncs agents from the Zustand store into the Phaser world.
   *
   * @param agents - Current list of active agents
   */
  public syncAgents(agents: Agent[]): void {
    const currentIds = new Set(agents.map((a) => a.id));

    // Remove deleted agents
    for (const [id, visual] of this.agentVisuals.entries()) {
      if (!currentIds.has(id)) {
        visual.sprite.destroy();
        visual.shadow.destroy();
        visual.label.destroy();
        visual.statusBubble.destroy();
        visual.glow.destroy();
        this.agentVisuals.delete(id);
      }
    }

    // Add or update agents
    agents.forEach((agent, index) => {
      const assignedDesk = this.deskSlots[index % this.deskSlots.length];
      const targetX = assignedDesk.x;
      const targetY = assignedDesk.y + 10;

      if (!this.agentVisuals.has(agent.id)) {
        this.createAgentVisual(agent, targetX, targetY);
      } else {
        this.updateAgentVisual(agent, targetX, targetY);
      }
    });
  }

  /**
   * Instantiates the graphical representation of a robot agent.
   */
  private createAgentVisual(agent: Agent, targetX: number, targetY: number): void {
    const textureKey = `robot_${agent.color || 'blue'}`;

    // Soft drop shadow
    const shadow = this.add.ellipse(targetX, targetY + 24, 38, 16, 0x000000, 0.4);

    // Glow effect
    const glow = this.add.circle(targetX, targetY, 28, this.getColorHex(agent.color), 0.15);

    // Robot Sprite (scaled down from original 148x154 to 48x50)
    const sprite = this.add.sprite(targetX, targetY, textureKey);
    sprite.setDisplaySize(48, 50);
    sprite.setInteractive({ useHandCursor: true });

    // Agent Name Badge
    const label = this.add.text(targetX, targetY - 36, agent.name, {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '10px',
      color: '#e2e2e8',
      backgroundColor: '#12121ae6',
      padding: { x: 6, y: 2 },
    }).setOrigin(0.5);

    // Status / Thought Bubble container
    const statusBubble = this.add.container(targetX + 22, targetY - 30);
    const bubbleBg = this.add.graphics();
    bubbleBg.fillStyle(0x1e1e2d, 0.95);
    bubbleBg.fillRoundedRect(-16, -12, 32, 20, 6);
    bubbleBg.lineStyle(1, 0x3b82f6, 0.8);
    bubbleBg.strokeRoundedRect(-16, -12, 32, 20, 6);

    const bubbleText = this.add.text(0, -2, this.getStatusIcon(agent.status), {
      fontSize: '11px',
      color: '#ffffff',
    }).setOrigin(0.5);

    statusBubble.add([bubbleBg, bubbleText]);

    // Floating idle breathing animation
    this.tweens.add({
      targets: [sprite, glow],
      y: targetY - 3,
      duration: 1200 + Math.random() * 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.agentVisuals.set(agent.id, {
      sprite,
      shadow,
      label,
      statusBubble,
      bubbleText,
      glow,
      targetX,
      targetY,
    });
  }

  /**
   * Updates an existing agent's visuals and status indicator.
   */
  private updateAgentVisual(agent: Agent, targetX: number, targetY: number): void {
    const visual = this.agentVisuals.get(agent.id);
    if (!visual) return;

    visual.bubbleText.setText(this.getStatusIcon(agent.status));
    visual.label.setText(agent.name);

    // Update glow color if role/color altered
    visual.glow.setFillStyle(this.getColorHex(agent.color), 0.15);

    // If position changed, tween to new spot
    if (visual.targetX !== targetX || visual.targetY !== targetY) {
      visual.targetX = targetX;
      visual.targetY = targetY;

      this.tweens.add({
        targets: [visual.sprite, visual.shadow, visual.label, visual.statusBubble, visual.glow],
        x: targetX,
        y: targetY,
        duration: 800,
        ease: 'Power2',
      });
    }
  }

  /**
   * Returns a status icon / emote string based on agent status.
   */
  private getStatusIcon(status: AgentStatus): string {
    switch (status) {
      case 'thinking':
        return '⋯';
      case 'working':
        return '⚡';
      case 'blocked':
        return '!';
      case 'done':
        return '✓';
      case 'walking':
        return '➤';
      case 'idle':
      default:
        return 'z';
    }
  }

  /**
   * Converts agent color name to hex integer.
   */
  private getColorHex(color: string): number {
    switch (color) {
      case 'yellow':
        return 0xf59e0b;
      case 'red':
        return 0xef4444;
      case 'green':
        return 0x3fb950;
      case 'blue':
      default:
        return 0x3b82f6;
    }
  }
}
