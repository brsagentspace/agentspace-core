/**
 * @file OfficeScene.ts
 * @description Phaser 3 scene for the 2D office simulation.
 *
 * Implements a detailed RPG tilemap level design with 4 separate rooms,
 * proper walls, decorations (props), detailed workstations, and agents.
 *
 * @module components/phaser/scenes
 */

import Phaser from 'phaser';
import type { Agent, AgentStatus } from '../../../types';

interface DeskSlot {
  id: string;
  x: number;
  y: number;
  label: string;
  assignedAgentId: string | null;
}

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

const TILE_SIZE = 32; // Scaled from 16x16 to 32x32

export class OfficeScene extends Phaser.Scene {
  private agentVisuals: Map<string, AgentVisual> = new Map();

  // Positions mapped to the center of 4 rooms
  private deskSlots: DeskSlot[] = [
    { id: 'desk_1', x: 150, y: 150, label: 'Architect (Tier 1)', assignedAgentId: null },
    { id: 'desk_2', x: 450, y: 150, label: 'Frontend-Bot', assignedAgentId: null },
    { id: 'desk_3', x: 150, y: 350, label: 'Backend-Bot', assignedAgentId: null },
    { id: 'desk_4', x: 450, y: 350, label: 'QA-Service', assignedAgentId: null },
    { id: 'desk_5', x: 300, y: 250, label: 'Database-Agent', assignedAgentId: null },
  ];

  private officeContainer!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'OfficeScene' });
  }

  preload(): void {
    this.load.image('robot_blue', '/assets/robots/robot_blue.png');
    this.load.image('robot_red', '/assets/robots/robot_red.png');
    this.load.image('robot_yellow', '/assets/robots/robot_yellow.png');
    this.load.image('robot_green', '/assets/robots/robot_green.png');

    this.load.spritesheet('urban_tiles', '/assets/tiles/tilemap_packed.png', {
      frameWidth: 16,
      frameHeight: 16,
    });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#000000');
    this.officeContainer = this.add.container(0, 0);

    this.renderLevel();
    this.renderDesks();

    // Minor breathing effect for the entire level
    this.tweens.add({
      targets: this.officeContainer,
      alpha: { from: 0.96, to: 1 },
      duration: 4000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    window.dispatchEvent(new CustomEvent('phaser-scene-ready'));
  }

  /**
   * Generates the 2D Tilemap (Rooms, Walls, Floors)
   */
  private renderLevel(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const mapCols = Math.ceil(width / TILE_SIZE);
    const mapRows = Math.ceil(height / TILE_SIZE);

    for (let c = 0; c < mapCols; c++) {
      for (let r = 0; r < mapRows; r++) {
        let isWall = false;

        // Check walls (borders only for a clean open-space office)
        if (c === 0 || c === mapCols - 1 || r === 0 || r === mapRows - 1) {
          isWall = true;
        }

        // 14 = clean floor tile, 0 = wall
        const tileId = isWall ? 0 : 14; 

        const tile = this.add.image(c * TILE_SIZE, r * TILE_SIZE, 'urban_tiles', tileId).setOrigin(0, 0);
        tile.setDisplaySize(TILE_SIZE, TILE_SIZE);
        
        // Depth sorting: floors at bottom, walls slightly higher
        tile.setDepth(isWall ? 1 : 0);

        // Cleaned up random props logic to make it look professional
        if (isWall && c > 0 && c < mapCols - 1 && r > 0 && r < mapRows - 1) {
          if (Math.random() > 0.9) {
            const propId = 200; // Single clean window tile
            const prop = this.add.image(c * TILE_SIZE, r * TILE_SIZE, 'urban_tiles', propId).setOrigin(0, 0);
            prop.setDisplaySize(TILE_SIZE, TILE_SIZE);
            prop.setDepth(2);
          }
        }
      }
    }
  }

  /**
   * Renders the workstations (Desks, Monitors) inside the rooms.
   */
  private renderDesks(): void {
    this.deskSlots.forEach((desk) => {
      // Desk Base
      const deskTile = this.add.image(desk.x, desk.y, 'urban_tiles', 133);
      deskTile.setScale(2.5); 
      deskTile.setDepth(10); // Above floor

      // Monitor
      const monitorTile = this.add.image(desk.x, desk.y - 12, 'urban_tiles', 160);
      monitorTile.setScale(2.2);
      monitorTile.setDepth(11);

      // Keyboard (Guessing ID 162 or similar)
      const kbTile = this.add.image(desk.x, desk.y + 6, 'urban_tiles', 162);
      kbTile.setScale(1.5);
      kbTile.setDepth(11);
      
      // Random plant (ID 210) next to desk
      if (Math.random() > 0.5) {
        const plant = this.add.image(desk.x + 32, desk.y, 'urban_tiles', 210);
        plant.setScale(2);
        plant.setDepth(11);
      }
    });
  }

  public syncAgents(agents: Agent[]): void {
    if (!this.sys || !this.add) return;

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
      const targetY = assignedDesk.y - 16; // Agent sits BEHIND the desk

      if (!this.agentVisuals.has(agent.id)) {
        this.createAgentVisual(agent, targetX, targetY);
      } else {
        this.updateAgentVisual(agent, targetX, targetY);
      }
    });
  }

  private createAgentVisual(agent: Agent, targetX: number, targetY: number): void {
    const textureKey = `robot_${agent.color || 'blue'}`;

    // Soft drop shadow
    const shadow = this.add.ellipse(targetX, targetY + 24, 28, 12, 0x000000, 0.6);
    shadow.setDepth(12);

    const glow = this.add.circle(targetX, targetY, 24, this.getColorHex(agent.color), 0.15);
    glow.setDepth(12);

    // Robot Sprite
    const sprite = this.add.sprite(targetX, targetY, textureKey);
    sprite.setDisplaySize(38, 40); // Slightly smaller to fit the desk proportion
    sprite.setInteractive({ useHandCursor: true });
    sprite.setDepth(13);

    // Agent Name Badge (Muratify Style: Neon green on black)
    const label = this.add.text(targetX, targetY + 32, agent.name.toUpperCase(), {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '9px',
      color: '#10b981', // Neon Green
      backgroundColor: '#000000',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5);
    label.setDepth(14);
    
    // Tiny white border for the label to make it pop
    label.setStroke('#111', 1);

    // Status Bubble
    const statusBubble = this.add.container(targetX + 18, targetY - 24);
    statusBubble.setDepth(15);
    
    const bubbleBg = this.add.graphics();
    bubbleBg.fillStyle(0xffffff, 1);
    bubbleBg.fillRoundedRect(-12, -10, 24, 20, 4);
    bubbleBg.lineStyle(1, 0x000000, 1);
    bubbleBg.strokeRoundedRect(-12, -10, 24, 20, 4);

    const bubbleText = this.add.text(0, 0, this.getStatusIcon(agent.status), {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#000000',
      fontWeight: 'bold'
    }).setOrigin(0.5);

    statusBubble.add([bubbleBg, bubbleText]);

    this.tweens.add({
      targets: [sprite, glow],
      y: targetY - 2,
      duration: 1500 + Math.random() * 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.agentVisuals.set(agent.id, { sprite, shadow, label, statusBubble, bubbleText, glow, targetX, targetY });
  }

  private updateAgentVisual(agent: Agent, targetX: number, targetY: number): void {
    const visual = this.agentVisuals.get(agent.id);
    if (!visual) return;

    visual.bubbleText.setText(this.getStatusIcon(agent.status));
    visual.label.setText(agent.name.toUpperCase());
    visual.glow.setFillStyle(this.getColorHex(agent.color), 0.15);

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

  private getStatusIcon(status: AgentStatus): string {
    switch (status) {
      case 'thinking': return '...';
      case 'working': return '⚡';
      case 'blocked': return '!';
      case 'done': return '✓';
      case 'walking': return '➤';
      case 'idle':
      default: return 'z';
    }
  }

  private getColorHex(color: string): number {
    switch (color) {
      case 'yellow': return 0xf59e0b;
      case 'red': return 0xef4444;
      case 'green': return 0x3fb950;
      case 'blue':
      default: return 0x3b82f6;
    }
  }
}
