/**
 * @file blueprintEngine.ts
 * @description Runtime engine for loading, parsing, and resolving AgentSpace Blueprints.
 *
 * Implements YAML deserialization, blueprint inheritance resolution (_base.yaml merging),
 * and dynamic rule extraction for the RulesPanel and LLM system prompt injection.
 *
 * @module lib/blueprintEngine
 */

import { load } from 'js-yaml';
import type { BlueprintDefinition } from '../types/blueprint';

/** In-memory cache for parsed blueprints */
const BLUEPRINT_CACHE = new Map<string, BlueprintDefinition>();

/**
 * Fetches and parses a raw blueprint YAML file from public storage.
 *
 * @param blueprintId - Name of the blueprint file (e.g. 'web-nextjs-fullstack')
 * @returns Parsed BlueprintDefinition object
 */
export async function loadRawBlueprint(blueprintId: string): Promise<BlueprintDefinition> {
  const url = `/blueprints/${blueprintId}.yaml`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch blueprint '${blueprintId}': ${response.statusText}`);
  }

  const rawText = await response.text();
  const parsed = load(rawText) as BlueprintDefinition;
  return parsed;
}

/**
 * Resolves a complete blueprint definition with its inherited base rules.
 *
 * @param blueprintId - Target blueprint ID
 * @returns Fully resolved BlueprintDefinition with combined rules
 */
export async function resolveBlueprint(blueprintId: string): Promise<BlueprintDefinition> {
  if (BLUEPRINT_CACHE.has(blueprintId)) {
    return BLUEPRINT_CACHE.get(blueprintId)!;
  }

  const blueprint = await loadRawBlueprint(blueprintId);

  // If blueprint specifies inheritance, fetch and merge base
  if (blueprint.inherits) {
    try {
      const baseBlueprint = await loadRawBlueprint(blueprint.inherits);

      const merged: BlueprintDefinition = {
        ...baseBlueprint,
        ...blueprint,
        code_standards: {
          ...baseBlueprint.code_standards,
          ...blueprint.code_standards,
          forbidden: [
            ...(baseBlueprint.code_standards?.forbidden || []),
            ...(blueprint.code_standards?.forbidden || []),
          ],
        },
        testing: {
          ...baseBlueprint.testing,
          ...blueprint.testing,
        },
      };

      BLUEPRINT_CACHE.set(blueprintId, merged);
      return merged;
    } catch {
      // Fallback to standalone blueprint if base cannot be loaded
    }
  }

  BLUEPRINT_CACHE.set(blueprintId, blueprint);
  return blueprint;
}

/**
 * Compiles initial feed prompts into a formatted system context string.
 *
 * @param blueprint - Resolved blueprint object
 * @returns Formatted system instructions for LLM agents
 */
export function compileAgentSystemPrompt(blueprint: BlueprintDefinition): string {
  const lines: string[] = [];

  lines.push(`=== BLUEPRINT: ${blueprint.name.toUpperCase()} (v${blueprint.version}) ===`);
  lines.push(`Project Type: ${blueprint.project_type}`);
  lines.push(`Architecture Pattern: ${blueprint.architecture?.pattern || 'Standard'}\n`);

  if (blueprint.initial_feed && blueprint.initial_feed.length > 0) {
    lines.push('--- CORE OPERATIONAL GUIDELINES ---');
    blueprint.initial_feed.forEach((feed) => lines.push(`• ${feed}`));
    lines.push('');
  }

  if (blueprint.code_standards?.forbidden && blueprint.code_standards.forbidden.length > 0) {
    lines.push('--- STRICTLY FORBIDDEN PATTERNS ---');
    blueprint.code_standards.forbidden.forEach((forbidden) => lines.push(`❌ ${forbidden}`));
    lines.push('');
  }

  return lines.join('\n');
}
