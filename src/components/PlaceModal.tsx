import { useState, useEffect, useRef } from 'react';
import { X, Search, Trash2 } from 'lucide-react';
import type { Place, PlaceGroup, Location } from '../types';
import { searchPlacesNearLocation, buildMapsLink } from '../utils/api';
import PlaceFormFields from './PlaceFormFields';
import { GeminiService } from '../utils/ai';

interface PlaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  place?: Place | null;
  catalogLocation: Location | null;
  placeGroups: PlaceGroup[];
  onSave: (placeData: Omit<Place, 'id'>) => void;
  onDelete?: (id: string) => void;
}

export default function PlaceModal({
  isOpen,
  onClose,
  place,
  catalogLocation,
  placeGroups,
  onSave,
  onDelete
}: PlaceModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [openingHours, setOpeningHours] = useState('');
  const [groupId, setGroupId] = useState('');
  const [mapsLink, setMapsLink] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [lat, setLat] = useState('0');
  const [lng, setLng] = useState('0');

  // AI fields states
  const [aiDetails, setAiDetails] = useState<{ [key: string]: string }>({});
  const [aiUpdatedAt, setAiUpdatedAt] = useState<number | undefined>(undefined);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Search auto-populate states
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const searchTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSuggestions([]);
      setAiError(null);
      setIsAiGenerating(false);
      if (place) {
        // Edit mode
        setTitle(place.title);
        setDescription(place.description || '');
        setOpeningHours(place.openingHours || '');
        setGroupId(place.placeGroupId || 'new');
        setMapsLink(place.mapsLink || '');
        setPhotoUrl(place.photoUrl || '');
        setNotes(place.notes || '');
        setLat(place.lat.toString());
        setLng(place.lng.toString());
        setAiDetails(place.aiDetails || {});
        setAiUpdatedAt(place.aiUpdatedAt);
      } else {
        // Add mode
        setTitle('');
        setDescription('');
        setOpeningHours('');
        setGroupId('new');
        setMapsLink('');
        setPhotoUrl('');
        setNotes('');
        setAiDetails({});
        setAiUpdatedAt(undefined);
        if (catalogLocation) {
          setLat(catalogLocation.lat.toString());
          setLng(catalogLocation.lng.toString());
        } else {
          setLat('0');
          setLng('0');
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Handle auto-populate suggestions search with debounce
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 3 || !catalogLocation) {
      setSuggestions([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchPlacesNearLocation(searchQuery, catalogLocation);
        setSuggestions(results);
      } catch (err) {
        console.error('Failed to search places:', err);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, catalogLocation]);

  if (!isOpen) return null;

  const handleAutoFillWithAi = async () => {
    if (!title.trim()) {
      setAiError('Please enter a place title first to generate insights.');
      return;
    }

    if (!GeminiService.hasApiKey()) {
      setAiError('Gemini API keys are missing. Please add them in the AI Settings (top-right header).');
      return;
    }

    setIsAiGenerating(true);
    setAiError(null);

    try {
      const city = catalogLocation?.city || '';
      const country = catalogLocation?.country || '';
      
      const results = await GeminiService.generatePlaceAiDetailsWithRotation(
        [{ id: 'temp-form-id', title: title.trim(), description: description.trim() }],
        city,
        country
      );

      if (results && results.length > 0) {
        const { id, ...details } = results[0];
        setAiDetails(details);
        setAiUpdatedAt(Date.now());
      } else {
        setAiError('No details were returned by the AI.');
      }
    } catch (err: any) {
      console.error('AI generation error:', err);
      setAiError(err?.message || 'Failed to generate AI insights.');
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !lat || !lng) return;

    onSave({
      title: title.trim(),
      description: description.trim(),
      openingHours: openingHours.trim() || undefined,
      placeGroupId: groupId || 'new',
      mapsLink: mapsLink.trim() || buildMapsLink(title.trim(), parseFloat(lat), parseFloat(lng), catalogLocation?.city),
      photoUrl: photoUrl.trim() || undefined,
      notes: notes.trim() || undefined,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      aiDetails: Object.keys(aiDetails).length > 0 ? aiDetails : undefined,
      aiUpdatedAt: aiUpdatedAt
    });
    onClose();
  };

  const isEdit = !!(place && !place.id.startsWith('new-temp-'));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel scrollable place-modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? 'Edit Place Details' : 'Add Place'}</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Suggestions Search / Auto-Populate */}
        <div className="form-group" style={{ padding: '0 12px', marginBottom: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '16px' }}>
          <label style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Auto-Populate Details</label>
          <div style={{ position: 'relative', marginTop: '6px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search place suggestions to auto-fill..." 
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
                    setTitle(sug.title);
                    setDescription(sug.description || '');
                    setOpeningHours(sug.openingHours || '');
                    setLat(sug.lat.toString());
                    setLng(sug.lng.toString());
                    setMapsLink(sug.mapsLink || buildMapsLink(sug.title, sug.lat, sug.lng, catalogLocation?.city));
                    setPhotoUrl(sug.photoUrl || '');
                    setNotes(sug.notes || '');
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
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{sug.title}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {sug.description}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-scroll-body">
            <PlaceFormFields
              title={title}
              setTitle={setTitle}
              description={description}
              setDescription={setDescription}
              openingHours={openingHours}
              setOpeningHours={setOpeningHours}
              groupId={groupId}
              setGroupId={setGroupId}
              mapsLink={mapsLink}
              setMapsLink={setMapsLink}
              photoUrl={photoUrl}
              setPhotoUrl={setPhotoUrl}
              notes={notes}
              setNotes={setNotes}
              lat={lat}
              setLat={setLat}
              lng={lng}
              setLng={setLng}
              placeGroups={placeGroups}
              aiDetails={aiDetails}
              setAiDetails={setAiDetails}
              isAiGenerating={isAiGenerating}
              onAutoFill={handleAutoFillWithAi}
              aiError={aiError}
              aiUpdatedAt={aiUpdatedAt}
            />
          </div>

          <div className="modal-actions sticky" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {isEdit && onDelete ? (
              <button 
                type="button" 
                className="btn-secondary flex-align"
                style={{ color: 'var(--color-danger)', borderColor: 'rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.04)', gap: '4px' }}
                onClick={() => {
                  place && onDelete(place.id);
                  onClose();
                }}
              >
                <Trash2 size={14} /> Delete Place
              </button>
            ) : (
              <div /> // Spacer
            )}
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary">
                {isEdit ? 'Save Changes' : 'Add Place'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
