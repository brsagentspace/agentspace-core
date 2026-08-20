/**
 * @file agentBrief.ts
 * @description Builds the per-session context handed to CLI engines.
 *
 * An agent terminal is more than a login shell: the engine running inside it
 * should know which Space it serves, which role it plays, what the blueprint
 * allows/forbids and where the memory vaults live. This module turns that
 * into (a) a markdown brief written by the Rust side to `$AGENTSPACE_BRIEF`
 * and (b) engine-agnostic `AGENTSPACE_*` environment variables. The engine
 * specific launch command (claude gets the brief as an appended system
 * prompt) is composed here too, so terminalRegistry stays a thin bridge.
 *
 * @module services
 */

import i18n from '../i18n';
import type { Agent } from '../types';
import type { BlueprintDefinition } from '../types/blueprint';
import type { ProjectMeta } from '../store/projectStore';
import { projectDomain } from '../store/projectStore';
import { compileAgentSystemPrompt } from '../lib/blueprintEngine';

/** Everything the brief is derived from; `blueprint` is null when unresolved. */
export interface BriefContext {
  project: ProjectMeta;
  /** Session owner; null for plain (non-agent) shells */
  agent: Agent | null;
  /** Whole team so the agent knows who else is in the room */
  team: Agent[];
  blueprint: BlueprintDefinition | null;
}

function roleLabel(role: string): string {
  const key = `role.${role}`;
  const label = i18n.t(key, { ns: 'agents', defaultValue: '' });
  return label || role;
}

/** Markdown brief fed to the engine as system context. */
export function buildAgentBrief(ctx: BriefContext): string {
  const { project, agent, team, blueprint } = ctx;
  const domain = projectDomain(project);
  const root = project.rootPath?.trim();
  const vaults = (project.vaultPaths ?? []).map(p => p.trim()).filter(Boolean);
  const lines: string[] = [];

  const who = agent ? `${agent.name} (${roleLabel(agent.role)})` : 'Serbest terminal';
  lines.push(`# AgentSpace Brief — ${who}`);
  lines.push('');
  lines.push(
    `Sen AgentSpace masaüstü uygulamasının içinde çalışan bir ajansın; bu terminal ` +
    `"${project.name}" Space'ine ait. Aşağıdaki bağlamı oturum boyunca geçerli say.`,
  );
  lines.push('');

  lines.push('## Space');
  lines.push(`- Ad: ${project.name}`);
  lines.push(`- Alan: ${domain}`);
  lines.push(`- Çalışma klasörü: ${root ?? '(seçilmedi — oturum ev dizininde açıldı)'}`);
  if (blueprint) {
    lines.push(`- Blueprint: ${blueprint.name} (${blueprint.id} v${blueprint.version})`);
    if (blueprint.description) {
      lines.push(`  ${blueprint.description.trim().replace(/\n/g, '\n  ')}`);
    }
  } else {
    lines.push(`- Blueprint: ${project.blueprint}`);
  }
  if (vaults.length > 0) {
    lines.push('- Hafıza vault\'ları (markdown, [[wikilink]] bağlı):');
    vaults.forEach(v => lines.push(`  - ${v}`));
  }
  lines.push('');

  if (agent) {
    lines.push(`## Rolün: ${roleLabel(agent.role)} (${agent.role})`);
    const responsibilities = blueprint?.agent_roles?.[agent.role]?.responsibilities ?? [];
    if (responsibilities.length > 0) {
      lines.push('Sorumlulukların:');
      responsibilities.forEach(r => lines.push(`- ${r}`));
    } else {
      lines.push('Bu rol için blueprint\'te sorumluluk listesi yok; Space kurallarına göre hareket et.');
    }
    lines.push('');
  }

  const others = team.filter(a => a.id !== agent?.id);
  if (others.length > 0) {
    lines.push('## Takım');
    others.forEach(a => lines.push(`- ${a.name} — ${roleLabel(a.role)} (${a.role})`));
    lines.push('');
  }

  if (blueprint) {
    lines.push('## Blueprint kuralları');
    lines.push('');
    lines.push('```');
    lines.push(compileAgentSystemPrompt(blueprint).trimEnd());
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

/** Engine-agnostic environment exported into the shell. */
export function buildAgentEnv(ctx: BriefContext): Record<string, string> {
  const { project, agent, blueprint } = ctx;
  const env: Record<string, string> = {
    AGENTSPACE_SPACE: project.name,
    AGENTSPACE_SPACE_ID: project.id,
    AGENTSPACE_DOMAIN: projectDomain(project),
    AGENTSPACE_BLUEPRINT: blueprint?.id ?? project.blueprint,
  };
  const root = project.rootPath?.trim();
  if (root) env.AGENTSPACE_ROOT = root;
  const vaults = (project.vaultPaths ?? []).map(p => p.trim()).filter(Boolean);
  if (vaults.length > 0) env.AGENTSPACE_VAULTS = vaults.join(':');
  if (agent) {
    env.AGENTSPACE_AGENT = agent.name;
    env.AGENTSPACE_AGENT_ID = agent.id;
    env.AGENTSPACE_ROLE = agent.role;
  }
  return env;
}

/** POSIX single-quote escaping for paths that may contain spaces/quotes. */
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Conversation persistence flags for claude (see services/claudeSessions). */
export interface ClaudeSessionFlags {
  sessionId: string;
  mode: 'new' | 'resume';
}

/**
 * Engine launch line typed into the shell. Only claude can ingest the brief
 * natively (`--append-system-prompt-file`); codex/gemini get it via env.
 * `$AGENTSPACE_BRIEF` is left for the shell to expand. With `session`,
 * claude pins (`--session-id`) or continues (`--resume`) a conversation.
 */
export function engineLaunchCommand(
  engine: string,
  ctx: BriefContext | null,
  session?: ClaudeSessionFlags,
): string {
  if (engine !== 'claude') return engine;
  const parts = ['claude'];
  if (session) {
    parts.push(session.mode === 'resume' ? '--resume' : '--session-id', session.sessionId);
  }
  if (ctx) {
    parts.push('--append-system-prompt-file', '"$AGENTSPACE_BRIEF"');
    const vaults = (ctx.project.vaultPaths ?? []).map(p => p.trim()).filter(Boolean);
    if (vaults.length > 0) {
      parts.push('--add-dir', ...vaults.map(shellQuote));
    }
  }
  return parts.join(' ');
}
