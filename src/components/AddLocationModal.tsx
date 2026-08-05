import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import Modal from './Modal';
import type { Location } from '../types';
import { searchLocation } from '../utils/api';

interface AddLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (locationData: Omit<Location, 'places'>) => void;
  title: string;
}

export default function AddLocationModal({ isOpen, onClose, onSelect, title }: AddLocationModalProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<Omit<Location, 'places'>[]>([]);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSuggestions([]);
    }
  }, [isOpen]);

  // Handle Nominatim search queries with debounce
  useEffect(() => {
    if (!query.trim() || query.length < 3) {
      setSuggestions([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchLocation(query);
        setSuggestions(results);
      } catch (err) {
        console.error('Failed to search locations:', err);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [query]);

  if (!isOpen) return null;

  return (
    <Modal title={title} onClose={onClose}>
        <div className="form-group form-group--relative">
          <label htmlFor="search-city-location">Search City / Location</label>
          <div className="modal-search-container">
            <Search size={14} className="modal-search-icon" />
            <input
              type="text"
              id="search-city-location"
              placeholder="e.g. Rome, Tokyo, New York..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="modal-search-input"
              autoFocus
            />
            {isSearching && (
              <div className="modal-search-loader">Loading...</div>
            )}
          </div>

          {suggestions.length > 0 && (
            <div className="autocomplete-dropdown">
              {suggestions.map(loc => (
                <div
                  key={loc.id}
                  className="autocomplete-item"
                  onClick={() => {
                    onSelect(loc);
                    onClose();
                  }}
                >
                  {loc.city}{loc.state ? `, ${loc.state}` : ''}, {loc.country}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-actions modal-actions--mt40">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
    </Modal>
  );
}
