import { useState, useEffect, useRef } from 'react';
import { X, Search, Trash2 } from 'lucide-react';
import type { Location } from '../types';
import { searchLocation, getLocIcon, getFormattedLocationName } from '../utils/api';
import LocationFormFields from './LocationFormFields';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: Location;
  allLocations: Location[];
  onSave: (locData: Partial<Location>) => void;
  onDelete: () => void;
  onReorderLocations: (locs: Location[]) => void;
}

export default function LocationModal({
  isOpen,
  onClose,
  location,
  allLocations,
  onSave,
  onDelete,
  onReorderLocations
}: LocationModalProps) {
  // Form fields states
  const [city, setCity] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [country, setCountry] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [color, setColor] = useState('');
  const [lat, setLat] = useState('0');
  const [lng, setLng] = useState('0');
  const [heroPhoto, setHeroPhoto] = useState('');

  // Auto-populate states
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const searchTimeoutRef = useRef<any>(null);

  // Drag and drop states (for reordering the location list)
  const [draggedLocationIndex, setDraggedLocationIndex] = useState<number | null>(null);
  const [dragOverLocationIndex, setDragOverLocationIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && location) {
      setCity(location.city);
      setStateVal(location.state || '');
      setCountry(location.country);
      setCountryCode(location.countryCode || '');
      setColor(location.color || '#6366f1');
      setLat(location.lat.toString());
      setLng(location.lng.toString());
      setHeroPhoto(location.heroPhoto || '');
      setSearchQuery('');
      setSuggestions([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Handle Nominatim geocoding search for auto-populating city details
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 3) {
      setSuggestions([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchLocation(searchQuery);
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
  }, [searchQuery]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!city.trim() || !country.trim() || !lat || !lng) return;

    onSave({
      city: city.trim(),
      state: stateVal.trim() || undefined,
      country: country.trim(),
      countryCode: countryCode.trim() || undefined,
      color: color || undefined,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      heroPhoto: heroPhoto.trim() || undefined
    });
    onClose();
  };

  // Drag and drop location list reordering handlers
  const handleDragStart = (index: number) => {
    setDraggedLocationIndex(index);
  };

  const handleDrop = (index: number) => {
    if (draggedLocationIndex === null || draggedLocationIndex === index) return;

    const updatedLocations = [...allLocations];
    const draggedItem = updatedLocations[draggedLocationIndex];

    updatedLocations.splice(draggedLocationIndex, 1);
    updatedLocations.splice(index, 0, draggedItem);

    onReorderLocations(updatedLocations);
    setDraggedLocationIndex(null);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content--md glass-panel scrollable" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Location</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Auto-Populate suggestions search */}
        <div className="modal-autofill-panel">
          <label>Auto-Populate Details</label>
          <div className="modal-search-container">
            <Search size={14} className="modal-search-icon" />
            <input
              type="text"
              placeholder="Search city to auto-fill fields..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="modal-search-input"
            />
            {isSearching && (
              <div className="modal-search-loader">Searching...</div>
            )}
            {suggestions.length > 0 && (
              <div className="modal-suggestions-panel">
                {suggestions.map((sug) => (
                  <div
                    key={sug.id}
                    className="modal-suggestion-item"
                    onClick={() => {
                      setCity(sug.city);
                      setStateVal(sug.state || '');
                      setCountry(sug.country);
                      setCountryCode(sug.countryCode || '');
                      setLat(sug.lat.toString());
                      setLng(sug.lng.toString());
                      setHeroPhoto(sug.heroPhoto || '');
                      setSearchQuery('');
                      setSuggestions([]);
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div className="modal-suggestion-name">
                      {getLocIcon(sug as Location)} {sug.city}, {sug.country}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-scroll-body">
            <LocationFormFields
              city={city}
              setCity={setCity}
              stateVal={stateVal}
              setStateVal={setStateVal}
              country={country}
              setCountry={setCountry}
              countryCode={countryCode}
              setCountryCode={setCountryCode}
              color={color}
              setColor={setColor}
              lat={lat}
              setLat={setLat}
              lng={lng}
              setLng={setLng}
              heroPhoto={heroPhoto}
              setHeroPhoto={setHeroPhoto}
              locations={allLocations}
              currentLocationId={location.id}
              draggedLocationIndex={draggedLocationIndex}
              setDraggedLocationIndex={setDraggedLocationIndex}
              dragOverLocationIndex={dragOverLocationIndex}
              setDragOverLocationIndex={setDragOverLocationIndex}
              handleDragStart={handleDragStart}
              handleDrop={handleDrop}
              getLocIcon={getLocIcon}
              getFormattedLocationName={(loc) => getFormattedLocationName(loc, allLocations)}
            />
          </div>

          <div className="modal-actions sticky modal-actions--between">
            <button
              type="button"
              className="btn-secondary flex-align btn-danger-secondary"
              onClick={() => {
                onDelete();
                onClose();
              }}
            >
              <Trash2 size={14} /> Delete
            </button>

            <div className="modal-actions-right">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary">Save</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
