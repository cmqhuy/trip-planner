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
      <div className="modal-content glass-panel modal-content--md" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-header-title">
            <Key size={18} className="text-accent" />
            Google Integration Settings
          </h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="google-settings-form">
          <div className="form-group">
            <label htmlFor="google-client-id-input">OAuth Client ID</label>
            <div className="google-settings-input-row">
              <input
                type="text"
                id="google-client-id-input"
                value={inputClientId}
                onChange={e => setInputClientId(e.target.value)}
                placeholder={DEFAULT_CLIENT_ID}
                className="google-settings-input"
              />
              {inputClientId && (
                <button
                  type="button"
                  className="btn-secondary google-settings-use-default-btn"
                  onClick={handleResetClientId}
                >
                  Use Default
                </button>
              )}
            </div>
            <p className="google-settings-hint">
              Leave blank to use the app's default Client ID (configured for localhost development).
            </p>
          </div>

          <div className="form-group form-group--mt16">
            <label htmlFor="google-api-key-input">Developer API Key</label>
            <input
              type="password"
              id="google-api-key-input"
              value={inputApiKey}
              onChange={e => setInputApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="google-settings-api-input"
              required
            />
            <p className="google-settings-hint">
              Required for the Google Drive File Picker (to choose/open shared files securely).
            </p>
          </div>

          <div className="flex-align google-settings-security-note">
            <ShieldAlert size={16} className="text-accent google-settings-shield" />
            <div className="google-settings-security-text">
              <strong>Security & Restriction Tip:</strong> We recommend restricting your API key in the Google Cloud Console to only allow the <em>Google Picker API</em>, and adding HTTP referrer restrictions for <em>http://localhost:5173/*</em>.
            </div>
          </div>

          <div className="modal-actions modal-actions--mt24">
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
