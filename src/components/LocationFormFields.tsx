import { GripVertical } from 'lucide-react';
import ColorPalette from './ColorPalette';
import ImagePreview from './ImagePreview';
import MapPicker from './MapPicker';
import SortableList from './SortableList';
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
  onReorderLocations: (from: number, to: number) => void;
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
  onReorderLocations,
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
          className="input--max-120"
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
        <label className="loc-reorder-label">
          Drag & Drop to Reorder Locations
        </label>
        <div className="loc-reorder-container">
          <SortableList
            items={locations}
            getId={loc => loc.id}
            onReorder={onReorderLocations}
            renderItem={(loc, _idx, { handleProps }) => {
              const isCurrent = loc.id === currentLocationId;
              return (
                <div className="loc-reorder-item-wrapper">
                  <div
                    className={`loc-reorder-item${isCurrent ? ' loc-reorder-item--active' : ''}`}
                    {...handleProps}
                  >
                    <div className="loc-reorder-row">
                      <span className="loc-reorder-grip">
                        <GripVertical size={12} />
                      </span>
                      <span className="loc-reorder-emoji">{getLocIcon(loc)}</span>
                      <span className="loc-reorder-name">
                        {getFormattedLocationName(loc)}
                      </span>
                      {isCurrent && (
                        <span className="loc-active-badge">
                          Active
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            }}
          />
        </div>
      </div>
    </>
  );
}
