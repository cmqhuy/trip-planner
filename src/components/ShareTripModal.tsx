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
  trip: Trip;
  accessToken: string;
  onClose: () => void;
  onUpdateTrip?: (updatedTrip: Trip) => void;
}

export default function ShareTripModal({ trip, accessToken, onClose, onUpdateTrip }: ShareTripModalProps) {
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [roleInput, setRoleInput] = useState<'reader' | 'writer'>('reader');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [successData, setSuccessData] = useState<{ email: string; role: 'reader' | 'writer' } | null>(null);
  const [successCopied, setSuccessCopied] = useState(false);

  const fileId = trip.driveFileId;

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
      if (trip.shared !== hasCollaborators && onUpdateTrip) {
        onUpdateTrip({
          ...trip,
          shared: hasCollaborators
        });
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

  const filename = trip.id.startsWith('trip-') ? `${trip.id}.json` : `trip-${trip.id}.json`;

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content glass-panel" style={{ maxWidth: '540px', padding: '24px', position: 'relative' }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="modal-header" style={{ marginBottom: '16px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', fontWeight: 600 }}>
            <Share2 size={20} style={{ color: 'var(--accent-primary)' }} />
            Share Itinerary
          </h3>
          <button className="modal-close" onClick={onClose} style={{ padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Trip Title Subheading */}
        <div style={{ textTransform: 'none', marginBottom: '20px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ITINERARY FILE</span>
          <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{trip.name}</h4>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            padding: '10px 12px', 
            borderRadius: '6px', 
            background: 'rgba(239, 68, 68, 0.08)', 
            border: '1px solid rgba(239, 68, 68, 0.2)', 
            color: '#f87171', 
            fontSize: '12.5px', 
            marginBottom: '16px',
            alignItems: 'center',
            textTransform: 'none'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Share Form */}
        <form onSubmit={handleAddPermission} style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          <input
            type="email"
            placeholder="Add Google account email..."
            value={emailInput}
            onChange={e => setEmailInput(e.target.value)}
            required
            disabled={loading}
            style={{ 
              flex: 1, 
              padding: '8px 12px', 
              fontSize: '13px', 
              background: 'var(--bg-dark)', 
              border: '1px solid var(--border-glass)',
              color: 'var(--text-primary)',
              borderRadius: '6px',
              textTransform: 'none'
            }}
          />
          <select
            value={roleInput}
            onChange={e => setRoleInput(e.target.value as 'reader' | 'writer')}
            disabled={loading}
            style={{ 
              width: '100px', 
              padding: '8px 24px 8px 10px', 
              fontSize: '13px', 
              background: 'var(--bg-dark)', 
              border: '1px solid var(--border-glass)',
              color: 'var(--text-primary)',
              borderRadius: '6px'
            }}
          >
            <option value="reader">Viewer</option>
            <option value="writer">Editor</option>
          </select>
          <button 
            type="submit" 
            className="btn-primary flex-align" 
            disabled={loading || !emailInput.trim()}
            style={{ padding: '0 12px', height: '36px', gap: '6px', fontSize: '13px', borderRadius: '6px' }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Share
          </button>
        </form>

        {/* File Name Section */}
        {fileId && (
          <div style={{ 
            marginBottom: '24px', 
            padding: '12px 14px', 
            borderRadius: '8px', 
            border: '1px solid var(--border-glass)',
            background: 'rgba(255, 255, 255, 0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <Share2 size={13} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>File Name</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
              <input
                type="text"
                readOnly
                value={filename}
                onClick={e => (e.target as HTMLInputElement).select()}
                style={{ 
                  flex: 1, 
                  padding: '6px 10px', 
                  fontSize: '12px', 
                  background: 'var(--bg-dark)', 
                  border: '1px solid var(--border-glass)',
                  color: 'var(--text-secondary)',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  textTransform: 'none'
                }}
              />
              <button 
                type="button" 
                className="btn-secondary"
                onClick={() => {
                  navigator.clipboard.writeText(filename);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                style={{ 
                  padding: '0 12px', 
                  fontSize: '12px', 
                  height: '30px', 
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0, textTransform: 'none', lineHeight: 1.4 }}>
              Share this file name with other users so they can import the trip.
            </p>
          </div>
        )}

        {/* Success Overlay Popup */}
        {successData && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--bg-panel)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10,
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px', width: '100%' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-success)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                boxShadow: '0 0 15px rgba(16, 185, 129, 0.2)'
              }}>
                <Share2 size={24} />
              </div>
              
              <div>
                <h4 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Trip Shared Successfully!
                </h4>
                <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 16px 0', textTransform: 'none' }}>
                  You have shared the trip with <strong style={{ color: 'var(--text-primary)' }}>{successData.email}</strong> as {successData.role === 'writer' ? 'an Editor' : 'a Viewer'}.
                  <br />
                  <span style={{ display: 'block', marginTop: '8px', color: 'var(--color-warning)', fontWeight: 500 }}>
                    ⚠️ Action Required:
                  </span>
                  Please copy the file name below, send it to them, and ask them to import the trip in their app.
                </p>
              </div>

              {/* Copy Filename Box */}
              <div style={{ 
                width: '100%',
                padding: '12px 14px', 
                borderRadius: '8px', 
                border: '1px solid var(--border-glass)',
                background: 'rgba(255, 255, 255, 0.02)',
                textAlign: 'left'
              }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    readOnly
                    value={filename}
                    onClick={e => (e.target as HTMLInputElement).select()}
                    style={{ 
                      flex: 1, 
                      padding: '6px 10px', 
                      fontSize: '12px', 
                      background: 'var(--bg-dark)', 
                      border: '1px solid var(--border-glass)',
                      color: 'var(--text-secondary)',
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                      textTransform: 'none'
                    }}
                  />
                  <button 
                    type="button" 
                    className="btn-secondary"
                    onClick={() => {
                      navigator.clipboard.writeText(filename);
                      setSuccessCopied(true);
                      setTimeout(() => setSuccessCopied(false), 2000);
                    }}
                    style={{ 
                      padding: '0 12px', 
                      fontSize: '12px', 
                      height: '30px', 
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {successCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <button 
                type="button" 
                className="btn-primary" 
                onClick={() => setSuccessData(null)}
                style={{ marginTop: '16px', padding: '8px 24px', fontSize: '13px' }}
              >
                Got it
              </button>
            </div>
          </div>
        )}

        {/* Collaborators List Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
          <Users size={14} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>People with Access</span>
        </div>

        {/* Collaborators List */}
        <div style={{ maxHeight: '200px', overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {permissions.length === 0 && loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
              <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
            </div>
          ) : (
            permissions.map(perm => {
              const isOwner = perm.role === 'owner';
              const isLoading = actionLoadingId === perm.id;

              return (
                <div 
                  key={perm.id} 
                  className="glass-panel" 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '10px 14px', 
                    borderRadius: '8px',
                    border: '1px solid var(--border-glass)',
                    background: 'rgba(255,255,255,0.01)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                    <div style={{ 
                      width: '28px', 
                      height: '28px', 
                      borderRadius: '50%', 
                      background: isOwner ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.05)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      color: isOwner ? 'var(--accent-primary)' : 'var(--text-secondary)'
                    }}>
                      {isOwner ? <Shield size={14} /> : <User size={14} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', textTransform: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {perm.displayName || (isOwner ? 'Owner' : 'Collaborator')}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {perm.emailAddress}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isOwner ? (
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', padding: '4px 8px', fontStyle: 'italic' }}>
                        Owner
                      </span>
                    ) : (
                      <>
                        <select
                          value={perm.role === 'writer' ? 'writer' : 'reader'}
                          onChange={e => handleRoleChange(perm.id, e.target.value as 'reader' | 'writer')}
                          disabled={isLoading}
                          style={{
                            padding: '4px 18px 4px 6px',
                            fontSize: '11.5px',
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '4px',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="reader">Viewer</option>
                          <option value="writer">Editor</option>
                        </select>

                        <button
                          className="mini-icon-btn"
                          style={{ color: '#f87171', padding: '4px' }}
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
