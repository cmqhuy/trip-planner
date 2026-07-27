import { useState, useEffect } from 'react';
import { Sparkles, Key, RefreshCw, CheckCircle2, XCircle, Plus, Trash2, Bot, BotOff } from 'lucide-react';
import Modal from './Modal';
import { GeminiService } from '../utils/ai';
import type { AiMode } from '../utils/ai';

interface AiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  isGoogleSignedIn: boolean;
}

export default function AiSettingsModal({
  isOpen,
  onClose,
  onSaved,
  isGoogleSignedIn
}: AiSettingsModalProps) {
  const [aiMode, setAiMode] = useState<AiMode>('none');
  const [keys, setKeys] = useState<string[]>(['']);
  const [model, setModel] = useState('gemini-2.5-flash');
  const [syncToDrive, setSyncToDrive] = useState(false);
  const [maxConcurrent, setMaxConcurrent] = useState(1);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setAiMode(GeminiService.getAiMode());
      const savedKeys = GeminiService.getApiKeys();
      setKeys(savedKeys.length > 0 ? savedKeys : ['']);
      setModel(GeminiService.getSelectedModel());
      setSyncToDrive(GeminiService.getSyncToDrive());
      setMaxConcurrent(GeminiService.getMaxConcurrentRequests());
      setTestStatus('idle');
      setTestMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    const activeKeys = keys.map(k => k.trim()).filter(Boolean);
    if (activeKeys.length === 0) {
      setTestStatus('error');
      setTestMessage('Please enter at least one API key first.');
      return;
    }
    setTestStatus('testing');
    setTestMessage('Testing connectivity with first key...');
    const success = await GeminiService.testConnection(activeKeys[0]);
    if (success) {
      setTestStatus('success');
      setTestMessage('Successfully connected to Gemini API!');
    } else {
      setTestStatus('error');
      setTestMessage('Connection failed. Please check your API key and network connection.');
    }
  };

  const handleSave = () => {
    GeminiService.saveAiMode(aiMode);
    if (aiMode === 'live') {
      const activeKeys = keys.map(k => k.trim()).filter(Boolean);
      GeminiService.saveApiKeys(activeKeys);
      GeminiService.saveSelectedModel(model);
      GeminiService.setSyncToDrive(syncToDrive && isGoogleSignedIn);
      GeminiService.saveMaxConcurrentRequests(maxConcurrent);
    }
    onSaved();
    onClose();
  };

  return (
    <Modal
      title={<><Sparkles size={18} className="text-accent" /> AI Settings</>}
      titleClassName="modal-header-title"
      onClose={onClose}
      className="modal-content--md"
    >
        <div className="modal-scroll-body modal-scroll-body--mt12">
          <p className="modal-body-intro modal-body-intro--mb16">
            Choose how AI features work.
          </p>

          <div className="ai-mode-sections">

            {/* Section 1: No AI */}
            <label className={`ai-mode-section ${aiMode === 'none' ? 'ai-mode-section--selected ai-mode-section--selected-none' : ''}`}>
              <input
                type="radio"
                name="aiMode"
                className="ai-mode-radio"
                checked={aiMode === 'none'}
                onChange={() => setAiMode('none')}
              />
              <span className="ai-mode-radio-indicator" />
              <BotOff size={18} className="ai-mode-section-icon ai-mode-section-icon--none" />
              <div className="ai-mode-section-info">
                <strong className="ai-mode-section-title">No AI Integration</strong>
                <span className="ai-mode-section-desc">All AI features are hidden. No prompts or API calls.</span>
              </div>
            </label>

            {/* Section 2: Manual Mode */}
            <label className={`ai-mode-section ${aiMode === 'manual' ? 'ai-mode-section--selected ai-mode-section--selected-manual' : ''}`}>
              <input
                type="radio"
                name="aiMode"
                className="ai-mode-radio"
                checked={aiMode === 'manual'}
                onChange={() => setAiMode('manual')}
              />
              <span className="ai-mode-radio-indicator" />
              <Bot size={18} className="ai-mode-section-icon ai-mode-section-icon--manual" />
              <div className="ai-mode-section-info">
                <strong className="ai-mode-section-title">Manual Mode (No API Key Needed)</strong>
                <span className="ai-mode-section-desc">Shows the AI prompt so you can paste it into ChatGPT, Claude, Gemini, or any chatbot. Paste the response back to apply it.</span>
              </div>
            </label>

            {/* Section 3: Live Gemini */}
            <div className={`ai-mode-section ai-mode-section--expandable ${aiMode === 'live' ? 'ai-mode-section--selected ai-mode-section--selected-live' : ''}`}>
              <label className="ai-mode-section-header">
                <input
                  type="radio"
                  name="aiMode"
                  className="ai-mode-radio"
                  checked={aiMode === 'live'}
                  onChange={() => setAiMode('live')}
                />
                <span className="ai-mode-radio-indicator" />
                <Sparkles size={18} className="ai-mode-section-icon ai-mode-section-icon--live" />
                <div className="ai-mode-section-info">
                  <strong className="ai-mode-section-title">Live Gemini Mode (API Key Required)</strong>
                  <span className="ai-mode-section-desc">Automatically calls the Gemini API. Fast, seamless, uses your API quota.</span>
                </div>
              </label>

              {aiMode === 'live' && (
                <div className="ai-mode-section-content">

                  <div className="form-group form-group--mt16">
                    <label className="ai-keys-label">
                      <Key size={14} /> Gemini API Keys
                    </label>
                    <div className="api-key-info-box">
                      🔑 <strong>How to get a key:</strong>
                      <ol className="api-key-steps">
                        <li>Go to the <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="ai-md-link">Google AI Studio</a>.</li>
                        <li>Sign in with your Google Account.</li>
                        <li>Click <strong>Create API Key</strong> in the top-left menu.</li>
                        <li>Create and copy your key, then paste it below. (Free tier available!)</li>
                      </ol>
                    </div>
                    <div className="api-key-list">
                      {keys.map((key, index) => (
                        <div key={index} className="api-key-row">
                          <input
                            type="text"
                            placeholder={`Gemini API Key ${index + 1}`}
                            value={key}
                            onChange={e => {
                              const newKeys = [...keys];
                              newKeys[index] = e.target.value;
                              setKeys(newKeys);
                              if (testStatus !== 'idle') setTestStatus('idle');
                            }}
                            className="api-key-input"
                          />
                          {keys.length > 1 && (
                            <button
                              type="button"
                              className="api-key-remove-btn"
                              onClick={() => {
                                setKeys(keys.filter((_, i) => i !== index));
                                if (testStatus !== 'idle') setTestStatus('idle');
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.color = '#f87171';
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.color = 'var(--text-muted)';
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                              }}
                              data-tooltip="Remove Key"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        className="btn-secondary ai-add-key-btn"
                        onClick={() => setKeys([...keys, ''])}
                      >
                        <Plus size={14} /> Add API Key
                      </button>
                    </div>
                    <span className="api-key-hint">
                      Multiple keys will be automatically rotated if one hits a rate limit or error.
                    </span>
                  </div>

                  <div className="form-group form-group--mt16">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: isGoogleSignedIn ? 'pointer' : 'not-allowed', textTransform: 'none', fontWeight: 'normal' }}>
                      <input
                        type="checkbox"
                        checked={syncToDrive}
                        onChange={e => setSyncToDrive(e.target.checked)}
                        disabled={!isGoogleSignedIn}
                        style={{ width: '16px', height: '16px', padding: 0, margin: 0, cursor: isGoogleSignedIn ? 'pointer' : 'not-allowed' }}
                      />
                      <span className="form-label-text">Sync API Keys to Google Drive</span>
                    </label>
                    {!isGoogleSignedIn && (
                      <span className="drive-hint">
                        Sign in to Google Drive (via dashboard) to enable cross-device sync.
                      </span>
                    )}
                    <div className="glass-panel ai-security-note">
                      🔒 <strong>Security Note</strong>: Keys are stored in a private settings file (<code>ai-settings.json</code>) in your Google Drive's <code>apps/trip_planner</code> folder. They are never shared with collaborators.
                    </div>
                  </div>

                  <div className="form-group form-group--mt16">
                    <label>Max Concurrent AI Requests</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={maxConcurrent}
                      onChange={e => setMaxConcurrent(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                      className="ai-concurrent-input"
                    />
                    <span className="drive-hint">
                      Limit simultaneous Gemini calls to avoid rate limits. Default: 1.
                    </span>
                  </div>

                  <div className="form-group form-group--mt16">
                    <label>API Model</label>
                    <select
                      className="ai-modal-select"
                      value={model}
                      onChange={e => setModel(e.target.value)}
                    >
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended — Fast & Cost-Efficient)</option>
                      <option value="gemini-2.5-pro">Gemini 2.5 Pro (Extremely Detailed — Slower)</option>
                      <option value="gemini-2.0-flash">Gemini 2.0 Flash (Fast, Previous Gen)</option>
                      <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash-Lite (Fastest & Cheapest)</option>
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro (Legacy)</option>
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash (Legacy)</option>
                    </select>
                  </div>

                  <div className="ai-test-row">
                    <button
                      type="button"
                      className="btn-secondary flex-align ai-test-btn"
                      onClick={handleTestConnection}
                      disabled={testStatus === 'testing'}
                    >
                      {testStatus === 'testing' ? (
                        <RefreshCw size={12} className="spin" />
                      ) : (
                        <RefreshCw size={12} />
                      )}
                      Test Connection
                    </button>
                    {testStatus !== 'idle' && (
                      <div className={`ai-settings-test-panel ${testStatus === 'testing' ? '' : testStatus}`}>
                        {testStatus === 'success' && <CheckCircle2 size={14} />}
                        {testStatus === 'error' && <XCircle size={14} />}
                        {testStatus === 'testing' && <RefreshCw size={14} className="spin" />}
                        <span className="ai-test-msg">{testMessage}</span>
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>

          </div>
        </div>

        <div className="modal-actions modal-actions--mt24">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={handleSave}>
            Save Settings
          </button>
        </div>
    </Modal>
  );
}
