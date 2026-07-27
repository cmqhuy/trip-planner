import { Check, Timer, X } from 'lucide-react';

/** Shared reservation status vocabulary used by Hotel, Transport, PlaceReservation and Generic reservations. */
export type ReservationStatus = 'Confirmed' | 'Planning' | 'Canceled';

/** Canonical status options + their icons. Icon must match the card status badge. */
export const STATUS_OPTIONS: { value: ReservationStatus; Icon: typeof Check }[] = [
  { value: 'Confirmed', Icon: Check },
  { value: 'Planning', Icon: Timer },
  { value: 'Canceled', Icon: X },
];
