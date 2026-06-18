import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X, ChevronDown, Plane, Train, Bus, Car, Anchor, Navigation,
  Sparkles, RotateCcw, Paperclip, Trash2, MapPin,
} from 'lucide-react';
import type { Transportation } from '../types';
import { GeminiService } from '../utils/ai';
import { CURRENCY_LIST } from '../utils/currencies';
import { lookupTimezone } from '../utils/api';
import DualMapPicker from './DualMapPicker';
import {
  getOrCreateTripFileFolder,
  uploadFile,
  fetchFileContentFromDrive,
  deleteFileFromDrive,
  renameFolderInDrive,
} from '../utils/googleDrive';

interface AttachedFile {
  name: string;
  fileId: string;
}

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
}

const TRANSPORT_TYPES: { value: Transportation['type']; label: string; Icon: React.ElementType }[] = [
  { value: 'flight', label: 'Flight', Icon: Plane },
  { value: 'train', label: 'Train', Icon: Train },
  { value: 'bus', label: 'Bus', Icon: Bus },
  { value: 'car', label: 'Car Rental / Drive', Icon: Car },
  { value: 'ferry', label: 'Ferry', Icon: Anchor },
  { value: 'other', label: 'Other', Icon: Navigation },
];

function getBrowserTimezone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; }
}

function getUtcOffsetMinutes(tz: string): number {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' });
    const offsetStr = fmt.formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value ?? '';
    const m = offsetStr.match(/GMT([+-])(\d+)(?::(\d+))?/);
    if (!m) return 0;
    return (m[1] === '+' ? 1 : -1) * (parseInt(m[2]) * 60 + parseInt(m[3] ?? '0'));
  } catch { return 0; }
}

function formatTimezoneLabel(tz: string): string {
  const mins = getUtcOffsetMinutes(tz);
  const sign = mins >= 0 ? '+' : '-';
  const absMins = Math.abs(mins);
  const h = String(Math.floor(absMins / 60)).padStart(2, '0');
  const m = String(absMins % 60).padStart(2, '0');
  return `(GMT${sign}${h}:${m}) ${tz}`;
}

const ALL_TIMEZONES: string[] = (() => {
  try {
    return [...(Intl as any).supportedValuesOf('timeZone') as string[]].sort(
      (a, b) => getUtcOffsetMinutes(a) - getUtcOffsetMinutes(b)
    );
  } catch {
    return [
      'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
      'Europe/London', 'Europe/Paris', 'Asia/Kolkata', 'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney',
    ];
  }
})();

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
  tripEndDate,
  onSave,
  onDelete,
  editingTransport,
  googleToken,
  tripPlannerFolderId,
  tripName,
  tripFilesFolderId,
  onFileFolderCreated,
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
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [isAiFilling, setIsAiFilling] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [savedValues, setSavedValues] = useState<SavedValues | null>(null);
  const [removePrompt, setRemovePrompt] = useState<AttachedFile | null>(null);

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
  const currencyRef = useRef<HTMLDivElement>(null);
  const [depTzPos, setDepTzPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [arrTzPos, setArrTzPos] = useState<{ top: number; left: number; width: number } | null>(null);

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
      setAttachedFiles(
        (t?.attachmentFileIds ?? []).map((id, i) => ({ name: `File ${i + 1}`, fileId: id }))
      );
      setSavedValues(initial);
      setAiError(null);
      setRemovePrompt(null);
      setTypeOpen(false);
      setDepTzOpen(false);
      setArrTzOpen(false);
      setCurrencyOpen(false);
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

  useEffect(() => {
    if (!currencyOpen) return;
    const handler = (e: MouseEvent) => {
      if (currencyRef.current && !currencyRef.current.contains(e.target as Node)) {
        setCurrencyOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [currencyOpen]);

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
      attachmentFileIds: attachedFiles.map(f => f.fileId),
    });
    onClose();
  };

  const resolveFilesFolderId = async (): Promise<string | null> => {
    if (tripFilesFolderId) return tripFilesFolderId;
    if (!googleToken || !tripPlannerFolderId || !tripName) return null;
    try {
      const folderId = await getOrCreateTripFileFolder(googleToken, tripPlannerFolderId, tripName);
      onFileFolderCreated?.(folderId);
      return folderId;
    } catch { return null; }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !googleToken) return;
    e.target.value = '';
    setUploadingCount(prev => prev + files.length);
    const folderId = await resolveFilesFolderId();
    if (!folderId) {
      setUploadingCount(prev => prev - files.length);
      setAiError('Could not create Drive folder. Make sure you are signed into Google.');
      return;
    }
    for (const file of files) {
      try {
        const fileId = await uploadFile(googleToken, folderId, file);
        setAttachedFiles(prev => [...prev, { name: file.name, fileId }]);
      } catch {
        setAiError(`Failed to upload "${file.name}".`);
      } finally {
        setUploadingCount(prev => prev - 1);
      }
    }
  };

  const handleRemoveChip = (file: AttachedFile) => setRemovePrompt(file);

  const confirmRemoveChip = async (action: 'delete' | 'archive' | 'keep') => {
    if (!removePrompt) return;
    const file = removePrompt;
    setRemovePrompt(null);
    if (action === 'delete' && googleToken) {
      try { await deleteFileFromDrive(googleToken, file.fileId); } catch { /* ignore */ }
    } else if (action === 'archive' && googleToken) {
      try { await renameFolderInDrive(googleToken, file.fileId, `[Archived] ${file.name}`); } catch { /* ignore */ }
    }
    setAttachedFiles(prev => prev.filter(f => f.fileId !== file.fileId));
  };

  const handleAiFill = async () => {
    if (!googleToken || attachedFiles.length === 0) return;
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
                  <label htmlFor="transit-name">
                    Transit Name (Optional)
                    {undoBtn(transitName, savedValues?.transitName, () => setTransitName(savedValues!.transitName))}
                  </label>
                  <input type="text" id="transit-name" value={transitName} onChange={e => setTransitName(e.target.value)} placeholder="Flight to Seattle" />
                </div>

                {/* Type combo */}
                <div className="form-group">
                  <label>Type</label>
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

                {/* Departure location + address */}
                <div className="form-group">
                  <label htmlFor="dep-loc">
                    Departure Location
                    {undoBtn(depLoc, savedValues?.depLoc, () => setDepLoc(savedValues!.depLoc))}
                  </label>
                  <input type="text" id="dep-loc" value={depLoc} onChange={e => setDepLoc(e.target.value)} placeholder="e.g. Seattle SEA Airport" required />
                </div>
                <div className="form-group">
                  <label htmlFor="dep-address">
                    Departure Address (Optional)
                    {undoBtn(depAddress, savedValues?.depAddress, () => setDepAddress(savedValues!.depAddress))}
                  </label>
                  <input type="text" id="dep-address" value={depAddress} onChange={e => setDepAddress(e.target.value)} placeholder="e.g. 17801 International Blvd, SeaTac, WA" />
                </div>

                {/* Departure Date + Time */}
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="dep-date">Departure Date</label>
                    <input type="date" id="dep-date" value={depDate} onChange={e => handleDepDateChange(e.target.value)} min={tripStartDate} max={tripEndDate} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="dep-time">Departure Time</label>
                    <input type="time" id="dep-time" value={depTime} onChange={e => setDepTime(e.target.value)} required />
                  </div>
                </div>

                {/* Departure Timezone */}
                <div className="form-group">
                  <label>Departure Timezone</label>
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
                  <label htmlFor="arr-loc">
                    Arrival Location
                    {undoBtn(arrLoc, savedValues?.arrLoc, () => setArrLoc(savedValues!.arrLoc))}
                  </label>
                  <input type="text" id="arr-loc" value={arrLoc} onChange={e => setArrLoc(e.target.value)} placeholder="e.g. Tokyo Narita Airport" required />
                </div>
                <div className="form-group">
                  <label htmlFor="arr-address">
                    Arrival Address (Optional)
                    {undoBtn(arrAddress, savedValues?.arrAddress, () => setArrAddress(savedValues!.arrAddress))}
                  </label>
                  <input type="text" id="arr-address" value={arrAddress} onChange={e => setArrAddress(e.target.value)} placeholder="e.g. 1-1 Furugome, Narita, Chiba" />
                </div>

                {/* Arrival Date + Time */}
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="arr-date">Arrival Date</label>
                    <input type="date" id="arr-date" value={arrDate} onChange={e => setArrDate(e.target.value)} min={depDate || tripStartDate} max={tripEndDate} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="arr-time">Arrival Time</label>
                    <input type="time" id="arr-time" value={arrTime} onChange={e => setArrTime(e.target.value)} required />
                  </div>
                </div>

                {/* Arrival Timezone */}
                <div className="form-group">
                  <label>Arrival Timezone</label>
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

                {/* Carrier / Transit Code */}
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="transit-carrier">
                      Carrier / Operator (Optional)
                      {undoBtn(carrier, savedValues?.carrier, () => setCarrier(savedValues!.carrier))}
                    </label>
                    <input type="text" id="transit-carrier" value={carrier} onChange={e => setCarrier(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="transit-code">
                      Transit Code / Flight No (Optional)
                      {undoBtn(transitCode, savedValues?.transitCode, () => setTransitCode(savedValues!.transitCode))}
                    </label>
                    <input type="text" id="transit-code" value={transitCode} onChange={e => setTransitCode(e.target.value)} />
                  </div>
                </div>

                {/* Confirmation No + Booked via */}
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="transit-conf">
                      Confirmation No (Optional)
                      {undoBtn(confirmationNo, savedValues?.confirmationNo, () => setConfirmationNo(savedValues!.confirmationNo))}
                    </label>
                    <input type="text" id="transit-conf" value={confirmationNo} onChange={e => setConfirmationNo(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="transit-booked">
                      Booked via (Optional)
                      {undoBtn(bookedThrough, savedValues?.bookedThrough, () => setBookedThrough(savedValues!.bookedThrough))}
                    </label>
                    <input type="text" id="transit-booked" value={bookedThrough} onChange={e => setBookedThrough(e.target.value)} placeholder="e.g. Expedia" />
                  </div>
                </div>

                {/* Price + Currency */}
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="transit-price">
                      Price (Optional)
                      {undoBtn(price, savedValues?.price, () => setPrice(savedValues!.price))}
                    </label>
                    <input type="number" id="transit-price" value={price} onChange={e => setPrice(e.target.value)} min="0" step="0.01" placeholder="0.00" />
                  </div>
                  <div className="form-group">
                    <label>
                      Currency
                      {undoBtn(currency, savedValues?.currency, () => setCurrency(savedValues!.currency))}
                    </label>
                    <div className="combo-wrapper" ref={currencyRef}>
                      <button type="button" className="combo-trigger" onClick={() => setCurrencyOpen(o => !o)}>
                        <span className="combo-trigger-content">{selectedCurrency.code} — {selectedCurrency.name}</span>
                        <ChevronDown size={14} className={`expand-chevron${currencyOpen ? ' is-open' : ''}`} />
                      </button>
                      {currencyOpen && (
                        <div className="combo-dropdown">
                          {CURRENCY_LIST.map(c => (
                            <button key={c.code} type="button" className={`combo-option${c.code === currency ? ' selected' : ''}`} onClick={() => { setCurrency(c.code); setCurrencyOpen(false); }}>
                              {c.code} — {c.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="form-group">
                  <label htmlFor="transit-notes">
                    Notes (Optional)
                    {undoBtn(notes, savedValues?.notes, () => setNotes(savedValues!.notes))}
                  </label>
                  <textarea id="transit-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Booking reference, details, ..." rows={2} />
                </div>

                {/* File Attachments */}
                {googleToken && (
                  <div className="attachment-section">
                    <div className="attachment-header-row">
                      <span className="attachment-section-label">Attachments</span>
                      <button type="button" className="mini-icon-btn flex-align" onClick={() => fileInputRef.current?.click()} disabled={uploadingCount > 0}>
                        <Paperclip size={13} />
                        {uploadingCount > 0 ? 'Uploading…' : 'Attach Files'}
                      </button>
                    </div>
                    <input ref={fileInputRef} type="file" multiple accept="image/*,application/pdf,.eml,.txt" className="visually-hidden" onChange={handleFileSelect} />
                    {attachedFiles.length > 0 && (
                      <div className="attachment-chip-list">
                        {attachedFiles.map(f => (
                          <span key={f.fileId} className="attachment-chip">
                            <span className="attachment-chip-name">{f.name}</span>
                            <button type="button" className="attachment-chip-remove" onClick={() => handleRemoveChip(f)} data-tooltip="Remove file">
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    {attachedFiles.length > 0 && GeminiService.isAiEnabled() && (
                      <button type="button" className="modal-ai-fill-btn" onClick={handleAiFill} disabled={isAiFilling}>
                        <Sparkles size={13} />
                        {isAiFilling ? 'Filling…' : 'Fill with AI'}
                      </button>
                    )}
                    {aiError && <p className="form-error-text">{aiError}</p>}
                  </div>
                )}
              </div>

              {/* Right column — Coordinates & DualMapPicker */}
              <div className="place-form-right-col">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="dep-lat">
                      Departure Latitude (Optional)
                      {undoBtn(depLat, savedValues?.depLat, () => setDepLat(savedValues!.depLat))}
                    </label>
                    <input type="text" id="dep-lat" value={depLat} onChange={e => setDepLat(e.target.value)} placeholder="e.g. 47.4502" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="dep-lng">
                      Departure Longitude (Optional)
                      {undoBtn(depLng, savedValues?.depLng, () => setDepLng(savedValues!.depLng))}
                    </label>
                    <input type="text" id="dep-lng" value={depLng} onChange={e => setDepLng(e.target.value)} placeholder="e.g. -122.3088" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="arr-lat">
                      Arrival Latitude (Optional)
                      {undoBtn(arrLat, savedValues?.arrLat, () => setArrLat(savedValues!.arrLat))}
                    </label>
                    <input type="text" id="arr-lat" value={arrLat} onChange={e => setArrLat(e.target.value)} placeholder="e.g. 35.7720" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="arr-lng">
                      Arrival Longitude (Optional)
                      {undoBtn(arrLng, savedValues?.arrLng, () => setArrLng(savedValues!.arrLng))}
                    </label>
                    <input type="text" id="arr-lng" value={arrLng} onChange={e => setArrLng(e.target.value)} placeholder="e.g. 140.3929" />
                  </div>
                </div>
                <div className="form-group form-group--mb16">
                  <label className="place-form-label">
                    <MapPin size={13} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                    Click on the map to set coordinates
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
              </div>

            </div>
            </div>

            <div className="modal-actions">
              {onDelete && editingTransport && (
                <button type="button" className="btn-danger" style={{ marginRight: 'auto' }} onClick={onDelete}>Delete</button>
              )}
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary">Save</button>
            </div>
          </form>
        </div>
      </div>

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
