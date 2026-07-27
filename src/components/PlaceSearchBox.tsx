import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import type { Place, Location } from '../types';
import { parseGoogleMapsUrl, fetchPlaceFromGoogleMapsUrl, searchPlacesNearLocation } from '../utils/api';

export interface SearchedPlace {
  title: string;
  address?: string;
  description?: string;
  openingHours?: string;
  lat: number;
  lng: number;
  mapsLink?: string;
  photoUrl?: string;
  notes?: string;
}

interface PlaceSearchBoxProps {
  /** Location the search is scoped to (place suggestions require it). */
  catalogLocation?: Location;
  placeholder?: string;
  /**
   * Fired when the user picks a suggestion or a pasted Google Maps link resolves.
   * `ctx.sourceUrl` is the pasted URL when the result came from a Google Maps link.
   */
  onSelect: (place: SearchedPlace, ctx: { sourceUrl?: string }) => void;
  /** Mirrors the current query (e.g. so a sibling "Fill with AI" button can read it). */
  onQueryChange?: (query: string) => void;
}

type Suggestion = Omit<Place, 'placeGroupId'> & { address?: string };

/**
 * Shared auto-populate search box for place/reservation modals: debounced
 * place-near-location search, Google-Maps-link paste resolution, the suggestion
 * list, and outside-click dismissal. Previously duplicated in HotelModal and
 * PlaceModal. (TransportModal's dual dep/arr panels and LocationModal's city
 * search are intentionally not built on this.)
 */
export default function PlaceSearchBox({
  catalogLocation,
  placeholder = 'Type to search, or paste a Google Maps link...',
  onSelect,
  onQueryChange,
}: PlaceSearchBoxProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const setQuery = (q: string) => { setSearchQuery(q); onQueryChange?.(q); };
  const clear = () => { setSearchQuery(''); setSuggestions([]); onQueryChange?.(''); };

  useEffect(() => {
    setSearchError(null);
    if (!searchQuery.trim() || searchQuery.length < 3) {
      setSuggestions([]);
      return;
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const { isGoogleMapsUrl } = parseGoogleMapsUrl(searchQuery);
    if (isGoogleMapsUrl) {
      setIsSearching(true);
      fetchPlaceFromGoogleMapsUrl(searchQuery, catalogLocation ?? undefined).then(({ place, error }) => {
        setIsSearching(false);
        if (error || !place) {
          setSearchError(error ?? 'Could not extract place info from this link.');
          return;
        }
        onSelect(place, { sourceUrl: searchQuery });
        clear();
      });
      return;
    }

    if (!catalogLocation) {
      setSuggestions([]);
      return;
    }

    timeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        setSuggestions(await searchPlacesNearLocation(searchQuery, catalogLocation));
      } catch (err) {
        console.error('Place search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, catalogLocation]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setSuggestions([]);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <>
      <div className="modal-search-container" ref={containerRef}>
        <Search size={14} className="modal-search-icon" />
        <input
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={e => setQuery(e.target.value)}
          className="modal-search-input"
        />
        {isSearching && <div className="modal-search-loader">Searching...</div>}
        {suggestions.length > 0 && (
          <div className="modal-suggestions-panel">
            {suggestions.map(sug => (
              <div
                key={sug.id}
                className="modal-suggestion-item"
                onClick={() => { onSelect(sug, {}); clear(); }}
              >
                <div className="modal-suggestion-name">{sug.title}</div>
                <div className="modal-suggestion-desc">{sug.address || sug.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {searchError && <div className="modal-search-error">{searchError}</div>}
    </>
  );
}
