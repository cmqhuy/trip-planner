import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GroupOptionsMenu from './GroupOptionsMenu';

// The trigger is the only button while the menu is closed.
const openMenu = () => fireEvent.click(screen.getByRole('button'));

describe('GroupOptionsMenu', () => {
  it('opens on trigger click and renders only the provided items', () => {
    render(<GroupOptionsMenu onMoveUp={() => {}} onEdit={() => {}} />);
    openMenu();
    expect(screen.getByText('Move Up')).toBeInTheDocument();
    expect(screen.queryByText('Move Down')).not.toBeInTheDocument();
    expect(screen.getByText('Edit Group')).toBeInTheDocument();
  });

  it('calls the handler and closes on item click', () => {
    const onMoveUp = vi.fn();
    render(<GroupOptionsMenu onMoveUp={onMoveUp} />);
    openMenu();
    fireEvent.click(screen.getByText('Move Up'));
    expect(onMoveUp).toHaveBeenCalledOnce();
    expect(screen.queryByText('Move Up')).not.toBeInTheDocument();
  });

  it('respects a custom edit label and renders extra items with a close fn', () => {
    render(
      <GroupOptionsMenu
        onEdit={() => {}}
        editLabel="Edit Category"
        extraItems={(close) => (
          <button className="dropdown-item" onClick={close}>Hide on map</button>
        )}
      />
    );
    openMenu();
    expect(screen.getByText('Edit Category')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Hide on map'));
    // extra item's close() dismissed the menu
    expect(screen.queryByText('Edit Category')).not.toBeInTheDocument();
  });

  it('disables move items when flagged', () => {
    render(<GroupOptionsMenu onMoveUp={() => {}} onMoveDown={() => {}} disableUp disableDown />);
    openMenu();
    expect(screen.getByText('Move Up').closest('button')).toBeDisabled();
    expect(screen.getByText('Move Down').closest('button')).toBeDisabled();
  });
});
