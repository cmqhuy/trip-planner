import { createElement } from 'react';
import { Building, Car, Plane, Landmark, Utensils, Coffee, ShoppingBag, Ticket, CreditCard, DollarSign } from 'lucide-react';

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
