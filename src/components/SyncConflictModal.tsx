import { Cloud, Laptop, GitMerge } from 'lucide-react';

export interface SyncConflictModalProps {
  localCount: number;
  cloudCount: number;
  onResolve: (choice: 'merge' | 'cloud' | 'local') => void;
}

export default function SyncConflictModal({
  localCount,
  cloudCount,
  onResolve,
}: SyncConflictModalProps) {
  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content glass-panel" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cloud size={24} style={{ color: 'var(--accent-primary)' }} />
            Sync Conflict Detected
          </h3>
        </div>

        <div style={{ textTransform: 'none', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '24px' }}>
          <p style={{ marginBottom: '16px' }}>
            We found trip details stored both locally on this device and on your Google Drive. 
            Please choose how you would like to handle this sync conflict:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Option 1: Merge */}
            <div 
              className="glass-panel" 
              onClick={() => onResolve('merge')}
              style={{ 
                padding: '16px', 
                borderRadius: '8px', 
                cursor: 'pointer', 
                border: '1px solid var(--border-glass)',
                background: 'rgba(255,255,255,0.02)',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--accent-primary)';
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border-glass)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
              }}
            >
              <GitMerge size={20} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '2px', fontSize: '14px' }}>
                  Merge Local & Google Drive Trips (Recommended)
                </strong>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Combines all trips from both sources. If the same trip exists on both, we'll keep the Google Drive version.
                </span>
              </div>
            </div>

            {/* Option 2: Keep Cloud */}
            <div 
              className="glass-panel" 
              onClick={() => onResolve('cloud')}
              style={{ 
                padding: '16px', 
                borderRadius: '8px', 
                cursor: 'pointer', 
                border: '1px solid var(--border-glass)',
                background: 'rgba(255,255,255,0.02)',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--accent-primary)';
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border-glass)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
              }}
            >
              <Cloud size={20} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '2px', fontSize: '14px' }}>
                  Use Google Drive Trips Only
                </strong>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Discard the {localCount} local trip{localCount !== 1 ? 's' : ''} and load the {cloudCount} trip{cloudCount !== 1 ? 's' : ''} from Google Drive.
                </span>
              </div>
            </div>

            {/* Option 3: Keep Local */}
            <div 
              className="glass-panel" 
              onClick={() => onResolve('local')}
              style={{ 
                padding: '16px', 
                borderRadius: '8px', 
                cursor: 'pointer', 
                border: '1px solid var(--border-glass)',
                background: 'rgba(255,255,255,0.02)',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--accent-primary)';
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border-glass)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
              }}
            >
              <Laptop size={20} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '2px', fontSize: '14px' }}>
                  Overwrite Google Drive with Local Trips
                </strong>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Keep the {localCount} local trip{localCount !== 1 ? 's' : ''} and overwrite the data currently stored on Google Drive.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
