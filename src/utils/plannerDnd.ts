import { pointerWithin, rectIntersection, type ClientRect, type CollisionDetection } from '@dnd-kit/core';

/**
 * dnd-kit wiring for the planner's two cross-container drag surfaces: the
 * catalog (left panel) and the day schedule (timeline).
 *
 * `<SortableList>` deliberately doesn't cover these — they aren't "reorder one
 * array" lists. A catalog place can be dropped into a *different* group (which
 * regroups it) or into a specific slot in the timeline, and a merged
 * place-reservation + place pair moves as a single block. That needs one
 * `DndContext` spanning both panels, which lives in `TripPlanner`.
 *
 * The drop *semantics* (which array moves, and how) stay in TripPlanner's
 * existing handlers — this module only supplies the identity, hit-testing and
 * top/bottom math the old HTML5 handlers used to compute inline.
 */

export type DropPosition = 'top' | 'bottom';

/** Where a drag started. `label` is what the drag overlay chip shows. */
export type PlannerDragData =
  | { source: 'catalog'; placeId: string; label: string }
  | { source: 'day'; index: number; label: string };

/**
 * What sits under the pointer. `catalog-group` and `day-timeline` are
 * *containers* — they only win when no card inside them is hit.
 *
 * `unitStart`/`unitEnd` describe the merged unit a schedule item belongs to
 * (`[idx, idx]` when it isn't merged), so the drop position can snap to the
 * unit's outer edge without the context needing ItineraryPanel's internals.
 */
export type PlannerDropData =
  | { target: 'catalog-place'; placeId: string; groupId: string }
  | { target: 'catalog-group'; groupId: string }
  | { target: 'day-item'; index: number; unitStart: number; unitEnd: number }
  | { target: 'day-timeline' };

export const catalogPlaceDndId = (placeId: string) => `catalog-place:${placeId}`;
export const catalogGroupDndId = (groupId: string) => `catalog-group:${groupId}`;
export const dayItemDndId = (index: number) => `day-item:${index}`;
export const DAY_TIMELINE_DND_ID = 'day-timeline';

/** Containers are identified by their id prefix — no droppable data lookup needed. */
const isContainerDndId = (id: string | number): boolean =>
  String(id).startsWith('catalog-group:') || String(id) === DAY_TIMELINE_DND_ID;

/**
 * Collision detection that prefers cards over their containers.
 *
 * Both a catalog place card and its group section are registered droppables,
 * and the card is nested inside the section — so a pointer over a card hits
 * both. Cards must win, otherwise every drop would fall through to
 * "append to this group". A container only becomes `over` when the pointer is
 * in its empty space (a group header, or the blank area below the timeline),
 * which is exactly the old behaviour: the section's `onDrop` fired only when no
 * card called `stopPropagation` first.
 *
 * `pointerWithin` needs pointer coordinates, which the keyboard sensor has
 * none of — fall back to rect intersection there.
 *
 * Also records the live pointer position, because `onDragOver`/`onDragEnd`
 * don't carry it and the top/bottom split is measured against the pointer (see
 * `resolveDropPosition`). Collision detection runs immediately before those
 * callbacks with the same event, so the value is always current.
 */
export function plannerCollisionDetection(
  args: Parameters<CollisionDetection>[0],
  pointerRef: { current: { x: number; y: number } | null }
): ReturnType<CollisionDetection> {
  pointerRef.current = args.pointerCoordinates ?? null;

  const hits = args.pointerCoordinates ? pointerWithin(args) : [];
  const resolved = hits.length > 0 ? hits : rectIntersection(args);
  const cards = resolved.filter(collision => !isContainerDndId(collision.id));
  return cards.length > 0 ? cards : resolved;
}

/**
 * Whether a drop lands above or below the hovered card.
 *
 * Reproduces the HTML5 rule this replaced — `(e.clientY - rect.top) < rect.height / 2`
 * — against the same pointer position. Without a pointer (keyboard drag) it
 * falls back to the dragged card's own centre.
 */
export function resolveDropPosition(
  overRect: ClientRect,
  pointer: { x: number; y: number } | null,
  activeRect?: ClientRect | null
): DropPosition {
  const y = pointer
    ? pointer.y
    : activeRect
      ? activeRect.top + activeRect.height / 2
      : overRect.top + overRect.height / 2;
  return y - overRect.top < overRect.height / 2 ? 'top' : 'bottom';
}

/**
 * Snaps a drop onto a merged pair to the whole unit's outer edge — hovering the
 * top half drops above the unit, the bottom half drops below it, never between
 * the two. A non-merged item passes the position through unchanged.
 */
export function clampToMergeUnit(
  drop: { index: number; unitStart: number; unitEnd: number },
  position: DropPosition
): DropPosition {
  if (drop.unitStart === drop.unitEnd) return position;
  return drop.index === drop.unitStart ? 'top' : 'bottom';
}

/** True when a day-sourced drag is hovering its own merged unit — a no-op drop. */
export function isOwnMergeUnit(
  drop: { unitStart: number; unitEnd: number },
  draggedIndex: number
): boolean {
  return draggedIndex >= drop.unitStart && draggedIndex <= drop.unitEnd;
}
