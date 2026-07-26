import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LeftPanelAccordion from './LeftPanelAccordion';
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
      places: []
    }
  ],
  plans: [
    {
      id: 'plan-main',
      name: 'Main Plan',
      startDate: '2026-07-01',
      endDate: '2026-07-03',
      days: {},
      hotels: [],
      transports: [],
      manualChecklist: [],
      aiDetails: {}
    }
  ],
  placeGroups: []
};

describe('LeftPanelAccordion Component', () => {
  it('renders and allows switching sections and going back', () => {
    const handleSetExpanded = vi.fn();
    const handleSetSelectedCatalogLocId = vi.fn();

    render(
      <LeftPanelAccordion
        activeMobileTab="catalog"
        expandedLeftSection="catalog"
        setExpandedLeftSection={handleSetExpanded}
        trip={mockTrip}
        catalogLocation={mockTrip.locations[0]}
        selectedCatalogLocId="loc-tokyo"
        setSelectedCatalogLocId={handleSetSelectedCatalogLocId}
        hideAllocatedPlaces={false}
        setHideAllocatedPlaces={vi.fn()}
        activePlaceId={undefined}
        setActivePlaceId={vi.fn()}
        onPlaceClick={vi.fn()}
        placeAllocatedDaysMap={new Map()}
        getCachedFormattedDisplayDate={(d) => d}
        activeDayStr="2026-07-01"
        activePlan={mockTrip.plans[0]}
        onEditLocation={vi.fn()}
        onAddLocation={vi.fn()}
        onAddPlaceToDay={vi.fn()}
        onOpenEditPlace={vi.fn()}
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
        hiddenMapGroupIds={[]}
        onToggleGroupMapVisibility={vi.fn()}
        startEditingGroup={vi.fn()}
        setShowGroupModal={vi.fn()}
        setAiGeneratePlaces={vi.fn()}
        setAiGenerateCity={vi.fn()}
        setAiGenerateCountry={vi.fn()}
        setShowAiGenerateModal={vi.fn()}
        setEditingPlace={vi.fn()}
        setShowCustomPlaceModal={vi.fn()}
        setAutoScheduleOnActiveDay={vi.fn()}
        savePlaceNotes={vi.fn()}
        activeGroupDropdownId={null}
        setActiveGroupDropdownId={vi.fn()}
        aiSuggestedPlaces={[]}
        isLoadingAiSuggestions={false}
        aiSuggestionsLocId={null}
        aiSuggestionsError={null}
        onAiSuggestPlaces={vi.fn()}
        generatingChecklist={false}
        onGenerateTripChecklist={vi.fn()}
        onSaveAiChecklist={vi.fn()}
        onUpdateTrip={vi.fn()}
        daysList={['2026-07-01']}
        generatingLocalEssentials={false}
        onGenerateLocalEssentials={vi.fn()}
        onSaveLocalEssentials={vi.fn()}
        formatDisplayDate={(d) => d}
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
        reservationGroups={[
          { id: 'hotels', name: 'Hotels', icon: 'building', color: '#10b981' },
          { id: 'transports', name: 'Transits', icon: 'plane', color: '#f59e0b' },
          { id: 'attractions', name: 'Attractions', icon: 'landmark', color: '#ef4444' },
          { id: 'dining', name: 'Dining', icon: 'utensils', color: '#3b82f6' },
        ]}
        genericReservations={[]}
        onAddReservationGroup={vi.fn()}
        onEditReservationGroup={vi.fn()}
        onMoveReservationGroup={vi.fn()}
        onAddGenericReservation={vi.fn()}
        onEditGenericReservation={vi.fn()}
        activeReservationGroupDropdownId={null}
        setActiveReservationGroupDropdownId={vi.fn()}
        onAddExpense={vi.fn()}
        onEditExpense={vi.fn()}
        onAddExpenseGroup={vi.fn()}
        onEditExpenseGroup={vi.fn()}
        onMoveExpenseGroup={vi.fn()}
        activeExpenseGroupDropdownId={null}
        setActiveExpenseGroupDropdownId={vi.fn()}
      />
    );

    // Verify Catalog section is rendered
    expect(screen.getByText('Catalog')).toBeInTheDocument();
    expect(screen.getByText('Checklist')).toBeInTheDocument();
    expect(screen.getByText('Reservations')).toBeInTheDocument();
    expect(screen.getByText('Tips (Local Essentials)')).toBeInTheDocument();

    // Clicking Checklist header triggers section change callback
    const checklistHeader = screen.getByText('Checklist');
    fireEvent.click(checklistHeader);
    expect(handleSetExpanded).toHaveBeenCalledWith('checklist');

    // Clicking Reservations header triggers section change callback
    const reservationsHeader = screen.getByText('Reservations');
    fireEvent.click(reservationsHeader);
    expect(handleSetExpanded).toHaveBeenCalledWith('reservations');

    // Clicking Tips header triggers section change callback
    const tipsHeader = screen.getByText('Tips (Local Essentials)');
    fireEvent.click(tipsHeader);
    expect(handleSetExpanded).toHaveBeenCalledWith('tips');
  });
});
