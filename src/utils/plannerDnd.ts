import { closestCenter, pointerWithin, rectIntersection, type ClientRect, type CollisionDetection } from '@dnd-kit/core';

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

/** Where a drag started. `label` is the overlay's fallback if the card can't be cloned. */
export type PlannerDragData =
  | { source: 'catalog'; placeId: string; label: string }
  | { source: 'day'; index: number; label: string };

/**
 * The element a drag is really moving. `<PlannerDragCard>` stamps `data-dnd-id`
 * onto every draggable, because dnd-kit's `active` carries no node reference and
 * the drag overlay needs the real node to clone — and its height, to size the
 * gap that opens at the drop position.
 *
 * Resolves up to the merged cell when the grabbed card is half of a pair: the
 * pair moves as one block, so both the preview and the gap have to be the whole
 * unit, not the half that happened to be under the finger.
 */
export function findDragNode(id: string | number): HTMLElement | null {
  const node = document.querySelector<HTMLElement>(`[data-dnd-id="${id}"]`);
  if (!node) return null;
  return node.closest<HTMLElement>(MERGED_CELL_SELECTOR) ?? node;
}

/**
 * What sits under the pointer. `catalog-group` and `day-timeline` are
 * *containers* — they only win when no card inside them is hit.
 *
 * A merged place-reservation + place pair registers **once**, at its unit's
 * start index, because the whole cell is one droppable. That is what keeps a
 * drop on the unit's outer edge rather than between the two halves, with no
 * clamping needed: the cell's own midpoint is the top/bottom split.
 */
export type PlannerDropData =
  | { target: 'catalog-place'; placeId: string; groupId: string }
  | { target: 'catalog-group'; groupId: string }
  | { target: 'day-item'; index: number }
  | { target: 'day-timeline' };

export const catalogPlaceDndId = (placeId: string) => `catalog-place:${placeId}`;
export const catalogGroupDndId = (groupId: string) => `catalog-group:${groupId}`;
export const dayItemDndId = (index: number) => `day-item:${index}`;
export const DAY_TIMELINE_DND_ID = 'day-timeline';

/** Containers are identified by their id prefix — no droppable data lookup needed. */
const isContainerDndId = (id: string | number): boolean =>
  String(id).startsWith('catalog-group:') || String(id) === DAY_TIMELINE_DND_ID;

/** Which container a card droppable belongs to, derived rather than stored. */
function containerOfCard(data: PlannerDropData | undefined): string | null {
  if (!data) return null;
  if (data.target === 'catalog-place') return catalogGroupDndId(data.groupId);
  if (data.target === 'day-item') return DAY_TIMELINE_DND_ID;
  return null;
}

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
 * When the pointer sits in a *gap* between cards (the timeline has a 16px gap,
 * the catalog 8px) no card is hit at all. Resolving to the container there was
 * a bug: the indicator vanished and the drop appended to the end of the list
 * instead of landing under the pointer. So an unmatched pointer resolves to the
 * nearest card **within the container it is over** — near enough that the
 * top/bottom split then puts it on the correct side. A container only wins when
 * it holds no cards (an empty day, an empty group), which is the one case where
 * "append" is the right answer.
 *
 * Also records the live pointer position, because `onDragMove`/`onDragEnd`
 * don't carry it and the top/bottom split is measured against the pointer (see
 * `resolveDropPosition`). Collision detection runs immediately before those
 * callbacks with the same event, so the value is always current.
 */
export function plannerCollisionDetection(
  args: Parameters<CollisionDetection>[0],
  pointerRef: { current: { x: number; y: number } | null }
): ReturnType<CollisionDetection> {
  const pointer = args.pointerCoordinates ?? null;
  pointerRef.current = pointer;

  const hits = pointer ? pointerWithin(args) : [];
  const resolved = hits.length > 0 ? hits : rectIntersection(args);

  const cards = resolved.filter(collision => !isContainerDndId(collision.id));
  if (cards.length > 0) return cards;

  const container = resolved.find(collision => isContainerDndId(collision.id));
  if (!container) return resolved;

  const siblings = args.droppableContainers.filter(
    droppable =>
      droppable.id !== args.active.id &&
      containerOfCard(droppable.data.current as PlannerDropData | undefined) === container.id
  );
  if (siblings.length === 0) return resolved;

  if (!pointer) {
    const byRect = closestCenter({ ...args, droppableContainers: siblings });
    return byRect.length > 0 ? byRect : resolved;
  }

  // Nearest by pointer, not by the dragged card's centre — a tall card being
  // dragged would otherwise pick a target well away from the finger.
  let nearest: (typeof siblings)[number] | null = null;
  let nearestDistance = Infinity;
  for (const droppable of siblings) {
    const rect = args.droppableRects.get(droppable.id);
    if (!rect) continue;
    const distance = Math.abs(pointer.y - (rect.top + rect.height / 2));
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = droppable;
    }
  }

  return nearest ? [{ id: nearest.id, data: { droppableContainer: nearest, value: nearestDistance } }] : resolved;
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

/** The container a merged place-reservation + place pair renders inside. */
export const MERGED_CELL_SELECTOR = '.schedule-merged-cell';
