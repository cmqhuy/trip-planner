import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PlaceSearchBox from './PlaceSearchBox';
import type { Location } from '../types';

vi.mock('../utils/api', () => ({
  parseGoogleMapsUrl: () => ({ isGoogleMapsUrl: false }),
  fetchPlaceFromGoogleMapsUrl: vi.fn(),
  searchPlacesNearLocation: vi.fn(async () => [
    { id: 'p1', title: 'Cafe One', description: 'A nice cafe', lat: 1, lng: 2 },
  ]),
}));

const loc: Location = { id: 'l1', city: 'Paris', country: 'France', lat: 48, lng: 2, places: [] };

describe('PlaceSearchBox', () => {
  it('renders the search input', () => {
    render(<PlaceSearchBox catalogLocation={loc} onSelect={() => {}} />);
    expect(screen.getByPlaceholderText(/Type to search/)).toBeInTheDocument();
  });

  it('mirrors the query via onQueryChange', () => {
    const onQueryChange = vi.fn();
    render(<PlaceSearchBox catalogLocation={loc} onSelect={() => {}} onQueryChange={onQueryChange} />);
    fireEvent.change(screen.getByPlaceholderText(/Type to search/), { target: { value: 'cafe' } });
    expect(onQueryChange).toHaveBeenCalledWith('cafe');
  });

  it('shows debounced suggestions and calls onSelect on click', async () => {
    const onSelect = vi.fn();
    render(<PlaceSearchBox catalogLocation={loc} onSelect={onSelect} />);
    fireEvent.change(screen.getByPlaceholderText(/Type to search/), { target: { value: 'cafe' } });
    await waitFor(() => expect(screen.getByText('Cafe One')).toBeInTheDocument(), { timeout: 2000 });
    fireEvent.click(screen.getByText('Cafe One'));
    expect(onSelect).toHaveBeenCalled();
    expect(onSelect.mock.calls[0][0].title).toBe('Cafe One');
  });
});
