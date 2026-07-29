interface SectionHeaderProps {
  /** `group` = left-panel per-group header (`.place-group-header`, 14px dot/icon
   *  + name). `section` = day-view timeline section header (`.timeline-section-header`,
   *  16px icon title + optional subtitle). The two surfaces stay visually
   *  distinct — this shell just gives them one rendering/styling source. */
  variant: 'group' | 'section';
  /** Leading dot (group) or Lucide icon (both). */
  glyph?: React.ReactNode;
  title: React.ReactNode;
  /** Native `title` attr on the group name for ellipsis hover. */
  titleAttr?: string;
  /** Second line under the title (section variant only). */
  subtitle?: React.ReactNode;
  /** Right-side controls: injected buttons + `<GroupOptionsMenu>` + count badge. */
  actions?: React.ReactNode;
  /** Extra class on the header root (e.g. `ai-day-assistant-header`). */
  headerClassName?: string;
  /** Extra class on the actions wrapper (e.g. a gap override). */
  actionsClassName?: string;
}

/**
 * Slotted header shell shared by the left-panel group headers and the day-view
 * timeline section headers. Owns the frame, glyph, title, and actions layout so
 * every surface renders and styles them the same way; each caller injects its
 * own action buttons / options menu into the `actions` slot.
 */
export default function SectionHeader({
  variant,
  glyph,
  title,
  titleAttr,
  subtitle,
  actions,
  headerClassName,
  actionsClassName,
}: SectionHeaderProps) {
  if (variant === 'group') {
    return (
      <div className={`place-group-header${headerClassName ? ` ${headerClassName}` : ''}`}>
        <span className="place-group-title">
          {glyph}
          <span className="catalog-group-name" title={titleAttr}>{title}</span>
        </span>
        {actions && (
          <div className={`flex-align flex-align--gap4${actionsClassName ? ` ${actionsClassName}` : ''}`}>
            {actions}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`timeline-section-header${headerClassName ? ` ${headerClassName}` : ''}`}>
      <div className="timeline-section-title-row">
        <h4 className="timeline-section-title">{glyph}{title}</h4>
        {subtitle && <span className="timeline-section-subtitle">{subtitle}</span>}
      </div>
      {actions && (
        <div className={`timeline-section-actions${actionsClassName ? ` ${actionsClassName}` : ''}`}>
          {actions}
        </div>
      )}
    </div>
  );
}
