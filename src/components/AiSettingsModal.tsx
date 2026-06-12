import { useState, useEffect } from 'react';
import { X, Sparkles, Key, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
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
  const [keysInput, setKeysInput] = useState('');
  const [model, setModel] = useState('gemini-2.5-flash');
  const [syncToDrive, setSyncToDrive] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      const savedKeys = GeminiService.getApiKeys();
      setKeysInput(savedKeys.join('\n'));
      setModel(GeminiService.getSelectedModel());
      setSyncToDrive(GeminiService.getSyncToDrive());
      setTestStatus('idle');
      setTestMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    const keys = keysInput.split(/[\n,]+/).map(k => k.trim()).filter(Boolean);
    if (keys.length === 0) {
      setTestStatus('error');
      setTestMessage('Please enter at least one API key first.');
      return;
    }

    setTestStatus('testing');
    setTestMessage('Testing connectivity with first key...');

    const success = await GeminiService.testConnection(keys[0]);
    if (success) {
      setTestStatus('success');
      setTestMessage('Successfully connected to Gemini API!');
    } else {
      setTestStatus('error');
      setTestMessage('Connection failed. Please check your API key and network connection.');
    }
  };

  const handleSave = () => {
    const keys = keysInput.split('\n').map(k => k.trim()).filter(Boolean);
    GeminiService.saveApiKeys(keys);
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
            <textarea
              className="ai-modal-textarea"
              placeholder="Paste your Gemini API keys here (one key per line)..."
              value={keysInput}
              onChange={e => {
                setKeysInput(e.target.value);
                if (testStatus !== 'idle') setTestStatus('idle');
              }}
              rows={4}
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block', textTransform: 'none' }}>
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
