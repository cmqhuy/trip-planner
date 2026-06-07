import { describe, test, expect } from 'vitest';
import { mergeTrips } from './googleDrive';
import type { Trip } from '../types';

describe('googleDrive mergeTrips tests', () => {
  const createMockTrip = (id: string, name: string): Trip => ({
    id,
    name,
    startDate: '2026-06-01',
    endDate: '2026-06-03',
    locations: [],
    plans: [],
    placeGroups: [],
  });

  test('merges disjoint local and cloud trips correctly', () => {
    const local = [createMockTrip('trip-1', 'Paris'), createMockTrip('trip-2', 'Rome')];
    const cloud = [createMockTrip('trip-3', 'Tokyo')];

    const result = mergeTrips(local, cloud);

    expect(result).toHaveLength(3);
    expect(result.map(t => t.id)).toEqual(expect.arrayContaining(['trip-1', 'trip-2', 'trip-3']));
  });

  test('prefers cloud trip version in case of ID conflict', () => {
    const local = [createMockTrip('trip-1', 'Paris (Local Name)')];
    const cloud = [createMockTrip('trip-1', 'Paris (Cloud Name)')];

    const result = mergeTrips(local, cloud);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('trip-1');
    expect(result[0].name).toBe('Paris (Cloud Name)');
  });

  test('handles empty local or cloud lists gracefully', () => {
    const local = [createMockTrip('trip-1', 'Paris')];
    
    expect(mergeTrips(local, [])).toEqual(local);
    expect(mergeTrips([], local)).toEqual(local);
    expect(mergeTrips([], [])).toEqual([]);
  });
});
