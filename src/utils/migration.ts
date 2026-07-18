import type { Trip, ScheduleItem } from '../types';
import { DEFAULT_EXPENSE_GROUPS } from './api';

// Bump whenever a new migration step is added.
// Trips already at this version are returned as-is (cheap no-op).
export const CURRENT_SCHEMA_VERSION = 6;

// v0 → v1: build scheduleItems from placeIds + scheduleNotes
function applyV0toV1(trip: any): any {
  const plans = (trip.plans || []).map((plan: any) => ({
    ...plan,
    days: Object.fromEntries(
      Object.entries(plan.days || {}).map(([dateStr, day]: [string, any]) => {
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
function applyV1toV2(trip: any): any {
  const plans = (trip.plans || []).map((plan: any) => ({
    ...plan,
    transports: (plan.transports || []).map((t: any) => {
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
function applyV2toV3(trip: any): any {
  const plans = (trip.plans || []).map((plan: any) => {
    const seenIds = new Set<string>();
    const transports = (plan.transports || []).map((reservation: any) => ({
      ...reservation,
      segments: (reservation.segments || []).map((seg: any) => {
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
function applyV3toV4(trip: any): any {
  const plans = (trip.plans || []).map((plan: any) => {
    const hotels = (plan.hotels || []).map((h: any) => {
      if (h.expenses) return h;
      return { ...h, expenses: [] };
    });
    const transports = (plan.transports || []).map((t: any) => {
      if (t.expenses) return t;
      return { ...t, expenses: [] };
    });
    return { ...plan, hotels, transports };
  });
  return { ...trip, plans };
}

// v4 → v5: migrate price and currency fields on hotels/transports into expenses
function applyV4toV5(trip: any): any {
  const plans = (trip.plans || []).map((plan: any) => {
    const hotels = (plan.hotels || []).map((h: any) => {
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

    const transports = (plan.transports || []).map((t: any) => {
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
function applyV5toV6(trip: any): any {
  const plans = (trip.plans || []).map((plan: any) => {
    const rawGroups = plan.expenseGroups || [...DEFAULT_EXPENSE_GROUPS];
    const expenseGroups = rawGroups.map((g: any) => {
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

export function migrateTrips(rawTrips: any[]): Trip[] {
  return rawTrips.map((trip: any): Trip => {
    if (trip.schemaVersion === CURRENT_SCHEMA_VERSION) return trip as Trip;

    let t = trip;
    if ((t.schemaVersion ?? 0) < 1) t = applyV0toV1(t);
    if ((t.schemaVersion ?? 0) < 2) t = applyV1toV2(t);
    if ((t.schemaVersion ?? 0) < 3) t = applyV2toV3(t);
    if ((t.schemaVersion ?? 0) < 4) t = applyV3toV4(t);
    if ((t.schemaVersion ?? 0) < 5) t = applyV4toV5(t);
    if ((t.schemaVersion ?? 0) < 6) t = applyV5toV6(t);

    return { ...t, schemaVersion: CURRENT_SCHEMA_VERSION };
  });
}
