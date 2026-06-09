import { X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isAlert?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText,
  cancelText = 'Cancel',
  isAlert = false,
  onConfirm,
  onCancel
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const isDeleteOrDanger = 
    confirmText?.toLowerCase() === 'delete' || 
    confirmText?.toLowerCase() === 'leave' || 
    title.toLowerCase().includes('delete') || 
    title.toLowerCase().includes('leave');

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content glass-panel" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onCancel}>
            <X size={20} />
          </button>
        </div>
        <div style={{ 
          padding: '16px 0', 
          color: 'var(--text-secondary)', 
          fontSize: '14px', 
          lineHeight: '1.5', 
          textTransform: 'none', 
          whiteSpace: 'pre-wrap' 
        }}>
          {message}
        </div>
        <div className="modal-actions" style={{ marginTop: '20px' }}>
          {!isAlert && (
            <button type="button" className="btn-secondary" onClick={onCancel}>
              {cancelText}
            </button>
          )}
          <button 
            type="button" 
            className="btn-primary" 
            style={{ 
              background: (isAlert && !isDeleteOrDanger) ? 'var(--accent-primary)' : isDeleteOrDanger ? 'var(--color-danger)' : 'var(--accent-primary)', 
              borderColor: (isAlert && !isDeleteOrDanger) ? 'var(--accent-primary)' : isDeleteOrDanger ? 'var(--color-danger)' : 'var(--accent-primary)' 
            }}
            onClick={onConfirm}
          >
            {confirmText || (isAlert ? 'OK' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
