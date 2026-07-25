import type { ScheduleItem, PlaceReservation } from '../types';

/**
 * The catalog place id a schedule item is linked to for merge purposes.
 * - A `place` item links to its own placeId.
 * - A `place-reservation-event` links to its reservation's `placeId` (if any).
 * Anything else has no merge link.
 */
export function linkedPlaceIdOf(item: ScheduleItem, reservations: PlaceReservation[] | undefined): string | undefined {
  if (item.type === 'place') return item.placeId;
  if (item.type === 'place-reservation-event') {
    const r = (reservations || []).find(res => res.id === item.reservationId);
    return r?.placeId || undefined;
  }
  return undefined;
}

/**
 * Two adjacent schedule items merge into a single visual card when one is a
 * place-reservation-event and the other is its linked catalog place.
 */
function isMergePair(a: ScheduleItem, b: ScheduleItem, reservations: PlaceReservation[] | undefined): boolean {
  const aRes = a.type === 'place-reservation-event';
  const bRes = b.type === 'place-reservation-event';
  const aPlace = a.type === 'place';
  const bPlace = b.type === 'place';
  if (!((aRes && bPlace) || (aPlace && bRes))) return false;
  const la = linkedPlaceIdOf(a, reservations);
  const lb = linkedPlaceIdOf(b, reservations);
  return !!la && la === lb;
}

/**
 * partner[i] = j when items i and j form a merged pair, otherwise -1.
 * Each item belongs to at most one pair (scanned left→right, greedy).
 */
export function computeMergePartners(items: ScheduleItem[], reservations: PlaceReservation[] | undefined): number[] {
  const partner: number[] = new Array(items.length).fill(-1);
  let i = 0;
  while (i < items.length - 1) {
    if (partner[i] === -1 && isMergePair(items[i], items[i + 1], reservations)) {
      partner[i] = i + 1;
      partner[i + 1] = i;
      i += 2;
    } else {
      i += 1;
    }
  }
  return partner;
}

/**
 * The [start, endInclusive] index range of the merged unit containing `idx`.
 * A non-merged item returns [idx, idx]; a merged pair returns its two indices.
 */
export function mergedUnitRange(
  items: ScheduleItem[],
  idx: number,
  reservations: PlaceReservation[] | undefined,
  partners?: number[],
): [number, number] {
  const partner = partners ?? computeMergePartners(items, reservations);
  const p = partner[idx];
  if (p === undefined || p === -1) return [idx, idx];
  return p > idx ? [idx, p] : [p, idx];
}
