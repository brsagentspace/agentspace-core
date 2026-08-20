/**
 * @file agentRoles.ts
 * @description Agent role lists per Space domain.
 *
 * Software Spaces pick from engineering roles, media Spaces from the
 * production crew (analyst → editor → sound → qa). The full list is
 * still offered in the picker — domain roles simply come first.
 *
 * @module lib/agentRoles
 */

import type { AgentRole, SpaceDomain } from '../types';

export const SOFTWARE_ROLES: AgentRole[] = ['architect', 'frontend', 'backend', 'qa', 'researcher', 'data', 'ml'];
export const MEDIA_ROLES: AgentRole[] = ['analyst', 'editor', 'sound', 'qa', 'researcher'];

/** Roles ordered for a domain: native roles first, the rest after. */
export function rolesForDomain(domain: SpaceDomain): AgentRole[] {
  const primary = domain === 'media' ? MEDIA_ROLES : SOFTWARE_ROLES;
  const rest = [...SOFTWARE_ROLES, ...MEDIA_ROLES].filter(r => !primary.includes(r));
  return [...primary, ...Array.from(new Set(rest))];
}

/** Default role for the add-agent picker. */
export function defaultRoleForDomain(domain: SpaceDomain): AgentRole {
  return domain === 'media' ? 'editor' : 'frontend';
}
