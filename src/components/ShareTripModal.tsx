import { useState, useEffect } from 'react';
import { Share2, Users, Trash2, X, Plus, AlertCircle, Shield, User, Loader2 } from 'lucide-react';
import type { Trip } from '../types';
import {
  listTripFilePermissions,
  shareTripFile,
  removeTripFilePermission,
  updateTripFilePermission
} from '../utils/googleDrive';

export interface ShareTripModalProps {
  trip?: Trip;
  accessToken: string;
  onClose: () => void;
  onUpdateTrip?: (updatedTrip: Trip) => void;
  // Folder sharing mode — when provided, shares the folder instead of the trip file
  folderId?: string;
  folderDisplayName?: string;
}

export default function ShareTripModal({ trip, accessToken, onClose, onUpdateTrip, folderId, folderDisplayName }: ShareTripModalProps) {
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [roleInput, setRoleInput] = useState<'reader' | 'writer'>('reader');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [successData, setSuccessData] = useState<{ email: string; role: 'reader' | 'writer' } | null>(null);
  const [successCopied, setSuccessCopied] = useState(false);

  const isFolder = !!folderId;
  const fileId = folderId ?? trip?.driveFileId;
  const displayName = folderDisplayName ?? trip?.name ?? '';

  // Fetch permissions list
  const loadPermissions = async () => {
    if (!fileId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const list = await listTripFilePermissions(accessToken, fileId);
      // Sort so owner is first, then alphabetical by email
      const sorted = [...list].sort((a, b) => {
        if (a.role === 'owner') return -1;
        if (b.role === 'owner') return 1;
        return (a.emailAddress || '').localeCompare(b.emailAddress || '');
      });
      setPermissions(sorted);

      const hasCollaborators = sorted.some(p => p.role !== 'owner');
      if (!isFolder && trip && trip.shared !== hasCollaborators && onUpdateTrip) {
        onUpdateTrip({ ...trip, shared: hasCollaborators });
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg('Failed to load sharing list. You might not have permission to view it.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPermissions();
  }, [fileId]);

  // Handle sharing with a new user
  const handleAddPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileId || !emailInput.trim()) return;

    setErrorMsg(null);
    setLoading(true);
    const targetEmail = emailInput.trim();
    const targetRole = roleInput;
    try {
      await shareTripFile(accessToken, fileId, targetEmail, targetRole);
      setEmailInput('');
      setSuccessData({ email: targetEmail, role: targetRole });
      await loadPermissions();
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'Failed to share itinerary. Check if the email address is a valid Google Account.');
    } finally {
      setLoading(false);
    }
  };

  // Handle removing a collaborator
  const handleRemovePermission = async (permId: string) => {
    if (!fileId) return;

    setErrorMsg(null);
    setActionLoadingId(permId);
    try {
      await removeTripFilePermission(accessToken, fileId, permId);
      await loadPermissions();
    } catch (e: any) {
      console.error(e);
      setErrorMsg('Failed to remove collaborator access.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle updating a collaborator's role
  const handleRoleChange = async (permId: string, newRole: 'reader' | 'writer') => {
    if (!fileId) return;

    setErrorMsg(null);
    setActionLoadingId(permId);
    try {
      await updateTripFilePermission(accessToken, fileId, permId, newRole);
      await loadPermissions();
    } catch (e: any) {
      console.error(e);
      setErrorMsg('Failed to update collaborator permission.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const filename = trip ? (trip.id.startsWith('trip-') ? `${trip.id}.json` : `trip-${trip.id}.json`) : '';

  return (
    <div className="modal-overlay modal-overlay--1100" onClick={onClose}>
      <div className="modal-content glass-panel modal-content--share" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header modal-header--mb16">
          <h3 className="modal-header-title share-modal-title">
            <Share2 size={20} className="text-accent" />
            {isFolder ? 'Share Folder' : 'Share Itinerary'}
          </h3>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Trip Title Subheading */}
        <div className="share-itinerary-label">
          <span className="share-file-type-label">{isFolder ? 'TRIP FOLDER' : 'ITINERARY FILE'}</span>
          <h4 className="share-trip-name-h4">{displayName}</h4>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="share-error-panel">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Share Form */}
        <form onSubmit={handleAddPermission} className="share-form">
          <input
            type="email"
            placeholder="Add Google account email..."
            value={emailInput}
            onChange={e => setEmailInput(e.target.value)}
            required
            disabled={loading}
            className="share-email-input"
          />
          <select
            value={roleInput}
            onChange={e => setRoleInput(e.target.value as 'reader' | 'writer')}
            disabled={loading}
            className="share-role-select"
          >
            <option value="reader">Viewer</option>
            <option value="writer">Editor</option>
          </select>
          <button
            type="submit"
            className="btn-primary flex-align share-submit-btn"
            disabled={loading || !emailInput.trim()}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Share
          </button>
        </form>

        {/* File Name Section — only for trip file sharing */}
        {fileId && !isFolder && (
          <div className="share-filename-box">
            <div className="share-filename-header">
              <Share2 size={13} className="text-muted" />
              <span className="share-section-label">File Name</span>
            </div>
            <div className="share-filename-row">
              <input
                type="text"
                readOnly
                value={filename}
                onClick={e => (e.target as HTMLInputElement).select()}
                className="share-filename-input"
              />
              <button
                type="button"
                className="btn-secondary share-copy-btn"
                onClick={() => {
                  navigator.clipboard.writeText(filename);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="share-filename-hint">
              Share this file name with other users so they can import the trip.
            </p>
          </div>
        )}

        {/* Success Overlay Popup */}
        {successData && (
          <div className="share-success-overlay">
            <div className="share-success-body">
              <div className="share-success-icon">
                <Share2 size={24} />
              </div>

              <div>
                <h4 className="share-success-title">
                  {isFolder ? 'Folder Shared Successfully!' : 'Trip Shared Successfully!'}
                </h4>
                <p className="share-success-desc">
                  You have shared {isFolder ? 'the folder' : 'the trip'} with <strong className="text-primary">{successData.email}</strong> as {successData.role === 'writer' ? 'an Editor' : 'a Viewer'}.
                  {!isFolder && (
                    <>
                      <br />
                      <span className="share-warning-span">
                        ⚠️ Action Required:
                      </span>
                      Please copy the file name below, send it to them, and ask them to import the trip in their app.
                    </>
                  )}
                </p>
              </div>

              {/* Copy Filename Box — only for trip file sharing */}
              {!isFolder && (
                <div className="share-filename-box-in-success">
                  <div className="share-filename-row">
                    <input
                      type="text"
                      readOnly
                      value={filename}
                      onClick={e => (e.target as HTMLInputElement).select()}
                      className="share-filename-input"
                    />
                    <button
                      type="button"
                      className="btn-secondary share-copy-btn"
                      onClick={() => {
                        navigator.clipboard.writeText(filename);
                        setSuccessCopied(true);
                        setTimeout(() => setSuccessCopied(false), 2000);
                      }}
                    >
                      {successCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="button"
                className="btn-primary share-got-it-btn"
                onClick={() => setSuccessData(null)}
              >
                Got it
              </button>
            </div>
          </div>
        )}

        {/* Collaborators List Title */}
        <div className="share-collab-header">
          <Users size={14} className="text-muted" />
          <span className="share-section-label">People with Access</span>
        </div>

        {/* Collaborators List */}
        <div className="share-collab-list">
          {permissions.length === 0 && loading ? (
            <div className="share-loading-wrapper">
              <Loader2 size={20} className="animate-spin text-accent" />
            </div>
          ) : (
            permissions.map(perm => {
              const isOwner = perm.role === 'owner';
              const isLoading = actionLoadingId === perm.id;

              return (
                <div
                  key={perm.id}
                  className="glass-panel share-collab-card"
                >
                  <div className="share-collab-info">
                    <div
                      className="share-collab-avatar"
                      style={{
                        background: isOwner ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.05)',
                        color: isOwner ? 'var(--accent-primary)' : 'var(--text-secondary)'
                      }}
                    >
                      {isOwner ? <Shield size={14} /> : <User size={14} />}
                    </div>
                    <div className="min-w-0">
                      <div className="share-collab-name">
                        {perm.displayName || (isOwner ? 'Owner' : 'Collaborator')}
                      </div>
                      <div className="share-collab-email">
                        {perm.emailAddress}
                      </div>
                    </div>
                  </div>

                  <div className="share-collab-actions">
                    {isOwner ? (
                      <span className="share-owner-label">
                        Owner
                      </span>
                    ) : (
                      <>
                        <select
                          value={perm.role === 'writer' ? 'writer' : 'reader'}
                          onChange={e => handleRoleChange(perm.id, e.target.value as 'reader' | 'writer')}
                          disabled={isLoading}
                          className="share-role-change-select"
                        >
                          <option value="reader">Viewer</option>
                          <option value="writer">Editor</option>
                        </select>

                        <button
                          className="mini-icon-btn share-remove-btn"
                          disabled={isLoading}
                          onClick={() => handleRemovePermission(perm.id)}
                          data-tooltip="Remove Access"
                        >
                          {isLoading ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Trash2 size={13} />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}
