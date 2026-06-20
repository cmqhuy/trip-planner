import { useState } from 'react';
import type { Trip } from '../types';
import { Calendar, Layers, Map, Trash2, Plus, X, Cloud, Share2, LogOut, Users, Edit2, Loader2 } from 'lucide-react';
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
  onOpenGooglePicker?: (searchQuery?: string) => Promise<string | null>;
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
  const [importFileName, setImportFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');

  const handleOpenImportModal = () => {
    setImportFileName('');
    setImportError('');
    setIsImporting(false);
    setShowImportModal(true);
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = importFileName.trim();
    if (!query || !onOpenGooglePicker || !onImportSharedTrip) return;

    setIsImporting(true);
    setImportError('');
    try {
      const fileId = await onOpenGooglePicker(query);
      if (fileId) {
        await onImportSharedTrip(fileId);
        setShowImportModal(false);
      }
    } catch (err: any) {
      setImportError(err.message || 'An error occurred during import.');
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
          <p className="dashboard-header-desc">
            Plan your itineraries, route options, and travel details in one place.
          </p>
        </div>
        <div className="dashboard-header-buttons">
          {isGoogleSignedIn && (
            <button className="btn-secondary flex-align" onClick={handleOpenImportModal}>
              <Users size={18} /> <span className="desktop-only">Import Shared Trip</span><span className="mobile-only">Import Trip</span>
            </button>
          )}
          <button className="btn-primary flex-align" onClick={handleOpenCreateModal}>
            <Plus size={18} /> New Trip
          </button>
        </div>
      </div>

      {trips.length === 0 ? (
        <div className="glass-panel dashboard-empty-state">
          <Map size={48} className="text-muted" />
          <div>
            <h3 className="dashboard-empty-title">No Trips Planned Yet</h3>
            <p className="dashboard-empty-desc">
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
              <div className="trip-card-top trip-card-top--gap">
                <div className="flex-1 min-w-0">
                  <h3 className="flex-align trip-card-name-h3">
                    <span className="trip-card-name-text">{trip.name}</span>
                    {isGoogleSignedIn && trip.driveFileId && (
                      <span data-tooltip="Synced to Google Drive" className="trip-card-icon-badge">
                        <Cloud size={14} className="text-synced" />
                      </span>
                    )}
                    {trip.shared && (
                      <span data-tooltip="Shared Trip" className="trip-card-icon-badge">
                        <Users size={14} className="text-shared-trip" />
                      </span>
                    )}
                  </h3>

                  <div className="trip-card-dates trip-card-dates--mt">
                    <Calendar size={13} />
                    <span>{formatDate(trip.startDate)} - {formatDate(trip.endDate)}</span>
                  </div>
                </div>
                <div className="trip-card-actions-row" onClick={e => e.stopPropagation()}>
                  {trip.isOwner === false ? (
                    <button
                      className="trip-delete-btn trip-delete-btn--leave"
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
                      className="trip-delete-btn trip-delete-btn--compact"
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

              <div className="trip-card-bottom trip-card-bottom--mb">
                <div className="trip-card-stats">
                  <span className="flex-align">
                    <Layers size={12} /> {trip.plans.length} {trip.plans.length === 1 ? 'Plan' : 'Plans'}
                  </span>
                  <span className="flex-align">
                    <Map size={12} /> {trip.locations.length} {trip.locations.length === 1 ? 'Location' : 'Locations'}
                  </span>
                </div>
                <div className="trip-card-days-wrapper">
                  {trip.isOwner === false && (
                    <span className="trip-owner-badge">
                      {trip.canEdit === false ? 'Viewer' : 'Editor'}
                    </span>
                  )}
                  <div className="trip-days-badge">
                    {calculateDays(trip.startDate, trip.endDate)}
                  </div>
                </div>
              </div>

              <div
                className="trip-card-actions trip-card-actions-bar"
                onClick={e => e.stopPropagation()}
              >
                <button
                  className="btn-primary flex-align trip-card-action-btn"
                  onClick={() => onSelectTrip(trip.id)}
                >
                  Open
                </button>
                {trip.isOwner !== false && (
                  <>
                    <button
                      className="btn-secondary flex-align trip-card-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTrip(trip);
                      }}
                    >
                      <Edit2 size={13} /> Edit
                    </button>
                    {isGoogleSignedIn && trip.driveFileId && (
                      <button
                        className="btn-secondary flex-align trip-card-action-btn"
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

      {/* Footer */}
      <footer className="dashboard-footer">
        <a
          href="?page=privacy"
          className="dashboard-footer-link"
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(148,163,184,0.9)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(148,163,184,0.5)')}
        >
          Privacy Policy
        </a>
        <span>·</span>
        <a
          href="?page=terms"
          className="dashboard-footer-link"
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(148,163,184,0.9)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(148,163,184,0.5)')}
        >
          Terms of Service
        </a>
      </footer>

      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
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
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal-content glass-panel modal-content--import" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header modal-header--mb16">
              <h3 className="import-modal-title">
                <span className="desktop-only">Import Shared Trip</span>
                <span className="mobile-only">Import Trip</span>
              </h3>
              <button className="modal-close" onClick={() => setShowImportModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleImportSubmit}>
              <p className="import-modal-desc">
                To import a shared trip, please enter the file name below.
                If you don't have the file name, please ask the trip owner to share it with you.
                Clicking <strong className="text-primary">Import</strong> will search Google Drive for this file.
              </p>

              <div className="form-group">
                <label htmlFor="import-filename" className="import-label">Shared File Name</label>
                <input
                  type="text"
                  id="import-filename"
                  placeholder="Paste file name (e.g. trip-xxxx.json) here..."
                  value={importFileName}
                  onChange={(e) => setImportFileName(e.target.value)}
                  required
                  autoFocus
                  disabled={isImporting}
                  className="import-file-input"
                />
              </div>

              {importError && (
                <div className="import-error-panel">
                  {importError}
                </div>
              )}

              <div className="modal-actions modal-actions--import">
                <button
                  type="button"
                  className="btn-secondary import-modal-btn"
                  onClick={() => setShowImportModal(false)}
                  disabled={isImporting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-align import-modal-btn"
                  disabled={isImporting || !importFileName.trim()}
                >
                  {isImporting ? <Loader2 size={14} className="animate-spin" /> : null}
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
