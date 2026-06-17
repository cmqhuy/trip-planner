import { useState, useEffect, useRef } from 'react';
import { X, Search, Trash2, Sparkles, RefreshCw, AlertTriangle } from 'lucide-react';
import type { Place, PlaceGroup, Location, SuggestedMarker } from '../types';
import { searchPlacesNearLocation, buildMapsLink, parseGoogleMapsUrl, fetchPlaceFromGoogleMapsUrl, fetchWikipediaData } from '../utils/api';
import PlaceFormFields from './PlaceFormFields';
import ManualAiPromptModal from './ManualAiPromptModal';
import { GeminiService, AI_NOT_CONFIGURED_MESSAGE } from '../utils/ai';
import { runAiCall } from '../utils/runAiCall';

interface PlaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  place?: Place | null;
  catalogLocation: Location | null;
  placeGroups: PlaceGroup[];
  onSave: (placeData: Omit<Place, 'id'>) => void;
  onDelete?: (id: string) => void;
  customAiFields?: { title: string; key: string; description: string; icon?: string; disabled?: boolean; }[];
  disabledPlaceFields?: string[];
  fieldIcons?: { [key: string]: string };
  placeFieldsOrder?: string[];
}

export default function PlaceModal({
  isOpen,
  onClose,
  place,
  catalogLocation,
  placeGroups,
  onSave,
  onDelete,
  customAiFields,
  disabledPlaceFields = [],
  fieldIcons = {},
  placeFieldsOrder = []
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
  const [suggestedMarkers, setSuggestedMarkers] = useState<SuggestedMarker[]>([]);

  // Search auto-populate states
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<any>(null);

  // AI quick-fill states
  const [isAiQuickFilling, setIsAiQuickFilling] = useState(false);
  const [aiQuickFillError, setAiQuickFillError] = useState<string | null>(null);

  // Manual AI prompt state
  const [pendingManualPrompt, setPendingManualPrompt] = useState<{
    title: string; promptText: string; responseFormat: 'json' | 'markdown';
    onResponse: (text: string) => void; onCancel: () => void;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSuggestions([]);
      setAiError(null);
      setIsAiGenerating(false);
      setAiQuickFillError(null);
      setIsAiQuickFilling(false);
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
        setSuggestedMarkers(place.suggestedMarkers || []);
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
        setSuggestedMarkers([]);
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
    setSearchError(null);
    if (!searchQuery.trim() || searchQuery.length < 3) {
      setSuggestions([]);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    const { isGoogleMapsUrl } = parseGoogleMapsUrl(searchQuery);
    if (isGoogleMapsUrl) {
      setIsSearching(true);
      fetchPlaceFromGoogleMapsUrl(searchQuery, catalogLocation ?? undefined).then(({ place, error }) => {
        setIsSearching(false);
        if (error || !place) {
          setSearchError(error ?? 'Could not extract place info from this link.');
          return;
        }
        setTitle(place.title);
        setDescription(place.description || '');
        setOpeningHours(place.openingHours || '');
        setLat(place.lat.toString());
        setLng(place.lng.toString());
        setMapsLink(place.mapsLink || searchQuery);
        setPhotoUrl(place.photoUrl || '');
        setNotes(place.notes || '');
        setSearchQuery('');
        setSuggestions([]);
      });
      return;
    }

    if (!catalogLocation) {
      setSuggestions([]);
      return;
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

  const showManualPrompt = (promptTitle: string, prompt: string, format: 'json' | 'markdown'): Promise<string | null> =>
    new Promise(resolve => {
      setPendingManualPrompt({
        title: promptTitle, promptText: prompt, responseFormat: format,
        onResponse: t => { setPendingManualPrompt(null); resolve(t); },
        onCancel: () => { setPendingManualPrompt(null); resolve(null); }
      });
    });

  const handleAiQuickFill = async () => {
    const inputQuery = title.trim() || searchQuery.trim();
    if (!inputQuery) { setAiQuickFillError('Enter a place name in the title or search box first.'); return; }
    if (!GeminiService.isAiEnabled()) { setAiQuickFillError(AI_NOT_CONFIGURED_MESSAGE); return; }

    const city = catalogLocation?.city || '';
    const country = catalogLocation?.country || '';

    type QuickFillResult = { aiResult: { title: string; description: string; openingHours: string; notes: string; lat: number; lng: number; photoUrl: string }; wikiPhotoUrl?: string };

    setAiQuickFillError(null);
    await runAiCall<QuickFillResult>({
      label: `Quick Fill: ${inputQuery}`,
      buildPrompt: () => GeminiService.buildPlaceBasicInfoPrompt(inputQuery, city, country),
      parse: (text) => ({ aiResult: GeminiService.parsePlaceBasicInfoResponse(text) }),
      liveCall: async () => {
        const [aiResult, wikiResult] = await Promise.all([
          GeminiService.generatePlaceBasicInfoWithRotation(inputQuery, city, country),
          fetchWikipediaData(inputQuery)
        ]);
        return { aiResult, wikiPhotoUrl: wikiResult.photoUrl };
      },
      onSuccess: ({ aiResult, wikiPhotoUrl }) => {
        setTitle(aiResult.title);
        setDescription(aiResult.description);
        setOpeningHours(aiResult.openingHours);
        setNotes(aiResult.notes);
        setLat(aiResult.lat.toFixed(6));
        setLng(aiResult.lng.toFixed(6));
        if (wikiPhotoUrl) {
          setPhotoUrl(wikiPhotoUrl);
        } else if (aiResult.photoUrl) {
          const probe = new Image();
          probe.onload = () => setPhotoUrl(aiResult.photoUrl);
          probe.src = aiResult.photoUrl;
        }
        setMapsLink(buildMapsLink(aiResult.title, aiResult.lat, aiResult.lng, city));
        setSearchQuery('');
        setSuggestions([]);
      },
      onError: (err) => setAiQuickFillError(err.message || 'Failed to generate place info with AI.'),
      onLoadingChange: setIsAiQuickFilling,
      showManualPrompt,
    });
  };

  const handleAutoFillWithAi = async () => {
    if (!title.trim()) { setAiError('Please enter a place title first to generate insights.'); return; }
    if (!GeminiService.isAiEnabled()) { setAiError(AI_NOT_CONFIGURED_MESSAGE); return; }

    const city = catalogLocation?.city || '';
    const country = catalogLocation?.country || '';
    const placePayload = [{ id: 'temp-form-id', title: title.trim(), description: description.trim(), lat: parseFloat(lat) || undefined, lng: parseFloat(lng) || undefined }];

    await runAiCall({
      label: `AI Insights: ${title.trim()}`,
      buildPrompt: () => GeminiService.buildPlaceAiDetailsPrompt(placePayload, city, country, customAiFields, disabledPlaceFields, placeFieldsOrder),
      parse: GeminiService.parsePlaceAiDetailsResponse,
      liveCall: () => GeminiService.generatePlaceAiDetailsWithRotation(placePayload, city, country, customAiFields, undefined, disabledPlaceFields, placeFieldsOrder),
      onSuccess: (results) => {
        if (results && results.length > 0) {
          const { id: _id, suggestedMarkers: aiMarkers, ...details } = results[0] as { id?: string; suggestedMarkers?: SuggestedMarker[]; [key: string]: any };
          setAiDetails(details);
          setSuggestedMarkers(aiMarkers || []);
          setAiUpdatedAt(Date.now());
        } else {
          setAiError('No details were returned by the AI.');
        }
      },
      onError: (err) => setAiError(err.message || 'Failed to generate AI insights.'),
      onLoadingChange: (loading) => { setIsAiGenerating(loading); if (loading) setAiError(null); },
      showManualPrompt,
    });
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
      aiUpdatedAt: aiUpdatedAt,
      suggestedMarkers: suggestedMarkers.length > 0 ? suggestedMarkers : undefined
    });
    onClose();
  };

  const isEdit = !!(place && !place.id.startsWith('new-temp-'));

  return (
    <>
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel scrollable place-modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? 'Edit Place Details' : 'Add Place'}</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Suggestions Search / Auto-Populate */}
        <div className="modal-autofill-panel">
          <div className="flex-between">
            <label>Auto-Populate Details</label>
            <div
              data-tooltip={!GeminiService.isAiEnabled() ? AI_NOT_CONFIGURED_MESSAGE : (!title.trim() && !searchQuery.trim() ? 'Enter a place name or title first' : 'Fill all basic fields with AI')}
              data-tooltip-position="bottom"
              className="flex-align"
            >
              <button
                type="button"
                className="btn-secondary flex-align"
                style={{
                  fontSize: '11px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  gap: '5px',
                  borderColor: 'rgba(139, 92, 246, 0.25)',
                  background: 'rgba(139, 92, 246, 0.06)',
                  cursor: (isAiQuickFilling || (!title.trim() && !searchQuery.trim()) || !GeminiService.isAiEnabled()) ? 'not-allowed' : 'pointer'
                }}
                onClick={handleAiQuickFill}
                disabled={isAiQuickFilling || (!title.trim() && !searchQuery.trim()) || !GeminiService.isAiEnabled()}
              >
                {isAiQuickFilling ? <RefreshCw size={11} className="spin" /> : <Sparkles size={11} />}
                {isAiQuickFilling ? 'Generating...' : 'Fill with AI'}
              </button>
            </div>
          </div>
          {aiQuickFillError && (
            <div className="ai-settings-test-panel error ai-error-panel-override">
              <AlertTriangle size={13} className="flex-shrink-0" />
              <span className="ai-error-text">{aiQuickFillError}</span>
            </div>
          )}
          <div className="modal-search-container">
            <Search size={14} className="modal-search-icon" />
            <input
              type="text"
              placeholder="Type to search, or paste a Google Maps link..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="modal-search-input"
            />
            {isSearching && (
              <div className="modal-search-loader">Searching...</div>
            )}
          </div>
          {searchError && (
            <div style={{ fontSize: '11px', color: 'var(--color-danger, #ef4444)', marginTop: '4px' }}>{searchError}</div>
          )}

          {suggestions.length > 0 && (
            <div className="modal-suggestions-panel">
              {suggestions.map((sug) => (
                <div
                  key={sug.id}
                  className="modal-suggestion-item"
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
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div className="modal-suggestion-name">{sug.title}</div>
                  <div className="modal-suggestion-desc">
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
              customAiFields={customAiFields}
              disabledPlaceFields={disabledPlaceFields}
              fieldIcons={fieldIcons}
              placeFieldsOrder={placeFieldsOrder}
              savedValues={place ? {
                title: place.title,
                description: place.description || '',
                openingHours: place.openingHours || '',
                mapsLink: place.mapsLink || '',
                photoUrl: place.photoUrl || '',
                notes: place.notes || '',
                aiDetails: place.aiDetails || {}
              } : undefined}
            />
          </div>

          <div className="modal-actions sticky modal-actions--between">
            {isEdit && onDelete ? (
              <button
                type="button"
                className="btn-secondary flex-align btn-danger-secondary"
                onClick={() => {
                  place && onDelete(place.id);
                  onClose();
                }}
              >
                <Trash2 size={14} /> Delete
              </button>
            ) : (
              <div />
            )}

            <div className="modal-actions-right">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary">
                {isEdit ? 'Save' : 'Add Place'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
    {pendingManualPrompt && (
      <ManualAiPromptModal
        isOpen
        title={pendingManualPrompt.title}
        promptText={pendingManualPrompt.promptText}
        responseFormat={pendingManualPrompt.responseFormat}
        onResponse={pendingManualPrompt.onResponse}
        onCancel={pendingManualPrompt.onCancel}
      />
    )}
    </>
  );
}
