import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SortableList from './SortableList';
import { resolveReorder, moveItem } from '../utils/sortable';

/**
 * The drag *gesture* can only be verified on a real device — jsdom has no layout,
 * so dnd-kit's collision detection has nothing to collide with. These tests cover
 * the two things that can silently break in code review instead:
 *   1. the index math that turns a drop into an array move
 *   2. the wiring/a11y contract each consuming component depends on
 */

describe('resolveReorder', () => {
  const ids = ['a', 'b', 'c', 'd'];

  it('resolves a forward move', () => {
    expect(resolveReorder(ids, 'a', 'c')).toEqual({ from: 0, to: 2 });
  });

  it('resolves a backward move', () => {
    expect(resolveReorder(ids, 'd', 'b')).toEqual({ from: 3, to: 1 });
  });

  it('returns null when dropped on itself', () => {
    expect(resolveReorder(ids, 'b', 'b')).toBeNull();
  });

  it('returns null when the drag was cancelled (no over target)', () => {
    expect(resolveReorder(ids, 'b', undefined)).toBeNull();
  });

  it('returns null when an id is no longer in the list', () => {
    expect(resolveReorder(ids, 'b', 'gone')).toBeNull();
    expect(resolveReorder(ids, 'gone', 'b')).toBeNull();
  });

  it('coerces numeric ids, which dnd-kit permits', () => {
    expect(resolveReorder(['1', '2'], 1, 2)).toEqual({ from: 0, to: 1 });
    expect(resolveReorder(['1', '2'], 1, 1)).toBeNull();
  });
});

describe('moveItem', () => {
  it('moves forward and backward without mutating the input', () => {
    const list = ['a', 'b', 'c', 'd'];
    expect(moveItem(list, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(list, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
    expect(list).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('SortableList', () => {
  const items = [
    { id: 'x', label: 'First' },
    { id: 'y', label: 'Second' },
  ];

  const renderList = (disabled = false) =>
    render(
      <SortableList
        items={items}
        getId={i => i.id}
        onReorder={vi.fn()}
        disabled={disabled}
        renderItem={(item, _idx, { handleProps }) => (
          <div className="row" {...handleProps}>
            {item.label}
          </div>
        )}
      />
    );

  it('renders every item', () => {
    renderList();
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('exposes each row as a keyboard-operable sortable, not an HTML5 draggable', () => {
    const { container } = renderList();
    const rows = container.querySelectorAll('.row');
    expect(rows).toHaveLength(2);
    rows.forEach(row => {
      expect(row).toHaveAttribute('role', 'button');
      expect(row).toHaveAttribute('aria-roledescription', 'sortable');
      expect((row as HTMLElement).tabIndex).toBe(0);
    });
    // The old implementation relied on `draggable`, which never fires on touch.
    expect(container.querySelectorAll('[draggable="true"]')).toHaveLength(0);
  });

  it('wraps each item so drag styling has a hook', () => {
    const { container } = renderList();
    expect(container.querySelectorAll('.sortable-item')).toHaveLength(2);
  });

  it('does not lift an item when disabled', () => {
    const { container } = renderList(true);
    const row = container.querySelector('.row') as HTMLElement;
    row.focus();
    fireEvent.keyDown(row, { key: ' ', code: 'Space' });
    // dnd-kit keeps a disabled sortable focusable, but it must not enter a drag.
    expect(row).not.toHaveAttribute('aria-pressed', 'true');
  });

  it('lifts an item when enabled', () => {
    const { container } = renderList(false);
    const row = container.querySelector('.row') as HTMLElement;
    row.focus();
    fireEvent.keyDown(row, { key: ' ', code: 'Space' });
    expect(row).toHaveAttribute('aria-pressed', 'true');
  });
});
