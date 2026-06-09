import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Trip } from '../types';
import { getDaysDiff } from '../utils/dateUtils';

interface EditTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
  onSave: (name: string, startDate: string, endDate: string) => void;
}

export default function EditTripModal({ isOpen, onClose, trip, onSave }: EditTripModalProps) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(trip.name);
      setStartDate(trip.startDate);
      setEndDate(trip.endDate);
    }
  }, [isOpen, trip]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !startDate || !endDate) return;
    onSave(name.trim(), startDate, endDate);
    onClose();
  };

  const currentDuration = getDaysDiff(trip.startDate, trip.endDate) + 1;
  const newDuration = (startDate && endDate) ? getDaysDiff(startDate, endDate) + 1 : currentDuration;
  const isShorter = newDuration < currentDuration;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Trip Details</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="edit-trip-name">Trip Name</label>
            <input 
              type="text" 
              id="edit-trip-name"
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="e.g. Summer in Europe" 
              required 
              autoFocus 
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="edit-trip-start">Start Date</label>
              <input 
                type="date" 
                id="edit-trip-start"
                value={startDate} 
                onChange={e => setStartDate(e.target.value)} 
                required 
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-trip-end">End Date</label>
              <input 
                type="date" 
                id="edit-trip-end"
                value={endDate} 
                onChange={e => setEndDate(e.target.value)} 
                required 
              />
            </div>
          </div>

          {isShorter && (
            <div 
              style={{ 
                marginTop: '16px', 
                padding: '10px 12px', 
                background: 'rgba(239, 68, 68, 0.1)', 
                borderLeft: '3px solid var(--color-danger)', 
                borderRadius: '4px',
                fontSize: '12px',
                color: '#fca5a5',
                lineHeight: 1.4,
                textTransform: 'none'
              }}
            >
              ⚠️ Warning: The new duration is shorter ({newDuration} days) than the current one ({currentDuration} days). The last {currentDuration - newDuration} day(s) of your plans will be permanently deleted.
            </div>
          )}

          <div className="modal-actions" style={{ marginTop: '24px' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
}
