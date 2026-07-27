import { RotateCcw } from 'lucide-react';

/**
 * Shared "restore original value" affordance for modal form fields. Renders
 * nothing when there is no saved value to restore or the field is unchanged.
 *
 * Exposed as a function (not a component) so existing call sites that did
 * `undoBtn(current, saved, onRestore)` can switch to
 * `import { undoButton as undoBtn }` with no other change.
 */
export function undoButton(
  current: string | undefined,
  saved: string | undefined,
  onRestore: () => void,
) {
  if (saved === undefined || current === saved) return null;
  return (
    <button type="button" className="undo-btn" onClick={onRestore} data-tooltip="Restore original value">
      <RotateCcw size={11} />
    </button>
  );
}

export default undoButton;
