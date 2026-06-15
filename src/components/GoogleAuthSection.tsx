import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { LogIn, LogOut, Cloud, RefreshCw, AlertCircle, Settings, CheckCircle, Shield } from 'lucide-react';

export interface GoogleAuthSectionProps {
  user: { name: string; email: string; picture: string } | null;
  syncStatus: 'idle' | 'pending' | 'syncing' | 'synced' | 'error';
  onSignIn: () => void;
  onSignOut: () => void;
  onManualSync: () => void;
  onOpenSettings: () => void;
}

export default function GoogleAuthSection({
  user,
  syncStatus,
  onSignIn,
  onSignOut,
  onManualSync,
  onOpenSettings,
}: GoogleAuthSectionProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSignInInfo, setShowSignInInfo] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, []);

  const getSyncBadge = () => {
    switch (syncStatus) {
      case 'syncing':
        return (
          <span className="badge flex-align" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', gap: '4px' }}>
            <RefreshCw size={10} className="spin" /> Syncing...
          </span>
        );
      case 'pending':
        return (
          <span
            className="badge flex-align"
            style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', gap: '4px' }}
            data-tooltip="Changes saved locally. Uploading to Google Drive in 30 seconds..."
            data-tooltip-position="bottom"
          >
            <Cloud size={10} style={{ opacity: 0.7 }} /> Changes Pending
          </span>
        );
      case 'synced':
        return (
          <span className="badge flex-align" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', gap: '4px' }}>
            <Cloud size={10} /> Saved to Drive
          </span>
        );
      case 'error':
        return (
          <span className="badge flex-align" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', gap: '4px' }}>
            <AlertCircle size={10} /> Sync Error
          </span>
        );
      default:
        return (
          <span className="badge flex-align" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', gap: '4px' }}>
            <Cloud size={10} /> Connected
          </span>
        );
    }
  };

  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  return (
    <>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} ref={dropdownRef}>
      {user ? (
        // Signed-in UI
        <div 
          className="google-auth-container glass-panel" 
        >
          {/* Desktop avatar - visible on desktop, hidden on mobile */}
          {user.picture ? (
            <img 
              src={user.picture} 
              alt={user.name} 
              className="google-auth-avatar-desktop"
              style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)' }} 
              referrerPolicy="no-referrer"
            />
          ) : (
            <div 
              className="google-auth-avatar-desktop"
              style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent-primary)', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Mobile avatar - clickable on mobile to toggle dropdown (hidden on desktop) */}
          <div 
            className="user-avatar-trigger google-auth-avatar-mobile"
            onClick={() => setShowDropdown(prev => !prev)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            {user.picture ? (
              <img 
                src={user.picture} 
                alt={user.name} 
                className="user-avatar-img"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="user-avatar-initial">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* User Name - visible on desktop, hidden on mobile */}
          <div className="user-name-wrapper">
            <span className="user-name-text">
              {user.name}
            </span>
          </div>

          {/* Sync status and buttons - visible on desktop, hidden on mobile */}
          <div className="google-auth-desktop-actions">
            {getSyncBadge()}
            
            <button 
              className="mini-icon-btn" 
              onClick={onManualSync} 
              data-tooltip="Sync Now" 
              data-tooltip-position="bottom"
              disabled={syncStatus === 'syncing'}
              style={{ padding: '4px', display: 'flex' }}
            >
              <RefreshCw size={12} className={syncStatus === 'syncing' ? 'spin' : ''} />
            </button>

            <button 
              className="mini-icon-btn" 
              onClick={onSignOut} 
              data-tooltip="Sign Out" 
              data-tooltip-position="bottom"
              style={{ padding: '4px', display: 'flex', color: 'var(--text-muted)' }}
            >
              <LogOut size={12} />
            </button>
          </div>

          {/* Expander Dropdown for Mobile only */}
          {showDropdown && (
            <div className="google-auth-mobile-dropdown glass-panel">
              <div className="dropdown-user-info">
                <span className="dropdown-user-name">{user.name}</span>
                <span className="dropdown-user-email">{user.email}</span>
              </div>
              <div className="dropdown-divider" />
              <div className="dropdown-status-row">
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Status:</span>
                {getSyncBadge()}
              </div>
              <div className="dropdown-actions-row">
                <button 
                  className="btn-secondary flex-align" 
                  onClick={() => {
                    onManualSync();
                    setShowDropdown(false);
                  }}
                  disabled={syncStatus === 'syncing'}
                  style={{ width: '100%', justifyContent: 'center', fontSize: '12px', padding: '6px 12px', gap: '6px' }}
                >
                  <RefreshCw size={12} className={syncStatus === 'syncing' ? 'spin' : ''} />
                  Sync Now
                </button>
                <button 
                  className="btn-danger flex-align" 
                  onClick={() => {
                    onSignOut();
                    setShowDropdown(false);
                  }}
                  style={{ width: '100%', justifyContent: 'center', fontSize: '12px', padding: '6px 12px', gap: '6px' }}
                >
                  <LogOut size={12} />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        // Signed-out UI
        <button
          className="btn-secondary flex-align"
          onClick={() => setShowSignInInfo(true)}
          style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '99px', gap: '6px' }}
        >
          <LogIn size={14} />
          <span className="google-signin-text-desktop">Sign In with Google</span>
          <span className="google-signin-text-mobile">Sign In</span>
        </button>
      )}

      {isLocalhost && (
        <button 
          className="mini-icon-btn" 
          onClick={onOpenSettings}
          data-tooltip="Google Integration Settings"
          data-tooltip-position="bottom"
          style={{ padding: '6px', display: 'flex', borderRadius: '50%' }}
        >
          <Settings size={14} />
        </button>
      )}
    </div>

    {showSignInInfo && createPortal(
      <div
        className="modal-overlay"
        onClick={() => setShowSignInInfo(false)}
        style={{ zIndex: 2000 }}
      >
        <div
          className="modal-content glass-panel"
          onClick={e => e.stopPropagation()}
          style={{ maxWidth: '420px', padding: '32px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'rgba(99, 102, 241, 0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(99, 102, 241, 0.25)'
            }}>
              <Cloud size={24} style={{ color: 'var(--accent-primary)' }} />
            </div>
          </div>

          <h2 style={{ textAlign: 'center', marginBottom: '10px', fontSize: '18px', fontWeight: 600 }}>
            Sign In with Google
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', marginBottom: '22px', lineHeight: '1.6' }}>
            Your trips will be stored in your personal Google Drive at{' '}
            <strong style={{ color: 'var(--text-primary)' }}>My Drive / apps / trip_planner</strong>.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            {[
              'Access your trips from any device',
              'Automatic cloud backup — never lose your plans',
              'Share trips with friends and travel companions',
            ].map(benefit => (
              <div key={benefit} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                <CheckCircle size={15} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                <span>{benefit}</span>
              </div>
            ))}
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '8px',
            padding: '12px 14px',
            marginBottom: '22px',
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-start'
          }}>
            <Shield size={14} style={{ color: 'var(--text-muted)', marginTop: '1px', flexShrink: 0 }} />
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
              This app does not store your data on any server. Everything stays in your own Google Drive folder.
            </p>
          </div>

          <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '22px' }}>
            Files stored at:{' '}
            <a
              href={(() => {
                const folderId = localStorage.getItem('google-folder-id');
                return folderId
                  ? `https://drive.google.com/drive/folders/${folderId}`
                  : 'https://drive.google.com/drive/my-drive';
              })()}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent-primary)' }}
            >
              My Drive / apps / trip_planner
            </a>
          </p>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="btn-secondary"
              onClick={() => setShowSignInInfo(false)}
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button
              className="btn-primary flex-align"
              onClick={() => {
                setShowSignInInfo(false);
                onSignIn();
              }}
              style={{ flex: 2, justifyContent: 'center', gap: '8px' }}
            >
              <LogIn size={15} />
              Sign In with Google
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  );
}
