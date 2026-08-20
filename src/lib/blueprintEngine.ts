/**
 * @file blueprintEngine.ts
 * @description Runtime engine for loading, parsing, and resolving AgentSpace Blueprints.
 *
 * Implements YAML deserialization, chained blueprint inheritance (_base / _base-media …),
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

/** Guards against `inherits` cycles (a → b → a). */
const MAX_INHERITANCE_DEPTH = 8;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Merges a child blueprint over its parent.
 *
 * Arrays are concatenated (parent first, duplicates dropped) so rule lists
 * such as `forbidden` / `principles` / `rules` accumulate down the chain;
 * nested objects merge recursively; scalars from the child win.
 */
export function mergeBlueprints(
  parent: Record<string, unknown>,
  child: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...parent };
  for (const [key, childValue] of Object.entries(child)) {
    const parentValue = parent[key];
    if (Array.isArray(parentValue) && Array.isArray(childValue)) {
      out[key] = Array.from(new Set([...parentValue, ...childValue]));
    } else if (isPlainObject(parentValue) && isPlainObject(childValue)) {
      out[key] = mergeBlueprints(parentValue, childValue);
    } else {
      out[key] = childValue;
    }
  }
  return out;
}

/**
 * Resolves a complete blueprint definition with its full inheritance chain
 * (e.g. video-edit-tiktok → _base-media). Identity fields (id, name,
 * version, description, inherits) always come from the requested blueprint.
 *
 * @param blueprintId - Target blueprint ID
 * @returns Fully resolved BlueprintDefinition with combined rules
 */
export async function resolveBlueprint(blueprintId: string): Promise<BlueprintDefinition> {
  const cached = BLUEPRINT_CACHE.get(blueprintId);
  if (cached) return cached;

  const chain: BlueprintDefinition[] = [];
  const seen = new Set<string>();
  let currentId: string | undefined = blueprintId;

  while (currentId && !seen.has(currentId) && chain.length < MAX_INHERITANCE_DEPTH) {
    seen.add(currentId);
    try {
      const bp = await loadRawBlueprint(currentId);
      chain.push(bp);
      currentId = bp.inherits;
    } catch (err) {
      // A missing base degrades to the part of the chain we could load.
      if (chain.length === 0) throw err;
      break;
    }
  }

  const leaf = chain[0];
  const merged = chain
    .slice()
    .reverse()
    .reduce<Record<string, unknown>>(
      (acc, bp) => mergeBlueprints(acc, bp as unknown as Record<string, unknown>),
      {},
    );

  const resolved: BlueprintDefinition = {
    ...(merged as unknown as BlueprintDefinition),
    id: leaf.id,
    name: leaf.name,
    version: leaf.version,
    description: leaf.description,
    inherits: leaf.inherits,
  };

  BLUEPRINT_CACHE.set(blueprintId, resolved);
  return resolved;
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

  if (blueprint.code_standards?.principles && blueprint.code_standards.principles.length > 0) {
    lines.push('--- APPROVED PRINCIPLES ---');
    blueprint.code_standards.principles.forEach((rule) => lines.push(`✔ ${rule}`));
    lines.push('');
  }

  if (blueprint.code_standards?.forbidden && blueprint.code_standards.forbidden.length > 0) {
    lines.push('--- STRICTLY FORBIDDEN PATTERNS ---');
    blueprint.code_standards.forbidden.forEach((forbidden) => lines.push(`❌ ${forbidden}`));
    lines.push('');
  }

  return lines.join('\n');
}
