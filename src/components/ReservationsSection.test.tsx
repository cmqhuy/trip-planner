import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ReservationsSection from './ReservationsSection';
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
      lat: 35.6762,
      lng: 139.6503,
      places: [
        {
          id: 'place-sensoji',
          title: 'Senso-ji Temple',
          description: 'Historic temple',
          lat: 35.7148,
          lng: 139.7967,
          placeGroupId: 'attractions',
          notes: 'requires reservation beforehand'
        }
      ]
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
          placeIds: ['place-sensoji']
        }
      },
      hotels: [
        {
          id: 'hotel-1',
          name: 'Grand Hyatt',
          address: 'Roppongi Hills',
          checkInDate: '2026-07-01',
          checkOutDate: '2026-07-03'
        }
      ],
      transports: [
        {
          id: 'transport-1',
          type: 'flight',
          segments: [
            {
              id: 'transport-1-s0',
              departureLocationName: 'SFO',
              arrivalLocationName: 'HND',
              departureDate: '2026-07-01',
              departureTime: '11:00 AM',
              departureTimezone: 'PST',
              arrivalDate: '2026-07-02',
              arrivalTime: '3:00 PM',
              arrivalTimezone: 'JST',
              carrier: 'ANA',
              transitCode: 'NH7'
            }
          ]
        }
      ],
      manualChecklist: [],
      aiDetails: {}
    }
  ],
  placeGroups: []
};

describe('ReservationsSection Component', () => {
  it('renders flights, accommodations and required reservations correctly', () => {
    const handlePlaceClick = vi.fn();
    const daysList = ['2026-07-01', '2026-07-02', '2026-07-03'];

    render(
      <ReservationsSection
        trip={mockTrip}
        activePlan={mockTrip.plans[0]}
        daysList={daysList}
        onPlaceClick={handlePlaceClick}
        formatDisplayDate={(_d) => `Wed, Jul 1`}
        onEditHotel={vi.fn()}
        onDeleteHotel={vi.fn()}
        onEditTransport={vi.fn()}
        onDeleteTransport={vi.fn()}
        onSaveTransportNotes={vi.fn()}
        expandedHotelId={null}
        setExpandedHotelId={vi.fn()}
        expandedTransitId={null}
        setExpandedTransitId={vi.fn()}
        onAddHotel={vi.fn()}
        onAddTransit={vi.fn()}
        onImportReservationFile={vi.fn()}
      />
    );

    // 1. Transit info assertion — new card shows "departure → arrival" heading
    expect(screen.getByText('SFO → HND')).toBeInTheDocument();
    expect(screen.getByText('ANA · NH7')).toBeInTheDocument();

    // 2. Hotel accommodation assertion
    expect(screen.getByText('Grand Hyatt')).toBeInTheDocument();

    // 3. Reservation required assertion
    const placeCard = screen.getByText('Senso-ji Temple');
    expect(placeCard).toBeInTheDocument();

    // Test interactive callback
    fireEvent.click(placeCard);
    expect(handlePlaceClick).toHaveBeenCalledWith('place-sensoji');
  });

  it('merges consecutive hotel warnings into a single warning', () => {
    const handlePlaceClick = vi.fn();
    const daysList = ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04'];
    
    const customTrip: Trip = {
      ...mockTrip,
      startDate: '2026-07-01',
      endDate: '2026-07-04',
      plans: [
        {
          ...mockTrip.plans[0],
          startDate: '2026-07-01',
          endDate: '2026-07-04',
          days: {
            '2026-07-01': { dateStr: '2026-07-01', placeIds: [], locationId: 'loc-tokyo' },
            '2026-07-02': { dateStr: '2026-07-02', placeIds: [], locationId: 'loc-tokyo' },
            '2026-07-03': { dateStr: '2026-07-03', placeIds: [], locationId: 'loc-tokyo' },
            '2026-07-04': { dateStr: '2026-07-04', placeIds: [], locationId: 'loc-tokyo' },
          },
          hotels: [
            {
              id: 'hotel-1',
              name: 'Grand Hyatt',
              address: 'Roppongi Hills',
              checkInDate: '2026-07-03',
              checkOutDate: '2026-07-04',
              status: 'Confirmed'
            }
          ]
        }
      ]
    };

    render(
      <ReservationsSection
        trip={customTrip}
        activePlan={customTrip.plans[0]}
        daysList={daysList}
        onPlaceClick={handlePlaceClick}
        formatDisplayDate={(d) => {
          if (d === '2026-07-01') return 'Wed, Jul 1';
          if (d === '2026-07-02') return 'Thu, Jul 2';
          if (d === '2026-07-03') return 'Fri, Jul 3';
          if (d === '2026-07-04') return 'Sat, Jul 4';
          return d;
        }}
        onEditHotel={vi.fn()}
        onDeleteHotel={vi.fn()}
        onEditTransport={vi.fn()}
        onDeleteTransport={vi.fn()}
        onSaveTransportNotes={vi.fn()}
        expandedHotelId={null}
        setExpandedHotelId={vi.fn()}
        expandedTransitId={null}
        setExpandedTransitId={vi.fn()}
        onAddHotel={vi.fn()}
        onAddTransit={vi.fn()}
        onImportReservationFile={vi.fn()}
      />
    );

    // Should merge Jul 1 and Jul 2 warnings
    expect(screen.getByText('No hotels booked for Wed, Jul 1 - Thu, Jul 2.')).toBeInTheDocument();
    
    // Should NOT merge Jul 4 because it is separated by Jul 3 (which has hotel)
    expect(screen.getByText('No hotels booked for Sat, Jul 4.')).toBeInTheDocument();
  });
});
