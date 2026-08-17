// AgentSpace — CLI Engine Module
// Handles detection, authentication check, and spawning of CLI AI engines.
// Supports: claude (Anthropic), codex (OpenAI), gemini (Google)
// All run via user's existing subscriptions — NO API keys.

use std::process::Command;
use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CliEngineInfo {
    pub id: String,
    pub binary: String,
    pub version: Option<String>,
    pub path: Option<String>,
    pub available: bool,
    pub auth_status: Option<String>,
}

/// Detect all available CLI engines in PATH
pub fn detect_engines() -> Vec<CliEngineInfo> {
    let engines = vec![
        ("claude", "claude"),
        ("codex", "codex"),
        ("gemini", "gemini"),
    ];

    engines
        .iter()
        .map(|(id, binary)| {
            let path = which_binary(binary);
            let available = path.is_some();
            let version = if available {
                get_version(binary)
            } else {
                None
            };

            CliEngineInfo {
                id: id.to_string(),
                binary: binary.to_string(),
                version,
                path,
                available,
                auth_status: None,
            }
        })
        .collect()
}

/// Find binary path using `which`
fn which_binary(name: &str) -> Option<String> {
    let output = Command::new("which").arg(name).output().ok()?;
    if output.status.success() {
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !path.is_empty() {
            return Some(path);
        }
    }
    None
}

/// Get CLI version string
fn get_version(binary: &str) -> Option<String> {
    let output = Command::new(binary)
        .arg("--version")
        .output()
        .ok()?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let raw = if !stdout.is_empty() { stdout } else { stderr };
        // Extract first non-empty line
        return raw.lines().find(|l| !l.trim().is_empty()).map(|s| s.trim().to_string());
    }
    None
}

/// Build the CLI command args for a given engine + prompt
/// Returns (binary, args) ready for Command::new
pub fn build_command(engine: &str, prompt: &str, workdir: Option<&str>) -> Option<(String, Vec<String>)> {
    match engine {
        "claude" => {
            let mut args = vec![
                "-p".to_string(),
                prompt.to_string(),
                "--dangerously-skip-permissions".to_string(),
            ];
            if let Some(dir) = workdir {
                args.push("--cwd".to_string());
                args.push(dir.to_string());
            }
            Some(("claude".to_string(), args))
        }
        "codex" => {
            let mut args = vec![
                "--approval-mode".to_string(),
                "full-auto".to_string(),
                prompt.to_string(),
            ];
            if let Some(dir) = workdir {
                args.push("--cwd".to_string());
                args.push(dir.to_string());
            }
            Some(("codex".to_string(), args))
        }
        "gemini" => {
            // gemini CLI: gemini -p "prompt"
            let mut args = vec![
                "-p".to_string(),
                prompt.to_string(),
            ];
            if let Some(dir) = workdir {
                args.push("--workdir".to_string());
                args.push(dir.to_string());
            }
            Some(("gemini".to_string(), args))
        }
        _ => None,
    }
}
