import { useState } from 'react';
import { FileText, Edit2, Check } from 'lucide-react';

export interface InlineNotesProps {
  /** Current saved note text. */
  value?: string;
  /** When false, renders read-only (no edit affordance). */
  canEdit: boolean;
  /** Called with the drafted text when the user saves. */
  onSave: (text: string) => void;
  /**
   * Visual layout. Both share the same view/edit/save behavior — only the read
   * view and button sizing differ.
   * - `card`    → label + edit button inside a `.notes-box` (catalog + left-panel reservations).
   * - `compact` → icon-row, click-anywhere-to-edit (day-view cards).
   */
  layout?: 'card' | 'compact';
  /** Placeholder shown when there is no note. Defaults per layout. */
  emptyText?: string;
  /** compact only: reserve right padding so the text clears an overlapping options menu. */
  reserveActionSpace?: boolean;
  /**
   * Fired when the editor opens/closes. Lets a parent react to edit state without
   * owning it — e.g. disabling card drag while notes are being edited.
   */
  onEditingChange?: (editing: boolean) => void;
}

/**
 * Canonical inline notes control. Owns its own draft/edit state so parents no
 * longer need per-entity `editing*NoteId` / `editing*NotesText` bookkeeping.
 */
export function InlineNotes({
  value,
  canEdit,
  onSave,
  layout = 'card',
  emptyText,
  reserveActionSpace = false,
  onEditingChange,
}: InlineNotesProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const isCompact = layout === 'compact';
  const placeholder = emptyText ?? (isCompact ? 'Add notes...' : 'No notes added yet.');
  const btnClass = isCompact ? 'place-notes-btn' : 'catalog-place-action-btn';

  const setEditingState = (next: boolean) => {
    setEditing(next);
    onEditingChange?.(next);
  };

  const startEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDraft(value ?? '');
    setEditingState(true);
  };
  const cancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingState(false);
  };
  const save = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSave(draft);
    setEditingState(false);
  };

  const editor = (
    <div className="notes-edit-wrapper" onClick={e => e.stopPropagation()}>
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        placeholder="Add notes..."
        rows={isCompact ? 4 : 3}
        className="notes-textarea"
        autoFocus
      />
      <div className="notes-actions">
        <button type="button" className={`btn-secondary ${btnClass}`} onClick={cancel}>Cancel</button>
        <button type="button" className={`btn-primary flex-align ${btnClass}`} onClick={save}>
          <Check size={isCompact ? 10 : 12} /> {isCompact ? 'Save' : 'Save Notes'}
        </button>
      </div>
    </div>
  );

  if (isCompact) {
    if (editing) return editor;
    return (
      <div
        className={`notes-text-wrapper${canEdit ? ' is-clickable' : ''}${reserveActionSpace ? ' notes-text-wrapper--pad-action' : ''}`}
        onClick={canEdit ? startEdit : undefined}
      >
        <div className={`notes-text ${value ? 'has-content' : 'no-content'}`}>
          <FileText size={13} />
          <span>{value || placeholder}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="notes-box">
      <label className="notes-label">
        <FileText size={11} /> Notes
        {canEdit && !editing && (
          <button
            type="button"
            className="mini-icon-btn notes-edit-btn"
            onClick={startEdit}
            data-tooltip="Edit notes"
            aria-label="Edit notes"
          >
            <Edit2 size={12} />
          </button>
        )}
      </label>
      {editing && canEdit ? editor : (
        <span className={`notes-text ${value ? 'has-content' : 'no-content'}`}>{value || placeholder}</span>
      )}
    </div>
  );
}

export default InlineNotes;
