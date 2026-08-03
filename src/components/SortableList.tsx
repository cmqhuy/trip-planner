import { type ReactNode } from 'react';
import { DndContext, DragOverlay, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { resolveReorder, useSortableSensors } from '../utils/sortable';

/**
 * Shared vertical drag-to-reorder list.
 *
 * Replaces the HTML5 drag-and-drop (`draggable` + `dataTransfer`) this app used
 * everywhere, which never fired on touch devices — reordering was silently
 * desktop-only. dnd-kit is pointer-event based, so one implementation serves
 * mouse, touch and keyboard.
 *
 * Sensor split is deliberate:
 * - Mouse: 8px movement before a drag starts, so clicks on buttons inside a row
 *   still register as clicks.
 * - Touch: 200ms long-press before a drag starts, so vertical page scrolling
 *   keeps working. Do NOT swap this for a distance constraint — a distance-based
 *   touch sensor swallows scroll gestures.
 * - Keyboard: space/enter to lift, arrows to move, space/enter to drop.
 *
 * Use this for plain "reorder an array" lists. The day schedule and catalog have
 * cross-container drops and merged units, so they wire dnd-kit directly instead.
 *
 * Sensors and the drop index math live in `src/utils/sortable.ts` so this file
 * exports only a component (Fast Refresh requirement).
 */

interface SortableRowProps {
  id: string;
  disabled?: boolean;
  children: (args: {
    /** Spread onto the element that should initiate the drag. */
    handleProps: Record<string, unknown>;
    isDragging: boolean;
  }) => ReactNode;
}

function SortableRow({ id, disabled, children }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      className={`sortable-item${isDragging ? ' sortable-item--dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {children({ handleProps: { ...attributes, ...listeners }, isDragging })}
    </div>
  );
}

interface SortableListProps<T> {
  items: T[];
  getId: (item: T) => string;
  /** Called with the resolved indices once a drag settles. No-op drops never fire. */
  onReorder: (fromIndex: number, toIndex: number) => void;
  disabled?: boolean;
  /** `handleProps` must be spread onto whatever should be grabbable (the row, or a grip). */
  renderItem: (
    item: T,
    index: number,
    args: { handleProps: Record<string, unknown>; isDragging: boolean }
  ) => ReactNode;
  /** Rendered under the cursor while dragging. Falls back to no overlay. */
  renderOverlay?: (item: T) => ReactNode;
  activeId?: string | null;
  onActiveIdChange?: (id: string | null) => void;
}

export default function SortableList<T>({
  items,
  getId,
  onReorder,
  disabled,
  renderItem,
  renderOverlay,
  activeId,
  onActiveIdChange,
}: SortableListProps<T>) {
  const sensors = useSortableSensors();
  const ids = items.map(getId);

  const handleDragEnd = (event: DragEndEvent) => {
    onActiveIdChange?.(null);
    const move = resolveReorder(ids, event.active?.id, event.over?.id);
    if (move) onReorder(move.from, move.to);
  };

  const activeItem =
    activeId != null ? items.find(item => getId(item) === activeId) ?? null : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragStart={event => onActiveIdChange?.(String(event.active.id))}
      onDragCancel={() => onActiveIdChange?.(null)}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {items.map((item, index) => (
          <SortableRow key={getId(item)} id={getId(item)} disabled={disabled}>
            {args => renderItem(item, index, args)}
          </SortableRow>
        ))}
      </SortableContext>
      {renderOverlay && (
        <DragOverlay>{activeItem ? renderOverlay(activeItem) : null}</DragOverlay>
      )}
    </DndContext>
  );
}
