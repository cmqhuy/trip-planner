import { useState } from 'react';
import { Trash2, Archive, Link } from 'lucide-react';
import type { Hotel, TransportationReservation } from '../types';
import Modal from './Modal';
import { deleteFileFromDrive, renameFolderInDrive } from '../utils/googleDrive';

interface Props {
  type: 'hotel' | 'transport';
  item: Hotel | TransportationReservation;
  googleToken?: string;
  onConfirm: () => void;
  onCancel: () => void;
  // For multi-segment transport deletion
  segmentIndex?: number;
  totalSegments?: number;
  onConfirmSegmentOnly?: () => void;
}

type FileChoice = 'keep' | 'archive' | 'delete';
type DeleteChoice = 'transitSegment' | 'reservation';

export default function DeleteReservationModal({
  type, item, googleToken, onConfirm, onCancel,
  segmentIndex, totalSegments, onConfirmSegmentOnly,
}: Props) {
  const isMultiSegment = type === 'transport' && totalSegments !== undefined && totalSegments > 1;
  const [deleteChoice, setDeleteChoice] = useState<DeleteChoice | null>(isMultiSegment ? null : 'reservation');
  const [fileChoice, setFileChoice] = useState<FileChoice>('keep');
  const [isProcessing, setIsProcessing] = useState(false);

  const attachmentCount = item.attachments?.length ?? 0;
  const hasAttachments = attachmentCount > 0 && !!googleToken;

  const title = type === 'hotel' ? 'Delete Hotel Reservation' : 'Delete Transit Reservation';

  const handleConfirmReservation = async () => {
    if (hasAttachments && fileChoice !== 'keep') {
      setIsProcessing(true);
      try {
        for (const att of item.attachments ?? []) {
          if (fileChoice === 'delete') {
            try { await deleteFileFromDrive(googleToken!, att.fileId); } catch { /* ignore */ }
          } else if (fileChoice === 'archive') {
            try { await renameFolderInDrive(googleToken!, att.fileId, `[Archived] ${att.name}`); } catch { /* ignore */ }
          }
        }
      } finally {
        setIsProcessing(false);
      }
    }
    onConfirm();
  };

  const handleConfirmSegment = () => {
    onConfirmSegmentOnly?.();
  };

  return (
    <Modal title={title} onClose={onCancel} maxWidth={420}>
        {isMultiSegment && deleteChoice === null ? (
          <>
            <p className="modal-body-text">
              This transit reservation has {totalSegments} segments. What would you like to delete?
            </p>
            <div className="modal-delete-file-opts">
              <button
                className="modal-delete-file-opt"
                onClick={() => setDeleteChoice('transitSegment')}
              >
                <Trash2 size={14} />
                Delete transit segment {(segmentIndex ?? 0) + 1} only
              </button>
              <button
                className="modal-delete-file-opt"
                onClick={() => setDeleteChoice('reservation')}
              >
                <Trash2 size={14} />
                Delete entire transit reservation
              </button>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
            </div>
          </>
        ) : deleteChoice === 'transitSegment' ? (
          <>
            <p className="modal-body-text">
              Are you sure you want to delete segment {(segmentIndex ?? 0) + 1} from this transit reservation?
            </p>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
              <button type="button" className="btn-danger" onClick={handleConfirmSegment}>Delete Segment</button>
            </div>
          </>
        ) : (
          <>
            <p className="modal-body-text">
              {type === 'hotel'
                ? 'Are you sure you want to delete this hotel reservation?'
                : 'Are you sure you want to delete this transit reservation?'}
            </p>

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
                onClick={handleConfirmReservation}
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing…' : 'Delete'}
              </button>
            </div>
          </>
        )}
    </Modal>
  );
}
