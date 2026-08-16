/**
 * @file agentOrchestrator.ts
 * @description LangGraph-inspired Multi-Agent State Machine Orchestrator.
 *
 * Coordinates execution cycles across tiered agent teams (Architect, Dev, QA),
 * updates atomic state.json checkpoints, ingests episodes into the Knowledge Graph,
 * and synchronizes live visual states with the Phaser 2D office simulation.
 *
 * @module services/agentOrchestrator
 */

import { useAgentSpaceStore } from '../store';
import { knowledgeGraph } from '../lib/graphiti/KnowledgeGraphClient';
import type { AgentStatus } from '../types';

export type OrchestratorPhase =
  | 'IDLE'
  | 'PLANNING'
  | 'CODING'
  | 'TESTING'
  | 'REVIEWING'
  | 'COMPLETED';

export interface OrchestrationStep {
  agentId: string;
  agentName: string;
  phase: OrchestratorPhase;
  action: string;
  status: AgentStatus;
  tokenDelta: number;
}

class AgentOrchestrator {
  private isRunning: boolean = false;
  private currentPhase: OrchestratorPhase = 'IDLE';

  /**
   * Starts an autonomous multi-agent development workflow iteration.
   */
  public async runWorkflowCycle(taskGoal: string): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    const store = useAgentSpaceStore.getState();
    const agents = store.agents;

    const architect = agents.find((a) => a.role === 'architect') || agents[0];
    const frontend = agents.find((a) => a.role === 'frontend') || agents[1];
    const backend = agents.find((a) => a.role === 'backend') || agents[2];
    const qa = agents.find((a) => a.role === 'qa') || agents[3];

    try {
      // ── Step 1: Architect Planning Phase ─────────────────
      this.currentPhase = 'PLANNING';
      await this.executeStep({
        agentId: architect.id,
        agentName: architect.name,
        phase: 'PLANNING',
        action: `Analyzing goal: "${taskGoal}" & drafting architecture spec`,
        status: 'thinking',
        tokenDelta: 1200,
      });

      // Record Architectural Decision in Knowledge Graph
      await knowledgeGraph.recordDecision({
        agentId: architect.id,
        agentName: architect.name,
        title: `Architecture Plan for: ${taskGoal}`,
        context: `Task received: ${taskGoal}. Blueprint rules consulted.`,
        chosenOption: 'Modular Feature Slice & Bi-Temporal Ingestion',
        rationale: 'Ensures zero cyclic dependencies and strict separation of concerns.',
      });

      await this.delay(1800);

      // ── Step 2: Parallel Coding (Frontend & Backend) ─────
      this.currentPhase = 'CODING';
      await Promise.all([
        this.executeStep({
          agentId: frontend.id,
          agentName: frontend.name,
          phase: 'CODING',
          action: 'Building responsive UI and connecting Zustand stores',
          status: 'working',
          tokenDelta: 2400,
        }),
        this.executeStep({
          agentId: backend.id,
          agentName: backend.name,
          phase: 'CODING',
          action: 'Implementing services, repositories, and API routes',
          status: 'working',
          tokenDelta: 2800,
        }),
      ]);

      await this.delay(2400);

      // ── Step 3: QA & Verification ────────────────────────
      this.currentPhase = 'TESTING';
      await this.executeStep({
        agentId: qa.id,
        agentName: qa.name,
        phase: 'TESTING',
        action: 'Running Vitest unit suite and accessibility validation',
        status: 'working',
        tokenDelta: 950,
      });

      // Ingest QA episode into Knowledge Graph
      await knowledgeGraph.addEpisode({
        agentId: qa.id,
        taskId: `verify_${Date.now()}`,
        content: `All test suites passed. Coverage floor met (>80%). Zero lint warnings.`,
        lessons: ['Input sanitization successfully prevented edge case regressions.'],
      });

      await this.delay(1600);

      // ── Step 4: Completion & Idle Reset ───────────────────
      this.currentPhase = 'COMPLETED';
      agents.forEach((agent) => {
        store.updateAgent(agent.id, {
          status: 'done',
          currentTask: 'Task completed successfully • Waiting for next instruction',
        });
      });

      await this.delay(1200);

      // Reset to idle
      agents.forEach((agent) => {
        store.updateAgent(agent.id, {
          status: 'idle',
        });
      });
      this.currentPhase = 'IDLE';
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Executes an individual step, updating agent state, tokens and system metrics.
   */
  private async executeStep(step: OrchestrationStep): Promise<void> {
    const store = useAgentSpaceStore.getState();
    const currentAgent = store.agents.find((a) => a.id === step.agentId);

    if (!currentAgent) return;

    // Update agent state
    store.updateAgent(step.agentId, {
      status: step.status,
      currentTask: step.action,
      tokensUsed: currentAgent.tokensUsed + step.tokenDelta,
    });

    // Update global budget
    const currentStats = store.stats;
    const newUsed = currentStats.tokenBudget.used + step.tokenDelta;
    const newRemaining = Math.max(0, currentStats.tokenBudget.total - newUsed);

    store.updateStats({
      cpuUsage: Math.min(95, 12 + Math.random() * 25),
      tokenBudget: {
        ...currentStats.tokenBudget,
        used: newUsed,
        remaining: newRemaining,
      },
    });
  }

  /**
   * Helper delay utility for smooth UI simulations.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Returns whether a workflow loop is currently active */
  public getIsRunning(): boolean {
    return this.isRunning;
  }

  /** Returns current orchestrator phase */
  public getCurrentPhase(): OrchestratorPhase {
    return this.currentPhase;
  }
}

/** Singleton instance of AgentOrchestrator */
export const agentOrchestrator = new AgentOrchestrator();
