import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CatalogSection from './CatalogSection';
import type { Trip } from '../types';

const mockTrip: Trip = {
  id: 'trip-1',
  name: 'Trip to Tokyo',
  startDate: '2026-10-01',
  endDate: '2026-10-03',
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
          description: 'Historical temple',
          lat: 35.7148,
          lng: 139.7967,
          placeGroupId: 'attractions',
          notes: 'Visit early morning'
        }
      ]
    }
  ],
  plans: [
    {
      id: 'plan-tokyo',
      name: 'Main Itinerary',
      startDate: '2026-10-01',
      endDate: '2026-10-03',
      days: {
        '2026-10-01': { dateStr: '2026-10-01', placeIds: ['place-sensoji'] }
      },
      hotels: [],
      transports: []
    }
  ],
  placeGroups: [
    { id: 'attractions', name: 'Attractions', color: '#ef4444', icon: 'landmark' }
  ]
};

describe('CatalogSection Component', () => {
  it('renders places and headers correctly', () => {
    const handleSetSelectedCatalogLocId = vi.fn();
    const handleAddPlaceToDay = vi.fn();
    
    render(
      <CatalogSection
        trip={mockTrip}
        catalogLocation={mockTrip.locations[0]}
        selectedCatalogLocId="loc-tokyo"
        setSelectedCatalogLocId={handleSetSelectedCatalogLocId}
        hideAllocatedPlaces={false}
        setHideAllocatedPlaces={vi.fn()}
        activePlaceId={undefined}
        setActivePlaceId={vi.fn()}
        placeAllocatedDaysMap={new Map([['place-sensoji', ['2026-10-01']]])}
        getCachedFormattedDisplayDate={(_dateStr) => 'Thu, Oct 1'}
        activeDayStr="2026-10-01"
        activePlan={mockTrip.plans[0]}
        onEditLocation={vi.fn()}
        onAddLocation={vi.fn()}
        onAddPlaceToDay={handleAddPlaceToDay}
        onOpenEditPlace={vi.fn()}
        onGenerateSinglePlaceAiDetails={vi.fn()}
        placeGeneratingIds={new Set()}
        draggedPlaceId={null}
        dragOverGroupId={null}
        dragOverPlaceId={null}
        dragOverPlacePosition="top"
        setDraggedPlaceId={vi.fn()}
        setDragOverGroupId={vi.fn()}
        setDragOverPlaceId={vi.fn()}
        setDragOverPlacePosition={vi.fn()}
        handlePlaceDragStart={vi.fn()}
        handlePlaceDropOnGroup={vi.fn()}
        handlePlaceDropOnPlace={vi.fn()}
        handleMoveCatalogPlace={vi.fn()}
        handleMoveGroupOrder={vi.fn()}
        startEditingGroup={vi.fn()}
        setShowGroupModal={vi.fn()}
        setAiGeneratePlaces={vi.fn()}
        setAiGenerateCity={vi.fn()}
        setAiGenerateCountry={vi.fn()}
        setShowAiGenerateModal={vi.fn()}
        setEditingPlace={vi.fn()}
        setShowCustomPlaceModal={vi.fn()}
        setAutoScheduleOnActiveDay={vi.fn()}
        editingPlaceNotesId={null}
        setEditingPlaceNotesId={vi.fn()}
        tempNotes=""
        setTempNotes={vi.fn()}
        startEditingNotes={vi.fn()}
        savePlaceNotes={vi.fn()}
        activeGroupDropdownId={null}
        setActiveGroupDropdownId={vi.fn()}
      />
    );

    // Should display the place title
    expect(screen.getByText('Senso-ji Temple')).toBeInTheDocument();
    
    // Should display the category group name
    expect(screen.getByText('Attractions')).toBeInTheDocument();
  });

  it('triggers callbacks when interacting with details', () => {
    const handleSetActivePlaceId = vi.fn();
    const handleStartEditingNotes = vi.fn();

    render(
      <CatalogSection
        trip={mockTrip}
        catalogLocation={mockTrip.locations[0]}
        selectedCatalogLocId="loc-tokyo"
        setSelectedCatalogLocId={vi.fn()}
        hideAllocatedPlaces={false}
        setHideAllocatedPlaces={vi.fn()}
        activePlaceId="place-sensoji" // senjoji details expanded
        setActivePlaceId={handleSetActivePlaceId}
        placeAllocatedDaysMap={new Map([['place-sensoji', ['2026-10-01']]])}
        getCachedFormattedDisplayDate={(_dateStr) => 'Thu, Oct 1'}
        activeDayStr="2026-10-01"
        activePlan={mockTrip.plans[0]}
        onEditLocation={vi.fn()}
        onAddLocation={vi.fn()}
        onAddPlaceToDay={vi.fn()}
        onOpenEditPlace={vi.fn()}
        onGenerateSinglePlaceAiDetails={vi.fn()}
        placeGeneratingIds={new Set()}
        draggedPlaceId={null}
        dragOverGroupId={null}
        dragOverPlaceId={null}
        dragOverPlacePosition="top"
        setDraggedPlaceId={vi.fn()}
        setDragOverGroupId={vi.fn()}
        setDragOverPlaceId={vi.fn()}
        setDragOverPlacePosition={vi.fn()}
        handlePlaceDragStart={vi.fn()}
        handlePlaceDropOnGroup={vi.fn()}
        handlePlaceDropOnPlace={vi.fn()}
        handleMoveCatalogPlace={vi.fn()}
        handleMoveGroupOrder={vi.fn()}
        startEditingGroup={vi.fn()}
        setShowGroupModal={vi.fn()}
        setAiGeneratePlaces={vi.fn()}
        setAiGenerateCity={vi.fn()}
        setAiGenerateCountry={vi.fn()}
        setShowAiGenerateModal={vi.fn()}
        setEditingPlace={vi.fn()}
        setShowCustomPlaceModal={vi.fn()}
        setAutoScheduleOnActiveDay={vi.fn()}
        editingPlaceNotesId={null}
        setEditingPlaceNotesId={vi.fn()}
        tempNotes=""
        setTempNotes={vi.fn()}
        startEditingNotes={handleStartEditingNotes}
        savePlaceNotes={vi.fn()}
        activeGroupDropdownId={null}
        setActiveGroupDropdownId={vi.fn()}
      />
    );

    // Expand view shows place description and notes
    expect(screen.getByText('Historical temple')).toBeInTheDocument();
    expect(screen.getByText('Visit early morning')).toBeInTheDocument();

    // Click edit note triggers startEditingNotes callback
    const editNotesBtn = screen.getByRole('button', { name: /edit note/i });
    fireEvent.click(editNotesBtn);
    expect(handleStartEditingNotes).toHaveBeenCalled();
  });
});
