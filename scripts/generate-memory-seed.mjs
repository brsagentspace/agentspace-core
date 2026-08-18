/**
 * generate-memory-seed.mjs
 * Deterministic demo memory-graph generator for the Agent Memory Map.
 *
 * Produces public/demo/memory-graph.json matching the MemoryGraphData shape:
 * ~1000 memory nodes clustered per agent + ~2400 typed relations,
 * bi-temporal timestamps over the last 90 days.
 *
 * Usage: node scripts/generate-memory-seed.mjs [nodeCount]
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'demo', 'memory-graph.json');

const NODE_COUNT = Number(process.argv[2] ?? 1000);

// ── Deterministic RNG (mulberry32) ──────────────────────────────────────────
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260818);
const pick = arr => arr[Math.floor(rnd() * arr.length)];
const between = (a, b) => a + rnd() * (b - a);

// ── Agents (ids match src/store INITIAL_AGENTS) ─────────────────────────────
const AGENTS = {
  agent_1: 'Architect-01',
  agent_2: 'Frontend-Dev',
  agent_3: 'Backend-Core',
  agent_4: 'QA-Sentinel',
  agent_5: 'Researcher-X',
  agent_6: 'Data-Analyst',
};
const AGENT_IDS = Object.keys(AGENTS);

// ── Title material ──────────────────────────────────────────────────────────
const TOPICS = [
  'JWT auth', 'session cache', 'Postgres şeması', 'Redis kuyruğu', 'CI pipeline',
  'Tauri IPC', 'Phaser sahnesi', 'BM25 indeksi', 'RAG cascade', 'token bütçesi',
  'webhook imzası', 'rate limiter', 'Zustand store', 'i18n yapısı', 'tilemap katmanı',
  'A* pathfinding', 'WebGL render', 'sprite atlası', 'Graphiti şeması', 'FalkorDB bağlantısı',
  'Docker imajı', 'nginx yönlendirme', 'SSL yenileme', 'e2e test seti', 'mock server',
  'LangGraph düğümü', 'prompt şablonu', 'embedding modeli', 'reranker seçimi', 'log formatı',
  'hata sınırı', 'retry politikası', 'feature flag', 'dark mode paleti', 'erişilebilirlik taraması',
  'bellek sızıntısı', 'FPS düşüşü', 'bundle boyutu', 'lazy loading', 'API sürümleme',
];
const DECISION_VERBS = ['seçildi', 'reddedildi', 'ertelendi', 'onaylandı', 'değiştirildi'];
const LESSON_HEADS = ['Ders:', 'Not:', 'Bulgu:', 'Uyarı:'];
const LESSON_TAILS = [
  "HMR eski instance'ı öldürmüyor", 'visibility hidden döngüyü uyutuyor',
  'kesirli zoom pikselleri bozuyor', 'batch insert 40x daha hızlı',
  "timeout 30sn'de agresif kalıyor", "cache hit oranı %60'ta plato yapıyor",
  "race condition yalnızca prod'da tetikleniyor", 'off-by-one sınır durumda patlıyor',
];
const TASK_VERBS = ['implementasyonu', 'refaktörü', 'testi', 'dokümantasyonu', 'optimizasyonu', 'entegrasyonu'];
const ARTIFACT_KINDS = ['PR', 'rapor', 'şema diyagramı', 'benchmark çıktısı', 'runbook', 'ADR dokümanı'];

const TYPE_POOL = [
  ...Array(30).fill('Lesson'),
  ...Array(25).fill('Decision'),
  ...Array(28).fill('Task'),
  ...Array(17).fill('Artifact'),
];

function title(type) {
  const topic = pick(TOPICS);
  switch (type) {
    case 'Decision': return `${topic} ${pick(DECISION_VERBS)}`;
    case 'Lesson':   return `${pick(LESSON_HEADS)} ${topic} — ${pick(LESSON_TAILS)}`;
    case 'Task':     return `${topic} ${pick(TASK_VERBS)}`;
    default:         return `${topic} ${pick(ARTIFACT_KINDS)}`;
  }
}

function summary(type, name) {
  const why = pick([
    'ölçüm sonuçları alternatiflerden iyi çıktı', 'takım geri bildirimiyle netleşti',
    'prod incident sonrası zorunlu oldu', 'maliyet analizi bu yönü gösterdi',
    'önceki sprintte edinilen derse dayanıyor', 'muratify kıyaslaması referans alındı',
  ]);
  return `${name}. Gerekçe/bağlam: ${why}.`;
}

// ── Timestamps: last 90 days, bi-temporal ───────────────────────────────────
const NOW = Date.UTC(2026, 7, 18, 12, 0, 0); // fixed for determinism
function stamps() {
  const valid = NOW - Math.floor(between(0, 90 * 24)) * 3600_000;
  const ingest = valid + Math.floor(between(0, 48)) * 3600_000;
  return {
    validTime: new Date(valid).toISOString(),
    ingestionTime: new Date(Math.min(ingest, NOW)).toISOString(),
  };
}

// ── Build nodes ─────────────────────────────────────────────────────────────
const nodes = [];
const relations = [];
let relSeq = 0;

function relate(sourceId, targetId, type, weight = 1) {
  relations.push({
    id: `rel_${relSeq++}`,
    sourceId, targetId, type, weight,
    timestamps: stamps(),
  });
}

// Agent anchor nodes
for (const [id, name] of Object.entries(AGENTS)) {
  nodes.push({
    id, type: 'Agent', name, summary: `${name} ajanının hafıza kümesi`,
    attributes: { agentId: id },
    timestamps: stamps(),
  });
}

// Memory nodes, clustered per agent (uneven cluster sizes look natural)
const clusterWeights = AGENT_IDS.map(() => 0.5 + rnd());
const totalW = clusterWeights.reduce((a, b) => a + b, 0);
const perAgent = clusterWeights.map(w => Math.round((w / totalW) * NODE_COUNT));

const OWNER_REL = { Decision: 'DECIDED_BY', Lesson: 'LEARNED_FROM', Task: 'SUPERVISED_BY', Artifact: 'PRODUCED_ARTIFACT' };
const byAgent = new Map(AGENT_IDS.map(id => [id, []]));

let seq = 0;
AGENT_IDS.forEach((agentId, ai) => {
  for (let i = 0; i < perAgent[ai]; i++) {
    const type = pick(TYPE_POOL);
    const name = title(type);
    const node = {
      id: `mem_${seq++}`,
      type, name,
      summary: summary(type, name),
      attributes: { agentId },
      timestamps: stamps(),
    };
    nodes.push(node);
    byAgent.get(agentId).push(node.id);
    relate(node.id, agentId, OWNER_REL[type] ?? 'SUPERVISED_BY');
  }
});

// Cross links: 80% intra-cluster, 20% inter-cluster (~1.4 per node)
const memIds = nodes.filter(n => n.type !== 'Agent').map(n => n.id);
const crossCount = Math.round(memIds.length * 1.4);
for (let i = 0; i < crossCount; i++) {
  const a = pick(memIds);
  const agentId = nodes.find(n => n.id === a).attributes.agentId;
  const sameCluster = rnd() < 0.8;
  const poolIds = sameCluster ? byAgent.get(agentId) : memIds;
  const b = pick(poolIds);
  if (a === b) continue;
  relate(a, b, pick(['DEPENDS_ON', 'APPLIES_RULE', 'LEARNED_FROM']), Number(between(0.3, 1).toFixed(2)));
}

const data = {
  nodes,
  relations,
  indexedFiles: Math.round(memIds.length * 1.25),
  indexedChunks: Math.round(memIds.length * 7.9),
  agents: AGENTS,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(data));
console.log(`seed yazıldı: ${OUT}`);
console.log(`düğüm: ${nodes.length} (hafıza: ${memIds.length}), bağ: ${relations.length}`);
