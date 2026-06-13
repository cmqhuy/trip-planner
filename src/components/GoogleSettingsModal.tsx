import { useState, useEffect } from 'react';
import { X, Key, ShieldAlert } from 'lucide-react';
import { DEFAULT_CLIENT_ID, DEFAULT_API_KEY } from '../utils/googleDrive';

interface GoogleSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  apiKey: string;
  onSave: (clientId: string, apiKey: string) => void;
}

export default function GoogleSettingsModal({
  isOpen,
  onClose,
  clientId,
  apiKey,
  onSave,
}: GoogleSettingsModalProps) {
  const [inputClientId, setInputClientId] = useState('');
  const [inputApiKey, setInputApiKey] = useState('');

  useEffect(() => {
    if (isOpen) {
      setInputClientId(clientId === DEFAULT_CLIENT_ID ? '' : clientId);
      setInputApiKey(apiKey === DEFAULT_API_KEY ? '' : apiKey);
    }
  }, [isOpen, clientId, apiKey]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalClientId = inputClientId.trim() || DEFAULT_CLIENT_ID;
    onSave(finalClientId, inputApiKey.trim());
    onClose();
  };

  const handleResetClientId = () => {
    setInputClientId('');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" style={{ maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="flex-align" style={{ gap: '8px' }}>
            <Key size={18} className="text-accent" />
            Google Integration Settings
          </h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: '16px' }}>
          <div className="form-group">
            <label htmlFor="google-client-id-input">OAuth Client ID</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                id="google-client-id-input"
                value={inputClientId}
                onChange={e => setInputClientId(e.target.value)}
                placeholder={DEFAULT_CLIENT_ID}
                style={{ flex: 1, fontSize: '13px' }}
              />
              {inputClientId && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleResetClientId}
                  style={{ padding: '0 12px', fontSize: '11px', whiteSpace: 'nowrap' }}
                >
                  Use Default
                </button>
              )}
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
              Leave blank to use the app's default Client ID (configured for localhost development).
            </p>
          </div>

          <div className="form-group" style={{ marginTop: '16px' }}>
            <label htmlFor="google-api-key-input">Developer API Key</label>
            <input
              type="password"
              id="google-api-key-input"
              value={inputApiKey}
              onChange={e => setInputApiKey(e.target.value)}
              placeholder="AIzaSy..."
              style={{ width: '100%', fontSize: '13px' }}
              required
            />
            <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
              Required for the Google Drive File Picker (to choose/open shared files securely).
            </p>
          </div>

          <div
            className="flex-align"
            style={{
              marginTop: '16px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'rgba(99, 102, 241, 0.05)',
              border: '1px solid rgba(99, 102, 241, 0.15)',
              gap: '10px',
              alignItems: 'flex-start',
            }}
          >
            <ShieldAlert size={16} className="text-accent" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              <strong>Security & Restriction Tip:</strong> We recommend restricting your API key in the Google Cloud Console to only allow the <em>Google Picker API</em>, and adding HTTP referrer restrictions for <em>http://localhost:5173/*</em>.
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: '24px' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
