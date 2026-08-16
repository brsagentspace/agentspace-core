import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type LLMProvider = 'openai' | 'anthropic' | 'antigravity';

interface ProviderSettings {
  apiKey: string;
  defaultModel: string;
}

interface SettingsState {
  activeProvider: LLMProvider;
  providers: Record<LLMProvider, ProviderSettings>;
  setActiveProvider: (provider: LLMProvider) => void;
  setApiKey: (provider: LLMProvider, key: string) => void;
  setDefaultModel: (provider: LLMProvider, model: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      activeProvider: 'antigravity',
      providers: {
        openai: { apiKey: '', defaultModel: 'gpt-4o' },
        anthropic: { apiKey: '', defaultModel: 'claude-3-5-sonnet-20240620' },
        antigravity: { apiKey: '', defaultModel: 'gemini-1.5-pro' },
      },
      setActiveProvider: (provider) => set({ activeProvider: provider }),
      setApiKey: (provider, key) =>
        set((state) => ({
          providers: {
            ...state.providers,
            [provider]: { ...state.providers[provider], apiKey: key },
          },
        })),
      setDefaultModel: (provider, model) =>
        set((state) => ({
          providers: {
            ...state.providers,
            [provider]: { ...state.providers[provider], defaultModel: model },
          },
        })),
    }),
    {
      name: 'agentspace-llm-settings', // unique name in localStorage
      storage: createJSONStorage(() => localStorage),
    }
  )
);
