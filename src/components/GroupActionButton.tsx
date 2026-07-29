import { type LucideIcon } from 'lucide-react';

interface GroupActionButtonProps {
  icon: LucideIcon;
  /** Action label. Shown as text when `labeled`, otherwise used as the tooltip. */
  label: string;
  /** `true` → icon + text (`.catalog-group-action-btn--labeled`);
   *  `false`/omitted → icon-only square (`.catalog-group-action-btn`). */
  labeled?: boolean;
  /** Overrides the tooltip. Icon-only buttons fall back to `label`. */
  tooltip?: string;
  tooltipPosition?: 'bottom';
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  iconSize?: number;
  /** Extra class(es) on the button (e.g. `catalog-ai-refresh-btn`). */
  className?: string;
  iconClassName?: string;
}

/**
 * Canonical action button for group / section headers. Centralizes the
 * labeled-vs-icon-only decision so each surface configures it via a prop instead
 * of re-picking `.catalog-group-action-btn` / `--labeled` by hand: Catalog uses
 * icon-only, Reservations/Expenses use labeled.
 */
export default function GroupActionButton({
  icon: Icon,
  label,
  labeled = false,
  tooltip,
  tooltipPosition,
  onClick,
  disabled,
  iconSize = 12,
  className,
  iconClassName,
}: GroupActionButtonProps) {
  const base = labeled ? 'catalog-group-action-btn--labeled' : 'catalog-group-action-btn';
  const resolvedTooltip = tooltip ?? (labeled ? undefined : label);
  return (
    <button
      type="button"
      className={`mini-icon-btn ${base}${className ? ` ${className}` : ''}`}
      onClick={onClick}
      disabled={disabled}
      data-tooltip={resolvedTooltip}
      data-tooltip-position={tooltipPosition}
    >
      <Icon size={iconSize} className={iconClassName} />
      {labeled ? ` ${label}` : ''}
    </button>
  );
}
