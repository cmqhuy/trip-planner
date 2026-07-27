import { useState, useEffect } from 'react';
import { Trash2, Sparkles, RefreshCw, AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import type { Place, PlaceGroup, Location, SuggestedMarker } from '../types';
import { buildMapsLink, fetchWikipediaData } from '../utils/api';
import PlaceFormFields from './PlaceFormFields';
import PlaceSearchBox from './PlaceSearchBox';
import { GeminiService, AI_NOT_CONFIGURED_MESSAGE } from '../utils/ai';
import { runAiCall } from '../utils/runAiCall';
import { useManualPrompt } from '../utils/useManualPrompt';

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

  // Search query mirror (read by the "Fill with AI" button; the search box itself
  // is <PlaceSearchBox>).
  const [searchQuery, setSearchQuery] = useState('');

  // AI quick-fill states
  const [isAiQuickFilling, setIsAiQuickFilling] = useState(false);
  const [aiQuickFillError, setAiQuickFillError] = useState<string | null>(null);

  // Manual AI prompt flow (shared hook)
  const { showManualPrompt, manualPromptModal } = useManualPrompt();

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
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

  if (!isOpen) return null;


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
    <Modal title={isEdit ? 'Edit Place Details' : 'Add Place'} onClose={onClose} className="place-modal-content">
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
          <PlaceSearchBox
            catalogLocation={catalogLocation ?? undefined}
            onQueryChange={setSearchQuery}
            onSelect={(p, ctx) => {
              setTitle(p.title);
              setDescription(p.description || '');
              setOpeningHours(p.openingHours || '');
              setLat(p.lat.toString());
              setLng(p.lng.toString());
              setMapsLink(p.mapsLink || ctx.sourceUrl || buildMapsLink(p.title, p.lat, p.lng, catalogLocation?.city));
              setPhotoUrl(p.photoUrl || '');
              setNotes(p.notes || '');
            }}
          />
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
                lat: place.lat != null ? String(place.lat) : '',
                lng: place.lng != null ? String(place.lng) : '',
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
    </Modal>
    {manualPromptModal}
    </>
  );
}
