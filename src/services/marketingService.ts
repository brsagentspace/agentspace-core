/**
 * @file marketingService.ts
 * @description Autonomous SaaS Go-To-Market (GTM) & Launch Generator Service.
 *
 * Consumes Knowledge Graph decisions, architectural features, and Anti-Vibe-Code
 * standards to generate complete launch collateral (Product Hunt kits, X threads, Hero copy, Pricing tables).
 *
 * @module services/marketingService
 */

import { knowledgeGraph } from '../lib/graphiti/KnowledgeGraphClient';

export interface GTMLaunchPackage {
  projectName: string;
  tagline: string;
  heroHeadline: string;
  heroSubheadline: string;
  productHuntKit: {
    tagline: string;
    description: string;
    firstComment: string;
  };
  twitterLaunchThread: string[];
  pricingMatrix: Array<{
    name: string;
    priceMonthly: number;
    popular?: boolean;
    features: string[];
    upgradePitch: string;
  }>;
  generatedAt: string;
}

export class MarketingService {
  /**
   * Synthesizes Knowledge Graph data into a ready-to-publish SaaS Launch Package.
   *
   * @param projectName - Target SaaS product name
   */
  public generateLaunchPackage(projectName: string = 'AgentSpace'): GTMLaunchPackage {
    const decisions = knowledgeGraph.getAllDecisions();

    // Extract core value props from graph
    const coreHighlights = decisions
      .slice(0, 4)
      .map((d) => d.chosenOption)
      .join(', ');

    return {
      projectName,
      tagline: 'Autonomous Multi-Agent Workspace with 2D Office Simulation & Bi-Temporal Memory',
      heroHeadline: 'Turn AI Coding Swarms into Real, Production-Ready SaaS',
      heroSubheadline: `Orchestrate tiered agent teams in an interactive 2D office. Powered by ${coreHighlights}.`,

      productHuntKit: {
        tagline: 'Multi-Agent Coding Workspace with 2D Office & Knowledge Graph Memory',
        description: `${projectName} is a desktop IDE workspace where tiered AI agent teams collaborate inside an isometric 2D office with bi-temporal graph memory, split-pane terminals, and 90% token savings.`,
        firstComment: `Hey Product Hunt! 👋 We built ${projectName} because running AI coding agents in raw terminal loops felt disconnected. Now, you get an interactive 2D office simulation, full Langfuse cost tracing, and automated blueprint enforcement. We'd love your feedback!`,
      },

      twitterLaunchThread: [
        `🚀 Introducing ${projectName} — the first autonomous multi-agent workspace with a live 2D office simulation & Knowledge Graph memory.\n\nHere is how we turn "vibe code" into real SaaS: 🧵👇`,
        `1/ Multi-Agent Hierarchy 🤖\n\nInstead of one monolithic prompt, ${projectName} deploys Tier-1 Architects, Tier-2 Devs, and Tier-3 QA Sentinels working concurrently in a 2D Phaser.js office.`,
        `2/ Bi-Temporal Knowledge Graph 🧠\n\nWith Graphiti memory, agents track valid_time vs ingestion_time. Decisions are never forgotten across sessions.`,
        `3/ 90% Token Reduction with Contextual RAG ⚡\n\nOur 3-stage cascade (BM25 ➔ Reranker ➔ Compact Synthesis) eliminates token waste without losing context.`,
        `4/ Anti-Vibe-Code SaaS Standards 🛡️\n\nStrict enforcement of Lucide icons, matte HSL palettes, sparkline KPI charts, and progressive disclosure forms.`,
        `Try ${projectName} today: Open source, cross-platform Tauri desktop app.\n\nLink in bio! 🌟`,
      ],

      pricingMatrix: [
        {
          name: 'Starter',
          priceMonthly: 0,
          features: ['1 Local Project', '2 Concurrent Agents', 'Basic Terminal', 'Community Discord'],
          upgradePitch: 'Upgrade to Pro for unlimited agents & Knowledge Graph history',
        },
        {
          name: 'Pro Developer',
          priceMonthly: 29,
          popular: true,
          features: [
            'Unlimited Projects',
            'Full 4-Agent Team (Architect, Dev, QA)',
            'Graphiti Knowledge Graph Memory',
            'Langfuse Telemetry & Cost Dashboard',
            'Custom Blueprint Engine',
          ],
          upgradePitch: 'Upgrade to Team for multi-seat sync & shared graph databases',
        },
        {
          name: 'Team / Studio',
          priceMonthly: 99,
          features: [
            'Everything in Pro',
            'Shared Team Knowledge Graph',
            'Cloud Backup & Versioning',
            'Dedicated Model Routing',
            'Priority Support',
          ],
          upgradePitch: 'Contact us for Custom Enterprise On-Premise Deployments',
        },
      ],

      generatedAt: new Date().toISOString(),
    };
  }
}

/** Singleton instance of MarketingService */
export const marketingService = new MarketingService();
