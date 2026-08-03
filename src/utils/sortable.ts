import { KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

/**
 * Shared drag-to-reorder primitives, used by <SortableList> and by the bespoke
 * dnd-kit surfaces (day schedule, catalog) that need their own drop semantics.
 *
 * Lives outside the component file so Fast Refresh keeps working — a module that
 * exports both components and non-components breaks it.
 */

/**
 * Sensor activation, tuned per input type. These values matter:
 *
 * - Mouse: 8px of movement before a drag begins, so clicks on buttons inside a
 *   draggable row still register as clicks rather than aborted drags.
 * - Touch: a 200ms long-press, so vertical page scrolling keeps working. Do NOT
 *   swap this for a distance constraint — a distance-based touch sensor swallows
 *   scroll gestures and the list becomes unscrollable on a phone.
 */
export const SORTABLE_SENSOR_OPTIONS = {
  mouse: { activationConstraint: { distance: 8 } },
  touch: { activationConstraint: { delay: 200, tolerance: 8 } },
} as const;

/** Mouse + touch + keyboard sensors, so activation feels identical on every surface. */
export function useSortableSensors() {
  return useSensors(
    useSensor(MouseSensor, SORTABLE_SENSOR_OPTIONS.mouse),
    useSensor(TouchSensor, SORTABLE_SENSOR_OPTIONS.touch),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
}

/**
 * Resolves a dnd-kit drag result to `{from, to}` array indices.
 *
 * Extracted as a pure function because jsdom cannot simulate a full dnd-kit drag
 * (no layout, so collision detection finds nothing) — this keeps the index math
 * under test even though the gesture itself can only be verified on a device.
 * Returns null for no-op drops: cancelled drags, dropping on itself, or ids that
 * are no longer in the list (item deleted mid-drag).
 */
export function resolveReorder(
  ids: string[],
  activeId: string | number | undefined,
  overId: string | number | undefined
): { from: number; to: number } | null {
  if (activeId == null || overId == null) return null;
  if (String(activeId) === String(overId)) return null;
  const from = ids.indexOf(String(activeId));
  const to = ids.indexOf(String(overId));
  if (from === -1 || to === -1) return null;
  return { from, to };
}

/** Immutable array move, matching the `{from, to}` shape resolveReorder returns. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
}
