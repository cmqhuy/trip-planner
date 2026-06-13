import { LogIn, LogOut, Cloud, RefreshCw, AlertCircle, Settings } from 'lucide-react';

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
            title="Changes saved locally. Uploading to Google Drive in 30 seconds..."
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
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      {user ? (
        // Signed-in UI
        <div 
          className="glass-panel" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            padding: '4px 12px', 
            borderRadius: '99px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-glass)',
          }}
        >
          {user.picture ? (
            <img 
              src={user.picture} 
              alt={user.name} 
              style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)' }} 
              referrerPolicy="no-referrer"
            />
          ) : (
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent-primary)', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', minWidth: '0' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px' }}>
              {user.name}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
        </div>
      ) : (
        // Signed-out UI
        <button 
          className="btn-secondary flex-align" 
          onClick={onSignIn}
          style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '99px', gap: '6px' }}
        >
          <LogIn size={14} /> Sign In with Google
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
  );
}
