import { X } from 'lucide-react';

interface ModalProps {
  /** Header title (text or nodes). */
  title: React.ReactNode;
  /** Close handler — fired by the ✕ button and (by default) an overlay click. */
  onClose: () => void;
  children: React.ReactNode;
  /** Optional max width for the content panel (number → px). */
  maxWidth?: number | string;
  /** Extra classes appended to `.modal-content`. */
  className?: string;
  /** Set false to disable dismiss-on-overlay-click (e.g. destructive flows). */
  closeOnOverlayClick?: boolean;
}

/**
 * Canonical modal shell: the `.modal-overlay` + `.modal-content glass-panel
 * scrollable` wrapper and the `.modal-header` (title + ✕). Always applies
 * `scrollable`, so new dialogs can't forget it. Children render inside the
 * content panel, below the header.
 *
 * Outside-click and ✕ both call `onClose`; the content stops propagation.
 */
export default function Modal({
  title,
  onClose,
  children,
  maxWidth,
  className = '',
  closeOnOverlayClick = true,
}: ModalProps) {
  return (
    <div className="modal-overlay" onClick={closeOnOverlayClick ? onClose : undefined}>
      <div
        className={`modal-content glass-panel scrollable${className ? ` ${className}` : ''}`}
        style={maxWidth !== undefined ? { maxWidth } : undefined}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
