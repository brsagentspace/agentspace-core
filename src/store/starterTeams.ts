/**
 * @file starterTeams.ts
 * @description Starter agent teams per Space domain.
 *
 * Software Spaces reuse the demo team (INITIAL_AGENTS); media Spaces get the
 * production crew mirrored from the video-edit-tiktok blueprint roles.
 *
 * @module store
 */

import type { Agent, SpaceDomain } from '../types';
import { INITIAL_AGENTS } from './index';

export const MEDIA_STARTER_AGENTS: Agent[] = [
  {
    id: 'agent_1',
    name: 'Analist',
    role: 'analyst',
    status: 'idle',
    color: 'blue',
    modelTier: 1,
    charKey: 'c9',
    currentTask: null,
    tokensUsed: 0,
    position: { x: 220, y: 180 },
  },
  {
    id: 'agent_2',
    name: 'Kurgucu',
    role: 'editor',
    status: 'idle',
    color: 'yellow',
    modelTier: 1,
    charKey: 'c10',
    currentTask: null,
    tokensUsed: 0,
    position: { x: 440, y: 180 },
  },
  {
    id: 'agent_3',
    name: 'Ses',
    role: 'sound',
    status: 'idle',
    color: 'green',
    modelTier: 2,
    charKey: 'c11',
    currentTask: null,
    tokensUsed: 0,
    position: { x: 220, y: 360 },
  },
  {
    id: 'agent_4',
    name: 'QA',
    role: 'qa',
    status: 'idle',
    color: 'red',
    modelTier: 2,
    charKey: 'c4',
    currentTask: null,
    tokensUsed: 0,
    position: { x: 440, y: 360 },
  },
];

/** Starter team template for a domain (ids are prefixed by the caller). */
export function starterTeamForDomain(domain: SpaceDomain): Agent[] {
  return domain === 'media' ? MEDIA_STARTER_AGENTS : INITIAL_AGENTS;
}
