import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ExpensesPanel from './ExpensesPanel';
import type { Trip } from '../types';

const mockTrip: Trip = {
  id: 'trip-1',
  name: 'Summer Trip',
  startDate: '2026-07-01',
  endDate: '2026-07-03',
  locations: [
    {
      id: 'loc-tokyo',
      city: 'Tokyo',
      country: 'Japan',
      countryCode: 'JP',
      lat: 35.6762,
      lng: 139.6503,
      places: [],
      color: '#ff5722'
    },
    {
      id: 'loc-kyoto',
      city: 'Kyoto',
      country: 'Japan',
      countryCode: 'JP',
      lat: 35.0116,
      lng: 135.7681,
      places: []
    }
  ],
  plans: [
    {
      id: 'plan-main',
      name: 'Main Plan',
      startDate: '2026-07-01',
      endDate: '2026-07-03',
      days: {
        '2026-07-01': {
          dateStr: '2026-07-01',
          locationId: 'loc-tokyo',
          placeIds: []
        },
        '2026-07-02': {
          dateStr: '2026-07-02',
          locationId: 'loc-kyoto',
          placeIds: []
        },
        '2026-07-03': {
          dateStr: '2026-07-03',
          placeIds: []
        }
      },
      hotels: [],
      transports: [],
      manualChecklist: [],
      expenseGroups: [
        { id: 'attractions', name: 'Attractions', icon: 'landmark', color: '#ef4444' }
      ],
      expenses: [
        {
          id: 'exp-1',
          title: 'Tokyo Museum',
          groupId: 'attractions',
          date: '2026-07-01',
          lineItems: [
            { id: 'line-1', description: 'Entry ticket', price: 1500, currency: 'JPY', paid: true }
          ]
        },
        {
          id: 'exp-2',
          title: 'Kyoto Tea',
          groupId: 'attractions',
          date: '2026-07-02',
          lineItems: [
            { id: 'line-2', description: 'Tea set', price: 800, currency: 'JPY', paid: false }
          ]
        },
        {
          id: 'exp-3',
          title: 'Unmapped Date Expense',
          groupId: 'attractions',
          date: '2026-07-04',
          lineItems: [
            { id: 'line-3', description: 'Snack', price: 5, currency: 'USD', paid: true }
          ]
        },
        {
          id: 'exp-4',
          title: 'No Date Expense',
          groupId: 'attractions',
          lineItems: [
            { id: 'line-4', description: 'Souvenir', price: 20, currency: 'USD', paid: true }
          ]
        }
      ]
    }
  ],
  placeGroups: []
};

describe('ExpensesPanel Component', () => {
  it('renders expense items and location tags correctly for non-linked expenses', () => {
    render(
      <ExpensesPanel
        trip={mockTrip}
        activePlan={mockTrip.plans[0]}
        onAddExpense={vi.fn()}
        onEditExpense={vi.fn()}
        onAddExpenseGroup={vi.fn()}
        onEditExpenseGroup={vi.fn()}
        onMoveExpenseGroup={vi.fn()}
        activeGroupDropdownId={null}
        setActiveGroupDropdownId={vi.fn()}
      />
    );

    // Verify expense titles are rendered
    expect(screen.getByText('Tokyo Museum')).toBeInTheDocument();
    expect(screen.getByText('Kyoto Tea')).toBeInTheDocument();
    expect(screen.getByText('Unmapped Date Expense')).toBeInTheDocument();
    expect(screen.getByText('No Date Expense')).toBeInTheDocument();

    // Tokyo Museum is on 2026-07-01 which maps to Tokyo
    expect(screen.getByText('Tokyo')).toBeInTheDocument();

    // Kyoto Tea is on 2026-07-02 which maps to Kyoto
    expect(screen.getByText('Kyoto')).toBeInTheDocument();

    // The other two should not map to any location tags
    const japanFlags = screen.getAllByText('🇯🇵');
    expect(japanFlags).toHaveLength(2);
  });
});
