/**
 * @file OfficeScene.ts
 * @description Phaser 3 scene for the 2D office simulation (5-Room SaaS Dashboard Layout).
 *
 * Implements a strict 5-room grid layout based on the user's ASCI architecture.
 * Top row: 3 rooms (Lit. Lab, Research HQ, Data Lab)
 * Bottom row: 2 rooms (Experiment Lab, Writing Lab)
 * 
 * Standardizes scale to 1 Tile = 32px. Uses ultra-clean UI overlays for labels.
 *
 * @module components/phaser/scenes
 */

import Phaser from 'phaser';
import type { Agent, AgentStatus } from '../../../types';

interface RoomBounds {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  tint: number;
}

interface DeskSlot {
  id: string;
  x: number;
  y: number;
  label: string;
  assignedAgentId: string | null;
  bounds: RoomBounds;
}

interface AgentVisual {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  label: Phaser.GameObjects.Text;
  statusDot: Phaser.GameObjects.Arc;
  glow: Phaser.GameObjects.Arc;
  targetX: number;
  targetY: number;
  isWandering: boolean;
  wanderingEvent?: Phaser.Time.TimerEvent;
  homeDesk: DeskSlot;
}

const TILE_SIZE = 32;

export class OfficeScene extends Phaser.Scene {
  private agentVisuals: Map<string, AgentVisual> = new Map();
  private deskSlots: DeskSlot[] = [];
  private rooms: RoomBounds[] = [];

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
    this.cameras.main.setBackgroundColor('#0d0d12');

    this.calculateArchitecture();
    this.renderArchitecture();
    this.renderDesks();

    this.scale.on('resize', this.handleResize, this);

    window.dispatchEvent(new CustomEvent('phaser-scene-ready'));
  }

  private handleResize(gameSize: Phaser.Structs.Size) {
    this.cameras.main.setSize(gameSize.width, gameSize.height);
    this.scene.restart();
  }

  /**
   * Calculates the exact pixel coordinates for the 5-room grid layout.
   */
  private calculateArchitecture() {
    const width = this.scale.width;
    const height = this.scale.height;

    // A small padding to simulate the outer SaaS container border
    const pad = 16;
    const innerW = width - (pad * 2);
    const innerH = height - (pad * 2);

    const halfH = innerH / 2;
    
    // Top Row (3 Rooms)
    const topW = innerW / 3;
    const litLab = { name: 'Lit. Lab', x: pad, y: pad, w: topW, h: halfH, tint: 0x23211c };
    const resHQ = { name: 'Research HQ', x: pad + topW, y: pad, w: topW, h: halfH, tint: 0x16161d };
    const dataLab = { name: 'Data Lab', x: pad + (topW * 2), y: pad, w: topW, h: halfH, tint: 0x141a22 };

    // Bottom Row (2 Rooms)
    const botW = innerW / 2;
    const expLab = { name: 'Experiment Lab', x: pad, y: pad + halfH, w: botW, h: halfH, tint: 0x14201c };
    const wrtLab = { name: 'Writing Lab', x: pad + botW, y: pad + halfH, w: botW, h: halfH, tint: 0x1b161c };

    this.rooms = [litLab, resHQ, dataLab, expLab, wrtLab];

    // Assign Desks to the exact center of each room
    this.deskSlots = [
      { id: 'desk_lit', x: litLab.x + (litLab.w / 2), y: litLab.y + (litLab.h / 2), label: 'Literature', assignedAgentId: null, bounds: litLab },
      { id: 'desk_res', x: resHQ.x + (resHQ.w / 2), y: resHQ.y + (resHQ.h / 2), label: 'Orchestrator', assignedAgentId: null, bounds: resHQ },
      { id: 'desk_data', x: dataLab.x + (dataLab.w / 2), y: dataLab.y + (dataLab.h / 2), label: 'Data', assignedAgentId: null, bounds: dataLab },
      { id: 'desk_exp', x: expLab.x + (expLab.w / 2), y: expLab.y + (expLab.h / 2), label: 'Experiment', assignedAgentId: null, bounds: expLab },
      { id: 'desk_wrt', x: wrtLab.x + (wrtLab.w / 2), y: wrtLab.y + (wrtLab.h / 2), label: 'Writing', assignedAgentId: null, bounds: wrtLab },
    ];
  }

  /**
   * Renders the walls, floors, and filigree text based on architecture.
   */
  private renderArchitecture(): void {
    // 1. Draw smooth floor grid to cover everything behind the lines
    const mapCols = Math.ceil(this.scale.width / TILE_SIZE);
    const mapRows = Math.ceil(this.scale.height / TILE_SIZE);
    
    for (let c = 0; c < mapCols; c++) {
      for (let r = 0; r < mapRows; r++) {
        const tile = this.add.image(c * TILE_SIZE, r * TILE_SIZE, 'urban_tiles', 14).setOrigin(0, 0);
        tile.setDisplaySize(TILE_SIZE, TILE_SIZE);
        
        // Find which room this tile belongs to, to tint it
        const centerX = (c * TILE_SIZE) + (TILE_SIZE / 2);
        const centerY = (r * TILE_SIZE) + (TILE_SIZE / 2);
        
        const room = this.rooms.find(rm => 
          centerX >= rm.x && centerX <= rm.x + rm.w &&
          centerY >= rm.y && centerY <= rm.y + rm.h
        );
        
        tile.setTint(room ? room.tint : 0x0d0d12);
        tile.setDepth(0);
      }
    }

    // 2. Draw crisp SaaS vector lines for walls
    const g = this.add.graphics();
    g.lineStyle(1, 0x2c2c3b, 1);
    
    this.rooms.forEach(room => {
      // Room border
      g.strokeRect(room.x, room.y, room.w, room.h);
      
      // Filigree watermark text in the center of each room
      const text = this.add.text(room.x + (room.w / 2), room.y + (room.h / 2) - 32, room.name.toUpperCase(), {
        fontFamily: 'Inter, sans-serif',
        fontSize: '16px',
        color: '#ffffff',
        fontWeight: 'bold',
        letterSpacing: 2
      }).setOrigin(0.5);
      
      text.setAlpha(0.04); // Extremely subtle watermark
      text.setDepth(1);
    });

    g.setDepth(2);
  }

  /**
   * Renders minimal professional workstations.
   */
  private renderDesks(): void {
    this.deskSlots.forEach((desk) => {
      // Desk (Standardized 1x2 scale)
      const deskTile = this.add.image(desk.x, desk.y, 'urban_tiles', 133);
      deskTile.setDisplaySize(TILE_SIZE, TILE_SIZE * 1.5); 
      deskTile.setDepth(10); 

      // Monitor (Standardized ~0.75x0.75)
      const monitorTile = this.add.image(desk.x, desk.y - 8, 'urban_tiles', 160);
      monitorTile.setDisplaySize(20, 20);
      monitorTile.setDepth(11);

      // Keyboard
      const kbTile = this.add.image(desk.x, desk.y + 6, 'urban_tiles', 162);
      kbTile.setDisplaySize(16, 16);
      kbTile.setDepth(11);
    });
  }

  public syncAgents(agents: Agent[]): void {
    if (!this.sys || !this.add) return;
    const currentIds = new Set(agents.map((a) => a.id));

    for (const [id, visual] of this.agentVisuals.entries()) {
      if (!currentIds.has(id)) {
        if (visual.wanderingEvent) visual.wanderingEvent.destroy();
        visual.sprite.destroy();
        visual.shadow.destroy();
        visual.label.destroy();
        visual.statusDot.destroy();
        visual.glow.destroy();
        this.agentVisuals.delete(id);
      }
    }

    agents.forEach((agent, index) => {
      // Assign based on array index ensuring each room gets an agent if possible
      const assignedDesk = this.deskSlots[index % this.deskSlots.length];
      const deskTargetX = assignedDesk.x;
      const deskTargetY = assignedDesk.y - 12; 

      if (!this.agentVisuals.has(agent.id)) {
        this.createAgentVisual(agent, deskTargetX, deskTargetY, assignedDesk);
      } else {
        this.updateAgentVisual(agent, deskTargetX, deskTargetY);
      }
    });
  }

  private createAgentVisual(agent: Agent, deskX: number, deskY: number, homeDesk: DeskSlot): void {
    const textureKey = `robot_${agent.color || 'blue'}`;

    const shadow = this.add.ellipse(deskX, deskY + 16, 18, 6, 0x000000, 0.4);
    shadow.setDepth(12);

    const glow = this.add.circle(deskX, deskY, 18, this.getColorHex(agent.color), 0.1);
    glow.setDepth(12);

    const sprite = this.add.sprite(deskX, deskY, textureKey);
    sprite.setDisplaySize(22, 28); 
    sprite.setDepth(13);
    sprite.setInteractive({ useHandCursor: true });

    // Minimal SaaS Label (Muted, ultra-small, natural placement)
    const label = this.add.text(deskX, deskY + 20, homeDesk.label, {
      fontFamily: 'Inter, sans-serif',
      fontSize: '9px',
      color: '#707080',
      fontWeight: '500'
    }).setOrigin(0.5);
    label.setDepth(14);
    
    // Minimal Status Dot instead of massive emoji bubbles
    const statusDot = this.add.circle(deskX + 10, deskY - 14, 3, this.getStatusColor(agent.status));
    statusDot.setStrokeStyle(1, 0x000000);
    statusDot.setDepth(15);

    // Hover effect
    sprite.on('pointerover', () => {
      label.setText(agent.name);
      label.setColor('#ffffff');
    });
    sprite.on('pointerout', () => {
      label.setText(homeDesk.label);
      label.setColor('#707080');
    });

    const visual: AgentVisual = { 
      sprite, shadow, label, statusDot, glow, 
      targetX: deskX, targetY: deskY, isWandering: false, homeDesk 
    };

    this.agentVisuals.set(agent.id, visual);
    this.startWanderingLoop(agent.id);
  }

  private updateAgentVisual(agent: Agent, deskX: number, deskY: number): void {
    const visual = this.agentVisuals.get(agent.id);
    if (!visual) return;

    visual.statusDot.setFillStyle(this.getStatusColor(agent.status));
    visual.glow.setFillStyle(this.getColorHex(agent.color), 0.1);

    if (agent.status === 'working') {
      visual.isWandering = false;
      this.moveToPoint(visual, deskX, deskY);
    } 
  }

  private startWanderingLoop(agentId: string) {
    const visual = this.agentVisuals.get(agentId);
    if (!visual) return;

    visual.wanderingEvent = this.time.addEvent({
      delay: Phaser.Math.Between(4000, 8000),
      loop: true,
      callback: () => {
        // If the dot is orange (working), do not wander
        const isWorking = visual.statusDot.fillColor === 0xf59e0b;
        
        if (!isWorking) {
          visual.isWandering = true;
          // Confine wandering specifically to the agent's home room bounds
          const b = visual.homeDesk.bounds;
          
          // Shrink bounds slightly to avoid walking ON the walls
          const margin = 32;
          const targetX = Phaser.Math.Between(b.x + margin, b.x + b.w - margin);
          const targetY = Phaser.Math.Between(b.y + margin, b.y + b.h - margin);
          
          this.moveToPoint(visual, targetX, targetY);
        }
      }
    });
  }

  private moveToPoint(visual: AgentVisual, x: number, y: number) {
    if (visual.targetX === x && visual.targetY === y) return;

    if (x < visual.sprite.x) {
      visual.sprite.setFlipX(true);
    } else if (x > visual.sprite.x) {
      visual.sprite.setFlipX(false);
    }

    visual.targetX = x;
    visual.targetY = y;

    const distance = Phaser.Math.Distance.Between(visual.sprite.x, visual.sprite.y, x, y);
    const duration = distance * 15; 

    this.tweens.killTweensOf([visual.sprite, visual.shadow, visual.label, visual.statusDot, visual.glow]);

    this.tweens.add({
      targets: [visual.sprite, visual.shadow, visual.label, visual.statusDot, visual.glow],
      x: x,
      y: y,
      duration: Math.max(duration, 800),
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.tweens.add({
          targets: [visual.sprite, visual.glow],
          y: y - 2,
          duration: 1200,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    });
  }

  private getStatusColor(status: AgentStatus): number {
    switch (status) {
      case 'thinking': return 0x3b82f6; // Blue
      case 'working': return 0xf59e0b;  // Orange
      case 'blocked': return 0xef4444;  // Red
      case 'done': return 0x10b981;     // Green
      case 'walking': return 0x8b5cf6;  // Purple
      case 'idle':
      default: return 0x9ca3af;         // Gray
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
