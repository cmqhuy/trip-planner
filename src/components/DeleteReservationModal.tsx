import { useState } from 'react';
import { X, Trash2, Archive, Link } from 'lucide-react';
import type { Hotel, Transportation } from '../types';
import { deleteFileFromDrive, renameFolderInDrive } from '../utils/googleDrive';

interface Props {
  type: 'hotel' | 'transport';
  item: Hotel | Transportation;
  googleToken?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

type FileChoice = 'keep' | 'archive' | 'delete';

export default function DeleteReservationModal({ type, item, googleToken, onConfirm, onCancel }: Props) {
  const [fileChoice, setFileChoice] = useState<FileChoice>('keep');
  const [isProcessing, setIsProcessing] = useState(false);

  const attachmentCount = item.attachmentFileIds?.length ?? 0;
  const hasAttachments = attachmentCount > 0 && !!googleToken;

  const title = type === 'hotel' ? 'Delete Hotel Reservation' : 'Delete Transit Reservation';
  const message = type === 'hotel'
    ? 'Are you sure you want to delete this hotel reservation?'
    : 'Are you sure you want to delete this transit reservation?';

  const handleConfirm = async () => {
    if (hasAttachments && fileChoice !== 'keep') {
      setIsProcessing(true);
      try {
        for (const fileId of item.attachmentFileIds!) {
          if (fileChoice === 'delete') {
            try { await deleteFileFromDrive(googleToken!, fileId); } catch { /* ignore */ }
          } else if (fileChoice === 'archive') {
            try { await renameFolderInDrive(googleToken!, fileId, `[Archived] file`); } catch { /* ignore */ }
          }
        }
      } finally {
        setIsProcessing(false);
      }
    }
    onConfirm();
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content glass-panel" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onCancel}><X size={20} /></button>
        </div>

        <p className="modal-body-text">{message}</p>

        {hasAttachments && (
          <>
            <p className="modal-body-text" style={{ marginBottom: 6 }}>
              This reservation has {attachmentCount} attached file{attachmentCount !== 1 ? 's' : ''} on Google Drive. What should happen to them?
            </p>
            <div className="modal-delete-file-opts">
              <button
                className={`modal-delete-file-opt${fileChoice === 'keep' ? ' selected' : ''}`}
                onClick={() => setFileChoice('keep')}
              >
                <Link size={14} />
                Keep files on Drive (remove link only)
              </button>
              <button
                className={`modal-delete-file-opt${fileChoice === 'archive' ? ' selected' : ''}`}
                onClick={() => setFileChoice('archive')}
              >
                <Archive size={14} />
                Archive files (rename with [Archived])
              </button>
              <button
                className={`modal-delete-file-opt${fileChoice === 'delete' ? ' selected' : ''}`}
                onClick={() => setFileChoice('delete')}
              >
                <Trash2 size={14} />
                Delete files from Drive
              </button>
            </div>
          </>
        )}

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={isProcessing}>Cancel</button>
          <button
            type="button"
            className="btn-danger"
            onClick={handleConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
