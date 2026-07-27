import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, type LucideIcon } from 'lucide-react';

export interface ComboOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Optional icon tint (e.g. per-type accent color). */
  iconColor?: string;
}

interface ComboBoxProps<T extends string> {
  value: T;
  options: readonly ComboOption<T>[];
  onChange: (value: T) => void;
  /** Minimum dropdown width in px (defaults to the trigger width, min 150). */
  minWidth?: number;
  /** Icon size for the trigger + options (status uses 13, type uses 14). */
  iconSize?: number;
  /** Optional id for the trigger button (for label association). */
  id?: string;
  disabled?: boolean;
}

/**
 * Canonical glassmorphic selection combo box. Renders the dropdown panel through
 * a portal (never clipped by a scrollable modal), dismisses on outside click via
 * a fixed-inset overlay, and lifts above siblings. Replaces the hand-rolled
 * status / type / group combos that previously repeated this boilerplate.
 *
 * The searchable timezone and bespoke catalog-place pickers are intentionally
 * not built on this component.
 */
export function ComboBox<T extends string>({
  value,
  options,
  onChange,
  minWidth = 150,
  iconSize = 13,
  id,
  disabled = false,
}: ComboBoxProps<T>) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = options.find(o => o.value === value);
  const SelectedIcon = selected?.icon;

  const toggle = () => {
    if (disabled) return;
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    setOpen(o => !o);
  };

  return (
    <div className="combo-wrapper">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="combo-trigger"
        onClick={toggle}
        disabled={disabled}
      >
        <span className="combo-trigger-content">
          {SelectedIcon ? <SelectedIcon size={iconSize} style={selected?.iconColor ? { color: selected.iconColor } : undefined} /> : null}
          {selected?.label ?? value}
        </span>
        <ChevronDown size={14} className={`expand-chevron${open ? ' is-open' : ''}`} />
      </button>
      {open && pos && createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }} onClick={() => setOpen(false)} />
          <div
            className="combo-dropdown--portal"
            style={{ top: pos.top, left: pos.left, width: Math.max(pos.width, minWidth) }}
            onClick={e => e.stopPropagation()}
          >
            {options.map(opt => {
              const OptIcon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`combo-option${opt.value === value ? ' selected' : ''}`}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                >
                  {OptIcon ? <OptIcon size={iconSize} style={opt.iconColor ? { color: opt.iconColor } : undefined} /> : null}{opt.label}
                </button>
              );
            })}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}

export default ComboBox;
