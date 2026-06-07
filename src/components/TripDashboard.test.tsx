import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TripDashboard from './TripDashboard';
import type { Trip } from '../types';

const mockTrips: Trip[] = [
  {
    id: 'trip-1',
    name: 'Summer in Europe',
    startDate: '2026-07-01',
    endDate: '2026-07-10',
    locations: [],
    plans: [],
    placeGroups: []
  }
];

describe('TripDashboard Component', () => {
  it('renders the empty state correctly when no trips are present', () => {
    const handleCreate = vi.fn();
    const handleDelete = vi.fn();
    const handleSelect = vi.fn();

    render(
      <TripDashboard
        trips={[]}
        onCreateTrip={handleCreate}
        onDeleteTrip={handleDelete}
        onSelectTrip={handleSelect}
      />
    );

    expect(screen.getByText('No Trips Planned Yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Plan A Trip' })).toBeInTheDocument();
  });

  it('renders the trips list correctly', () => {
    const handleCreate = vi.fn();
    const handleDelete = vi.fn();
    const handleSelect = vi.fn();

    render(
      <TripDashboard
        trips={mockTrips}
        onCreateTrip={handleCreate}
        onDeleteTrip={handleDelete}
        onSelectTrip={handleSelect}
      />
    );

    expect(screen.getByText('Summer in Europe')).toBeInTheDocument();
    expect(screen.getByText('Jul 1, 2026 - Jul 10, 2026')).toBeInTheDocument();
    expect(screen.getByText('10 days')).toBeInTheDocument();
  });

  it('calls onSelectTrip when a trip card is clicked', () => {
    const handleCreate = vi.fn();
    const handleDelete = vi.fn();
    const handleSelect = vi.fn();

    render(
      <TripDashboard
        trips={mockTrips}
        onCreateTrip={handleCreate}
        onDeleteTrip={handleDelete}
        onSelectTrip={handleSelect}
      />
    );

    const tripCard = screen.getByText('Summer in Europe').closest('.trip-card');
    expect(tripCard).toBeInTheDocument();
    
    fireEvent.click(tripCard!);
    expect(handleSelect).toHaveBeenCalledWith('trip-1');
  });

  it('opens creation modal on New Trip click, validates dates, and calls onCreateTrip', () => {
    const handleCreate = vi.fn();
    const handleDelete = vi.fn();
    const handleSelect = vi.fn();

    render(
      <TripDashboard
        trips={[]}
        onCreateTrip={handleCreate}
        onDeleteTrip={handleDelete}
        onSelectTrip={handleSelect}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Plan A Trip' }));

    expect(screen.getByRole('heading', { name: 'Create Trip', level: 3 })).toBeInTheDocument();

    const nameInput = screen.getByLabelText('Trip Name');
    const startInput = screen.getByLabelText('Start Date');
    const endInput = screen.getByLabelText('End Date');

    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    
    fireEvent.change(nameInput, { target: { value: 'Japan 2026' } });
    fireEvent.change(startInput, { target: { value: '2026-05-15' } });
    fireEvent.change(endInput, { target: { value: '2026-05-10' } }); // end before start
    
    fireEvent.submit(screen.getByRole('button', { name: 'Create Trip' }));
    
    expect(alertSpy).toHaveBeenCalledWith('Start date must be before or equal to end date.');
    expect(handleCreate).not.toHaveBeenCalled();

    // Fix dates and submit
    fireEvent.change(endInput, { target: { value: '2026-05-20' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Create Trip' }));

    expect(handleCreate).toHaveBeenCalledWith({
      name: 'Japan 2026',
      startDate: '2026-05-15',
      endDate: '2026-05-20'
    });

    expect(screen.queryByRole('heading', { name: 'Create Trip', level: 3 })).not.toBeInTheDocument();
    alertSpy.mockRestore();
  });

  it('opens delete confirmation modal and calls onDeleteTrip on confirm', () => {
    const handleCreate = vi.fn();
    const handleDelete = vi.fn();
    const handleSelect = vi.fn();

    render(
      <TripDashboard
        trips={mockTrips}
        onCreateTrip={handleCreate}
        onDeleteTrip={handleDelete}
        onSelectTrip={handleSelect}
      />
    );

    const tripCard = screen.getByText('Summer in Europe').closest('.trip-card');
    const deleteButton = tripCard?.querySelector('.trip-delete-btn');
    expect(deleteButton).toBeInTheDocument();

    fireEvent.click(deleteButton!);

    expect(screen.getByText('Delete Trip')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete "Summer in Europe"? This action cannot be undone.')).toBeInTheDocument();

    const confirmDeleteButton = screen.getAllByRole('button').find(btn => btn.textContent === 'Delete');
    expect(confirmDeleteButton).toBeInTheDocument();

    fireEvent.click(confirmDeleteButton!);

    expect(handleDelete).toHaveBeenCalledWith('trip-1');
    expect(screen.queryByText('Delete Trip')).not.toBeInTheDocument();
  });
});
