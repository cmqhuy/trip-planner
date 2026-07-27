import { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import type { GenericReservation } from '../types';
import { ComboBox } from './ComboBox';
import { STATUS_OPTIONS, type ReservationStatus } from '../constants/reservations';

interface GenericReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservation?: GenericReservation | null;
  groupName: string;
  onSave: (data: Omit<GenericReservation, 'id' | 'groupId'>) => void;
  onDelete?: () => void;
}

export default function GenericReservationModal({
  isOpen,
  onClose,
  reservation,
  groupName,
  onSave,
  onDelete
}: GenericReservationModalProps) {
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<ReservationStatus>('Planning');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [confirmationNo, setConfirmationNo] = useState('');
  const [bookedThrough, setBookedThrough] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTitle(reservation?.title || '');
      setStatus(reservation?.status || 'Planning');
      setDate(reservation?.date || '');
      setTime(reservation?.time || '');
      setConfirmationNo(reservation?.confirmationNo || '');
      setBookedThrough(reservation?.bookedThrough || '');
      setNotes(reservation?.notes || '');
    }
  }, [isOpen, reservation]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      status,
      date: date || undefined,
      time: time || undefined,
      confirmationNo: confirmationNo.trim() || undefined,
      bookedThrough: bookedThrough.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel scrollable" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{reservation ? 'Edit Reservation Details' : 'Add Reservation Details'}</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-scroll-body">
          <div className="form-group">
            <label>Title *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={`e.g. ${groupName} booking`}
              required
              autoFocus
            />
          </div>

          <div className="form-group" style={{ marginTop: '14px' }}>
            <label>Status</label>
            <ComboBox value={status} options={STATUS_OPTIONS} onChange={setStatus} iconSize={14} />
          </div>

          <div className="form-row" style={{ marginTop: '14px' }}>
            <div className="form-group flex-1">
              <label>Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                style={{ marginTop: '6px' }}
              />
            </div>

            <div className="form-group flex-1">
              <label>Time</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                style={{ marginTop: '6px' }}
              />
            </div>
          </div>

          <div className="form-row" style={{ marginTop: '14px' }}>
            <div className="form-group flex-1">
              <label>Confirmation #</label>
              <input
                type="text"
                value={confirmationNo}
                onChange={e => setConfirmationNo(e.target.value)}
                placeholder="Booking reference"
              />
            </div>
            <div className="form-group flex-1">
              <label>Booked Through</label>
              <input
                type="text"
                value={bookedThrough}
                onChange={e => setBookedThrough(e.target.value)}
                placeholder="e.g. Booking.com"
              />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '14px' }}>
            <label>Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={3}
            />
          </div>
          </div>

          <div className="modal-actions" style={{ marginTop: '24px' }}>
            {reservation && onDelete && (
              <button
                type="button"
                className="btn-danger flex-align"
                onClick={() => { onDelete(); onClose(); }}
                style={{ marginRight: 'auto', gap: '6px' }}
              >
                <Trash2 size={16} /> Delete
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">
              {reservation ? `Save Reservation` : 'Add Reservation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
