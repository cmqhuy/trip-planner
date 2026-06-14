import { useState, useEffect } from 'react';
import { X, Sparkles, Key, RefreshCw, CheckCircle2, XCircle, Plus, Trash2 } from 'lucide-react';
import { GeminiService } from '../utils/ai';

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
  const [keys, setKeys] = useState<string[]>(['']);
  const [model, setModel] = useState('gemini-2.5-flash');
  const [syncToDrive, setSyncToDrive] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      const savedKeys = GeminiService.getApiKeys();
      setKeys(savedKeys.length > 0 ? savedKeys : ['']);
      setModel(GeminiService.getSelectedModel());
      setSyncToDrive(GeminiService.getSyncToDrive());
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
    const activeKeys = keys.map(k => k.trim()).filter(Boolean);
    GeminiService.saveApiKeys(activeKeys);
    GeminiService.saveSelectedModel(model);
    GeminiService.setSyncToDrive(syncToDrive && isGoogleSignedIn);
    onSaved();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content glass-panel" 
        style={{ maxWidth: '450px' }} 
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} style={{ color: 'var(--accent-primary)' }} />
            Gemini AI Settings
          </h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-scroll-body" style={{ marginTop: '12px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '16px', textTransform: 'none' }}>
            Enter your Gemini developer API key(s) to enable automated travel insights (story, best times, reservations, directions, and pro-tips).
          </p>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Key size={14} /> Gemini API Keys
            </label>
            
            <div 
              style={{ 
                margin: '4px 0 8px 0', 
                padding: '8px 12px', 
                fontSize: '11.5px', 
                color: 'var(--text-secondary)', 
                lineHeight: 1.4, 
                background: 'rgba(255, 255, 255, 0.02)', 
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '6px',
                textTransform: 'none'
              }}
            >
              🔑 <strong>How to get a key:</strong>
              <ol style={{ margin: '4px 0 0 14px', padding: 0, listStyleType: 'decimal' }}>
                <li>Go to the <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>Google AI Studio</a>.</li>
                <li>Sign in with your Google Account.</li>
                <li>Click <strong>Create API Key</strong> in the top-left menu.</li>
                <li>Create and copy your key, then paste it below. (Free tier available!)</li>
              </ol>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {keys.map((key, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                    style={{ fontFamily: 'monospace', fontSize: '13px' }}
                  />
                  {keys.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newKeys = keys.filter((_, i) => i !== index);
                        setKeys(newKeys);
                        if (testStatus !== 'idle') setTestStatus('idle');
                      }}
                      style={{
                        padding: '10px',
                        color: 'var(--text-muted)',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'var(--transition-smooth)'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.color = '#f87171';
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.color = 'var(--text-muted)';
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                      }}
                      title="Remove Key"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setKeys([...keys, ''])}
                style={{
                  fontSize: '12.5px',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  alignSelf: 'flex-start',
                  marginTop: '4px'
                }}
              >
                <Plus size={14} /> Add API Key
              </button>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', display: 'block', textTransform: 'none' }}>
              Multiple keys will be automatically rotated if one hits a rate limit or error.
            </span>
          </div>

          <div className="form-group" style={{ marginTop: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: isGoogleSignedIn ? 'pointer' : 'not-allowed', textTransform: 'none', fontWeight: 'normal' }}>
              <input
                type="checkbox"
                checked={syncToDrive}
                onChange={e => setSyncToDrive(e.target.checked)}
                disabled={!isGoogleSignedIn}
                style={{ width: '16px', height: '16px', padding: 0, margin: 0, cursor: isGoogleSignedIn ? 'pointer' : 'not-allowed' }}
              />
              <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Sync API Keys to Google Drive</span>
            </label>
            {!isGoogleSignedIn && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block', textTransform: 'none' }}>
                Sign in to Google Drive (via dashboard) to enable cross-device sync.
              </span>
            )}
            <div 
              className="glass-panel" 
              style={{ 
                marginTop: '8px', 
                padding: '8px 12px', 
                fontSize: '11px', 
                color: 'var(--text-secondary)', 
                lineHeight: 1.4, 
                textTransform: 'none',
                borderColor: 'rgba(255, 255, 255, 0.05)',
                backgroundColor: 'rgba(255, 255, 255, 0.01)'
              }}
            >
              🔒 <strong>Security Note</strong>: Keys are stored in a private settings file (<code>ai-settings.json</code>) in your Google Drive's <code>apps/trip_planner</code> folder. They are never shared with collaborators, even if you share your trips.
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '16px' }}>
            <label>API Model</label>
            <select
              className="ai-modal-select"
              value={model}
              onChange={e => setModel(e.target.value)}
            >
              <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended - Fast & Cost-Efficient)</option>
              <option value="gemini-2.5-pro">Gemini 2.5 Pro (Extremely Detailed - Slower)</option>
              <option value="gemini-1.5-flash">Gemini 1.5 Flash (Legacy)</option>
            </select>
          </div>

          {/* Test connection row */}
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              type="button"
              className="btn-secondary flex-align"
              style={{ alignSelf: 'flex-start', fontSize: '12px', padding: '6px 12px', gap: '6px' }}
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
                <span style={{ textTransform: 'none' }}>{testMessage}</span>
              </div>
            )}
          </div>
        </div>

        <div className="modal-actions" style={{ marginTop: '24px' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={handleSave}>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
