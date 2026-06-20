import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, RotateCcw, RefreshCw, Paperclip, Trash2, ChevronDown, MapPin, ExternalLink, Share2, Pencil, Check } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import ShareTripModal from './ShareTripModal';
import type { Hotel } from '../types';
import { GeminiService, AI_NOT_CONFIGURED_MESSAGE, AI_FILE_CONTENTS_NOT_AVAILABLE_IN_MANUAL_MODE_MESSAGE } from '../utils/ai';
import { CURRENCY_LIST } from '../utils/currencies';
import MapPicker from './MapPicker';
import { fetchFileContentFromDrive, uploadFile, getOrCreateTripFileFolder } from '../utils/googleDrive';
import { useDriveAttachments } from '../utils/useDriveAttachments';

interface HotelModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripStartDate: string;
  onSave: (hotelData: Omit<Hotel, 'id'>) => void;
  onDelete?: () => void;
  editingHotel?: Hotel | null;
  googleToken?: string;
  tripPlannerFolderId?: string;
  tripName?: string;
  tripFilesFolderId?: string;
  onFileFolderCreated?: (folderId: string) => void;
  isOwner?: boolean;
  tripDriveFileId?: string;
  defaultDate?: string;
}

type SavedValues = {
  name: string; address: string; checkInDate: string; checkInTime: string;
  checkOutDate: string; checkOutTime: string; confirmationNo: string; notes: string;
  bookedThrough: string; price: string; currency: string; lat: string; lng: string;
  status: 'Confirmed' | 'Planning' | 'Canceled';
};

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal, headers: { 'Accept-Language': 'en' } });
    clearTimeout(timeout);
    const data = await res.json();
    if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    return null;
  } catch { return null; }
}

export default function HotelModal({
  isOpen,
  onClose,
  tripStartDate,
  onSave,
  onDelete,
  editingHotel,
  googleToken,
  tripPlannerFolderId,
  tripName,
  tripFilesFolderId,
  onFileFolderCreated,
  isOwner = true,
  tripDriveFileId,
  defaultDate,
}: HotelModalProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkInTime, setCheckInTime] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');
  const [confirmationNo, setConfirmationNo] = useState('');
  const [bookedThrough, setBookedThrough] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [notes, setNotes] = useState('');
  const [isAiFilling, setIsAiFilling] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [savedValues, setSavedValues] = useState<SavedValues | null>(null);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [currencyPos, setCurrencyPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [showAccessError, setShowAccessError] = useState(false);
  const [showShareFolder, setShowShareFolder] = useState(false);
  const [editingChip, setEditingChip] = useState<{ fileId: string; value: string } | null>(null);

  const [status, setStatus] = useState<'Confirmed' | 'Planning' | 'Canceled'>('Confirmed');
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusPos, setStatusPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const autofillInputRef = useRef<HTMLInputElement>(null);
  const currencyTriggerRef = useRef<HTMLButtonElement>(null);
  const statusTriggerRef = useRef<HTMLButtonElement>(null);

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
    initialAttachments: editingHotel?.attachments ?? [],
    onSetAiError: setAiError,
    onAccessError: () => setShowAccessError(true),
  });

  useEffect(() => {
    if (isOpen) {
      const h = editingHotel;
      const initial: SavedValues = {
        name: h?.name ?? '',
        address: h?.address ?? '',
        checkInDate: h?.checkInDate ?? defaultDate ?? tripStartDate,
        checkInTime: h?.checkInTime ?? '',
        checkOutDate: h?.checkOutDate ?? defaultDate ?? tripStartDate,
        checkOutTime: h?.checkOutTime ?? '',
        confirmationNo: h?.confirmationNo ?? '',
        bookedThrough: h?.bookedThrough ?? '',
        price: h?.price != null ? String(h.price) : '',
        currency: h?.currency ?? 'USD',
        lat: h?.lat != null ? String(h.lat) : '',
        lng: h?.lng != null ? String(h.lng) : '',
        notes: h?.notes ?? '',
        status: h ? (h.status || 'Planning') : 'Confirmed',
      };
      setName(initial.name);
      setAddress(initial.address);
      setCheckInDate(initial.checkInDate);
      setCheckInTime(initial.checkInTime);
      setCheckOutDate(initial.checkOutDate);
      setCheckOutTime(initial.checkOutTime);
      setConfirmationNo(initial.confirmationNo);
      setBookedThrough(initial.bookedThrough);
      setPrice(initial.price);
      setCurrency(initial.currency);
      setLat(initial.lat);
      setLng(initial.lng);
      setNotes(initial.notes);
      setStatus(initial.status);
      setAttachments(h?.attachments ?? []);
      setSavedValues(initial);
      setAiError(null);
      setRemovePrompt(null);
      setCurrencyOpen(false);
      setStatusOpen(false);
      setShowAccessError(false);
      setShowShareFolder(false);
      setEditingChip(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleCheckInChange = (val: string) => {
    setCheckInDate(val);
    if (checkOutDate < val) setCheckOutDate(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !checkInDate || !checkOutDate) return;
    const parsedLat = lat.trim() ? parseFloat(lat) : undefined;
    const parsedLng = lng.trim() ? parseFloat(lng) : undefined;
    const parsedPrice = price.trim() ? parseFloat(price) : undefined;
    onSave({
      name: name.trim(),
      address: address.trim() || undefined,
      checkInDate,
      checkInTime: checkInTime || undefined,
      checkOutDate,
      checkOutTime: checkOutTime || undefined,
      confirmationNo: confirmationNo.trim() || undefined,
      bookedThrough: bookedThrough.trim() || undefined,
      price: parsedPrice,
      currency: parsedPrice != null ? currency : undefined,
      lat: parsedLat,
      lng: parsedLng,
      notes: notes.trim() || undefined,
      attachments: attachedFiles,
      status,
    });
    onClose();
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
      const result = await GeminiService.generateHotelDetailsFromFilesWithRotation(fileContents);
      if (result.name) setName(result.name);
      if (result.address) setAddress(result.address);
      if (result.checkInDate) setCheckInDate(result.checkInDate);
      if (result.checkInTime) setCheckInTime(result.checkInTime);
      if (result.checkOutDate) setCheckOutDate(result.checkOutDate);
      if (result.checkOutTime) setCheckOutTime(result.checkOutTime);
      if (result.confirmationNo) setConfirmationNo(result.confirmationNo);
      if (result.bookedThrough) setBookedThrough(result.bookedThrough);
      if (result.price != null) setPrice(String(result.price));
      if (result.currency) setCurrency(result.currency);
      if (result.notes) setNotes(result.notes);
      const fillAddress = result.address || address;
      if (fillAddress && !result.lat && !result.lng && !lat && !lng) {
        const coords = await geocodeAddress(fillAddress);
        if (coords) { setLat(coords.lat.toFixed(6)); setLng(coords.lng.toFixed(6)); }
      } else {
        if (result.lat != null) setLat(String(result.lat));
        if (result.lng != null) setLng(String(result.lng));
      }
    } catch (err: any) {
      setAiError(err.message || 'AI fill failed.');
    } finally {
      setIsAiFilling(false);
    }
  };

  const handleAutofillFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = '';

    const file = files[0];
    setIsAiFilling(true);
    setAiError(null);

    try {
      // 1. Read file locally as base64
      const fileData = await new Promise<{ base64: string; mimeType: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const result = reader.result as string;
          const commaIdx = result.indexOf(',');
          const base64 = commaIdx > -1 ? result.substring(commaIdx + 1) : result;
          resolve({ base64, mimeType: file.type || 'application/octet-stream' });
        };
        reader.onerror = () => reject(new Error('Failed to read file locally.'));
      });

      // 2. Upload file to Drive if googleToken is present
      if (googleToken) {
        let folderId = tripFilesFolderId;
        if (!folderId && tripPlannerFolderId && tripName) {
          folderId = await getOrCreateTripFileFolder(googleToken, tripPlannerFolderId, tripName);
          onFileFolderCreated?.(folderId);
        }
        if (folderId) {
          const fileId = await uploadFile(googleToken, folderId, file);
          const newAttachment = { name: file.name, filename: file.name, fileId };
          setAttachments(prev => [...prev, newAttachment]);
        }
      }

      // 3. Extract details using AI
      const result = await GeminiService.generateHotelDetailsFromFilesWithRotation([fileData]);
      if (result.name) setName(result.name);
      if (result.address) setAddress(result.address);
      if (result.checkInDate) setCheckInDate(result.checkInDate);
      if (result.checkInTime) setCheckInTime(result.checkInTime);
      if (result.checkOutDate) setCheckOutDate(result.checkOutDate);
      if (result.checkOutTime) setCheckOutTime(result.checkOutTime);
      if (result.confirmationNo) setConfirmationNo(result.confirmationNo);
      if (result.bookedThrough) setBookedThrough(result.bookedThrough);
      if (result.price != null) setPrice(String(result.price));
      if (result.currency) setCurrency(result.currency);
      if (result.notes) setNotes(result.notes);
      
      const fillAddress = result.address || address;
      if (fillAddress && !result.lat && !result.lng && !lat && !lng) {
        const coords = await geocodeAddress(fillAddress);
        if (coords) { setLat(coords.lat.toFixed(6)); setLng(coords.lng.toFixed(6)); }
      } else {
        if (result.lat != null) setLat(String(result.lat));
        if (result.lng != null) setLng(String(result.lng));
      }
    } catch (err: any) {
      setAiError(err.message || 'AI autofill failed.');
    } finally {
      setIsAiFilling(false);
    }
  };

  const undoBtn = (current: string, saved: string | undefined, onRestore: () => void) => {
    if (saved === undefined || current === saved) return null;
    return (
      <button type="button" className="undo-btn" onClick={onRestore} data-tooltip="Restore original value">
        <RotateCcw size={11} />
      </button>
    );
  };

  if (!isOpen) return null;

  const selectedCurrency = CURRENCY_LIST.find(c => c.code === currency) ?? { code: currency, name: currency };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content glass-panel scrollable" style={{ maxWidth: '860px' }} onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>{editingHotel ? 'Edit Hotel Details' : 'Add Hotel Details'}</h3>
            <button className="modal-close" onClick={onClose}><X size={20} /></button>
          </div>

          {/* Suggestions Search / Auto-Populate */}
          <div className="modal-autofill-panel">
            <div className="flex-between">
              <label>Auto-Populate Details</label>
              <div
                data-tooltip={
                  !GeminiService.isAiEnabled() ? AI_NOT_CONFIGURED_MESSAGE :
                  GeminiService.isManualMode() ? AI_FILE_CONTENTS_NOT_AVAILABLE_IN_MANUAL_MODE_MESSAGE :
                  'Upload a receipt or confirmation to fill details using AI'
                }
                data-tooltip-position="bottom"
                className="flex-align"
              >
                <button
                  type="button"
                  className="btn-secondary flex-align"
                  style={{
                    fontSize: '11px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    gap: '5px',
                    borderColor: 'rgba(139, 92, 246, 0.25)',
                    background: 'rgba(139, 92, 246, 0.06)',
                    cursor: (!GeminiService.isAiEnabled() || GeminiService.isManualMode() || uploadingCount > 0 || isAiFilling) ? 'not-allowed' : 'pointer'
                  }}
                  onClick={() => autofillInputRef.current?.click()}
                  disabled={!GeminiService.isAiEnabled() || GeminiService.isManualMode() || uploadingCount > 0 || isAiFilling}
                >
                  {isAiFilling ? <RefreshCw size={11} className="spin" /> : <Sparkles size={11} />}
                  {isAiFilling ? 'Generating...' : uploadingCount > 0 ? 'Uploading...' : 'Upload & Auto-Fill'}
                </button>
                <input
                  ref={autofillInputRef}
                  type="file"
                  className="visually-hidden"
                  accept="image/*,application/pdf,.eml,.txt"
                  onChange={handleAutofillFileSelect}
                  disabled={!GeminiService.isAiEnabled() || GeminiService.isManualMode() || uploadingCount > 0 || isAiFilling}
                />
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-scroll-body">
            <div className="place-form-grid">

              {/* Left column */}
              <div className="place-form-left-col">

                {/* Hotel Name */}
                <div className="form-group">
                  <label htmlFor="hotel-name" className="place-form-label">
                    <span className="label-text">Hotel Name <span style={{ color: 'var(--color-danger)' }}>*</span></span>
                    {undoBtn(name, savedValues?.name, () => setName(savedValues!.name))}
                  </label>
                  <input
                    type="text"
                    id="hotel-name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                </div>

                {/* Address */}
                <div className="form-group">
                  <label htmlFor="hotel-address" className="place-form-label">
                    <span className="label-text">Address</span>
                    {undoBtn(address, savedValues?.address, () => setAddress(savedValues!.address))}
                  </label>
                  <input
                    type="text"
                    id="hotel-address"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                  />
                </div>

                {/* Check-In Date + Time */}
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="hotel-checkin" className="place-form-label">
                      <span className="label-text">Check-In Date <span style={{ color: 'var(--color-danger)' }}>*</span></span>
                      {undoBtn(checkInDate, savedValues?.checkInDate, () => setCheckInDate(savedValues!.checkInDate))}
                    </label>
                    <input
                      type="date"
                      id="hotel-checkin"
                      value={checkInDate}
                      onChange={e => handleCheckInChange(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="hotel-checkin-time" className="place-form-label">
                      <span className="label-text">Check-In Time</span>
                      {undoBtn(checkInTime, savedValues?.checkInTime, () => setCheckInTime(savedValues!.checkInTime))}
                    </label>
                    <input
                      type="time"
                      id="hotel-checkin-time"
                      value={checkInTime}
                      onChange={e => setCheckInTime(e.target.value)}
                    />
                  </div>
                </div>

                {/* Check-Out Date + Time */}
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="hotel-checkout" className="place-form-label">
                      <span className="label-text">Check-Out Date <span style={{ color: 'var(--color-danger)' }}>*</span></span>
                      {undoBtn(checkOutDate, savedValues?.checkOutDate, () => setCheckOutDate(savedValues!.checkOutDate))}
                    </label>
                    <input
                      type="date"
                      id="hotel-checkout"
                      value={checkOutDate}
                      onChange={e => setCheckOutDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="hotel-checkout-time" className="place-form-label">
                      <span className="label-text">Check-Out Time</span>
                      {undoBtn(checkOutTime, savedValues?.checkOutTime, () => setCheckOutTime(savedValues!.checkOutTime))}
                    </label>
                    <input
                      type="time"
                      id="hotel-checkout-time"
                      value={checkOutTime}
                      onChange={e => setCheckOutTime(e.target.value)}
                    />
                  </div>
                </div>

                {/* Confirmation No + Booked via */}
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="hotel-conf" className="place-form-label">
                      <span className="label-text">Confirmation No</span>
                      {undoBtn(confirmationNo, savedValues?.confirmationNo, () => setConfirmationNo(savedValues!.confirmationNo))}
                    </label>
                    <input
                      type="text"
                      id="hotel-conf"
                      value={confirmationNo}
                      onChange={e => setConfirmationNo(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="hotel-booked" className="place-form-label">
                      <span className="label-text">Booked via</span>
                      {undoBtn(bookedThrough, savedValues?.bookedThrough, () => setBookedThrough(savedValues!.bookedThrough))}
                    </label>
                    <input
                      type="text"
                      id="hotel-booked"
                      value={bookedThrough}
                      onChange={e => setBookedThrough(e.target.value)}
                      placeholder="e.g. Booking.com"
                    />
                  </div>
                </div>

                {/* Price + Currency */}
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="hotel-price" className="place-form-label">
                      <span className="label-text">Price</span>
                      {undoBtn(price, savedValues?.price, () => setPrice(savedValues!.price))}
                    </label>
                    <input
                      type="number"
                      id="hotel-price"
                      value={price}
                      onChange={e => setPrice(e.target.value)}
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="form-group">
                    <label className="place-form-label">
                      <span className="label-text">Currency</span>
                      {undoBtn(currency, savedValues?.currency, () => setCurrency(savedValues!.currency))}
                    </label>
                    <div className="combo-wrapper">
                      <button
                        ref={currencyTriggerRef}
                        type="button"
                        className="combo-trigger"
                        onClick={() => {
                          if (!currencyOpen && currencyTriggerRef.current) {
                            const r = currencyTriggerRef.current.getBoundingClientRect();
                            setCurrencyPos({ top: r.bottom + 4, left: r.left, width: r.width });
                          }
                          setCurrencyOpen(o => !o);
                        }}
                      >
                        <span className="combo-trigger-content">{selectedCurrency.code} — {selectedCurrency.name}</span>
                        <ChevronDown size={14} className={`expand-chevron${currencyOpen ? ' is-open' : ''}`} />
                      </button>
                    </div>
                    {currencyOpen && currencyPos && createPortal(
                      <>
                        <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }} onClick={() => setCurrencyOpen(false)} />
                        <div className="combo-dropdown--portal" style={{ top: currencyPos.top, left: currencyPos.left, width: Math.max(currencyPos.width, 220) }} onClick={e => e.stopPropagation()}>
                          {CURRENCY_LIST.map(c => (
                            <button
                              key={c.code}
                              type="button"
                              className={`combo-option${c.code === currency ? ' selected' : ''}`}
                              onClick={() => { setCurrency(c.code); setCurrencyOpen(false); }}
                            >
                              {c.code} — {c.name}
                            </button>
                          ))}
                        </div>
                      </>,
                      document.body
                    )}
                  </div>
                </div>

                {/* Status */}
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
                      <span className="combo-trigger-content">{status}</span>
                      <ChevronDown size={14} className={`expand-chevron${statusOpen ? ' is-open' : ''}`} />
                    </button>
                  </div>
                  {statusOpen && statusPos && createPortal(
                    <>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }} onClick={() => setStatusOpen(false)} />
                      <div className="combo-dropdown--portal" style={{ top: statusPos.top, left: statusPos.left, width: Math.max(statusPos.width, 150) }} onClick={e => e.stopPropagation()}>
                        {(['Confirmed', 'Planning', 'Canceled'] as const).map(s => (
                          <button
                            key={s}
                            type="button"
                            className={`combo-option${s === status ? ' selected' : ''}`}
                            onClick={() => { setStatus(s); setStatusOpen(false); }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </>,
                    document.body
                  )}
                </div>

              </div>

              {/* Right column — Coordinates, Map, Notes, Attachments */}
              <div className="place-form-right-col">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="hotel-lat" className="place-form-label">
                      <span className="label-text">Latitude</span>
                      {undoBtn(lat, savedValues?.lat, () => setLat(savedValues!.lat))}
                    </label>
                    <input
                      type="text"
                      id="hotel-lat"
                      value={lat}
                      onChange={e => setLat(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="hotel-lng" className="place-form-label">
                      <span className="label-text">Longitude</span>
                      {undoBtn(lng, savedValues?.lng, () => setLng(savedValues!.lng))}
                    </label>
                    <input
                      type="text"
                      id="hotel-lng"
                      value={lng}
                      onChange={e => setLng(e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-group form-group--mb16">
                  <label className="place-form-label">
                    <MapPin size={13} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                    <span className="label-text">Click on the map to set coordinates</span>
                  </label>
                  <MapPicker
                    lat={parseFloat(lat)}
                    lng={parseFloat(lng)}
                    onPick={(pickedLat, pickedLng) => {
                      setLat(pickedLat.toFixed(6));
                      setLng(pickedLng.toFixed(6));
                    }}
                  />
                </div>

                {/* Notes */}
                <div className="form-group">
                  <label htmlFor="hotel-notes" className="place-form-label">
                    <span className="label-text">Notes</span>
                    {undoBtn(notes, savedValues?.notes, () => setNotes(savedValues!.notes))}
                  </label>
                  <textarea
                    id="hotel-notes"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                  />
                </div>

                {/* File Attachments (only when Google signed in) */}
                {googleToken && (
                  <div className="attachment-section">
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
              </div>

            </div>
            </div>

            <div className="modal-actions modal-actions--between">
              {editingHotel && onDelete && (
                <button type="button" className="btn-danger flex-align" onClick={onDelete}>
                  <Trash2 size={14} /> Delete Hotel
                </button>
              )}
              <div className="modal-actions-right">
                <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn-primary">{editingHotel ? 'Save Hotel' : 'Add Hotel'}</button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {showShareFolder && googleToken && tripFilesFolderId && (
        <ShareTripModal
          accessToken={googleToken}
          folderId={tripFilesFolderId}
          folderDisplayName={tripName ? `${tripName}_files` : tripFilesFolderId}
          onClose={() => setShowShareFolder(false)}
        />
      )}

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

      {/* Remove file prompt */}
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
