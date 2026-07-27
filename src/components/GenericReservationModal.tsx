import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, ChevronDown } from 'lucide-react';
import type { GenericReservation } from '../types';
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

  const [statusOpen, setStatusOpen] = useState(false);
  const [statusPos, setStatusPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const statusTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(reservation?.title || '');
      setStatus(reservation?.status || 'Planning');
      setDate(reservation?.date || '');
      setTime(reservation?.time || '');
      setConfirmationNo(reservation?.confirmationNo || '');
      setBookedThrough(reservation?.bookedThrough || '');
      setNotes(reservation?.notes || '');
      setStatusOpen(false);
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

  const openStatusDropdown = () => {
    const r = statusTriggerRef.current!.getBoundingClientRect();
    setStatusPos({ top: r.bottom + 4, left: r.left, width: r.width });
    setStatusOpen(true);
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
            <div className="combo-wrapper">
              <button
                ref={statusTriggerRef}
                type="button"
                className="combo-trigger"
                onClick={openStatusDropdown}
              >
                <span className="combo-trigger-content">
                  {(() => {
                    const Icon = STATUS_OPTIONS.find(s => s.value === status)?.Icon;
                    return Icon ? <Icon size={14} /> : null;
                  })()}
                  {status}
                </span>
                <ChevronDown size={14} className={`expand-chevron${statusOpen ? ' is-open' : ''}`} />
              </button>
            </div>
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

      {statusOpen && statusPos && createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }} onClick={() => setStatusOpen(false)} />
          <div
            className="combo-dropdown--portal"
            style={{ top: statusPos.top, left: statusPos.left, width: statusPos.width, zIndex: 10000 }}
            onClick={e => e.stopPropagation()}
          >
            {STATUS_OPTIONS.map(({ value, Icon }) => (
              <button
                key={value}
                type="button"
                className={`combo-option${status === value ? ' selected' : ''}`}
                onClick={() => { setStatus(value); setStatusOpen(false); }}
              >
                <Icon size={14} /> {value}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
