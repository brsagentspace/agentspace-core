// AgentSpace — Markdown Vault Scanner
// Reads a folder of markdown notes so the frontend can turn them into
// memory-graph nodes (file = node, [[wikilink]] = relation). Only the
// path is ever persisted by the app; contents stay on this machine.

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

/// Folders that never hold notes worth indexing.
const SKIP_DIRS: &[&str] = &[
    "node_modules", "target", "dist", "build", "out", "work", "models", "public", "__pycache__",
];
/// Notes larger than this are truncated (a 200 KB markdown is not a note).
const MAX_FILE_BYTES: usize = 200 * 1024;
const MAX_DEPTH: usize = 6;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultFile {
    pub rel_path: String,
    pub content: String,
    pub modified_ms: u64,
    pub truncated: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultScan {
    pub root: String,
    pub files: Vec<VaultFile>,
    /// True when max_files stopped the walk early.
    pub capped: bool,
}

fn is_hidden_or_skipped(path: &Path) -> bool {
    path.file_name()
        .and_then(|n| n.to_str())
        .map(|n| n.starts_with('.') || SKIP_DIRS.contains(&n))
        .unwrap_or(true)
}

fn walk(dir: &Path, depth: usize, out: &mut Vec<PathBuf>, max_files: usize) -> bool {
    if depth > MAX_DEPTH {
        return false;
    }
    let Ok(entries) = fs::read_dir(dir) else { return false };
    let mut entries: Vec<_> = entries.flatten().collect();
    entries.sort_by_key(|e| e.file_name());
    for entry in entries {
        if out.len() >= max_files {
            return true;
        }
        let path = entry.path();
        if path.is_dir() {
            if !is_hidden_or_skipped(&path) && walk(&path, depth + 1, out, max_files) {
                return true;
            }
        } else if path.extension().and_then(|e| e.to_str()) == Some("md")
            && !is_hidden_or_skipped(&path)
        {
            out.push(path);
        }
    }
    false
}

#[tauri::command]
pub fn vault_scan(root: String, max_files: Option<usize>) -> Result<VaultScan, String> {
    let root_path = PathBuf::from(&root);
    if !root_path.is_dir() {
        return Err(format!("Klasör bulunamadı: {}", root));
    }
    let max_files = max_files.unwrap_or(400).clamp(1, 5000);

    let mut paths = Vec::new();
    let capped = walk(&root_path, 0, &mut paths, max_files);

    let files = paths
        .into_iter()
        .filter_map(|path| {
            let meta = fs::metadata(&path).ok()?;
            let modified_ms = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);
            let raw = fs::read(&path).ok()?;
            let truncated = raw.len() > MAX_FILE_BYTES;
            let slice = if truncated { &raw[..MAX_FILE_BYTES] } else { &raw[..] };
            let content = String::from_utf8_lossy(slice).into_owned();
            let rel_path = path
                .strip_prefix(&root_path)
                .ok()?
                .to_string_lossy()
                .replace('\\', "/");
            Some(VaultFile { rel_path, content, modified_ms, truncated })
        })
        .collect();

    Ok(VaultScan { root, files, capped })
}
