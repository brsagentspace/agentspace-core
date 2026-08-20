// AgentSpace — Claude Code session index
// Reads the transcripts Claude Code keeps under
// `~/.claude/projects/<encoded-cwd>/<uuid>.jsonl` so the terminal workspace
// can list a Space's past conversations (title, last prompt, token usage)
// and resume any of them with `claude --resume <uuid>`.
//
// Transcripts grow large (100+ MB); each file is parsed once and cached by
// (mtime, size) so reopening the menu is instant.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ClaudeSessionInfo {
    pub id: String,
    /// AI-generated title when Claude produced one, else the first prompt.
    pub title: String,
    pub first_prompt: String,
    pub last_prompt: String,
    pub cwd: String,
    pub git_branch: String,
    pub model: String,
    pub created_at: String,
    pub modified_at: String,
    pub size_bytes: u64,
    /// Human prompts (tool results excluded).
    pub turns: u32,
    pub assistant_messages: u32,
    /// Prompt-side tokens of the last assistant call = current context size.
    pub context_tokens: u64,
    pub total_input_tokens: u64,
    pub total_cache_read_tokens: u64,
    pub total_output_tokens: u64,
    /// A running `claude` process was started with this session id
    /// (`--session-id` / `--resume`). Bare `claude` runs stay undetected.
    pub live: bool,
}

/// Whether `claude --resume <id>` would find a conversation for the id.
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ClaudeSessionState {
    /// No transcript — the id is free for `--session-id`.
    None,
    /// Transcript exists but holds no prompt — `--resume` fails and
    /// `--session-id` collides; the caller should mint a fresh id.
    Empty,
    /// Has at least one prompt — `--resume` continues it.
    Resumable,
}

#[derive(Default)]
pub struct ClaudeSessionCache(pub Mutex<HashMap<PathBuf, (SystemTime, u64, ClaudeSessionInfo)>>);

fn home_dir() -> PathBuf {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("/"))
}

/// Claude Code names a project directory after its cwd with every
/// non-alphanumeric character replaced by `-`.
pub fn encode_project_dir(cwd: &str) -> String {
    cwd.chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect()
}

fn project_dir_for(cwd: &str) -> PathBuf {
    home_dir().join(".claude").join("projects").join(encode_project_dir(cwd))
}

/// Resolves the cwd a terminal runs in (Space root or home) — must mirror
/// the fallback in `pty_spawn`, otherwise the index looks at the wrong folder.
fn effective_cwd(cwd: Option<String>) -> String {
    match cwd {
        Some(dir) if !dir.trim().is_empty() && Path::new(&dir).is_dir() => dir,
        _ => home_dir().to_string_lossy().to_string(),
    }
}

fn first_text(content: &Value) -> Option<String> {
    match content {
        Value::String(s) => Some(s.clone()),
        Value::Array(items) => items.iter().find_map(|item| {
            if item.get("type").and_then(Value::as_str) == Some("text") {
                item.get("text").and_then(Value::as_str).map(str::to_string)
            } else {
                None
            }
        }),
        _ => None,
    }
}

fn truncate(s: &str, max: usize) -> String {
    let trimmed = s.trim().replace('\n', " ");
    if trimmed.chars().count() <= max {
        trimmed
    } else {
        let cut: String = trimmed.chars().take(max).collect();
        format!("{}…", cut.trim_end())
    }
}

fn usage_u64(usage: &Value, key: &str) -> u64 {
    usage.get(key).and_then(Value::as_u64).unwrap_or(0)
}

fn memmem(haystack: &[u8], needle: &[u8]) -> bool {
    if needle.is_empty() || haystack.len() < needle.len() {
        return false;
    }
    haystack.windows(needle.len()).any(|w| w == needle)
}

fn parse_transcript(path: &Path, id: &str) -> Result<ClaudeSessionInfo, String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let meta = file.metadata().map_err(|e| e.to_string())?;
    let reader = BufReader::with_capacity(1 << 20, file);

    let mut info = ClaudeSessionInfo {
        id: id.to_string(),
        title: String::new(),
        first_prompt: String::new(),
        last_prompt: String::new(),
        cwd: String::new(),
        git_branch: String::new(),
        model: String::new(),
        created_at: String::new(),
        modified_at: String::new(),
        size_bytes: meta.len(),
        turns: 0,
        assistant_messages: 0,
        context_tokens: 0,
        total_input_tokens: 0,
        total_cache_read_tokens: 0,
        total_output_tokens: 0,
        live: false,
    };
    let mut ai_title = String::new();
    let mut last_prompt_marker = String::new();
    let mut last_user_text = String::new();
    // Streaming writes one transcript line per content block, all sharing a
    // requestId and repeating the usage block. Input tokens are counted once
    // per request; output tokens take the latest (most complete) value.
    let mut last_request_id = String::new();
    let mut last_request_output: u64 = 0;

    for line in reader.split(b'\n') {
        let line = match line {
            Ok(l) => l,
            Err(_) => break,
        };
        if line.is_empty() {
            continue;
        }
        // Cheap substring gates before paying for JSON parsing: transcripts
        // carry base64 images and tool dumps we never need.
        let interesting = memmem(&line, br#""type":"user""#)
            || memmem(&line, br#""type":"assistant""#)
            || memmem(&line, br#""type":"ai-title""#)
            || memmem(&line, br#""type":"last-prompt""#);
        if !interesting {
            continue;
        }
        let value: Value = match serde_json::from_slice(&line) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let kind = value.get("type").and_then(Value::as_str).unwrap_or("");
        match kind {
            "ai-title" => {
                if let Some(t) = value.get("aiTitle").and_then(Value::as_str) {
                    ai_title = t.to_string();
                }
            }
            "last-prompt" => {
                if let Some(p) = value.get("lastPrompt").and_then(Value::as_str) {
                    last_prompt_marker = p.to_string();
                }
            }
            "user" => {
                if value.get("isSidechain").and_then(Value::as_bool).unwrap_or(false) {
                    continue;
                }
                let Some(message) = value.get("message") else { continue };
                let content = message.get("content").cloned().unwrap_or(Value::Null);
                let is_tool_result = content
                    .as_array()
                    .map(|items| items.iter().any(|i| i.get("type").and_then(Value::as_str) == Some("tool_result")))
                    .unwrap_or(false);
                if is_tool_result {
                    continue;
                }
                let Some(text) = first_text(&content) else { continue };
                // Slash-command expansions and harness reminders are not prompts.
                let text = text.trim().to_string();
                if text.is_empty()
                    || text.starts_with("<command-")
                    || text.starts_with("<local-command")
                    || text.starts_with("<system-reminder")
                {
                    continue;
                }
                info.turns += 1;
                last_user_text = text.clone();
                if info.first_prompt.is_empty() {
                    info.first_prompt = truncate(&text, 200);
                    if let Some(ts) = value.get("timestamp").and_then(Value::as_str) {
                        info.created_at = ts.to_string();
                    }
                    if let Some(cwd) = value.get("cwd").and_then(Value::as_str) {
                        info.cwd = cwd.to_string();
                    }
                    if let Some(branch) = value.get("gitBranch").and_then(Value::as_str) {
                        info.git_branch = branch.to_string();
                    }
                }
                if let Some(ts) = value.get("timestamp").and_then(Value::as_str) {
                    info.modified_at = ts.to_string();
                }
            }
            "assistant" => {
                if value.get("isSidechain").and_then(Value::as_bool).unwrap_or(false) {
                    continue;
                }
                let Some(message) = value.get("message") else { continue };
                if let Some(model) = message.get("model").and_then(Value::as_str) {
                    info.model = model.to_string();
                }
                if let Some(ts) = value.get("timestamp").and_then(Value::as_str) {
                    info.modified_at = ts.to_string();
                }
                let Some(usage) = message.get("usage") else { continue };
                let request_id = value.get("requestId").and_then(Value::as_str).unwrap_or("");
                let out = usage_u64(usage, "output_tokens");
                let same_request = !request_id.is_empty() && request_id == last_request_id;
                if same_request {
                    info.total_output_tokens = info.total_output_tokens.saturating_sub(last_request_output);
                } else {
                    info.assistant_messages += 1;
                    let input = usage_u64(usage, "input_tokens");
                    let cache_create = usage_u64(usage, "cache_creation_input_tokens");
                    let cache_read = usage_u64(usage, "cache_read_input_tokens");
                    info.total_input_tokens += input + cache_create;
                    info.total_cache_read_tokens += cache_read;
                    info.context_tokens = input + cache_create + cache_read;
                    last_request_id = request_id.to_string();
                }
                info.total_output_tokens += out;
                last_request_output = out;
            }
            _ => {}
        }
    }

    info.last_prompt = truncate(
        if !last_prompt_marker.is_empty() { &last_prompt_marker } else { &last_user_text },
        200,
    );
    info.title = if !ai_title.is_empty() {
        ai_title
    } else if !info.first_prompt.is_empty() {
        truncate(&info.first_prompt, 80)
    } else {
        format!("Oturum {}", &id[..8.min(id.len())])
    };
    if info.modified_at.is_empty() {
        if let Ok(modified) = meta.modified() {
            info.modified_at = iso_from_system_time(modified);
        }
    }
    Ok(info)
}

fn iso_from_system_time(t: SystemTime) -> String {
    let secs = t.duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    // Civil-from-days (Howard Hinnant) — avoids pulling in chrono.
    let days = (secs / 86_400) as i64;
    let rem = secs % 86_400;
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.000Z",
        y, m, d, rem / 3600, (rem % 3600) / 60, rem % 60
    )
}

/// Session ids named on the command line of running `claude` processes
/// (`--session-id <id>` / `--resume <id>`). AgentSpace always launches with
/// one of these flags, so every pane owned by this or a previous app run is
/// recognised; bare `claude` sessions from other terminals are not.
#[cfg(unix)]
fn live_session_ids() -> Vec<String> {
    let output = std::process::Command::new("ps")
        .args(["-axo", "args="])
        .output();
    let Ok(output) = output else { return Vec::new() };
    let text = String::from_utf8_lossy(&output.stdout);
    let mut ids = Vec::new();
    for line in text.lines() {
        let mut parts = line.split_whitespace();
        let Some(bin) = parts.next() else { continue };
        // Native install: `claude …`; npm install: `node …/bin/claude …`.
        let mut is_claude = basename(bin) == "claude";
        if !is_claude && basename(bin).starts_with("node") {
            let mut peek = parts.clone();
            is_claude = peek.next().map(|p| basename(p) == "claude").unwrap_or(false);
        }
        if !is_claude {
            continue;
        }
        let mut prev = "";
        for part in parts {
            if (prev == "--session-id" || prev == "--resume" || prev == "-r") && looks_like_uuid(part) {
                ids.push(part.to_string());
            }
            prev = part;
        }
    }
    ids
}

#[cfg(not(unix))]
fn live_session_ids() -> Vec<String> {
    Vec::new()
}

fn basename(path: &str) -> &str {
    path.rsplit('/').next().unwrap_or(path)
}

fn looks_like_uuid(s: &str) -> bool {
    s.len() == 36 && s.chars().all(|c| c.is_ascii_hexdigit() || c == '-')
}

fn cached_parse(cache: &ClaudeSessionCache, path: &Path, id: &str) -> Option<ClaudeSessionInfo> {
    let meta = std::fs::metadata(path).ok()?;
    let mtime = meta.modified().ok()?;
    let size = meta.len();
    if let Ok(map) = cache.0.lock() {
        if let Some((m, s, info)) = map.get(path) {
            if *m == mtime && *s == size {
                return Some(info.clone());
            }
        }
    }
    let info = parse_transcript(path, id).ok()?;
    if let Ok(mut map) = cache.0.lock() {
        map.insert(path.to_path_buf(), (mtime, size, info.clone()));
    }
    Some(info)
}

fn safe_session_id(id: &str) -> Option<String> {
    let safe: String = id.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '-').collect();
    if safe.is_empty() { None } else { Some(safe) }
}

/// Lists the Claude Code sessions recorded for a working directory (newest first).
#[tauri::command]
pub async fn claude_sessions_list(
    cache: State<'_, ClaudeSessionCache>,
    cwd: Option<String>,
) -> Result<Vec<ClaudeSessionInfo>, String> {
    let dir = project_dir_for(&effective_cwd(cwd));
    let Ok(entries) = std::fs::read_dir(&dir) else { return Ok(Vec::new()) };
    let live = live_session_ids();
    let mut sessions = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
            continue;
        }
        let Some(stem) = path.file_stem().and_then(|s| s.to_str()) else { continue };
        if let Some(mut info) = cached_parse(&cache, &path, stem) {
            // Sessions that never received a prompt are invisible to --resume.
            if info.turns == 0 {
                continue;
            }
            info.live = live.iter().any(|l| l == stem);
            sessions.push(info);
        }
    }
    sessions.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    Ok(sessions)
}

/// Tells the frontend whether a session id can be resumed in the cwd's
/// project dir, is taken by an empty transcript, or is still free.
#[tauri::command]
pub async fn claude_session_state(
    cache: State<'_, ClaudeSessionCache>,
    cwd: Option<String>,
    id: String,
) -> Result<ClaudeSessionState, String> {
    let Some(safe) = safe_session_id(&id) else { return Ok(ClaudeSessionState::None) };
    let path = project_dir_for(&effective_cwd(cwd)).join(format!("{}.jsonl", safe));
    if !path.is_file() {
        return Ok(ClaudeSessionState::None);
    }
    match cached_parse(&cache, &path, &safe) {
        Some(info) if info.turns > 0 => Ok(ClaudeSessionState::Resumable),
        _ => Ok(ClaudeSessionState::Empty),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encodes_cwd_like_claude_code() {
        assert_eq!(encode_project_dir("/Users/me/brs-agentspace/core"), "-Users-me-brs-agentspace-core");
        assert_eq!(encode_project_dir("/tmp/a.b_c d"), "-tmp-a-b-c-d");
    }

    /// Manual check against this machine's transcripts:
    /// `cargo test real_project_dir -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn real_project_dir() {
        let cwd = std::env::var("AGENTSPACE_TEST_CWD").unwrap_or_else(|_| home_dir().to_string_lossy().to_string());
        let dir = project_dir_for(&cwd);
        let cache = ClaudeSessionCache::default();
        let mut n = 0;
        for entry in std::fs::read_dir(&dir).expect("project dir").flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("jsonl") { continue; }
            let stem = path.file_stem().and_then(|s| s.to_str()).unwrap().to_string();
            if let Some(info) = cached_parse(&cache, &path, &stem) {
                n += 1;
                println!(
                    "{} | {:<40} | turns={:<3} asst={:<4} ctx={:<7} in={:<8} cr={:<9} out={:<7} | {} | {}",
                    &stem[..8], truncate(&info.title, 40), info.turns, info.assistant_messages,
                    info.context_tokens, info.total_input_tokens, info.total_cache_read_tokens,
                    info.total_output_tokens, info.modified_at, truncate(&info.last_prompt, 50)
                );
            }
        }
        println!("live: {:?}", live_session_ids());
        assert!(n > 0);
    }

    #[test]
    fn detects_uuid_shapes() {
        assert!(looks_like_uuid("6feed73e-659d-44ab-a551-1d0d8412f962"));
        assert!(!looks_like_uuid("claude"));
    }
}
