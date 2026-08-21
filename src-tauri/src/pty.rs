// AgentSpace — PTY Module
// Real shell sessions for the terminal workspace (portable-pty).
// Each session id owns one PTY + shell child; output streams to the
// frontend via `pty-output` events, exits via `pty-exit`.

use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde_json::json;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

pub struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
    /// Agent brief handed to the CLI engine (removed when the session dies).
    brief_path: Option<PathBuf>,
}

#[derive(Default)]
pub struct PtyManager(pub Mutex<HashMap<String, PtySession>>);

/// Shell program + args for a new pane.
/// POSIX: `$SHELL -l` (login shell so PATH/rc files load as in Terminal.app).
/// Windows: `AGENTSPACE_SHELL` if set, else PowerShell 7 (`pwsh`) when on
/// PATH, else Windows PowerShell — the launch line typed by the frontend
/// uses `$env:` syntax, so cmd.exe is not a default.
#[cfg(not(windows))]
fn default_shell() -> (String, Vec<String>) {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    (shell, vec!["-l".to_string()])
}

#[cfg(windows)]
fn default_shell() -> (String, Vec<String>) {
    if let Ok(custom) = std::env::var("AGENTSPACE_SHELL") {
        if !custom.trim().is_empty() {
            return (custom, Vec::new());
        }
    }
    let has_pwsh = std::env::var_os("PATH")
        .map(|p| std::env::split_paths(&p).any(|d| d.join("pwsh.exe").is_file()))
        .unwrap_or(false);
    let shell = if has_pwsh { "pwsh.exe" } else { "powershell.exe" };
    (shell.to_string(), vec!["-NoLogo".to_string()])
}

/// Length of the incomplete UTF-8 sequence at the end of `buf` (0..=3).
///
/// PTY reads cut the byte stream anywhere, so a multi-byte character (Turkish
/// letters are 2 bytes, box drawing 3, emoji 4) regularly straddles two reads.
/// Decoding each read on its own turned those into U+FFFD — and a 2-cell emoji
/// becoming several 1-cell replacement glyphs shifts the cursor, which is what
/// TUI apps (Claude Code, Codex) then paint their whole frame around.
fn incomplete_utf8_tail(buf: &[u8]) -> usize {
    for back in 1..=buf.len().min(3) {
        let b = buf[buf.len() - back];
        if b & 0b1100_0000 == 0b1000_0000 {
            continue; // continuation byte — keep looking for the lead byte
        }
        let need = match b {
            b if b & 0b1110_0000 == 0b1100_0000 => 2,
            b if b & 0b1111_0000 == 0b1110_0000 => 3,
            b if b & 0b1111_1000 == 0b1111_0000 => 4,
            _ => 1,
        };
        return if need > back { back } else { 0 };
    }
    0
}

/// Session ids come from the frontend; keep the brief file name boring.
fn safe_file_stem(id: &str) -> String {
    id.chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect()
}

/// Writes the agent brief to `$TMPDIR/agentspace/briefs/<id>.md` and returns
/// its path. The CLI engine reads it via `$AGENTSPACE_BRIEF`.
fn write_brief(id: &str, brief: &str) -> Result<PathBuf, String> {
    let dir = std::env::temp_dir().join("agentspace").join("briefs");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(format!("{}.md", safe_file_stem(id)));
    std::fs::write(&path, brief).map_err(|e| e.to_string())?;
    Ok(path)
}

#[tauri::command]
pub fn pty_spawn(
    app: AppHandle,
    state: State<PtyManager>,
    id: String,
    cols: u16,
    rows: u16,
    cwd: Option<String>,
    env: Option<HashMap<String, String>>,
    brief: Option<String>,
) -> Result<(), String> {
    let mut sessions = state.0.lock().map_err(|e| e.to_string())?;
    if sessions.contains_key(&id) {
        return Ok(());
    }

    let pty = native_pty_system()
        .openpty(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
        .map_err(|e| e.to_string())?;

    let (shell, shell_args) = default_shell();
    let mut cmd = CommandBuilder::new(shell);
    for arg in shell_args {
        cmd.arg(arg);
    }
    // The emulator is xterm.js with truecolor, whatever launched the app
    // (from the Dock there is no TERM/LANG at all; from tmux the wrong TERM).
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    cmd.env("TERM_PROGRAM", "AgentSpace");
    cmd.env_remove("TMUX");
    if std::env::var_os("LANG").is_none() && std::env::var_os("LC_ALL").is_none() {
        cmd.env("LANG", "en_US.UTF-8");
    }
    // Space / agent context for whatever runs inside the shell.
    for (key, value) in env.unwrap_or_default() {
        cmd.env(key, value);
    }
    let brief_path = match brief {
        Some(text) => {
            let path = write_brief(&id, &text)?;
            cmd.env("AGENTSPACE_BRIEF", path.as_os_str());
            Some(path)
        }
        None => None,
    };
    // Space working folder → shell cwd. A missing folder falls back to the
    // user's home so the pane still opens; the frontend is told why.
    if let Some(dir) = cwd {
        if std::path::Path::new(&dir).is_dir() {
            cmd.cwd(dir);
        } else {
            let _ = app.emit(
                "pty-output",
                json!({
                    "id": id,
                    "data": format!("\x1b[38;2;251;191;36m⚠ Çalışma klasörü bulunamadı: {} — ev dizininde açıldı.\x1b[0m\r\n", dir)
                }),
            );
        }
    }

    let child = pty.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pty.slave);

    let mut reader = pty.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pty.master.take_writer().map_err(|e| e.to_string())?;

    // Reader thread: stream chunks to the frontend until EOF.
    let reader_id = id.clone();
    let reader_app = app.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        // Bytes of a character cut off by the previous read, completed by the next.
        let mut pending: Vec<u8> = Vec::new();
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    pending.extend_from_slice(&buf[..n]);
                    let cut = pending.len() - incomplete_utf8_tail(&pending);
                    if cut == 0 {
                        continue;
                    }
                    let data = String::from_utf8_lossy(&pending[..cut]).into_owned();
                    pending.drain(..cut);
                    let _ = reader_app.emit("pty-output", json!({ "id": reader_id, "data": data }));
                }
            }
        }
        if !pending.is_empty() {
            let data = String::from_utf8_lossy(&pending).into_owned();
            let _ = reader_app.emit("pty-output", json!({ "id": reader_id, "data": data }));
        }
        let _ = reader_app.emit("pty-exit", json!({ "id": reader_id }));
    });

    sessions.insert(id, PtySession { master: pty.master, writer, child, brief_path });
    Ok(())
}

#[tauri::command]
pub fn pty_write(state: State<PtyManager>, id: String, data: String) -> Result<(), String> {
    let mut sessions = state.0.lock().map_err(|e| e.to_string())?;
    let session = sessions.get_mut(&id).ok_or("unknown pty session")?;
    session.writer.write_all(data.as_bytes()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pty_resize(state: State<PtyManager>, id: String, cols: u16, rows: u16) -> Result<(), String> {
    let sessions = state.0.lock().map_err(|e| e.to_string())?;
    let session = sessions.get(&id).ok_or("unknown pty session")?;
    session
        .master
        .resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pty_kill(state: State<PtyManager>, id: String) -> Result<(), String> {
    let mut sessions = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(mut session) = sessions.remove(&id) {
        let _ = session.child.kill();
        if let Some(path) = session.brief_path.take() {
            let _ = std::fs::remove_file(path);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::incomplete_utf8_tail;

    #[test]
    fn complete_ascii_has_no_tail() {
        assert_eq!(incomplete_utf8_tail(b"hello"), 0);
        assert_eq!(incomplete_utf8_tail(b""), 0);
    }

    #[test]
    fn complete_multibyte_has_no_tail() {
        assert_eq!(incomplete_utf8_tail("başlamış".as_bytes()), 0);
        assert_eq!(incomplete_utf8_tail("⏺ ok ✅".as_bytes()), 0);
        assert_eq!(incomplete_utf8_tail("🤔".as_bytes()), 0);
    }

    #[test]
    fn cut_sequences_are_held_back() {
        let s = "ş".as_bytes(); // 2 bytes
        assert_eq!(incomplete_utf8_tail(&s[..1]), 1);
        let e = "✅".as_bytes(); // 3 bytes
        assert_eq!(incomplete_utf8_tail(&e[..1]), 1);
        assert_eq!(incomplete_utf8_tail(&e[..2]), 2);
        let m = "🤔".as_bytes(); // 4 bytes
        assert_eq!(incomplete_utf8_tail(&m[..1]), 1);
        assert_eq!(incomplete_utf8_tail(&m[..2]), 2);
        assert_eq!(incomplete_utf8_tail(&m[..3]), 3);
        let mut text = b"abc ".to_vec();
        text.extend_from_slice(&m[..2]);
        assert_eq!(incomplete_utf8_tail(&text), 2);
    }

    #[test]
    fn stray_continuation_bytes_are_flushed_not_held() {
        assert_eq!(incomplete_utf8_tail(&[0x80, 0x80, 0x80, 0x80]), 0);
    }
}
