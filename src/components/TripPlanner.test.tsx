import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    expect(screen.getByText(/Wed/i, { selector: '.day-tab-num' })).toBeInTheDocument();
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

    const { container } = render(
      <TripPlanner
        trip={mockTrip}
        onBack={handleBack}
        onUpdateTrip={handleUpdateTrip}
      />
    );

    // Open Day Options dropdown
    const dayOptionsBtn = container.querySelector('[data-tooltip="Day Options"]');
    expect(dayOptionsBtn).toBeDefined();
    fireEvent.click(dayOptionsBtn!);

    // Click Move Day button (now inside timeline Day Schedule header)
    const moveDayBtn = screen.getByRole('button', { name: /Move Day/i });
    fireEvent.click(moveDayBtn);

    expect(screen.getByRole('heading', { name: 'Move Scheduled Places', level: 3 })).toBeInTheDocument();

    // Get select element inside Move Day Modal
    const modal = screen.getByRole('heading', { name: 'Move Scheduled Places', level: 3 }).closest('.modal-content');
    const select = modal?.querySelector('select');
    expect(select).toBeDefined();
    fireEvent.change(select!, { target: { value: '2026-07-02' } });

    // Click "Move Places" button
    const confirmBtn = screen.getByRole('button', { name: 'Move Places' });
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

    const { container } = render(
      <TripPlanner
        trip={mockTrip}
        onBack={handleBack}
        onUpdateTrip={handleUpdateTrip}
      />
    );

    // Open Day Options dropdown
    const dayOptionsBtn = container.querySelector('[data-tooltip="Day Options"]');
    expect(dayOptionsBtn).toBeDefined();
    fireEvent.click(dayOptionsBtn!);

    // Click Clear Day button
    const clearDayBtn = screen.getByRole('button', { name: /Clear Day/i });
    fireEvent.click(clearDayBtn);

    // Click "Clear Day" button inside the styled confirmation modal
    const clearModal = screen.getByRole('heading', { name: 'Clear Day', level: 3 }).closest('.modal-content');
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

    const { container } = render(
      <TripPlanner
        trip={mockTrip}
        onBack={handleBack}
        onUpdateTrip={handleUpdateTrip}
      />
    );

    // Click "+ Place" or "Add Custom Place" icon button
    const addCustomPlaceBtn = container.querySelector('[data-tooltip="Add New Place"]');
    expect(addCustomPlaceBtn).not.toBeNull();
    fireEvent.click(addCustomPlaceBtn!);

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

    const { container } = render(
      <TripPlanner
        trip={mockTrip}
        onBack={handleBack}
        onUpdateTrip={handleUpdateTrip}
      />
    );

    // Find and click the place options dropdown button first to reveal the edit button
    const placeOptionsBtns = container.querySelectorAll('[data-tooltip="Place Options"]');
    expect(placeOptionsBtns.length).toBeGreaterThan(0);
    fireEvent.click(placeOptionsBtns[0]);

    // Find and click the edit button for "Eiffel Tower" inside the day schedule
    const editPlaceBtns = container.querySelectorAll('[data-tooltip="Edit Place"]');
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

    const catalogPanel = screen.getByText('Groups').closest('.catalog-panel');
    expect(catalogPanel).toBeInTheDocument();

    const eiffelCard = screen.getAllByText('Eiffel Tower').find(el => el.closest('.catalog-panel'))?.closest('.catalog-place-card');
    expect(eiffelCard).toBeDefined();

    const downBtn = eiffelCard?.querySelector('button[data-tooltip="Move Down"]');
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

    const { container } = render(
      <TripPlanner
        trip={mockTrip}
        onBack={handleBack}
        onUpdateTrip={handleUpdateTrip}
      />
    );

    const addTimelinePlaceBtn = container.querySelector('[data-tooltip="Add New Place"]');
    expect(addTimelinePlaceBtn).not.toBeNull();
    fireEvent.click(addTimelinePlaceBtn!);

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

    // Verify it is scheduled to Day 1
    expect(updatedTrip.plans[0].days['2026-07-01'].placeIds).toContain(createdPlace?.id);
    
    // Verify it defaults to 'new' group
    expect(createdPlace?.placeGroupId).toBe('new');
  });

  it('renders day switcher styling highlights correctly', () => {
    const { container } = render(
      <TripPlanner
        trip={mockTrip}
        onBack={vi.fn()}
        onUpdateTrip={vi.fn()}
      />
    );

    const tabs = container.querySelectorAll('.day-tab');
    expect(tabs.length).toBe(3);

    // Active tab (Day 1)
    const activeTab = tabs[0] as HTMLButtonElement;
    expect(activeTab.classList.contains('active')).toBe(true);
    // Active tab should have colored borders or boxShadow
    expect(activeTab.style.borderTopColor).toBe('var(--accent-primary)');

    // Inactive tab (Day 2)
    const inactiveTab = tabs[1] as HTMLButtonElement;
    expect(inactiveTab.classList.contains('active')).toBe(false);
    expect(inactiveTab.style.borderTopColor).toBe('transparent');
  });

  it('preserves move day dropdown target selection on rerender', () => {
    const handleUpdateTrip = vi.fn();
    const { rerender, container } = render(
      <TripPlanner
        trip={mockTrip}
        onBack={vi.fn()}
        onUpdateTrip={handleUpdateTrip}
      />
    );

    // Open Day Options dropdown
    const dayOptionsBtn = container.querySelector('[data-tooltip="Day Options"]');
    expect(dayOptionsBtn).toBeDefined();
    fireEvent.click(dayOptionsBtn!);

    // Open Move Day modal
    const moveDayBtn = screen.getByRole('button', { name: /Move Day/i });
    fireEvent.click(moveDayBtn);

    const select = screen.getByRole('combobox', { name: 'Select Destination Day' }) as HTMLSelectElement;
    expect(select.value).toBe('2026-07-02'); // defaults to first available

    // Change target day
    fireEvent.change(select, { target: { value: '2026-07-03' } });
    expect(select.value).toBe('2026-07-03');

    // Trigger parent rerender by supplying a new trip prop object reference
    rerender(
      <TripPlanner
        trip={{ ...mockTrip }}
        onBack={vi.fn()}
        onUpdateTrip={handleUpdateTrip}
      />
    );

    // Target day should still be the chosen '2026-07-03' and not reset
    expect(select.value).toBe('2026-07-03');
  });

  it('displays drag-and-drop location reordering visual clues in the correct positions', () => {
    const handleUpdateTrip = vi.fn();
    const tripWithTwoLocs: Trip = {
      ...mockTrip,
      locations: [
        {
          id: 'loc-paris',
          city: 'Paris',
          country: 'France',
          lat: 48.8566,
          lng: 2.3522,
          places: []
        },
        {
          id: 'loc-london',
          city: 'London',
          country: 'UK',
          lat: 51.5074,
          lng: -0.1278,
          places: []
        }
      ]
    };

    const { container } = render(
      <TripPlanner
        trip={tripWithTwoLocs}
        onBack={vi.fn()}
        onUpdateTrip={handleUpdateTrip}
      />
    );

    // Open Edit Location Settings Modal
    const editLocBtn = container.querySelector('[data-tooltip="Edit Location Settings"]');
    expect(editLocBtn).not.toBeNull();
    fireEvent.click(editLocBtn!);

    // Verify modal is open
    expect(screen.getByText('Edit Location')).toBeInTheDocument();

    // Find the draggable location elements by text
    const ParisRow = screen.getAllByText('Paris, France').find(
      el => el.tagName.toLowerCase() === 'span' && el.closest('[draggable="true"]')
    )?.closest('[draggable="true"]');
    
    const LondonRow = screen.getAllByText('London, UK').find(
      el => el.tagName.toLowerCase() === 'span' && el.closest('[draggable="true"]')
    )?.closest('[draggable="true"]');

    expect(ParisRow).toBeDefined();
    expect(LondonRow).toBeDefined();

    // 1. Drag Paris (index 0) over London (index 1) - dragging DOWN
    fireEvent.dragStart(ParisRow!);
    fireEvent.dragOver(LondonRow!);

    const londonWrapper = LondonRow!.parentElement;
    expect(londonWrapper).toBeDefined();
    
    // Find the line indicator element (the div with background var(--accent-primary))
    const indicatorsDown = Array.from(londonWrapper!.children).filter(
      child => (child as HTMLElement).style.background === 'var(--accent-primary)'
    );
    expect(indicatorsDown.length).toBe(1);
    const lineIndicatorDown = indicatorsDown[0] as HTMLElement;
    expect(lineIndicatorDown.style.bottom).toBe('-5px');
    expect(lineIndicatorDown.style.top).toBe('auto');

    // First end previous drag
    fireEvent.dragEnd(ParisRow!);

    // Start dragging London and hover over Paris
    fireEvent.dragStart(LondonRow!);
    fireEvent.dragOver(ParisRow!);

    const parisWrapper = ParisRow!.parentElement;
    expect(parisWrapper).toBeDefined();
    const indicatorsUp = Array.from(parisWrapper!.children).filter(
      child => (child as HTMLElement).style.background === 'var(--accent-primary)'
    );
    expect(indicatorsUp.length).toBe(1);
    const lineIndicatorUp = indicatorsUp[0] as HTMLElement;
    expect(lineIndicatorUp.style.top).toBe('-5px');
    expect(lineIndicatorUp.style.bottom).toBe('auto');
  });

  it('renders manual checklist and supports drag-and-drop with line indicator positioning', async () => {
    const handleUpdateTrip = vi.fn();
    const handleBack = vi.fn();

    const tripWithChecklist = {
      ...mockTrip,
      plans: [
        {
          ...mockTrip.plans[0],
          manualChecklist: [
            { id: 'todo-1', text: 'Pack bags', completed: false },
            { id: 'todo-2', text: 'Get passport', completed: false },
            { id: 'todo-3', text: 'Buy tickets', completed: false }
          ]
        }
      ]
    };

    render(
      <TripPlanner
        trip={tripWithChecklist}
        onBack={handleBack}
        onUpdateTrip={handleUpdateTrip}
      />
    );

    // Click the Checklist header to expand it
    const checklistHeader = screen.getByText('Checklist');
    fireEvent.click(checklistHeader);

    // Verify task items are rendered
    expect(screen.getByText('Pack bags')).toBeInTheDocument();
    expect(screen.getByText('Get passport')).toBeInTheDocument();
    expect(screen.getByText('Buy tickets')).toBeInTheDocument();

    // Find the draggable items
    const todo1 = screen.getByText('Pack bags').closest('[draggable="true"]');
    const todo2 = screen.getByText('Get passport').closest('[draggable="true"]');
    const todo3 = screen.getByText('Buy tickets').closest('[draggable="true"]');

    expect(todo1).toBeDefined();
    expect(todo2).toBeDefined();
    expect(todo3).toBeDefined();

    // 1. Drag todo-1 (index 0) over todo-2 (index 1) - dragging DOWN
    fireEvent.dragStart(todo1!);
    
    // Re-query elements to ensure we get the updated DOM nodes
    const todo2Active = screen.getByText('Get passport').closest('[draggable="true"]');
    fireEvent.dragOver(todo2Active!);

    // Find the line indicator using waitFor to allow React state updates to commit
    await waitFor(() => {
      const todo2WrapperCurrent = screen.getByText('Get passport').closest('[draggable="true"]')!.parentElement;
      const indicatorsDown = Array.from(todo2WrapperCurrent!.children).filter(
        child => (child as HTMLElement).style.background === 'var(--accent-primary)'
      );
      expect(indicatorsDown.length).toBe(1);
      const lineIndicatorDown = indicatorsDown[0] as HTMLElement;
      expect(lineIndicatorDown.style.bottom).toBe('-5px');
      expect(lineIndicatorDown.style.top).toBe('auto');
    });

    // End drag
    const todo1Active = screen.getByText('Pack bags').closest('[draggable="true"]');
    fireEvent.dragEnd(todo1Active!);

    // 2. Drag todo-3 (index 2) over todo-2 (index 1) - dragging UP
    const todo3Active = screen.getByText('Buy tickets').closest('[draggable="true"]');
    fireEvent.dragStart(todo3Active!);

    const todo2Active2 = screen.getByText('Get passport').closest('[draggable="true"]');
    fireEvent.dragOver(todo2Active2!);

    await waitFor(() => {
      const todo2WrapperCurrent = screen.getByText('Get passport').closest('[draggable="true"]')!.parentElement;
      const indicatorsUp = Array.from(todo2WrapperCurrent!.children).filter(
        child => (child as HTMLElement).style.background === 'var(--accent-primary)'
      );
      expect(indicatorsUp.length).toBe(1);
      const lineIndicatorUp = indicatorsUp[0] as HTMLElement;
      expect(lineIndicatorUp.style.top).toBe('-5px');
      expect(lineIndicatorUp.style.bottom).toBe('auto');
    });

    // End drag and drop
    const todo2Active3 = screen.getByText('Get passport').closest('[draggable="true"]');
    fireEvent.drop(todo2Active3!);
    expect(handleUpdateTrip).toHaveBeenCalled();
  });

  it('closes dropdowns when clicking outside', () => {
    const handleUpdateTrip = vi.fn();
    const handleBack = vi.fn();

    const { container } = render(
      <TripPlanner
        trip={mockTrip}
        onBack={handleBack}
        onUpdateTrip={handleUpdateTrip}
      />
    );

    // Open timeline place dropdown
    const placeOptionsBtns = container.querySelectorAll('[data-tooltip="Place Options"]');
    expect(placeOptionsBtns.length).toBeGreaterThan(0);
    fireEvent.click(placeOptionsBtns[0]);

    // Verify "Edit Place" is visible
    expect(screen.getByText('Edit Place')).toBeInTheDocument();

    // Click outside on the document body
    fireEvent.click(document.body);

    // Verify "Edit Place" is no longer visible
    expect(screen.queryByText('Edit Place')).toBeNull();
  });
});


