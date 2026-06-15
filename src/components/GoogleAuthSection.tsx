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
          <span className="badge flex-align sync-badge-syncing">
            <RefreshCw size={10} className="spin" /> Syncing...
          </span>
        );
      case 'pending':
        return (
          <span
            className="badge flex-align sync-badge-pending"
            data-tooltip="Changes saved locally. Uploading to Google Drive in 30 seconds..."
            data-tooltip-position="bottom"
          >
            <Cloud size={10} className="icon-opacity-70" /> Changes Pending
          </span>
        );
      case 'synced':
        return (
          <span className="badge flex-align sync-badge-synced">
            <Cloud size={10} /> Saved to Drive
          </span>
        );
      case 'error':
        return (
          <span className="badge flex-align sync-badge-error">
            <AlertCircle size={10} /> Sync Error
          </span>
        );
      default:
        return (
          <span className="badge flex-align sync-badge-idle">
            <Cloud size={10} /> Connected
          </span>
        );
    }
  };

  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  return (
    <>
    <div className="google-auth-wrapper" ref={dropdownRef}>
      {user ? (
        // Signed-in UI
        <div className="google-auth-container glass-panel">
          {/* Desktop avatar - visible on desktop, hidden on mobile */}
          {user.picture ? (
            <img
              src={user.picture}
              alt={user.name}
              className="google-auth-avatar-desktop user-avatar-img"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              className="google-auth-avatar-desktop user-avatar-initial"
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Mobile avatar - clickable on mobile to toggle dropdown (hidden on desktop) */}
          <div
            className="user-avatar-trigger google-auth-avatar-mobile user-avatar-mobile-trigger"
            onClick={() => setShowDropdown(prev => !prev)}
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
            >
              <RefreshCw size={12} className={syncStatus === 'syncing' ? 'spin' : ''} />
            </button>

            <button
              className="mini-icon-btn mini-icon-btn-signout"
              onClick={onSignOut}
              data-tooltip="Sign Out"
              data-tooltip-position="bottom"
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
                <span className="text-muted-sm">Status:</span>
                {getSyncBadge()}
              </div>
              <div className="dropdown-actions-row">
                <button
                  className="btn-secondary flex-align dropdown-full-btn"
                  onClick={() => {
                    onManualSync();
                    setShowDropdown(false);
                  }}
                  disabled={syncStatus === 'syncing'}
                >
                  <RefreshCw size={12} className={syncStatus === 'syncing' ? 'spin' : ''} />
                  Sync Now
                </button>
                <button
                  className="btn-danger flex-align dropdown-full-btn"
                  onClick={() => {
                    onSignOut();
                    setShowDropdown(false);
                  }}
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
          className="btn-secondary flex-align google-auth-signin-btn"
          onClick={() => setShowSignInInfo(true)}
        >
          <LogIn size={14} />
          <span className="google-signin-text-desktop">Sign In with Google</span>
          <span className="google-signin-text-mobile">Sign In</span>
        </button>
      )}

      {isLocalhost && (
        <button
          className="mini-icon-btn mini-icon-btn-settings"
          onClick={onOpenSettings}
          data-tooltip="Google Integration Settings"
          data-tooltip-position="bottom"
        >
          <Settings size={14} />
        </button>
      )}
    </div>

    {showSignInInfo && createPortal(
      <div
        className="modal-overlay modal-overlay--above"
        onClick={() => setShowSignInInfo(false)}
      >
        <div
          className="modal-content glass-panel modal-content--signin"
          onClick={e => e.stopPropagation()}
        >
          <div className="google-signin-icon-wrapper">
            <div className="google-auth-icon-avatar">
              <Cloud size={24} className="text-accent" />
            </div>
          </div>

          <h2 className="google-signin-title">
            Sign In with Google
          </h2>
          <p className="google-signin-intro">
            Your trips will be stored in your personal Google Drive at{' '}
            <strong className="text-primary">My Drive / apps / trip_planner</strong>.
          </p>

          <div className="google-signin-benefits">
            {[
              'Access your trips from any device',
              'Automatic cloud backup — never lose your plans',
              'Share trips with friends and travel companions',
            ].map(benefit => (
              <div key={benefit} className="google-signin-benefit-row">
                <CheckCircle size={15} className="text-success flex-shrink-0" />
                <span>{benefit}</span>
              </div>
            ))}
          </div>

          <div className="google-signin-privacy">
            <Shield size={14} className="shield-icon" />
            <p className="google-signin-privacy-text">
              This app does not store your data on any server. Everything stays in your own Google Drive folder.
            </p>
          </div>

          <p className="google-signin-drive-link">
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
              className="text-accent"
            >
              My Drive / apps / trip_planner
            </a>
          </p>

          <div className="google-signin-actions">
            <button
              className="btn-secondary flex-1"
              onClick={() => setShowSignInInfo(false)}
            >
              Cancel
            </button>
            <button
              className="btn-primary flex-align google-signin-btn"
              onClick={() => {
                setShowSignInInfo(false);
                onSignIn();
              }}
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
