import type { Trip, ScheduleItem } from '../types';
import { DEFAULT_EXPENSE_GROUPS, DEFAULT_RESERVATION_GROUPS } from './api';

/**
 * Data mid-migration, shaped by whichever schema version wrote it.
 *
 * By definition it does not conform to the current interfaces — that is the
 * whole reason a migration is running. Typing it precisely would mean one
 * interface per historical version, each obsolete the moment its migration
 * ships, and every step would still have to cast between them. The looseness is
 * confined to this file; `migrateTrips` returns `Trip[]` and is the only export.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LegacyTrip = any;

// Bump whenever a new migration step is added.
// Trips already at this version are returned as-is (cheap no-op).
export const CURRENT_SCHEMA_VERSION = 8;

// v0 → v1: build scheduleItems from placeIds + scheduleNotes
function applyV0toV1(trip: LegacyTrip): LegacyTrip {
  const plans = (trip.plans || []).map((plan: LegacyTrip) => ({
    ...plan,
    days: Object.fromEntries(
      Object.entries(plan.days || {}).map(([dateStr, day]: [string, LegacyTrip]) => {
        if (day.scheduleItems?.length) return [dateStr, day];
        const placeIds: string[] = day.placeIds || [];
        const scheduleNotes: Record<string, string> = day.scheduleNotes || {};
        const items: ScheduleItem[] = [];
        for (let i = 0; i <= placeIds.length; i++) {
          const noteText = scheduleNotes[String(i)];
          if (noteText) items.push({ type: 'note', id: crypto.randomUUID(), text: noteText });
          if (i < placeIds.length) items.push({ type: 'place', placeId: placeIds[i] });
        }
        const { scheduleNotes: _sn, ...rest } = day;
        return [dateStr, { ...rest, scheduleItems: items }];
      })
    ),
  }));
  return { ...trip, plans };
}

// v1 → v2: wrap flat Transportation entries into TransportationReservation with segments[]
function applyV1toV2(trip: LegacyTrip): LegacyTrip {
  const plans = (trip.plans || []).map((plan: LegacyTrip) => ({
    ...plan,
    transports: (plan.transports || []).map((t: LegacyTrip) => {
      if (Array.isArray(t.segments)) return t;
      const {
        id, type, name, confirmationNo, bookedThrough, price, currency, notes, status, attachments,
        carrier, transitCode,
        departureLocationName, departureAddress, departureDate, departureTime, departureTimezone,
        departureLat, departureLng,
        arrivalLocationName, arrivalAddress, arrivalDate, arrivalTime, arrivalTimezone,
        arrivalLat, arrivalLng,
        ...rest
      } = t;
      return {
        id: id || crypto.randomUUID(),
        type: type || 'other',
        name, confirmationNo, bookedThrough, price, currency, notes, status, attachments,
        ...rest,
        segments: [{
          id: crypto.randomUUID(),
          carrier, transitCode,
          departureLocationName: departureLocationName || '',
          departureAddress,
          departureDate: departureDate || '',
          departureTime: departureTime || '',
          departureTimezone: departureTimezone || '',
          departureLat, departureLng,
          arrivalLocationName: arrivalLocationName || '',
          arrivalAddress,
          arrivalDate: arrivalDate || '',
          arrivalTime: arrivalTime || '',
          arrivalTimezone: arrivalTimezone || '',
          arrivalLat, arrivalLng,
        }],
      };
    }),
  }));
  return { ...trip, plans };
}

// v2 → v3: deduplicate segment IDs that collide across reservations in the same plan
// (caused by AI import generating id: `imported-draft-seg-${idx}` which resets per reservation)
function applyV2toV3(trip: LegacyTrip): LegacyTrip {
  const plans = (trip.plans || []).map((plan: LegacyTrip) => {
    const seenIds = new Set<string>();
    const transports = (plan.transports || []).map((reservation: LegacyTrip) => ({
      ...reservation,
      segments: (reservation.segments || []).map((seg: LegacyTrip) => {
        if (!seg.id || seenIds.has(seg.id)) {
          return { ...seg, id: crypto.randomUUID() };
        }
        seenIds.add(seg.id);
        return seg;
      }),
    }));
    return { ...plan, transports };
  });
  return { ...trip, plans };
}

// v3 → v4: initialize expenses to [] on hotels and transports if they don't exist
function applyV3toV4(trip: LegacyTrip): LegacyTrip {
  const plans = (trip.plans || []).map((plan: LegacyTrip) => {
    const hotels = (plan.hotels || []).map((h: LegacyTrip) => {
      if (h.expenses) return h;
      return { ...h, expenses: [] };
    });
    const transports = (plan.transports || []).map((t: LegacyTrip) => {
      if (t.expenses) return t;
      return { ...t, expenses: [] };
    });
    return { ...plan, hotels, transports };
  });
  return { ...trip, plans };
}

// v4 → v5: migrate price and currency fields on hotels/transports into expenses
function applyV4toV5(trip: LegacyTrip): LegacyTrip {
  const plans = (trip.plans || []).map((plan: LegacyTrip) => {
    const hotels = (plan.hotels || []).map((h: LegacyTrip) => {
      const expenses = h.expenses ? [...h.expenses] : [];
      if (h.price != null && h.price !== '') {
        const numericPrice = typeof h.price === 'string' ? parseFloat(h.price) : h.price;
        if (!isNaN(numericPrice)) {
          expenses.push({
            id: `expense-migrated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            description: 'Base Price',
            price: numericPrice,
            currency: h.currency || 'USD',
            paid: false
          });
        }
      }
      const { price: _p, currency: _c, ...rest } = h;
      return { ...rest, expenses };
    });

    const transports = (plan.transports || []).map((t: LegacyTrip) => {
      const expenses = t.expenses ? [...t.expenses] : [];
      if (t.price != null && t.price !== '') {
        const numericPrice = typeof t.price === 'string' ? parseFloat(t.price) : t.price;
        if (!isNaN(numericPrice)) {
          expenses.push({
            id: `expense-migrated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            description: 'Base Price',
            price: numericPrice,
            currency: t.currency || 'USD',
            paid: false
          });
        }
      }
      const { price: _p, currency: _c, ...rest } = t;
      return { ...rest, expenses };
    });

    return { ...plan, hotels, transports };
  });
  return { ...trip, plans };
}

// v5 → v6: initialize expenseGroups and expenses on every plan if not exists (and assign colors to groups)
function applyV5toV6(trip: LegacyTrip): LegacyTrip {
  const plans = (trip.plans || []).map((plan: LegacyTrip) => {
    const rawGroups = plan.expenseGroups || [...DEFAULT_EXPENSE_GROUPS];
    const expenseGroups = rawGroups.map((g: LegacyTrip) => {
      if (g.color) return g;
      let color = '#6366f1';
      if (g.id === 'hotels') color = '#10b981';
      else if (g.id === 'transports') color = '#f59e0b';
      else if (g.id === 'attractions') color = '#ef4444';
      else if (g.id === 'dining') color = '#3b82f6';
      return { ...g, color };
    });
    const expenses = plan.expenses || [];
    return { ...plan, expenseGroups, expenses };
  });
  return { ...trip, plans };
}

// v6 → v7: update default 'transports' group icon to 'plane'
function applyV6toV7(trip: LegacyTrip): LegacyTrip {
  const plans = (trip.plans || []).map((plan: LegacyTrip) => {
    const expenseGroups = (plan.expenseGroups || []).map((g: LegacyTrip) => {
      if (g.id === 'transports' && (!g.icon || g.icon === 'car')) {
        return { ...g, icon: 'plane' };
      }
      return g;
    });
    return { ...plan, expenseGroups };
  });
  return { ...trip, plans };
}

// v7 → v8: ensure placeReservations array and attractions/dining groups exist on every plan
function applyV7toV8(trip: LegacyTrip): LegacyTrip {
  const plans = (trip.plans || []).map((plan: LegacyTrip) => {
    const placeReservations = plan.placeReservations || [];

    // Ensure default reservation groups exist
    const reservationGroups = plan.reservationGroups ? [...plan.reservationGroups] : [...DEFAULT_RESERVATION_GROUPS];
    ['hotels', 'transports', 'attractions', 'dining'].forEach(defId => {
      if (!reservationGroups.some(g => g.id === defId)) {
        const def = DEFAULT_RESERVATION_GROUPS.find(d => d.id === defId);
        if (def) reservationGroups.push(def);
      }
    });

    // Ensure default expense groups exist
    const expenseGroups = plan.expenseGroups ? [...plan.expenseGroups] : [...DEFAULT_EXPENSE_GROUPS];
    ['hotels', 'transports', 'attractions', 'dining'].forEach(defId => {
      if (!expenseGroups.some(g => g.id === defId)) {
        const def = DEFAULT_EXPENSE_GROUPS.find(d => d.id === defId);
        if (def) expenseGroups.push(def);
      }
    });

    return { ...plan, placeReservations, reservationGroups, expenseGroups };
  });
  return { ...trip, plans };
}

export function migrateTrips(rawTrips: LegacyTrip[]): Trip[] {
  return rawTrips.map((trip: LegacyTrip): Trip => {
    if (trip.schemaVersion === CURRENT_SCHEMA_VERSION) return trip as Trip;

    let t = trip;
    if ((t.schemaVersion ?? 0) < 1) t = applyV0toV1(t);
    if ((t.schemaVersion ?? 0) < 2) t = applyV1toV2(t);
    if ((t.schemaVersion ?? 0) < 3) t = applyV2toV3(t);
    if ((t.schemaVersion ?? 0) < 4) t = applyV3toV4(t);
    if ((t.schemaVersion ?? 0) < 5) t = applyV4toV5(t);
    if ((t.schemaVersion ?? 0) < 6) t = applyV5toV6(t);
    if ((t.schemaVersion ?? 0) < 7) t = applyV6toV7(t);
    if ((t.schemaVersion ?? 0) < 8) t = applyV7toV8(t);

    return { ...t, schemaVersion: CURRENT_SCHEMA_VERSION };
  });
}
