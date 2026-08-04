import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { PlannerDragData, PlannerDropData } from '../utils/plannerDnd';

/**
 * Render-prop wrappers around dnd-kit's hooks, for the catalog and day-schedule
 * cards. They render no DOM of their own — the caller keeps its existing
 * element and just attaches `setNodeRef`, `handleProps` and `style`, so the
 * markup and CSS of every card family stay exactly as they were.
 *
 * They exist because hooks can't be called from the `render*Card` helpers and
 * `.map()` callbacks these cards are built in. See `src/utils/plannerDnd.ts`
 * for the id/data scheme and `TripPlanner` for the single `DndContext`.
 *
 * Built on `useSortable`, the same primitive as `<SortableList>`, so a reorder
 * inside one list looks and feels identical everywhere in the app: the siblings
 * slide out of the way and the list keeps its height. What `<SortableList>`
 * can't express is the cross-container half of this surface — a place dragged
 * from the catalog into a day, or between two catalog groups. Those land in a
 * list they were never part of, so no sorting strategy has an opinion about
 * them, and they keep the drop-indicator line instead.
 */

interface PlannerSortableGroupProps {
  /** Card ids in render order. Merged pairs contribute their unit's id once. */
  items: string[];
  children: ReactNode;
}

/** One reorderable list: a catalog group's places, or a day's schedule. */
export function PlannerSortableGroup({ items, children }: PlannerSortableGroupProps) {
  return (
    <SortableContext items={items} strategy={verticalListSortingStrategy}>
      {children}
    </SortableContext>
  );
}

interface DragCardArgs {
  setNodeRef: (node: HTMLElement | null) => void;
  /** Spread onto the element that should be grabbable. Empty when disabled. */
  handleProps: Record<string, unknown>;
  /** The sibling-shifting transform. Spread onto the same element as `setNodeRef`. */
  style: CSSProperties;
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
 * A card that is both a drag source and a drop target, and shifts aside when a
 * sibling in the same list is being dragged past it.
 *
 * Drag and drop data are merged because `useSortable` registers one node in both
 * registries under a single `data` object — the keys don't overlap (`source` vs
 * `target`), so `active.data` and `over.data` each still read cleanly.
 *
 * `disabled` covers "read-only trip" and "this card is mid-edit" (notes open).
 * Either way it only disables *dragging*: such a card must still accept drops.
 */
export function PlannerDragCard({ id, dragData, dropData, disabled, children }: PlannerDragCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isSorting } = useSortable({
    id,
    data: { ...dragData, ...dropData },
    disabled: { draggable: !!disabled, droppable: false },
  });

  // Only styled while a drag is in flight. `useSortable` hands back a `transition`
  // string unconditionally, and these cards style their own `transition` in CSS
  // (`--card-transition`, for hover border/shadow) — an inline one would win
  // permanently and kill that.
  //
  // The transform applies to the dragged card too. With a `<DragOverlay>` mounted
  // this is never the follow-the-pointer transform — dnd-kit hands back the
  // *sorting* one, which slides the dimmed source to the slot it will land in.
  // Suppressing it leaves the source sitting in its old slot while its neighbours
  // shift into that same space, and the two overlap. On a cross-container drag
  // the sorting strategy declines to displace anything, so the source correctly
  // stays where it started.
  const style: CSSProperties =
    isSorting ? { transform: CSS.Transform.toString(transform), transition } : {};

  return (
    <>
      {children({
        setNodeRef,
        // Nothing is spread when disabled, so a read-only card keeps its plain
        // markup rather than picking up a stray role="button" / tabIndex.
        // `data-dnd-id` is how the drag overlay finds the node to clone —
        // dnd-kit's `active` carries no node reference of its own.
        handleProps: disabled ? {} : { ...attributes, ...listeners, 'data-dnd-id': id },
        style,
        isDragging,
      })}
    </>
  );
}

/**
 * Same props as `<PlannerDragCard>`, but registers nothing.
 *
 * Used for the two halves of a merged reservation + place pair. The pair is a
 * single drag unit, so the *cell* around them is the sortable; if the halves
 * also registered they would shift independently and the pair would visibly
 * tear apart mid-drag.
 */
export function PlannerInertCard({ children }: PlannerDragCardProps) {
  return <>{children({ setNodeRef: () => {}, handleProps: {}, style: {}, isDragging: false })}</>;
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
    // The source vacates the list while dragging (display: none) — the preview,
    // which is a clone of it, must not inherit that.
    clone.classList.remove('dnd-drag-origin');
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
