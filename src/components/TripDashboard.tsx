import { useState } from 'react';
import type { Trip } from '../types';
import { Calendar, Layers, Map, Trash2, Plus, X, Cloud, Share2, LogOut, Users, Edit2, FolderOpen } from 'lucide-react';
import { shiftTripDates, getDaysDiff } from '../utils/dateUtils';
import ConfirmationModal from './ConfirmationModal';
import EditTripModal from './EditTripModal';

interface TripDashboardProps {
  trips: Trip[];
  onCreateTrip: (trip: Omit<Trip, 'id' | 'locations' | 'plans' | 'placeGroups'>) => void;
  onDeleteTrip: (id: string) => void;
  onSelectTrip: (id: string) => void;
  isGoogleSignedIn?: boolean;
  onShareTrip?: (trip: Trip) => void;
  onLeaveTrip?: (trip: Trip) => void;
  onUpdateTrip?: (trip: Trip) => void;
  onImportSharedTrip?: (urlOrId: string) => Promise<void>;
  onOpenGooglePicker?: () => Promise<string | null>;
}

export default function TripDashboard({ 
  trips, 
  onCreateTrip, 
  onDeleteTrip, 
  onSelectTrip, 
  isGoogleSignedIn = false,
  onShareTrip,
  onLeaveTrip,
  onUpdateTrip,
  onImportSharedTrip,
  onOpenGooglePicker
}: TripDashboardProps) {
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    isAlert?: boolean;
    confirmText?: string;
    onConfirm: () => void;
  } | null>(null);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);

  const [showImportModal, setShowImportModal] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');

  const handleOpenImportModal = () => {
    setShareLink('');
    setImportError('');
    setIsImporting(false);
    setShowImportModal(true);
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareLink.trim() || !onImportSharedTrip) return;

    setIsImporting(true);
    setImportError('');
    try {
      await onImportSharedTrip(shareLink);
      setShowImportModal(false);
    } catch (err: any) {
      setImportError(err.message || 'An error occurred during import.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleOpenPickerClick = async () => {
    if (!onOpenGooglePicker || !onImportSharedTrip) return;
    setIsImporting(true);
    setImportError('');
    try {
      const fileId = await onOpenGooglePicker();
      if (fileId) {
        await onImportSharedTrip(fileId);
        setShowImportModal(false);
      }
    } catch (err: any) {
      setImportError(err.message || 'An error occurred using Google Picker.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingTrip(null);
    setName('');
    setStartDate('');
    setEndDate('');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setName('');
    setStartDate('');
    setEndDate('');
    setShowModal(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !startDate || !endDate) return;

    if (new Date(startDate) > new Date(endDate)) {
      setConfirmModal({
        title: 'Invalid Dates',
        message: 'Start date must be before or equal to end date.',
        isAlert: true,
        confirmText: 'OK',
        onConfirm: () => {}
      });
      return;
    }

    onCreateTrip({ name, startDate, endDate });
    setName('');
    setStartDate('');
    setEndDate('');
    setShowModal(false);
  };

  const handleSaveEditTrip = (name: string, startDate: string, endDate: string) => {
    if (!editingTrip) return;

    if (new Date(startDate) > new Date(endDate)) {
      setConfirmModal({
        title: 'Invalid Dates',
        message: 'Start date must be before or equal to end date.',
        isAlert: true,
        confirmText: 'OK',
        onConfirm: () => {}
      });
      return;
    }

    const currentDuration = getDaysDiff(editingTrip.startDate, editingTrip.endDate) + 1;
    const newDuration = getDaysDiff(startDate, endDate) + 1;

    const performSave = () => {
      const updatedTrip = shiftTripDates(editingTrip, startDate, endDate);
      updatedTrip.name = name.trim();
      onUpdateTrip && onUpdateTrip(updatedTrip);
      setEditingTrip(null);
    };

    if (newDuration < currentDuration) {
      setConfirmModal({
        title: 'Shorten Trip Duration',
        message: `Are you sure you want to shorten the trip? The last ${currentDuration - newDuration} day(s) of your plan will be permanently deleted.`,
        confirmText: 'Shorten',
        onConfirm: performSave
      });
    } else {
      performSave();
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const cleanDateStr = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`;
    const d = new Date(cleanDateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const calculateDays = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const diff = Math.abs(e.getTime() - s.getTime());
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
    return days === 1 ? '1 day' : `${days} days`;
  };

  // Pre-generate nice gradients for cards based on trip index
  const gradients = [
    'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)',
    'linear-gradient(135deg, #062f4f 0%, #000000 100%)',
    'linear-gradient(135deg, #093028 0%, #237a57 100%)',
    'linear-gradient(135deg, #2c3e50 0%, #3498db 100%)',
    'linear-gradient(135deg, #1f4037 0%, #99f2c8 100%)'
  ];

  return (
    <div className="dashboard-view">
      <div className="dashboard-header">
        <div>
          <h2>My Trips</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            Plan your itineraries, route options, and travel details in one place.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isGoogleSignedIn && (
            <button className="btn-secondary flex-align" onClick={handleOpenImportModal}>
              <Users size={18} /> Import Shared Trip
            </button>
          )}
          <button className="btn-primary flex-align" onClick={handleOpenCreateModal}>
            <Plus size={18} /> New Trip
          </button>
        </div>
      </div>

      {trips.length === 0 ? (
        <div 
          className="glass-panel" 
          style={{ 
            padding: '60px 20px', 
            textAlign: 'center', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            gap: '16px',
            background: 'rgba(30, 41, 59, 0.2)'
          }}
        >
          <Map size={48} style={{ color: 'var(--text-muted)' }} />
          <div>
            <h3 style={{ fontSize: '20px', marginBottom: '6px' }}>No Trips Planned Yet</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              Get started by creating your first trip project.
            </p>
          </div>
          <button className="btn-primary" onClick={handleOpenCreateModal}>
            Plan A Trip
          </button>
        </div>
      ) : (
        <div className="trips-grid">
          {trips.map((trip, idx) => (
            <div 
              key={trip.id} 
              className="trip-card glass-panel"
              style={{ background: gradients[idx % gradients.length] }}
              onClick={() => onSelectTrip(trip.id)}
            >
              <div className="trip-card-top">
                <div>
                  <h3 className="flex-align" style={{ gap: '6px', flexWrap: 'wrap' }}>
                    <span>{trip.name}</span>
                    {isGoogleSignedIn && trip.driveFileId && (
                      <span data-tooltip="Synced to Google Drive" style={{ display: 'inline-flex', marginLeft: '4px' }}>
                        <Cloud size={14} style={{ color: '#34d399' }} />
                      </span>
                    )}
                    {trip.shared && (
                      <span data-tooltip="Shared Trip" style={{ display: 'inline-flex', marginLeft: '4px' }}>
                        <Users size={14} style={{ color: '#60a5fa' }} />
                      </span>
                    )}
                  </h3>

                  <div className="trip-card-dates" style={{ marginTop: '4px' }}>
                    <Calendar size={13} />
                    <span>{formatDate(trip.startDate)} - {formatDate(trip.endDate)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={e => e.stopPropagation()}>
                  {trip.isOwner === false ? (
                    <button 
                      className="trip-delete-btn" 
                      style={{ 
                        color: '#ef4444',
                        width: '28px',
                        height: '28px',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '6px'
                      }}
                      onClick={() => {
                        setConfirmModal({
                          title: 'Leave Trip',
                          message: `Are you sure you want to leave the shared trip "${trip.name}"? You will lose access to it.`,
                          confirmText: 'Leave',
                          onConfirm: () => onLeaveTrip && onLeaveTrip(trip)
                        });
                      }}
                      data-tooltip="Leave Trip"
                    >
                      <LogOut size={16} />
                    </button>
                  ) : (
                    <button 
                      className="trip-delete-btn" 
                      style={{ 
                        width: '28px',
                        height: '28px',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '6px'
                      }}
                      onClick={() => {
                        setConfirmModal({
                          title: 'Delete Trip',
                          message: trip.shared 
                            ? `This trip is shared with other users. Deleting it will remove access for everyone. Are you sure you want to delete "${trip.name}"?`
                            : `Are you sure you want to delete "${trip.name}"? This action cannot be undone.`,
                          confirmText: 'Delete',
                          onConfirm: () => onDeleteTrip(trip.id)
                        });
                      }}
                      data-tooltip="Delete Trip"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div className="trip-card-bottom" style={{ marginBottom: '12px' }}>
                <div className="trip-card-stats">
                  <span className="flex-align">
                    <Layers size={12} /> {trip.plans.length} {trip.plans.length === 1 ? 'Plan' : 'Plans'}
                  </span>
                  <span className="flex-align">
                    <Map size={12} /> {trip.locations.length} {trip.locations.length === 1 ? 'Location' : 'Locations'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                  {trip.isOwner === false && (
                    <span 
                      style={{ 
                        position: 'absolute',
                        bottom: 'calc(100% + 4px)',
                        right: 0,
                        whiteSpace: 'nowrap',
                        fontSize: '9px', 
                        padding: '2px 6px', 
                        borderRadius: '4px', 
                        background: 'rgba(96, 165, 250, 0.15)', 
                        color: '#60a5fa', 
                        fontWeight: 600
                      }}
                    >
                      {trip.canEdit === false ? 'Viewer' : 'Editor'}
                    </span>
                  )}
                  <div 
                    style={{ 
                      fontSize: '12px', 
                      fontWeight: 600, 
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      background: 'rgba(255,255,255,0.1)' 
                    }}
                  >
                    {calculateDays(trip.startDate, trip.endDate)}
                  </div>
                </div>
              </div>

              <div 
                className="trip-card-actions" 
                onClick={e => e.stopPropagation()} 
                style={{ 
                  display: 'flex', 
                  gap: '8px', 
                  paddingTop: '12px', 
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)' 
                }}
              >
                <button 
                  className="btn-primary flex-align"
                  style={{ 
                    flex: 1, 
                    padding: '6px 12px', 
                    fontSize: '12px', 
                    height: '30px', 
                    justifyContent: 'center', 
                    gap: '6px',
                    borderRadius: '6px'
                  }}
                  onClick={() => onSelectTrip(trip.id)}
                >
                  Open
                </button>
                {trip.isOwner !== false && (
                  <>
                    <button 
                      className="btn-secondary flex-align"
                      style={{ 
                        flex: 1, 
                        padding: '6px 12px', 
                        fontSize: '12px', 
                        height: '30px', 
                        justifyContent: 'center', 
                        gap: '6px',
                        borderRadius: '6px'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTrip(trip);
                      }}
                    >
                      <Edit2 size={13} /> Edit
                    </button>
                    {isGoogleSignedIn && trip.driveFileId && (
                      <button 
                        className="btn-secondary flex-align"
                        style={{ 
                          flex: 1, 
                          padding: '6px 12px', 
                          fontSize: '12px', 
                          height: '30px', 
                          justifyContent: 'center', 
                          gap: '6px',
                          borderRadius: '6px'
                        }}
                        onClick={() => onShareTrip && onShareTrip(trip)}
                      >
                        <Share2 size={13} /> Share
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Trip</h3>
              <button className="modal-close" onClick={handleCloseModal}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="trip-name">Trip Name</label>
                <input 
                  type="text" 
                  id="trip-name" 
                  placeholder="e.g. Summer in Europe, Tokyo Explorer" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  required 
                  autoFocus
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="start-date">Start Date</label>
                  <input 
                    type="date" 
                    id="start-date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="end-date">End Date</label>
                  <input 
                    type="date" 
                    id="end-date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)}
                    required 
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Trip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Import Shared Trip</h3>
              <button className="modal-close" onClick={() => setShowImportModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleImportSubmit}>
              {isGoogleSignedIn && onOpenGooglePicker && (
                <div style={{ marginBottom: '16px' }}>
                  <button
                    type="button"
                    className="btn-primary flex-align"
                    style={{ gap: '8px', width: '100%', justifyContent: 'center', padding: '10px' }}
                    onClick={handleOpenPickerClick}
                    disabled={isImporting}
                  >
                    <FolderOpen size={16} />
                    Select File from Google Drive
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0 8px 0', color: 'var(--text-muted)', fontSize: '11px' }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border-glass)' }}></div>
                    <span style={{ padding: '0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>or paste manually</span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border-glass)' }}></div>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="share-link">Google Drive Share Link or File ID</label>
                <input 
                  type="text" 
                  id="share-link" 
                  placeholder="Paste GDrive link or file ID here..." 
                  value={shareLink} 
                  onChange={(e) => setShareLink(e.target.value)}
                  required={!isGoogleSignedIn} 
                  autoFocus={!isGoogleSignedIn}
                />
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                  Paste a link like `https://drive.google.com/file/d/...` or the raw file ID.
                  Ensure the owner has shared the file with your Google account.
                </p>
              </div>

              {importError && (
                <div style={{ color: '#ef4444', fontSize: '13px', marginTop: '8px' }}>
                  {importError}
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowImportModal(false)} disabled={isImporting}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isImporting || (!isGoogleSignedIn && !shareLink.trim())}>
                  {isImporting ? 'Importing...' : 'Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingTrip && (
        <EditTripModal
          isOpen={editingTrip !== null}
          onClose={() => setEditingTrip(null)}
          trip={editingTrip}
          onSave={handleSaveEditTrip}
        />
      )}

      <ConfirmationModal
        isOpen={confirmModal !== null}
        title={confirmModal?.title || ''}
        message={confirmModal?.message || ''}
        isAlert={confirmModal?.isAlert}
        confirmText={confirmModal?.confirmText}
        onConfirm={() => {
          confirmModal?.onConfirm();
          setConfirmModal(null);
        }}
        onCancel={() => setConfirmModal(null)}
      />
    </div>
  );
}
