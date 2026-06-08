import { useState } from 'react';
import type { Trip } from '../types';
import { Calendar, Layers, Map, Trash2, Plus, X, Cloud } from 'lucide-react';

interface TripDashboardProps {
  trips: Trip[];
  onCreateTrip: (trip: Omit<Trip, 'id' | 'locations' | 'plans' | 'placeGroups'>) => void;
  onDeleteTrip: (id: string) => void;
  onSelectTrip: (id: string) => void;
  isGoogleSignedIn?: boolean;
}

export default function TripDashboard({ trips, onCreateTrip, onDeleteTrip, onSelectTrip, isGoogleSignedIn }: TripDashboardProps) {
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !startDate || !endDate) return;

    if (new Date(startDate) > new Date(endDate)) {
      alert('Start date must be before or equal to end date.');
      return;
    }

    onCreateTrip({ name, startDate, endDate });
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
          <h2>My Vacations</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            Plan your itineraries, route options, and travel details in one place.
          </p>
        </div>
        <button className="btn-primary flex-align" onClick={() => setShowModal(true)}>
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
              Get started by creating your first vacation project.
            </p>
          </div>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
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
                  <h3 className="flex-align" style={{ gap: '6px' }}>
                    {trip.name}
                    {isGoogleSignedIn && (
                      <span title="Synced to Google Drive" style={{ display: 'inline-flex' }}>
                        <Cloud size={14} style={{ color: '#34d399' }} />
                      </span>
                    )}
                  </h3>
                  <div className="trip-card-dates">
                    <Calendar size={13} />
                    <span>{formatDate(trip.startDate)} - {formatDate(trip.endDate)}</span>
                  </div>
                </div>
                <button 
                  className="trip-delete-btn" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmModal({
                      title: 'Delete Trip',
                      message: `Are you sure you want to delete "${trip.name}"? This action cannot be undone.`,
                      onConfirm: () => onDeleteTrip(trip.id)
                    });
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="trip-card-bottom">
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
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Trip</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
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
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
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

      {confirmModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{confirmModal.title}</h3>
              <button className="modal-close" onClick={() => setConfirmModal(null)}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '16px 0', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5', textTransform: 'none' }}>
              {confirmModal.message}
            </div>
            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button type="button" className="btn-secondary" onClick={() => setConfirmModal(null)}>
                Cancel
              </button>
              <button 
                type="button" 
                className="btn-primary" 
                style={{ background: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
