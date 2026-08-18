// AgentSpace — Global TypeScript Types

export type AgentStatus = "idle" | "walking" | "working" | "thinking" | "done" | "blocked";

export type AgentRole = "architect" | "frontend" | "backend" | "qa" | "researcher" | "data" | "ml";

export type ModelTier = 1 | 2 | 3;

export type AgentColor = "blue" | "yellow" | "red" | "green";

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  color: AgentColor;
  /** LimeZu premade character key ('c1'..'c18'); falls back to role default */
  charKey?: string;
  modelTier: ModelTier;
  currentTask: string | null;
  tokensUsed: number;
  position: { x: number; y: number };
}

export interface Project {
  id: string;
  name: string;
  blueprint: string;
  agents: Agent[];
  createdAt: Date;
  status: "active" | "paused" | "done";
}

export interface TokenBudget {
  used: number;
  total: number;
  remaining: number;
  cacheHitRate: number;
}

export interface SystemStats {
  activeAgents: number;
  cpuUsage: number;
  ramUsageMB: number;
  tokenBudget: TokenBudget;
}
