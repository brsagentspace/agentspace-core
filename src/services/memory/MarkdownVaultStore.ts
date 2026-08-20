/**
 * @file MarkdownVaultStore.ts
 * @description MemoryStore backed by a folder of markdown notes.
 *
 * The first "real" memory source: the Space's own knowledge base. Each file
 * becomes a node, each `## section` a child node, each `[[wikilink]]` a
 * relation. Node types are inferred from headings / front matter so an
 * "Onaylanmış kurallar" section lands as a Decision and "Dersler" as a
 * Lesson. Parsing is pure (testable in the browser); only the folder scan
 * needs the Tauri backend (`vault_scan`).
 *
 * @module services/memory
 */

import type { MemoryGraphData, MemoryStore } from './MemoryStore';
import { IS_TAURI } from '../platform';
import type {
  GraphNode,
  GraphNodeType,
  GraphRelation,
  GraphRelationType,
} from '../../types/knowledgeGraph';

export interface VaultFile {
  relPath: string;
  content: string;
  modifiedMs: number;
  truncated?: boolean;
}

export interface VaultScan {
  root: string;
  files: VaultFile[];
  capped: boolean;
}

const SUMMARY_CHARS = 240;

/** Heading / path keywords → node type (Turkish + English). */
const TYPE_HINTS: Array<[GraphNodeType, RegExp]> = [
  ['Decision', /\b(kural|karar|onayl|yasak|rule|decision|policy|forbidden|golden rule|altın\s+kural)/i],
  ['Lesson', /\b(ders|hata|tuzak|sınırlama|sinirlama|lesson|pitfall|gotcha|limitation|learned|post-?mortem)/i],
  ['Artifact', /\b(şablon|sablon|template|reçete|recete|recipe|komut|command|skill|çıktı|cikti|output|script|pipeline|asset)/i],
  ['Task', /\b(plan|todo|yapılacak|yapilacak|roadmap|backlog|sonraki|next steps?)/i],
];

const OWNER_REL: Record<string, GraphRelationType> = {
  Decision: 'DECIDED_BY',
  Lesson: 'LEARNED_FROM',
  Task: 'SUPERVISED_BY',
  Artifact: 'PRODUCED_ARTIFACT',
  Project: 'SUPERVISED_BY',
};

const VALID_TYPES: GraphNodeType[] = ['Project', 'Agent', 'Task', 'Decision', 'Lesson', 'Artifact'];

interface FrontMatter {
  type?: GraphNodeType;
  title?: string;
  body: string;
}

/** Minimal `--- key: value ---` front matter reader (no YAML dependency needed). */
function readFrontMatter(content: string): FrontMatter {
  if (!content.startsWith('---')) return { body: content };
  const end = content.indexOf('\n---', 3);
  if (end === -1) return { body: content };
  const block = content.slice(3, end);
  const body = content.slice(end + 4);
  const out: FrontMatter = { body };
  block.split('\n').forEach(line => {
    const m = /^([A-Za-z_][\w-]*):\s*(.+?)\s*$/.exec(line);
    if (!m) return;
    const [, key, raw] = m;
    const value = raw.replace(/^["']|["']$/g, '');
    if (key === 'title') out.title = value;
    if (key === 'type') {
      const match = VALID_TYPES.find(t => t.toLowerCase() === value.toLowerCase());
      if (match && match !== 'Agent') out.type = match;
    }
  });
  return out;
}

export function inferNodeType(text: string, fallback: GraphNodeType): GraphNodeType {
  for (const [type, re] of TYPE_HINTS) {
    if (re.test(text)) return type;
  }
  return fallback;
}

/** First meaningful paragraph, markdown syntax stripped, clipped for the panel. */
function summarize(text: string): string {
  const cleaned = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s*#{1,6}\s.*$/gm, ' ')
    .replace(/^\s*\|.*\|\s*$/gm, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_m, target: string, alias?: string) => alias ?? target)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>]+/g, '')
    .replace(/^\s*[-+*]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > SUMMARY_CHARS ? `${cleaned.slice(0, SUMMARY_CHARS - 1)}…` : cleaned;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function baseName(relPath: string): string {
  const file = relPath.split('/').pop() ?? relPath;
  return file.replace(/\.md$/i, '');
}

/** `[[target]]`, `[[target|alias]]`, `[[target#section]]` → target names. */
function wikilinks(text: string): string[] {
  const out: string[] = [];
  const re = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(m[1].trim());
  return out;
}

interface Section {
  heading: string;
  body: string;
}

/** Splits a note into its intro and `##` sections (deeper headings stay inside). */
function splitSections(body: string): { intro: string; h1: string | null; sections: Section[] } {
  const lines = body.split('\n');
  let h1: string | null = null;
  const sections: Section[] = [];
  const intro: string[] = [];
  let current: Section | null = null;
  let inFence = false;

  for (const line of lines) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    if (!inFence) {
      const h1m = /^#\s+(.+?)\s*#*\s*$/.exec(line);
      if (h1m && h1 === null && current === null) { h1 = h1m[1].trim(); continue; }
      const h2m = /^##\s+(.+?)\s*#*\s*$/.exec(line);
      if (h2m) {
        current = { heading: h2m[1].trim(), body: '' };
        sections.push(current);
        continue;
      }
    }
    if (current) current.body += `${line}\n`;
    else intro.push(line);
  }
  return { intro: intro.join('\n'), h1, sections };
}

export interface VaultParseOptions {
  /** Absolute folder path; used for ids and the legend label */
  root: string;
  /** Display label for the vault cluster (defaults to the last two path segments) */
  label?: string;
  /** ISO time stamped as ingestionTime (defaults to now) */
  ingestedAt?: string;
}

export function vaultAgentId(root: string): string {
  return `vault:${root}`;
}

export function vaultLabel(root: string): string {
  const parts = root.replace(/\/+$/, '').split('/').filter(Boolean);
  return parts.slice(-2).join('/') || root;
}

/**
 * Turns scanned markdown files into a memory graph fragment.
 *
 * Ownership: every vault node is clustered under a pseudo-agent for the
 * vault itself so the folder shows up as its own legend entry/color.
 */
export function parseVaultFiles(files: VaultFile[], opts: VaultParseOptions): MemoryGraphData {
  const root = opts.root.replace(/\/+$/, '');
  const agentId = vaultAgentId(root);
  const label = opts.label ?? vaultLabel(root);
  const ingestionTime = opts.ingestedAt ?? new Date().toISOString();

  const nodes: GraphNode[] = [];
  const relations: GraphRelation[] = [];
  const fileIdByName = new Map<string, string>();
  const pendingLinks: Array<{ from: string; target: string; validTime: string }> = [];
  let chunks = 0;

  nodes.push({
    id: agentId,
    type: 'Agent',
    name: label,
    summary: `${label} markdown vault — ${files.length} not`,
    attributes: { agentId, source: 'vault', path: root, kind: 'vault' },
    timestamps: { validTime: new Date(0).toISOString(), ingestionTime },
  });

  const stamp = (ms: number) => new Date(ms || 0).toISOString();
  const linkRelation = (from: string, to: string, validTime: string, type: GraphRelationType = 'DEPENDS_ON') => {
    relations.push({
      id: `vrel:${from}→${to}:${type}`,
      sourceId: from,
      targetId: to,
      type,
      timestamps: { validTime, ingestionTime },
    });
  };

  for (const file of files) {
    const fm = readFrontMatter(file.content);
    const { intro, h1, sections } = splitSections(fm.body);
    const name = fm.title ?? h1 ?? baseName(file.relPath);
    const fileId = `vault:${root}/${file.relPath}`;
    const validTime = stamp(file.modifiedMs);
    const fileType = fm.type ?? inferNodeType(`${file.relPath} ${name}`, 'Lesson');

    nodes.push({
      id: fileId,
      type: fileType,
      name,
      summary: summarize(intro) || summarize(sections[0]?.body ?? '') || name,
      attributes: {
        agentId, source: 'vault', kind: 'file',
        path: `${root}/${file.relPath}`, relPath: file.relPath,
        sections: sections.length, truncated: Boolean(file.truncated),
      },
      timestamps: { validTime, ingestionTime },
    });
    linkRelation(fileId, agentId, validTime, OWNER_REL[fileType] ?? 'SUPERVISED_BY');
    fileIdByName.set(baseName(file.relPath).toLowerCase(), fileId);
    fileIdByName.set(name.toLowerCase(), fileId);
    chunks += 1;

    wikilinks(intro).forEach(target => pendingLinks.push({ from: fileId, target, validTime }));

    const usedSlugs = new Set<string>();
    sections.forEach(section => {
      let slug = slugify(section.heading) || 'bolum';
      while (usedSlugs.has(slug)) slug = `${slug}-2`;
      usedSlugs.add(slug);
      const sectionId = `${fileId}#${slug}`;
      const sectionType = inferNodeType(section.heading, fileType);
      nodes.push({
        id: sectionId,
        type: sectionType,
        name: section.heading,
        summary: summarize(section.body) || section.heading,
        attributes: {
          agentId, source: 'vault', kind: 'section',
          path: `${root}/${file.relPath}`, relPath: file.relPath, heading: section.heading,
        },
        timestamps: { validTime, ingestionTime },
      });
      linkRelation(sectionId, fileId, validTime);
      chunks += 1;
      wikilinks(section.body).forEach(target => pendingLinks.push({ from: sectionId, target, validTime }));
    });
  }

  const seen = new Set<string>();
  pendingLinks.forEach(({ from, target, validTime }) => {
    const to = fileIdByName.get(target.toLowerCase());
    if (!to || to === from) return;
    const key = `${from}→${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    linkRelation(from, to, validTime);
  });

  return {
    nodes,
    relations,
    indexedFiles: files.length,
    indexedChunks: chunks,
    agents: { [agentId]: label },
  };
}

/**
 * Scans a folder: Tauri backend in the desktop app, the Vite dev middleware
 * (scripts/vite-vault-dev.mjs) in `npm run dev`; throws anywhere else.
 */
export async function scanVault(root: string, maxFiles = 400): Promise<VaultScan> {
  if (IS_TAURI) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<VaultScan>('vault_scan', { root, maxFiles });
  }
  if (import.meta.env.DEV) {
    const res = await fetch(`/__vault?root=${encodeURIComponent(root)}&maxFiles=${maxFiles}`);
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `vault scan ${res.status}`);
    return res.json() as Promise<VaultScan>;
  }
  throw new Error('vault_desktop_only');
}

/** MemoryStore over one markdown folder (desktop only). */
export class MarkdownVaultStore implements MemoryStore {
  constructor(private readonly root: string) {}

  async load(): Promise<MemoryGraphData> {
    const scan = await scanVault(this.root);
    return parseVaultFiles(scan.files, { root: scan.root });
  }
}
