import { describe, it, expect } from 'vitest';
import { migrateTrips, CURRENT_SCHEMA_VERSION } from './migration';

// Minimal v0 plan day (placeIds + scheduleNotes, no scheduleItems)
function makeV0Day(placeIds: string[] = [], scheduleNotes: Record<string, string> = {}) {
  return { dateStr: '2026-01-01', locationId: 'loc-1', placeIds, scheduleNotes };
}

// Minimal v1 transport (flat Transportation, no segments)
function makeV1Transport(overrides: Record<string, any> = {}) {
  return {
    id: 'tr-1',
    type: 'flight',
    name: 'My Flight',
    confirmationNo: 'ABC123',
    carrier: 'ANA',
    transitCode: 'NH7',
    departureLocationName: 'SFO',
    departureDate: '2026-01-01',
    departureTime: '10:00',
    departureTimezone: 'PST',
    arrivalLocationName: 'NRT',
    arrivalDate: '2026-01-02',
    arrivalTime: '14:00',
    arrivalTimezone: 'JST',
    ...overrides,
  };
}

describe('migrateTrips', () => {
  describe('no-op for current version', () => {
    it('returns the trip object unchanged when already at CURRENT_SCHEMA_VERSION', () => {
      const trip = { id: 't1', schemaVersion: CURRENT_SCHEMA_VERSION, plans: [] };
      const result = migrateTrips([trip as any]);
      expect(result[0]).toBe(trip); // same reference — no copy made
    });
  });

  describe('v0 → v1: scheduleItems built from placeIds + scheduleNotes', () => {
    it('converts placeIds into place ScheduleItems', () => {
      const trip = {
        id: 't1',
        plans: [{
          id: 'plan-1',
          days: { '2026-01-01': makeV0Day(['p1', 'p2']) },
          transports: [],
        }],
      };
      const [migrated] = migrateTrips([trip as any]);
      const day = migrated.plans[0].days['2026-01-01'];
      expect(day.scheduleItems).toEqual([
        { type: 'place', placeId: 'p1' },
        { type: 'place', placeId: 'p2' },
      ]);
    });

    it('interleaves scheduleNotes between placeIds', () => {
      const trip = {
        id: 't1',
        plans: [{
          id: 'plan-1',
          days: {
            '2026-01-01': makeV0Day(
              ['p1', 'p2'],
              { '0': 'Before anything', '1': 'Between p1 and p2', '2': 'After all' }
            ),
          },
          transports: [],
        }],
      };
      const [migrated] = migrateTrips([trip as any]);
      const items = migrated.plans[0].days['2026-01-01'].scheduleItems;
      expect(items).toBeDefined();
      expect(items![0]).toMatchObject({ type: 'note', text: 'Before anything' });
      expect(items![1]).toMatchObject({ type: 'place', placeId: 'p1' });
      expect(items![2]).toMatchObject({ type: 'note', text: 'Between p1 and p2' });
      expect(items![3]).toMatchObject({ type: 'place', placeId: 'p2' });
      expect(items![4]).toMatchObject({ type: 'note', text: 'After all' });
    });

    it('removes the legacy scheduleNotes key from the day', () => {
      const trip = {
        id: 't1',
        plans: [{
          id: 'plan-1',
          days: { '2026-01-01': makeV0Day(['p1'], { '0': 'A note' }) },
          transports: [],
        }],
      };
      const [migrated] = migrateTrips([trip as any]);
      expect((migrated.plans[0].days['2026-01-01'] as any).scheduleNotes).toBeUndefined();
    });

    it('leaves a day alone when it already has scheduleItems', () => {
      const existingItems = [{ type: 'place' as const, placeId: 'p1' }];
      const trip = {
        id: 't1',
        plans: [{
          id: 'plan-1',
          days: {
            '2026-01-01': {
              dateStr: '2026-01-01',
              placeIds: ['p1'],
              scheduleItems: existingItems,
            },
          },
          transports: [],
        }],
      };
      const [migrated] = migrateTrips([trip as any]);
      expect(migrated.plans[0].days['2026-01-01'].scheduleItems).toBe(existingItems);
    });

    it('handles a day with no placeIds and no notes (empty day)', () => {
      const trip = {
        id: 't1',
        plans: [{ id: 'plan-1', days: { '2026-01-01': makeV0Day() }, transports: [] }],
      };
      const [migrated] = migrateTrips([trip as any]);
      expect(migrated.plans[0].days['2026-01-01'].scheduleItems).toEqual([]);
    });
  });

  describe('v1 → v2: flat Transportation wrapped into TransportationReservation with segments[]', () => {
    it('wraps a flat transport into a reservation with one segment', () => {
      const trip = {
        id: 't1',
        schemaVersion: 1,
        plans: [{ id: 'plan-1', days: {}, transports: [makeV1Transport()] }],
      };
      const [migrated] = migrateTrips([trip as any]);
      const reservation = migrated.plans[0].transports[0];

      expect(reservation.id).toBe('tr-1');
      expect(reservation.type).toBe('flight');
      expect(reservation.name).toBe('My Flight');
      expect(reservation.confirmationNo).toBe('ABC123');
      expect(Array.isArray(reservation.segments)).toBe(true);
      expect(reservation.segments).toHaveLength(1);

      const seg = reservation.segments[0];
      expect(seg.carrier).toBe('ANA');
      expect(seg.transitCode).toBe('NH7');
      expect(seg.departureLocationName).toBe('SFO');
      expect(seg.departureDate).toBe('2026-01-01');
      expect(seg.departureTime).toBe('10:00');
      expect(seg.departureTimezone).toBe('PST');
      expect(seg.arrivalLocationName).toBe('NRT');
      expect(seg.arrivalDate).toBe('2026-01-02');
      expect(seg.arrivalTime).toBe('14:00');
      expect(seg.arrivalTimezone).toBe('JST');
    });

    it('does not re-wrap a transport that already has segments[]', () => {
      const alreadyMigrated = {
        id: 'tr-2', type: 'train',
        segments: [{ id: 's0', departureLocationName: 'A', arrivalLocationName: 'B',
          departureDate: '2026-01-01', departureTime: '09:00', departureTimezone: 'UTC',
          arrivalDate: '2026-01-01', arrivalTime: '11:00', arrivalTimezone: 'UTC' }],
      };
      const trip = {
        id: 't1',
        schemaVersion: 1,
        plans: [{ id: 'plan-1', days: {}, transports: [alreadyMigrated] }],
      };
      const [migrated] = migrateTrips([trip as any]);
      expect(migrated.plans[0].transports[0]).toStrictEqual({ ...alreadyMigrated, expenses: [] });
    });

    it('defaults missing type to "other" and generates an id when absent', () => {
      const trip = {
        id: 't1',
        schemaVersion: 1,
        plans: [{
          id: 'plan-1', days: {}, transports: [makeV1Transport({ id: undefined, type: undefined })],
        }],
      };
      const [migrated] = migrateTrips([trip as any]);
      const r = migrated.plans[0].transports[0];
      expect(r.type).toBe('other');
      expect(typeof r.id).toBe('string');
      expect(r.id.length).toBeGreaterThan(0);
    });

    it('handles a plan with no transports gracefully', () => {
      const trip = {
        id: 't1',
        schemaVersion: 1,
        plans: [{ id: 'plan-1', days: {}, transports: [] }],
      };
      const [migrated] = migrateTrips([trip as any]);
      expect(migrated.plans[0].transports).toEqual([]);
    });

    it('skips v1→v2 for trips already at v1 that have no transports needing migration', () => {
      const trip = {
        id: 't1',
        schemaVersion: 1,
        plans: [{ id: 'plan-1', days: {}, transports: [] }],
      };
      const [migrated] = migrateTrips([trip as any]);
      expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    });
  });

  describe('v0 → v2 (full chain)', () => {
    it('applies both migrations when starting from v0', () => {
      const trip = {
        id: 't1',
        plans: [{
          id: 'plan-1',
          days: { '2026-01-01': makeV0Day(['p1']) },
          transports: [makeV1Transport()],
        }],
      };
      const [migrated] = migrateTrips([trip as any]);

      // v0→v1: scheduleItems built
      expect(migrated.plans[0].days['2026-01-01'].scheduleItems).toEqual([
        { type: 'place', placeId: 'p1' },
      ]);

      // v1→v2: transport wrapped into reservation
      const r = migrated.plans[0].transports[0];
      expect(Array.isArray(r.segments)).toBe(true);
      expect(r.segments[0].departureLocationName).toBe('SFO');

      expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    });
  });

  describe('v3 → v4: initialize expenses array', () => {
    it('initializes expenses to [] on hotels and transports if missing', () => {
      const trip = {
        id: 't1',
        schemaVersion: 3,
        plans: [{
          id: 'plan-1',
          days: {},
          hotels: [{ id: 'hotel-1', name: 'My Hotel' }],
          transports: [{ id: 'tr-1', name: 'My Train', segments: [] }],
        }],
      };
      const [migrated] = migrateTrips([trip as any]);
      expect(migrated.plans[0].hotels[0].expenses).toEqual([]);
      expect(migrated.plans[0].transports[0].expenses).toEqual([]);
      expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    });

    it('does not overwrite existing expenses on hotels and transports', () => {
      const existingExpenses = [{ id: 'exp-1', description: 'test', price: 10, currency: 'USD', paid: true }];
      const trip = {
        id: 't1',
        schemaVersion: 3,
        plans: [{
          id: 'plan-1',
          days: {},
          hotels: [{ id: 'hotel-1', name: 'My Hotel', expenses: existingExpenses }],
          transports: [{ id: 'tr-1', name: 'My Train', segments: [], expenses: existingExpenses }],
        }],
      };
      const [migrated] = migrateTrips([trip as any]);
      expect(migrated.plans[0].hotels[0].expenses).toEqual(existingExpenses);
      expect(migrated.plans[0].transports[0].expenses).toEqual(existingExpenses);
    });
  });

  describe('v4 → v5: migrate price/currency to expenses', () => {
    it('converts hotel and transport price/currency into expenses and deletes the original fields', () => {
      const trip = {
        id: 't1',
        schemaVersion: 4,
        plans: [{
          id: 'plan-1',
          days: {},
          hotels: [
            { id: 'h-1', name: 'Hotel 1', price: 150, currency: 'EUR', expenses: [] },
            { id: 'h-2', name: 'Hotel 2', expenses: [] }
          ],
          transports: [
            { id: 'tr-1', name: 'Train 1', price: 45, currency: 'USD', expenses: [], segments: [] },
            { id: 'tr-2', name: 'Train 2', expenses: [], segments: [] }
          ]
        }]
      };
      const [migrated] = migrateTrips([trip as any]);

      const h1 = migrated.plans[0].hotels[0];
      const h2 = migrated.plans[0].hotels[1];
      const t1 = migrated.plans[0].transports[0];
      const t2 = migrated.plans[0].transports[1];

      expect((h1 as any).price).toBeUndefined();
      expect((h1 as any).currency).toBeUndefined();
      expect((t1 as any).price).toBeUndefined();
      expect((t1 as any).currency).toBeUndefined();

      expect(h1.expenses!.length).toBe(1);
      expect(h1.expenses![0].description).toBe('Base Price');
      expect(h1.expenses![0].price).toBe(150);
      expect(h1.expenses![0].currency).toBe('EUR');

      expect(h2.expenses!.length).toBe(0);

      expect(t1.expenses!.length).toBe(1);
      expect(t1.expenses![0].description).toBe('Base Price');
      expect(t1.expenses![0].price).toBe(45);
      expect(t1.expenses![0].currency).toBe('USD');

      expect(t2.expenses!.length).toBe(0);
    });
  });

  describe('v5 → v6: initialize expenseGroups and expenses', () => {
    it('initializes default expenseGroups and empty expenses on each plan', () => {
      const trip = {
        id: 't1',
        schemaVersion: 5,
        plans: [{
          id: 'plan-1',
          hotels: [],
          transports: []
        }]
      };
      const [migrated] = migrateTrips([trip as any]);
      expect(migrated.plans[0].expenseGroups).toBeDefined();
      expect(migrated.plans[0].expenseGroups!.length).toBe(4);
      expect(migrated.plans[0].expenseGroups![0].id).toBe('hotels');
      expect(migrated.plans[0].expenseGroups![1].id).toBe('transports');
      expect(migrated.plans[0].expenses).toEqual([]);
    });
  });

  describe('output schemaVersion', () => {
    it('stamps CURRENT_SCHEMA_VERSION on every migrated trip', () => {
      const trips = [
        { id: 'a', plans: [] },
        { id: 'b', schemaVersion: 1, plans: [] },
      ];
      const migrated = migrateTrips(trips as any);
      for (const t of migrated) {
        expect(t.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      }
    });

    it('handles an empty input array', () => {
      expect(migrateTrips([])).toEqual([]);
    });
  });
});
