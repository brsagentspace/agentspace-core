/**
 * @file OfficeScene.ts
 * @description Phaser 3 scene — pixel-perfect HQ simulation built on LimeZu
 * "Modern Interiors" + "Modern Office" 16px tilesets.
 *
 * The office is one contiguous building rendered as a real tilemap
 * (floors + walls), furnished with sprite pieces from the office tileset.
 * Agents are LimeZu premade characters with 4-direction walk/idle and
 * sitting poses: working/thinking agents sit at their desk, everyone else
 * wanders, visits the break room, grabs a coffee or naps on the sofa.
 *
 * Assets (NOT redistributable — see public/assets/limezu/.gitignore note):
 *   LimeZu Modern Interiors / Modern Office — limezu.itch.io (paid license)
 *
 * @module components/phaser/scenes
 */

import Phaser from 'phaser';
import type { Agent, AgentStatus } from '../../../types';

// ─── World constants ──────────────────────────────────────────────────────────

const T = 16;                 // tile size in px
const COLS = 64;              // world width in tiles
const ROWS = 36;              // world height in tiles
const WORLD_W = COLS * T;     // 1024
const WORLD_H = ROWS * T;     // 576

// Character sheet geometry (LimeZu premade characters, 16x16 version)
const CHAR_SHEET_COLS = 56;   // 896 / 16
const ROW_IDLE = 1;           // y=32  — 6 frames × (right, up, left, down)
const ROW_WALK = 2;           // y=64
const ROW_SIT_SIDE = 4;       // y=128 — 6 right + 6 left
const ROW_SIT_FRONT = 5;      // y=160 — 6 down + 6 up
const ROW_PHONE = 6;          // y=192 — 12 frames, loop 4-9

export const CHAR_COUNT = 18;
const CHAR_KEYS = Array.from({ length: CHAR_COUNT }, (_, i) => `c${i + 1}`);

type Dir = 'right' | 'up' | 'left' | 'down';
const DIR_OFFSET: Record<Dir, number> = { right: 0, up: 6, left: 12, down: 18 };

// ─── Tileset frame indices (room_builder_office.png, 16 cols) ────────────────

const RBO = {
  dark: 8, // solid dark doorway/wall-cap tile at (8,0)
  wall: {
    lavender: { top: 5 * 16 + 1, bottom: 6 * 16 + 1 },
    gray:     { top: 7 * 16 + 1, bottom: 8 * 16 + 1 },
    brick:    { top: 9 * 16 + 1, bottom: 10 * 16 + 1 },
    plain:    { top: 11 * 16 + 1, bottom: 12 * 16 + 1 },
  },
  // 2×2 repeating floor blocks: [topLeft, topRight, bottomLeft, bottomRight]
  floor: {
    grayTile:     [90, 91, 106, 107],
    plank:        [93, 94, 109, 110],
    darkChecker:  [122, 123, 138, 139],
    brownChecker: [125, 126, 141, 142],
    grayWeave:    [154, 155, 170, 171],
    herringbone:  [157, 158, 173, 174],
    maroon:       [186, 187, 202, 203],
    maroonHerr:   [189, 190, 205, 206],
  },
} as const;

type WallStyle = keyof typeof RBO.wall;
type FloorStyle = keyof typeof RBO.floor;

// ─── Furniture frames (office_furniture.png, px rects) ───────────────────────

const FURN_FRAMES: Record<string, [number, number, number, number]> = {
  desk_pc_1:      [128, 608, 32, 48],
  desk_pc_2:      [160, 608, 32, 48],
  desk_pc_3:      [192, 608, 32, 48],
  desk_plain:     [96, 288, 32, 32],
  desk_amber:     [96, 320, 32, 32],
  plant_big:      [96, 128, 16, 32],
  plant_small:    [96, 192, 16, 32],
  whiteboard:     [144, 160, 48, 32],
  chartboard:     [144, 192, 48, 32],
  bookshelf:      [112, 192, 32, 32],
  sofa_wide:      [0, 272, 48, 48],
  sofa_l:         [48, 272, 48, 48],
  sofa_wide2:     [0, 320, 48, 48],
  rug_round_a:    [48, 240, 16, 32],
  rug_round_b:    [64, 240, 16, 32],
  vending_dark:   [0, 384, 32, 48],
  vending_red:    [32, 384, 32, 48],
  vending_white:  [64, 384, 32, 48],
  cabinet_tall:   [192, 304, 32, 48],
  cabinet_brown:  [224, 304, 32, 48],
  printer_unit:   [224, 608, 32, 48],
  poster_1:       [240, 0, 16, 32],
  poster_2:       [240, 32, 16, 32],
  painting_team:  [0, 192, 32, 32],
  cert_a:         [112, 128, 16, 32],
  copier:         [0, 224, 32, 32],
};

// Decor pieces from the Modern Interiors generic sheet (px rects)
const GEN_FRAMES: Record<string, [number, number, number, number]> = {
  rug_red:         [142, 64, 48, 38],
  rug_blue:        [146, 116, 44, 34],
  rug_purple:      [191, 336, 61, 50],
  palm:            [206, 403, 29, 30],
  window_white:    [40, 142, 38, 24],
  window_glass:    [84, 140, 35, 28],
  painting_green:  [0, 206, 30, 25],
  painting_sunset: [34, 206, 28, 26],
  painting_sea:    [66, 206, 28, 26],
};

// Status → emote animation (UI thinking-emotes sheet, 10 cols of 16×16, 2 frames each)
const EMOTE_FRAMES: Partial<Record<AgentStatus, [number, number]>> = {
  working:  [44, 45],  // pickaxe
  thinking: [92, 93],  // "..."
  idle:     [56, 57],  // Zzz
  done:     [64, 65],  // sparkle
  blocked:  [90, 91],  // red X
};

// ─── Room definitions ─────────────────────────────────────────────────────────

interface RoomDef {
  id: string;
  label: string;
  /** interior bounds in tiles (walkable area, excludes walls) */
  ix: number; iy: number; iw: number; ih: number;
  /** wall face rows are at iy-2 and iy-1 */
  wall: WallStyle;
  floor: FloorStyle;
  deskTexture: string;
  /** center rug for the room, if any */
  rug?: string;
}

/** Desk grid per work room: 3 columns × 2 rows = 6 stations. */
function deskOrigins(room: RoomDef): [number, number][] {
  if (room.id === 'break') return [];
  const cols = [2, 9, 16].filter(c => c + 2 <= room.iw);
  const rows = [1, 7];
  const out: [number, number][] = [];
  rows.forEach(r => cols.forEach(c => out.push([room.ix + c, room.iy + r])));
  return out;
}

// Separator columns: 0, 21, 42, 63. Cap rows: 0, 17, 35.
// Top rooms: wall face rows 1-2, interior rows 3-16.
// Bottom rooms: wall face rows 18-19, interior rows 20-34.
const ROOMS: RoomDef[] = [
  {
    id: 'architect', label: '// ARCHITECT',
    ix: 1, iy: 3, iw: 20, ih: 14, wall: 'gray', floor: 'grayTile',
    deskTexture: 'desk_pc_1', rug: 'rug_red',
  },
  {
    id: 'research', label: '// RESEARCH HQ',
    ix: 22, iy: 3, iw: 20, ih: 14, wall: 'lavender', floor: 'darkChecker',
    deskTexture: 'desk_pc_2', rug: 'rug_blue',
  },
  {
    id: 'data', label: '// DATA LAB',
    ix: 43, iy: 3, iw: 20, ih: 14, wall: 'plain', floor: 'plank',
    deskTexture: 'desk_pc_3', rug: 'rug_blue',
  },
  {
    id: 'experiment', label: '// EXPERIMENT',
    ix: 1, iy: 20, iw: 20, ih: 15, wall: 'brick', floor: 'brownChecker',
    deskTexture: 'desk_pc_2', rug: 'rug_red',
  },
  {
    id: 'break', label: '// BREAK ROOM',
    ix: 22, iy: 20, iw: 20, ih: 15, wall: 'gray', floor: 'herringbone',
    deskTexture: 'desk_pc_1',
  },
  {
    id: 'writing', label: '// WRITING',
    ix: 43, iy: 20, iw: 20, ih: 15, wall: 'lavender', floor: 'maroon',
    deskTexture: 'desk_pc_1', rug: 'rug_red',
  },
];

// Door gaps carved through separators: [col, row] tiles that become floor.
const DOORS: [number, number][] = [
  // vertical separators (3-tile gaps)
  [21, 8], [21, 9], [21, 10],
  [42, 8], [42, 9], [42, 10],
  [21, 26], [21, 27], [21, 28],
  [42, 26], [42, 27], [42, 28],
  // horizontal band (rows 17-19) gaps, 3 tiles wide
  [10, 17], [11, 17], [12, 17], [10, 18], [11, 18], [12, 18], [10, 19], [11, 19], [12, 19],
  [31, 17], [32, 17], [33, 17], [31, 18], [32, 18], [33, 18], [31, 19], [32, 19], [33, 19],
  [52, 17], [53, 17], [54, 17], [52, 18], [53, 18], [54, 18], [52, 19], [53, 19], [54, 19],
];

// Role → preferred room id, and char sheet per role
const ROLE_ROOM: Record<string, string> = {
  architect: 'architect', researcher: 'research', data: 'data',
  qa: 'experiment', frontend: 'writing', backend: 'writing', ml: 'data',
};
const ROLE_CHAR: Record<string, string> = {
  architect: 'c1', frontend: 'c2', backend: 'c3', qa: 'c4',
  researcher: 'c5', data: 'c6', ml: 'c7',
};

// ─── Agent visual state ───────────────────────────────────────────────────────

interface DeskStation {
  roomId: string;
  /** desk piece top-left, tiles */
  tx: number; ty: number;
  /** seat position (char feet), px */
  seatX: number; seatY: number;
  /** tile to stand on when approaching (below the desk) */
  standTX: number; standTY: number;
  occupant: string | null;
}

interface AgentVisual {
  agent: Agent;
  charKey: string;
  sprite: Phaser.GameObjects.Sprite;
  emote: Phaser.GameObjects.Sprite;
  tag: Phaser.GameObjects.Container;
  bubble: Phaser.GameObjects.Container;
  bubbleText: Phaser.GameObjects.Text;
  desk: DeskStation | null;
  mode: 'seated' | 'moving' | 'standing';
  behaviorTimer?: Phaser.Time.TimerEvent;
  moveTween?: Phaser.Tweens.Tween;
}

// ─── Scene ────────────────────────────────────────────────────────────────────

export class OfficeScene extends Phaser.Scene {
  private visuals: Map<string, AgentVisual> = new Map();
  private stations: DeskStation[] = [];
  private walkable: boolean[][] = [];
  private breakSpots: { x: number; y: number; kind: 'sofa' | 'coffee' | 'stand' }[] = [];
  private ready = false;
  private pendingAgents: Agent[] | null = null;

  constructor() {
    super({ key: 'OfficeScene' });
  }

  // ── Preload ───────────────────────────────────────────────────────────────

  preload(): void {
    this.load.spritesheet('rbo', '/assets/limezu/room_builder_office.png', {
      frameWidth: T, frameHeight: T,
    });
    this.load.image('furn', '/assets/limezu/office_furniture.png');
    this.load.image('gen', '/assets/limezu/interiors_generic.png');
    this.load.spritesheet('emotes', '/assets/limezu/ui_emotes.png', {
      frameWidth: 16, frameHeight: 16,
    });
    this.load.spritesheet('coffee', '/assets/limezu/anim_coffee.png', {
      frameWidth: 32, frameHeight: 32,
    });
    this.load.spritesheet('server', '/assets/limezu/anim_server.png', {
      frameWidth: 16, frameHeight: 48,
    });
    CHAR_KEYS.forEach((key, i) => {
      const n = String(i + 1).padStart(2, '0');
      this.load.spritesheet(key, `/assets/limezu/chars/char_${n}.png`, {
        frameWidth: 16, frameHeight: 32,
      });
    });
  }

  // ── Create ────────────────────────────────────────────────────────────────

  create(): void {
    this.cameras.main.setBackgroundColor('#0b0d12');
    this.registerFurnitureFrames();
    this.buildCharAnimations();
    this.buildWalkGrid();
    this.buildTilemap();
    this.placeFurniture();
    this.placeLabels();
    this.applyZoom();
    this.setupCameraControls();
    this.scale.on('resize', () => this.applyZoom(), this);

    this.ready = true;
    if (this.pendingAgents) {
      const agents = this.pendingAgents;
      this.pendingAgents = null;
      this.syncAgents(agents);
    }
    // Defer the ready event one tick so React listeners see a fully-booted scene.
    this.time.delayedCall(0, () => {
      window.dispatchEvent(new CustomEvent('phaser-scene-ready'));
    });
  }

  private applyZoom(): void {
    const cam = this.cameras.main;
    const zx = this.scale.width / WORLD_W;
    const zy = this.scale.height / WORLD_H;
    const fit = Math.min(zx, zy);
    // Half-step zoom keeps pixels crisp on retina; never below 0.5.
    const zoom = Math.max(0.5, Math.floor(fit * 2) / 2);
    cam.setZoom(zoom);
    cam.centerOn(WORLD_W / 2, WORLD_H / 2);
  }

  /** Mouse-wheel zoom (0.5 steps) + drag panning, muratify-style. */
  private setupCameraControls(): void {
    const cam = this.cameras.main;

    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      const next = Phaser.Math.Clamp(cam.zoom + (dy > 0 ? -0.5 : 0.5), 0.5, 3);
      cam.setZoom(next);
    });

    let dragging = false;
    let last = { x: 0, y: 0 };
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      dragging = true;
      last = { x: p.x, y: p.y };
    });
    this.input.on('pointerup', () => { dragging = false; });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!dragging || !p.isDown) return;
      const dw = this.scale.width / cam.zoom;
      const dh = this.scale.height / cam.zoom;
      cam.scrollX = Phaser.Math.Clamp(
        cam.scrollX - (p.x - last.x) / cam.zoom, -dw / 2, WORLD_W - dw / 2,
      );
      cam.scrollY = Phaser.Math.Clamp(
        cam.scrollY - (p.y - last.y) / cam.zoom, -dh / 2, WORLD_H - dh / 2,
      );
      last = { x: p.x, y: p.y };
    });
  }

  // ── Texture / animation setup ─────────────────────────────────────────────

  private registerFurnitureFrames(): void {
    const furn = this.textures.get('furn');
    Object.entries(FURN_FRAMES).forEach(([name, [x, y, w, h]]) => {
      if (!furn.has(name)) furn.add(name, 0, x, y, w, h);
    });
    const gen = this.textures.get('gen');
    Object.entries(GEN_FRAMES).forEach(([name, [x, y, w, h]]) => {
      if (!gen.has(name)) gen.add(name, 0, x, y, w, h);
    });
  }

  private buildCharAnimations(): void {
    const dirs: Dir[] = ['right', 'up', 'left', 'down'];
    CHAR_KEYS.forEach(key => {
      dirs.forEach(dir => {
        const o = DIR_OFFSET[dir];
        this.ensureAnim(`${key}_idle_${dir}`, key, ROW_IDLE * CHAR_SHEET_COLS + o, 6, 4, -1);
        this.ensureAnim(`${key}_walk_${dir}`, key, ROW_WALK * CHAR_SHEET_COLS + o, 6, 10, -1);
      });
      this.ensureAnim(`${key}_sit_down`, key, ROW_SIT_FRONT * CHAR_SHEET_COLS + 0, 6, 3, -1);
      this.ensureAnim(`${key}_sit_up`, key, ROW_SIT_FRONT * CHAR_SHEET_COLS + 6, 6, 3, -1);
      this.ensureAnim(`${key}_sit_right`, key, ROW_SIT_SIDE * CHAR_SHEET_COLS + 0, 6, 3, -1);
      this.ensureAnim(`${key}_sit_left`, key, ROW_SIT_SIDE * CHAR_SHEET_COLS + 6, 6, 3, -1);
      this.ensureAnim(`${key}_phone`, key, ROW_PHONE * CHAR_SHEET_COLS + 4, 6, 4, -1);
    });
    Object.entries(EMOTE_FRAMES).forEach(([status, frames]) => {
      const key = `emote_${status}`;
      if (!this.anims.exists(key) && frames) {
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers('emotes', { frames }),
          frameRate: 2, repeat: -1,
        });
      }
    });
    if (!this.anims.exists('coffee_brew')) {
      this.anims.create({
        key: 'coffee_brew',
        frames: this.anims.generateFrameNumbers('coffee', { start: 0, end: 2 }),
        frameRate: 3, repeat: -1,
      });
    }
    if (!this.anims.exists('server_blink')) {
      this.anims.create({
        key: 'server_blink',
        frames: this.anims.generateFrameNumbers('server', { start: 0, end: 2 }),
        frameRate: 2, repeat: -1,
      });
    }
  }

  private ensureAnim(key: string, tex: string, start: number, count: number, rate: number, repeat: number): void {
    if (this.anims.exists(key)) return;
    this.anims.create({
      key,
      frames: this.anims.generateFrameNumbers(tex, { start, end: start + count - 1 }),
      frameRate: rate,
      repeat,
    });
  }

  // ── Map building ──────────────────────────────────────────────────────────

  private isDoor(c: number, r: number): boolean {
    return DOORS.some(([dc, dr]) => dc === c && dr === r);
  }

  private roomAt(c: number, r: number): RoomDef | null {
    return ROOMS.find(rm =>
      c >= rm.ix && c < rm.ix + rm.iw && r >= rm.iy - 2 && r < rm.iy + rm.ih
    ) ?? null;
  }

  /** Room whose interior contains the tile (used for door floor styling). */
  private nearestFloor(c: number, r: number): FloorStyle {
    let best: RoomDef | null = null;
    let bestDist = Infinity;
    ROOMS.forEach(rm => {
      const cx = rm.ix + rm.iw / 2;
      const cy = rm.iy + rm.ih / 2;
      const d = Math.abs(c - cx) + Math.abs(r - cy);
      if (d < bestDist) { bestDist = d; best = rm; }
    });
    return (best as RoomDef | null)?.floor ?? 'grayTile';
  }

  private buildTilemap(): void {
    const map = this.make.tilemap({ width: COLS, height: ROWS, tileWidth: T, tileHeight: T });
    const tiles = map.addTilesetImage('rbo', 'rbo', T, T, 0, 0)!;
    const floorLayer = map.createBlankLayer('floor', tiles)!;
    const wallLayer = map.createBlankLayer('wall', tiles)!;
    floorLayer.setDepth(0);
    wallLayer.setDepth(1);

    const putFloor = (c: number, r: number, style: FloorStyle) => {
      const f = RBO.floor[style];
      const idx = (r % 2 === 0 ? 0 : 2) + (c % 2 === 0 ? 0 : 1);
      floorLayer.putTileAt(f[idx], c, r);
    };

    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        if (this.isDoor(c, r)) {
          putFloor(c, r, this.nearestFloor(c, r));
          continue;
        }
        const sepCol = c === 0 || c === 21 || c === 42 || c === 63;
        const capRow = r === 0 || r === 17 || r === 35;
        if (sepCol || capRow) {
          wallLayer.putTileAt(RBO.dark, c, r);
          continue;
        }
        const room = this.roomAt(c, r);
        if (!room) { wallLayer.putTileAt(RBO.dark, c, r); continue; }
        if (r === room.iy - 2) {
          wallLayer.putTileAt(RBO.wall[room.wall].top, c, r);
        } else if (r === room.iy - 1) {
          wallLayer.putTileAt(RBO.wall[room.wall].bottom, c, r);
        } else {
          putFloor(c, r, room.floor);
        }
      }
    }
  }

  private buildWalkGrid(): void {
    this.walkable = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        if (this.isDoor(c, r)) { this.walkable[r][c] = true; continue; }
        const room = this.roomAt(c, r);
        if (!room) continue;
        const sepCol = c === 0 || c === 21 || c === 42 || c === 63;
        const capRow = r === 0 || r === 17 || r === 35;
        if (!sepCol && !capRow && r >= room.iy) this.walkable[r][c] = true;
      }
    }
  }

  private block(c: number, r: number, w = 1, h = 1): void {
    for (let x = c; x < c + w; x++) {
      for (let y = r; y < r + h; y++) {
        if (y >= 0 && y < ROWS && x >= 0 && x < COLS) this.walkable[y][x] = false;
      }
    }
  }

  // ── Furniture ─────────────────────────────────────────────────────────────

  /** Places a furniture/decor image whose top-left is at tile (c,r); depth-sorted by its base. */
  private furn(
    name: string, c: number, r: number,
    opts?: { blockW?: number; blockH?: number; onWall?: boolean; flat?: boolean; tex?: 'furn' | 'gen' },
  ): Phaser.GameObjects.Image {
    const tex = opts?.tex ?? (GEN_FRAMES[name] ? 'gen' : 'furn');
    const img = this.add.image(c * T, r * T, tex, name);
    img.setOrigin(0, 0);
    if (opts?.onWall) {
      img.setDepth(2); // decor pinned on the wall face
    } else if (opts?.flat) {
      img.setDepth(1); // rugs: above the floor, below everything else, walkable
    } else {
      img.setDepth(r * T + img.height); // y-sort by bottom edge
      const [, , w, h] = (tex === 'gen' ? GEN_FRAMES : FURN_FRAMES)[name];
      const bw = opts?.blockW ?? Math.ceil(w / T);
      const bh = opts?.blockH ?? Math.ceil(h / T);
      this.block(c, r, bw, bh);
    }
    return img;
  }

  private placeFurniture(): void {
    // ── Desk stations (3×2 grid per work room) ───────────────────────────
    ROOMS.forEach(room => {
      deskOrigins(room).forEach(([tx, ty]) => {
        this.furn(room.deskTexture, tx, ty);
        const seatX = tx * T + T;           // center of the 2-wide desk
        const seatY = ty * T + 12;          // torso rises above the desk, lap hidden
        this.stations.push({
          roomId: room.id, tx, ty, seatX, seatY,
          standTX: tx + 1, standTY: ty + 3,
          occupant: null,
        });
      });

      if (room.id === 'break') return;

      // wall decor: whiteboard center, windows/posters between the desks
      const wallRow = room.iy - 2;
      const isTopRoom = room.iy === 3;
      this.furn('whiteboard', room.ix + Math.floor(room.iw / 2) - 1, wallRow, { onWall: true });
      this.furn('poster_1', room.ix + 1, wallRow, { onWall: true });
      this.furn('cert_a', room.ix + room.iw - 2, wallRow, { onWall: true });
      if (isTopRoom) {
        this.furn('window_glass', room.ix + 5, wallRow, { onWall: true });
        this.furn('window_white', room.ix + 13, wallRow, { onWall: true });
      } else {
        this.furn('painting_green', room.ix + 5, wallRow, { onWall: true });
        this.furn('painting_sea', room.ix + 13, wallRow, { onWall: true });
      }

      // center rug + corner props
      if (room.rug) this.furn(room.rug, room.ix + 6, room.iy + 4, { flat: true });
      this.furn('plant_big', room.ix, room.iy - 1);
      this.furn('plant_big', room.ix + room.iw - 1, room.iy - 1);
      this.furn('cabinet_tall', room.ix + room.iw - 2, room.iy + room.ih - 3);
      this.furn('printer_unit', room.ix, room.iy + room.ih - 3);
    });

    // room-specific extras
    this.furn('chartboard', 26, 1, { onWall: true });          // research wall
    this.furn('painting_team', 47, 18, { onWall: true });      // writing wall

    // DATA LAB server racks (animated)
    [58, 60].forEach((c, i) => {
      const s = this.add.sprite(c * T, 2 * T, 'server', 0);
      s.setOrigin(0, 0);
      s.setDepth(2 * T + 48);
      s.anims.play({ key: 'server_blink', delay: i * 400 });
      this.block(c, 3, 1, 2);
    });

    // ── Break room ───────────────────────────────────────────────────────
    this.furn('rug_purple', 30, 25, { flat: true });
    this.furn('sofa_wide', 24, 21);
    this.furn('sofa_l', 30, 21);
    this.furn('sofa_wide2', 24, 29);
    this.furn('vending_dark', 37, 19);
    this.furn('vending_red', 39, 19);
    this.furn('vending_white', 37, 24);
    this.furn('bookshelf', 22, 19);
    this.furn('plant_big', 41, 20);
    this.furn('palm', 35, 30);
    this.furn('plant_small', 22, 32);
    this.furn('cabinet_brown', 40, 31);

    // coffee corner: counter + animated coffee machine on top
    this.furn('desk_plain', 29, 32);
    const coffee = this.add.sprite(29 * T, 31 * T - 4, 'coffee', 0);
    coffee.setOrigin(0, 0);
    coffee.setDepth(32 * T + 32 + 1);
    coffee.anims.play('coffee_brew');

    // break-room POIs: sofa spots are exact seat pixels (agent snaps onto them)
    this.breakSpots = [
      { x: 25 * T + 8, y: 23 * T + 2, kind: 'sofa' },   // sofa_wide seat
      { x: 31 * T + 8, y: 23 * T + 2, kind: 'sofa' },   // sofa_l seat
      { x: 25 * T + 8, y: 31 * T + 2, kind: 'sofa' },   // sofa_wide2 seat
      { x: 31 * T + 8, y: 33 * T + 6, kind: 'coffee' }, // beside the coffee counter
      { x: 38 * T + 8, y: 22 * T + 8, kind: 'stand' },  // by the vending machines
      { x: 30 * T + 8, y: 26 * T + 8, kind: 'stand' },  // on the rug
    ];
  }

  private placeLabels(): void {
    ROOMS.forEach(room => {
      const txt = this.add.text(room.ix * T + 3, (room.iy - 2) * T + 3, room.label, {
        fontFamily: '"Courier New", monospace',
        fontSize: '8px',
        fontStyle: 'bold',
        color: '#e8e8f0',
        backgroundColor: '#14161ecc',
        padding: { left: 2, right: 2, top: 1, bottom: 1 },
      });
      txt.setResolution(4);
      txt.setDepth(3);
      txt.setAlpha(0.9);
    });
  }

  // ── Pathfinding (BFS over the walk grid) ──────────────────────────────────

  private findPath(fromTX: number, fromTY: number, toTX: number, toTY: number): [number, number][] | null {
    if (fromTX === toTX && fromTY === toTY) return [];
    const key = (c: number, r: number) => r * COLS + c;
    const prev = new Map<number, number>();
    const queue: [number, number][] = [[fromTX, fromTY]];
    const seen = new Set<number>([key(fromTX, fromTY)]);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    while (queue.length) {
      const [c, r] = queue.shift()!;
      if (c === toTX && r === toTY) {
        const path: [number, number][] = [];
        let k = key(c, r);
        while (k !== key(fromTX, fromTY)) {
          path.unshift([k % COLS, Math.floor(k / COLS)]);
          k = prev.get(k)!;
        }
        return path;
      }
      for (const [dc, dr] of dirs) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
        if (!this.walkable[nr][nc]) continue;
        const nk = key(nc, nr);
        if (seen.has(nk)) continue;
        seen.add(nk);
        prev.set(nk, key(c, r));
        queue.push([nc, nr]);
      }
    }
    return null;
  }

  /** Nearest walkable tile to a pixel position (spiral search). */
  private nearestWalkable(px: number, py: number): [number, number] {
    const tc = Phaser.Math.Clamp(Math.floor(px / T), 0, COLS - 1);
    const tr = Phaser.Math.Clamp(Math.floor(py / T), 0, ROWS - 1);
    if (this.walkable[tr]?.[tc]) return [tc, tr];
    for (let rad = 1; rad < 8; rad++) {
      for (let dc = -rad; dc <= rad; dc++) {
        for (let dr = -rad; dr <= rad; dr++) {
          const c = tc + dc, r = tr + dr;
          if (c >= 0 && c < COLS && r >= 0 && r < ROWS && this.walkable[r][c]) return [c, r];
        }
      }
    }
    return [tc, tr];
  }

  private randomWalkableIn(room: RoomDef): [number, number] {
    for (let i = 0; i < 40; i++) {
      const c = Phaser.Math.Between(room.ix, room.ix + room.iw - 1);
      const r = Phaser.Math.Between(room.iy, room.iy + room.ih - 1);
      if (this.walkable[r]?.[c]) return [c, r];
    }
    return this.nearestWalkable((room.ix + room.iw / 2) * T, (room.iy + room.ih / 2) * T);
  }

  // ── Agent sync ────────────────────────────────────────────────────────────

  public syncAgents(agents: Agent[]): void {
    if (!this.ready) {
      this.pendingAgents = agents;
      return;
    }
    const ids = new Set(agents.map(a => a.id));

    for (const [id, v] of this.visuals.entries()) {
      if (!ids.has(id)) this.destroyVisual(id, v);
    }

    agents.forEach(agent => {
      const existing = this.visuals.get(agent.id);
      if (!existing) {
        this.spawnAgent(agent);
      } else {
        const prevStatus = existing.agent.status;
        existing.agent = agent;
        this.refreshTag(existing);
        if (prevStatus !== agent.status) this.applyBehavior(existing);
      }
    });
  }

  private destroyVisual(id: string, v: AgentVisual): void {
    v.behaviorTimer?.destroy();
    v.moveTween?.stop();
    if (v.desk) v.desk.occupant = null;
    v.sprite.destroy();
    v.emote.destroy();
    v.tag.destroy();
    v.bubble.destroy();
    this.visuals.delete(id);
  }

  /** Shows the status emote bubble above the agent's head. */
  private applyEmote(v: AgentVisual): void {
    const frames = EMOTE_FRAMES[v.agent.status];
    if (!frames) {
      v.emote.setVisible(false);
      return;
    }
    v.emote.setVisible(true);
    v.emote.play(`emote_${v.agent.status}`, true);
  }

  private claimDesk(agent: Agent): DeskStation | null {
    const preferred = ROLE_ROOM[agent.role];
    const free = (s: DeskStation) => s.occupant === null || s.occupant === agent.id;
    const station =
      this.stations.find(s => s.roomId === preferred && free(s)) ??
      this.stations.find(free) ?? null;
    if (station) station.occupant = agent.id;
    return station;
  }

  private spawnAgent(agent: Agent): void {
    const charKey = agent.charKey && this.textures.exists(agent.charKey)
      ? agent.charKey
      : (ROLE_CHAR[agent.role] ?? 'c8');
    const desk = this.claimDesk(agent);
    const seated = agent.status === 'working' || agent.status === 'thinking';

    const startX = desk ? desk.seatX : WORLD_W / 2;
    const startY = desk ? desk.seatY : WORLD_H / 2;

    const sprite = this.add.sprite(startX, startY, charKey, ROW_IDLE * CHAR_SHEET_COLS + 18);
    sprite.setOrigin(0.5, 1); // feet anchor
    sprite.setInteractive({ useHandCursor: true });

    const tag = this.buildTag(agent);
    const bubble = this.buildBubble();
    const bubbleText = bubble.getAt(1) as Phaser.GameObjects.Text;

    const emote = this.add.sprite(startX, startY - 36, 'emotes', 56);
    emote.setOrigin(0.5, 1);
    emote.setDepth(WORLD_H + 15);

    const visual: AgentVisual = {
      agent, charKey, sprite, emote, tag, bubble, bubbleText,
      desk, mode: 'standing',
    };
    this.visuals.set(agent.id, visual);
    this.applyEmote(visual);

    sprite.on('pointerover', () => {
      const v = this.visuals.get(agent.id);
      if (v?.agent.currentTask) {
        const task = v.agent.currentTask.length > 34
          ? `${v.agent.currentTask.substring(0, 34)}…` : v.agent.currentTask;
        v.bubbleText.setText(task);
        const bg = v.bubble.getAt(0) as Phaser.GameObjects.Rectangle;
        bg.setSize(v.bubbleText.width + 8, v.bubbleText.height + 4);
        v.bubble.setVisible(true);
      }
    });
    sprite.on('pointerout', () => this.visuals.get(agent.id)?.bubble.setVisible(false));

    if (seated && desk) {
      this.sitAtDesk(visual);
    } else {
      const [c, r] = desk
        ? [desk.standTX, desk.standTY]
        : this.randomWalkableIn(ROOMS[4]);
      this.placeStanding(visual, c * T + T / 2, r * T + T - 2);
      this.scheduleWander(visual, 500);
    }
    this.updateAttachments(visual);
  }

  private buildTag(agent: Agent): Phaser.GameObjects.Container {
    const txt = this.add.text(0, 0, agent.name, {
      fontFamily: '"Courier New", monospace',
      fontSize: '7px',
      fontStyle: 'bold',
      color: '#ffffff',
    });
    txt.setResolution(4);
    txt.setOrigin(0.5, 0.5);
    const bg = this.add.rectangle(0, 0, txt.width + 8, txt.height + 3, 0x14161e, 0.85);
    bg.setStrokeStyle(0.5, this.statusColor(agent.status), 1);
    const dot = this.add.rectangle(-txt.width / 2 - 1.5, 0, 2, 2, this.statusColor(agent.status));
    const c = this.add.container(0, 0, [bg, txt, dot]);
    c.setDepth(WORLD_H + 10);
    return c;
  }

  private refreshTag(v: AgentVisual): void {
    const bg = v.tag.getAt(0) as Phaser.GameObjects.Rectangle;
    const dot = v.tag.getAt(2) as Phaser.GameObjects.Rectangle;
    bg.setStrokeStyle(0.5, this.statusColor(v.agent.status), 1);
    dot.setFillStyle(this.statusColor(v.agent.status));
    this.applyEmote(v);
  }

  private buildBubble(): Phaser.GameObjects.Container {
    const txt = this.add.text(0, 0, '', {
      fontFamily: '"Courier New", monospace',
      fontSize: '7px',
      color: '#c8c8e0',
    });
    txt.setResolution(4);
    txt.setOrigin(0.5, 0.5);
    const bg = this.add.rectangle(0, 0, 10, 10, 0x14161e, 0.92);
    bg.setStrokeStyle(0.5, 0x3a3f55, 1);
    const c = this.add.container(0, 0, [bg, txt]);
    c.setDepth(WORLD_H + 20);
    c.setVisible(false);
    return c;
  }

  /** Keeps the name tag, emote and bubble glued to the sprite; y-sorts the sprite. */
  private updateAttachments(v: AgentVisual): void {
    v.sprite.setDepth(v.sprite.y);
    v.tag.setPosition(Math.round(v.sprite.x), Math.round(v.sprite.y + 4));
    v.emote.setPosition(Math.round(v.sprite.x), Math.round(v.sprite.y - 36));
    v.bubble.setPosition(Math.round(v.sprite.x), Math.round(v.sprite.y - 52));
  }

  // ── Behaviors ─────────────────────────────────────────────────────────────

  private applyBehavior(v: AgentVisual): void {
    const seated = v.agent.status === 'working' || v.agent.status === 'thinking';
    if (seated) {
      v.behaviorTimer?.destroy();
      if (v.mode !== 'seated') this.walkThenSit(v);
    } else {
      if (v.mode === 'seated') this.standUp(v);
      this.scheduleWander(v, Phaser.Math.Between(800, 2500));
    }
  }

  private sitAtDesk(v: AgentVisual): void {
    if (!v.desk) return;
    v.moveTween?.stop();
    v.mode = 'seated';
    v.sprite.setPosition(v.desk.seatX, v.desk.seatY);
    const anim = v.agent.status === 'thinking' ? `${v.charKey}_phone` : `${v.charKey}_sit_down`;
    v.sprite.play(anim, true);
    this.updateAttachments(v);
  }

  private standUp(v: AgentVisual): void {
    if (!v.desk) return;
    v.mode = 'standing';
    v.sprite.setPosition(v.desk.standTX * T + T / 2, v.desk.standTY * T + T - 2);
    v.sprite.play(`${v.charKey}_idle_down`, true);
    this.updateAttachments(v);
  }

  private placeStanding(v: AgentVisual, px: number, py: number): void {
    v.mode = 'standing';
    v.sprite.setPosition(px, py);
    v.sprite.play(`${v.charKey}_idle_down`, true);
    this.updateAttachments(v);
  }

  private walkThenSit(v: AgentVisual): void {
    if (!v.desk) return;
    this.walkTo(v, v.desk.standTX, v.desk.standTY, () => this.sitAtDesk(v));
  }

  private scheduleWander(v: AgentVisual, firstDelay: number): void {
    v.behaviorTimer?.destroy();
    v.behaviorTimer = this.time.addEvent({
      delay: firstDelay,
      callback: () => {
        if (v.mode === 'moving') { this.scheduleWander(v, 2000); return; }
        const roll = Math.random();
        if (roll < 0.45 && this.breakSpots.length) {
          // visit the break room: coffee, sofa, vending machines
          const spot = Phaser.Math.RND.pick(this.breakSpots);
          const [c, r] = this.nearestWalkable(spot.x, spot.y);
          this.walkTo(v, c, r, () => {
            if (spot.kind === 'sofa') {
              // snap onto the seat; the sofa front covers the legs
              v.sprite.setPosition(spot.x, spot.y);
              v.sprite.play(`${v.charKey}_sit_down`, true);
              this.updateAttachments(v);
            } else if (spot.kind === 'coffee') {
              v.sprite.play(`${v.charKey}_idle_left`, true);
            } else {
              v.sprite.play(`${v.charKey}_idle_up`, true);
            }
            this.scheduleWander(v, Phaser.Math.Between(4000, 9000));
          });
        } else {
          const room = Phaser.Math.RND.pick(ROOMS);
          const [c, r] = this.randomWalkableIn(room);
          this.walkTo(v, c, r, () => {
            v.sprite.play(`${v.charKey}_idle_down`, true);
            this.scheduleWander(v, Phaser.Math.Between(3000, 7000));
          });
        }
      },
    });
  }

  private walkTo(v: AgentVisual, toTX: number, toTY: number, onArrive: () => void): void {
    const [fromTX, fromTY] = this.nearestWalkable(v.sprite.x, v.sprite.y - 2);
    const path = this.findPath(fromTX, fromTY, toTX, toTY);
    if (!path || path.length === 0) { onArrive(); return; }

    v.mode = 'moving';
    v.moveTween?.stop();

    const points = path.map(([c, r]) => ({ x: c * T + T / 2, y: r * T + T - 2 }));
    let i = 0;
    const step = () => {
      if (!this.visuals.has(v.agent.id)) return;
      if (i >= points.length) {
        v.mode = 'standing';
        onArrive();
        return;
      }
      const p = points[i++];
      const dx = p.x - v.sprite.x;
      const dy = p.y - v.sprite.y;
      const dir: Dir = Math.abs(dx) > Math.abs(dy)
        ? (dx > 0 ? 'right' : 'left')
        : (dy > 0 ? 'down' : 'up');
      v.sprite.play(`${v.charKey}_walk_${dir}`, true);
      v.moveTween = this.tweens.add({
        targets: v.sprite,
        x: p.x, y: p.y,
        duration: 150,
        ease: 'Linear',
        onUpdate: () => this.updateAttachments(v),
        onComplete: step,
      });
    };
    step();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

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
}
