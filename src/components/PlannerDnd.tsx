import { useCallback, useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { PlannerDragData, PlannerDropData } from '../utils/plannerDnd';

/**
 * Render-prop wrappers around dnd-kit's hooks, for the catalog and day-schedule
 * cards. They render no DOM of their own — the caller keeps its existing
 * element and just attaches `setNodeRef` plus `handleProps`, so the markup and
 * CSS of every card family stay exactly as they were.
 *
 * They exist because hooks can't be called from the `render*Card` helpers and
 * `.map()` callbacks these cards are built in. See `src/utils/plannerDnd.ts`
 * for the id/data scheme and `TripPlanner` for the single `DndContext`.
 */

interface DragCardArgs {
  setNodeRef: (node: HTMLElement | null) => void;
  /** Spread onto the element that should be grabbable. Empty when disabled. */
  handleProps: Record<string, unknown>;
  isDragging: boolean;
}

interface PlannerDragCardProps {
  id: string;
  dragData: PlannerDragData;
  dropData: PlannerDropData;
  disabled?: boolean;
  children: (args: DragCardArgs) => ReactNode;
}

/**
 * A card that is both a drag source and a drop target — the same node, the same
 * id in both registries (this is what `useSortable` does internally).
 *
 * It stays a drop target even while disabled: a read-only trip can't drag, but
 * `disabled` here also covers "this card is mid-edit" (notes open), and such a
 * card must still accept drops from elsewhere.
 */
export function PlannerDragCard({ id, dragData, dropData, disabled, children }: PlannerDragCardProps) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id,
    data: dragData,
    disabled,
  });
  const { setNodeRef: setDropRef } = useDroppable({ id, data: dropData });

  const setNodeRef = useCallback(
    (node: HTMLElement | null) => {
      setDragRef(node);
      setDropRef(node);
    },
    [setDragRef, setDropRef]
  );

  return (
    <>
      {children({
        setNodeRef,
        // Nothing is spread when disabled, so a read-only card keeps its plain
        // markup rather than picking up a stray role="button" / tabIndex.
        // `data-dnd-id` is how the drag overlay finds the node to clone —
        // dnd-kit's `active` carries no node reference of its own.
        handleProps: disabled ? {} : { ...attributes, ...listeners, 'data-dnd-id': id },
        isDragging,
      })}
    </>
  );
}

interface PlannerDropZoneProps {
  id: string;
  data: PlannerDropData;
  children: (args: { setNodeRef: (node: HTMLElement | null) => void; isOver: boolean }) => ReactNode;
}

/** A container drop target: a catalog group section, or the timeline's empty space. */
export function PlannerDropZone({ id, data, children }: PlannerDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id, data });
  return <>{children({ setNodeRef, isOver })}</>;
}

interface PlannerDragPreviewProps {
  node: HTMLElement;
  width: number;
  /** True when the card is taller than the overlay's cap, so the cut edge is faded. */
  clipped?: boolean;
}

/**
 * What follows the pointer during a drag: a deep clone of the card being
 * dragged, so the preview is the real thing rather than a label.
 *
 * Cloned via `cloneNode` rather than re-rendered — the card trees here are
 * heavy (a scheduled place card carries notes, AI details and three dropdowns)
 * and rendering a second live copy on every pointer move would be wasteful.
 * `cloneNode` also avoids `dangerouslySetInnerHTML`: nothing is re-parsed from
 * a string, so no markup can be reinterpreted on the way through.
 */
export function PlannerDragPreview({ node, width, clipped }: PlannerDragPreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const clone = node.cloneNode(true) as HTMLElement;
    // The source card is dimmed while dragging; the preview must not be.
    clone.classList.remove('dnd-drag-source');
    // Ids and dnd-kit's aria wiring would otherwise be duplicated in the document.
    clone.removeAttribute('id');
    clone.removeAttribute('aria-describedby');
    clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
    host.replaceChildren(clone);

    return () => host.replaceChildren();
  }, [node]);

  return (
    <div
      ref={hostRef}
      className={`dnd-drag-preview${clipped ? ' dnd-drag-preview--clipped' : ''}`}
      style={{ '--dnd-preview-width': `${width}px` } as CSSProperties}
      aria-hidden="true"
    />
  );
}
