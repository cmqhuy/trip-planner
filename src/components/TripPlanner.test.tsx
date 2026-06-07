import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import TripPlanner from './TripPlanner';
import type { Trip } from '../types';

// Mock Leaflet-based components to avoid jsdom map errors
vi.mock('./MapComponent', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-map-component" />
}));

vi.mock('./MapPicker', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-map-picker" />
}));

const mockTrip: Trip = {
  id: 'trip-1',
  name: 'Summer in Europe',
  startDate: '2026-07-01',
  endDate: '2026-07-03', // 3 days
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
        },
        {
          id: 'place-louvre',
          title: 'Louvre Museum',
          description: 'Art museum',
          lat: 48.8606,
          lng: 2.3376,
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
          placeIds: ['place-eiffel', 'place-louvre']
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
      hotels: [],
      transports: []
    }
  ],
  placeGroups: [
    { id: 'attractions', name: 'Attractions', color: '#ef4444', icon: 'landmark' }
  ]
};

describe('TripPlanner Component', () => {
  beforeEach(() => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    // Set query params so the component starts with plan-main and day 2026-07-01
    window.history.pushState({}, '', '?plan=plan-main&day=2026-07-01');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders Day Schedule places and Catalog correctly', () => {
    const handleUpdateTrip = vi.fn();
    const handleBack = vi.fn();

    render(
      <TripPlanner
        trip={mockTrip}
        onBack={handleBack}
        onUpdateTrip={handleUpdateTrip}
      />
    );

    // Should render the scheduled places (both in timeline and catalog)
    expect(screen.getAllByText('Eiffel Tower').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Louvre Museum').length).toBeGreaterThan(0);

    // Should show active day header details
    expect(screen.getByText(/Day 1/i)).toBeInTheDocument();
  });

  it('calls onUpdateTrip with updated order when reordering places in timeline via ChevronDown', () => {
    const handleUpdateTrip = vi.fn();
    const handleBack = vi.fn();

    render(
      <TripPlanner
        trip={mockTrip}
        onBack={handleBack}
        onUpdateTrip={handleUpdateTrip}
      />
    );

    // Find the timeline container first
    const timelineContainer = screen.getAllByText('Eiffel Tower')
      .find(el => el.closest('.day-timeline'))
      ?.closest('.day-timeline');
    
    expect(timelineContainer).toBeDefined();

    // Query ChevronDown buttons specifically inside the timeline container
    const downButtons = Array.from(timelineContainer!.querySelectorAll('button')).filter(
      btn => btn.querySelector('svg.lucide-chevron-down')
    );
    expect(downButtons.length).toBeGreaterThan(0);

    // Click ChevronDown on the first item (Eiffel Tower)
    fireEvent.click(downButtons[0]);

    expect(handleUpdateTrip).toHaveBeenCalled();
    const updatedTrip = handleUpdateTrip.mock.calls[0][0] as Trip;
    expect(updatedTrip.plans[0].days['2026-07-01'].placeIds).toEqual([
      'place-louvre',
      'place-eiffel'
    ]);
  });

  it('allows moving day contents to another day (places only)', () => {
    const handleUpdateTrip = vi.fn();
    const handleBack = vi.fn();

    render(
      <TripPlanner
        trip={mockTrip}
        onBack={handleBack}
        onUpdateTrip={handleUpdateTrip}
      />
    );

    // Click Move Day button (now inside timeline Day Schedule header)
    const moveDayBtn = screen.getByRole('button', { name: /Move Day/i });
    fireEvent.click(moveDayBtn);

    expect(screen.getByRole('heading', { name: 'Move Day Contents', level: 3 })).toBeInTheDocument();

    // Get select element inside Move Day Modal
    const modal = screen.getByRole('heading', { name: 'Move Day Contents', level: 3 }).closest('.modal-content');
    const select = modal?.querySelector('select');
    expect(select).toBeDefined();
    fireEvent.change(select!, { target: { value: '2026-07-02' } });

    // Click "Move Contents" button
    const confirmBtn = screen.getByRole('button', { name: 'Move Contents' });
    fireEvent.click(confirmBtn);

    // Click "Move Places" button inside the styled confirmation modal
    const movePlacesBtn = screen.getByRole('button', { name: 'Move Places' });
    fireEvent.click(movePlacesBtn);

    expect(handleUpdateTrip).toHaveBeenCalled();
    const updatedTrip = handleUpdateTrip.mock.calls[0][0] as Trip;
    
    // Day 1 places should be cleared, but locationId should be preserved
    expect(updatedTrip.plans[0].days['2026-07-01'].placeIds).toEqual([]);
    expect(updatedTrip.plans[0].days['2026-07-01'].locationId).toBe('loc-paris');

    // Day 2 should now have the location updated to loc-paris and copy places
    expect(updatedTrip.plans[0].days['2026-07-02'].locationId).toBe('loc-paris');
    expect(updatedTrip.plans[0].days['2026-07-02'].placeIds).toEqual([
      'place-eiffel',
      'place-louvre'
    ]);
  });

  it('allows clearing all scheduled places on the active day', () => {
    const handleUpdateTrip = vi.fn();
    const handleBack = vi.fn();

    render(
      <TripPlanner
        trip={mockTrip}
        onBack={handleBack}
        onUpdateTrip={handleUpdateTrip}
      />
    );

    // Click Clear Day button
    const clearDayBtn = screen.getByRole('button', { name: /Clear Day/i });
    fireEvent.click(clearDayBtn);

    // Click "Clear Day" button inside the styled confirmation modal
    const clearModal = screen.getByRole('heading', { name: 'Clear Day Places', level: 3 }).closest('.modal-content');
    const confirmClearBtn = clearModal?.querySelector('button.btn-primary');
    expect(confirmClearBtn).toBeDefined();
    fireEvent.click(confirmClearBtn!);

    expect(handleUpdateTrip).toHaveBeenCalled();
    const updatedTrip = handleUpdateTrip.mock.calls[0][0] as Trip;

    // Day 1 places should be cleared
    expect(updatedTrip.plans[0].days['2026-07-01'].placeIds).toEqual([]);
    // Day 1 location should NOT be modified
    expect(updatedTrip.plans[0].days['2026-07-01'].locationId).toBe('loc-paris');
  });

  it('allows adding a custom place which updates location places', () => {
    const handleUpdateTrip = vi.fn();
    const handleBack = vi.fn();

    render(
      <TripPlanner
        trip={mockTrip}
        onBack={handleBack}
        onUpdateTrip={handleUpdateTrip}
      />
    );

    // Click "+ Place" or "Add Custom Place" icon button
    const addCustomPlaceBtn = screen.getByTitle('Add Custom Place');
    fireEvent.click(addCustomPlaceBtn);

    const customPlaceModal = screen.getByRole('heading', { name: 'Add Place', level: 3 }).closest('.modal-content');
    expect(customPlaceModal).toBeInTheDocument();

    // Fill in place name and description
    const titleInput = screen.getByPlaceholderText('e.g. Eiffel Tower');
    const descInput = screen.getByPlaceholderText('Short summary...');
    const notesInput = screen.getByPlaceholderText('Travel notes, tips, things to try...');

    fireEvent.change(titleInput, { target: { value: 'Champs-Élysées' } });
    fireEvent.change(descInput, { target: { value: 'Famous avenue' } });
    fireEvent.change(notesInput, { target: { value: 'Beautiful walk' } });

    // Submit the form
    const submitBtn = customPlaceModal?.querySelector('button[type="submit"]');
    expect(submitBtn).toBeDefined();
    fireEvent.submit(submitBtn!);

    expect(handleUpdateTrip).toHaveBeenCalled();
    const updatedTrip = handleUpdateTrip.mock.calls[0][0] as Trip;
    const addedPlace = updatedTrip.locations[0].places.find(
      p => p.title === 'Champs-Élysées'
    );
    expect(addedPlace).toBeDefined();
    expect(addedPlace?.description).toBe('Famous avenue');
    expect(addedPlace?.notes).toBe('Beautiful walk');
  });

  it('allows deleting a place from the Catalog, which deletes from catalog and plans', () => {
    const handleUpdateTrip = vi.fn();
    const handleBack = vi.fn();

    render(
      <TripPlanner
        trip={mockTrip}
        onBack={handleBack}
        onUpdateTrip={handleUpdateTrip}
      />
    );

    // Find and click the edit button for "Eiffel Tower" inside the day schedule
    const editPlaceBtns = screen.getAllByTitle('Edit Place');
    expect(editPlaceBtns.length).toBeGreaterThan(0);
    fireEvent.click(editPlaceBtns[0]); // first one is Eiffel Tower

    // Verify Edit modal is shown
    expect(screen.getByText('Edit Place Details')).toBeInTheDocument();

    // Click "Delete Place" button in Edit Place Modal
    const deleteBtn = screen.getByRole('button', { name: /Delete Place/i });
    fireEvent.click(deleteBtn);

    // Click "Delete Place" inside the styled confirmation modal
    const deleteModal = screen.getByRole('heading', { name: 'Delete Place from Catalog', level: 3 }).closest('.modal-content');
    const confirmDeleteBtn = deleteModal?.querySelector('button.btn-primary');
    expect(confirmDeleteBtn).toBeDefined();
    fireEvent.click(confirmDeleteBtn!);

    expect(handleUpdateTrip).toHaveBeenCalled();

    const updatedTrip = handleUpdateTrip.mock.calls[0][0] as Trip;

    // Eiffel Tower should be removed from location's places
    expect(
      updatedTrip.locations[0].places.some(p => p.id === 'place-eiffel')
    ).toBe(false);

    // Eiffel Tower should be removed from scheduled days
    expect(updatedTrip.plans[0].days['2026-07-01'].placeIds).toEqual([
      'place-louvre'
    ]);
  });

  it('allows moving catalog places within their category using Chevron buttons', () => {
    const handleUpdateTrip = vi.fn();
    const handleBack = vi.fn();

    render(
      <TripPlanner
        trip={mockTrip}
        onBack={handleBack}
        onUpdateTrip={handleUpdateTrip}
      />
    );

    const catalogPanel = screen.getByText('Categorized Lists').closest('.catalog-panel');
    expect(catalogPanel).toBeInTheDocument();

    const eiffelCard = screen.getAllByText('Eiffel Tower').find(el => el.closest('.catalog-panel'))?.closest('.catalog-place-card');
    expect(eiffelCard).toBeDefined();

    const downBtn = eiffelCard?.querySelector('button[title="Move Down"]');
    expect(downBtn).toBeDefined();
    expect(downBtn).not.toBeDisabled();

    fireEvent.click(downBtn!);

    expect(handleUpdateTrip).toHaveBeenCalled();
    const updatedTrip = handleUpdateTrip.mock.calls[0][0] as Trip;
    
    expect(updatedTrip.locations[0].places[0].id).toBe('place-louvre');
    expect(updatedTrip.locations[0].places[1].id).toBe('place-eiffel');
  });

  it('automatically schedules a custom place to the active day if added from the Day Schedule timeline view', () => {
    const handleUpdateTrip = vi.fn();
    const handleBack = vi.fn();

    render(
      <TripPlanner
        trip={mockTrip}
        onBack={handleBack}
        onUpdateTrip={handleUpdateTrip}
      />
    );

    const addTimelinePlaceBtn = screen.getByTitle('Add Custom Place');
    fireEvent.click(addTimelinePlaceBtn);

    const customPlaceModal = screen.getByRole('heading', { name: 'Add Place', level: 3 }).closest('.modal-content');
    expect(customPlaceModal).toBeInTheDocument();

    const titleInput = screen.getByPlaceholderText('e.g. Eiffel Tower');
    fireEvent.change(titleInput, { target: { value: 'Arc de Triomphe' } });

    const submitBtn = customPlaceModal?.querySelector('button[type="submit"]');
    expect(submitBtn).toBeDefined();
    fireEvent.submit(submitBtn!);

    expect(handleUpdateTrip).toHaveBeenCalled();
    const updatedTrip = handleUpdateTrip.mock.calls[0][0] as Trip;

    const createdPlace = updatedTrip.locations[0].places.find(p => p.title === 'Arc de Triomphe');
    expect(createdPlace).toBeDefined();

    expect(updatedTrip.plans[0].days['2026-07-01'].placeIds).toContain(createdPlace?.id);
  });
});
