import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, ChevronDown, Check, Timer, MapPin, Paperclip, AlertTriangle, Landmark, Utensils, Share2, Pencil, ExternalLink, Sparkles, RefreshCw, RotateCcw, Search } from 'lucide-react';
import type { PlaceReservation, Location, Place, ExpenseLine, Trip } from '../types';
import ExpensesSection from './ExpensesSection';
import ShareTripModal from './ShareTripModal';
import ConfirmationModal from './ConfirmationModal';
import { useDriveAttachments } from '../utils/useDriveAttachments';
import { fetchFileContentFromDrive } from '../utils/googleDrive';
import { isPlaceReservationUnlinkedOrDeleted } from '../utils/reservationWarnings';
import { GeminiService, AI_NOT_CONFIGURED_MESSAGE, AI_FILE_CONTENTS_NOT_AVAILABLE_IN_MANUAL_MODE_MESSAGE } from '../utils/ai';
import { DEFAULT_PLACE_GROUPS } from '../utils/api';

type ReservationStatus = 'Confirmed' | 'Planning' | 'Canceled';

const STATUS_OPTIONS: { value: ReservationStatus; Icon: any }[] = [
  { value: 'Confirmed', Icon: Check },
  { value: 'Planning', Icon: Timer },
  { value: 'Canceled', Icon: X },
];

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

  // Attachments state
  const [editingChip, setEditingChip] = useState<{ fileId: string; value: string } | null>(null);
  const [showShareFolder, setShowShareFolder] = useState(false);
  const [showAccessError, setShowAccessError] = useState(false);
  const [isAiFilling, setIsAiFilling] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Dropdown states & refs for portal placement
  const [typeOpen, setTypeOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [placePickerOpen, setPlacePickerOpen] = useState(false);

  const typeTriggerRef = useRef<HTMLButtonElement>(null);
  const statusTriggerRef = useRef<HTMLButtonElement>(null);
  const placeTriggerRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [typePos, setTypePos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [statusPos, setStatusPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [placePos, setPlacePos] = useState<{ top: number; left: number; width: number } | null>(null);

  // Drive attachments hook
  const {
    attachedFiles,
    setAttachments,
    uploadingCount,
    removePrompt,
    setRemovePrompt,
    handleFileSelect,
    handleRemoveChip,
    confirmRemoveChip,
    renameAttachment,
  } = useDriveAttachments({
    googleToken,
    tripPlannerFolderId,
    tripName,
    tripFilesFolderId,
    onFileFolderCreated,
    initialAttachments: reservation?.attachments ?? [],
    onSetAiError: (err) => setAiError(err),
    onAccessError: () => setShowAccessError(true),
  });

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

  const undoBtn = (current: string | undefined, saved: string | undefined, onRestore: () => void) => {
    if (saved === undefined || current === saved) return null;
    return (
      <button type="button" className="undo-btn" onClick={onRestore} data-tooltip="Restore original value">
        <RotateCcw size={11} />
      </button>
    );
  };

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

  const handleAiFill = async () => {
    if (!googleToken || attachedFiles.length === 0) return;
    if (!GeminiService.isAiEnabled() || GeminiService.isManualMode()) return;
    setIsAiFilling(true);
    setAiError(null);
    try {
      const fileContents = await Promise.all(
        attachedFiles.map(f => fetchFileContentFromDrive(googleToken!, f.fileId))
      );
      const result = await GeminiService.generatePlaceReservationDetailsFromFilesWithRotation(fileContents);
      if (result.type) setType(result.type);
      if (result.title) setTitle(result.title);
      if (result.date) setDate(result.date);
      if (result.time) setTime(result.time);
      if (result.confirmationNo) setConfirmationNo(result.confirmationNo);
      if (result.bookedThrough) setBookedThrough(result.bookedThrough);
      if (result.notes) setNotes(result.notes);
    } catch (err: any) {
      setAiError(err.message || 'AI fill failed.');
    } finally {
      setIsAiFilling(false);
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
            {/* Prominent Warning Banner for Deleted Linked Place */}
            {isDeletedPlace && (
              <div className="reservation-warning" style={{ marginBottom: '16px' }}>
                <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                <span>Linked catalog place has been deleted</span>
              </div>
            )}

            {/* Row 1: Reservation Type & Linked Catalog Place */}
            <div className="form-row">
              <div className="form-group">
                <label className="place-form-label">
                  <span className="label-text">Reservation Type</span>
                  {undoBtn(type, savedValues?.type, () => setType(savedValues!.type))}
                </label>
                <div className="combo-wrapper">
                  <button
                    ref={typeTriggerRef}
                    type="button"
                    className="combo-trigger"
                    onClick={() => {
                      if (!typeOpen && typeTriggerRef.current) {
                        const r = typeTriggerRef.current.getBoundingClientRect();
                        setTypePos({ top: r.bottom + 4, left: r.left, width: r.width });
                      }
                      setTypeOpen(o => !o);
                    }}
                  >
                    <span className="combo-trigger-content">
                      {type === 'attraction' ? <Landmark size={14} style={{ color: '#ef4444' }} /> : <Utensils size={14} style={{ color: '#3b82f6' }} />}
                      {type === 'attraction' ? 'Attraction' : 'Dining'}
                    </span>
                    <ChevronDown size={14} className={`expand-chevron${typeOpen ? ' is-open' : ''}`} />
                  </button>
                </div>
                {typeOpen && typePos && createPortal(
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }} onClick={() => setTypeOpen(false)} />
                    <div className="combo-dropdown--portal" style={{ top: typePos.top, left: typePos.left, width: Math.max(typePos.width, 160) }} onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        className={`combo-option${type === 'attraction' ? ' selected' : ''}`}
                        onClick={() => { setType('attraction'); setTypeOpen(false); }}
                      >
                        <Landmark size={14} style={{ color: '#ef4444' }} /> Attraction
                      </button>
                      <button
                        type="button"
                        className={`combo-option${type === 'dining' ? ' selected' : ''}`}
                        onClick={() => { setType('dining'); setTypeOpen(false); }}
                      >
                        <Utensils size={14} style={{ color: '#3b82f6' }} /> Dining
                      </button>
                    </div>
                  </>,
                  document.body
                )}
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
                          const dateSub = allocatedDates.length > 0 ? `${allocatedDates.join(', ')} · ` : '';
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
                <div className="combo-wrapper">
                  <button
                    ref={statusTriggerRef}
                    type="button"
                    className="combo-trigger"
                    onClick={() => {
                      if (!statusOpen && statusTriggerRef.current) {
                        const r = statusTriggerRef.current.getBoundingClientRect();
                        setStatusPos({ top: r.bottom + 4, left: r.left, width: r.width });
                      }
                      setStatusOpen(o => !o);
                    }}
                  >
                    <span className="combo-trigger-content">
                      {(() => {
                        const opt = STATUS_OPTIONS.find(s => s.value === status);
                        const Icon = opt?.Icon || Check;
                        return <Icon size={14} />;
                      })()}
                      {status}
                    </span>
                    <ChevronDown size={14} className={`expand-chevron${statusOpen ? ' is-open' : ''}`} />
                  </button>
                </div>
                {statusOpen && statusPos && createPortal(
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }} onClick={() => setStatusOpen(false)} />
                    <div className="combo-dropdown--portal" style={{ top: statusPos.top, left: statusPos.left, width: Math.max(statusPos.width, 150) }} onClick={e => e.stopPropagation()}>
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
            {googleToken && (
              <div className="attachment-section" style={{ marginTop: '16px' }}>
                <div className="attachment-header-row">
                  <span className="attachment-section-label">Attachments</span>
                  <div className="attachment-header-actions">
                    {attachedFiles.length > 0 && (
                      <button
                        type="button"
                        className="modal-ai-fill-btn modal-ai-fill-btn--inline"
                        onClick={handleAiFill}
                        disabled={isAiFilling || !GeminiService.isAiEnabled() || GeminiService.isManualMode()}
                        data-tooltip={
                          !GeminiService.isAiEnabled() ? AI_NOT_CONFIGURED_MESSAGE :
                          GeminiService.isManualMode() ? AI_FILE_CONTENTS_NOT_AVAILABLE_IN_MANUAL_MODE_MESSAGE :
                          undefined
                        }
                        data-tooltip-position="bottom"
                      >
                        {isAiFilling ? <RefreshCw size={13} className="spin" /> : <Sparkles size={13} />}
                        {isAiFilling ? 'Generating…' : 'Fill Details with AI'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="mini-icon-btn flex-align"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingCount > 0}
                    >
                      <Paperclip size={13} />
                      {uploadingCount > 0 ? `Uploading…` : 'Attach Files'}
                    </button>
                  </div>
                </div>
                {isOwner && tripDriveFileId && (
                  <p className="attachment-share-notice">
                    For shared users to access attachments, share the trip folder with them.
                    {tripFilesFolderId && (
                      <button type="button" className="attachment-share-btn" onClick={() => setShowShareFolder(true)}>
                        <Share2 size={11} /> Share Folder
                      </button>
                    )}
                  </p>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,application/pdf,.eml,.txt"
                  className="visually-hidden"
                  onChange={handleFileSelect}
                />
                {attachedFiles.length > 0 && (
                  <div className="attachment-chip-list">
                    {attachedFiles.map(f => (
                      <span key={f.fileId} className="attachment-chip">
                        {editingChip?.fileId === f.fileId ? (
                          <>
                            <input
                              className="attachment-chip-edit-input"
                              value={editingChip.value}
                              onChange={e => setEditingChip({ fileId: f.fileId, value: e.target.value })}
                              onKeyDown={e => {
                                if (e.key === 'Enter') { renameAttachment(f.fileId, editingChip.value.trim() || (f.filename ?? f.name)); setEditingChip(null); }
                                if (e.key === 'Escape') setEditingChip(null);
                              }}
                              autoFocus
                            />
                            <button
                              type="button"
                              className="attachment-chip-action"
                              onClick={() => { renameAttachment(f.fileId, editingChip.value.trim() || (f.filename ?? f.name)); setEditingChip(null); }}
                              data-tooltip="Save name"
                            >
                              <Check size={10} />
                            </button>
                          </>
                        ) : (
                          <>
                            <a
                              href={`https://drive.google.com/file/d/${f.fileId}/view`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="attachment-chip-name"
                              data-tooltip={f.filename && f.filename !== f.name ? f.filename : 'Open file'}
                            >
                              <ExternalLink size={10} />
                              <span className="attachment-chip-filename">{f.name}</span>
                            </a>
                            <button
                              type="button"
                              className="attachment-chip-action"
                              onClick={() => setEditingChip({ fileId: f.fileId, value: f.name })}
                              data-tooltip="Rename file"
                            >
                              <Pencil size={10} />
                            </button>
                            <button
                              type="button"
                              className="attachment-chip-remove"
                              onClick={() => handleRemoveChip(f)}
                              data-tooltip="Remove file"
                            >
                              <X size={10} />
                            </button>
                          </>
                        )}
                      </span>
                    ))}
                  </div>
                )}
                {aiError && <p className="form-error-text">{aiError}</p>}
              </div>
            )}

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
                  {reservation ? 'Save Changes' : 'Add Reservation'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Share Trip Folder Modal */}
      {showShareFolder && googleToken && tripFilesFolderId && (
        <ShareTripModal
          accessToken={googleToken}
          folderId={tripFilesFolderId}
          folderDisplayName={tripName ? `${tripName}_files` : tripFilesFolderId}
          onClose={() => setShowShareFolder(false)}
        />
      )}

      {/* Upload Access Error Modal */}
      {showAccessError && (
        <ConfirmationModal
          isOpen={true}
          isAlert={true}
          title="Cannot Upload File"
          message="You don't have write access to this trip's folder. Please ask the trip owner to share the trip folder with you."
          onConfirm={() => setShowAccessError(false)}
          onCancel={() => setShowAccessError(false)}
        />
      )}

      {/* Remove File Confirmation Prompt */}
      {removePrompt && (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => setRemovePrompt(null)}>
          <div className="modal-content glass-panel" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Remove File</h3>
              <button className="modal-close" onClick={() => setRemovePrompt(null)}><X size={20} /></button>
            </div>
            <p className="modal-body-text">What should happen to <strong>{removePrompt.name}</strong> on Google Drive?</p>
            <div className="modal-actions modal-actions--column">
              <button className="btn-danger" onClick={() => confirmRemoveChip('delete')}>
                <Trash2 size={14} /> Delete from Drive
              </button>
              <button className="btn-secondary" onClick={() => confirmRemoveChip('archive')}>
                Archive on Drive (rename with [Archived])
              </button>
              <button className="btn-secondary" onClick={() => confirmRemoveChip('keep')}>
                Keep on Drive, remove link only
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
