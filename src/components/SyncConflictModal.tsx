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
    <div className="modal-overlay modal-overlay--1100">
      <div className="modal-content glass-panel modal-content--conflict" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-header-title">
            <Cloud size={24} className="text-accent" />
            Trip Sync Conflict
          </h3>
        </div>

        <div className="sync-conflict-body">
          <p>
            We detected a conflict for the trip: <strong>"{localTrip.name}"</strong>. The version stored on Google Drive has different changes than your local version.
            {totalConflicts > 1 && (
              <span className="sync-conflict-count">
                Conflict {conflictIndex + 1} of {totalConflicts}
              </span>
            )}
          </p>

          <div className="sync-conflict-options">
            {/* Option 1: Cloud */}
            <button
              type="button"
              className="sync-conflict-option glass-panel cloud-option"
              onClick={() => onResolve('cloud')}
              aria-label="Get Cloud Version"
            >
              <div className="option-icon-wrapper">
                <Cloud size={28} />
              </div>
              <div className="option-text">
                <h4>
                  Get Cloud Version
                </h4>
                <p>
                  Replace your local trip with the one on Google Drive. Any local unsynced changes will be lost.
                </p>
                <span className="option-meta">
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
            >
              <div className="option-icon-wrapper">
                <Laptop size={28} />
              </div>
              <div className="option-text">
                <h4>
                  Override Cloud
                </h4>
                <p>
                  Keep your local trip and overwrite the version stored on Google Drive.
                </p>
                <span className="option-meta">
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
