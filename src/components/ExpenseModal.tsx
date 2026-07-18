import { useState, useEffect, useRef } from 'react';
import { X, Trash2, Calendar, AlertTriangle, Building, Car, ChevronDown } from 'lucide-react';
import type { ExpenseGroup, ExpenseItem, ExpenseLine, Hotel, TransportationReservation } from '../types';
import ExpensesSection from './ExpensesSection';
import { getExpenseGroupIcon } from '../utils/expenseUtils';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense?: ExpenseItem | null;
  expenseGroups: ExpenseGroup[];
  hotels: Hotel[];
  transports: TransportationReservation[];
  onSave: (data: {
    title: string;
    notes: string;
    date?: string;
    groupId: string;
    lineItems: ExpenseLine[];
  }) => void;
  onDelete?: () => void;
}

export default function ExpenseModal({
  isOpen,
  onClose,
  expense,
  expenseGroups,
  hotels,
  transports,
  onSave,
  onDelete
}: ExpenseModalProps) {
  const [title, setTitle] = useState(expense?.title || '');
  const [notes, setNotes] = useState(expense?.notes || '');
  const [date, setDate] = useState(expense?.date || '');
  const [groupId, setGroupId] = useState(expense?.groupId || expenseGroups[0]?.id || '');
  const [lineItems, setLineItems] = useState<ExpenseLine[]>(expense?.lineItems || []);

  // Combo-box state
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
  const groupDropdownRef = useRef<HTMLDivElement>(null);

  // Click outside listener for combo box
  useEffect(() => {
    if (!groupDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (!groupDropdownRef.current?.contains(e.target as Node)) {
        setGroupDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [groupDropdownOpen]);

  if (!isOpen) return null;

  const isLinked = !!expense?.linkedReservationId;
  const linkedType = expense?.linkedReservationType;
  const linkedId = expense?.linkedReservationId;

  // Retrieve linked details
  let linkedHotel: Hotel | undefined;
  let linkedTransport: TransportationReservation | undefined;
  if (isLinked) {
    if (linkedType === 'hotel') {
      linkedHotel = hotels.find(h => h.id === linkedId);
    } else if (linkedType === 'transit') {
      linkedTransport = transports.find(t => t.id === linkedId);
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (!groupId) return;

    onSave({
      title: title.trim(),
      notes: notes.trim(),
      date: isLinked ? undefined : date,
      groupId,
      lineItems
    });
    onClose();
  };

  const selectedGroup = expenseGroups.find(g => g.id === groupId);

  const getTransportSubtitle = (r: TransportationReservation) => {
    const typeStr = r.type.charAt(0).toUpperCase() + r.type.slice(1);
    if (r.segments && r.segments.length > 0) {
      const first = r.segments[0];
      const last = r.segments[r.segments.length - 1];
      const carrierStr = first.carrier ? ` (${first.carrier})` : '';
      return `${typeStr}${carrierStr}: ${first.departureLocationName} [${first.departureDate}] → ${last.arrivalLocationName} [${last.arrivalDate}]`;
    }
    return `${typeStr} Reservation`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            {isLinked ? 'Linked Reservation Expense' : expense ? 'Edit Expense' : 'Add Expense'}
          </h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {isLinked && (
          <div
            className="linked-expense-warning"
            style={{
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px dashed rgba(245, 158, 11, 0.3)',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              fontSize: '12px',
              color: '#fbbf24'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
              <AlertTriangle size={14} />
              <span>Linked to Reservation</span>
            </div>
            <p style={{ margin: 0, opacity: 0.9 }}>
              This expense is linked to a reservation. Modifying it will update the reservation details. Deleting this expense will clear the expense details from the reservation.
            </p>
            {linkedHotel && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
                <Building size={12} />
                <span>Hotel: {linkedHotel.name} ({linkedHotel.checkInDate} to {linkedHotel.checkOutDate})</span>
              </div>
            )}
            {linkedTransport && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
                <Car size={12} />
                <span>Transit: {getTransportSubtitle(linkedTransport)}</span>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Expense Name / Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Flight Ticket, Subway Pass, Disneyland Ticket"
              required
              autoFocus={!isLinked}
            />
          </div>

          <div className="form-row form-row--top">
            {/* Group Selection Combo Box */}
            <div className="form-group flex-1" ref={groupDropdownRef} style={{ position: 'relative' }}>
              <label>Group</label>
              <button
                type="button"
                className="loc-select-trigger combo-trigger"
                onClick={() => !isLinked && setGroupDropdownOpen(!groupDropdownOpen)}
                disabled={isLinked}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: isLinked ? 'rgba(255, 255, 255, 0.01)' : 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '6px',
                  cursor: isLinked ? 'not-allowed' : 'pointer',
                  color: isLinked ? 'var(--text-muted)' : 'var(--text-primary)',
                  marginTop: '6px'
                }}
              >
                <span className="combo-trigger-content" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {getExpenseGroupIcon(selectedGroup?.icon || 'dollar-sign', 14)}
                  <span>{selectedGroup?.name || 'Select Group'}</span>
                </span>
                {!isLinked && <ChevronDown size={14} className={`expand-chevron${groupDropdownOpen ? ' is-open' : ''}`} />}
              </button>

              {groupDropdownOpen && (
                <div
                  className="loc-select-dropdown combo-dropdown"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 1100,
                    background: 'rgba(15, 23, 42, 0.95)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '6px',
                    boxShadow: 'var(--shadow-lg), 0 4px 20px rgba(0,0,0,0.5)',
                    marginTop: '4px',
                    maxHeight: '180px',
                    overflowY: 'auto',
                    padding: '4px'
                  }}
                >
                  {expenseGroups.map(g => (
                    <button
                      key={g.id}
                      type="button"
                      className={`combo-option${g.id === groupId ? ' selected' : ''}`}
                      onClick={() => {
                        setGroupId(g.id);
                        setGroupDropdownOpen(false);
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 10px',
                        border: 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                        borderRadius: '4px'
                      }}
                    >
                      {getExpenseGroupIcon(g.icon, 14)}
                      <span>{g.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Date Selection - only for manual/non-linked expenses */}
            {!isLinked && (
              <div className="form-group flex-1">
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={13} />
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  style={{ marginTop: '6px', width: '100%' }}
                />
              </div>
            )}
          </div>

          <div className="form-group" style={{ marginTop: '14px' }}>
            <label>Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add details, notes or payment instructions..."
              rows={2}
              style={{ marginTop: '6px', resize: 'vertical' }}
            />
          </div>

          <div style={{ marginTop: '16px', borderTop: '1px dashed var(--border-glass)', paddingTop: '16px' }}>
            <ExpensesSection
              expenses={lineItems}
              onChange={setLineItems}
            />
          </div>

          <div className="modal-actions" style={{ marginTop: '24px' }}>
            {expense && onDelete && (
              <button
                type="button"
                className="btn-danger flex-align"
                onClick={onDelete}
                style={{ marginRight: 'auto', gap: '6px' }}
              >
                <Trash2 size={16} /> Delete
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">
              {expense ? 'Save Changes' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
