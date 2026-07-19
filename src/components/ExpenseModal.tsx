import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, Calendar, AlertTriangle, Building, Car, ChevronDown, Plane, Train, Bus, Anchor, Navigation, ExternalLink } from 'lucide-react';
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
  onOpenReservation?: () => void;
}

function TransportTypeIcon({ type, size = 12, className }: { type: string; size?: number; className?: string }) {
  switch (type) {
    case 'flight': return <Plane size={size} className={className} />;
    case 'train': return <Train size={size} className={className} />;
    case 'bus': return <Bus size={size} className={className} />;
    case 'car': return <Car size={size} className={className} />;
    case 'ferry': return <Anchor size={size} className={className} />;
    default: return <Navigation size={size} className={className} />;
  }
}

export default function ExpenseModal({
  isOpen,
  onClose,
  expense,
  expenseGroups,
  hotels,
  transports,
  onSave,
  onDelete,
  onOpenReservation
}: ExpenseModalProps) {
  const [title, setTitle] = useState(expense?.title || '');
  const [notes, setNotes] = useState(expense?.notes || '');
  const [date, setDate] = useState(expense?.date || '');
  const [groupId, setGroupId] = useState(expense?.groupId || expenseGroups[0]?.id || '');
  const [lineItems, setLineItems] = useState<ExpenseLine[]>(expense?.lineItems || []);

  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
  const [groupDropdownPos, setGroupDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const groupTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(expense?.title || '');
      setNotes(expense?.notes || '');
      setDate(expense?.date || '');
      setGroupId(expense?.groupId || expenseGroups[0]?.id || '');
      setLineItems(expense?.lineItems || []);
      setGroupDropdownOpen(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isLinked = !!expense?.linkedReservationId;
  const linkedType = expense?.linkedReservationType;
  const linkedId = expense?.linkedReservationId;

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

  const openGroupDropdown = () => {
    if (isLinked) return;
    const r = groupTriggerRef.current!.getBoundingClientRect();
    setGroupDropdownPos({ top: r.bottom + 4, left: r.left, width: r.width });
    setGroupDropdownOpen(true);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel scrollable" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            {isLinked ? 'Linked Expense' : (expense && expense.id) ? 'Edit Expense Details' : 'Add Expense Details'}
          </h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-scroll-body">
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
                    <Building size={12} className="flex-shrink-0" />
                    <span>Hotel: {linkedHotel.name} ({linkedHotel.checkInDate} to {linkedHotel.checkOutDate})</span>
                  </div>
                )}
                {linkedTransport && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
                    <TransportTypeIcon type={linkedTransport.type} size={12} className="flex-shrink-0" />
                    <span>Transit: {getTransportSubtitle(linkedTransport)}</span>
                  </div>
                )}
                {onOpenReservation && (
                  <button
                    type="button"
                    className="linked-expense-open-btn"
                    onClick={onOpenReservation}
                  >
                    <ExternalLink size={12} />
                    Open Reservation
                  </button>
                )}
              </div>
            )}

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
              <div className="form-group flex-1" style={{ position: 'relative' }}>
                <label>Group</label>
                <button
                  ref={groupTriggerRef}
                  type="button"
                  className="loc-select-trigger combo-trigger"
                  onClick={openGroupDropdown}
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
              </div>

              {/* Date Selection - only for manual/non-linked expenses */}
              {!isLinked && (
                <div className="form-group flex-1">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={13} />
                    Date
                  </label>
                  <div className="input-tooltip-wrapper" data-tooltip="Show date picker" data-tooltip-position="bottom" style={{ marginTop: '6px' }}>
                    <input
                      type="date"
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      style={{ width: '100%' }}
                      title=""
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add details, notes or payment instructions..."
                rows={2}
                style={{ marginTop: '6px', resize: 'vertical' }}
              />
            </div>

            <ExpensesSection
              expenses={lineItems}
              onChange={setLineItems}
            />
          </div>

          <div className="modal-actions">
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
              {(expense && expense.id) ? 'Save Changes' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>

      {groupDropdownOpen && groupDropdownPos && createPortal(<>
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }} onClick={() => setGroupDropdownOpen(false)} />
        <div
          className="combo-dropdown--portal"
          style={{ top: groupDropdownPos.top, left: groupDropdownPos.left, width: Math.max(groupDropdownPos.width, 200) }}
        >
          {expenseGroups.map(g => (
            <button
              key={g.id}
              type="button"
              className={`combo-option${g.id === groupId ? ' selected' : ''}`}
              onClick={() => { setGroupId(g.id); setGroupDropdownOpen(false); }}
            >
              {getExpenseGroupIcon(g.icon, 14)}
              <span>{g.name}</span>
            </button>
          ))}
        </div>
      </>, document.body)}
    </div>
  );
}
