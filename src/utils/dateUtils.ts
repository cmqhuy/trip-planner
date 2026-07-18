import type { Trip, PlanDay, Hotel, FlatTransportationSegment } from '../types';

const RESERVATION_STATUS_PRIORITY: Record<string, number> = {
  Confirmed: 1,
  Planning: 2,
  Canceled: 3,
};

function reservationStatusPriority(status?: string): number {
  return RESERVATION_STATUS_PRIORITY[status ?? ''] ?? 2;
}

export function sortHotels(hotels: Hotel[]): Hotel[] {
  return [...hotels].sort((a, b) => {
    const sp = reservationStatusPriority(a.status) - reservationStatusPriority(b.status);
    if (sp !== 0) return sp;
    const dateA = `${a.checkInDate} ${a.checkInTime ?? ''}`;
    const dateB = `${b.checkInDate} ${b.checkInTime ?? ''}`;
    return dateA.localeCompare(dateB);
  });
}

export function sortTransports(transports: FlatTransportationSegment[]): FlatTransportationSegment[] {
  return [...transports].sort((a, b) => {
    const sp = reservationStatusPriority(a.status) - reservationStatusPriority(b.status);
    if (sp !== 0) return sp;
    const dateA = `${a.departureDate} ${a.departureTime ?? ''}`;
    const dateB = `${b.departureDate} ${b.departureTime ?? ''}`;
    return dateA.localeCompare(dateB);
  });
}

/**
 * Calculates the difference between two date strings (endStr - startStr) in full days.
 */
export function getDaysDiff(startStr: string, endStr: string): number {
  const [startY, startM, startD] = startStr.split('-').map(Number);
  const [endY, endM, endD] = endStr.split('-').map(Number);
  const start = Date.UTC(startY, startM - 1, startD);
  const end = Date.UTC(endY, endM - 1, endD);
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

/**
 * Shifts a YYYY-MM-DD date string by a given number of days.
 */
export function shiftDateString(dateStr: string, offsetDays: number): string {
  if (!dateStr) return dateStr;
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().split('T')[0];
}

/**
 * Generates an array of YYYY-MM-DD date strings between startStr and endStr inclusive.
 */
export function generateDatesRange(startStr: string, endStr: string): string[] {
  const dates: string[] = [];
  const [startY, startM, startD] = startStr.split('-').map(Number);
  const [endY, endM, endD] = endStr.split('-').map(Number);
  
  const current = new Date(Date.UTC(startY, startM - 1, startD));
  const end = new Date(Date.UTC(endY, endM - 1, endD));
  
  let count = 0;
  while (current <= end && count < 100) {
    dates.push(current.toISOString().split('T')[0]);
    current.setUTCDate(current.getUTCDate() + 1);
    count++;
  }
  return dates;
}

/**
 * Shifts trip plan-day structure to a new date range.
 * Hotel and transport reservation dates are NOT shifted — they are fixed real-world bookings.
 */
export function shiftTripDates(trip: Trip, newStartDate: string, newEndDate: string): Trip {
  const origStart = trip.startDate;
  const origEnd = trip.endDate;

  const origDatesRange = generateDatesRange(origStart, origEnd);
  const newDatesRange = generateDatesRange(newStartDate, newEndDate);

  const updatedPlans = trip.plans.map(plan => {
    const newDays: { [dateStr: string]: PlanDay } = {};

    newDatesRange.forEach((newDate, idx) => {
      if (idx < origDatesRange.length) {
        const origDate = origDatesRange[idx];
        const origDay = plan.days[origDate];
        if (origDay) {
          newDays[newDate] = {
            ...origDay,
            dateStr: newDate
          };
        } else {
          newDays[newDate] = {
            dateStr: newDate,
            placeIds: []
          };
        }
      } else {
        newDays[newDate] = {
          dateStr: newDate,
          placeIds: [],
          scheduleItems: []
        };
      }
    });

    return {
      ...plan,
      startDate: newStartDate,
      endDate: newEndDate,
      days: newDays,
    };
  });

  return {
    ...trip,
    startDate: newStartDate,
    endDate: newEndDate,
    plans: updatedPlans
  };
}

/**
 * Returns today's date in local time formatted as YYYY-MM-DD.
 */
export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

