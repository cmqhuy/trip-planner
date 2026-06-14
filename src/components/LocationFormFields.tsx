import ColorPalette from './ColorPalette';
import ImagePreview from './ImagePreview';
import MapPicker from './MapPicker';
import type { Location } from '../types';

interface LocationFormFieldsProps {
  city: string;
  setCity: (val: string) => void;
  stateVal: string;
  setStateVal: (val: string) => void;
  country: string;
  setCountry: (val: string) => void;
  countryCode: string;
  setCountryCode: (val: string) => void;
  color: string;
  setColor: (val: string) => void;
  lat: string;
  setLat: (val: string) => void;
  lng: string;
  setLng: (val: string) => void;
  heroPhoto: string;
  setHeroPhoto: (val: string) => void;

  // Drag & drop sorting parameters
  locations: Location[];
  currentLocationId: string;
  draggedLocationIndex: number | null;
  setDraggedLocationIndex: (val: number | null) => void;
  dragOverLocationIndex: number | null;
  setDragOverLocationIndex: (val: number | null) => void;
  handleDragStart: (idx: number) => void;
  handleDrop: (idx: number) => void;
  getLocIcon: (loc: Location) => string;
  getFormattedLocationName: (loc: Location) => string;
}

export default function LocationFormFields({
  city,
  setCity,
  stateVal,
  setStateVal,
  country,
  setCountry,
  countryCode,
  setCountryCode,
  color,
  setColor,
  lat,
  setLat,
  lng,
  setLng,
  heroPhoto,
  setHeroPhoto,
  locations,
  currentLocationId,
  draggedLocationIndex,
  setDraggedLocationIndex,
  dragOverLocationIndex,
  setDragOverLocationIndex,
  handleDragStart,
  handleDrop,
  getLocIcon,
  getFormattedLocationName
}: LocationFormFieldsProps) {
  return (
    <>
      <div className="form-group">
        <label>City Name</label>
        <input 
          type="text" 
          value={city} 
          onChange={e => setCity(e.target.value)} 
          required 
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>State/Region (Optional)</label>
          <input 
            type="text" 
            value={stateVal} 
            onChange={e => setStateVal(e.target.value)} 
          />
        </div>
        <div className="form-group">
          <label>Country</label>
          <input 
            type="text" 
            value={country} 
            onChange={e => setCountry(e.target.value)} 
            required 
          />
        </div>
      </div>

      <div className="form-group">
        <label>Country Code (Optional)</label>
        <input 
          type="text" 
          value={countryCode} 
          onChange={e => setCountryCode(e.target.value)} 
          placeholder="e.g. US" 
          style={{ maxWidth: '120px' }} 
        />
      </div>

      <div className="form-group">
        <label>Theme Color</label>
        <ColorPalette 
          value={color} 
          onChange={setColor} 
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Latitude</label>
          <input 
            type="text" 
            value={lat} 
            onChange={e => setLat(e.target.value)} 
            required 
          />
        </div>
        <div className="form-group">
          <label>Longitude</label>
          <input 
            type="text" 
            value={lng} 
            onChange={e => setLng(e.target.value)} 
            required 
          />
        </div>
      </div>

      <div className="form-group">
        <label>Hero Image Photo URL</label>
        <input 
          type="text" 
          value={heroPhoto} 
          onChange={e => setHeroPhoto(e.target.value)} 
          placeholder="Photo URL..."
        />
        <ImagePreview url={heroPhoto} alt="Hero image preview" />
      </div>

      <div className="form-group">
        <label>📍 Click on the map to set coordinates</label>
        <MapPicker
          lat={parseFloat(lat)}
          lng={parseFloat(lng)}
          onPick={(pickedLat, pickedLng) => {
            setLat(pickedLat.toFixed(6));
            setLng(pickedLng.toFixed(6));
          }}
        />
      </div>

      <div className="form-group">
        <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          Drag & Drop to Reorder Locations
        </label>
        <div 
          onDragLeave={() => setDragOverLocationIndex(null)}
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '6px', 
            background: 'var(--bg-dark)', 
            padding: '8px', 
            borderRadius: '8px', 
            border: '1px solid var(--border-glass)' 
          }}
        >
          {locations.map((loc, idx) => {
            const isCurrent = loc.id === currentLocationId;
            const isDragging = idx === draggedLocationIndex;
            const isDragOver = idx === dragOverLocationIndex && draggedLocationIndex !== idx;
            const showLineAtBottom = draggedLocationIndex !== null && draggedLocationIndex < idx;
            return (
              <div key={loc.id} style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                {isDragOver && (
                  <div style={{
                    position: 'absolute',
                    top: showLineAtBottom ? 'auto' : '-5px',
                    bottom: showLineAtBottom ? '-5px' : 'auto',
                    left: 0,
                    right: 0,
                    height: '4px',
                    background: 'var(--accent-primary)',
                    borderRadius: '2px',
                    boxShadow: '0 0 8px var(--accent-primary)',
                    zIndex: 10,
                    pointerEvents: 'none'
                  }} />
                )}
                <div
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragEnd={() => {
                    setDraggedLocationIndex(null);
                    setDragOverLocationIndex(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverLocationIndex !== idx) {
                      setDragOverLocationIndex(idx);
                    }
                  }}
                  onDrop={() => {
                    handleDrop(idx);
                    setDragOverLocationIndex(null);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: isCurrent ? 'var(--accent-primary-glow)' : 'rgba(255,255,255,0.03)',
                    border: isCurrent ? '1px solid var(--accent-primary)' : '1px solid var(--border-glass)',
                    borderRadius: '6px',
                    cursor: 'grab',
                    opacity: isDragging ? 0.4 : 1,
                    transition: 'all 0.15s ease',
                    userSelect: 'none',
                    textTransform: 'none'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = isCurrent ? 'var(--accent-primary)' : 'var(--border-glass)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                    <span style={{ cursor: 'grab', color: 'var(--text-muted)', fontSize: '14px', display: 'flex', alignItems: 'center' }}>
                      ☰
                    </span>
                    <span style={{ fontSize: '16px' }}>{getLocIcon(loc)}</span>
                    <span style={{ 
                      fontSize: '13px', 
                      fontWeight: isCurrent ? 600 : 400, 
                      color: 'var(--text-primary)', 
                      textOverflow: 'ellipsis', 
                      overflow: 'hidden', 
                      whiteSpace: 'nowrap' 
                    }}>
                      {getFormattedLocationName(loc)}
                    </span>
                    {isCurrent && (
                      <span style={{ 
                        fontSize: '10px', 
                        background: 'var(--accent-primary)', 
                        color: '#fff', 
                        padding: '2px 6px', 
                        borderRadius: '4px', 
                        marginLeft: 'auto', 
                        fontWeight: 600 
                      }}>
                        Active
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
