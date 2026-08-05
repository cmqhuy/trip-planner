import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ExportItineraryModal from './ExportItineraryModal';
import { DEFAULT_EXPORT_OPTIONS } from '../utils/itineraryDocument';
import type { Plan } from '../types';

const plan = (id: string, name: string): Plan => ({
  id,
  name,
  startDate: '2026-03-01',
  endDate: '2026-03-02',
  days: {},
  hotels: [],
  transports: [],
});

const setup = (props: Partial<React.ComponentProps<typeof ExportItineraryModal>> = {}) => {
  const onExport = vi.fn();
  const onClose = vi.fn();
  render(
    <ExportItineraryModal
      isOpen
      onClose={onClose}
      plans={[plan('p1', 'Main Plan')]}
      activePlanId="p1"
      onExport={onExport}
      {...props}
    />,
  );
  return { onExport, onClose };
};

const saveButton = () => screen.getByRole('button', { name: /save as pdf/i });

describe('ExportItineraryModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ExportItineraryModal
        isOpen={false}
        onClose={vi.fn()}
        plans={[plan('p1', 'Main Plan')]}
        activePlanId="p1"
        onExport={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('exports the active plan with the default sections', () => {
    const { onExport, onClose } = setup();

    fireEvent.click(saveButton());

    expect(onExport).toHaveBeenCalledWith('p1', DEFAULT_EXPORT_OPTIONS);
    expect(onClose).toHaveBeenCalled();
  });

  it('toggling a section is reflected in the exported options', () => {
    const { onExport } = setup();

    fireEvent.click(screen.getByLabelText(/budget totals/i));
    fireEvent.click(screen.getByLabelText(/notes/i));
    fireEvent.click(saveButton());

    expect(onExport).toHaveBeenCalledWith('p1', {
      ...DEFAULT_EXPORT_OPTIONS,
      includeExpenses: true,   // was off
      includeNotes: false,     // was on
    });
  });

  it('hides the plan picker for a single-plan trip', () => {
    setup();
    expect(screen.queryByLabelText(/^plan$/i)).not.toBeInTheDocument();
  });

  it('offers a plan picker when the trip has more than one plan', () => {
    const { onExport } = setup({
      plans: [plan('p1', 'Main Plan'), plan('p2', 'Backup Plan')],
    });

    const trigger = screen.getByLabelText(/^plan$/i);
    expect(trigger).toHaveTextContent('Main Plan');

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: /backup plan/i }));
    fireEvent.click(saveButton());

    expect(onExport).toHaveBeenCalledWith('p2', DEFAULT_EXPORT_OPTIONS);
  });

  it('resets the plan and section choices each time it reopens', () => {
    const onExport = vi.fn();
    const props = {
      onClose: vi.fn(),
      plans: [plan('p1', 'Main Plan')],
      activePlanId: 'p1',
      onExport,
    };
    const { rerender } = render(<ExportItineraryModal isOpen {...props} />);

    fireEvent.click(screen.getByLabelText(/budget totals/i));
    rerender(<ExportItineraryModal isOpen={false} {...props} />);
    rerender(<ExportItineraryModal isOpen {...props} />);
    fireEvent.click(saveButton());

    expect(onExport).toHaveBeenCalledWith('p1', DEFAULT_EXPORT_OPTIONS);
  });
});
