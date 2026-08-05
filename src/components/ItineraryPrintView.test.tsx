import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import ItineraryPrintView from './ItineraryPrintView';
import { buildItineraryDocument, DEFAULT_EXPORT_OPTIONS } from '../utils/itineraryDocument';
import type { Trip, Plan } from '../types';

const plan: Plan = {
  id: 'p1',
  name: 'Main Plan',
  startDate: '2026-03-01',
  endDate: '2026-03-01',
  days: {
    '2026-03-01': {
      dateStr: '2026-03-01',
      locationId: 'loc1',
      placeIds: ['place1'],
      scheduleItems: [
        { type: 'hotel-event', hotelId: 'h1', event: 'check-in', time: '15:00' },
        { type: 'place', placeId: 'place1' },
        { type: 'note', id: 'n1', text: 'Buy a Suica card' },
      ],
    },
  },
  hotels: [{ id: 'h1', name: 'Park Hotel', checkInDate: '2026-03-01', checkOutDate: '2026-03-02', confirmationNo: 'H-1' }],
  transports: [],
  manualChecklist: [{ id: 'c1', text: 'Passport', completed: true }],
};

const trip: Trip = {
  id: 't1',
  name: 'Japan 2026',
  startDate: '2026-03-01',
  endDate: '2026-03-01',
  locations: [
    {
      id: 'loc1',
      city: 'Tokyo',
      country: 'Japan',
      lat: 35.6,
      lng: 139.7,
      places: [{ id: 'place1', title: 'Senso-ji', description: 'Ancient temple', lat: 35.7, lng: 139.8, notes: 'Bring coins' }],
    },
  ],
  plans: [plan],
  placeGroups: [],
};

const doc = (options = DEFAULT_EXPORT_OPTIONS) => buildItineraryDocument(trip, plan, options);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ItineraryPrintView', () => {
  it('renders the cover, day schedule, and footer into document.body', () => {
    render(<ItineraryPrintView doc={doc()} onDone={vi.fn()} autoPrint={false} />);

    expect(screen.getByRole('heading', { name: 'Japan 2026', level: 1 })).toBeInTheDocument();
    // Once as a cover destination, once as the day's location header.
    expect(document.querySelector('.print-doc-meta')).toHaveTextContent('Tokyo, Japan');
    expect(document.querySelector('.print-day-location')).toHaveTextContent('Tokyo, Japan');
    expect(screen.getByText('Park Hotel — Check-in')).toBeInTheDocument();
    expect(screen.getByText('15:00')).toBeInTheDocument();
    expect(screen.getByText('Senso-ji')).toBeInTheDocument();
    expect(screen.getByText('Buy a Suica card')).toBeInTheDocument();
    expect(screen.getByText(/Generated .* with Trip Planner/)).toBeInTheDocument();

    // The portal target is <body>, not the container React rendered into.
    expect(document.body.querySelector('.itinerary-print-root')).toBeTruthy();
  });

  it('omits sections that were toggled off', () => {
    render(
      <ItineraryPrintView
        doc={doc({ ...DEFAULT_EXPORT_OPTIONS, includeReservations: false, includeNotes: false })}
        onDone={vi.fn()}
        autoPrint={false}
      />,
    );

    expect(screen.queryByRole('heading', { name: 'Reservations' })).not.toBeInTheDocument();
    expect(screen.queryByText('Bring coins')).not.toBeInTheDocument();
  });

  it('includes the checklist only when the document carries one', () => {
    const { unmount } = render(
      <ItineraryPrintView
        doc={doc({ ...DEFAULT_EXPORT_OPTIONS, includeChecklist: true })}
        onDone={vi.fn()}
        autoPrint={false}
      />,
    );
    expect(screen.getByText('Passport')).toBeInTheDocument();
    unmount();

    render(<ItineraryPrintView doc={doc()} onDone={vi.fn()} autoPrint={false} />);
    expect(screen.queryByText('Passport')).not.toBeInTheDocument();
  });

  it('opens the print dialog on mount and reports back on afterprint', async () => {
    const print = vi.fn();
    vi.stubGlobal('print', print);
    const onDone = vi.fn();

    render(<ItineraryPrintView doc={doc()} onDone={onDone} />);

    await vi.waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    expect(onDone).not.toHaveBeenCalled();

    window.dispatchEvent(new Event('afterprint'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('releases the caller immediately when the environment cannot print', () => {
    vi.stubGlobal('print', undefined);
    const onDone = vi.fn();

    render(<ItineraryPrintView doc={doc()} onDone={onDone} />);

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('releases the caller when window.print throws', async () => {
    vi.stubGlobal('print', () => { throw new Error('blocked'); });
    const onDone = vi.fn();

    render(<ItineraryPrintView doc={doc()} onDone={onDone} />);

    await vi.waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  });
});
