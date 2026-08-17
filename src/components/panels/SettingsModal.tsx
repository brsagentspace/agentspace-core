import { useState, useEffect } from 'react';
import { X, Settings, Terminal, CheckCircle2, XCircle, Loader2, RefreshCw, Zap, ChevronRight } from 'lucide-react';
import { useSettingsStore, type EngineId } from '../../store/settingsStore';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Engine display metadata
const ENGINE_META: Record<EngineId, { label: string; company: string; color: string; flagHint: string }> = {
  claude: {
    label: 'Claude',
    company: 'Anthropic',
    color: '#d4a27a',
    flagHint: '--dangerously-skip-permissions',
  },
  codex: {
    label: 'Codex',
    company: 'OpenAI',
    color: '#10a37f',
    flagHint: '--approval-mode full-auto',
  },
  gemini: {
    label: 'Gemini',
    company: 'Google',
    color: '#4285f4',
    flagHint: '',
  },
  custom: {
    label: 'Custom CLI',
    company: 'User-defined',
    color: '#888',
    flagHint: '',
  },
};

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const {
    activeEngine,
    engines,
    setActiveEngine,
    updateEngineConfig,
    detectEngines,
  } = useSettingsStore();

  const [selectedTab, setSelectedTab] = useState<EngineId>(activeEngine);
  const [detecting, setDetecting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Run detection on open
  useEffect(() => {
    if (isOpen) {
      handleDetect();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDetect = async () => {
    setDetecting(true);
    setTestResult(null);
    await detectEngines();
    setDetecting(false);
  };

  const handleActivate = (id: EngineId) => {
    setActiveEngine(id);
    setSelectedTab(id);
  };

  const current = engines[selectedTab];
  const meta = ENGINE_META[selectedTab];

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true">
      <div className="settings-modal settings-modal--cli">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="settings-header">
          <div className="settings-header__title">
            <Terminal size={16} className="settings-icon--accent" />
            <h3>CLI Engine Configuration</h3>
            <span className="settings-header__sub">Subscription-based · No API keys</span>
          </div>
          <button type="button" className="settings-close-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────── */}
        <div className="settings-body">
          {/* Sidebar */}
          <div className="settings-sidebar">
            <div className="settings-sidebar-title">
              Engines
              <button
                className="settings-detect-btn"
                onClick={handleDetect}
                disabled={detecting}
                title="Re-detect installed CLIs"
              >
                {detecting ? <Loader2 size={12} className="spin" /> : <RefreshCw size={12} />}
              </button>
            </div>

            {(Object.keys(ENGINE_META) as EngineId[]).map((id) => {
              const eng = engines[id];
              const m = ENGINE_META[id];
              const isActive = activeEngine === id;
              const isSelected = selectedTab === id;

              return (
                <button
                  key={id}
                  className={`settings-tab ${isSelected ? 'active' : ''}`}
                  onClick={() => setSelectedTab(id)}
                >
                  <div className="tab-left">
                    <div
                      className={`status-dot ${eng.available ? (isActive ? 'active-dot' : 'available-dot') : 'unavailable-dot'}`}
                      title={eng.available ? (isActive ? 'Active' : 'Available') : 'Not found'}
                    />
                    <div className="tab-info">
                      <span className="tab-engine-name">{m.label}</span>
                      <span className="tab-engine-company">{m.company}</span>
                    </div>
                  </div>
                  <div className="tab-right">
                    {eng.available ? (
                      <CheckCircle2 size={12} style={{ color: m.color }} />
                    ) : (
                      <XCircle size={12} style={{ color: '#555' }} />
                    )}
                    <ChevronRight size={12} />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="settings-content">
            {/* Engine header */}
            <div className="settings-content-header">
              <div className="engine-title-row">
                <div className="engine-color-dot" style={{ background: meta.color }} />
                <h4>{meta.label}</h4>
                <span className="engine-company">{meta.company}</span>
              </div>
              <div className="engine-actions">
                {activeEngine !== selectedTab ? (
                  <button
                    className="btn-activate"
                    onClick={() => handleActivate(selectedTab)}
                    disabled={!current.available}
                  >
                    <Zap size={12} /> Set Active
                  </button>
                ) : (
                  <span className="badge-active">● Active Engine</span>
                )}
              </div>
            </div>

            {/* Detection status */}
            <div className={`engine-status-card ${current.available ? 'status-ok' : 'status-missing'}`}>
              {current.available ? (
                <>
                  <CheckCircle2 size={14} />
                  <div className="status-details">
                    <div className="status-main">Found — {current.cliVersion || 'version unknown'}</div>
                    <div className="status-path">{current.cliPath}</div>
                  </div>
                </>
              ) : (
                <>
                  <XCircle size={14} />
                  <div className="status-details">
                    <div className="status-main">Not found in PATH</div>
                    <div className="status-path">
                      {selectedTab === 'claude' && 'Install: npm install -g @anthropic-ai/claude-code'}
                      {selectedTab === 'codex'  && 'Install: npm install -g @openai/codex'}
                      {selectedTab === 'gemini' && 'Install: npm install -g @google/gemini-cli'}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Auth mode note */}
            <div className="settings-info-box">
              <Settings size={13} />
              <span>
                Authenticates using your existing <strong>{meta.company}</strong> subscription via OAuth.
                No API keys required. Run <code>{meta.label.toLowerCase()} auth login</code> in terminal
                if not already logged in.
              </span>
            </div>

            {/* Extra flags */}
            <div className="settings-form-group">
              <label>
                <Terminal size={13} />
                Extra CLI Flags
              </label>
              <input
                type="text"
                placeholder={meta.flagHint || 'e.g. --verbose'}
                value={current.extraFlags}
                onChange={(e) => updateEngineConfig(selectedTab, { extraFlags: e.target.value })}
                className="cli-flags-input"
              />
              <p className="help-text">
                Appended to every invocation. For {meta.label}:{' '}
                <code>{meta.flagHint || 'none required'}</code>
              </p>
            </div>

            {/* Model override */}
            <div className="settings-form-group">
              <label>
                <Zap size={13} />
                Model Override <span className="label-optional">(optional)</span>
              </label>
              <input
                type="text"
                placeholder={
                  selectedTab === 'claude' ? 'claude-opus-4-5' :
                  selectedTab === 'codex'  ? 'gpt-4o' :
                  selectedTab === 'gemini' ? 'gemini-2.5-pro' :
                  'model-id'
                }
                value={current.defaultModel}
                onChange={(e) => updateEngineConfig(selectedTab, { defaultModel: e.target.value })}
              />
              <p className="help-text">Leave empty to use the CLI's default model.</p>
            </div>

            {/* Custom CLI path (only for custom engine) */}
            {selectedTab === 'custom' && (
              <div className="settings-form-group">
                <label>
                  <Terminal size={13} />
                  CLI Binary Path
                </label>
                <input
                  type="text"
                  placeholder="/usr/local/bin/my-ai-cli"
                  value={current.cliPath}
                  onChange={(e) => updateEngineConfig('custom', { cliPath: e.target.value })}
                />
              </div>
            )}

            {/* Test result */}
            {testResult && (
              <div className="test-result-box">
                <pre>{testResult}</pre>
              </div>
            )}

            <div className="settings-auto-save">
              <CheckCircle2 size={13} />
              Settings saved automatically to local storage
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
