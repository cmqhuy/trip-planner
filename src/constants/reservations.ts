import { Check, Timer, X, type LucideIcon } from 'lucide-react';

/** Shared reservation status vocabulary used by Hotel, Transport, PlaceReservation and Generic reservations. */
export type ReservationStatus = 'Confirmed' | 'Planning' | 'Canceled';

/**
 * Canonical status options, shaped as ComboBox options (value + label + icon).
 * The icon must match the card status badge.
 */
export const STATUS_OPTIONS: { value: ReservationStatus; label: string; icon: LucideIcon }[] = [
  { value: 'Confirmed', label: 'Confirmed', icon: Check },
  { value: 'Planning', label: 'Planning', icon: Timer },
  { value: 'Canceled', label: 'Canceled', icon: X },
];
