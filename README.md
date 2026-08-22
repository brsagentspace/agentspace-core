# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Windows

Tauri 2 + WebView2; Windows 10 1809+ (ConPTY). Kurulum paketi GitHub Actions'tan gelir: **Actions → Release (Tauri) → Run workflow** →
`agentspace-windows-latest` artefaktı (`AgentSpace_x.y.z_x64-setup.exe` ve `.msi`); `v*` tag'i push edilirse taslak Release oluşur.
Yerelde Windows'ta: `npm ci && npm run tauri build` (Rust + VS Build Tools gerekir).

- Ajan panelleri **PowerShell** açar (`pwsh.exe` varsa o, yoksa `powershell.exe`); `AGENTSPACE_SHELL` ortam değişkeniyle değiştirilebilir
  (cmd.exe desteklenmez — Claude başlatma satırı `$env:AGENTSPACE_BRIEF` kullanır).
- Claude Code Windows'ta: `irm https://claude.ai/install.ps1 | iex` (native) ya da `npm i -g @anthropic-ai/claude-code`; `claude --version`
  PowerShell'de çalışıyorsa Ayarlar'da engine otomatik bulunur (`where claude`).
- Claude oturum transkriptleri `%USERPROFILE%\.claude\projects\<C--Users-...-klasör>\` altında; "Oturumlar" menüsü oradan okur.
- Bilinen sınır: Space çalışma klasörü yolu `C:\...` olduğunda hafıza haritasındaki kısa ad `/` ile bölünür (yalnız görünüm).
