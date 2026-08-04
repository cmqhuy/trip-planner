import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ItineraryPanel from './ItineraryPanel';
import type { Trip } from '../types';

const mockTrip: Trip = {
  id: 'trip-1',
  name: 'Summer in Europe',
  startDate: '2026-07-01',
  endDate: '2026-07-03',
  locations: [
    {
      id: 'loc-paris',
      city: 'Paris',
      country: 'France',
      lat: 48.8566,
      lng: 2.3522,
      places: [
        {
          id: 'place-eiffel',
          title: 'Eiffel Tower',
          description: 'Iron tower',
          lat: 48.8584,
          lng: 2.2945,
          placeGroupId: 'attractions',
          notes: ''
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
          locationId: 'loc-paris',
          placeIds: ['place-eiffel']
        },
        '2026-07-02': {
          dateStr: '2026-07-02',
          placeIds: []
        },
        '2026-07-03': {
          dateStr: '2026-07-03',
          placeIds: []
        }
      },
      hotels: [
        { id: 'hotel-1', name: 'Le Grand Hotel', checkInDate: '2026-07-01', checkOutDate: '2026-07-03' }
      ],
      transports: [
        {
          id: 't-1',
          type: 'flight',
          segments: [
            {
              id: 't-1-s0',
              departureLocationName: 'NYC',
              arrivalLocationName: 'Paris',
              departureDate: '2026-07-01',
              departureTime: '10:00',
              departureTimezone: 'EST',
              arrivalDate: '2026-07-01',
              arrivalTime: '22:00',
              arrivalTimezone: 'GMT+1'
            }
          ]
        }
      ]
    }
  ],
  placeGroups: [
    { id: 'attractions', name: 'Attractions', color: '#ef4444', icon: 'landmark' }
  ]
};

describe('ItineraryPanel Component', () => {
  it('renders day details, hotels, transits and schedule places correctly', () => {
    const daysList = ['2026-07-01', '2026-07-02', '2026-07-03'];
    
    render(
      <ItineraryPanel
        trip={mockTrip}
        activePlan={mockTrip.plans[0]}
        activePlanId="plan-main"
        setActivePlanId={vi.fn()}
        activeDayStr="2026-07-01"
        setActiveDayStr={vi.fn()}
        activeDay={mockTrip.plans[0].days['2026-07-01']}
        activeDayLocation={mockTrip.locations[0]}
        catalogLocation={mockTrip.locations[0]}
        daysList={daysList}
        activeMobileTab="itinerary"
        isGoogleSignedIn={false}
        onShareTrip={vi.fn()}
        formatDisplayDate={(d) => d}
        getHotelsForDay={() => mockTrip.plans[0].hotels}
        getTransportsForDay={() => [{
          id: 't-1-s0', reservationId: 't-1', segmentIndex: 0, totalSegments: 1,
          type: 'flight', reservationName: undefined,
          departureLocationName: 'NYC', arrivalLocationName: 'Paris',
          departureDate: '2026-07-01', departureTime: '10:00', departureTimezone: 'EST',
          arrivalDate: '2026-07-01', arrivalTime: '22:00', arrivalTimezone: 'GMT+1'
        }]}
        scheduledPlaces={mockTrip.locations[0].places}
        displayScheduledPlaces={mockTrip.locations[0].places}
        activePlaceId={undefined}
        setActivePlaceId={vi.fn()}
        placeGeneratingIds={new Set()}
        placeQuery=""
        setPlaceQuery={vi.fn()}
        placeSuggestions={[]}
        isSearchingPlace={false}
        draggedPlaceId={null}
        dragOverDayPlaceIndex={null}
        dragOverDayPlacePosition="top"
        setShowEditTripModal={vi.fn()}
        setShowTripAiConfigModal={vi.fn()}
        setShowHotelModal={vi.fn()}
        setShowTransportModal={vi.fn()}
        setShowAddLocationModal={vi.fn()}
        setAddLocationForDay={vi.fn()}
        setShowDayOptionsMenu={vi.fn()}
        showDayOptionsMenu={false}
        setShowMoveDayModal={vi.fn()}
        setShowSwapDaysModal={vi.fn()}
        setShowAiGenerateDaysModal={vi.fn()}
        setShowCustomPlaceModal={vi.fn()}
        setAutoScheduleOnActiveDay={vi.fn()}
        setEditingPlace={vi.fn()}
        setAiGeneratePlaces={vi.fn()}
        setAiGenerateCity={vi.fn()}
        setAiGenerateCountry={vi.fn()}
        setShowAiGenerateModal={vi.fn()}
        isRenamingPlan={false}
        setIsRenamingPlan={vi.fn()}
        editPlanName=""
        setEditPlanName={vi.fn()}
        handleRenamePlan={vi.fn()}
        handleDeletePlan={vi.fn()}
        handleMovePlan={vi.fn()}
        showPlanMenu={false}
        setShowPlanMenu={vi.fn()}
        setShowNewPlanModal={vi.fn()}
        handleSetDayLocation={vi.fn()}
        handleDeleteHotel={vi.fn()}
        handleDeleteTransportation={vi.fn()}
        handleOpenEditHotel={vi.fn()}
        handleOpenEditTransport={vi.fn()}
        handleSaveHotelNotes={vi.fn()}
        handleSaveTransportNotes={vi.fn()}
        handleSavePlaceReservationNotes={vi.fn()}
        handleGenerateSingleDayTips={vi.fn()}
        handleSaveDayTips={vi.fn()}
        handleSaveBabyLogistics={vi.fn()}
        handleSaveSuggestedReservations={vi.fn()}
        handleClearDay={vi.fn()}
        handleAddPlaceFromDayTimeline={vi.fn()}
        handleOpenAddPlaceAtIndex={vi.fn()}
        scheduleItems={[{ type: 'place', placeId: 'place-eiffel' }]}
        handleMoveScheduleItem={vi.fn()}
        handleAddReservationEventToSchedule={vi.fn()}
        handleUpdateScheduleItemTime={vi.fn()}
        handleRemovePlaceFromDay={vi.fn()}
        handleAddScheduleNote={vi.fn()}
        handleUpdateScheduleNote={vi.fn()}
        handleDeleteScheduleNote={vi.fn()}
        handleAddPlaceToDay={vi.fn()}
        handleAddAiSuggestionToCatalog={vi.fn()}
        handleOpenEditPlace={vi.fn()}
        handleGenerateSinglePlaceAiDetails={vi.fn()}
        savePlaceNotes={vi.fn()}
        activeTimelinePlaceDropdownKey={null}
        setActiveTimelinePlaceDropdownKey={vi.fn()}
        daysGeneratingDates={new Set()}
        daysTabsNavRef={{ current: null }}
        lastScrollLeft={{ current: 0 }}
        searchDropdownRef={{ current: null }}
        expandedHotelId={null}
        setExpandedHotelId={vi.fn()}
        expandedTransitId={null}
        setExpandedTransitId={vi.fn()}
      />
    );

    // Trip name
    expect(screen.getByText('Summer in Europe')).toBeInTheDocument();

    // Day Location header info
    expect(screen.getByRole('heading', { name: 'Paris', level: 3 })).toBeInTheDocument();

    // Scheduled hotels list
    expect(screen.getAllByText('Le Grand Hotel').length).toBeGreaterThan(0);

    // Scheduled transits list
    expect(screen.getByText('NYC')).toBeInTheDocument();
    expect(screen.getAllByText('Paris').length).toBeGreaterThan(0);

    // Scheduled places
    expect(screen.getByText('Eiffel Tower')).toBeInTheDocument();

    // Schedule cards are dnd-kit sortables, not HTML5 `draggable` nodes — the old
    // implementation never fired on touch, so reordering a day was desktop-only.
    const placeCard = document.querySelector('[data-place-id="place-eiffel"]') as HTMLElement;
    expect(placeCard).toBeTruthy();
    expect(placeCard.getAttribute('draggable')).toBeNull();
    expect(placeCard).toHaveAttribute('aria-roledescription', 'sortable');
    expect(placeCard).toHaveAttribute('tabindex', '0');
    expect(document.querySelectorAll('[draggable="true"]').length).toBe(0);
  });

  it('renders a reservation + linked place as one merged cell with a squared, borderless seam', () => {
    const reservation = {
      id: 'res-eiffel',
      type: 'attraction' as const,
      placeId: 'place-eiffel',
      title: 'Eiffel Tower Reservation',
      date: '2026-07-01',
      time: '09:00',
    };
    const planWithRes = {
      ...mockTrip.plans[0],
      placeReservations: [reservation],
    };
    const scheduleItems = [
      { type: 'place-reservation-event' as const, reservationId: 'res-eiffel', time: '09:00' },
      { type: 'place' as const, placeId: 'place-eiffel' },
    ];

    const { container } = render(
      <ItineraryPanel
        trip={mockTrip}
        activePlan={planWithRes}
        activePlanId="plan-main"
        setActivePlanId={vi.fn()}
        activeDayStr="2026-07-01"
        setActiveDayStr={vi.fn()}
        activeDay={mockTrip.plans[0].days['2026-07-01']}
        activeDayLocation={mockTrip.locations[0]}
        catalogLocation={mockTrip.locations[0]}
        daysList={['2026-07-01', '2026-07-02', '2026-07-03']}
        activeMobileTab="itinerary"
        isGoogleSignedIn={false}
        onShareTrip={vi.fn()}
        formatDisplayDate={(d) => d}
        getHotelsForDay={() => []}
        getTransportsForDay={() => []}
        scheduledPlaces={mockTrip.locations[0].places}
        displayScheduledPlaces={mockTrip.locations[0].places}
        activePlaceId={undefined}
        setActivePlaceId={vi.fn()}
        placeGeneratingIds={new Set()}
        placeQuery=""
        setPlaceQuery={vi.fn()}
        placeSuggestions={[]}
        isSearchingPlace={false}
        draggedPlaceId={null}
        dragOverDayPlaceIndex={null}
        dragOverDayPlacePosition="top"
        setShowEditTripModal={vi.fn()}
        setShowTripAiConfigModal={vi.fn()}
        setShowHotelModal={vi.fn()}
        setShowTransportModal={vi.fn()}
        setShowAddLocationModal={vi.fn()}
        setAddLocationForDay={vi.fn()}
        setShowDayOptionsMenu={vi.fn()}
        showDayOptionsMenu={false}
        setShowMoveDayModal={vi.fn()}
        setShowSwapDaysModal={vi.fn()}
        setShowAiGenerateDaysModal={vi.fn()}
        setShowCustomPlaceModal={vi.fn()}
        setAutoScheduleOnActiveDay={vi.fn()}
        setEditingPlace={vi.fn()}
        setAiGeneratePlaces={vi.fn()}
        setAiGenerateCity={vi.fn()}
        setAiGenerateCountry={vi.fn()}
        setShowAiGenerateModal={vi.fn()}
        isRenamingPlan={false}
        setIsRenamingPlan={vi.fn()}
        editPlanName=""
        setEditPlanName={vi.fn()}
        handleRenamePlan={vi.fn()}
        handleDeletePlan={vi.fn()}
        handleMovePlan={vi.fn()}
        showPlanMenu={false}
        setShowPlanMenu={vi.fn()}
        setShowNewPlanModal={vi.fn()}
        handleSetDayLocation={vi.fn()}
        handleDeleteHotel={vi.fn()}
        handleDeleteTransportation={vi.fn()}
        handleOpenEditHotel={vi.fn()}
        handleOpenEditTransport={vi.fn()}
        handleSaveHotelNotes={vi.fn()}
        handleSaveTransportNotes={vi.fn()}
        handleSavePlaceReservationNotes={vi.fn()}
        handleGenerateSingleDayTips={vi.fn()}
        handleSaveDayTips={vi.fn()}
        handleSaveBabyLogistics={vi.fn()}
        handleSaveSuggestedReservations={vi.fn()}
        handleClearDay={vi.fn()}
        handleAddPlaceFromDayTimeline={vi.fn()}
        handleOpenAddPlaceAtIndex={vi.fn()}
        scheduleItems={scheduleItems}
        handleMoveScheduleItem={vi.fn()}
        handleAddReservationEventToSchedule={vi.fn()}
        handleUpdateScheduleItemTime={vi.fn()}
        handleRemovePlaceFromDay={vi.fn()}
        handleAddScheduleNote={vi.fn()}
        handleUpdateScheduleNote={vi.fn()}
        handleDeleteScheduleNote={vi.fn()}
        handleAddPlaceToDay={vi.fn()}
        handleAddAiSuggestionToCatalog={vi.fn()}
        handleOpenEditPlace={vi.fn()}
        handleGenerateSinglePlaceAiDetails={vi.fn()}
        savePlaceNotes={vi.fn()}
        activeTimelinePlaceDropdownKey={null}
        setActiveTimelinePlaceDropdownKey={vi.fn()}
        daysGeneratingDates={new Set()}
        daysTabsNavRef={{ current: null }}
        lastScrollLeft={{ current: 0 }}
        searchDropdownRef={{ current: null }}
        expandedHotelId={null}
        setExpandedHotelId={vi.fn()}
        expandedTransitId={null}
        setExpandedTransitId={vi.fn()}
      />
    );

    // Both halves render inside a single merged container.
    const cell = container.querySelector('.schedule-merged-cell');
    expect(cell).not.toBeNull();

    // The reservation (top) and the place (bottom) each carry the seam-squaring classes,
    // so no rounded corner appears where they meet.
    const top = container.querySelector('.timeline-card--merged-top');
    const bottom = container.querySelector('.timeline-card--merged-bottom');
    expect(top).not.toBeNull();
    expect(bottom).not.toBeNull();
    // The pair lives inside the one cell (moves/hovers/selects as a unit).
    expect(cell!.contains(top)).toBe(true);
    expect(cell!.contains(bottom)).toBe(true);

    expect(screen.getAllByText('Eiffel Tower Reservation').length).toBeGreaterThan(0);
  });
});
