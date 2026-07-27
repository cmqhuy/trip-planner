import { useState, useEffect, useRef } from 'react';
import { Sparkles, RefreshCw, Trash2, MapPin, Search } from 'lucide-react';
import type { Hotel, Location, Place, ExpenseLine } from '../types';
import Modal from './Modal';
import ExpensesSection from './ExpensesSection';
import AttachmentsSection from './AttachmentsSection';
import { undoButton as undoBtn } from './UndoButton';
import { ComboBox } from './ComboBox';
import { STATUS_OPTIONS } from '../constants/reservations';
import { GeminiService, AI_NOT_CONFIGURED_MESSAGE, AI_FILE_CONTENTS_NOT_AVAILABLE_IN_MANUAL_MODE_MESSAGE } from '../utils/ai';
import MapPicker from './MapPicker';
import { useReservationAttachments } from '../utils/useReservationAttachments';
import { parseGoogleMapsUrl, fetchPlaceFromGoogleMapsUrl, searchPlacesNearLocation, geocodeAddress } from '../utils/api';

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
  catalogLocation?: Location;
}

type SavedValues = {
  name: string; address: string; checkInDate: string; checkInTime: string;
  checkOutDate: string; checkOutTime: string; confirmationNo: string; notes: string;
  bookedThrough: string; lat: string; lng: string;
  status: 'Confirmed' | 'Planning' | 'Canceled';
};

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
  catalogLocation,
}: HotelModalProps) {
  const effectiveDefaultDate = defaultDate ?? tripStartDate;

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [checkInDate, setCheckInDate] = useState(effectiveDefaultDate);
  const [checkInTime, setCheckInTime] = useState('');
  const [checkOutDate, setCheckOutDate] = useState(effectiveDefaultDate);
  const [checkOutTime, setCheckOutTime] = useState('');
  const [confirmationNo, setConfirmationNo] = useState('');
  const [bookedThrough, setBookedThrough] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [notes, setNotes] = useState('');
  const [savedValues, setSavedValues] = useState<SavedValues | null>(null);
  const [expenses, setExpenses] = useState<ExpenseLine[]>([]);

  const [status, setStatus] = useState<'Confirmed' | 'Planning' | 'Canceled'>('Confirmed');

  // Auto-populate states
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<(Omit<Place, 'placeGroupId'> & { address?: string })[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const autofillInputRef = useRef<HTMLInputElement>(null);

  const applyAiResult = async (result: any) => {
    if (result.name) setName(result.name);
    if (result.address) setAddress(result.address);
    if (result.checkInDate) setCheckInDate(result.checkInDate);
    if (result.checkInTime) setCheckInTime(result.checkInTime);
    if (result.checkOutDate) setCheckOutDate(result.checkOutDate);
    if (result.checkOutTime) setCheckOutTime(result.checkOutTime);
    if (result.confirmationNo) setConfirmationNo(result.confirmationNo);
    if (result.bookedThrough) setBookedThrough(result.bookedThrough);
    const parsed = GeminiService.parseExtractedExpenses(result, 'expense-autofill');
    if (parsed.length > 0) {
      setExpenses(prev => {
        const filtered = parsed.filter(ne => !prev.some(pe => pe.description === ne.description && pe.price === ne.price));
        return [...prev, ...filtered];
      });
    }
    if (result.notes) setNotes(result.notes);
    const fillAddress = result.address || address;
    if (fillAddress && !result.lat && !result.lng && !lat && !lng) {
      const coords = await geocodeAddress(fillAddress);
      if (coords) { setLat(coords.lat.toFixed(6)); setLng(coords.lng.toFixed(6)); }
    } else {
      if (result.lat != null) setLat(String(result.lat));
      if (result.lng != null) setLng(String(result.lng));
    }
  };

  const attach = useReservationAttachments({
    googleToken,
    tripPlannerFolderId,
    tripName,
    tripFilesFolderId,
    onFileFolderCreated,
    initialAttachments: editingHotel?.attachments ?? [],
    generateFromFiles: (files) => GeminiService.generateHotelDetailsFromFilesWithRotation(files),
    applyResult: applyAiResult,
  });
  const { attachedFiles, setAttachments, setRemovePrompt, setAiError, setShowAccessError, uploadingCount, isAiFilling, handleAutofillFileSelect } = attach;

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
      setLat(initial.lat);
      setLng(initial.lng);
      setNotes(initial.notes);
      setStatus(initial.status);
      setExpenses(h?.expenses ?? []);
      setAttachments(h?.attachments ?? []);
      setSavedValues(initial);
      setAiError(null);
      setRemovePrompt(null);
      setShowAccessError(false);
      setSearchQuery('');
      setSuggestions([]);
      setSearchError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Handle auto-populate suggestions search with debounce
  useEffect(() => {
    if (searchError) {
      setSearchError(null);
    }
    if (!searchQuery.trim() || searchQuery.length < 3) {
      setSuggestions([]);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    const { isGoogleMapsUrl } = parseGoogleMapsUrl(searchQuery);
    if (isGoogleMapsUrl) {
      setIsSearching(true);
      fetchPlaceFromGoogleMapsUrl(searchQuery, catalogLocation ?? undefined).then(({ place, error }) => {
        setIsSearching(false);
        if (error || !place) {
          setSearchError(error ?? 'Could not extract place info from this link.');
          return;
        }
        setName(place.title);
        setAddress(place.address || place.description || '');
        if (place.lat != null) setLat(place.lat.toString());
        if (place.lng != null) setLng(place.lng.toString());
        setSearchQuery('');
        setSuggestions([]);
      });
      return;
    }

    if (!catalogLocation) {
      setSuggestions([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchPlacesNearLocation(searchQuery, catalogLocation);
        setSuggestions(results);
      } catch (err) {
        console.error('Failed to search hotels:', err);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, catalogLocation]);

  // Click outside to close suggestions
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const searchInput = document.getElementById('hotel-search-input');
      const suggestionsPanel = document.querySelector('.modal-suggestions-panel');
      if (!searchInput?.contains(target) && !suggestionsPanel?.contains(target)) {
        setSuggestions([]);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleCheckInChange = (val: string) => {
    setCheckInDate(val);
    if (checkOutDate < val) setCheckOutDate(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !checkInDate || !checkOutDate) return;
    const parsedLat = lat.trim() ? parseFloat(lat) : undefined;
    const parsedLng = lng.trim() ? parseFloat(lng) : undefined;
    onSave({
      name: name.trim(),
      address: address.trim() || undefined,
      checkInDate,
      checkInTime: checkInTime || undefined,
      checkOutDate,
      checkOutTime: checkOutTime || undefined,
      confirmationNo: confirmationNo.trim() || undefined,
      bookedThrough: bookedThrough.trim() || undefined,
      lat: parsedLat,
      lng: parsedLng,
      notes: notes.trim() || undefined,
      expenses,
      attachments: attachedFiles,
      status,
    });
    onClose();
  };

  if (!isOpen) return null;



  return (
    <Modal title={editingHotel ? 'Edit Hotel Details' : 'Add Hotel Details'} onClose={onClose} maxWidth={860}>
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
            <div className="modal-search-container" id="hotel-search-input">
              <Search size={14} className="modal-search-icon" />
              <input
                type="text"
                placeholder="Type to search, or paste a Google Maps link..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="modal-search-input"
              />
              {isSearching && (
                <div className="modal-search-loader">Searching...</div>
              )}
              {suggestions.length > 0 && (
                <div className="modal-suggestions-panel">
                  {suggestions.map((sug) => (
                    <div
                      key={sug.id}
                      className="modal-suggestion-item"
                      onClick={() => {
                        setName(sug.title);
                        setAddress(sug.address || sug.description || '');
                        if (sug.lat != null) setLat(sug.lat.toString());
                        if (sug.lng != null) setLng(sug.lng.toString());
                        setSearchQuery('');
                        setSuggestions([]);
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div className="modal-suggestion-name">{sug.title}</div>
                      <div className="modal-suggestion-desc">
                        {sug.address || sug.description}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {searchError && (
              <div style={{ fontSize: '11px', color: 'var(--color-danger, #ef4444)', marginTop: '4px' }}>{searchError}</div>
            )}
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
                    <div className="input-tooltip-wrapper" data-tooltip="Show date picker" data-tooltip-position="bottom">
                      <input
                        type="date"
                        id="hotel-checkin"
                        value={checkInDate}
                        onChange={e => handleCheckInChange(e.target.value)}
                        required
                        title=""
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="hotel-checkin-time" className="place-form-label">
                      <span className="label-text">Check-In Time</span>
                      {undoBtn(checkInTime, savedValues?.checkInTime, () => setCheckInTime(savedValues!.checkInTime))}
                    </label>
                    <div className="input-tooltip-wrapper" data-tooltip="Show time picker" data-tooltip-position="bottom">
                      <input
                        type="time"
                        id="hotel-checkin-time"
                        value={checkInTime}
                        onChange={e => setCheckInTime(e.target.value)}
                        title=""
                      />
                    </div>
                  </div>
                </div>

                {/* Check-Out Date + Time */}
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="hotel-checkout" className="place-form-label">
                      <span className="label-text">Check-Out Date <span style={{ color: 'var(--color-danger)' }}>*</span></span>
                      {undoBtn(checkOutDate, savedValues?.checkOutDate, () => setCheckOutDate(savedValues!.checkOutDate))}
                    </label>
                    <div className="input-tooltip-wrapper" data-tooltip="Show date picker" data-tooltip-position="bottom">
                      <input
                        type="date"
                        id="hotel-checkout"
                        value={checkOutDate}
                        onChange={e => setCheckOutDate(e.target.value)}
                        required
                        title=""
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="hotel-checkout-time" className="place-form-label">
                      <span className="label-text">Check-Out Time</span>
                      {undoBtn(checkOutTime, savedValues?.checkOutTime, () => setCheckOutTime(savedValues!.checkOutTime))}
                    </label>
                    <div className="input-tooltip-wrapper" data-tooltip="Show time picker" data-tooltip-position="bottom">
                      <input
                        type="time"
                        id="hotel-checkout-time"
                        value={checkOutTime}
                        onChange={e => setCheckOutTime(e.target.value)}
                        title=""
                      />
                    </div>
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

                {/* Status */}
                <div className="form-group">
                  <label className="place-form-label">
                    <span className="label-text">Status</span>
                    {undoBtn(status, savedValues?.status, () => setStatus(savedValues!.status))}
                  </label>
                  <ComboBox value={status} options={STATUS_OPTIONS} onChange={setStatus} />
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

                <ExpensesSection
                  expenses={expenses}
                  onChange={setExpenses}
                />

                {/* File Attachments (only when Google signed in) */}
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
            </div>

            <div className="modal-actions modal-actions--between">
              {editingHotel && onDelete && (
                <button type="button" className="btn-danger flex-align" onClick={onDelete}>
                  <Trash2 size={14} /><span>Delete<span className="desktop-only"> Hotel</span></span>
                </button>
              )}
              <div className="modal-actions-right">
                <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn-primary">{editingHotel ? <><span>Save</span><span className="desktop-only"> Hotel</span></> : 'Add Hotel'}</button>
              </div>
            </div>
          </form>
    </Modal>
  );
}
