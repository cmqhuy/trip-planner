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
      hotels: [
        {
          id: 'hotel-1',
          name: 'Grand Tokyo Hotel',
          checkInDate: '2026-07-01',
          checkOutDate: '2026-07-02',
          expenses: [
            { id: 'h-line-1', description: 'Room', price: 100, currency: 'USD', paid: true }
          ]
        }
      ],
      transports: [
        {
          id: 't-1',
          type: 'train',
          segments: [
            {
              id: 't-1-s0',
              departureLocationName: 'Tokyo',
              arrivalLocationName: 'Kyoto',
              departureDate: '2026-07-02',
              departureTime: '10:00',
              departureTimezone: 'JST',
              arrivalDate: '2026-07-02',
              arrivalTime: '12:00',
              arrivalTimezone: 'JST'
            }
          ],
          expenses: [
            { id: 't-line-1', description: 'Ticket', price: 8000, currency: 'JPY', paid: true }
          ]
        }
      ],
      manualChecklist: [],
      expenseGroups: [
        { id: 'attractions', name: 'Attractions', icon: 'landmark', color: '#ef4444' },
        { id: 'hotels', name: 'Hotels', icon: 'hotel', color: '#10b981' },
        { id: 'transports', name: 'Transports', icon: 'bus', color: '#f59e0b' }
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
    expect(screen.getAllByText('Tokyo')[0]).toBeInTheDocument();

    // Kyoto Tea is on 2026-07-02 which maps to Kyoto
    expect(screen.getAllByText('Kyoto')[0]).toBeInTheDocument();

    // Tokyo Museum, Kyoto Tea, Grand Tokyo Hotel, and Train Tokyo -> Kyoto all map to Japan
    const japanFlags = screen.getAllByText('🇯🇵');
    expect(japanFlags).toHaveLength(4);
  });

  it('renders location tags and suppresses date range for hotel expenses', () => {
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

    // Grand Tokyo Hotel expense is rendered
    expect(screen.getByText('Grand Tokyo Hotel')).toBeInTheDocument();

    // Hotel tag is rendered
    expect(screen.getByText('Hotel')).toBeInTheDocument();

    // Tokyo location tag is rendered next to it (since check-in date 2026-07-01 maps to Tokyo)
    // Tokyo text will exist twice now (once for Museum, once for Hotel)
    const tokyoInstances = screen.getAllByText('Tokyo');
    expect(tokyoInstances.length).toBeGreaterThanOrEqual(2);

    // Check-in / check-out dates should NOT be displayed
    expect(screen.queryByText('2026-07-01 to 2026-07-02')).not.toBeInTheDocument();
  });

  it('renders location tags for transit expenses using the arrival date of the last leg', () => {
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

    // Transit title matches the formatted summary
    expect(screen.getByText('Train: Tokyo → Kyoto')).toBeInTheDocument();

    // Transit tag is rendered
    expect(screen.getByText('Transit')).toBeInTheDocument();

    // Kyoto location tag is rendered next to it (since last segment arrival date 2026-07-02 maps to Kyoto)
    // Kyoto text will exist twice now (once for Kyoto Tea, once for Train)
    const kyotoInstances = screen.getAllByText('Kyoto');
    expect(kyotoInstances.length).toBeGreaterThanOrEqual(2);

    // Transit date should NOT be displayed
    expect(screen.queryByText('Train: 2026-07-02')).not.toBeInTheDocument();
  });
});
