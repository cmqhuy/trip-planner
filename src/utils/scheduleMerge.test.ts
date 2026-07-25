import { describe, test, expect } from 'vitest';
import { computeMergePartners, mergedUnitRange, linkedPlaceIdOf } from './scheduleMerge';
import type { ScheduleItem, PlaceReservation } from '../types';

const reservations: PlaceReservation[] = [
  { id: 'r1', type: 'dining', placeId: 'p1', title: 'Dinner' },
  { id: 'r2', type: 'attraction', placeId: 'p2', title: 'Museum' },
  { id: 'r3', type: 'attraction', title: 'Standalone (no linked place)' },
];

const place = (placeId: string): ScheduleItem => ({ type: 'place', placeId });
const resEvent = (reservationId: string): ScheduleItem => ({ type: 'place-reservation-event', reservationId });
const note = (id: string): ScheduleItem => ({ type: 'note', id, text: '' });

describe('scheduleMerge', () => {
  test('linkedPlaceIdOf resolves place and reservation links', () => {
    expect(linkedPlaceIdOf(place('p1'), reservations)).toBe('p1');
    expect(linkedPlaceIdOf(resEvent('r1'), reservations)).toBe('p1');
    expect(linkedPlaceIdOf(resEvent('r3'), reservations)).toBeUndefined();
    expect(linkedPlaceIdOf(note('n1'), reservations)).toBeUndefined();
  });

  test('adjacent reservation + linked place merge (reservation above place)', () => {
    const items = [resEvent('r1'), place('p1')];
    expect(computeMergePartners(items, reservations)).toEqual([1, 0]);
  });

  test('adjacent place + its reservation merge in either order', () => {
    const items = [place('p1'), resEvent('r1')];
    expect(computeMergePartners(items, reservations)).toEqual([1, 0]);
  });

  test('non-adjacent reservation and place do not merge', () => {
    const items = [resEvent('r1'), note('n1'), place('p1')];
    expect(computeMergePartners(items, reservations)).toEqual([-1, -1, -1]);
  });

  test('reservation only merges with its own linked place', () => {
    const items = [resEvent('r1'), place('p2')];
    expect(computeMergePartners(items, reservations)).toEqual([-1, -1]);
  });

  test('reservation with no linked place never merges', () => {
    const items = [resEvent('r3'), place('p1')];
    expect(computeMergePartners(items, reservations)).toEqual([-1, -1]);
  });

  test('each item joins at most one pair (greedy left-to-right)', () => {
    // p1, res(r1)->p1, p1 : first two merge; trailing p1 is left single
    const items = [place('p1'), resEvent('r1'), place('p1')];
    expect(computeMergePartners(items, reservations)).toEqual([1, 0, -1]);
  });

  test('multiple independent pairs merge', () => {
    const items = [resEvent('r1'), place('p1'), resEvent('r2'), place('p2')];
    expect(computeMergePartners(items, reservations)).toEqual([1, 0, 3, 2]);
  });

  test('mergedUnitRange returns pair range for merged items and singleton otherwise', () => {
    const items = [note('n1'), resEvent('r1'), place('p1'), note('n2')];
    expect(mergedUnitRange(items, 0, reservations)).toEqual([0, 0]);
    expect(mergedUnitRange(items, 1, reservations)).toEqual([1, 2]);
    expect(mergedUnitRange(items, 2, reservations)).toEqual([1, 2]);
    expect(mergedUnitRange(items, 3, reservations)).toEqual([3, 3]);
  });
});
