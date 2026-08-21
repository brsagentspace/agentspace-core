/**
 * @file closeGuard.ts
 * @description Asks before the window closes while terminals are running.
 *
 * Cmd+W / the red traffic light would otherwise kill every PTY — Claude Code
 * and Codex sessions included — without a word. The guard counts live
 * terminals across all Spaces (background ones too) and lets the user back
 * out. Installed once from main.tsx; a no-op in the browser demo.
 *
 * @module services
 */

import { IS_TAURI } from './platform';
import { totalLiveTerminals } from '../components/terminal/terminalRegistry';

let installed = false;

export async function installCloseGuard(): Promise<void> {
  if (!IS_TAURI || installed) return;
  installed = true;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const { ask } = await import('@tauri-apps/plugin-dialog');
  await getCurrentWindow().onCloseRequested(async (event) => {
    const n = totalLiveTerminals();
    if (n === 0) return;
    const ok = await ask(
      `${n} terminal hâlâ çalışıyor (arka plandaki Space'ler dahil). Pencere kapanınca içlerindeki Claude/Codex süreçleri sonlanır.\n\nYine de kapatılsın mı?`,
      { title: 'AgentSpace', kind: 'warning', okLabel: 'Kapat', cancelLabel: 'Vazgeç' },
    );
    if (!ok) event.preventDefault();
  });
}
