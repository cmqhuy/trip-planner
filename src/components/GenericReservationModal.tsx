import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, ChevronDown, Check, Timer } from 'lucide-react';
import type { GenericReservation } from '../types';

type ReservationStatus = 'Confirmed' | 'Planning' | 'Canceled';

const STATUS_OPTIONS: ReservationStatus[] = ['Confirmed', 'Planning', 'Canceled'];

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

  const statusColor = status === 'Confirmed' ? '#10b981' : status === 'Canceled' ? '#ef4444' : 'var(--text-secondary)';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{reservation ? 'Edit Reservation Details' : 'Add Reservation Details'}</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
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

          <div className="form-row" style={{ marginTop: '14px' }}>
            <div className="form-group flex-1">
              <label>Status</label>
              <button
                type="button"
                ref={statusTriggerRef}
                className="loc-select-trigger combo-trigger"
                onClick={openStatusDropdown}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  marginTop: '6px'
                }}
              >
                <div className="combo-trigger-content" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {status === 'Confirmed' ? <Check size={13} style={{ color: statusColor }} /> : <Timer size={13} style={{ color: statusColor }} />}
                  <span style={{ color: statusColor }}>{status}</span>
                </div>
                <ChevronDown size={14} className={`expand-chevron${statusOpen ? ' is-open' : ''}`} />
              </button>
            </div>

            <div className="form-group flex-1">
              <label>Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                style={{ marginTop: '6px' }}
              />
            </div>

            <div className="form-group" style={{ width: '110px' }}>
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
              {reservation ? 'Save Changes' : 'Add Reservation'}
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
          >
            {STATUS_OPTIONS.map(s => (
              <button
                key={s}
                type="button"
                className={`combo-option${status === s ? ' selected' : ''}`}
                onClick={() => { setStatus(s); setStatusOpen(false); }}
              >
                {s === 'Confirmed' ? <Check size={13} /> : <Timer size={13} />}
                {s}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
