import { useCallback, type ReactNode } from 'react';
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
        handleProps: disabled ? {} : { ...attributes, ...listeners },
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
