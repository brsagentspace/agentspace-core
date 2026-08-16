import React, { useState } from 'react';
import { X, Settings, Key, Bot, ChevronRight, Save } from 'lucide-react';
import { useSettingsStore, LLMProvider } from '../../store/settingsStore';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { activeProvider, providers, setActiveProvider, setApiKey, setDefaultModel } = useSettingsStore();
  
  // Local state for the tabs
  const [selectedTab, setSelectedTab] = useState<LLMProvider>(activeProvider);

  if (!isOpen) return null;

  const handleProviderSelect = (provider: LLMProvider) => {
    setActiveProvider(provider);
    setSelectedTab(provider);
  };

  const getProviderTitle = (provider: LLMProvider) => {
    switch (provider) {
      case 'openai': return 'OpenAI (Codex/GPT)';
      case 'anthropic': return 'Anthropic (Claude)';
      case 'antigravity': return 'Google (Antigravity/Gemini)';
    }
  };

  const currentSettings = providers[selectedTab];

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true">
      <div className="settings-modal">
        {/* Header */}
        <div className="settings-header">
          <div className="settings-header__title">
            <Settings size={18} className="settings-icon--accent" />
            <h3>AgentSpace LLM Configuration</h3>
          </div>
          <button type="button" className="settings-close-btn" onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="settings-body">
          {/* Sidebar Tabs */}
          <div className="settings-sidebar">
            <div className="settings-sidebar-title">Providers</div>
            
            <button 
              className={`settings-tab ${selectedTab === 'antigravity' ? 'active' : ''}`}
              onClick={() => setSelectedTab('antigravity')}
            >
              <div className="tab-left">
                <div className={`status-dot ${activeProvider === 'antigravity' ? 'active-dot' : ''}`}></div>
                Google (Antigravity)
              </div>
              <ChevronRight size={14} />
            </button>

            <button 
              className={`settings-tab ${selectedTab === 'anthropic' ? 'active' : ''}`}
              onClick={() => setSelectedTab('anthropic')}
            >
              <div className="tab-left">
                <div className={`status-dot ${activeProvider === 'anthropic' ? 'active-dot' : ''}`}></div>
                Anthropic (Claude)
              </div>
              <ChevronRight size={14} />
            </button>

            <button 
              className={`settings-tab ${selectedTab === 'openai' ? 'active' : ''}`}
              onClick={() => setSelectedTab('openai')}
            >
              <div className="tab-left">
                <div className={`status-dot ${activeProvider === 'openai' ? 'active-dot' : ''}`}></div>
                OpenAI (Codex/GPT)
              </div>
              <ChevronRight size={14} />
            </button>
            
          </div>

          {/* Content Area */}
          <div className="settings-content">
            <div className="settings-content-header">
              <h4>{getProviderTitle(selectedTab)} Settings</h4>
              {activeProvider !== selectedTab && (
                <button 
                  className="btn-activate" 
                  onClick={() => handleProviderSelect(selectedTab)}
                >
                  Set as Active Provider
                </button>
              )}
              {activeProvider === selectedTab && (
                <span className="badge-active">Active Provider</span>
              )}
            </div>

            <div className="settings-form-group">
              <label>
                <Key size={14} /> API Key
              </label>
              <input 
                type="password" 
                placeholder={`Enter your ${selectedTab} API key...`}
                value={currentSettings.apiKey}
                onChange={(e) => setApiKey(selectedTab, e.target.value)}
              />
              <p className="help-text">Stored locally in your browser. Never sent to our servers.</p>
            </div>

            <div className="settings-form-group">
              <label>
                <Bot size={14} /> Default Model
              </label>
              <input 
                type="text" 
                placeholder="e.g. gpt-4o, claude-3-5-sonnet-20240620"
                value={currentSettings.defaultModel}
                onChange={(e) => setDefaultModel(selectedTab, e.target.value)}
              />
              <p className="help-text">The default reasoning engine used by the orchestrator.</p>
            </div>

            {/* Visual Save Confirmation */}
            <div className="settings-auto-save">
              <Save size={14} /> Changes are automatically saved to local storage
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
