import ImagePreview from './ImagePreview';
import CategoryGroupSelect from './CategoryGroupSelect';
import MapPicker from './MapPicker';
import type { PlaceGroup } from '../types';

interface PlaceFormFieldsProps {
  title: string;
  setTitle: (val: string) => void;
  description: string;
  setDescription: (val: string) => void;
  openingHours: string;
  setOpeningHours: (val: string) => void;
  groupId: string;
  setGroupId: (val: string) => void;
  mapsLink: string;
  setMapsLink: (val: string) => void;
  photoUrl: string;
  setPhotoUrl: (val: string) => void;
  notes: string;
  setNotes: (val: string) => void;
  lat: string;
  setLat: (val: string) => void;
  lng: string;
  setLng: (val: string) => void;
  placeGroups: PlaceGroup[];
}

export default function PlaceFormFields({
  title,
  setTitle,
  description,
  setDescription,
  openingHours,
  setOpeningHours,
  groupId,
  setGroupId,
  mapsLink,
  setMapsLink,
  photoUrl,
  setPhotoUrl,
  notes,
  setNotes,
  lat,
  setLat,
  lng,
  setLng,
  placeGroups
}: PlaceFormFieldsProps) {
  return (
    <>
      <div className="form-group">
        <label>Place Title</label>
        <input 
          type="text" 
          value={title} 
          onChange={e => setTitle(e.target.value)} 
          placeholder="e.g. Eiffel Tower" 
          required 
        />
      </div>
      
      <div className="form-group">
        <label>Description</label>
        <textarea 
          value={description} 
          onChange={e => setDescription(e.target.value)} 
          placeholder="Short summary..." 
          rows={2} 
        />
      </div>

      <div className="form-row" style={{ alignItems: 'flex-start' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Opening Hours</label>
          <input 
            type="text" 
            value={openingHours} 
            onChange={e => setOpeningHours(e.target.value)} 
            placeholder="e.g. 09:00 - 18:00" 
          />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label style={{ marginBottom: '6px', display: 'block' }}>Category Group</label>
          <CategoryGroupSelect 
            value={groupId} 
            onChange={setGroupId} 
            placeGroups={placeGroups} 
          />
        </div>
      </div>

      <div className="form-group">
        <label>Google Maps Link (Optional)</label>
        <input 
          type="text" 
          value={mapsLink} 
          onChange={e => setMapsLink(e.target.value)} 
          placeholder="e.g. https://maps.google.com/..." 
        />
      </div>

      <div className="form-group">
        <label>Hero Image Photo URL (Optional)</label>
        <input 
          type="text" 
          value={photoUrl} 
          onChange={e => setPhotoUrl(e.target.value)} 
          placeholder="e.g. Unsplash URL..." 
        />
        <ImagePreview url={photoUrl} alt="Place image preview" width={120} height={120} />
      </div>

      <div className="form-group">
        <label>Notes</label>
        <textarea 
          value={notes} 
          onChange={e => setNotes(e.target.value)} 
          placeholder="Travel notes, tips, things to try..." 
          rows={3} 
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Latitude (Optional)</label>
          <input 
            type="text" 
            value={lat} 
            onChange={e => setLat(e.target.value)} 
            placeholder="e.g. 48.8584" 
          />
        </div>
        <div className="form-group">
          <label>Longitude (Optional)</label>
          <input 
            type="text" 
            value={lng} 
            onChange={e => setLng(e.target.value)} 
            placeholder="e.g. 2.2945" 
          />
        </div>
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
    </>
  );
}
