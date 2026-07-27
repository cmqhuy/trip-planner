import { useState, useRef } from 'react';
import { X, Paperclip, Share2, Pencil, Check, ExternalLink, Trash2, RefreshCw, Sparkles } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import ShareTripModal from './ShareTripModal';
import { GeminiService, AI_NOT_CONFIGURED_MESSAGE, AI_FILE_CONTENTS_NOT_AVAILABLE_IN_MANUAL_MODE_MESSAGE } from '../utils/ai';
import type { ReservationAttachments } from '../utils/useReservationAttachments';

interface AttachmentsSectionProps {
  /** The bundle returned by useReservationAttachments. */
  attach: ReservationAttachments;
  googleToken?: string;
  isOwner: boolean;
  tripDriveFileId?: string;
  tripName?: string;
  tripFilesFolderId?: string;
  /** Label for the "fill from attached files" AI button. */
  aiFillLabel?: string;
}

/**
 * Canonical attachments block for reservation modals: the header (AI-fill +
 * Attach), the share-folder notice, the chip list with inline rename/remove,
 * and the remove/access/share sub-modals. Replaces the ~100-line copy-pasted
 * block in HotelModal, TransportModal, and PlaceReservationModal.
 *
 * Renders nothing unless the user is signed into Google.
 */
export default function AttachmentsSection({
  attach,
  googleToken,
  isOwner,
  tripDriveFileId,
  tripName,
  tripFilesFolderId,
  aiFillLabel = 'Fill Details with AI',
}: AttachmentsSectionProps) {
  const {
    attachedFiles,
    uploadingCount,
    removePrompt,
    setRemovePrompt,
    handleFileSelect,
    handleRemoveChip,
    confirmRemoveChip,
    renameAttachment,
    aiError,
    showAccessError,
    setShowAccessError,
    isAiFilling,
    handleAiFill,
  } = attach;

  const [editingChip, setEditingChip] = useState<{ fileId: string; value: string } | null>(null);
  const [showShareFolder, setShowShareFolder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const aiEnabled = GeminiService.isAiEnabled();
  const manualMode = GeminiService.isManualMode();

  if (!googleToken) return null;

  return (
    <>
      <div className="attachment-section">
        <div className="attachment-header-row">
          <span className="attachment-section-label">Attachments</span>
          <div className="attachment-header-actions">
            {attachedFiles.length > 0 && (
              <button
                type="button"
                className="modal-ai-fill-btn modal-ai-fill-btn--inline"
                onClick={handleAiFill}
                disabled={isAiFilling || !aiEnabled || manualMode}
                data-tooltip={
                  !aiEnabled ? AI_NOT_CONFIGURED_MESSAGE :
                  manualMode ? AI_FILE_CONTENTS_NOT_AVAILABLE_IN_MANUAL_MODE_MESSAGE :
                  undefined
                }
                data-tooltip-position="bottom"
              >
                {isAiFilling ? <RefreshCw size={13} className="spin" /> : <Sparkles size={13} />}
                {isAiFilling ? 'Generating…' : aiFillLabel}
              </button>
            )}
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
