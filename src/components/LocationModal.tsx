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
  }, [isOpen, location]);

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
      <div className="modal-content glass-panel scrollable" style={{ maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Location</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Auto-Populate suggestions search */}
        <div className="form-group" style={{ padding: '0 12px', marginBottom: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '16px' }}>
          <label style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Auto-Populate Details</label>
          <div style={{ position: 'relative', marginTop: '6px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search city to auto-fill fields..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '32px' }}
            />
            {isSearching && (
              <div style={{ position: 'absolute', right: '10px', top: '12px', fontSize: '10px', color: 'var(--text-muted)' }}>Searching...</div>
            )}
          </div>
          
          {suggestions.length > 0 && (
            <div style={{ 
              background: 'var(--bg-panel)', 
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid var(--border-glass)', 
              borderRadius: '6px', 
              marginTop: '6px', 
              maxHeight: '150px', 
              overflowY: 'auto',
              zIndex: 100
            }}>
              {suggestions.map((sug) => (
                <div 
                  key={sug.id} 
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
                  style={{ 
                    padding: '8px 12px', 
                    cursor: 'pointer', 
                    borderBottom: '1px solid rgba(255,255,255,0.03)', 
                    fontSize: '12px',
                    textTransform: 'none'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {getLocIcon(sug as Location)} {sug.city}, {sug.country}
                  </div>
                </div>
              ))}
            </div>
          )}
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

          <div className="modal-actions sticky" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button 
              type="button" 
              className="btn-secondary flex-align"
              style={{ color: 'var(--color-danger)', borderColor: 'rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.04)', gap: '4px' }}
              onClick={() => {
                onDelete();
                onClose();
              }}
            >
              <Trash2 size={14} /> Delete Location
            </button>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary">Save</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
