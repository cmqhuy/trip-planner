import type { Trip, ScheduleItem } from '../types';

// Bump whenever a new migration step is added.
// Trips already at this version are returned as-is (cheap no-op).
export const CURRENT_SCHEMA_VERSION = 3;

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

export function migrateTrips(rawTrips: any[]): Trip[] {
  return rawTrips.map((trip: any): Trip => {
    if (trip.schemaVersion === CURRENT_SCHEMA_VERSION) return trip as Trip;

    let t = trip;
    if ((t.schemaVersion ?? 0) < 1) t = applyV0toV1(t);
    if ((t.schemaVersion ?? 0) < 2) t = applyV1toV2(t);
    if ((t.schemaVersion ?? 0) < 3) t = applyV2toV3(t);

    return { ...t, schemaVersion: CURRENT_SCHEMA_VERSION };
  });
}
