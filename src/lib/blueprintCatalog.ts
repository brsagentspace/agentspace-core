/**
 * @file blueprintCatalog.ts
 * @description Static registry of selectable blueprints and their Space domain.
 *
 * The YAML files live in public/blueprints and are fetched lazily; this
 * catalog only answers "which blueprints exist and which domain do they
 * serve" so the project creation dialog can filter without a network round
 * trip. Base blueprints (_base, _base-media) are not listed — they are
 * inherited, never chosen directly.
 *
 * @module lib/blueprintCatalog
 */

import type { BlueprintDomain } from '../types/blueprint';

export interface BlueprintCatalogEntry {
  id: string;
  domain: BlueprintDomain;
}

export const BLUEPRINT_CATALOG: BlueprintCatalogEntry[] = [
  { id: 'web-nextjs-fullstack', domain: 'software' },
  { id: 'backend-node-microservice', domain: 'software' },
  { id: 'backend-rust-service', domain: 'software' },
  { id: 'ml-python-pipeline', domain: 'software' },
  { id: 'mobile-react-native', domain: 'software' },
  { id: 'marketing-gtm-agent', domain: 'software' },
  { id: 'video-edit-tiktok', domain: 'media' },
];

/** Blueprints selectable for a given domain. */
export function blueprintsForDomain(domain: BlueprintDomain): BlueprintCatalogEntry[] {
  return BLUEPRINT_CATALOG.filter(b => b.domain === domain);
}

/** Domain a blueprint id belongs to (unknown ids are treated as software). */
export function domainOfBlueprint(id: string): BlueprintDomain {
  return BLUEPRINT_CATALOG.find(b => b.id === id)?.domain ?? 'software';
}
