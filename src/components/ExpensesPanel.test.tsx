import { render, screen, within } from '@testing-library/react';
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
        activeDayStr="2026-07-01"
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

    // Verify date formatting and selected highlight within specific cards
    const museumCard = screen.getByText('Tokyo Museum').closest('.catalog-place-card')!;
    const teaCard = screen.getByText('Kyoto Tea').closest('.catalog-place-card')!;
    
    const museumDateTag = within(museumCard as HTMLElement).getByText('Jul 1');
    const teaDateTag = within(teaCard as HTMLElement).getByText('Jul 2');
    expect(museumDateTag).toBeInTheDocument();
    expect(teaDateTag).toBeInTheDocument();
    expect(museumDateTag.className).toContain('catalog-day-tag--active');
    expect(teaDateTag.className).not.toContain('catalog-day-tag--active');

    // Tokyo Museum maps to Tokyo (Jul 1), Kyoto Tea maps to Kyoto (Jul 2)
    const tokyoTags = screen.getAllByText('Tokyo');
    const kyotoTags = screen.getAllByText('Kyoto');
    expect(tokyoTags.length).toBeGreaterThanOrEqual(1);
    expect(kyotoTags.length).toBeGreaterThanOrEqual(1);
  });

  it('renders location tags and date tags for hotel expenses', () => {
    render(
      <ExpensesPanel
        trip={mockTrip}
        activePlan={mockTrip.plans[0]}
        onAddExpense={vi.fn()}
        onEditExpense={vi.fn()}
        onAddExpenseGroup={vi.fn()}
        onEditExpenseGroup={vi.fn()}
        onMoveExpenseGroup={vi.fn()}
        activeDayStr="2026-07-01"
      />
    );

    // Grand Tokyo Hotel expense is rendered
    expect(screen.getByText('Grand Tokyo Hotel')).toBeInTheDocument();

    // Hotel tag is rendered
    expect(screen.getByText('Hotel')).toBeInTheDocument();

    // Tokyo location tag is rendered next to it (since check-in date 2026-07-01 maps to Tokyo)
    const tokyoInstances = screen.getAllByText('Tokyo');
    expect(tokyoInstances.length).toBeGreaterThanOrEqual(2);

    // Check-in / check-out date range string should NOT be displayed
    expect(screen.queryByText('2026-07-01 to 2026-07-02')).not.toBeInTheDocument();

    // Short date tags for check-in and check-out should be displayed and highlighted (since activeDayStr is 2026-07-01)
    const hotelCard = screen.getByText('Grand Tokyo Hotel').closest('.catalog-place-card')!;
    const hotelJul1Tag = within(hotelCard as HTMLElement).getByText('Jul 1');
    const hotelJul2Tag = within(hotelCard as HTMLElement).getByText('Jul 2');

    expect(hotelJul1Tag).toBeInTheDocument();
    expect(hotelJul2Tag).toBeInTheDocument();
    expect(hotelJul1Tag.className).toContain('catalog-day-tag--active');
    expect(hotelJul2Tag.className).toContain('catalog-day-tag--active');
  });

  it('renders location tags and date tags for transit expenses using the arrival date of the last leg', () => {
    render(
      <ExpensesPanel
        trip={mockTrip}
        activePlan={mockTrip.plans[0]}
        onAddExpense={vi.fn()}
        onEditExpense={vi.fn()}
        onAddExpenseGroup={vi.fn()}
        onEditExpenseGroup={vi.fn()}
        onMoveExpenseGroup={vi.fn()}
        activeDayStr="2026-07-01"
      />
    );

    // Transit title matches the formatted summary
    expect(screen.getByText('Train: Tokyo → Kyoto')).toBeInTheDocument();

    // Transit tag is rendered
    expect(screen.getByText('Transit')).toBeInTheDocument();

    // Transit departure and arrival are both on 2026-07-02 (Kyoto), so they collapse to a single Kyoto tag
    const kyotoInstances = screen.getAllByText('Kyoto');
    expect(kyotoInstances.length).toBeGreaterThanOrEqual(2);

    // Transit date string summary should NOT be displayed
    expect(screen.queryByText('Train: 2026-07-02')).not.toBeInTheDocument();

    // Transit short date tag (Jul 2) is displayed, but not active (since activeDayStr is 2026-07-01 and transit is on 2026-07-02)
    const transitCard = screen.getByText('Train: Tokyo → Kyoto').closest('.catalog-place-card')!;
    const transitJul2Tag = within(transitCard as HTMLElement).getByText('Jul 2');
    expect(transitJul2Tag).toBeInTheDocument();
    expect(transitJul2Tag.className).not.toContain('catalog-day-tag--active');
  });
});
