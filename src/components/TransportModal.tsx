import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X, ChevronDown, Plane, Train, Bus, Car, Anchor, Navigation,
  Sparkles, RefreshCw, RotateCcw, Paperclip, Trash2, MapPin, ExternalLink, Share2, Pencil, Check,
} from 'lucide-react';
import type { Transportation } from '../types';
import { GeminiService, AI_NOT_CONFIGURED_MESSAGE, AI_FILE_CONTENTS_NOT_AVAILABLE_IN_MANUAL_MODE_MESSAGE } from '../utils/ai';
import { CURRENCY_LIST } from '../utils/currencies';
import { lookupTimezone } from '../utils/api';
import DualMapPicker from './DualMapPicker';
import { fetchFileContentFromDrive } from '../utils/googleDrive';
import { useDriveAttachments } from '../utils/useDriveAttachments';
import { ALL_TIMEZONES, getBrowserTimezone, formatTimezoneLabel } from '../utils/timezones';
import ConfirmationModal from './ConfirmationModal';
import ShareTripModal from './ShareTripModal';

interface TransportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripStartDate: string;
  tripEndDate: string;
  onSave: (transportData: Omit<Transportation, 'id'>) => void;
  onDelete?: () => void;
  editingTransport?: Transportation | null;
  googleToken?: string;
  tripPlannerFolderId?: string;
  tripName?: string;
  tripFilesFolderId?: string;
  onFileFolderCreated?: (folderId: string) => void;
  isOwner?: boolean;
  tripDriveFileId?: string;
}

const TRANSPORT_TYPES: { value: Transportation['type']; label: string; Icon: React.ElementType }[] = [
  { value: 'flight', label: 'Flight', Icon: Plane },
  { value: 'train', label: 'Train', Icon: Train },
  { value: 'bus', label: 'Bus', Icon: Bus },
  { value: 'car', label: 'Car Rental / Drive', Icon: Car },
  { value: 'ferry', label: 'Ferry', Icon: Anchor },
  { value: 'other', label: 'Other', Icon: Navigation },
];

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

type SavedValues = {
  transitName: string; type: Transportation['type']; depLoc: string; arrLoc: string;
  depDate: string; arrDate: string; depTime: string; arrTime: string;
  depTz: string; arrTz: string; carrier: string; transitCode: string;
  confirmationNo: string; bookedThrough: string; price: string; currency: string;
  depAddress: string; depLat: string; depLng: string;
  arrAddress: string; arrLat: string; arrLng: string;
  notes: string;
};

export default function TransportModal({
  isOpen,
  onClose,
  tripStartDate,
  onSave,
  onDelete,
  editingTransport,
  googleToken,
  tripPlannerFolderId,
  tripName,
  tripFilesFolderId,
  onFileFolderCreated,
  isOwner = true,
  tripDriveFileId,
}: TransportModalProps) {
  const browserTz = getBrowserTimezone();

  const [transitName, setTransitName] = useState('');
  const [type, setType] = useState<Transportation['type']>('flight');
  const [depLoc, setDepLoc] = useState('');
  const [arrLoc, setArrLoc] = useState('');
  const [depDate, setDepDate] = useState('');
  const [arrDate, setArrDate] = useState('');
  const [depTime, setDepTime] = useState('');
  const [arrTime, setArrTime] = useState('');
  const [depTz, setDepTz] = useState(browserTz);
  const [arrTz, setArrTz] = useState(browserTz);
  const [carrier, setCarrier] = useState('');
  const [transitCode, setTransitCode] = useState('');
  const [confirmationNo, setConfirmationNo] = useState('');
  const [bookedThrough, setBookedThrough] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [depAddress, setDepAddress] = useState('');
  const [depLat, setDepLat] = useState('');
  const [depLng, setDepLng] = useState('');
  const [arrAddress, setArrAddress] = useState('');
  const [arrLat, setArrLat] = useState('');
  const [arrLng, setArrLng] = useState('');
  const [notes, setNotes] = useState('');
  const [isAiFilling, setIsAiFilling] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [savedValues, setSavedValues] = useState<SavedValues | null>(null);
  const [showAccessError, setShowAccessError] = useState(false);
  const [showShareFolder, setShowShareFolder] = useState(false);
  const [editingChip, setEditingChip] = useState<{ fileId: string; value: string } | null>(null);

  const [typeOpen, setTypeOpen] = useState(false);
  const [depTzOpen, setDepTzOpen] = useState(false);
  const [depTzSearch, setDepTzSearch] = useState('');
  const [arrTzOpen, setArrTzOpen] = useState(false);
  const [arrTzSearch, setArrTzSearch] = useState('');
  const [currencyOpen, setCurrencyOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const typeRef = useRef<HTMLDivElement>(null);
  const depTzTriggerRef = useRef<HTMLButtonElement>(null);
  const arrTzTriggerRef = useRef<HTMLButtonElement>(null);
  const currencyTriggerRef = useRef<HTMLButtonElement>(null);
  const [depTzPos, setDepTzPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [arrTzPos, setArrTzPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [currencyPos, setCurrencyPos] = useState<{ top: number; left: number; width: number } | null>(null);

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
    initialAttachments: editingTransport?.attachments ?? [],
    onSetAiError: setAiError,
    onAccessError: () => setShowAccessError(true),
  });

  useEffect(() => {
    if (isOpen) {
      const t = editingTransport;
      const initial: SavedValues = {
        transitName: t?.name ?? '',
        type: t?.type ?? 'flight',
        depLoc: t?.departureLocationName ?? '',
        arrLoc: t?.arrivalLocationName ?? '',
        depDate: t?.departureDate ?? tripStartDate,
        arrDate: t?.arrivalDate ?? tripStartDate,
        depTime: t?.departureTime ?? '12:00',
        arrTime: t?.arrivalTime ?? '14:00',
        depTz: t?.departureTimezone ?? browserTz,
        arrTz: t?.arrivalTimezone ?? browserTz,
        carrier: t?.carrier ?? '',
        transitCode: t?.transitCode ?? '',
        confirmationNo: t?.confirmationNo ?? '',
        bookedThrough: t?.bookedThrough ?? '',
        price: t?.price != null ? String(t.price) : '',
        currency: t?.currency ?? 'USD',
        depAddress: t?.departureAddress ?? '',
        depLat: t?.departureLat != null ? String(t.departureLat) : '',
        depLng: t?.departureLng != null ? String(t.departureLng) : '',
        arrAddress: t?.arrivalAddress ?? '',
        arrLat: t?.arrivalLat != null ? String(t.arrivalLat) : '',
        arrLng: t?.arrivalLng != null ? String(t.arrivalLng) : '',
        notes: t?.notes ?? '',
      };
      setTransitName(initial.transitName);
      setType(initial.type);
      setDepLoc(initial.depLoc);
      setArrLoc(initial.arrLoc);
      setDepDate(initial.depDate);
      setArrDate(initial.arrDate);
      setDepTime(initial.depTime);
      setArrTime(initial.arrTime);
      setDepTz(initial.depTz);
      setArrTz(initial.arrTz);
      setCarrier(initial.carrier);
      setTransitCode(initial.transitCode);
      setConfirmationNo(initial.confirmationNo);
      setBookedThrough(initial.bookedThrough);
      setPrice(initial.price);
      setCurrency(initial.currency);
      setDepAddress(initial.depAddress);
      setDepLat(initial.depLat);
      setDepLng(initial.depLng);
      setArrAddress(initial.arrAddress);
      setArrLat(initial.arrLat);
      setArrLng(initial.arrLng);
      setNotes(initial.notes);
      setAttachments(t?.attachments ?? []);
      setSavedValues(initial);
      setAiError(null);
      setRemovePrompt(null);
      setTypeOpen(false);
      setDepTzOpen(false);
      setArrTzOpen(false);
      setCurrencyOpen(false);
      setShowAccessError(false);
      setShowShareFolder(false);
      setEditingChip(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!typeOpen) return;
    const handler = (e: MouseEvent) => {
      if (!typeRef.current?.contains(e.target as Node)) setTypeOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [typeOpen]);

  const handleDepDateChange = (val: string) => {
    setDepDate(val);
    if (arrDate < val) setArrDate(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!depLoc.trim() || !arrLoc.trim() || !depDate || !arrDate || !depTime || !arrTime || !depTz || !arrTz) return;
    const parsedPrice = price.trim() ? parseFloat(price) : undefined;
    onSave({
      name: transitName.trim() || undefined,
      type,
      departureLocationName: depLoc.trim(),
      arrivalLocationName: arrLoc.trim(),
      departureDate: depDate,
      departureTime: depTime,
      departureTimezone: depTz,
      arrivalDate: arrDate,
      arrivalTime: arrTime,
      arrivalTimezone: arrTz,
      carrier: carrier.trim() || undefined,
      transitCode: transitCode.trim() || undefined,
      confirmationNo: confirmationNo.trim() || undefined,
      bookedThrough: bookedThrough.trim() || undefined,
      price: parsedPrice,
      currency: parsedPrice != null ? currency : undefined,
      departureAddress: depAddress.trim() || undefined,
      departureLat: depLat.trim() ? parseFloat(depLat) : undefined,
      departureLng: depLng.trim() ? parseFloat(depLng) : undefined,
      arrivalAddress: arrAddress.trim() || undefined,
      arrivalLat: arrLat.trim() ? parseFloat(arrLat) : undefined,
      arrivalLng: arrLng.trim() ? parseFloat(arrLng) : undefined,
      notes: notes.trim() || undefined,
      attachments: attachedFiles,
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
      const result = await GeminiService.generateTransitDetailsFromFilesWithRotation(fileContents);
      if (result.name) setTransitName(result.name);
      if (result.type && TRANSPORT_TYPES.find(t => t.value === result.type)) {
        setType(result.type as Transportation['type']);
      }
      if (result.departureLocationName) setDepLoc(result.departureLocationName);
      if (result.arrivalLocationName) setArrLoc(result.arrivalLocationName);
      if (result.departureDate) setDepDate(result.departureDate);
      if (result.departureTime) setDepTime(result.departureTime);
      if (result.arrivalDate) setArrDate(result.arrivalDate);
      if (result.arrivalTime) setArrTime(result.arrivalTime);
      if (result.carrier) setCarrier(result.carrier);
      if (result.transitCode) setTransitCode(result.transitCode);
      if (result.confirmationNo) setConfirmationNo(result.confirmationNo);
      if (result.bookedThrough) setBookedThrough(result.bookedThrough);
      if (result.price != null) setPrice(String(result.price));
      if (result.currency) setCurrency(result.currency);
      if (result.notes) setNotes(result.notes);

      // Handle departure address + coords + timezone
      let dLat = result.departureLat;
      let dLng = result.departureLng;
      if (result.departureAddress) { setDepAddress(result.departureAddress); }
      if (dLat != null && dLng != null) {
        setDepLat(String(dLat));
        setDepLng(String(dLng));
      } else if (result.departureAddress && !depLat && !depLng) {
        const coords = await geocodeAddress(result.departureAddress);
        if (coords) { dLat = coords.lat; dLng = coords.lng; setDepLat(coords.lat.toFixed(6)); setDepLng(coords.lng.toFixed(6)); }
      }
      if (result.departureTimezone) {
        setDepTz(result.departureTimezone);
      } else if (dLat != null && dLng != null) {
        const tz = await lookupTimezone(dLat, dLng);
        if (tz) setDepTz(tz);
      }

      // Handle arrival address + coords + timezone
      let aLat = result.arrivalLat;
      let aLng = result.arrivalLng;
      if (result.arrivalAddress) { setArrAddress(result.arrivalAddress); }
      if (aLat != null && aLng != null) {
        setArrLat(String(aLat));
        setArrLng(String(aLng));
      } else if (result.arrivalAddress && !arrLat && !arrLng) {
        const coords = await geocodeAddress(result.arrivalAddress);
        if (coords) { aLat = coords.lat; aLng = coords.lng; setArrLat(coords.lat.toFixed(6)); setArrLng(coords.lng.toFixed(6)); }
      }
      if (result.arrivalTimezone) {
        setArrTz(result.arrivalTimezone);
      } else if (aLat != null && aLng != null) {
        const tz = await lookupTimezone(aLat, aLng);
        if (tz) setArrTz(tz);
      }
    } catch (err: any) {
      setAiError(err.message || 'AI fill failed.');
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

  const filteredDepTz = ALL_TIMEZONES.filter(tz => tz.toLowerCase().includes(depTzSearch.toLowerCase()));
  const filteredArrTz = ALL_TIMEZONES.filter(tz => tz.toLowerCase().includes(arrTzSearch.toLowerCase()));

  const selectedTypeObj = TRANSPORT_TYPES.find(t => t.value === type) ?? TRANSPORT_TYPES[0];
  const selectedCurrency = CURRENCY_LIST.find(c => c.code === currency) ?? { code: currency, name: currency };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-content glass-panel scrollable"
          style={{ maxWidth: '900px' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="modal-header">
            <h3>{editingTransport ? 'Edit Transit Details' : 'Add Transit Details'}</h3>
            <button className="modal-close" onClick={onClose}><X size={20} /></button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-scroll-body">
            <div className="place-form-grid">

              {/* Left column */}
              <div className="place-form-left-col">

                {/* Transit Name */}
                <div className="form-group">
                  <label htmlFor="transit-name" className="place-form-label">
                    <span className="label-text">Transit Name (Optional)</span>
                    {undoBtn(transitName, savedValues?.transitName, () => setTransitName(savedValues!.transitName))}
                  </label>
                  <input type="text" id="transit-name" value={transitName} onChange={e => setTransitName(e.target.value)} placeholder="Flight to Seattle" />
                </div>

                {/* Type combo */}
                <div className="form-group">
                  <label><span className="label-text">Type</span></label>
                  <div className="combo-wrapper" ref={typeRef}>
                    <button type="button" className="combo-trigger" onClick={() => setTypeOpen(o => !o)}>
                      <span className="combo-trigger-content">
                        <selectedTypeObj.Icon size={14} />
                        {selectedTypeObj.label}
                      </span>
                      <ChevronDown size={14} className={`expand-chevron${typeOpen ? ' is-open' : ''}`} />
                    </button>
                    {typeOpen && (
                      <div className="combo-dropdown">
                        {TRANSPORT_TYPES.map(opt => (
                          <button key={opt.value} type="button" className={`combo-option${type === opt.value ? ' selected' : ''}`} onClick={() => { setType(opt.value); setTypeOpen(false); }}>
                            <opt.Icon size={14} />{opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Carrier / Transit Code */}
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="transit-carrier" className="place-form-label">
                      <span className="label-text">Carrier / Operator (Optional)</span>
                      {undoBtn(carrier, savedValues?.carrier, () => setCarrier(savedValues!.carrier))}
                    </label>
                    <input type="text" id="transit-carrier" value={carrier} onChange={e => setCarrier(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="transit-code" className="place-form-label">
                      <span className="label-text">Transit Code / Flight No (Optional)</span>
                      {undoBtn(transitCode, savedValues?.transitCode, () => setTransitCode(savedValues!.transitCode))}
                    </label>
                    <input type="text" id="transit-code" value={transitCode} onChange={e => setTransitCode(e.target.value)} />
                  </div>
                </div>

                {/* Departure location + address */}
                <div className="form-group">
                  <label htmlFor="dep-loc" className="place-form-label">
                    <span className="label-text">Departure Location</span>
                    {undoBtn(depLoc, savedValues?.depLoc, () => setDepLoc(savedValues!.depLoc))}
                  </label>
                  <input type="text" id="dep-loc" value={depLoc} onChange={e => setDepLoc(e.target.value)} placeholder="e.g. Seattle SEA Airport" required />
                </div>
                <div className="form-group">
                  <label htmlFor="dep-address" className="place-form-label">
                    <span className="label-text">Departure Address (Optional)</span>
                    {undoBtn(depAddress, savedValues?.depAddress, () => setDepAddress(savedValues!.depAddress))}
                  </label>
                  <input type="text" id="dep-address" value={depAddress} onChange={e => setDepAddress(e.target.value)} />
                </div>

                {/* Departure Date + Time */}
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="dep-date" className="place-form-label">
                      <span className="label-text">Departure Date</span>
                      {undoBtn(depDate, savedValues?.depDate, () => setDepDate(savedValues!.depDate))}
                    </label>
                    <input type="date" id="dep-date" value={depDate} onChange={e => handleDepDateChange(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="dep-time" className="place-form-label">
                      <span className="label-text">Departure Time</span>
                      {undoBtn(depTime, savedValues?.depTime, () => setDepTime(savedValues!.depTime))}
                    </label>
                    <input type="time" id="dep-time" value={depTime} onChange={e => setDepTime(e.target.value)} required />
                  </div>
                </div>

                {/* Departure Timezone */}
                <div className="form-group">
                    <label className="place-form-label">
                      <span className="label-text">Departure Timezone</span>
                      {undoBtn(depTz, savedValues?.depTz, () => setDepTz(savedValues!.depTz))}</label>
                    <div className="combo-wrapper">
                      <button
                        ref={depTzTriggerRef}
                        type="button"
                        className="combo-trigger"
                        onClick={() => {
                          if (!depTzOpen && depTzTriggerRef.current) {
                            const r = depTzTriggerRef.current.getBoundingClientRect();
                            setDepTzPos({ top: r.bottom + 4, left: r.left, width: r.width });
                          }
                          setDepTzOpen(o => !o);
                          setDepTzSearch('');
                        }}
                      >
                        <span className="combo-trigger-content">{formatTimezoneLabel(depTz)}</span>
                        <ChevronDown size={14} className={`expand-chevron${depTzOpen ? ' is-open' : ''}`} />
                      </button>
                    </div>
                    {depTzOpen && depTzPos && createPortal(
                      <>
                        <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }} onClick={() => setDepTzOpen(false)} />
                        <div className="combo-dropdown--tz-portal" style={{ top: depTzPos.top, left: depTzPos.left, width: Math.max(depTzPos.width, 260), zIndex: 10000 }} onClick={e => e.stopPropagation()}>
                          <div className="tz-search-wrapper">
                            <input className="tz-search-input" type="text" placeholder="Search timezone…" value={depTzSearch} onChange={e => setDepTzSearch(e.target.value)} autoFocus />
                          </div>
                          <div className="tz-option-list">
                            {filteredDepTz.map(tz => (
                              <button key={tz} type="button" className={`combo-option${depTz === tz ? ' selected' : ''}`} onClick={() => { setDepTz(tz); setDepTzOpen(false); }}>
                                {formatTimezoneLabel(tz)}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>,
                      document.body
                    )}
                </div>

                {/* Arrival location + address */}
                <div className="form-group">
                  <label htmlFor="arr-loc" className="place-form-label">
                    <span className="label-text">Arrival Location</span>
                    {undoBtn(arrLoc, savedValues?.arrLoc, () => setArrLoc(savedValues!.arrLoc))}
                  </label>
                  <input type="text" id="arr-loc" value={arrLoc} onChange={e => setArrLoc(e.target.value)} placeholder="e.g. Seattle SEA Airport" required />
                </div>
                <div className="form-group">
                  <label htmlFor="arr-address" className="place-form-label">
                    <span className="label-text">Arrival Address (Optional)</span>
                    {undoBtn(arrAddress, savedValues?.arrAddress, () => setArrAddress(savedValues!.arrAddress))}
                  </label>
                  <input type="text" id="arr-address" value={arrAddress} onChange={e => setArrAddress(e.target.value)} />
                </div>

                {/* Arrival Date + Time */}
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="arr-date" className="place-form-label">
                      <span className="label-text">Arrival Date</span>
                      {undoBtn(arrDate, savedValues?.arrDate, () => setArrDate(savedValues!.arrDate))}
                    </label>
                    <input type="date" id="arr-date" value={arrDate} onChange={e => setArrDate(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="arr-time" className="place-form-label">
                      <span className="label-text">Arrival Time</span>
                      {undoBtn(arrTime, savedValues?.arrTime, () => setArrTime(savedValues!.arrTime))}
                    </label>
                    <input type="time" id="arr-time" value={arrTime} onChange={e => setArrTime(e.target.value)} required />
                  </div>
                </div>

                {/* Arrival Timezone */}
                <div className="form-group">
                    <label className="place-form-label">
                      <span className="label-text">Arrival Timezone</span>
                      {undoBtn(arrTz, savedValues?.arrTz, () => setArrTz(savedValues!.arrTz))}</label>
                    <div className="combo-wrapper">
                      <button
                        ref={arrTzTriggerRef}
                        type="button"
                        className="combo-trigger"
                        onClick={() => {
                          if (!arrTzOpen && arrTzTriggerRef.current) {
                            const r = arrTzTriggerRef.current.getBoundingClientRect();
                            setArrTzPos({ top: r.bottom + 4, left: r.left, width: r.width });
                          }
                          setArrTzOpen(o => !o);
                          setArrTzSearch('');
                        }}
                      >
                        <span className="combo-trigger-content">{formatTimezoneLabel(arrTz)}</span>
                        <ChevronDown size={14} className={`expand-chevron${arrTzOpen ? ' is-open' : ''}`} />
                      </button>
                    </div>
                    {arrTzOpen && arrTzPos && createPortal(
                      <>
                        <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }} onClick={() => setArrTzOpen(false)} />
                        <div className="combo-dropdown--tz-portal" style={{ top: arrTzPos.top, left: arrTzPos.left, width: Math.max(arrTzPos.width, 260), zIndex: 10000 }} onClick={e => e.stopPropagation()}>
                          <div className="tz-search-wrapper">
                            <input className="tz-search-input" type="text" placeholder="Search timezone…" value={arrTzSearch} onChange={e => setArrTzSearch(e.target.value)} autoFocus />
                          </div>
                          <div className="tz-option-list">
                            {filteredArrTz.map(tz => (
                              <button key={tz} type="button" className={`combo-option${arrTz === tz ? ' selected' : ''}`} onClick={() => { setArrTz(tz); setArrTzOpen(false); }}>
                                {formatTimezoneLabel(tz)}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>,
                      document.body
                    )}
                </div>

                {/* Confirmation No + Booked via */}
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="transit-conf" className="place-form-label">
                      <span className="label-text">Confirmation No (Optional)</span>
                      {undoBtn(confirmationNo, savedValues?.confirmationNo, () => setConfirmationNo(savedValues!.confirmationNo))}
                    </label>
                    <input type="text" id="transit-conf" value={confirmationNo} onChange={e => setConfirmationNo(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="transit-booked" className="place-form-label">
                      <span className="label-text">Booked via (Optional)</span>
                      {undoBtn(bookedThrough, savedValues?.bookedThrough, () => setBookedThrough(savedValues!.bookedThrough))}
                    </label>
                    <input type="text" id="transit-booked" value={bookedThrough} onChange={e => setBookedThrough(e.target.value)} placeholder="e.g. Expedia" />
                  </div>
                </div>

                {/* Price + Currency */}
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="transit-price" className="place-form-label">
                      <span className="label-text">Price (Optional)</span>
                      {undoBtn(price, savedValues?.price, () => setPrice(savedValues!.price))}
                    </label>
                    <input type="number" id="transit-price" value={price} onChange={e => setPrice(e.target.value)} min="0" step="0.01" placeholder="0.00" />
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
                            <button key={c.code} type="button" className={`combo-option${c.code === currency ? ' selected' : ''}`} onClick={() => { setCurrency(c.code); setCurrencyOpen(false); }}>
                              {c.code} — {c.name}
                            </button>
                          ))}
                        </div>
                      </>,
                      document.body
                    )}
                  </div>
                </div>
              </div>

              {/* Right column — Coordinates, DualMapPicker, Notes, Attachments */}
              <div className="place-form-right-col">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="dep-lat" className="place-form-label">
                      <span className="label-text">Departure Latitude (Optional)</span>
                      {undoBtn(depLat, savedValues?.depLat, () => setDepLat(savedValues!.depLat))}
                    </label>
                    <input type="text" id="dep-lat" value={depLat} onChange={e => setDepLat(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="dep-lng" className="place-form-label">
                      <span className="label-text">Departure Longitude (Optional)</span>
                      {undoBtn(depLng, savedValues?.depLng, () => setDepLng(savedValues!.depLng))}
                    </label>
                    <input type="text" id="dep-lng" value={depLng} onChange={e => setDepLng(e.target.value)} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="arr-lat" className="place-form-label">
                      <span className="label-text">Arrival Latitude (Optional)</span>
                      {undoBtn(arrLat, savedValues?.arrLat, () => setArrLat(savedValues!.arrLat))}
                    </label>
                    <input type="text" id="arr-lat" value={arrLat} onChange={e => setArrLat(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="arr-lng" className="place-form-label">
                      <span className="label-text">Arrival Longitude (Optional)</span>
                      {undoBtn(arrLng, savedValues?.arrLng, () => setArrLng(savedValues!.arrLng))}
                    </label>
                    <input type="text" id="arr-lng" value={arrLng} onChange={e => setArrLng(e.target.value)} />
                  </div>
                </div>
                <div className="form-group form-group--mb16">
                  <label className="place-form-label">
                    <MapPin size={13} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                    <span className="label-text">Click on the map to set coordinates</span>
                  </label>
                  <DualMapPicker
                    depLat={parseFloat(depLat)}
                    depLng={parseFloat(depLng)}
                    arrLat={parseFloat(arrLat)}
                    arrLng={parseFloat(arrLng)}
                    onDepPick={(lat, lng) => { setDepLat(lat.toFixed(6)); setDepLng(lng.toFixed(6)); }}
                    onArrPick={(lat, lng) => { setArrLat(lat.toFixed(6)); setArrLng(lng.toFixed(6)); }}
                  />
                </div>

                {/* Notes */}
                <div className="form-group">
                  <label htmlFor="transit-notes" className="place-form-label">
                    <span className="label-text">Notes (Optional)</span>
                    {undoBtn(notes, savedValues?.notes, () => setNotes(savedValues!.notes))}
                  </label>
                  <textarea id="transit-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Booking reference, details, ..." rows={2} />
                </div>

                {/* File Attachments */}
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
                        <button type="button" className="mini-icon-btn flex-align" onClick={() => fileInputRef.current?.click()} disabled={uploadingCount > 0}>
                          <Paperclip size={13} />
                          {uploadingCount > 0 ? 'Uploading…' : 'Attach Files'}
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
                    <input ref={fileInputRef} type="file" multiple accept="image/*,application/pdf,.eml,.txt" className="visually-hidden" onChange={handleFileSelect} />
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
                                <button type="button" className="attachment-chip-remove" onClick={() => handleRemoveChip(f)} data-tooltip="Remove file">
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
              {onDelete && editingTransport && (
                <button type="button" className="btn-danger flex-align" onClick={onDelete}>
                  <Trash2 size={14} /> Delete Transit
                </button>
              )}
              <div className="modal-actions-right">
                <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn-primary">{editingTransport ? 'Save Transit' : 'Add Transit'}</button>
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
          message="You don't have write access to this trip's folder. Ask the trip owner to share the trip folder with you."
          onConfirm={() => setShowAccessError(false)}
          onCancel={() => setShowAccessError(false)}
        />
      )}

      {removePrompt && (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => setRemovePrompt(null)}>
          <div className="modal-content glass-panel" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Remove File</h3>
              <button className="modal-close" onClick={() => setRemovePrompt(null)}><X size={20} /></button>
            </div>
            <p className="modal-body-text">What should happen to <strong>{removePrompt.name}</strong> on Google Drive?</p>
            <div className="modal-actions modal-actions--column">
              <button className="btn-danger" onClick={() => confirmRemoveChip('delete')}><Trash2 size={14} /> Delete from Drive</button>
              <button className="btn-secondary" onClick={() => confirmRemoveChip('archive')}>Archive on Drive (rename with [Archived])</button>
              <button className="btn-secondary" onClick={() => confirmRemoveChip('keep')}>Keep on Drive, remove link only</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
