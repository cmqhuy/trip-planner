import { describe, it, expect, afterEach } from 'vitest';
import type { ClientRect, CollisionDetection } from '@dnd-kit/core';
import {
  DAY_TIMELINE_DND_ID,
  catalogGroupDndId,
  catalogPlaceDndId,
  dayItemDndId,
  findDragNode,
  plannerCollisionDetection,
  resolveDropPosition,
  sortableDropPosition,
  type PlannerDropData,
} from './plannerDnd';

/**
 * jsdom has no layout, so a real dnd-kit drag can't be simulated — collision
 * detection would find nothing. The drop math is therefore extracted as pure
 * functions and tested here; the gesture itself is verified on a device.
 * Same split as `sortable.test.ts` / `SortableList.test.tsx` from A1a.
 */

const rect = (top: number, height: number): ClientRect => ({
  top,
  height,
  bottom: top + height,
  left: 0,
  right: 100,
  width: 100,
});

describe('planner dnd ids', () => {
  it('namespaces each surface so one drag context can route by id', () => {
    expect(catalogPlaceDndId('p1')).toBe('catalog-place:p1');
    expect(catalogGroupDndId('g1')).toBe('catalog-group:g1');
    expect(dayItemDndId(3)).toBe('day-item:3');
    expect(DAY_TIMELINE_DND_ID).toBe('day-timeline');
  });

  it('keeps card ids distinct from their container ids', () => {
    expect(catalogPlaceDndId('x')).not.toBe(catalogGroupDndId('x'));
  });
});

describe('resolveDropPosition', () => {
  const target = rect(100, 60); // spans 100..160, midpoint 130

  it('drops above when the pointer is in the top half', () => {
    expect(resolveDropPosition(target, { x: 0, y: 110 })).toBe('top');
  });

  it('drops below when the pointer is in the bottom half', () => {
    expect(resolveDropPosition(target, { x: 0, y: 150 })).toBe('bottom');
  });

  it('treats the exact midpoint as below, matching the old `< height / 2` rule', () => {
    expect(resolveDropPosition(target, { x: 0, y: 130 })).toBe('bottom');
  });

  it('falls back to the dragged card centre when there is no pointer (keyboard drag)', () => {
    expect(resolveDropPosition(target, null, rect(80, 20))).toBe('top');
    expect(resolveDropPosition(target, null, rect(200, 20))).toBe('bottom');
  });

  it('falls back to the target itself when neither is available', () => {
    expect(resolveDropPosition(target, null, null)).toBe('bottom');
  });
});

describe('sortableDropPosition', () => {
  /**
   * The insert-before/after drop handlers must reproduce `arrayMove(from, to)`,
   * because that is what the sorting strategy already previewed. Modelled here
   * against a real `arrayMove` so the two can't drift apart.
   */
  const arrayMove = <T,>(list: T[], from: number, to: number): T[] => {
    const next = [...list];
    next.splice(to, 0, ...next.splice(from, 1));
    return next;
  };

  /** What the drop handlers do: remove the item, then insert beside the target. */
  const insertBeside = <T,>(list: T[], from: number, to: number, side: 'top' | 'bottom'): T[] => {
    const next = [...list];
    const [moved] = next.splice(from, 1);
    const targetIndex = next.indexOf(list[to]);
    next.splice(side === 'bottom' ? targetIndex + 1 : targetIndex, 0, moved);
    return next;
  };

  it('agrees with arrayMove for every pair of positions in a list', () => {
    const list = ['a', 'b', 'c', 'd', 'e'];
    for (let from = 0; from < list.length; from++) {
      for (let to = 0; to < list.length; to++) {
        if (from === to) continue;
        expect(insertBeside(list, from, to, sortableDropPosition(from, to))).toEqual(
          arrayMove(list, from, to)
        );
      }
    }
  });

  it('lands after the target when dragging down, before it when dragging up', () => {
    expect(sortableDropPosition(0, 3)).toBe('bottom');
    expect(sortableDropPosition(3, 0)).toBe('top');
    expect(sortableDropPosition(2, 3)).toBe('bottom');
    expect(sortableDropPosition(3, 2)).toBe('top');
  });

  it('does not consult the pointer — grabbing a card by its edge changes nothing', () => {
    // The regression this exists for: the drop used to come from which half of
    // the target card the pointer was over, so it could commit a different
    // result than the one the shifting cards had just previewed.
    expect(sortableDropPosition(3, 0)).toBe(sortableDropPosition(3, 0));
    expect(resolveDropPosition(rect(100, 60), { x: 0, y: 105 })).toBe('top');
    expect(sortableDropPosition(0, 3)).toBe('bottom');
  });
});

describe('plannerCollisionDetection', () => {
  /**
   * Three day cards 60px tall with the timeline's 16px gap between them, inside a
   * `day-timeline` container that spans the lot:
   *   card 0: 100..160   gap: 160..176
   *   card 1: 176..236   gap: 236..252
   *   card 2: 252..312
   */
  const CARDS: Array<{ id: string; top: number; data: PlannerDropData }> = [
    { id: dayItemDndId(0), top: 100, data: { target: 'day-item', index: 0 } },
    { id: dayItemDndId(1), top: 176, data: { target: 'day-item', index: 1 } },
    { id: dayItemDndId(2), top: 252, data: { target: 'day-item', index: 2 } },
  ];

  function detect(pointerY: number, cards = CARDS) {
    const entries: Array<[string, ClientRect]> = [
      ...cards.map(c => [c.id, rect(c.top, 60)] as [string, ClientRect]),
      [DAY_TIMELINE_DND_ID, rect(90, 240)],
    ];
    const containers = [
      ...cards.map(c => ({ id: c.id, data: { current: c.data } })),
      { id: DAY_TIMELINE_DND_ID, data: { current: { target: 'day-timeline' } as PlannerDropData } },
    ];
    const args = {
      droppableRects: new Map(entries),
      droppableContainers: containers,
      pointerCoordinates: { x: 50, y: pointerY },
      collisionRect: rect(pointerY - 30, 60),
      active: { id: 'x', data: { current: undefined }, rect: { current: { initial: null, translated: null } } },
    } as unknown as Parameters<CollisionDetection>[0];

    const pointerRef = { current: null as { x: number; y: number } | null };
    return { result: plannerCollisionDetection(args, pointerRef), pointerRef };
  }

  it('resolves to the card under the pointer', () => {
    expect(detect(130).result[0]?.id).toBe(dayItemDndId(0));
    expect(detect(210).result[0]?.id).toBe(dayItemDndId(1));
  });

  it('never resolves to the container while cards are present', () => {
    for (const y of [100, 130, 168, 200, 244, 300]) {
      expect(detect(y).result[0]?.id).not.toBe(DAY_TIMELINE_DND_ID);
    }
  });

  it('resolves a pointer in the gap between two cards to the nearer of them', () => {
    // Gap 160..176. Just under card 0 stays card 0; just over card 1 becomes card 1.
    expect(detect(163).result[0]?.id).toBe(dayItemDndId(0));
    expect(detect(173).result[0]?.id).toBe(dayItemDndId(1));
  });

  it('resolves blank space below the last card to that card, so the drop appends', () => {
    // This is the bug: falling through to the container here made *every* gap drop
    // land at the end of the list instead of under the pointer.
    const { result } = detect(325);
    expect(result[0]?.id).toBe(dayItemDndId(2));
    expect(resolveDropPosition(rect(252, 60), { x: 50, y: 325 })).toBe('bottom');
  });

  it('falls back to the container when it holds no cards (empty day)', () => {
    expect(detect(150, []).result[0]?.id).toBe(DAY_TIMELINE_DND_ID);
  });

  it('records the live pointer for the top/bottom split', () => {
    expect(detect(210).pointerRef.current).toEqual({ x: 50, y: 210 });
  });
});

describe('findDragNode', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('finds the card the drag overlay should clone', () => {
    document.body.innerHTML = `<div data-dnd-id="day-item:2" id="card"></div>`;
    expect(findDragNode('day-item:2')).toBe(document.getElementById('card'));
  });

  it('resolves a merged pair half up to the whole cell', () => {
    // The pair moves as one block, so the preview must be the pair, not the half
    // that happened to be under the finger.
    document.body.innerHTML =
      `<div class="schedule-merged-cell" id="cell"><div data-dnd-id="day-item:4"></div></div>`;
    expect(findDragNode('day-item:4')).toBe(document.getElementById('cell'));
  });

  it('returns null for an id that is not on the page', () => {
    expect(findDragNode('day-item:99')).toBeNull();
  });
});
