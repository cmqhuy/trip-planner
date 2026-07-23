import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ChecklistSection from './ChecklistSection';
import type { Trip } from '../types';

const mockTrip: Trip = {
  id: 'trip-1',
  name: 'Summer Trip',
  startDate: '2026-07-01',
  endDate: '2026-07-03',
  locations: [
    { id: 'loc-1', city: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522, places: [] },
    { id: 'loc-2', city: 'Nice', country: 'France', lat: 43.7102, lng: 7.2620, places: [] }
  ],
  plans: [
    {
      id: 'plan-main',
      name: 'Main Plan',
      startDate: '2026-07-01',
      endDate: '2026-07-03',
      days: {
        '2026-07-01': { dateStr: '2026-07-01', locationId: 'loc-1', placeIds: [] },
        '2026-07-02': { dateStr: '2026-07-02', locationId: 'loc-2', placeIds: [] },
        '2026-07-03': { dateStr: '2026-07-03', locationId: 'loc-2', placeIds: [] }
      },
      hotels: [],
      transports: [],
      manualChecklist: [
        { id: 'task-1', text: 'Pack swimsuits and multi-line long checklist description text for testing flex alignment', completed: false },
        { id: 'task-2', text: 'Confirm reservation', completed: true }
      ],
      aiDetails: {
        checklist: '### Recommended Gear\n- [ ] Book train tickets\n- [ ] Check weather forecast'
      }
    }
  ],
  placeGroups: []
};

describe('ChecklistSection Component', () => {
  it('renders personal tasks, AI Suggestions header, and auto-computed Reservation Checklist', () => {
    render(
      <ChecklistSection
        trip={mockTrip}
        activePlan={mockTrip.plans[0]}
        generatingChecklist={false}
        onGenerateTripChecklist={vi.fn()}
        onSaveAiChecklist={vi.fn()}
        onUpdateTrip={vi.fn()}
        daysList={['2026-07-01', '2026-07-02', '2026-07-03']}
        formatDisplayDate={(d) => d}
      />
    );

    // Personal tasks check
    expect(screen.getByText(/Pack swimsuits and multi-line long checklist description/)).toBeInTheDocument();
    expect(screen.getByText('Confirm reservation')).toBeInTheDocument();

    // AI Suggestions header check
    expect(screen.getByRole('heading', { name: 'AI Suggestions' })).toBeInTheDocument();
    expect(screen.getByText('[ ] Book train tickets')).toBeInTheDocument();
    expect(screen.getByText('[ ] Check weather forecast')).toBeInTheDocument();

    // Reservation Checklist (App Generated) section check for missing hotel and transit warnings
    expect(screen.getByRole('heading', { name: 'Reservation Checklist (App Generated)' })).toBeInTheDocument();
    expect(screen.getByText(/No hotels booked for/)).toBeInTheDocument();
    expect(screen.getByText(/No transit from Paris to Nice/)).toBeInTheDocument();
  });

  it('hides Reservation Checklist (App Generated) section when all warnings are resolved', () => {
    const cleanPlan = {
      ...mockTrip.plans[0],
      days: {
        '2026-07-01': { dateStr: '2026-07-01', locationId: 'loc-1', noHotel: true, placeIds: [] },
        '2026-07-02': { dateStr: '2026-07-02', locationId: 'loc-1', noHotel: true, placeIds: [] },
        '2026-07-03': { dateStr: '2026-07-03', locationId: 'loc-1', noHotel: true, placeIds: [] }
      }
    };

    render(
      <ChecklistSection
        trip={mockTrip}
        activePlan={cleanPlan}
        generatingChecklist={false}
        onGenerateTripChecklist={vi.fn()}
        onSaveAiChecklist={vi.fn()}
        onUpdateTrip={vi.fn()}
        daysList={['2026-07-01', '2026-07-02', '2026-07-03']}
        formatDisplayDate={(d) => d}
      />
    );

    // Section header should NOT be present when no warnings exist
    expect(screen.queryByRole('heading', { name: 'Reservation Checklist (App Generated)' })).not.toBeInTheDocument();
  });

  it('allows adding a new manual task', () => {
    const handleUpdateTrip = vi.fn();

    render(
      <ChecklistSection
        trip={mockTrip}
        activePlan={mockTrip.plans[0]}
        generatingChecklist={false}
        onGenerateTripChecklist={vi.fn()}
        onSaveAiChecklist={vi.fn()}
        onUpdateTrip={handleUpdateTrip}
      />
    );

    const input = screen.getByPlaceholderText('Add new task...');
    const addBtn = screen.getByRole('button', { name: 'Add' });

    fireEvent.change(input, { target: { value: 'Buy sunscreen' } });
    fireEvent.click(addBtn);

    expect(handleUpdateTrip).toHaveBeenCalled();
  });

  it('allows editing an existing checklist task', () => {
    const handleUpdateTrip = vi.fn();

    render(
      <ChecklistSection
        trip={mockTrip}
        activePlan={mockTrip.plans[0]}
        generatingChecklist={false}
        onGenerateTripChecklist={vi.fn()}
        onSaveAiChecklist={vi.fn()}
        onUpdateTrip={handleUpdateTrip}
      />
    );

    const taskText = screen.getByText('Confirm reservation');
    fireEvent.doubleClick(taskText);

    const textarea = screen.getByDisplayValue('Confirm reservation');
    fireEvent.change(textarea, { target: { value: 'Confirm hotel reservation' } });
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

    expect(handleUpdateTrip).toHaveBeenCalled();
  });

  it('triggers updates when toggling checklist tasks', () => {
    const handleUpdateTrip = vi.fn();

    render(
      <ChecklistSection
        trip={mockTrip}
        activePlan={mockTrip.plans[0]}
        generatingChecklist={false}
        onGenerateTripChecklist={vi.fn()}
        onSaveAiChecklist={vi.fn()}
        onUpdateTrip={handleUpdateTrip}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    // Toggle the first checkbox
    fireEvent.click(checkboxes[0]);

    expect(handleUpdateTrip).toHaveBeenCalled();
  });
});
