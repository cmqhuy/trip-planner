import { describe, test, expect } from 'vitest';
import {
  buildItineraryDocument,
  formatTotals,
  formatAmount,
  formatShortDate,
  DEFAULT_EXPORT_OPTIONS,
  type ItineraryExportOptions,
} from './itineraryDocument';
import type { Trip, Plan } from '../types';

const options = (overrides: Partial<ItineraryExportOptions> = {}): ItineraryExportOptions => ({
  ...DEFAULT_EXPORT_OPTIONS,
  ...overrides,
});

const plan = (overrides: Partial<Plan> = {}): Plan => ({
  id: 'plan1',
  name: 'Plan A',
  startDate: '2026-03-01',
  endDate: '2026-03-02',
  days: {
    '2026-03-01': { dateStr: '2026-03-01', locationId: 'loc1', placeIds: [], scheduleItems: [] },
    '2026-03-02': { dateStr: '2026-03-02', placeIds: [], scheduleItems: [] },
  },
  hotels: [],
  transports: [],
  ...overrides,
});

const trip = (overrides: Partial<Trip> = {}): Trip => ({
  id: 'trip1',
  name: 'Japan 2026',
  startDate: '2026-03-01',
  endDate: '2026-03-02',
  locations: [
    {
      id: 'loc1',
      city: 'Tokyo',
      country: 'Japan',
      lat: 35.6,
      lng: 139.7,
      places: [
        {
          id: 'p1',
          title: 'Senso-ji',
          description: 'Ancient Buddhist temple',
          openingHours: '06:00 - 17:00',
          notes: 'Bring coins',
          placeGroupId: 'g1',
          lat: 35.7,
          lng: 139.8,
        },
        { id: 'p2', title: 'Shibuya Crossing', description: '', lat: 35.65, lng: 139.7 },
      ],
    },
  ],
  plans: [plan()],
  placeGroups: [{ id: 'g1', name: 'Temples', color: '#fff', icon: 'landmark' }],
  ...overrides,
});

const NOW = new Date('2026-02-01T12:00:00');

describe('buildItineraryDocument — header', () => {
  test('summarises the trip, plan, destinations, and day count', () => {
    const p = plan();
    const doc = buildItineraryDocument(trip({ plans: [p] }), p, DEFAULT_EXPORT_OPTIONS, NOW);

    expect(doc.tripName).toBe('Japan 2026');
    expect(doc.planName).toBe('Plan A');
    expect(doc.dayCount).toBe(2);
    expect(doc.destinations).toEqual(['Tokyo, Japan']);
    expect(doc.generatedOnLabel).toBe('February 1, 2026');
    expect(doc.dateRangeLabel).toContain('Mar 1, 2026');
  });

  test('days come out in date order and are numbered from 1', () => {
    const p = plan({
      days: {
        '2026-03-02': { dateStr: '2026-03-02', placeIds: [], scheduleItems: [] },
        '2026-03-01': { dateStr: '2026-03-01', placeIds: [], scheduleItems: [] },
      },
    });
    const doc = buildItineraryDocument(trip({ plans: [p] }), p, DEFAULT_EXPORT_OPTIONS, NOW);

    expect(doc.days.map(d => d.dateStr)).toEqual(['2026-03-01', '2026-03-02']);
    expect(doc.days.map(d => d.dayNumber)).toEqual([1, 2]);
  });

  test('the day location label resolves through locationId', () => {
    const p = plan();
    const doc = buildItineraryDocument(trip({ plans: [p] }), p, DEFAULT_EXPORT_OPTIONS, NOW);

    expect(doc.days[0].locationLabel).toBe('Tokyo, Japan');
    expect(doc.days[1].locationLabel).toBeUndefined();
  });
});

describe('buildItineraryDocument — day entries', () => {
  test('renders places, notes, hotel events, and transit events in schedule order', () => {
    const p = plan({
      hotels: [
        { id: 'h1', name: 'Park Hotel', checkInDate: '2026-03-01', checkInTime: '15:00', checkOutDate: '2026-03-02', address: '1-1 Tokyo' },
      ],
      transports: [
        {
          id: 't1',
          type: 'flight',
          name: 'JL123',
          confirmationNo: 'ABC123',
          segments: [
            {
              id: 's1',
              departureLocationName: 'SFO',
              departureDate: '2026-03-01',
              departureTime: '09:00',
              departureTimezone: 'America/Los_Angeles',
              arrivalLocationName: 'HND',
              arrivalDate: '2026-03-01',
              arrivalTime: '14:00',
              arrivalTimezone: 'Asia/Tokyo',
            },
          ],
        },
      ],
      days: {
        '2026-03-01': {
          dateStr: '2026-03-01',
          placeIds: ['p1'],
          scheduleItems: [
            { type: 'transit-event', reservationId: 't1', segmentIndex: 0, event: 'arrival' },
            { type: 'note', id: 'n1', text: 'Buy a Suica card' },
            { type: 'place', placeId: 'p1' },
            { type: 'hotel-event', hotelId: 'h1', event: 'check-in' },
          ],
        },
      },
    });
    const doc = buildItineraryDocument(trip({ plans: [p] }), p, DEFAULT_EXPORT_OPTIONS, NOW);
    const entries = doc.days[0].entries;

    expect(entries.map(e => e.kind)).toEqual(['transit', 'note', 'place', 'hotel']);
    expect(entries[0].title).toBe('JL123 — Arrival');
    expect(entries[0].time).toBe('14:00');
    expect(entries[0].subtitle).toBe('HND');
    expect(entries[1].title).toBe('Buy a Suica card');
    expect(entries[2].title).toBe('Senso-ji');
    expect(entries[2].groupName).toBe('Temples');
    expect(entries[3].title).toBe('Park Hotel — Check-in');
    expect(entries[3].time).toBe('15:00');
  });

  test('a schedule item time overrides the reservation time', () => {
    const p = plan({
      hotels: [{ id: 'h1', name: 'Park Hotel', checkInDate: '2026-03-01', checkInTime: '15:00', checkOutDate: '2026-03-02' }],
      days: {
        '2026-03-01': {
          dateStr: '2026-03-01',
          placeIds: [],
          scheduleItems: [{ type: 'hotel-event', hotelId: 'h1', event: 'check-in', time: '18:30' }],
        },
      },
    });
    const doc = buildItineraryDocument(trip({ plans: [p] }), p, DEFAULT_EXPORT_OPTIONS, NOW);

    expect(doc.days[0].entries[0].time).toBe('18:30');
  });

  test('an adjacent reservation and its linked place collapse into one entry', () => {
    const p = plan({
      placeReservations: [
        { id: 'r1', type: 'dining', placeId: 'p1', title: 'Kaiseki dinner', date: '2026-03-01', time: '19:00', confirmationNo: 'RES-9' },
      ],
      days: {
        '2026-03-01': {
          dateStr: '2026-03-01',
          placeIds: ['p1'],
          scheduleItems: [
            { type: 'place-reservation-event', reservationId: 'r1' },
            { type: 'place', placeId: 'p1' },
          ],
        },
      },
    });
    const doc = buildItineraryDocument(trip({ plans: [p] }), p, DEFAULT_EXPORT_OPTIONS, NOW);
    const entries = doc.days[0].entries;

    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe('booking');
    expect(entries[0].title).toBe('Kaiseki dinner');
    expect(entries[0].time).toBe('19:00');
    expect(entries[0].confirmationNo).toBe('RES-9');
    // The catalog place's description survives the merge.
    expect(entries[0].detail).toBe('Ancient Buddhist temple');
  });

  test('falls back to placeIds when an unmigrated day has no scheduleItems', () => {
    const p = plan({
      days: { '2026-03-01': { dateStr: '2026-03-01', placeIds: ['p1', 'p2'] } },
    });
    const doc = buildItineraryDocument(trip({ plans: [p] }), p, DEFAULT_EXPORT_OPTIONS, NOW);

    expect(doc.days[0].entries.map(e => e.title)).toEqual(['Senso-ji', 'Shibuya Crossing']);
  });

  test('a place id with no matching catalog place degrades instead of throwing', () => {
    const p = plan({
      days: { '2026-03-01': { dateStr: '2026-03-01', placeIds: [], scheduleItems: [{ type: 'place', placeId: 'gone' }] } },
    });
    const doc = buildItineraryDocument(trip({ plans: [p] }), p, DEFAULT_EXPORT_OPTIONS, NOW);

    expect(doc.days[0].entries[0].title).toBe('Unknown place');
  });
});

describe('buildItineraryDocument — option toggles', () => {
  const p = plan({
    days: { '2026-03-01': { dateStr: '2026-03-01', placeIds: [], scheduleItems: [{ type: 'place', placeId: 'p1' }] } },
  });

  test('includePlaceDetails drops descriptions and opening hours when off', () => {
    const on = buildItineraryDocument(trip({ plans: [p] }), p, options({ includePlaceDetails: true }), NOW);
    const off = buildItineraryDocument(trip({ plans: [p] }), p, options({ includePlaceDetails: false }), NOW);

    expect(on.days[0].entries[0].detail).toBe('Ancient Buddhist temple');
    expect(on.days[0].entries[0].openingHours).toBe('06:00 - 17:00');
    expect(off.days[0].entries[0].detail).toBeUndefined();
    expect(off.days[0].entries[0].openingHours).toBeUndefined();
  });

  test('includeNotes drops user notes when off', () => {
    const on = buildItineraryDocument(trip({ plans: [p] }), p, options({ includeNotes: true }), NOW);
    const off = buildItineraryDocument(trip({ plans: [p] }), p, options({ includeNotes: false }), NOW);

    expect(on.days[0].entries[0].notes).toBe('Bring coins');
    expect(off.days[0].entries[0].notes).toBeUndefined();
  });

  test('the optional sections are empty unless their toggle is on', () => {
    const withData = plan({
      hotels: [{ id: 'h1', name: 'Park Hotel', checkInDate: '2026-03-01', checkOutDate: '2026-03-02' }],
      manualChecklist: [{ id: 'c1', text: 'Passport', completed: true }],
      expenses: [{ id: 'e1', title: 'Rail pass', groupId: 'transports', lineItems: [{ id: 'l1', description: 'JR', price: 300, currency: 'USD', paid: true }] }],
    });
    const t = trip({ plans: [withData] });

    const none = buildItineraryDocument(t, withData, options({ includeReservations: false }), NOW);
    expect(none.reservationSections).toEqual([]);
    expect(none.checklist).toEqual([]);
    expect(none.expenses).toBeNull();

    const all = buildItineraryDocument(t, withData, options({ includeChecklist: true, includeExpenses: true }), NOW);
    expect(all.reservationSections.map(s => s.title)).toEqual(['Hotels']);
    expect(all.checklist).toHaveLength(1);
    expect(all.expenses?.overall).toEqual({ USD: 300 });
  });
});

describe('buildItineraryDocument — lodging', () => {
  const withHotel = (extra: Partial<Plan> = {}) =>
    plan({
      hotels: [{ id: 'h1', name: 'Park Hotel', checkInDate: '2026-03-01', checkOutDate: '2026-03-02' }],
      ...extra,
    });

  test('lists a hotel on every date its stay covers, inclusive of both ends', () => {
    const p = withHotel();
    const doc = buildItineraryDocument(trip({ plans: [p] }), p, DEFAULT_EXPORT_OPTIONS, NOW);

    expect(doc.days[0].lodging).toEqual(['Park Hotel (Mar 1 → Mar 2)']);
    expect(doc.days[1].lodging).toEqual(['Park Hotel (Mar 1 → Mar 2)']);
  });

  test('a canceled hotel is not listed as lodging', () => {
    const p = plan({
      hotels: [{ id: 'h1', name: 'Park Hotel', checkInDate: '2026-03-01', checkOutDate: '2026-03-02', status: 'Canceled' }],
    });
    const doc = buildItineraryDocument(trip({ plans: [p] }), p, DEFAULT_EXPORT_OPTIONS, NOW);

    expect(doc.days[0].lodging).toEqual([]);
  });

  test('a day flagged noHotel lists no lodging', () => {
    const p = withHotel({
      days: { '2026-03-01': { dateStr: '2026-03-01', placeIds: [], scheduleItems: [], noHotel: true } },
    });
    const doc = buildItineraryDocument(trip({ plans: [p] }), p, DEFAULT_EXPORT_OPTIONS, NOW);

    expect(doc.days[0].lodging).toEqual([]);
  });
});

describe('buildItineraryDocument — reservations summary', () => {
  test('groups hotels, transport legs, and bookings into sections', () => {
    const p = plan({
      hotels: [{ id: 'h1', name: 'Park Hotel', checkInDate: '2026-03-01', checkOutDate: '2026-03-02', confirmationNo: 'H-1' }],
      transports: [
        {
          id: 't1',
          type: 'train',
          segments: [
            {
              id: 's1',
              carrier: 'JR',
              transitCode: 'Nozomi 21',
              departureLocationName: 'Tokyo',
              departureDate: '2026-03-02',
              departureTime: '08:00',
              departureTimezone: 'Asia/Tokyo',
              arrivalLocationName: 'Kyoto',
              arrivalDate: '2026-03-02',
              arrivalTime: '10:15',
              arrivalTimezone: 'Asia/Tokyo',
            },
            {
              id: 's2',
              departureLocationName: 'Kyoto',
              departureDate: '2026-03-02',
              departureTime: '11:00',
              departureTimezone: 'Asia/Tokyo',
              arrivalLocationName: 'Osaka',
              arrivalDate: '2026-03-02',
              arrivalTime: '11:45',
              arrivalTimezone: 'Asia/Tokyo',
            },
          ],
        },
      ],
      placeReservations: [{ id: 'r1', type: 'dining', title: 'Kaiseki', date: '2026-03-01', time: '19:00' }],
      genericReservations: [{ id: 'g1', title: 'Airport transfer', groupId: 'transports', date: '2026-03-01' }],
    });
    const doc = buildItineraryDocument(trip({ plans: [p] }), p, DEFAULT_EXPORT_OPTIONS, NOW);

    expect(doc.reservationSections.map(s => s.title)).toEqual(['Hotels', 'Transportation', 'Dining', 'Transits']);

    const hotels = doc.reservationSections[0];
    expect(hotels.rows[0].when).toBe('Mar 1 → Mar 2');
    expect(hotels.rows[0].confirmationNo).toBe('H-1');

    const transport = doc.reservationSections[1];
    expect(transport.rows).toHaveLength(2);
    expect(transport.rows[0].title).toBe('JR Nozomi 21 (leg 1 of 2)');
    expect(transport.rows[0].detail).toBe('Tokyo → Kyoto');
    expect(transport.rows[1].title).toBe('Train (leg 2 of 2)');
  });

  test('a booking with no date reads "No date set" rather than blank', () => {
    const p = plan({ placeReservations: [{ id: 'r1', type: 'attraction', title: 'Museum' }] });
    const doc = buildItineraryDocument(trip({ plans: [p] }), p, DEFAULT_EXPORT_OPTIONS, NOW);

    expect(doc.reservationSections[0].rows[0].when).toBe('No date set');
  });
});

describe('buildItineraryDocument — expenses', () => {
  test('totals manual and reservation-attached line items per currency', () => {
    const p = plan({
      hotels: [
        {
          id: 'h1',
          name: 'Park Hotel',
          checkInDate: '2026-03-01',
          checkOutDate: '2026-03-02',
          expenses: [{ id: 'l1', description: 'Room', price: 40000, currency: 'JPY', paid: false }],
        },
      ],
      expenses: [
        {
          id: 'e1',
          title: 'Rail pass',
          groupId: 'transports',
          lineItems: [
            { id: 'l2', description: 'JR Pass', price: 300, currency: 'USD', paid: true },
            { id: 'l3', description: 'Seat fee', price: 20.5, currency: 'USD', paid: false },
          ],
        },
      ],
    });
    const doc = buildItineraryDocument(trip({ plans: [p] }), p, options({ includeExpenses: true }), NOW);

    expect(doc.expenses?.overall).toEqual({ USD: 320.5, JPY: 40000 });
    expect(doc.expenses?.paid).toEqual({ USD: 300 });
    expect(doc.expenses?.unpaid).toEqual({ USD: 20.5, JPY: 40000 });
    expect(doc.expenses?.byGroup).toEqual([
      { name: 'Hotels', totals: { JPY: 40000 } },
      { name: 'Transits', totals: { USD: 320.5 } },
    ]);
  });

  test('groups with no line items are omitted from the breakdown', () => {
    const p = plan();
    const doc = buildItineraryDocument(trip({ plans: [p] }), p, options({ includeExpenses: true }), NOW);

    expect(doc.expenses?.byGroup).toEqual([]);
    expect(doc.expenses?.overall).toEqual({});
  });
});

describe('formatting helpers', () => {
  test('formatAmount keeps whole numbers bare and pads the rest to 2 decimals', () => {
    expect(formatAmount(300)).toBe('300');
    expect(formatAmount(20.5)).toBe('20.50');
  });

  test('formatTotals joins currencies alphabetically and falls back to a dash', () => {
    expect(formatTotals({ USD: 300, JPY: 40000 })).toBe('JPY 40000 · USD 300');
    expect(formatTotals({})).toBe('—');
  });

  test('formatShortDate parses YYYY-MM-DD as a local date, not UTC', () => {
    expect(formatShortDate('2026-03-01')).toBe('Mar 1');
    expect(formatShortDate(undefined)).toBe('');
  });
});
