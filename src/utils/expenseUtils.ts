import { createElement } from 'react';
import { Building, Car, Plane, Landmark, Utensils, Coffee, ShoppingBag, Ticket, CreditCard, DollarSign } from 'lucide-react';
import type { Hotel, TransportationReservation } from '../types';

export const EXPENSE_ICONS = [
  { value: 'building', label: 'Hotels / Lodging', emoji: '🏨' },
  { value: 'car', label: 'Transit / Ground', emoji: '🚗' },
  { value: 'plane', label: 'Flights', emoji: '✈️' },
  { value: 'landmark', label: 'Attractions', emoji: '🏛️' },
  { value: 'utensils', label: 'Food / Dining', emoji: '🍴' },
  { value: 'coffee', label: 'Drinks / Cafes', emoji: '☕' },
  { value: 'shopping-bag', label: 'Shopping', emoji: '🛍️' },
  { value: 'ticket', label: 'Activities / Tickets', emoji: '🎟️' },
  { value: 'credit-card', label: 'Fees / Payments', emoji: '💳' },
  { value: 'dollar-sign', label: 'General / Miscellaneous', emoji: '💵' },
];

export const getExpenseGroupIcon = (iconName: string, size = 16, className = '', style = {}) => {
  const props = { size, className, style };
  switch (iconName) {
    case 'building': return createElement(Building, props);
    case 'car': return createElement(Car, props);
    case 'plane': return createElement(Plane, props);
    case 'landmark': return createElement(Landmark, props);
    case 'utensils': return createElement(Utensils, props);
    case 'coffee': return createElement(Coffee, props);
    case 'shopping-bag': return createElement(ShoppingBag, props);
    case 'ticket': return createElement(Ticket, props);
    case 'credit-card': return createElement(CreditCard, props);
    default: return createElement(DollarSign, props);
  }
};

export interface ExpenseReservationDates {
  startDate?: string;
  endDate?: string;
}

export const getExpenseReservationDates = (
  item: { date?: string; linkedReservationId?: string; linkedReservationType?: string },
  hotels: Hotel[],
  transports: TransportationReservation[]
): ExpenseReservationDates => {
  if (item.linkedReservationId) {
    if (item.linkedReservationType === 'hotel') {
      const h = hotels.find(x => x.id === item.linkedReservationId);
      if (h) {
        return { startDate: h.checkInDate, endDate: h.checkOutDate };
      }
    } else if (item.linkedReservationType === 'transit') {
      const t = transports.find(x => x.id === item.linkedReservationId);
      if (t && t.segments && t.segments.length > 0) {
        return {
          startDate: t.segments[0].departureDate,
          endDate: t.segments[t.segments.length - 1].arrivalDate
        };
      }
    }
  }
  return { startDate: item.date, endDate: item.date };
};
