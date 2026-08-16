/**
 * @file blueprint.ts
 * @description TypeScript interface definitions for the AgentSpace Blueprint Engine.
 *
 * Defines the complete data model for YAML blueprints including architecture patterns,
 * code standards, forbidden patterns, testing minimums, agent roles, and initial prompts.
 *
 * @module types/blueprint
 */

export interface BlueprintAgentRole {
  count: number;
  model_tier: number;
  color: 'blue' | 'yellow' | 'red' | 'green';
  responsibilities: string[];
}

export interface BlueprintArchitecture {
  pattern: string;
  description?: string;
  state_management?: Record<string, unknown>;
  rendering_strategy?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface BlueprintCodeStandards {
  language?: string;
  forbidden?: string[];
  performance?: string[];
  [key: string]: unknown;
}

export interface BlueprintTesting {
  framework?: string;
  coverage_minimum?: number;
  strategy?: Record<string, string>;
  rules?: string[];
}

export interface BlueprintDefinition {
  id: string;
  version: string;
  name: string;
  project_type: 'mobile' | 'web' | 'backend' | 'ml' | 'universal';
  inherits?: string;
  description: string;
  tags?: string[];
  architecture?: BlueprintArchitecture;
  folder_structure?: Record<string, unknown>;
  code_standards?: BlueprintCodeStandards;
  accessibility?: { rules: string[] };
  testing?: BlueprintTesting;
  design_process?: {
    critical_note?: string;
    [key: string]: unknown;
  };
  agent_roles?: Record<string, BlueprintAgentRole>;
  initial_feed?: string[];
  deployment?: Record<string, unknown>;
  [key: string]: unknown;
}
