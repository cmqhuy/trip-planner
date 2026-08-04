import { describe, it, expect } from 'vitest';
import type { ClientRect, CollisionDetection } from '@dnd-kit/core';
import {
  DAY_TIMELINE_DND_ID,
  catalogGroupDndId,
  catalogPlaceDndId,
  clampToMergeUnit,
  dayItemDndId,
  isOwnMergeUnit,
  plannerCollisionDetection,
  resolveDropPosition,
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

describe('clampToMergeUnit', () => {
  it('passes the position through for a standalone item', () => {
    expect(clampToMergeUnit({ index: 2, unitStart: 2, unitEnd: 2 }, 'top')).toBe('top');
    expect(clampToMergeUnit({ index: 2, unitStart: 2, unitEnd: 2 }, 'bottom')).toBe('bottom');
  });

  it('snaps the top half of a merged pair to above the whole unit', () => {
    expect(clampToMergeUnit({ index: 4, unitStart: 4, unitEnd: 5 }, 'bottom')).toBe('top');
  });

  it('snaps the bottom half of a merged pair to below the whole unit', () => {
    expect(clampToMergeUnit({ index: 5, unitStart: 4, unitEnd: 5 }, 'top')).toBe('bottom');
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
    { id: dayItemDndId(0), top: 100, data: { target: 'day-item', index: 0, unitStart: 0, unitEnd: 0 } },
    { id: dayItemDndId(1), top: 176, data: { target: 'day-item', index: 1, unitStart: 1, unitEnd: 1 } },
    { id: dayItemDndId(2), top: 252, data: { target: 'day-item', index: 2, unitStart: 2, unitEnd: 2 } },
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

describe('isOwnMergeUnit', () => {
  it('is true when a dragged item hovers itself', () => {
    expect(isOwnMergeUnit({ unitStart: 3, unitEnd: 3 }, 3)).toBe(true);
  });

  it('is true when a dragged item hovers the other half of its own pair', () => {
    expect(isOwnMergeUnit({ unitStart: 4, unitEnd: 5 }, 4)).toBe(true);
    expect(isOwnMergeUnit({ unitStart: 4, unitEnd: 5 }, 5)).toBe(true);
  });

  it('is false for any other unit', () => {
    expect(isOwnMergeUnit({ unitStart: 4, unitEnd: 5 }, 6)).toBe(false);
    expect(isOwnMergeUnit({ unitStart: 4, unitEnd: 5 }, 3)).toBe(false);
  });
});
