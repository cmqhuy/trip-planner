import { useState, useEffect, useRef } from 'react';
import { X, Sparkles, RotateCcw, Paperclip, Trash2 } from 'lucide-react';
import type { Hotel } from '../types';
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

interface HotelModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripStartDate: string;
  tripEndDate: string;
  onSave: (hotelData: Omit<Hotel, 'id'>) => void;
  onDelete?: () => void;
  editingHotel?: Hotel | null;
  googleToken?: string;
  tripPlannerFolderId?: string;
  tripName?: string;
  tripFilesFolderId?: string;
  onFileFolderCreated?: (folderId: string) => void;
}

type SavedValues = {
  name: string; address: string; checkInDate: string; checkInTime: string;
  checkOutDate: string; checkOutTime: string; confirmationNo: string; notes: string;
};

export default function HotelModal({
  isOpen,
  onClose,
  tripStartDate,
  tripEndDate,
  onSave,
  onDelete,
  editingHotel,
  googleToken,
  tripPlannerFolderId,
  tripName,
  tripFilesFolderId,
  onFileFolderCreated,
}: HotelModalProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkInTime, setCheckInTime] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');
  const [confirmationNo, setConfirmationNo] = useState('');
  const [notes, setNotes] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [isAiFilling, setIsAiFilling] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [savedValues, setSavedValues] = useState<SavedValues | null>(null);
  const [removePrompt, setRemovePrompt] = useState<AttachedFile | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const h = editingHotel;
      const initial: SavedValues = {
        name: h?.name ?? '',
        address: h?.address ?? '',
        checkInDate: h?.checkInDate ?? tripStartDate,
        checkInTime: h?.checkInTime ?? '',
        checkOutDate: h?.checkOutDate ?? tripStartDate,
        checkOutTime: h?.checkOutTime ?? '',
        confirmationNo: h?.confirmationNo ?? '',
        notes: h?.notes ?? '',
      };
      setName(initial.name);
      setAddress(initial.address);
      setCheckInDate(initial.checkInDate);
      setCheckInTime(initial.checkInTime);
      setCheckOutDate(initial.checkOutDate);
      setCheckOutTime(initial.checkOutTime);
      setConfirmationNo(initial.confirmationNo);
      setNotes(initial.notes);
      setAttachedFiles(
        (h?.attachmentFileIds ?? []).map((id, i) => ({ name: `File ${i + 1}`, fileId: id }))
      );
      setSavedValues(initial);
      setAiError(null);
      setRemovePrompt(null);
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
    onSave({
      name: name.trim(),
      address: address.trim() || undefined,
      checkInDate,
      checkInTime: checkInTime || undefined,
      checkOutDate,
      checkOutTime: checkOutTime || undefined,
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

  const handleRemoveChip = (file: AttachedFile) => {
    setRemovePrompt(file);
  };

  const confirmRemoveChip = async (action: 'delete' | 'archive' | 'keep') => {
    if (!removePrompt) return;
    const file = removePrompt;
    setRemovePrompt(null);
    if (action === 'delete' && googleToken) {
      try { await deleteFileFromDrive(googleToken, file.fileId); } catch { /* ignore */ }
    } else if (action === 'archive' && googleToken) {
      try {
        await renameFolderInDrive(googleToken, file.fileId, `[Archived] ${file.name}`);
      } catch { /* ignore */ }
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
      const result = await GeminiService.generateHotelDetailsFromFilesWithRotation(fileContents);
      if (result.name) setName(result.name);
      if (result.address) setAddress(result.address);
      if (result.checkInDate) setCheckInDate(result.checkInDate);
      if (result.checkInTime) setCheckInTime(result.checkInTime);
      if (result.checkOutDate) setCheckOutDate(result.checkOutDate);
      if (result.checkOutTime) setCheckOutTime(result.checkOutTime);
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

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content glass-panel scrollable" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Hotel Details</h3>
            <button className="modal-close" onClick={onClose}><X size={20} /></button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-scroll-body">
            {/* Hotel Name */}
            <div className="form-group">
              <label htmlFor="hotel-name">
                Hotel Name
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
              <label htmlFor="hotel-address">
                Address (Optional)
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
                <label htmlFor="hotel-checkin">
                  Check-In Date
                  {undoBtn(checkInDate, savedValues?.checkInDate, () => setCheckInDate(savedValues!.checkInDate))}
                </label>
                <input
                  type="date"
                  id="hotel-checkin"
                  value={checkInDate}
                  onChange={e => handleCheckInChange(e.target.value)}
                  min={tripStartDate}
                  max={tripEndDate}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="hotel-checkin-time">
                  Check-In Time
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
                <label htmlFor="hotel-checkout">
                  Check-Out Date
                  {undoBtn(checkOutDate, savedValues?.checkOutDate, () => setCheckOutDate(savedValues!.checkOutDate))}
                </label>
                <input
                  type="date"
                  id="hotel-checkout"
                  value={checkOutDate}
                  onChange={e => setCheckOutDate(e.target.value)}
                  min={checkInDate || tripStartDate}
                  max={tripEndDate}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="hotel-checkout-time">
                  Check-Out Time
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

            {/* Confirmation No */}
            <div className="form-group">
              <label htmlFor="hotel-conf">
                Confirmation No (Optional)
                {undoBtn(confirmationNo, savedValues?.confirmationNo, () => setConfirmationNo(savedValues!.confirmationNo))}
              </label>
              <input
                type="text"
                id="hotel-conf"
                value={confirmationNo}
                onChange={e => setConfirmationNo(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="form-group">
              <label htmlFor="hotel-notes">
                Notes (Optional)
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
              {onDelete && editingHotel && (
                <button type="button" className="btn-danger" style={{ marginRight: 'auto' }} onClick={onDelete}>Delete</button>
              )}
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
