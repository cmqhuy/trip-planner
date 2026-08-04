import { describe, it, expect } from 'vitest';
import type { ClientRect } from '@dnd-kit/core';
import {
  DAY_TIMELINE_DND_ID,
  catalogGroupDndId,
  catalogPlaceDndId,
  clampToMergeUnit,
  dayItemDndId,
  isOwnMergeUnit,
  resolveDropPosition,
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
