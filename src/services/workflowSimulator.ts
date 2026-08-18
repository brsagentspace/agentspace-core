/**
 * @file workflowSimulator.ts
 * @description Simulated work cycle behind the Start Workflow button.
 *
 * Each agent runs thinking → working → done with staggered timing; the
 * office scene reacts through the normal status pipeline (sit, emotes)
 * and every completed cycle ingests a memory into the project journal.
 * Real orchestration will replace the timers; the state flow stays.
 *
 * @module services
 */

import { create } from 'zustand';
import { useAgentSpaceStore } from '../store';
import { useProjectStore } from '../store/projectStore';
import { recordProjectMemory } from './memory/projectMemory';
import type { Agent } from '../types';
import type { GraphNodeType } from '../types/knowledgeGraph';

interface WorkflowState {
  running: boolean;
  setRunning: (running: boolean) => void;
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  running: false,
  setRunning: (running) => set({ running }),
}));

const TASKS: Record<string, string[]> = {
  architect: ['servis sınırlarını netleştirme', 'şema migrasyon planı', 'ADR taslağı'],
  frontend: ['dashboard bileşeni refaktörü', 'erişilebilirlik taraması', 'bundle küçültme'],
  backend: ['rate limiter implementasyonu', 'webhook imza doğrulaması', 'sorgu optimizasyonu'],
  qa: ['e2e regresyon koşusu', 'sınır durum test seti', 'flaky test avı'],
  researcher: ['kütüphane karşılaştırması', 'benchmark araştırması', 'literatür taraması'],
  data: ['token metrik raporu', 'retrieval kalite analizi', 'maliyet panosu'],
  ml: ['embedding modeli değerlendirmesi', 'reranker denemesi', 'prompt varyant testi'],
};

const OUTCOMES: Array<{ type: GraphNodeType; head: string }> = [
  { type: 'Lesson', head: 'Ders' },
  { type: 'Decision', head: 'Karar' },
  { type: 'Artifact', head: 'Çıktı' },
];

const INSIGHTS = [
  'ölçümler beklenenden iyi çıktı',
  'kenar durum prod verisinde yakalandı',
  'ilk yaklaşım geri alındı, sadeleştirildi',
  'cache katmanı belirleyici fark yarattı',
  'dokümantasyona kural olarak eklendi',
];

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

let timers: number[] = [];
let pendingAgents = 0;

function later(ms: number, fn: () => void): void {
  timers.push(window.setTimeout(fn, ms));
}

export function stopWorkflow(): void {
  timers.forEach(t => window.clearTimeout(t));
  timers = [];
  pendingAgents = 0;
  useWorkflowStore.getState().setRunning(false);
}

function runCycle(agent: Agent, projectId: string): void {
  const { updateAgent } = useAgentSpaceStore.getState();
  const task = pick(TASKS[agent.role] ?? TASKS.architect);

  updateAgent(agent.id, { status: 'thinking', currentTask: task });

  later(rnd(2000, 4500), () => {
    updateAgent(agent.id, { status: 'working', currentTask: task });

    later(rnd(5000, 11000), () => {
      const outcome = pick(OUTCOMES);
      const insight = pick(INSIGHTS);
      updateAgent(agent.id, {
        status: 'done',
        currentTask: null,
        tokensUsed: agent.tokensUsed + Math.round(rnd(800, 4200)),
      });
      recordProjectMemory(
        projectId, agent.id, outcome.type,
        `${outcome.head}: ${task}`,
        `${agent.name} "${task}" işini tamamladı — ${insight}.`,
      );

      later(rnd(2500, 5000), () => {
        updateAgent(agent.id, { status: 'idle' });
        pendingAgents -= 1;
        if (pendingAgents <= 0) stopWorkflow();
      });
    });
  });
}

/** Kicks off one staggered work cycle for every agent on the team. */
export function startWorkflow(): void {
  const { running, setRunning } = useWorkflowStore.getState();
  const projectId = useProjectStore.getState().activeProjectId;
  const agents = useAgentSpaceStore.getState().agents;
  if (running || !projectId || agents.length === 0) return;

  setRunning(true);
  pendingAgents = agents.length;
  agents.forEach((agent, i) => {
    later(i * rnd(400, 1200), () => runCycle(agent, projectId));
  });
}
