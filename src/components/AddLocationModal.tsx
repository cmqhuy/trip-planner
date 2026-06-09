import { useState, useEffect, useRef } from 'react';
import { X, Search } from 'lucide-react';
import { searchLocation } from '../utils/api';

interface AddLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (locationData: any) => void;
  title: string;
}

export default function AddLocationModal({ isOpen, onClose, onSelect, title }: AddLocationModalProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const searchTimeoutRef = useRef<any>(null);

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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="form-group" style={{ position: 'relative' }}>
          <label htmlFor="search-city-location">Search City / Location</label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              id="search-city-location"
              placeholder="e.g. Rome, Tokyo, New York..." 
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{ paddingLeft: '32px' }}
              autoFocus
            />
            {isSearching && (
              <div style={{ position: 'absolute', right: '10px', top: '12px', fontSize: '10px', color: 'var(--text-muted)' }}>Loading...</div>
            )}
          </div>
          
          {suggestions.length > 0 && (
            <div className="autocomplete-dropdown" style={{ position: 'absolute', width: '100%', top: '100%' }}>
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
        <div className="modal-actions" style={{ marginTop: '40px' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
