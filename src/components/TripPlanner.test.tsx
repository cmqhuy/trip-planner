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
          placeIds: ['place-eiffel', 'place-louvre'],
          scheduleItems: [
            { type: 'place', placeId: 'place-eiffel' },
            { type: 'place', placeId: 'place-louvre' }
          ]
        },
        '2026-07-02': {
          dateStr: '2026-07-02',
          placeIds: [],
          scheduleItems: []
        },
        '2026-07-03': {
          dateStr: '2026-07-03',
          placeIds: [],
          scheduleItems: []
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

    expect(screen.getByRole('heading', { name: 'Move Day', level: 3 })).toBeInTheDocument();

    // Open the dropdown combo box and select Day 2
    const trigger = screen.getByRole('button', { name: 'Select Destination Day' });
    fireEvent.click(trigger);

    // Find and click the option button for Day 2
    const options = container.querySelectorAll('button.combo-option');
    const option = Array.from(options).find(opt => opt.textContent?.includes('Day 2'));
    expect(option).toBeDefined();
    fireEvent.click(option!);

    // Click "Move Day" button
    const confirmBtn = screen.getByRole('button', { name: 'Move Day' });
    fireEvent.click(confirmBtn);

    // Click "Move Day" button inside the styled confirmation modal
    const moveDayBtn2 = screen.getByRole('button', { name: 'Move Day' });
    fireEvent.click(moveDayBtn2);

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

  it('allows swapping day contents between two days', () => {
    const handleUpdateTrip = vi.fn();
    const handleBack = vi.fn();

    // Prepare a custom mock trip where Day 2 also has data to check that swap is bidirectional
    const customMockTrip: Trip = {
      ...mockTrip,
      plans: [
        {
          ...mockTrip.plans[0],
          days: {
            ...mockTrip.plans[0].days,
            '2026-07-02': {
              dateStr: '2026-07-02',
              locationId: 'loc-paris',
              placeIds: ['place-louvre'],
              scheduleItems: [
                { type: 'place', placeId: 'place-louvre' }
              ],
              noHotel: true
            }
          }
        }
      ]
    };

    const { container } = render(
      <TripPlanner
        trip={customMockTrip}
        onBack={handleBack}
        onUpdateTrip={handleUpdateTrip}
      />
    );

    // Open Day Options dropdown
    const dayOptionsBtn = container.querySelector('[data-tooltip="Day Options"]');
    expect(dayOptionsBtn).toBeDefined();
    fireEvent.click(dayOptionsBtn!);

    // Click Swap Days button
    const swapDaysBtn = screen.getByRole('button', { name: /Swap Days/i });
    fireEvent.click(swapDaysBtn);

    expect(screen.getByRole('heading', { name: 'Swap Days', level: 3 })).toBeInTheDocument();

    // Open the dropdown combo box and select Day 2
    const trigger = screen.getByRole('button', { name: 'Select Day to Swap With' });
    fireEvent.click(trigger);

    // Find and click the option button for Day 2
    const options = container.querySelectorAll('button.combo-option');
    const option = Array.from(options).find(opt => opt.textContent?.includes('Day 2'));
    expect(option).toBeDefined();
    fireEvent.click(option!);

    // Click "Swap Days" button
    const confirmBtn = screen.getByRole('button', { name: 'Swap Days' });
    fireEvent.click(confirmBtn);

    // Click "Swap Days" button inside the styled confirmation modal
    const swapDaysBtn2 = screen.getByRole('button', { name: 'Swap Days' });
    fireEvent.click(swapDaysBtn2);

    expect(handleUpdateTrip).toHaveBeenCalled();
    const updatedTrip = handleUpdateTrip.mock.calls[0][0] as Trip;
    
    // Day 1 should now have Day 2's contents (Louvre and noHotel=true)
    expect(updatedTrip.plans[0].days['2026-07-01'].placeIds).toEqual(['place-louvre']);
    expect(updatedTrip.plans[0].days['2026-07-01'].noHotel).toBe(true);

    // Day 2 should now have Day 1's contents (Eiffel and Louvre, and no noHotel)
    expect(updatedTrip.plans[0].days['2026-07-02'].placeIds).toEqual([
      'place-eiffel',
      'place-louvre'
    ]);
    expect(updatedTrip.plans[0].days['2026-07-02'].noHotel).toBeUndefined();
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
    const timelineCard = container.querySelector('.timeline-card');
    const placeOptionsBtn = timelineCard?.querySelector('[data-tooltip="Place Options"]');
    expect(placeOptionsBtn).toBeDefined();
    fireEvent.click(placeOptionsBtn!);

    // Find and click the edit button for "Eiffel Tower" inside the day schedule
    const editPlaceBtns = container.querySelectorAll('[data-tooltip="Edit Place"]');
    expect(editPlaceBtns.length).toBeGreaterThan(0);
    fireEvent.click(editPlaceBtns[0]); // first one is Eiffel Tower

    // Verify Edit modal is shown
    expect(screen.getByText('Edit Place Details')).toBeInTheDocument();

    // Click "Delete" button in Edit Place Modal
    const deleteBtn = screen.getByRole('button', { name: /^Delete$/i });
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

    const trigger = screen.getByRole('button', { name: 'Select Destination Day' });
    expect(trigger).toHaveTextContent(/Day 2/); // defaults to first available

    // Change target day
    fireEvent.click(trigger);
    const options = container.querySelectorAll('button.combo-option');
    const optionDay3 = Array.from(options).find(opt => opt.textContent?.includes('Day 3'));
    expect(optionDay3).toBeDefined();
    fireEvent.click(optionDay3!);
    expect(trigger).toHaveTextContent(/Day 3/);

    // Trigger parent rerender by supplying a new trip prop object reference
    rerender(
      <TripPlanner
        trip={{ ...mockTrip }}
        onBack={vi.fn()}
        onUpdateTrip={handleUpdateTrip}
      />
    );

    // Target day should still be the chosen 'Day 3' and not reset
    const triggerAfter = screen.getByRole('button', { name: 'Select Destination Day' });
    expect(triggerAfter).toHaveTextContent(/Day 3/);
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

    // The location reorder list is a dnd-kit sortable, not an HTML5 draggable —
    // the old markup never fired on touch, so this list could not be reordered
    // on a phone at all.
    const rows = ['Paris, France', 'London, UK'].map(
      label =>
        screen
          .getAllByText(label)
          .find(el => el.closest('.loc-reorder-item'))!
          .closest('.loc-reorder-item') as HTMLElement
    );

    rows.forEach(row => {
      expect(row).toBeTruthy();
      expect(row).toHaveAttribute('role', 'button');
      expect(row).toHaveAttribute('aria-roledescription', 'sortable');
      expect(row.tabIndex).toBe(0);
    });

    // The active location keeps its highlight through the conversion.
    expect(rows[0].className).toContain('loc-reorder-item--active');

    // No HTML5 draggable attributes should remain in the reorder list.
    const list = rows[0].closest('.loc-reorder-container')!;
    expect(list.querySelectorAll('[draggable="true"]').length).toBe(0);

    // Space lifts the row, proving the keyboard sensor is wired. The drop itself
    // needs real layout for collision detection, which jsdom lacks — the index
    // math is covered by resolveReorder/moveItem in SortableList.test.tsx.
    rows[0].focus();
    fireEvent.keyDown(rows[0], { key: ' ', code: 'Space' });
    expect(rows[0]).toHaveAttribute('aria-pressed', 'true');
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

    // Checklist rows are dnd-kit sortables, not HTML5 `draggable` nodes — the old
    // markup never fired on touch. Each row is a real keyboard-operable control.
    const rows = ['Pack bags', 'Get passport', 'Buy tickets'].map(
      label => screen.getByText(label).closest('.checklist-item-row') as HTMLElement
    );
    rows.forEach(row => {
      expect(row).toBeTruthy();
      expect(row).toHaveAttribute('role', 'button');
      expect(row).toHaveAttribute('aria-roledescription', 'sortable');
      // Focusable => reachable by keyboard and by assistive tech.
      expect(row.tabIndex).toBe(0);
    });

    // No `draggable` attributes should survive anywhere in the checklist.
    const checklistRoot = rows[0].closest('.subsection-content')!;
    expect(checklistRoot.querySelectorAll('[draggable="true"]').length).toBe(0);

    // Space lifts the item — proves the keyboard sensor is actually wired up, which
    // is the capability HTML5 drag-and-drop never had.
    rows[0].focus();
    fireEvent.keyDown(rows[0], { key: ' ', code: 'Space' });
    await waitFor(() => {
      expect(rows[0]).toHaveAttribute('aria-pressed', 'true');
    });

    // The drop itself needs real layout for dnd-kit's collision detection, which
    // jsdom does not provide. The resulting index math is covered by
    // resolveReorder in SortableList.test.tsx; the gesture is verified on device.
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
    const timelineCard = container.querySelector('.timeline-card');
    const placeOptionsBtn = timelineCard?.querySelector('[data-tooltip="Place Options"]');
    expect(placeOptionsBtn).toBeDefined();
    fireEvent.click(placeOptionsBtn!);

    // Verify "Edit Place" is visible
    expect(screen.getByText('Edit Place')).toBeInTheDocument();

    // Click outside on the document body
    fireEvent.click(document.body);

    // Verify "Edit Place" is no longer visible
    expect(screen.queryByText('Edit Place')).toBeNull();
  });

  it('automatically selects today if today is within the trip dates', () => {
    vi.useFakeTimers();
    // July 2, 2026 is Day 2 of mockTrip
    const date = new Date(2026, 6, 2, 12, 0, 0);
    vi.setSystemTime(date);

    // Clear URL day param so it defaults to today
    window.history.pushState({}, '', '?plan=plan-main');

    const handleUpdateTrip = vi.fn();
    const handleBack = vi.fn();

    const { container } = render(
      <TripPlanner
        trip={mockTrip}
        onBack={handleBack}
        onUpdateTrip={handleUpdateTrip}
      />
    );

    const tabs = container.querySelectorAll('.day-tab');
    expect(tabs[1].classList.contains('active')).toBe(true);
    expect(tabs[0].classList.contains('active')).toBe(false);

    vi.useRealTimers();
  });

  it('defaults to Day 1 if today is not within the trip dates', () => {
    vi.useFakeTimers();
    // August 1, 2026 is outside mockTrip (July 1 - July 3)
    const date = new Date(2026, 7, 1, 12, 0, 0);
    vi.setSystemTime(date);

    // Clear URL day param so it defaults to first day
    window.history.pushState({}, '', '?plan=plan-main');

    const handleUpdateTrip = vi.fn();
    const handleBack = vi.fn();

    const { container } = render(
      <TripPlanner
        trip={mockTrip}
        onBack={handleBack}
        onUpdateTrip={handleUpdateTrip}
      />
    );

    const tabs = container.querySelectorAll('.day-tab');
    expect(tabs[0].classList.contains('active')).toBe(true);

    vi.useRealTimers();
  });

  it('honors the day parameter from URL even if today is within the trip dates', () => {
    vi.useFakeTimers();
    // July 2, 2026 is today
    const date = new Date(2026, 6, 2, 12, 0, 0);
    vi.setSystemTime(date);

    // URL asks for July 3
    window.history.pushState({}, '', '?plan=plan-main&day=2026-07-03');

    const handleUpdateTrip = vi.fn();
    const handleBack = vi.fn();

    const { container } = render(
      <TripPlanner
        trip={mockTrip}
        onBack={handleBack}
        onUpdateTrip={handleUpdateTrip}
      />
    );

    const tabs = container.querySelectorAll('.day-tab');
    expect(tabs[2].classList.contains('active')).toBe(true);

    vi.useRealTimers();
  });
});

// ─── Day operations with hotel/transit events ─────────────────────────────────
// These tests verify that Move Day, Swap Days, and Clear Day handle the new
// hotel-event and transit-event ScheduleItem types correctly.

describe('Day operations with hotel/transit events', () => {
  beforeEach(() => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    window.history.pushState({}, '', '?plan=plan-main&day=2026-07-01');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // Shared trip fixture: Day 1 has a place + hotel check-in event; Day 2 has a place + transit departure event.
  const tripWithEvents: Trip = {
    id: 'trip-events',
    name: 'Events Trip',
    startDate: '2026-07-01',
    endDate: '2026-07-02',
    locations: [
      {
        id: 'loc-paris',
        city: 'Paris',
        country: 'France',
        lat: 48.8566,
        lng: 2.3522,
        places: [
          { id: 'place-eiffel', title: 'Eiffel Tower', description: '', lat: 48.8584, lng: 2.2945, notes: '' },
          { id: 'place-louvre', title: 'Louvre Museum', description: '', lat: 48.8606, lng: 2.3376, notes: '' },
        ],
      },
    ],
    plans: [
      {
        id: 'plan-main',
        name: 'Main Plan',
        startDate: '2026-07-01',
        endDate: '2026-07-02',
        days: {
          '2026-07-01': {
            dateStr: '2026-07-01',
            locationId: 'loc-paris',
            placeIds: ['place-eiffel'],
            scheduleItems: [
              { type: 'hotel-event', hotelId: 'hotel-1', event: 'check-in', time: '15:00' },
              { type: 'place', placeId: 'place-eiffel' },
            ],
          },
          '2026-07-02': {
            dateStr: '2026-07-02',
            locationId: 'loc-paris',
            placeIds: ['place-louvre'],
            scheduleItems: [
              { type: 'transit-event', reservationId: 'res-1', segmentIndex: 0, event: 'departure', time: '09:00' },
              { type: 'place', placeId: 'place-louvre' },
            ],
          },
        },
        hotels: [
          {
            id: 'hotel-1',
            name: 'Grand Hotel',
            checkInDate: '2026-07-01',
            checkOutDate: '2026-07-02',
            checkInTime: '15:00',
            checkOutTime: '11:00',
          },
        ],
        transports: [
          {
            id: 'res-1',
            type: 'flight',
            name: 'Air France AF123',
            segments: [
              {
                id: 'seg-1',
                departureLocationName: 'Paris CDG',
                departureDate: '2026-07-02',
                departureTime: '09:00',
                departureTimezone: 'Europe/Paris',
                arrivalLocationName: 'London LHR',
                arrivalDate: '2026-07-02',
                arrivalTime: '10:00',
                arrivalTimezone: 'Europe/London',
              },
            ],
          },
        ],
      },
    ],
    placeGroups: [],
  };

  it('Move Day: source day keeps its hotel-event; destination day keeps its transit-event; only places transfer', () => {
    const handleUpdateTrip = vi.fn();
    const { container } = render(
      <TripPlanner trip={tripWithEvents} onBack={vi.fn()} onUpdateTrip={handleUpdateTrip} />
    );

    // Open Day Options on Day 1
    fireEvent.click(container.querySelector('[data-tooltip="Day Options"]')!);
    fireEvent.click(screen.getByRole('button', { name: /Move Day/i }));

    // Select Day 2 as destination
    fireEvent.click(screen.getByRole('button', { name: 'Select Destination Day' }));
    const opt = Array.from(container.querySelectorAll('button.combo-option')).find(b => b.textContent?.includes('Day 2'));
    fireEvent.click(opt!);

    // Confirm twice (modal + confirmation dialog)
    fireEvent.click(screen.getByRole('button', { name: 'Move Day' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move Day' }));

    expect(handleUpdateTrip).toHaveBeenCalled();
    const updated = handleUpdateTrip.mock.calls[0][0] as Trip;
    const day1 = updated.plans[0].days['2026-07-01'];
    const day2 = updated.plans[0].days['2026-07-02'];

    // Day 1 source: place moved away, hotel-event stays
    expect(day1.placeIds).toEqual([]);
    expect(day1.scheduleItems?.some(i => i.type === 'hotel-event')).toBe(true);
    expect(day1.scheduleItems?.some(i => i.type === 'place')).toBe(false);

    // Day 2 destination: receives Day 1's place, keeps its own transit-event
    expect(day2.placeIds).toContain('place-eiffel');
    expect(day2.scheduleItems?.some(i => i.type === 'transit-event')).toBe(true);
    // Day 2 should NOT receive Day 1's hotel-event
    expect(day2.scheduleItems?.filter(i => i.type === 'hotel-event').length).toBe(0);
  });

  it('Swap Days: each day keeps its own reservation events; places are exchanged', () => {
    const handleUpdateTrip = vi.fn();
    const { container } = render(
      <TripPlanner trip={tripWithEvents} onBack={vi.fn()} onUpdateTrip={handleUpdateTrip} />
    );

    fireEvent.click(container.querySelector('[data-tooltip="Day Options"]')!);
    fireEvent.click(screen.getByRole('button', { name: /Swap Days/i }));

    fireEvent.click(screen.getByRole('button', { name: 'Select Day to Swap With' }));
    const opt = Array.from(container.querySelectorAll('button.combo-option')).find(b => b.textContent?.includes('Day 2'));
    fireEvent.click(opt!);

    fireEvent.click(screen.getByRole('button', { name: 'Swap Days' }));
    fireEvent.click(screen.getByRole('button', { name: 'Swap Days' }));

    expect(handleUpdateTrip).toHaveBeenCalled();
    const updated = handleUpdateTrip.mock.calls[0][0] as Trip;
    const day1 = updated.plans[0].days['2026-07-01'];
    const day2 = updated.plans[0].days['2026-07-02'];

    // Day 1 now has Day 2's place (Louvre), but keeps its own hotel-event
    expect(day1.placeIds).toEqual(['place-louvre']);
    expect(day1.scheduleItems?.some(i => i.type === 'hotel-event')).toBe(true);
    expect(day1.scheduleItems?.some(i => i.type === 'transit-event')).toBe(false);

    // Day 2 now has Day 1's place (Eiffel), but keeps its own transit-event
    expect(day2.placeIds).toEqual(['place-eiffel']);
    expect(day2.scheduleItems?.some(i => i.type === 'transit-event')).toBe(true);
    expect(day2.scheduleItems?.some(i => i.type === 'hotel-event')).toBe(false);
  });

  it('Clear Day: removes hotel-event AND place items from the active day', () => {
    const handleUpdateTrip = vi.fn();
    const { container } = render(
      <TripPlanner trip={tripWithEvents} onBack={vi.fn()} onUpdateTrip={handleUpdateTrip} />
    );

    fireEvent.click(container.querySelector('[data-tooltip="Day Options"]')!);
    fireEvent.click(screen.getByRole('button', { name: /Clear Day/i }));

    const clearModal = screen.getByRole('heading', { name: 'Clear Day', level: 3 }).closest('.modal-content');
    fireEvent.click(clearModal!.querySelector('button.btn-primary')!);

    expect(handleUpdateTrip).toHaveBeenCalled();
    const updated = handleUpdateTrip.mock.calls[0][0] as Trip;
    const day1 = updated.plans[0].days['2026-07-01'];

    expect(day1.placeIds).toEqual([]);
    expect(day1.scheduleItems ?? []).toHaveLength(0);
  });

  it('Move Day baseline: without reservation events, place/note items transfer normally', () => {
    // Sanity check: operations without hotel/transit events work as before.
    const baseTrip: Trip = {
      ...tripWithEvents,
      plans: [
        {
          ...tripWithEvents.plans[0],
          days: {
            '2026-07-01': {
              dateStr: '2026-07-01',
              locationId: 'loc-paris',
              placeIds: ['place-eiffel'],
              scheduleItems: [{ type: 'place', placeId: 'place-eiffel' }],
            },
            '2026-07-02': {
              dateStr: '2026-07-02',
              placeIds: [],
              scheduleItems: [],
            },
          },
        },
      ],
    };

    const handleUpdateTrip = vi.fn();
    const { container } = render(
      <TripPlanner trip={baseTrip} onBack={vi.fn()} onUpdateTrip={handleUpdateTrip} />
    );

    fireEvent.click(container.querySelector('[data-tooltip="Day Options"]')!);
    fireEvent.click(screen.getByRole('button', { name: /Move Day/i }));

    fireEvent.click(screen.getByRole('button', { name: 'Select Destination Day' }));
    const opt = Array.from(container.querySelectorAll('button.combo-option')).find(b => b.textContent?.includes('Day 2'));
    fireEvent.click(opt!);

    fireEvent.click(screen.getByRole('button', { name: 'Move Day' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move Day' }));

    expect(handleUpdateTrip).toHaveBeenCalled();
    const updated = handleUpdateTrip.mock.calls[0][0] as Trip;
    expect(updated.plans[0].days['2026-07-01'].placeIds).toEqual([]);
    expect(updated.plans[0].days['2026-07-02'].placeIds).toEqual(['place-eiffel']);
    expect(updated.plans[0].days['2026-07-02'].scheduleItems?.some(i => i.type === 'place')).toBe(true);
  });

  it('Swap Days baseline: without reservation events, place items exchange normally', () => {
    const baseTrip: Trip = {
      ...tripWithEvents,
      plans: [
        {
          ...tripWithEvents.plans[0],
          days: {
            '2026-07-01': {
              dateStr: '2026-07-01',
              locationId: 'loc-paris',
              placeIds: ['place-eiffel'],
              scheduleItems: [{ type: 'place', placeId: 'place-eiffel' }],
            },
            '2026-07-02': {
              dateStr: '2026-07-02',
              placeIds: ['place-louvre'],
              scheduleItems: [{ type: 'place', placeId: 'place-louvre' }],
            },
          },
        },
      ],
    };

    const handleUpdateTrip = vi.fn();
    const { container } = render(
      <TripPlanner trip={baseTrip} onBack={vi.fn()} onUpdateTrip={handleUpdateTrip} />
    );

    fireEvent.click(container.querySelector('[data-tooltip="Day Options"]')!);
    fireEvent.click(screen.getByRole('button', { name: /Swap Days/i }));

    fireEvent.click(screen.getByRole('button', { name: 'Select Day to Swap With' }));
    const opt = Array.from(container.querySelectorAll('button.combo-option')).find(b => b.textContent?.includes('Day 2'));
    fireEvent.click(opt!);

    fireEvent.click(screen.getByRole('button', { name: 'Swap Days' }));
    fireEvent.click(screen.getByRole('button', { name: 'Swap Days' }));

    expect(handleUpdateTrip).toHaveBeenCalled();
    const updated = handleUpdateTrip.mock.calls[0][0] as Trip;
    expect(updated.plans[0].days['2026-07-01'].placeIds).toEqual(['place-louvre']);
    expect(updated.plans[0].days['2026-07-02'].placeIds).toEqual(['place-eiffel']);
  });

  it('Clear Day baseline: without reservation events, all schedule items are removed', () => {
    const baseTrip: Trip = {
      ...tripWithEvents,
      plans: [
        {
          ...tripWithEvents.plans[0],
          days: {
            '2026-07-01': {
              dateStr: '2026-07-01',
              locationId: 'loc-paris',
              placeIds: ['place-eiffel'],
              scheduleItems: [
                { type: 'note', id: 'note-1', text: 'Check-in note' },
                { type: 'place', placeId: 'place-eiffel' },
              ],
            },
            '2026-07-02': { dateStr: '2026-07-02', placeIds: [], scheduleItems: [] },
          },
        },
      ],
    };

    const handleUpdateTrip = vi.fn();
    const { container } = render(
      <TripPlanner trip={baseTrip} onBack={vi.fn()} onUpdateTrip={handleUpdateTrip} />
    );

    fireEvent.click(container.querySelector('[data-tooltip="Day Options"]')!);
    fireEvent.click(screen.getByRole('button', { name: /Clear Day/i }));

    const clearModal = screen.getByRole('heading', { name: 'Clear Day', level: 3 }).closest('.modal-content');
    fireEvent.click(clearModal!.querySelector('button.btn-primary')!);

    expect(handleUpdateTrip).toHaveBeenCalled();
    const updated = handleUpdateTrip.mock.calls[0][0] as Trip;
    expect(updated.plans[0].days['2026-07-01'].placeIds).toEqual([]);
    expect(updated.plans[0].days['2026-07-01'].scheduleItems ?? []).toHaveLength(0);
  });

  it('exports the itinerary: header button → dialog → print view → print dialog', async () => {
    const print = vi.fn();
    vi.stubGlobal('print', print);

    const { container } = render(
      <TripPlanner trip={mockTrip} onBack={vi.fn()} onUpdateTrip={vi.fn()} />
    );

    fireEvent.click(container.querySelector('[data-tooltip="Export Itinerary as PDF"]')!);
    expect(screen.getByRole('heading', { name: /Export Itinerary/i, level: 3 })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Save as PDF/i }));

    // The dialog closes and the printable document takes its place.
    expect(screen.queryByRole('heading', { name: /Export Itinerary/i, level: 3 })).not.toBeInTheDocument();
    const printRoot = document.body.querySelector('.itinerary-print-root')!;
    expect(printRoot).toBeTruthy();
    expect(printRoot).toHaveTextContent('Summer in Europe');
    expect(printRoot).toHaveTextContent('Eiffel Tower');
    expect(printRoot).toHaveTextContent('Louvre Museum');

    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));

    // Closing the print dialog tears the document back down.
    window.dispatchEvent(new Event('afterprint'));
    await waitFor(() => expect(document.body.querySelector('.itinerary-print-root')).toBeNull());
  });
});
