import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EngineId = 'claude' | 'codex' | 'gemini' | 'custom';

/** @deprecated kept for backward compat — use EngineId instead */
export type LLMProvider = 'openai' | 'anthropic' | 'antigravity';

export interface CliEngineInfo {
  id: string;
  binary: string;
  version: string | null;
  path: string | null;
  available: boolean;
  auth_status: string | null;
}

export interface EngineConfig {
  /** Which CLI binary to call */
  id: EngineId;
  /** Resolved path from `which` */
  cliPath: string;
  /** Version string from --version */
  cliVersion: string;
  /** Whether the CLI is installed */
  available: boolean;
  /** Extra flags appended to every call */
  extraFlags: string;
  /** Optional model override (e.g. --model claude-opus-4-5) */
  defaultModel: string;
}

interface SettingsState {
  /** Currently selected engine for new terminal sessions */
  activeEngine: EngineId;
  /** Per-engine runtime config */
  engines: Record<EngineId, EngineConfig>;
  /** Detection results from Tauri backend */
  detectedEngines: CliEngineInfo[];

  // ── Actions ─────────────────────────────────────────────────────────────
  setActiveEngine: (id: EngineId) => void;
  updateEngineConfig: (id: EngineId, patch: Partial<EngineConfig>) => void;
  setDetectedEngines: (engines: CliEngineInfo[]) => void;
  detectEngines: () => Promise<void>;
  runPrompt: (engine: EngineId, prompt: string, workdir?: string) => Promise<string>;

  // ── Legacy compat ────────────────────────────────────────────────────────
  /** @deprecated use activeEngine */
  activeProvider: LLMProvider;
  /** @deprecated */
  setActiveProvider: (p: LLMProvider) => void;
}

// ─── Default configs per engine ───────────────────────────────────────────────

const DEFAULT_CONFIGS: Record<EngineId, EngineConfig> = {
  claude: {
    id: 'claude',
    cliPath: '',
    cliVersion: '',
    available: false,
    extraFlags: '--dangerously-skip-permissions',
    defaultModel: '',
  },
  codex: {
    id: 'codex',
    cliPath: '',
    cliVersion: '',
    available: false,
    extraFlags: '--approval-mode full-auto',
    defaultModel: '',
  },
  gemini: {
    id: 'gemini',
    cliPath: '',
    cliVersion: '',
    available: false,
    extraFlags: '',
    defaultModel: '',
  },
  custom: {
    id: 'custom',
    cliPath: '',
    cliVersion: '',
    available: false,
    extraFlags: '',
    defaultModel: '',
  },
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      activeEngine: 'claude',
      engines: { ...DEFAULT_CONFIGS },
      detectedEngines: [],

      // Legacy
      activeProvider: 'anthropic',
      setActiveProvider: (p) => {
        const map: Record<LLMProvider, EngineId> = {
          anthropic: 'claude',
          openai: 'codex',
          antigravity: 'gemini',
        };
        set({ activeProvider: p, activeEngine: map[p] });
      },

      setActiveEngine: (id) => {
        set({ activeEngine: id });
        // Sync to Tauri backend
        invoke('set_active_engine', { engine: id }).catch(console.warn);
      },

      updateEngineConfig: (id, patch) =>
        set((state) => ({
          engines: {
            ...state.engines,
            [id]: { ...state.engines[id], ...patch },
          },
        })),

      setDetectedEngines: (detected) => {
        // Merge detection results into engine configs
        set((state) => {
          const updatedEngines = { ...state.engines };
          for (const info of detected) {
            const id = info.id as EngineId;
            if (updatedEngines[id] !== undefined) {
              updatedEngines[id] = {
                ...updatedEngines[id],
                available: info.available,
                cliPath: info.path ?? '',
                cliVersion: info.version ?? '',
              };
            }
          }
          return { engines: updatedEngines, detectedEngines: detected };
        });
      },

      detectEngines: async () => {
        try {
          const detected = await invoke<CliEngineInfo[]>('detect_cli_engines');
          get().setDetectedEngines(detected);
        } catch (e) {
          // Running in browser dev mode without Tauri — mock results
          const mock: CliEngineInfo[] = [
            { id: 'claude',  binary: 'claude',  version: '2.1.233', path: '/Users/hasanbarisgok/.local/bin/claude', available: true,  auth_status: null },
            { id: 'codex',   binary: 'codex',   version: '0.142.5', path: '/Users/hasanbarisgok/.local/bin/codex',  available: true,  auth_status: null },
            { id: 'gemini',  binary: 'gemini',  version: null,      path: '/opt/homebrew/bin/gemini',              available: true,  auth_status: null },
            { id: 'custom',  binary: '',         version: null,      path: null,                                    available: false, auth_status: null },
          ];
          get().setDetectedEngines(mock);
        }
      },

      runPrompt: async (engine, prompt, workdir) => {
        return invoke<string>('run_cli_prompt', { engine, prompt, workdir });
      },
    }),
    {
      name: 'agentspace-engine-settings',
      storage: createJSONStorage(() => localStorage),
      // Don't persist detectedEngines (re-detected on each launch)
      partialize: (state) => ({
        activeEngine: state.activeEngine,
        engines: state.engines,
      }),
    }
  )
);
