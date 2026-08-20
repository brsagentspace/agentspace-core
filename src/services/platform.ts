/**
 * @file platform.ts
 * @description Host-platform helpers: Tauri detection and native dialogs
 * with graceful browser fallbacks.
 *
 * @module services
 */

export const IS_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/**
 * Opens a native folder picker. Returns the chosen absolute path, or null
 * when cancelled / unavailable (browser demo).
 */
export async function pickDirectory(defaultPath?: string): Promise<string | null> {
  if (!IS_TAURI) return null;
  const { open } = await import('@tauri-apps/plugin-dialog');
  const picked = await open({ directory: true, multiple: false, defaultPath });
  return typeof picked === 'string' ? picked : null;
}
