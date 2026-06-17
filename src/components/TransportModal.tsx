import { useState, useEffect, useRef } from 'react';
import {
  X, ChevronDown, Plane, Train, Bus, Car, Anchor, Navigation,
  Sparkles, RotateCcw, Paperclip, Trash2,
} from 'lucide-react';
import type { Transportation } from '../types';
import { GeminiService } from '../utils/ai';
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
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

function getAllTimezones(): string[] {
  try {
    return (Intl as any).supportedValuesOf('timeZone') as string[];
  } catch {
    return [
      'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
      'America/Anchorage', 'Pacific/Honolulu', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
      'Europe/Rome', 'Europe/Madrid', 'Europe/Amsterdam', 'Europe/Stockholm', 'Europe/Moscow',
      'Asia/Dubai', 'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Tokyo',
      'Asia/Shanghai', 'Asia/Seoul', 'Asia/Hong_Kong', 'Australia/Sydney', 'Pacific/Auckland',
    ];
  }
}

const ALL_TIMEZONES = getAllTimezones();

type SavedValues = {
  type: Transportation['type']; depLoc: string; arrLoc: string;
  depDate: string; arrDate: string; depTime: string; arrTime: string;
  depTz: string; arrTz: string; carrier: string; transitCode: string;
  confirmationNo: string; notes: string;
};

export default function TransportModal({
  isOpen,
  onClose,
  tripStartDate,
  tripEndDate,
  onSave,
  editingTransport,
  googleToken,
  tripPlannerFolderId,
  tripName,
  tripFilesFolderId,
  onFileFolderCreated,
}: TransportModalProps) {
  const browserTz = getBrowserTimezone();

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
  const [notes, setNotes] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [isAiFilling, setIsAiFilling] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [savedValues, setSavedValues] = useState<SavedValues | null>(null);
  const [removePrompt, setRemovePrompt] = useState<AttachedFile | null>(null);

  // Combo box open states
  const [typeOpen, setTypeOpen] = useState(false);
  const [depTzOpen, setDepTzOpen] = useState(false);
  const [depTzSearch, setDepTzSearch] = useState('');
  const [arrTzOpen, setArrTzOpen] = useState(false);
  const [arrTzSearch, setArrTzSearch] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const t = editingTransport;
      const initial: SavedValues = {
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
        notes: t?.notes ?? '',
      };
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Outside-click handlers for dropdowns
  useEffect(() => {
    if (!typeOpen) return;
    const handler = () => setTypeOpen(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [typeOpen]);

  useEffect(() => {
    if (!depTzOpen) return;
    const handler = () => setDepTzOpen(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [depTzOpen]);

  useEffect(() => {
    if (!arrTzOpen) return;
    const handler = () => setArrTzOpen(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [arrTzOpen]);

  const handleDepDateChange = (val: string) => {
    setDepDate(val);
    if (arrDate < val) setArrDate(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!depLoc.trim() || !arrLoc.trim() || !depDate || !arrDate || !depTime || !arrTime || !depTz || !arrTz) return;
    onSave({
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
    } catch {
      return null;
    }
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
      if (result.type && TRANSPORT_TYPES.find(t => t.value === result.type)) {
        setType(result.type as Transportation['type']);
      }
      if (result.departureLocationName) setDepLoc(result.departureLocationName);
      if (result.arrivalLocationName) setArrLoc(result.arrivalLocationName);
      if (result.departureDate) setDepDate(result.departureDate);
      if (result.departureTime) setDepTime(result.departureTime);
      if (result.departureTimezone) setDepTz(result.departureTimezone);
      if (result.arrivalDate) setArrDate(result.arrivalDate);
      if (result.arrivalTime) setArrTime(result.arrivalTime);
      if (result.arrivalTimezone) setArrTz(result.arrivalTimezone);
      if (result.carrier) setCarrier(result.carrier);
      if (result.transitCode) setTransitCode(result.transitCode);
      if (result.confirmationNo) setConfirmationNo(result.confirmationNo);
      if (result.notes) setNotes(result.notes);
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

  const filteredDepTz = ALL_TIMEZONES.filter(tz =>
    tz.toLowerCase().includes(depTzSearch.toLowerCase())
  ).slice(0, 50);

  const filteredArrTz = ALL_TIMEZONES.filter(tz =>
    tz.toLowerCase().includes(arrTzSearch.toLowerCase())
  ).slice(0, 50);

  const selectedTypeObj = TRANSPORT_TYPES.find(t => t.value === type) ?? TRANSPORT_TYPES[0];

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-content glass-panel scrollable"
          style={{ maxWidth: '600px' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="modal-header">
            <h3>Transit Details</h3>
            <button className="modal-close" onClick={onClose}><X size={20} /></button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-scroll-body">

              {/* Type combo box */}
              <div className="form-group">
                <label>Type</label>
                <div
                  className={`loc-select-wrapper${typeOpen ? ' dropdown-active' : ''}`}
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="loc-select-trigger"
                    onClick={() => setTypeOpen(o => !o)}
                  >
                    <span className="loc-select-trigger-content">
                      <selectedTypeObj.Icon size={14} />
                      {selectedTypeObj.label}
                    </span>
                    <ChevronDown size={14} className={typeOpen ? 'chevron-open' : ''} />
                  </button>
                  {typeOpen && (
                    <div className="loc-select-dropdown">
                      {TRANSPORT_TYPES.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          className={`loc-select-option${type === opt.value ? ' selected' : ''}`}
                          onClick={() => { setType(opt.value); setTypeOpen(false); }}
                        >
                          <opt.Icon size={14} />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Departure / Arrival locations */}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="dep-loc">
                    Departure Location
                    {undoBtn(depLoc, savedValues?.depLoc, () => setDepLoc(savedValues!.depLoc))}
                  </label>
                  <input
                    type="text"
                    id="dep-loc"
                    value={depLoc}
                    onChange={e => setDepLoc(e.target.value)}
                    placeholder="e.g. Seattle SEA Airport"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="arr-loc">
                    Arrival Location
                    {undoBtn(arrLoc, savedValues?.arrLoc, () => setArrLoc(savedValues!.arrLoc))}
                  </label>
                  <input
                    type="text"
                    id="arr-loc"
                    value={arrLoc}
                    onChange={e => setArrLoc(e.target.value)}
                    placeholder="e.g. Seattle SEA Airport"
                    required
                  />
                </div>
              </div>

              {/* Departure / Arrival dates */}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="dep-date">Departure Date</label>
                  <input
                    type="date"
                    id="dep-date"
                    value={depDate}
                    onChange={e => handleDepDateChange(e.target.value)}
                    min={tripStartDate}
                    max={tripEndDate}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="arr-date">Arrival Date</label>
                  <input
                    type="date"
                    id="arr-date"
                    value={arrDate}
                    onChange={e => setArrDate(e.target.value)}
                    min={depDate || tripStartDate}
                    max={tripEndDate}
                    required
                  />
                </div>
              </div>

              {/* Departure / Arrival times */}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="dep-time">Departure Time</label>
                  <input
                    type="time"
                    id="dep-time"
                    value={depTime}
                    onChange={e => setDepTime(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="arr-time">Arrival Time</label>
                  <input
                    type="time"
                    id="arr-time"
                    value={arrTime}
                    onChange={e => setArrTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Departure / Arrival timezones */}
              <div className="form-row">
                {/* Departure timezone */}
                <div className="form-group">
                  <label>Departure Timezone</label>
                  <div
                    className={`loc-select-wrapper${depTzOpen ? ' dropdown-active' : ''}`}
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="loc-select-trigger"
                      onClick={() => { setDepTzOpen(o => !o); setDepTzSearch(''); }}
                    >
                      <span className="loc-select-trigger-content loc-select-trigger-text">{depTz}</span>
                      <ChevronDown size={14} className={depTzOpen ? 'chevron-open' : ''} />
                    </button>
                    {depTzOpen && (
                      <div className="loc-select-dropdown loc-select-dropdown--tz">
                        <div className="tz-search-wrapper">
                          <input
                            className="tz-search-input"
                            type="text"
                            placeholder="Search timezone…"
                            value={depTzSearch}
                            onChange={e => setDepTzSearch(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            autoFocus
                          />
                        </div>
                        <div className="tz-option-list">
                          {filteredDepTz.map(tz => (
                            <button
                              key={tz}
                              type="button"
                              className={`loc-select-option${depTz === tz ? ' selected' : ''}`}
                              onClick={() => { setDepTz(tz); setDepTzOpen(false); }}
                            >
                              {tz}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Arrival timezone */}
                <div className="form-group">
                  <label>Arrival Timezone</label>
                  <div
                    className={`loc-select-wrapper${arrTzOpen ? ' dropdown-active' : ''}`}
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="loc-select-trigger"
                      onClick={() => { setArrTzOpen(o => !o); setArrTzSearch(''); }}
                    >
                      <span className="loc-select-trigger-content loc-select-trigger-text">{arrTz}</span>
                      <ChevronDown size={14} className={arrTzOpen ? 'chevron-open' : ''} />
                    </button>
                    {arrTzOpen && (
                      <div className="loc-select-dropdown loc-select-dropdown--tz">
                        <div className="tz-search-wrapper">
                          <input
                            className="tz-search-input"
                            type="text"
                            placeholder="Search timezone…"
                            value={arrTzSearch}
                            onChange={e => setArrTzSearch(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            autoFocus
                          />
                        </div>
                        <div className="tz-option-list">
                          {filteredArrTz.map(tz => (
                            <button
                              key={tz}
                              type="button"
                              className={`loc-select-option${arrTz === tz ? ' selected' : ''}`}
                              onClick={() => { setArrTz(tz); setArrTzOpen(false); }}
                            >
                              {tz}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Carrier / Transit Code */}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="transit-carrier">
                    Carrier / Operator (Optional)
                    {undoBtn(carrier, savedValues?.carrier, () => setCarrier(savedValues!.carrier))}
                  </label>
                  <input
                    type="text"
                    id="transit-carrier"
                    value={carrier}
                    onChange={e => setCarrier(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="transit-code">
                    Transit Code / Flight No (Optional)
                    {undoBtn(transitCode, savedValues?.transitCode, () => setTransitCode(savedValues!.transitCode))}
                  </label>
                  <input
                    type="text"
                    id="transit-code"
                    value={transitCode}
                    onChange={e => setTransitCode(e.target.value)}
                  />
                </div>
              </div>

              {/* Confirmation No */}
              <div className="form-group">
                <label htmlFor="transit-conf">
                  Confirmation No (Optional)
                  {undoBtn(confirmationNo, savedValues?.confirmationNo, () => setConfirmationNo(savedValues!.confirmationNo))}
                </label>
                <input
                  type="text"
                  id="transit-conf"
                  value={confirmationNo}
                  onChange={e => setConfirmationNo(e.target.value)}
                />
              </div>

              {/* Notes */}
              <div className="form-group">
                <label htmlFor="transit-notes">
                  Notes (Optional)
                  {undoBtn(notes, savedValues?.notes, () => setNotes(savedValues!.notes))}
                </label>
                <textarea
                  id="transit-notes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Booking reference, details, ..."
                  rows={2}
                />
              </div>

              {/* File Attachments */}
              {googleToken && (
                <div className="attachment-section">
                  <div className="attachment-header-row">
                    <span className="attachment-section-label">Attachments</span>
                    <button
                      type="button"
                      className="mini-icon-btn flex-align"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingCount > 0}
                    >
                      <Paperclip size={13} />
                      {uploadingCount > 0 ? 'Uploading…' : 'Attach Files'}
                    </button>
                  </div>
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
                          <span className="attachment-chip-name">{f.name}</span>
                          <button
                            type="button"
                            className="attachment-chip-remove"
                            onClick={() => handleRemoveChip(f)}
                            data-tooltip="Remove file"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {attachedFiles.length > 0 && GeminiService.isAiEnabled() && (
                    <button
                      type="button"
                      className="modal-ai-fill-btn"
                      onClick={handleAiFill}
                      disabled={isAiFilling}
                    >
                      <Sparkles size={13} />
                      {isAiFilling ? 'Filling…' : 'Fill with AI'}
                    </button>
                  )}
                  {aiError && <p className="form-error-text">{aiError}</p>}
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary">Save</button>
            </div>
          </form>
        </div>
      </div>

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
