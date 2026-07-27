import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, ChevronDown, MapPin, AlertTriangle, Landmark, Utensils, Search } from 'lucide-react';
import type { PlaceReservation, Location, Place, ExpenseLine, Trip } from '../types';
import ExpensesSection from './ExpensesSection';
import AttachmentsSection from './AttachmentsSection';
import { undoButton as undoBtn } from './UndoButton';
import { ComboBox, type ComboOption } from './ComboBox';
import { STATUS_OPTIONS } from '../constants/reservations';
import { useReservationAttachments } from '../utils/useReservationAttachments';
import { isPlaceReservationUnlinkedOrDeleted } from '../utils/reservationWarnings';
import { GeminiService } from '../utils/ai';
import { DEFAULT_PLACE_GROUPS } from '../utils/api';

type ReservationStatus = 'Confirmed' | 'Planning' | 'Canceled';

const TYPE_OPTIONS: ComboOption<PlaceReservation['type']>[] = [
  { value: 'attraction', label: 'Attraction', icon: Landmark, iconColor: '#ef4444' },
  { value: 'dining', label: 'Dining', icon: Utensils, iconColor: '#3b82f6' },
];

const shortDate = (d: string) =>
  new Date(d + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });


interface PlaceReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservation?: PlaceReservation | null;
  defaultType?: 'attraction' | 'dining';
  locations: Location[];
  onSave: (data: Omit<PlaceReservation, 'id'>) => void;
  onDelete?: () => void;
  defaultDate?: string;
  // Drive attachments props
  googleToken?: string;
  tripPlannerFolderId?: string;
  tripName?: string;
  tripFilesFolderId?: string;
  onFileFolderCreated?: (folderId: string) => void;
  isOwner?: boolean;
  tripDriveFileId?: string;
  trip?: Trip;
}

export default function PlaceReservationModal({
  isOpen,
  onClose,
  reservation,
  defaultType = 'attraction',
  locations,
  onSave,
  onDelete,
  defaultDate,
  googleToken,
  tripPlannerFolderId,
  tripName,
  tripFilesFolderId,
  onFileFolderCreated,
  isOwner = true,
  tripDriveFileId,
  trip
}: PlaceReservationModalProps) {
  const [type, setType] = useState<'attraction' | 'dining'>(defaultType);
  const [placeId, setPlaceId] = useState<string | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<ReservationStatus>('Confirmed');
  const [date, setDate] = useState(defaultDate || '');
  const [time, setTime] = useState('');
  const [confirmationNo, setConfirmationNo] = useState('');
  const [bookedThrough, setBookedThrough] = useState('');
  const [notes, setNotes] = useState('');
  const [expenses, setExpenses] = useState<ExpenseLine[]>([]);

  // Search query for Link to Catalog Place dropdown
  const [placeSearchQuery, setPlaceSearchQuery] = useState('');

  // Saved values snapshot for Undo buttons
  const [savedValues, setSavedValues] = useState<{
    type: 'attraction' | 'dining';
    placeId?: string;
    title: string;
    status: ReservationStatus;
    date: string;
    time: string;
    confirmationNo: string;
    bookedThrough: string;
    notes: string;
  } | null>(null);

  // Catalog-place picker (bespoke searchable combo) state & refs
  const [placePickerOpen, setPlacePickerOpen] = useState(false);
  const placeTriggerRef = useRef<HTMLButtonElement>(null);
  const [placePos, setPlacePos] = useState<{ top: number; left: number; width: number } | null>(null);

  // Drive attachments + AI file-fill
  const attach = useReservationAttachments({
    googleToken,
    tripPlannerFolderId,
    tripName,
    tripFilesFolderId,
    onFileFolderCreated,
    initialAttachments: reservation?.attachments ?? [],
    generateFromFiles: (files) => GeminiService.generatePlaceReservationDetailsFromFilesWithRotation(files),
    applyResult: (result) => {
      if (result.type) setType(result.type);
      if (result.title) setTitle(result.title);
      if (result.date) setDate(result.date);
      if (result.time) setTime(result.time);
      if (result.confirmationNo) setConfirmationNo(result.confirmationNo);
      if (result.bookedThrough) setBookedThrough(result.bookedThrough);
      if (result.notes) setNotes(result.notes);
    },
  });
  const { attachedFiles, setAttachments, setAiError } = attach;

  // Map of placeId -> array of allocated dates
  const placeAllocatedDaysMap = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!trip || !trip.plans || trip.plans.length === 0) return map;
    const activePlan = trip.plans[0];
    if (!activePlan || !activePlan.days) return map;
    Object.keys(activePlan.days).forEach(dateStr => {
      const day = activePlan.days[dateStr];
      if (day && day.placeIds) {
        day.placeIds.forEach(pId => {
          if (!map.has(pId)) map.set(pId, []);
          map.get(pId)!.push(dateStr);
        });
      }
    });
    map.forEach(dates => dates.sort());
    return map;
  }, [trip]);

  // Sort places by current order in Catalog: Location -> Group -> Place order
  const sortedCatalogPlaces = useMemo(() => {
    const groups = trip?.placeGroups || DEFAULT_PLACE_GROUPS;
    const groupOrderMap = new Map<string, number>();
    groups.forEach((g, idx) => groupOrderMap.set(g.id, idx));

    const items: { place: Place; locationName: string; locIdx: number; groupIdx: number; placeIdx: number }[] = [];

    locations.forEach((loc, locIdx) => {
      (loc.places || []).forEach((p, placeIdx) => {
        const gIdx = p.placeGroupId ? (groupOrderMap.get(p.placeGroupId) ?? 999) : 999;
        items.push({
          place: p,
          locationName: loc.city,
          locIdx,
          groupIdx: gIdx,
          placeIdx
        });
      });
    });

    items.sort((a, b) => {
      if (a.locIdx !== b.locIdx) return a.locIdx - b.locIdx;
      if (a.groupIdx !== b.groupIdx) return a.groupIdx - b.groupIdx;
      return a.placeIdx - b.placeIdx;
    });

    return items;
  }, [locations, trip]);

  // Filter places based on search query
  const filteredCatalogPlaces = useMemo(() => {
    if (!placeSearchQuery.trim()) return sortedCatalogPlaces;
    const q = placeSearchQuery.toLowerCase().trim();
    return sortedCatalogPlaces.filter(({ place, locationName }) => {
      const allocatedDates = placeAllocatedDaysMap.get(place.id) || [];
      const datesStr = allocatedDates.join(' ');
      return place.title.toLowerCase().includes(q) ||
        locationName.toLowerCase().includes(q) ||
        datesStr.includes(q);
    });
  }, [sortedCatalogPlaces, placeSearchQuery, placeAllocatedDaysMap]);

  useEffect(() => {
    if (reservation) {
      const initial = {
        type: reservation.type,
        placeId: reservation.placeId,
        title: reservation.title,
        status: reservation.status || 'Confirmed',
        date: reservation.date || defaultDate || '',
        time: reservation.time || '',
        confirmationNo: reservation.confirmationNo || '',
        bookedThrough: reservation.bookedThrough || '',
        notes: reservation.notes || '',
      };
      setSavedValues(initial);
      setType(initial.type);
      setPlaceId(initial.placeId);
      setTitle(initial.title);
      setStatus(initial.status);
      setDate(initial.date);
      setTime(initial.time);
      setConfirmationNo(initial.confirmationNo);
      setBookedThrough(initial.bookedThrough);
      setNotes(initial.notes);
      setExpenses(reservation.expenses || []);
      setAttachments(reservation.attachments || []);
    } else {
      setSavedValues(null);
      setType(defaultType);
      setPlaceId(undefined);
      setTitle('');
      setStatus('Confirmed');
      setDate(defaultDate || '');
      setTime('');
      setConfirmationNo('');
      setBookedThrough('');
      setNotes('');
      setExpenses([]);
      setAttachments([]);
    }
    setPlaceSearchQuery('');
    setAiError(null);
  }, [isOpen, reservation, defaultType, defaultDate, setAttachments]);

  if (!isOpen) return null;


  const linkedPlace = placeId ? sortedCatalogPlaces.find(cp => cp.place.id === placeId)?.place : undefined;
  const isDeletedPlace = isPlaceReservationUnlinkedOrDeleted(placeId, trip);

  const handleSelectCatalogPlace = (p: Place | undefined) => {
    if (!p) {
      setPlaceId(undefined);
    } else {
      setPlaceId(p.id);
      setTitle(p.title);
      const allocatedDates = placeAllocatedDaysMap.get(p.id) || [];
      if (allocatedDates.length > 0) {
        setDate(allocatedDates[0]);
      }
    }
    setPlacePickerOpen(false);
    setPlaceSearchQuery('');
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (linkedPlace) {
      linkedPlace.title = newTitle;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      type,
      placeId: placeId || undefined,
      title: title.trim(),
      status,
      date: date || undefined,
      time: time || undefined,
      confirmationNo: confirmationNo.trim() || undefined,
      bookedThrough: bookedThrough.trim() || undefined,
      notes: notes.trim() || undefined,
      attachments: attachedFiles,
      expenses
    });
    onClose();
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content glass-panel scrollable" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>{reservation ? 'Edit Reservation Details' : `Add ${type === 'attraction' ? 'Attraction' : 'Dining'} Reservation`}</h3>
            <button className="modal-close" onClick={onClose}><X size={20} /></button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-scroll-body">
            {/* Prominent Warning Banner for Deleted Linked Place */}
            {isDeletedPlace && (
              <div className="reservation-warning" style={{ marginBottom: '16px' }}>
                <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                <span>Linked place deleted</span>
              </div>
            )}

            {/* Row 1: Reservation Type & Linked Catalog Place */}
            <div className="form-row">
              <div className="form-group">
                <label className="place-form-label">
                  <span className="label-text">Reservation Type</span>
                  {undoBtn(type, savedValues?.type, () => setType(savedValues!.type))}
                </label>
                <ComboBox
                  value={type}
                  options={TYPE_OPTIONS}
                  onChange={setType}
                  iconSize={14}
                  minWidth={160}
                />
              </div>

              {/* Linked Catalog Place (Searchable Dropdown) */}
              <div className="form-group">
                <label className="place-form-label">
                  <span className="label-text">Link to Catalog Place</span>
                  {undoBtn(placeId, savedValues?.placeId, () => setPlaceId(savedValues!.placeId))}
                </label>
                <div className="combo-wrapper">
                  <button
                    ref={placeTriggerRef}
                    type="button"
                    className="combo-trigger"
                    onClick={() => {
                      if (!placePickerOpen && placeTriggerRef.current) {
                        const r = placeTriggerRef.current.getBoundingClientRect();
                        setPlacePos({ top: r.bottom + 4, left: r.left, width: r.width });
                      }
                      setPlacePickerOpen(o => !o);
                    }}
                  >
                    <span className="combo-trigger-content">
                      <MapPin size={14} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                        {linkedPlace ? linkedPlace.title : 'None (Standalone)'}
                      </span>
                    </span>
                    <ChevronDown size={14} className={`expand-chevron${placePickerOpen ? ' is-open' : ''}`} />
                  </button>
                </div>
                {placePickerOpen && placePos && createPortal(
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }} onClick={() => setPlacePickerOpen(false)} />
                    <div className="combo-dropdown--tz-portal" style={{ top: placePos.top, left: placePos.left, width: Math.max(placePos.width, 280), zIndex: 10000 }} onClick={e => e.stopPropagation()}>
                      <div className="tz-search-wrapper" style={{ padding: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', padding: '4px 8px' }}>
                          <Search size={12} style={{ color: 'var(--text-muted)' }} />
                          <input
                            className="tz-search-input"
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', width: '100%' }}
                            type="text"
                            placeholder="Search catalog place…"
                            value={placeSearchQuery}
                            onChange={e => setPlaceSearchQuery(e.target.value)}
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="tz-option-list scrollable" style={{ maxHeight: '200px', overflowY: 'auto', padding: '4px' }}>
                        <button
                          type="button"
                          className={`combo-option${!placeId ? ' selected' : ''}`}
                          onClick={() => handleSelectCatalogPlace(undefined)}
                        >
                          None (Standalone)
                        </button>
                        {filteredCatalogPlaces.map(({ place: cp, locationName }) => {
                          const allocatedDates = placeAllocatedDaysMap.get(cp.id) || [];
                          const dateSub = allocatedDates.length > 0 ? `${allocatedDates.map(shortDate).join(', ')} · ` : '';
                          return (
                            <button
                              key={cp.id}
                              type="button"
                              className={`combo-option${placeId === cp.id ? ' selected' : ''}`}
                              onClick={() => handleSelectCatalogPlace(cp)}
                            >
                              <span>{cp.title}</span>
                              <span style={{ opacity: 0.6, fontSize: '11px', marginLeft: 'auto', paddingLeft: '8px', whiteSpace: 'nowrap' }}>
                                ({dateSub}{locationName})
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>,
                  document.body
                )}
              </div>
            </div>

            {/* Row 2: Title (mandatory *) & Status */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="res-title" className="place-form-label">
                  <span className="label-text">Title <span style={{ color: 'var(--color-danger)' }}>*</span></span>
                  {undoBtn(title, savedValues?.title, () => setTitle(savedValues!.title))}
                </label>
                <input
                  type="text"
                  id="res-title"
                  value={title}
                  onChange={e => handleTitleChange(e.target.value)}
                  placeholder={type === 'attraction' ? 'e.g. Louvre Museum Visit' : 'e.g. Dinner at Le Meurice'}
                  required
                />
              </div>

              <div className="form-group">
                <label className="place-form-label">
                  <span className="label-text">Status</span>
                  {undoBtn(status, savedValues?.status, () => setStatus(savedValues!.status))}
                </label>
                <ComboBox value={status} options={STATUS_OPTIONS} onChange={setStatus} iconSize={14} />
              </div>
            </div>

            {/* Row 3: Date & Time */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="res-date" className="place-form-label">
                  <span className="label-text">Date</span>
                  {undoBtn(date, savedValues?.date, () => setDate(savedValues!.date))}
                </label>
                <div className="input-tooltip-wrapper" data-tooltip="Show date picker" data-tooltip-position="bottom">
                  <input
                    type="date"
                    id="res-date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="res-time" className="place-form-label">
                  <span className="label-text">Time</span>
                  {undoBtn(time, savedValues?.time, () => setTime(savedValues!.time))}
                </label>
                <div className="input-tooltip-wrapper" data-tooltip="Show time picker" data-tooltip-position="bottom">
                  <input
                    type="time"
                    id="res-time"
                    value={time}
                    onChange={e => setTime(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Row 4: Confirmation No & Booked via */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="res-conf" className="place-form-label">
                  <span className="label-text">Confirmation No</span>
                  {undoBtn(confirmationNo, savedValues?.confirmationNo, () => setConfirmationNo(savedValues!.confirmationNo))}
                </label>
                <input
                  type="text"
                  id="res-conf"
                  value={confirmationNo}
                  onChange={e => setConfirmationNo(e.target.value)}
                  placeholder="e.g. RES-987654"
                />
              </div>
              <div className="form-group">
                <label htmlFor="res-booked" className="place-form-label">
                  <span className="label-text">Booked via</span>
                  {undoBtn(bookedThrough, savedValues?.bookedThrough, () => setBookedThrough(savedValues!.bookedThrough))}
                </label>
                <input
                  type="text"
                  id="res-booked"
                  value={bookedThrough}
                  onChange={e => setBookedThrough(e.target.value)}
                  placeholder="e.g. OpenTable / Official Website"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label htmlFor="res-notes" className="place-form-label">
                <span className="label-text">Notes</span>
                {undoBtn(notes, savedValues?.notes, () => setNotes(savedValues!.notes))}
              </label>
              <textarea
                id="res-notes"
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Dress code, cancellation policy, special requests..."
              />
            </div>

            {/* Expenses Section (placed ABOVE Attachments) */}
            <div style={{ marginTop: '16px' }}>
              <ExpensesSection expenses={expenses} onChange={setExpenses} />
            </div>

            {/* File Attachments (only when Google signed in) - Placed BELOW Expenses */}
            <div style={{ marginTop: '16px' }}>
              <AttachmentsSection
                attach={attach}
                googleToken={googleToken}
                isOwner={isOwner}
                tripDriveFileId={tripDriveFileId}
                tripName={tripName}
                tripFilesFolderId={tripFilesFolderId}
              />
            </div>
            </div>

            {/* Modal Actions */}
            <div className="modal-actions modal-actions--between" style={{ marginTop: '24px' }}>
              {reservation && onDelete && (
                <button
                  type="button"
                  className="btn-danger flex-align"
                  onClick={() => { onDelete(); onClose(); }}
                >
                  <Trash2 size={14} /> Delete
                </button>
              )}
              <div className="modal-actions-right">
                <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn-primary">
                  {reservation ? `Save ${type === 'attraction' ? 'Attractions' : 'Dining'}` : 'Add Reservation'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
