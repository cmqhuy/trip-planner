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
        getTransportsForDay={() => mockTrip.plans[0].transports}
        scheduledPlaces={mockTrip.locations[0].places}
        displayScheduledPlaces={mockTrip.locations[0].places}
        activePlaceId={undefined}
        setActivePlaceId={vi.fn()}
        placeGeneratingIds={new Set()}
        editingPlaceNotesId={null}
        setEditingPlaceNotesId={vi.fn()}
        tempNotes=""
        setTempNotes={vi.fn()}
        placeQuery=""
        setPlaceQuery={vi.fn()}
        placeSuggestions={[]}
        isSearchingPlace={false}
        draggedPlaceId={null}
        draggedDayPlaceIndex={null}
        setDraggedDayPlaceIndex={vi.fn()}
        dragOverDayPlaceIndex={null}
        setDragOverDayPlaceIndex={vi.fn()}
        dragOverDayPlacePosition="top"
        setDragOverDayPlacePosition={vi.fn()}
        setShowEditTripModal={vi.fn()}
        setShowTripAiConfigModal={vi.fn()}
        setShowHotelModal={vi.fn()}
        setShowTransportModal={vi.fn()}
        setShowAddLocationModal={vi.fn()}
        setAddLocationForDay={vi.fn()}
        setShowDayOptionsMenu={vi.fn()}
        showDayOptionsMenu={false}
        setShowMoveDayModal={vi.fn()}
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
        handleGenerateSingleDayTips={vi.fn()}
        handleSaveDayTips={vi.fn()}
        handleSaveBabyLogistics={vi.fn()}
        handleClearDay={vi.fn()}
        handleAddPlaceFromDayTimeline={vi.fn()}
        handleDayPlaceDragStart={vi.fn()}
        handleDayPlaceDrop={vi.fn()}
        handleCatalogPlaceDropOnTimeline={vi.fn()}
        handleMovePlaceOrder={vi.fn()}
        handleRemovePlaceFromDay={vi.fn()}
        handleAddPlaceToDay={vi.fn()}
        handleOpenEditPlace={vi.fn()}
        handleGenerateSinglePlaceAiDetails={vi.fn()}
        startEditingNotes={vi.fn()}
        savePlaceNotes={vi.fn()}
        onSaveScheduleNote={vi.fn()}
        activeTimelinePlaceDropdownKey={null}
        setActiveTimelinePlaceDropdownKey={vi.fn()}
        daysGeneratingDates={new Set()}
        daysTabsNavRef={{ current: null }}
        lastScrollLeft={{ current: 0 }}
        searchDropdownRef={{ current: null }}
      />
    );

    // Trip name
    expect(screen.getByText('Summer in Europe')).toBeInTheDocument();

    // Day Location header info
    expect(screen.getByRole('heading', { name: 'Paris', level: 3 })).toBeInTheDocument();

    // Scheduled hotels list
    expect(screen.getByText('Le Grand Hotel')).toBeInTheDocument();

    // Scheduled transits list
    expect(screen.getByText('NYC')).toBeInTheDocument();
    expect(screen.getAllByText('Paris').length).toBeGreaterThan(0);

    // Scheduled places
    expect(screen.getByText('Eiffel Tower')).toBeInTheDocument();
  });
});
