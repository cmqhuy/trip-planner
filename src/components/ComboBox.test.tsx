import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Check, Timer } from 'lucide-react';
import { ComboBox, type ComboOption } from './ComboBox';

const OPTIONS: ComboOption<string>[] = [
  { value: 'a', label: 'Alpha', icon: Check },
  { value: 'b', label: 'Beta', icon: Timer },
];

describe('ComboBox', () => {
  it('shows the selected option label on the trigger', () => {
    render(<ComboBox value="b" options={OPTIONS} onChange={() => {}} />);
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('opens the option list on trigger click and selects on click', () => {
    const onChange = vi.fn();
    render(<ComboBox value="a" options={OPTIONS} onChange={onChange} />);
    // list not open initially — only the trigger shows "Alpha"
    expect(screen.getAllByText('Alpha')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button'));
    // now both trigger and the option render "Alpha"
    expect(screen.getAllByText('Alpha').length).toBeGreaterThan(1);
    fireEvent.click(screen.getByText('Beta'));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('does not open when disabled', () => {
    render(<ComboBox value="a" options={OPTIONS} onChange={() => {}} disabled />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getAllByText('Alpha')).toHaveLength(1);
  });
});
