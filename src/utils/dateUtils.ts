import type { Trip, PlanDay } from '../types';

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
 * Shifts trip dates and all associated itineraries, plan days, hotels, and transportations.
 */
export function shiftTripDates(trip: Trip, newStartDate: string, newEndDate: string): Trip {
  const origStart = trip.startDate;
  const origEnd = trip.endDate;
  const offsetDays = getDaysDiff(origStart, newStartDate);

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
          placeIds: []
        };
      }
    });

    const updatedHotels = plan.hotels.map(h => ({
      ...h,
      checkInDate: shiftDateString(h.checkInDate, offsetDays),
      checkOutDate: shiftDateString(h.checkOutDate, offsetDays)
    }));

    const updatedTransports = plan.transports.map(t => ({
      ...t,
      departureDate: shiftDateString(t.departureDate, offsetDays),
      arrivalDate: shiftDateString(t.arrivalDate, offsetDays)
    }));

    return {
      ...plan,
      startDate: newStartDate,
      endDate: newEndDate,
      days: newDays,
      hotels: updatedHotels,
      transports: updatedTransports
    };
  });

  return {
    ...trip,
    startDate: newStartDate,
    endDate: newEndDate,
    plans: updatedPlans
  };
}
