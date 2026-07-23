import type { Trip, Plan } from '../types';

export interface ReservationWarning {
  id: string;
  message: string;
  type: 'hotel' | 'transit';
  dateStr?: string;
}

/**
 * Computes all active hotel and transit warnings for a given trip plan.
 * Returns an array of read-only warning objects.
 */
export function getReservationWarnings(
  trip: Trip,
  activePlan: Plan,
  daysList: string[],
  formatDisplayDate: (dateStr: string) => string
): ReservationWarning[] {
  const warnings: ReservationWarning[] = [];

  // 1. Hotel warnings
  const dailyStatuses = daysList.map(d => {
    const isNoHotel = activePlan.days[d]?.noHotel;
    const hotelsForDay = activePlan.hotels.filter(
      h => h.status !== 'Canceled' && h.checkInDate <= d && d < h.checkOutDate
    );
    const confirmedHotels = hotelsForDay.filter(h => h.status === 'Confirmed');
    const pendingHotels = hotelsForDay.filter(h => !h.status || h.status === 'Planning');

    if (confirmedHotels.length === 0) {
      if (isNoHotel) return { dateStr: d, type: 'none' as const };
      if (pendingHotels.length > 0) return { dateStr: d, type: 'pending-no-confirmed' as const };
      const locId = activePlan.days[d]?.locationId;
      if (locId) return { dateStr: d, type: 'no-hotel' as const };
    } else {
      if (pendingHotels.length > 0) return { dateStr: d, type: 'pending-with-confirmed' as const };
    }
    return { dateStr: d, type: 'none' as const };
  });

  let currentNoHotelRun: string[] = [];

  const flushNoHotelRun = () => {
    if (currentNoHotelRun.length === 0) return;
    if (currentNoHotelRun.length === 1) {
      const d = currentNoHotelRun[0];
      warnings.push({
        id: `hotel-no-booking-${d}`,
        message: `No hotels booked for ${formatDisplayDate(d)}.`,
        type: 'hotel',
        dateStr: d
      });
    } else {
      const startDay = currentNoHotelRun[0];
      const endDay = currentNoHotelRun[currentNoHotelRun.length - 1];
      warnings.push({
        id: `hotel-no-booking-${startDay}-${endDay}`,
        message: `No hotels booked for ${formatDisplayDate(startDay)} - ${formatDisplayDate(endDay)}.`,
        type: 'hotel',
        dateStr: startDay
      });
    }
    currentNoHotelRun = [];
  };

  for (const status of dailyStatuses) {
    if (status.type === 'no-hotel') {
      currentNoHotelRun.push(status.dateStr);
    } else {
      flushNoHotelRun();
      if (status.type === 'pending-no-confirmed') {
        warnings.push({
          id: `hotel-pending-unconfirmed-${status.dateStr}`,
          message: `No confirmed hotels booked for ${formatDisplayDate(status.dateStr)}. Please mark the pending hotel to confirmed.`,
          type: 'hotel',
          dateStr: status.dateStr
        });
      } else if (status.type === 'pending-with-confirmed') {
        warnings.push({
          id: `hotel-pending-with-confirmed-${status.dateStr}`,
          message: `There are pending hotels for ${formatDisplayDate(status.dateStr)}. Please confirm or cancel them.`,
          type: 'hotel',
          dateStr: status.dateStr
        });
      }
    }
  }
  flushNoHotelRun();

  // 2. Transit warnings
  for (let i = 1; i < daysList.length; i++) {
    const prevDayStr = daysList[i - 1];
    const dayStr = daysList[i];
    const prevLocId = activePlan.days[prevDayStr]?.locationId;
    const currLocId = activePlan.days[dayStr]?.locationId;
    if (prevLocId && currLocId && prevLocId !== currLocId) {
      const prevLoc = trip.locations.find(l => l.id === prevLocId);
      const currLoc = trip.locations.find(l => l.id === currLocId);
      const prevCity = prevLoc?.city ?? 'previous location';
      const currCity = currLoc?.city ?? 'next location';

      const transits = activePlan.transports.filter(
        t => t.status !== 'Canceled' && t.segments.some(s => s.departureDate === prevDayStr || s.arrivalDate === dayStr)
      );
      const confirmedTransports = transits.filter(t => t.status === 'Confirmed');
      const pendingTransports = transits.filter(t => !t.status || t.status === 'Planning');

      if (confirmedTransports.length === 0) {
        if (pendingTransports.length > 0) {
          warnings.push({
            id: `transit-pending-unconfirmed-${prevDayStr}-${dayStr}`,
            message: `No confirmed transit from ${prevCity} to ${currCity}. Please mark the pending transit to confirmed.`,
            type: 'transit',
            dateStr: dayStr
          });
        } else {
          warnings.push({
            id: `transit-missing-${prevDayStr}-${dayStr}`,
            message: `No transit from ${prevCity} to ${currCity}.`,
            type: 'transit',
            dateStr: dayStr
          });
        }
      } else if (pendingTransports.length > 0) {
        warnings.push({
          id: `transit-pending-with-confirmed-${prevDayStr}-${dayStr}`,
          message: `There are pending transits from ${prevCity} to ${currCity}. Please confirm or cancel them.`,
          type: 'transit',
          dateStr: dayStr
        });
      }
    }
  }

  return warnings;
}
