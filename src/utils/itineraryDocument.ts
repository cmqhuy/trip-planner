import type {
  Trip,
  Plan,
  Place,
  Hotel,
  PlaceReservation,
  GenericReservation,
  ExpenseItem,
  ScheduleItem,
  SchedulePlaceItem,
  ScheduleNoteItem,
  ScheduleHotelEventItem,
  ScheduleTransitEventItem,
  SchedulePlaceReservationEventItem,
  FlatTransportationSegment,
} from '../types';
import { flattenReservations } from '../types';
import { DEFAULT_EXPENSE_GROUPS, DEFAULT_RESERVATION_GROUPS } from './api';
import { computeMergePartners } from './scheduleMerge';

/**
 * Turns a Trip + Plan into a flat, print-ready view model.
 *
 * Everything here is a pure function of plain data — no React, no DOM, no
 * `localStorage`. `ItineraryPrintView` renders the result and the browser's
 * own "Save as PDF" produces the file, so the whole export path stays
 * dependency-free (see the note in `ItineraryPrintView`).
 */

export interface ItineraryExportOptions {
  /** Per-place description / opening hours under each schedule entry. */
  includePlaceDetails: boolean;
  /** User-written notes on places and reservations. */
  includeNotes: boolean;
  /** The up-front reservations summary (hotels, transit, bookings). */
  includeReservations: boolean;
  includeChecklist: boolean;
  includeExpenses: boolean;
}

export const DEFAULT_EXPORT_OPTIONS: ItineraryExportOptions = {
  includePlaceDetails: true,
  includeNotes: true,
  includeReservations: true,
  includeChecklist: false,
  includeExpenses: false,
};

export type ItineraryEntryKind = 'place' | 'note' | 'hotel' | 'transit' | 'booking';

export interface ItineraryEntry {
  key: string;
  kind: ItineraryEntryKind;
  /** HH:MM when the item (or its source reservation) carries one. */
  time?: string;
  title: string;
  /** One-line context: route, address, or booking type. */
  subtitle?: string;
  /** Longer descriptive text — only populated when `includePlaceDetails`. */
  detail?: string;
  openingHours?: string;
  /** Only populated when `includeNotes`. */
  notes?: string;
  confirmationNo?: string;
  status?: string;
  /** Catalog group name, when the entry is a catalog place. */
  groupName?: string;
}

export interface ItineraryDay {
  dateStr: string;
  dateLabel: string;
  dayNumber: number;
  locationLabel?: string;
  /** Hotels whose stay covers this date, as "Name (check-in → check-out)". */
  lodging: string[];
  entries: ItineraryEntry[];
}

export interface ReservationRow {
  key: string;
  title: string;
  when: string;
  detail?: string;
  confirmationNo?: string;
  bookedThrough?: string;
  status?: string;
  notes?: string;
}

export interface ReservationSection {
  title: string;
  rows: ReservationRow[];
}

export interface ExpenseTotals {
  /** Currency code → amount, for every line item in the plan. */
  overall: Record<string, number>;
  paid: Record<string, number>;
  unpaid: Record<string, number>;
  /** Group name → currency → amount. */
  byGroup: { name: string; totals: Record<string, number> }[];
}

export interface ItineraryDocument {
  tripName: string;
  planName: string;
  dateRangeLabel: string;
  dayCount: number;
  destinations: string[];
  generatedOnLabel: string;
  days: ItineraryDay[];
  reservationSections: ReservationSection[];
  checklist: { text: string; completed: boolean }[];
  expenses: ExpenseTotals | null;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** `YYYY-MM-DD` → "Mon, Mar 3, 2026". Parsed as local noon so the label never slips a day. */
export function formatLongDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

/** `YYYY-MM-DD` → "Mar 3". */
export function formatShortDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function dateAndTime(dateStr?: string, time?: string): string {
  const date = formatShortDate(dateStr);
  if (!date) return time || '';
  return time ? `${date} · ${time}` : date;
}

/** Matches the Expenses panel: whole numbers stay bare, the rest get 2 decimals. */
export function formatAmount(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

/** `{ USD: 1200, JPY: 45000 }` → "USD 1200 · JPY 45000". */
export function formatTotals(totals: Record<string, number>): string {
  const parts = Object.keys(totals)
    .sort()
    .map(code => `${code} ${formatAmount(totals[code])}`);
  return parts.length ? parts.join(' · ') : '—';
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function transportTitle(seg: FlatTransportationSegment): string {
  return (
    seg.reservationName ||
    [seg.carrier, seg.transitCode].filter(Boolean).join(' ') ||
    titleCase(seg.type)
  );
}

// ---------------------------------------------------------------------------
// Day schedule
// ---------------------------------------------------------------------------

function buildPlaceIndex(trip: Trip): Map<string, Place> {
  const index = new Map<string, Place>();
  trip.locations.forEach(loc => loc.places.forEach(p => index.set(p.id, p)));
  return index;
}

/**
 * Schedule items in display order, with each merged place ⇄ place-reservation
 * pair collapsed into the single entry the day view shows. The reservation
 * supplies the time and confirmation number; the catalog place supplies the
 * description — the same split the merged card renders.
 */
function buildDayEntries(
  items: ScheduleItem[],
  ctx: {
    placeIndex: Map<string, Place>;
    hotels: Hotel[];
    segments: FlatTransportationSegment[];
    placeReservations: PlaceReservation[];
    groupNames: Map<string, string>;
    options: ItineraryExportOptions;
  },
): ItineraryEntry[] {
  const { placeIndex, hotels, segments, placeReservations, groupNames, options } = ctx;
  const partners = computeMergePartners(items, placeReservations);
  const entries: ItineraryEntry[] = [];
  const consumed = new Set<number>();

  const placeEntry = (placeId: string, key: string): ItineraryEntry => {
    const place = placeIndex.get(placeId);
    return {
      key,
      kind: 'place',
      title: place?.title || 'Unknown place',
      detail: options.includePlaceDetails ? place?.description || undefined : undefined,
      openingHours: options.includePlaceDetails ? place?.openingHours || undefined : undefined,
      notes: options.includeNotes ? place?.notes || undefined : undefined,
      groupName: place?.placeGroupId ? groupNames.get(place.placeGroupId) : undefined,
    };
  };

  items.forEach((item, idx) => {
    if (consumed.has(idx)) return;
    const key = `${idx}`;
    const partner = partners[idx];

    // Merged pair: one entry carrying both halves.
    if (partner !== -1 && partner !== undefined) {
      consumed.add(idx);
      consumed.add(partner);
      const resItem = (items[idx].type === 'place-reservation-event' ? items[idx] : items[partner]) as SchedulePlaceReservationEventItem;
      const placeItem = (items[idx].type === 'place' ? items[idx] : items[partner]) as SchedulePlaceItem;
      const reservation = placeReservations.find(r => r.id === resItem.reservationId);
      const base = placeEntry(placeItem.placeId, key);
      entries.push({
        ...base,
        kind: 'booking',
        title: reservation?.title || base.title,
        time: resItem.time || reservation?.time,
        subtitle: reservation ? `${titleCase(reservation.type)} reservation` : base.subtitle,
        confirmationNo: reservation?.confirmationNo,
        status: reservation?.status,
        notes: options.includeNotes ? reservation?.notes || base.notes : undefined,
      });
      return;
    }

    switch (item.type) {
      case 'place':
        entries.push(placeEntry((item as SchedulePlaceItem).placeId, key));
        break;

      case 'note':
        entries.push({ key, kind: 'note', title: (item as ScheduleNoteItem).text });
        break;

      case 'hotel-event': {
        const ev = item as ScheduleHotelEventItem;
        const hotel = hotels.find(h => h.id === ev.hotelId);
        const label = ev.event === 'check-in' ? 'Check-in' : 'Check-out';
        entries.push({
          key,
          kind: 'hotel',
          time: ev.time || (ev.event === 'check-in' ? hotel?.checkInTime : hotel?.checkOutTime),
          title: `${hotel?.name || 'Hotel'} — ${label}`,
          subtitle: hotel?.address || undefined,
          confirmationNo: hotel?.confirmationNo,
          status: hotel?.status,
          notes: options.includeNotes ? hotel?.notes || undefined : undefined,
        });
        break;
      }

      case 'transit-event': {
        const ev = item as ScheduleTransitEventItem;
        const seg = segments.find(s => s.reservationId === ev.reservationId && s.segmentIndex === ev.segmentIndex);
        const label = ev.event === 'departure' ? 'Departure' : 'Arrival';
        const point = ev.event === 'departure' ? seg?.departureLocationName : seg?.arrivalLocationName;
        const address = ev.event === 'departure' ? seg?.departureAddress : seg?.arrivalAddress;
        entries.push({
          key,
          kind: 'transit',
          time: ev.time || (ev.event === 'departure' ? seg?.departureTime : seg?.arrivalTime),
          title: seg ? `${transportTitle(seg)} — ${label}` : label,
          subtitle: [point, address].filter(Boolean).join(' · ') || undefined,
          confirmationNo: seg?.confirmationNo,
          status: seg?.status,
          notes: options.includeNotes ? seg?.notes || undefined : undefined,
        });
        break;
      }

      case 'place-reservation-event': {
        const ev = item as SchedulePlaceReservationEventItem;
        const reservation = placeReservations.find(r => r.id === ev.reservationId);
        entries.push({
          key,
          kind: 'booking',
          time: ev.time || reservation?.time,
          title: reservation?.title || 'Reservation',
          subtitle: reservation
            ? [`${titleCase(reservation.type)} reservation`, reservation.address].filter(Boolean).join(' · ')
            : undefined,
          confirmationNo: reservation?.confirmationNo,
          status: reservation?.status,
          notes: options.includeNotes ? reservation?.notes || undefined : undefined,
        });
        break;
      }
    }
  });

  return entries;
}

// ---------------------------------------------------------------------------
// Reservations summary
// ---------------------------------------------------------------------------

function buildReservationSections(plan: Plan, options: ItineraryExportOptions): ReservationSection[] {
  const notesOf = (text?: string) => (options.includeNotes ? text || undefined : undefined);
  const sections: ReservationSection[] = [];

  const hotels = [...(plan.hotels || [])].sort((a, b) => a.checkInDate.localeCompare(b.checkInDate));
  if (hotels.length) {
    sections.push({
      title: 'Hotels',
      rows: hotels.map(h => ({
        key: h.id,
        title: h.name,
        when: `${dateAndTime(h.checkInDate, h.checkInTime)} → ${dateAndTime(h.checkOutDate, h.checkOutTime)}`,
        detail: h.address,
        confirmationNo: h.confirmationNo,
        bookedThrough: h.bookedThrough,
        status: h.status,
        notes: notesOf(h.notes),
      })),
    });
  }

  const segments = flattenReservations(plan.transports || []).sort((a, b) =>
    `${a.departureDate} ${a.departureTime}`.localeCompare(`${b.departureDate} ${b.departureTime}`),
  );
  if (segments.length) {
    sections.push({
      title: 'Transportation',
      rows: segments.map(seg => ({
        key: `${seg.reservationId}-${seg.segmentIndex}`,
        title:
          seg.totalSegments > 1
            ? `${transportTitle(seg)} (leg ${seg.segmentIndex + 1} of ${seg.totalSegments})`
            : transportTitle(seg),
        when: `${dateAndTime(seg.departureDate, seg.departureTime)} → ${dateAndTime(seg.arrivalDate, seg.arrivalTime)}`,
        detail: `${seg.departureLocationName} → ${seg.arrivalLocationName}`,
        confirmationNo: seg.confirmationNo,
        bookedThrough: seg.bookedThrough,
        status: seg.status,
        notes: notesOf(seg.notes),
      })),
    });
  }

  const bookings: PlaceReservation[] = [...(plan.placeReservations || [])].sort((a, b) =>
    `${a.date || ''} ${a.time || ''}`.localeCompare(`${b.date || ''} ${b.time || ''}`),
  );
  (['attraction', 'dining'] as const).forEach(type => {
    const rows = bookings.filter(b => b.type === type);
    if (!rows.length) return;
    sections.push({
      title: type === 'attraction' ? 'Attractions' : 'Dining',
      rows: rows.map(b => ({
        key: b.id,
        title: b.title,
        when: dateAndTime(b.date, b.time) || 'No date set',
        detail: b.address,
        confirmationNo: b.confirmationNo,
        bookedThrough: b.bookedThrough,
        status: b.status,
        notes: notesOf(b.notes),
      })),
    });
  });

  const groups = plan.reservationGroups || DEFAULT_RESERVATION_GROUPS;
  const generics: GenericReservation[] = plan.genericReservations || [];
  groups.forEach(group => {
    const rows = generics
      .filter(g => g.groupId === group.id)
      .sort((a, b) => `${a.date || ''} ${a.time || ''}`.localeCompare(`${b.date || ''} ${b.time || ''}`));
    if (!rows.length) return;
    sections.push({
      title: group.name,
      rows: rows.map(g => ({
        key: g.id,
        title: g.title,
        when: dateAndTime(g.date, g.time) || 'No date set',
        confirmationNo: g.confirmationNo,
        bookedThrough: g.bookedThrough,
        status: g.status,
        notes: notesOf(g.notes),
      })),
    });
  });

  return sections;
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

/**
 * Mirrors `ExpensesPanel`: manual expenses plus the "virtual" line items that
 * live on hotels, transport reservations, and place reservations. Keep the two
 * in step — a PDF total that disagrees with the on-screen total is worse than
 * no total at all.
 */
function buildExpenseTotals(plan: Plan): ExpenseTotals {
  const virtualise = (
    items: { id: string; expenses?: { price: number; currency: string; paid: boolean }[] }[],
    groupId: string,
  ): ExpenseItem[] =>
    items.map(item => ({
      id: item.id,
      title: '',
      groupId,
      lineItems: (item.expenses || []) as ExpenseItem['lineItems'],
    }));

  const all: ExpenseItem[] = [
    ...(plan.expenses || []),
    ...virtualise(plan.hotels || [], 'hotels'),
    ...virtualise(plan.transports || [], 'transports'),
    ...(plan.placeReservations || []).map(pr => ({
      id: pr.id,
      title: '',
      groupId: pr.type === 'attraction' ? 'attractions' : 'dining',
      lineItems: pr.expenses || [],
    })),
  ];

  const overall: Record<string, number> = {};
  const paid: Record<string, number> = {};
  const unpaid: Record<string, number> = {};
  const perGroup: Record<string, Record<string, number>> = {};

  all.forEach(exp => {
    (exp.lineItems || []).forEach(line => {
      const currency = line.currency || 'USD';
      overall[currency] = (overall[currency] || 0) + line.price;
      const bucket = line.paid ? paid : unpaid;
      bucket[currency] = (bucket[currency] || 0) + line.price;
      if (!perGroup[exp.groupId]) perGroup[exp.groupId] = {};
      perGroup[exp.groupId][currency] = (perGroup[exp.groupId][currency] || 0) + line.price;
    });
  });

  const groups = plan.expenseGroups || DEFAULT_EXPENSE_GROUPS;
  const byGroup = groups
    .filter(g => perGroup[g.id] && Object.keys(perGroup[g.id]).length > 0)
    .map(g => ({ name: g.name, totals: perGroup[g.id] }));

  return { overall, paid, unpaid, byGroup };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function buildItineraryDocument(
  trip: Trip,
  plan: Plan,
  options: ItineraryExportOptions = DEFAULT_EXPORT_OPTIONS,
  now: Date = new Date(),
): ItineraryDocument {
  const placeIndex = buildPlaceIndex(trip);
  const groupNames = new Map((trip.placeGroups || []).map(g => [g.id, g.name] as const));
  const hotels = plan.hotels || [];
  const segments = flattenReservations(plan.transports || []);
  const placeReservations = plan.placeReservations || [];

  const dateStrs = Object.keys(plan.days || {}).sort();

  const days: ItineraryDay[] = dateStrs.map((dateStr, idx) => {
    const day = plan.days[dateStr];
    const location = day.locationId ? trip.locations.find(l => l.id === day.locationId) : undefined;

    // Lexicographic compare on YYYY-MM-DD — same inclusive window the planner
    // uses for "hotels for this day", but without a Date round-trip to slip on.
    const lodging = day.noHotel
      ? []
      : hotels
          .filter(h => h.checkInDate <= dateStr && dateStr <= h.checkOutDate && h.status !== 'Canceled')
          .map(h => `${h.name} (${formatShortDate(h.checkInDate)} → ${formatShortDate(h.checkOutDate)})`);

    return {
      dateStr,
      dateLabel: formatLongDate(dateStr),
      dayNumber: idx + 1,
      locationLabel: location ? [location.city, location.country].filter(Boolean).join(', ') : undefined,
      lodging,
      // `scheduleItems` is backfilled by the v0→v1 migration, so it is present
      // in practice; the `placeIds` fallback is the read-time default the schema
      // rules ask for, in case an unmigrated day ever reaches here.
      entries: buildDayEntries(day.scheduleItems || (day.placeIds || []).map(placeId => ({ type: 'place', placeId }) as ScheduleItem), {
        placeIndex,
        hotels,
        segments,
        placeReservations,
        groupNames,
        options,
      }),
    };
  });

  const destinations = trip.locations.map(l => [l.city, l.country].filter(Boolean).join(', '));

  return {
    tripName: trip.name,
    planName: plan.name,
    dateRangeLabel: `${formatLongDate(trip.startDate)} — ${formatLongDate(trip.endDate)}`,
    dayCount: days.length,
    destinations,
    generatedOnLabel: now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    days,
    reservationSections: options.includeReservations ? buildReservationSections(plan, options) : [],
    checklist: options.includeChecklist ? plan.manualChecklist || [] : [],
    expenses: options.includeExpenses ? buildExpenseTotals(plan) : null,
  };
}
