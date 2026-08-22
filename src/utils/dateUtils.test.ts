import { describe, test, expect, vi } from 'vitest';
import { getDaysDiff, shiftDateString, generateDatesRange, shiftTripDates, getTodayDateString, sortDatedReservations } from './dateUtils';
import type { Trip } from '../types';

describe('dateUtils tests', () => {
  test('getDaysDiff calculates day offsets correctly', () => {
    expect(getDaysDiff('2026-06-01', '2026-06-01')).toBe(0);
    expect(getDaysDiff('2026-06-01', '2026-06-05')).toBe(4);
    expect(getDaysDiff('2026-06-05', '2026-06-01')).toBe(-4);
  });

  test('shiftDateString shifts YYYY-MM-DD strings correctly', () => {
    expect(shiftDateString('2026-06-01', 5)).toBe('2026-06-06');
    expect(shiftDateString('2026-06-01', -1)).toBe('2026-05-31');
    expect(shiftDateString('2026-06-01', 0)).toBe('2026-06-01');
  });

  test('generateDatesRange returns inclusive lists of date strings', () => {
    expect(generateDatesRange('2026-06-01', '2026-06-03')).toEqual([
      '2026-06-01',
      '2026-06-02',
      '2026-06-03'
    ]);
  });

  // Construct a realistic mock Trip
  const createMockTrip = (): Trip => ({
    id: 'trip-1',
    name: 'Test Vacation',
    startDate: '2026-06-01',
    endDate: '2026-06-03',
    locations: [
      { id: 'loc-1', city: 'Paris', country: 'France', lat: 48.8, lng: 2.3, places: [] }
    ],
    placeGroups: [],
    plans: [
      {
        id: 'plan-1',
        name: 'Main Plan',
        startDate: '2026-06-01',
        endDate: '2026-06-03',
        days: {
          '2026-06-01': { dateStr: '2026-06-01', locationId: 'loc-1', placeIds: ['p1'] },
          '2026-06-02': { dateStr: '2026-06-02', placeIds: ['p2'] },
          '2026-06-03': { dateStr: '2026-06-03', locationId: 'loc-1', placeIds: ['p3'] }
        },
        hotels: [
          { id: 'h1', name: 'Le Hotel', checkInDate: '2026-06-01', checkOutDate: '2026-06-03' }
        ],
        transports: [
          {
            id: 't1',
            type: 'flight',
            segments: [
              {
                id: 't1-s0',
                departureLocationName: 'Paris',
                arrivalLocationName: 'London',
                departureDate: '2026-06-01',
                departureTime: '10:00',
                departureTimezone: 'GMT',
                arrivalDate: '2026-06-01',
                arrivalTime: '11:00',
                arrivalTimezone: 'GMT'
              }
            ]
          }
        ]
      }
    ]
  });

  test('shiftTripDates shifts dates with identical duration', () => {
    const mockTrip = createMockTrip();
    // Shift forward by 10 days, same duration
    const shifted = shiftTripDates(mockTrip, '2026-06-11', '2026-06-13');

    expect(shifted.startDate).toBe('2026-06-11');
    expect(shifted.endDate).toBe('2026-06-13');

    const plan = shifted.plans[0];
    expect(plan.startDate).toBe('2026-06-11');
    expect(plan.endDate).toBe('2026-06-13');

    // Days should be shifted
    expect(plan.days['2026-06-11']).toEqual({ dateStr: '2026-06-11', locationId: 'loc-1', placeIds: ['p1'] });
    expect(plan.days['2026-06-12']).toEqual({ dateStr: '2026-06-12', placeIds: ['p2'] });
    expect(plan.days['2026-06-13']).toEqual({ dateStr: '2026-06-13', locationId: 'loc-1', placeIds: ['p3'] });

    // Hotels pass through unchanged (fixed real-world booking dates)
    expect(plan.hotels[0].checkInDate).toBe('2026-06-01');
    expect(plan.hotels[0].checkOutDate).toBe('2026-06-03');

    // Transports pass through unchanged (fixed real-world booking dates)
    expect(plan.transports[0].segments[0].departureDate).toBe('2026-06-01');
    expect(plan.transports[0].segments[0].arrivalDate).toBe('2026-06-01');
  });

  test('shiftTripDates shifts and expands duration', () => {
    const mockTrip = createMockTrip();
    // Shift forward and expand to 5 days
    const shifted = shiftTripDates(mockTrip, '2026-06-11', '2026-06-15');

    expect(shifted.startDate).toBe('2026-06-11');
    expect(shifted.endDate).toBe('2026-06-15');

    const plan = shifted.plans[0];
    // Exisiting days shift
    expect(plan.days['2026-06-11'].placeIds).toEqual(['p1']);
    expect(plan.days['2026-06-12'].placeIds).toEqual(['p2']);
    expect(plan.days['2026-06-13'].placeIds).toEqual(['p3']);

    // Brand new days appended empty
    expect(plan.days['2026-06-14']).toEqual({ dateStr: '2026-06-14', placeIds: [], scheduleItems: [] });
    expect(plan.days['2026-06-15']).toEqual({ dateStr: '2026-06-15', placeIds: [], scheduleItems: [] });
  });

  test('shiftTripDates shifts and shortens duration (truncating days)', () => {
    const mockTrip = createMockTrip();
    // Shift forward and shorten to 2 days
    const shifted = shiftTripDates(mockTrip, '2026-06-11', '2026-06-12');

    expect(shifted.startDate).toBe('2026-06-11');
    expect(shifted.endDate).toBe('2026-06-12');

    const plan = shifted.plans[0];
    // Days 1 and 2 shift
    expect(plan.days['2026-06-11'].placeIds).toEqual(['p1']);
    expect(plan.days['2026-06-12'].placeIds).toEqual(['p2']);

    // Day 3 is truncated (does not exist in plans.days)
    expect(plan.days['2026-06-13']).toBeUndefined();
    expect(Object.keys(plan.days)).toHaveLength(2);
  });

  test('getTodayDateString returns local date YYYY-MM-DD', () => {
    try {
      vi.useFakeTimers();
      // Set to a specific date: 2026-07-18 12:00:00 local time
      const date = new Date(2026, 6, 18, 12, 0, 0); // Month is 0-indexed (6 = July)
      vi.setSystemTime(date);

      expect(getTodayDateString()).toBe('2026-07-18');

      // Set to a different date: 2028-12-31
      const date2 = new Date(2028, 11, 31, 23, 59, 0); // Month 11 = December
      vi.setSystemTime(date2);

      expect(getTodayDateString()).toBe('2028-12-31');
    } finally {
      vi.useRealTimers();
    }
  });

  test('sortDatedReservations orders by status then date and time, undated last', () => {
    const items = [
      { id: 'noDate', status: 'Confirmed' as const },
      { id: 'late', date: '2026-06-05', time: '09:00', status: 'Confirmed' as const },
      { id: 'canceledEarly', date: '2026-06-01', status: 'Canceled' as const },
      { id: 'earlyPm', date: '2026-06-01', time: '18:00', status: 'Confirmed' as const },
      { id: 'earlyAm', date: '2026-06-01', time: '08:00', status: 'Confirmed' as const },
    ];
    expect(sortDatedReservations(items).map(i => i.id)).toEqual([
      'earlyAm', 'earlyPm', 'late', 'noDate', 'canceledEarly',
    ]);
  });
});
