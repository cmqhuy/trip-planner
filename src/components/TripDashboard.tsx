import { useState } from 'react';
import type { Trip } from '../types';
import { Calendar, Layers, Map, Trash2, Plus, X, Cloud, Share2, LogOut, Users, Edit2 } from 'lucide-react';
import { shiftTripDates } from '../utils/dateUtils';
import ConfirmationModal from './ConfirmationModal';

interface TripDashboardProps {
  trips: Trip[];
  onCreateTrip: (trip: Omit<Trip, 'id' | 'locations' | 'plans' | 'placeGroups'>) => void;
  onDeleteTrip: (id: string) => void;
  onSelectTrip: (id: string) => void;
  isGoogleSignedIn?: boolean;
  onShareTrip?: (trip: Trip) => void;
  onLeaveTrip?: (trip: Trip) => void;
  onUpdateTrip?: (trip: Trip) => void;
}

export default function TripDashboard({ 
  trips, 
  onCreateTrip, 
  onDeleteTrip, 
  onSelectTrip, 
  isGoogleSignedIn,
  onShareTrip,
  onLeaveTrip,
  onUpdateTrip
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

  const handleOpenCreateModal = () => {
    setEditingTrip(null);
    setName('');
    setStartDate('');
    setEndDate('');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setEditingTrip(null);
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

    if (editingTrip) {
      const updatedTrip = shiftTripDates(editingTrip, startDate, endDate);
      updatedTrip.name = name;
      onUpdateTrip && onUpdateTrip(updatedTrip);
    } else {
      onCreateTrip({ name, startDate, endDate });
    }
    
    setEditingTrip(null);
    setName('');
    setStartDate('');
    setEndDate('');
    setShowModal(false);
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
        <button className="btn-primary flex-align" onClick={handleOpenCreateModal}>
          <Plus size={18} /> New Trip
        </button>
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
                    {trip.isOwner === false && (
                      <span 
                        style={{ 
                          fontSize: '9px', 
                          padding: '2px 6px', 
                          borderRadius: '4px', 
                          background: 'rgba(96, 165, 250, 0.15)', 
                          color: '#60a5fa', 
                          marginLeft: '6px',
                          fontWeight: 600
                        }}
                      >
                        {trip.canEdit === false ? 'Viewer' : 'Editor'}
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

              <div className="trip-card-bottom" style={{ marginBottom: trip.isOwner !== false ? '12px' : '0' }}>
                <div className="trip-card-stats">
                  <span className="flex-align">
                    <Layers size={12} /> {trip.plans.length} {trip.plans.length === 1 ? 'Plan' : 'Plans'}
                  </span>
                  <span className="flex-align">
                    <Map size={12} /> {trip.locations.length} {trip.locations.length === 1 ? 'Location' : 'Locations'}
                  </span>
                </div>
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

              {trip.isOwner !== false && (
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
                      setName(trip.name);
                      setStartDate(trip.startDate);
                      setEndDate(trip.endDate);
                      setShowModal(true);
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
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingTrip ? 'Edit Trip' : 'Create Trip'}</h3>
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
                  {editingTrip ? 'Save Changes' : 'Create Trip'}
                </button>
              </div>
            </form>
          </div>
        </div>
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
