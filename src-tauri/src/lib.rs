// AgentSpace — Tauri Backend
// Exposes CLI engine commands to the frontend via Tauri IPC.

mod cli_engine;
mod pty;

use serde::{Deserialize, Serialize};
use std::process::Command;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State, Emitter};

// ─── Shared State ─────────────────────────────────────────────────────────────

pub struct ActiveEngine(pub Mutex<String>);

// ─── Tauri Commands ───────────────────────────────────────────────────────────

/// Detect which CLI engines are installed and return their info
#[tauri::command]
fn detect_cli_engines() -> Vec<cli_engine::CliEngineInfo> {
    cli_engine::detect_engines()
}

/// Run a CLI engine with a prompt, stream output back via events
#[tauri::command]
async fn run_cli_prompt(
    app: AppHandle,
    engine: String,
    prompt: String,
    workdir: Option<String>,
) -> Result<String, String> {
    let (binary, args) = cli_engine::build_command(
        &engine,
        &prompt,
        workdir.as_deref(),
    )
    .ok_or_else(|| format!("Unknown engine: {}", engine))?;

    // Emit start event
    let _ = app.emit(
        "cli-output",
        serde_json::json!({
            "engine": engine,
            "type": "start",
            "content": format!("▶ Running {} …\n", engine)
        }),
    );

    let output = Command::new(&binary)
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to run {}: {}", binary, e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !stdout.is_empty() {
        let _ = app.emit(
            "cli-output",
            serde_json::json!({
                "engine": engine,
                "type": "stdout",
                "content": stdout
            }),
        );
    }
    if !stderr.is_empty() {
        let _ = app.emit(
            "cli-output",
            serde_json::json!({
                "engine": engine,
                "type": "stderr",
                "content": stderr
            }),
        );
    }

    let _ = app.emit(
        "cli-output",
        serde_json::json!({
            "engine": engine,
            "type": "done",
            "exit_code": output.status.code()
        }),
    );

    Ok(stdout)
}

/// Set the globally active engine (persisted in app state)
#[tauri::command]
fn set_active_engine(engine: String, state: State<ActiveEngine>) -> Result<(), String> {
    let mut active = state.0.lock().map_err(|e| e.to_string())?;
    *active = engine;
    Ok(())
}

/// Get the currently active engine
#[tauri::command]
fn get_active_engine(state: State<ActiveEngine>) -> String {
    state.0.lock().map_or("claude".to_string(), |e| e.clone())
}

// ─── App Init ────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(ActiveEngine(Mutex::new("claude".to_string())))
        .manage(pty::PtyManager::default())
        .invoke_handler(tauri::generate_handler![
            detect_cli_engines,
            run_cli_prompt,
            set_active_engine,
            get_active_engine,
            pty::pty_spawn,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_kill,
        ])
        .run(tauri::generate_context!())
        .expect("error while running AgentSpace");
}
