import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ChecklistSection from './ChecklistSection';
import type { Trip } from '../types';

const mockTrip: Trip = {
  id: 'trip-1',
  name: 'Summer Trip',
  startDate: '2026-07-01',
  endDate: '2026-07-03',
  locations: [],
  plans: [
    {
      id: 'plan-main',
      name: 'Main Plan',
      startDate: '2026-07-01',
      endDate: '2026-07-03',
      days: {},
      hotels: [],
      transports: [],
      manualChecklist: [
        { id: 'task-1', text: 'Pack swimsuits', completed: false },
        { id: 'task-2', text: 'Confirm reservation', completed: true }
      ],
      aiDetails: {
        checklist: '### AI Preparation Checklist\n- [ ] Book train tickets\n- [ ] Check weather forecast'
      }
    }
  ],
  placeGroups: []
};

describe('ChecklistSection Component', () => {
  it('renders personal tasks and AI checklist correctly', () => {
    render(
      <ChecklistSection
        trip={mockTrip}
        activePlan={mockTrip.plans[0]}
        generatingChecklist={false}
        onGenerateTripChecklist={vi.fn()}
        onSaveAiChecklist={vi.fn()}
        onUpdateTrip={vi.fn()}
      />
    );

    // Personal tasks check
    expect(screen.getByText('Pack swimsuits')).toBeInTheDocument();
    expect(screen.getByText('Confirm reservation')).toBeInTheDocument();

    // AI checklist check
    expect(screen.getByText('[ ] Book train tickets')).toBeInTheDocument();
    expect(screen.getByText('[ ] Check weather forecast')).toBeInTheDocument();
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
    // Toggle the first checkbox (Pack swimsuits)
    fireEvent.click(checkboxes[0]);

    expect(handleUpdateTrip).toHaveBeenCalled();
  });
});
