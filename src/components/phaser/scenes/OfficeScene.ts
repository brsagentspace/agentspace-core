/**
 * @file OfficeScene.ts
 * @description Phaser 3 scene — Professional pixel-art HQ simulation.
 *
 * Multi-room top-down office with LPC (Liberated Pixel Cup) animated characters.
 * Characters walk between desks using real LPC walk animations (9 frames/direction).
 * Rooms have distinct checkerboard floors, walls, plants, server racks, and desks.
 *
 * LPC license: CC-BY-SA 3.0 / GPL 3.0
 * Original art by: Lanea Zimmermann, Charles Sanchez, and LPC contributors
 *
 * @module components/phaser/scenes
 */

import Phaser from 'phaser';
import type { Agent, AgentStatus } from '../../../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const T = 16;         // base tile px (RPGUrban tileset)
const WALL = 3;       // wall band in tiles
const AGENT_ROLES = ['architect', 'frontend', 'backend', 'qa', 'researcher', 'data'] as const;

// LPC walk spritesheet: 9 columns × 1 row (south strip only)
// Each frame is 64×64 in the agent_*_walk.png files
const LPC_FRAME_W = 64;
const LPC_FRAME_H = 64;


// ─── Types ────────────────────────────────────────────────────────────────────

interface RoomDef {
  id: string;
  label: string;
  col: number;
  row: number;
  cols: number;
  rows: number;
  floorColor: number;
  accentColor: number;
}

interface DeskPos {
  roomId: string;
  deskCol: number;   // relative col inside room (past wall)
  deskRow: number;
}

interface AgentVisual {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  ring: Phaser.GameObjects.Arc;
  nameTag: Phaser.GameObjects.Text;
  roleTag: Phaser.GameObjects.Text;
  bubble: Phaser.GameObjects.Text;
  bubbleBg: Phaser.GameObjects.Rectangle;
  homeX: number;
  homeY: number;
  roomBounds: { x: number; y: number; w: number; h: number };
  wanderTimer?: Phaser.Time.TimerEvent;
  isMoving: boolean;
}

// ─── Room Layout ─────────────────────────────────────────────────────────────

const ROOMS: RoomDef[] = [
  {
    id: 'architect_room',
    label: 'ARCHITECT',
    col: 0, row: 0, cols: 20, rows: 15,
    floorColor: 0x4a3728,   // warm brown
    accentColor: 0x6b5030,
  },
  {
    id: 'research_room',
    label: 'RESEARCH HQ',
    col: 21, row: 0, cols: 22, rows: 15,
    floorColor: 0x1a4040,   // dark teal
    accentColor: 0x2a6060,
  },
  {
    id: 'data_room',
    label: 'DATA LAB',
    col: 44, row: 0, cols: 18, rows: 15,
    floorColor: 0x1a2040,   // dark blue
    accentColor: 0x2a3060,
  },
  {
    id: 'experiment_room',
    label: 'EXPERIMENT',
    col: 0, row: 16, cols: 24, rows: 15,
    floorColor: 0x1a3020,   // dark green
    accentColor: 0x2a5030,
  },
  {
    id: 'writing_room',
    label: 'WRITING',
    col: 25, row: 16, cols: 20, rows: 15,
    floorColor: 0x30183a,   // dark purple
    accentColor: 0x502860,
  },
];

// Desk positions per room (col/row offsets inside room interior, past wall)
const DESKS: DeskPos[] = [
  // Architect room
  { roomId: 'architect_room', deskCol: 3, deskRow: 3 },
  { roomId: 'architect_room', deskCol: 10, deskRow: 3 },
  { roomId: 'architect_room', deskCol: 3, deskRow: 9 },
  { roomId: 'architect_room', deskCol: 10, deskRow: 9 },
  // Research HQ
  { roomId: 'research_room', deskCol: 3, deskRow: 3 },
  { roomId: 'research_room', deskCol: 9, deskRow: 3 },
  { roomId: 'research_room', deskCol: 15, deskRow: 3 },
  { roomId: 'research_room', deskCol: 3, deskRow: 9 },
  { roomId: 'research_room', deskCol: 9, deskRow: 9 },
  { roomId: 'research_room', deskCol: 15, deskRow: 9 },
  // Data lab
  { roomId: 'data_room', deskCol: 3, deskRow: 3 },
  { roomId: 'data_room', deskCol: 9, deskRow: 3 },
  { roomId: 'data_room', deskCol: 3, deskRow: 9 },
  { roomId: 'data_room', deskCol: 9, deskRow: 9 },
  // Experiment lab
  { roomId: 'experiment_room', deskCol: 3, deskRow: 3 },
  { roomId: 'experiment_room', deskCol: 10, deskRow: 3 },
  { roomId: 'experiment_room', deskCol: 3, deskRow: 9 },
  { roomId: 'experiment_room', deskCol: 10, deskRow: 9 },
  // Writing lab
  { roomId: 'writing_room', deskCol: 3, deskRow: 3 },
  { roomId: 'writing_room', deskCol: 9, deskRow: 3 },
  { roomId: 'writing_room', deskCol: 3, deskRow: 9 },
  { roomId: 'writing_room', deskCol: 9, deskRow: 9 },
];

// ─── Scene ────────────────────────────────────────────────────────────────────

export class OfficeScene extends Phaser.Scene {
  private agentVisuals: Map<string, AgentVisual> = new Map();
  private roomBounds: Map<string, { x: number; y: number; w: number; h: number }> = new Map();
  private deskPixels: { roomId: string; px: number; py: number }[] = [];
  private _S = 1;
  private _OX = 0;
  private _OY = 0;

  constructor() {
    super({ key: 'OfficeScene' });
  }

  // ── Preload ───────────────────────────────────────────────────────────────

  preload(): void {
    // LPC animated agents (walk strips - 9 frames south)
    for (const role of AGENT_ROLES) {
      this.load.spritesheet(
        `agent_${role}`,
        `/assets/agents/agent_${role}_walk.png`,
        { frameWidth: LPC_FRAME_W, frameHeight: LPC_FRAME_H }
      );
    }

    // Idle frames (single frame PNGs)
    for (const role of AGENT_ROLES) {
      this.load.image(`agent_${role}_idle`, `/assets/agents/agent_${role}_idle.png`);
    }

    // RPG Urban tileset for floor tiles
    this.load.spritesheet('urban', '/assets/tiles/tilemap_packed.png', {
      frameWidth: 16,
      frameHeight: 16,
      spacing: 1,
    });
  }

  // ── Create ────────────────────────────────────────────────────────────────

  create(): void {
    this.cameras.main.setBackgroundColor('#080a0e');
    this.computeLayout();
    this.buildAnimations();
    this.renderWorld();
    this.scale.on('resize', () => this.scene.restart(), this);
    window.dispatchEvent(new CustomEvent('phaser-scene-ready'));
  }

  // ── Layout ────────────────────────────────────────────────────────────────

  private computeLayout(): void {
    const totalCols = 63;
    const totalRows = 32;
    const scaleX = this.scale.width  / (totalCols * T);
    const scaleY = this.scale.height / (totalRows * T);
    this._S  = Math.min(scaleX, scaleY, 2);
    this._OX = (this.scale.width  - totalCols * T * this._S) / 2;
    this._OY = (this.scale.height - totalRows * T * this._S) / 2;

    this.roomBounds.clear();
    this.deskPixels = [];

    ROOMS.forEach(r => {
      const px = this._OX + r.col * T * this._S;
      const py = this._OY + r.row * T * this._S;
      const pw = r.cols * T * this._S;
      const ph = r.rows * T * this._S;
      this.roomBounds.set(r.id, { x: px, y: py, w: pw, h: ph });
    });

    DESKS.forEach(d => {
      const b = this.roomBounds.get(d.roomId)!;
      const wallPx = WALL * T * this._S;
      const px = b.x + wallPx + d.deskCol * T * this._S;
      const py = b.y + wallPx + d.deskRow * T * this._S;
      this.deskPixels.push({ roomId: d.roomId, px, py });
    });
  }

  // ── Animations ────────────────────────────────────────────────────────────

  private buildAnimations(): void {
    for (const role of AGENT_ROLES) {
      const key = `agent_${role}`;

      // Walk animation (9 frames south strip)
      if (!this.anims.exists(`${key}_walk`)) {
        this.anims.create({
          key: `${key}_walk`,
          frames: this.anims.generateFrameNumbers(key, { start: 0, end: 8 }),
          frameRate: 8,
          repeat: -1,
        });
      }

      // Idle (frame 0, paused)
      if (!this.anims.exists(`${key}_idle`)) {
        this.anims.create({
          key: `${key}_idle`,
          frames: this.anims.generateFrameNumbers(key, { frames: [0, 0] }),
          frameRate: 1,
          repeat: -1,
        });
      }
    }
  }

  // ── World ─────────────────────────────────────────────────────────────────

  private renderWorld(): void {
    ROOMS.forEach(room => {
      const b = this.roomBounds.get(room.id)!;
      this.renderRoom(room, b);
    });
    this.renderAllFurniture();
  }

  private renderRoom(room: RoomDef, b: { x: number; y: number; w: number; h: number }): void {
    const S = this._S;
    const wallPx = WALL * T * S;
    const g = this.add.graphics();
    g.setDepth(0);

    // ── Outer wall ──────────────────────────────────────────────────────────
    g.fillStyle(this.darken(room.floorColor, 0.5));
    g.fillRect(b.x, b.y, b.w, b.h);

    // ── Interior floor (checkerboard) ───────────────────────────────────────
    const ix = b.x + wallPx;
    const iy = b.y + wallPx;
    const iw = b.w - wallPx * 2;
    const ih = b.h - wallPx * 2;

    const tileStep = T * S * 2;
    const cols2 = Math.ceil(iw / tileStep) + 1;
    const rows2 = Math.ceil(ih / tileStep) + 1;

    for (let c = 0; c < cols2; c++) {
      for (let r = 0; r < rows2; r++) {
        const cx = ix + c * tileStep;
        const cy = iy + r * tileStep;
        const w  = Math.min(tileStep, ix + iw - cx);
        const h  = Math.min(tileStep, iy + ih - cy);
        if (w <= 0 || h <= 0) continue;

        const col = (c + r) % 2 === 0 ? room.floorColor : this.darken(room.floorColor, 0.15);
        g.fillStyle(col);
        g.fillRect(cx, cy, w, h);
      }
    }

    // ── Doorway gap (bottom center) ─────────────────────────────────────────
    const doorW = T * 4 * S;
    const doorX = b.x + b.w / 2 - doorW / 2;
    g.fillStyle(0x080a0e);
    g.fillRect(doorX, b.y + b.h - wallPx, doorW, wallPx);

    // ── Border lines ────────────────────────────────────────────────────────
    const lw = Math.max(1, S);
    g.lineStyle(lw, 0x3a3a4a, 1);
    g.strokeRect(b.x, b.y, b.w, b.h);
    g.lineStyle(lw * 0.5, this.lighten(room.floorColor, 0.3), 0.4);
    g.strokeRect(ix, iy, iw, ih);

    // ── Room label ──────────────────────────────────────────────────────────
    const labelSize = Math.round(Math.max(8, 9 * S));
    const label = this.add.text(
      ix + 5 * S,
      iy + 5 * S,
      room.label,
      {
        fontFamily: '"Courier New", monospace',
        fontSize: `${labelSize}px`,
        color: this.hexToCSS(this.lighten(room.floorColor, 0.7)),
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: Math.round(3 * S),
      }
    );
    label.setAlpha(0.8);
    label.setDepth(2);
  }

  // ── Furniture ─────────────────────────────────────────────────────────────

  private renderAllFurniture(): void {
    ROOMS.forEach(room => {
      const b = this.roomBounds.get(room.id)!;
      const S = this._S;
      const wallPx = WALL * T * S;
      const ix = b.x + wallPx;
      const iy = b.y + wallPx;
      const iw = b.w - wallPx * 2;
      const ih = b.h - wallPx * 2;

      // Corner plants
      this.drawPlant(ix + 6 * S, iy + 6 * S);
      this.drawPlant(ix + iw - 6 * S, iy + 6 * S);
      // Server rack (right wall)
      this.drawServerRack(ix + iw - 8 * S, iy + ih / 2, room.accentColor);
      // Bookshelf (left wall)
      this.drawBookshelf(ix + 4 * S, iy + ih / 2, room.accentColor);
    });

    // Desks
    this.deskPixels.forEach(d => {
      const room = ROOMS.find(r => r.id === d.roomId)!;
      this.drawDesk(d.px, d.py, room.accentColor);
    });
  }

  private drawDesk(px: number, py: number, accent: number): void {
    const S = this._S;
    const g = this.add.graphics();
    g.setDepth(5);

    const dw = Math.round(T * 3 * S);
    const dh = Math.round(T * 2 * S);

    // Desk surface
    g.fillStyle(0x6b5030);
    g.fillRect(px - dw / 2, py - dh / 2, dw, dh);
    g.fillStyle(0x8b6f45);
    g.fillRect(px - dw / 2, py - dh / 2, dw, dh - Math.round(4 * S));
    // Front edge shadow
    g.fillStyle(0x4a3010);
    g.fillRect(px - dw / 2, py + dh / 2 - Math.round(4 * S), dw, Math.round(4 * S));

    // Monitor
    const mw = Math.round(T * 1.5 * S);
    const mh = Math.round(T * 1.2 * S);
    const mx = px - mw / 2;
    const my = py - dh / 2 - mh;
    g.fillStyle(0x0f1020);
    g.fillRect(mx, my, mw, mh);
    g.fillStyle(accent, 0.8);
    g.fillRect(mx + Math.round(2 * S), my + Math.round(2 * S), mw - Math.round(4 * S), mh - Math.round(4 * S));
    // Screen scanline effect
    g.fillStyle(0x000000, 0.2);
    for (let line = 0; line < 3; line++) {
      g.fillRect(mx + Math.round(2 * S), my + Math.round(2 * S) + line * Math.round(3 * S), mw - Math.round(4 * S), Math.round(S));
    }

    // Keyboard
    g.fillStyle(0x2a2a38);
    g.fillRect(px - Math.round(T * 0.8 * S), py + Math.round(2 * S), Math.round(T * 1.6 * S), Math.round(T * 0.6 * S));

    // Chair (circle below desk)
    const cr = Math.round(T * 0.9 * S);
    g.fillStyle(0x1a1a28);
    g.fillEllipse(px, py + dh / 2 + cr, cr * 2, cr * 1.2);
    g.fillStyle(0x2a2a38);
    g.fillEllipse(px, py + dh / 2 + cr - Math.round(2 * S), cr * 1.6, cr);
  }

  private drawPlant(px: number, py: number): void {
    const S = this._S;
    const g = this.add.graphics();
    g.setDepth(4);

    // Pot
    g.fillStyle(0x8b3a1a);
    g.fillRect(px - Math.round(4 * S), py + Math.round(2 * S), Math.round(8 * S), Math.round(7 * S));
    g.fillStyle(0xa0501e);
    g.fillRect(px - Math.round(4 * S), py + Math.round(2 * S), Math.round(8 * S), Math.round(3 * S));

    // Leaves
    g.fillStyle(0x1a7a1a);
    g.fillEllipse(px, py - Math.round(4 * S), Math.round(14 * S), Math.round(16 * S));
    g.fillStyle(0x27a027);
    g.fillEllipse(px - Math.round(4 * S), py - Math.round(1 * S), Math.round(9 * S), Math.round(10 * S));
    g.fillEllipse(px + Math.round(4 * S), py - Math.round(1 * S), Math.round(9 * S), Math.round(10 * S));
    g.fillStyle(0x35b535);
    g.fillEllipse(px, py - Math.round(6 * S), Math.round(8 * S), Math.round(8 * S));
  }

  private drawServerRack(px: number, py: number, accent: number): void {
    const S = this._S;
    const g = this.add.graphics();
    g.setDepth(4);

    const rw = Math.round(10 * S);
    const rh = Math.round(26 * S);

    g.fillStyle(0x1a1a2e);
    g.fillRect(px - rw / 2, py - rh / 2, rw, rh);
    g.lineStyle(Math.max(1, S * 0.5), 0x3a3a5a, 1);
    g.strokeRect(px - rw / 2, py - rh / 2, rw, rh);

    const slotCount = 5;
    const slotH = Math.round(3.5 * S);
    const slotGap = Math.round(1.5 * S);
    for (let i = 0; i < slotCount; i++) {
      const sy = py - rh / 2 + Math.round(3 * S) + i * (slotH + slotGap);
      g.fillStyle(accent, 0.8);
      g.fillRect(px - rw / 2 + Math.round(1 * S), sy, rw - Math.round(2 * S), slotH);
      // LED dot
      const ledColor = i % 3 === 0 ? 0x00ff88 : i % 3 === 1 ? 0x4488ff : 0xff4444;
      g.fillStyle(ledColor);
      g.fillRect(px + rw / 2 - Math.round(3 * S), sy + Math.round(1 * S), Math.round(1.5 * S), Math.round(1.5 * S));
    }
  }

  private drawBookshelf(px: number, py: number, _accent: number): void {
    const S = this._S;
    const g = this.add.graphics();
    g.setDepth(4);

    const sw = Math.round(7 * S);
    const sh = Math.round(20 * S);

    g.fillStyle(0x5c3d1e);
    g.fillRect(px - sw / 2, py - sh / 2, sw, sh);
    g.lineStyle(Math.max(1, S * 0.5), 0x3a2010, 1);
    g.strokeRect(px - sw / 2, py - sh / 2, sw, sh);

    const bookColors = [0xcc3333, 0x3355cc, 0x33cc55, 0xccaa00, 0xaa33cc, 0xcc6633];
    for (let i = 0; i < 5; i++) {
      g.fillStyle(bookColors[i % bookColors.length]);
      g.fillRect(
        px - sw / 2 + Math.round(1 * S),
        py - sh / 2 + Math.round(2 * S) + i * Math.round(3.8 * S),
        sw - Math.round(2 * S),
        Math.round(2.8 * S),
      );
    }
  }

  // ── Agent Sync ────────────────────────────────────────────────────────────

  public syncAgents(agents: Agent[]): void {
    if (!this.sys?.isActive()) return;
    const currentIds = new Set(agents.map(a => a.id));

    for (const [id, visual] of this.agentVisuals.entries()) {
      if (!currentIds.has(id)) {
        visual.wanderTimer?.destroy();
        visual.container.destroy();
        this.agentVisuals.delete(id);
      }
    }

    agents.forEach((agent, idx) => {
      const deskIdx = idx % this.deskPixels.length;
      const desk = this.deskPixels[deskIdx];
      const room = ROOMS.find(r => r.id === desk.roomId)!;
      const bounds = this.roomBounds.get(room.id)!;

      if (!this.agentVisuals.has(agent.id)) {
        this.spawnAgent(agent, desk.px, desk.py, bounds);
      } else {
        this.refreshAgent(agent);
      }
    });
  }

  private spawnAgent(
    agent: Agent,
    homeX: number,
    homeY: number,
    roomBounds: { x: number; y: number; w: number; h: number },
  ): void {
    const S = this._S;
    const role = this.agentRole(agent);
    const animKey = `agent_${role}`;

    // Display scale for LPC chars (64px → smaller for tile scale)
    const charH = Math.round(32 * S);
    const charW = Math.round(charH * (LPC_FRAME_W / LPC_FRAME_H));

    // Shadow
    const shadow = this.add.ellipse(0, charH * 0.4, charW * 0.8, charH * 0.25, 0x000000, 0.4);
    shadow.setDepth(0);

    // Status ring
    const ring = this.add.arc(0, 0, charW * 0.62, 0, 360, false, this.statusColor(agent.status), 0.5);
    ring.setDepth(0);

    // Sprite (animated)
    const sprite = this.add.sprite(0, 0, animKey, 0);
    sprite.setDisplaySize(charW, charH);
    sprite.setDepth(1);
    sprite.play(`${animKey}_idle`);
    sprite.setInteractive({ useHandCursor: true });

    // Name tag
    const tagSize = Math.round(Math.max(7, 7 * S));
    const nameTag = this.add.text(0, charH * 0.55, agent.name, {
      fontFamily: '"Courier New", monospace',
      fontSize: `${tagSize}px`,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: Math.round(3 * S),
      backgroundColor: '#00000080',
      padding: { left: Math.round(3 * S), right: Math.round(3 * S), top: 1, bottom: 1 },
    });
    nameTag.setOrigin(0.5, 0);
    nameTag.setDepth(2);

    // Role badge
    const roleTag = this.add.text(0, charH * 0.55 + tagSize + Math.round(3 * S), role.toUpperCase(), {
      fontFamily: '"Courier New", monospace',
      fontSize: `${Math.round(Math.max(5, 5.5 * S))}px`,
      color: this.hexToCSS(this.statusColor(agent.status)),
      stroke: '#000000',
      strokeThickness: Math.round(2 * S),
    });
    roleTag.setOrigin(0.5, 0);
    roleTag.setDepth(2);

    // Status bubble
    const bubbleBg = this.add.rectangle(0, -charH * 0.7, Math.round(30 * S), Math.round(10 * S), 0x000000, 0.7);
    bubbleBg.setDepth(3);
    bubbleBg.setVisible(false);
    const bubble = this.add.text(0, -charH * 0.7, '💭 ...', {
      fontFamily: '"Courier New", monospace',
      fontSize: `${Math.round(Math.max(5, 5 * S))}px`,
      color: '#aaaacc',
    });
    bubble.setOrigin(0.5, 0.5);
    bubble.setDepth(4);
    bubble.setVisible(false);

    const container = this.add.container(homeX, homeY, [shadow, ring, sprite, nameTag, roleTag, bubbleBg, bubble]);
    container.setDepth(10);

    // Hover
    sprite.on('pointerover', () => {
      if (agent.currentTask) {
        const task = agent.currentTask.substring(0, 28) + (agent.currentTask.length > 28 ? '…' : '');
        bubble.setText(`💭 ${task}`);
        bubbleBg.setVisible(true);
        bubble.setVisible(true);
      }
    });
    sprite.on('pointerout', () => {
      bubbleBg.setVisible(false);
      bubble.setVisible(false);
    });

    const visual: AgentVisual = {
      container, sprite, shadow, ring, nameTag, roleTag, bubble, bubbleBg,
      homeX, homeY, roomBounds, isMoving: false,
    };

    this.agentVisuals.set(agent.id, visual);

    // Idle bob
    this.tweens.add({
      targets: container,
      y: homeY - Math.round(2 * S),
      duration: 1200 + Math.random() * 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: Math.random() * 800,
    });

    // Wander loop
    this.scheduleWander(agent.id, role);
  }

  private refreshAgent(agent: Agent): void {
    const visual = this.agentVisuals.get(agent.id);
    if (!visual) return;
    visual.ring.setFillStyle(this.statusColor(agent.status), 0.5);
    visual.roleTag.setColor(this.hexToCSS(this.statusColor(agent.status)));

    // Update status bubble text
    if (agent.status === 'working') {
      const role = this.agentRole(agent);
      visual.sprite.play(`agent_${role}_idle`, true);
    }
  }

  private scheduleWander(agentId: string, role: string): void {
    const visual = this.agentVisuals.get(agentId);
    if (!visual) return;

    visual.wanderTimer = this.time.addEvent({
      delay: Phaser.Math.Between(3500, 7000),
      loop: true,
      callback: () => {
        const v = this.agentVisuals.get(agentId);
        if (!v || v.isMoving) return;

        const S = this._S;
        const wallPx = WALL * T * S;
        const margin = 12 * S;
        const b = v.roomBounds;

        const tx = Phaser.Math.Between(
          b.x + wallPx + margin,
          b.x + b.w - wallPx - margin,
        );
        const ty = Phaser.Math.Between(
          b.y + wallPx + margin,
          b.y + b.h - wallPx - margin,
        );

        this.walkTo(agentId, role, tx, ty);
      },
    });
  }

  private walkTo(agentId: string, role: string, tx: number, ty: number): void {
    const visual = this.agentVisuals.get(agentId);
    if (!visual) return;

    const S = this._S;
    visual.isMoving = true;

    // Flip sprite based on direction
    if (tx < visual.container.x) {
      visual.sprite.setFlipX(true);
    } else {
      visual.sprite.setFlipX(false);
    }

    visual.sprite.play(`agent_${role}_walk`, true);

    const dist = Phaser.Math.Distance.Between(visual.container.x, visual.container.y, tx, ty);
    const dur = Math.max(dist * 10, 600);

    this.tweens.killTweensOf(visual.container);
    this.tweens.add({
      targets: visual.container,
      x: tx,
      y: ty,
      duration: dur,
      ease: 'Linear',
      onComplete: () => {
        visual.isMoving = false;
        visual.sprite.play(`agent_${role}_idle`, true);

        // Resume idle bob
        this.tweens.add({
          targets: visual.container,
          y: ty - Math.round(2 * S),
          duration: 1200,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private agentRole(agent: Agent): typeof AGENT_ROLES[number] {
    const roleMap: Record<string, typeof AGENT_ROLES[number]> = {
      architect: 'architect',
      frontend:  'frontend',
      backend:   'backend',
      qa:        'qa',
      researcher: 'researcher',
      data:      'data',
    };
    return roleMap[agent.role] ?? 'architect';
  }

  private statusColor(status: AgentStatus): number {
    switch (status) {
      case 'working':  return 0xf59e0b;
      case 'thinking': return 0x3b82f6;
      case 'blocked':  return 0xef4444;
      case 'done':     return 0x10b981;
      case 'walking':  return 0xa855f7;
      default:         return 0x6b7280;
    }
  }

  private darken(hex: number, factor: number): number {
    const r = Math.floor(((hex >> 16) & 0xff) * (1 - factor));
    const g = Math.floor(((hex >> 8)  & 0xff) * (1 - factor));
    const b = Math.floor((hex & 0xff)          * (1 - factor));
    return (r << 16) | (g << 8) | b;
  }

  private lighten(hex: number, factor: number): number {
    const r = Math.min(255, Math.floor(((hex >> 16) & 0xff) + (255 - ((hex >> 16) & 0xff)) * factor));
    const g = Math.min(255, Math.floor(((hex >> 8)  & 0xff) + (255 - ((hex >> 8)  & 0xff)) * factor));
    const b = Math.min(255, Math.floor((hex & 0xff)          + (255 - (hex & 0xff))          * factor));
    return (r << 16) | (g << 8) | b;
  }

  private hexToCSS(hex: number): string {
    return `#${hex.toString(16).padStart(6, '0')}`;
  }
}
