import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { InlineNotes } from './InlineNotes';

describe('InlineNotes', () => {
  it('renders saved value in card layout read view', () => {
    render(<InlineNotes value="Bring passport" canEdit onSave={() => {}} />);
    expect(screen.getByText('Bring passport')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
  });

  it('shows the default empty placeholder per layout', () => {
    const { rerender } = render(<InlineNotes canEdit onSave={() => {}} layout="card" />);
    expect(screen.getByText('No notes added yet.')).toBeInTheDocument();
    rerender(<InlineNotes canEdit onSave={() => {}} layout="compact" />);
    expect(screen.getByText('Add notes...')).toBeInTheDocument();
  });

  it('honors a custom emptyText', () => {
    render(<InlineNotes canEdit onSave={() => {}} emptyText="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('edits and saves the drafted text (card layout)', () => {
    const onSave = vi.fn();
    render(<InlineNotes value="old" canEdit onSave={onSave} />);
    fireEvent.click(screen.getByLabelText('Edit notes'));
    const textarea = screen.getByPlaceholderText('Add notes...') as HTMLTextAreaElement;
    expect(textarea.value).toBe('old');
    fireEvent.change(textarea, { target: { value: 'new note' } });
    fireEvent.click(screen.getByText('Save Notes'));
    expect(onSave).toHaveBeenCalledWith('new note');
  });

  it('cancel discards the draft without calling onSave', () => {
    const onSave = vi.fn();
    render(<InlineNotes value="keep" canEdit onSave={onSave} />);
    fireEvent.click(screen.getByLabelText('Edit notes'));
    fireEvent.change(screen.getByPlaceholderText('Add notes...'), { target: { value: 'changed' } });
    fireEvent.click(screen.getByText('Cancel'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('keep')).toBeInTheDocument();
  });

  it('compact layout enters edit on click and saves', () => {
    const onSave = vi.fn();
    render(<InlineNotes value="hi" canEdit onSave={onSave} layout="compact" />);
    fireEvent.click(screen.getByText('hi'));
    fireEvent.change(screen.getByPlaceholderText('Add notes...'), { target: { value: 'edited' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith('edited');
  });

  it('does not expose an edit affordance when canEdit is false', () => {
    render(<InlineNotes value="readonly" canEdit={false} onSave={() => {}} />);
    expect(screen.queryByLabelText('Edit notes')).not.toBeInTheDocument();
  });

  it('compact read view is not clickable when canEdit is false', () => {
    const onSave = vi.fn();
    render(<InlineNotes value="ro" canEdit={false} onSave={onSave} layout="compact" />);
    fireEvent.click(screen.getByText('ro'));
    expect(screen.queryByPlaceholderText('Add notes...')).not.toBeInTheDocument();
  });
});
