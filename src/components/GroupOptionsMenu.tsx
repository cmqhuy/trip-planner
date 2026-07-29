import { useEffect, useRef, useState } from 'react';
import { MoreVertical, ChevronUp, ChevronDown, Edit2 } from 'lucide-react';

interface GroupOptionsMenuProps {
  /** Move-up handler; item hidden when omitted. */
  onMoveUp?: () => void;
  /** Move-down handler; item hidden when omitted. */
  onMoveDown?: () => void;
  disableUp?: boolean;
  disableDown?: boolean;
  /** Edit handler; item hidden when omitted. */
  onEdit?: () => void;
  editLabel?: string;
  /** Extra `.dropdown-item` buttons rendered after Edit. Receives a `close` fn
   *  so injected items can dismiss the menu after acting. */
  extraItems?: (close: () => void) => React.ReactNode;
  /** Flip the panel above the trigger (near the bottom of a scroll area). */
  showAbove?: boolean;
  tooltip?: string;
}

/**
 * Canonical group "⋮" options dropdown shared by the left-panel group headers
 * (Catalog / Reservations / Expenses). Self-contained: owns its open state and
 * outside-click dismissal, so callers no longer thread an `activeGroupDropdownId`
 * through props. Renders the standard `.group-dropdown-container` +
 * `.dropdown-menu dropdown-menu--right` markup.
 */
export default function GroupOptionsMenu({
  onMoveUp,
  onMoveDown,
  disableUp,
  disableDown,
  onEdit,
  editLabel = 'Edit Group',
  extraItems,
  showAbove,
  tooltip = 'Group Options',
}: GroupOptionsMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const close = () => setOpen(false);
  const run = (fn?: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn?.();
    close();
  };

  return (
    <div className="group-dropdown-container" ref={ref}>
      <button
        type="button"
        className="mini-icon-btn catalog-group-action-btn"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        data-tooltip={tooltip}
      >
        <MoreVertical size={12} />
      </button>
      {open && (
        <div className={`dropdown-menu dropdown-menu--right${showAbove ? ' dropdown-menu-above' : ''}`}>
          {onMoveUp && (
            <button type="button" className="dropdown-item" disabled={disableUp} onClick={run(onMoveUp)}>
              <ChevronUp size={12} /> Move Up
            </button>
          )}
          {onMoveDown && (
            <button type="button" className="dropdown-item" disabled={disableDown} onClick={run(onMoveDown)}>
              <ChevronDown size={12} /> Move Down
            </button>
          )}
          {onEdit && (
            <button type="button" className="dropdown-item" onClick={run(onEdit)}>
              <Edit2 size={12} /> {editLabel}
            </button>
          )}
          {extraItems?.(close)}
        </div>
      )}
    </div>
  );
}
