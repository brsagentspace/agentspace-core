/**
 * @file claudeSessions.ts
 * @description Frontend bridge to the Claude Code session index.
 *
 * Claude Code keeps one JSONL transcript per conversation under
 * `~/.claude/projects/<encoded-cwd>/`. The Rust side (`claude_sessions.rs`)
 * parses them; this module exposes typed wrappers, the id minting used to
 * make a pane's conversation survive app restarts (`--session-id` on first
 * launch, `--resume` afterwards) and small display formatters for the
 * Sessions menu.
 *
 * @module services
 */

/** True when running inside the Tauri shell (real PTY + session index). */
export const IS_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** Mirrors `ClaudeSessionInfo` in src-tauri/src/claude_sessions.rs. */
export interface ClaudeSessionInfo {
  id: string;
  title: string;
  first_prompt: string;
  last_prompt: string;
  cwd: string;
  git_branch: string;
  model: string;
  created_at: string;
  modified_at: string;
  size_bytes: number;
  turns: number;
  assistant_messages: number;
  /** Prompt-side tokens of the last call = current context size */
  context_tokens: number;
  total_input_tokens: number;
  total_cache_read_tokens: number;
  total_output_tokens: number;
  /** A running `claude` was started with this id (--session-id / --resume) */
  live: boolean;
}

/** `none` = id free, `empty` = transcript without prompts, `resumable` = continue it. */
export type ClaudeSessionState = 'none' | 'empty' | 'resumable';

/** Lists the conversations recorded for a working directory (newest first). */
export async function listClaudeSessions(cwd: string | null): Promise<ClaudeSessionInfo[]> {
  if (!IS_TAURI) return [];
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<ClaudeSessionInfo[]>('claude_sessions_list', { cwd });
}

/** Asks whether `claude --resume <id>` would find a conversation in this cwd. */
export async function claudeSessionState(cwd: string | null, id: string): Promise<ClaudeSessionState> {
  if (!IS_TAURI) return 'none';
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<ClaudeSessionState>('claude_session_state', { cwd, id });
}

/** RFC 4122 v4 id — `--session-id` rejects anything else. */
export function newClaudeSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** How a claude pane should be launched given its remembered session id. */
export interface ClaudeLaunchPlan {
  /** Id to pass on the command line (may differ from the remembered one). */
  sessionId: string;
  mode: 'new' | 'resume';
}

/**
 * Decides between `--session-id` and `--resume` for a pane. A remembered id
 * whose transcript holds prompts is resumed; an id taken by an empty
 * transcript would make both flags fail, so a fresh one is minted.
 */
export async function planClaudeLaunch(cwd: string | null, remembered?: string): Promise<ClaudeLaunchPlan> {
  if (!remembered) return { sessionId: newClaudeSessionId(), mode: 'new' };
  const state = await claudeSessionState(cwd, remembered).catch((): ClaudeSessionState => 'none');
  if (state === 'resumable') return { sessionId: remembered, mode: 'resume' };
  if (state === 'empty') return { sessionId: newClaudeSessionId(), mode: 'new' };
  return { sessionId: remembered, mode: 'new' };
}

// ── Display helpers ─────────────────────────────────────────────────────────

/** 1234 → "1.2k", 1234567 → "1.2M". */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}k`;
  return String(n);
}

/** Total tokens billed across the conversation (input + cache reads + output). */
export function totalTokens(s: ClaudeSessionInfo): number {
  return s.total_input_tokens + s.total_cache_read_tokens + s.total_output_tokens;
}

/** Relative time in Turkish ("3 dk önce", "dün"); falls back to the date. */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const sec = Math.max(0, Math.round((now - t) / 1000));
  if (sec < 60) return 'az önce';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} dk önce`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} sa önce`;
  const day = Math.round(hr / 24);
  if (day === 1) return 'dün';
  if (day < 7) return `${day} gün önce`;
  return new Date(t).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
}

/** "claude-opus-4-1-20250805" → "opus-4-1". */
export function shortModel(model: string): string {
  return model.replace(/^claude-/, '').replace(/-\d{8}$/, '');
}

/** Pane title for a conversation opened from the Sessions menu. */
export function paneTitleFor(s: ClaudeSessionInfo): string {
  const t = s.title.trim() || s.first_prompt.trim() || `Oturum ${s.id.slice(0, 8)}`;
  return t.length > 32 ? `${t.slice(0, 31).trimEnd()}…` : t;
}
