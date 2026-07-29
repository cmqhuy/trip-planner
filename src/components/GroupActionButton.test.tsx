import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Plus } from 'lucide-react';
import GroupActionButton from './GroupActionButton';

describe('GroupActionButton', () => {
  it('icon-only: hides text and uses the label as the tooltip', () => {
    render(<GroupActionButton icon={Plus} label="Add Place" />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('catalog-group-action-btn');
    expect(btn).not.toHaveClass('catalog-group-action-btn--labeled');
    expect(btn).toHaveAttribute('data-tooltip', 'Add Place');
    expect(btn).not.toHaveTextContent('Add Place');
  });

  it('labeled: shows text and no default tooltip', () => {
    render(<GroupActionButton icon={Plus} label="Add" labeled />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('catalog-group-action-btn--labeled');
    expect(btn).toHaveTextContent('Add');
    expect(btn).not.toHaveAttribute('data-tooltip');
  });

  it('labeled with an explicit tooltip keeps both', () => {
    render(<GroupActionButton icon={Plus} label="Import" labeled tooltip="Import via AI" />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveTextContent('Import');
    expect(btn).toHaveAttribute('data-tooltip', 'Import via AI');
  });

  it('fires onClick and honors disabled', () => {
    const onClick = vi.fn();
    const { rerender } = render(<GroupActionButton icon={Plus} label="Add" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
    rerender(<GroupActionButton icon={Plus} label="Add" onClick={onClick} disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
