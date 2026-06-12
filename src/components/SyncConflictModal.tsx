import { Cloud, Laptop } from 'lucide-react';
import type { Trip } from '../types';

export interface SyncConflictModalProps {
  isOpen: boolean;
  localTrip: Trip | null;
  cloudTrip: Trip | null;
  conflictIndex: number;
  totalConflicts: number;
  onResolve: (choice: 'cloud' | 'local') => void;
}

const formatDate = (timestamp?: number) => {
  if (!timestamp) return 'Unknown';
  try {
    return new Date(timestamp).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch (e) {
    return 'Unknown';
  }
};

export default function SyncConflictModal({
  isOpen,
  localTrip,
  cloudTrip,
  conflictIndex,
  totalConflicts,
  onResolve,
}: SyncConflictModalProps) {
  if (!isOpen || !localTrip || !cloudTrip) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content glass-panel" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cloud size={24} style={{ color: 'var(--accent-primary)' }} />
            Trip Sync Conflict
          </h3>
        </div>

        <div style={{ textTransform: 'none', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '24px' }}>
          <p style={{ marginBottom: '16px' }}>
            We detected a conflict for the trip: <strong>"{localTrip.name}"</strong>. The version stored on Google Drive has different changes than your local version.
            {totalConflicts > 1 && (
              <span style={{ display: 'block', marginTop: '8px', color: 'var(--accent-primary)', fontWeight: 500 }}>
                Conflict {conflictIndex + 1} of {totalConflicts}
              </span>
            )}
          </p>

          <div className="sync-conflict-options" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
            {/* Option 1: Cloud */}
            <button 
              type="button"
              className="sync-conflict-option glass-panel cloud-option" 
              onClick={() => onResolve('cloud')}
              aria-label="Get Cloud Version"
              style={{
                width: '100%',
                border: '1px solid var(--border-glass)',
                background: 'rgba(255,255,255,0.02)',
                textAlign: 'left',
                color: 'inherit',
                fontFamily: 'inherit',
                display: 'flex',
                gap: '16px',
                padding: '20px',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
              }}
            >
              <div className="option-icon-wrapper" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                flexShrink: 0,
                background: 'rgba(99, 102, 241, 0.1)',
                color: 'var(--accent-primary)',
              }}>
                <Cloud size={28} />
              </div>
              <div className="option-text" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Get Cloud Version
                </h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  Replace your local trip with the one on Google Drive. Any local unsynced changes will be lost.
                </p>
                <span className="option-meta" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Modified on Drive: {formatDate(cloudTrip.updatedAt)}
                </span>
              </div>
            </button>

            {/* Option 2: Local */}
            <button 
              type="button"
              className="sync-conflict-option glass-panel local-option" 
              onClick={() => onResolve('local')}
              aria-label="Override Cloud"
              style={{
                width: '100%',
                border: '1px solid var(--border-glass)',
                background: 'rgba(255,255,255,0.02)',
                textAlign: 'left',
                color: 'inherit',
                fontFamily: 'inherit',
                display: 'flex',
                gap: '16px',
                padding: '20px',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
              }}
            >
              <div className="option-icon-wrapper" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                flexShrink: 0,
                background: 'rgba(245, 158, 11, 0.1)',
                color: '#f59e0b',
              }}>
                <Laptop size={28} />
              </div>
              <div className="option-text" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Override Cloud
                </h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  Keep your local trip and overwrite the version stored on Google Drive.
                </p>
                <span className="option-meta" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Modified on Device: {formatDate(localTrip.updatedAt)}
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
