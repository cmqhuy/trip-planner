import { Sparkles, RefreshCw, AlertTriangle, HelpCircle, RotateCcw } from 'lucide-react';
import ImagePreview from './ImagePreview';
import CategoryGroupSelect from './CategoryGroupSelect';
import MapPicker from './MapPicker';
import type { PlaceGroup } from '../types';
import { GeminiService, getOrderedPlaceFields, NO_API_KEY_TOOLTIP } from '../utils/ai';
import { FIELD_ICONS_MAP, getIconColor } from './TripAiConfigModal';

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
  // AI fields addition
  aiDetails: { [key: string]: string };
  setAiDetails: (details: { [key: string]: string }) => void;
  isAiGenerating: boolean;
  onAutoFill: () => void;
  aiError: string | null;
  aiUpdatedAt?: number;
  customAiFields?: { title: string; key: string; description: string; icon?: string; disabled?: boolean; }[];
  disabledPlaceFields?: string[];
  fieldIcons?: { [key: string]: string };
  placeFieldsOrder?: string[];
  savedValues?: {
    title?: string;
    description?: string;
    openingHours?: string;
    mapsLink?: string;
    photoUrl?: string;
    notes?: string;
    aiDetails?: { [key: string]: string };
  };
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
  placeGroups,
  aiDetails,
  setAiDetails,
  isAiGenerating,
  onAutoFill,
  aiError,
  aiUpdatedAt,
  customAiFields,
  disabledPlaceFields = [],
  fieldIcons = {},
  placeFieldsOrder = [],
  savedValues
}: PlaceFormFieldsProps) {
  const hasKeys = GeminiService.hasApiKey();

  const getFieldIcon = (fieldKey: string, defaultIconName: string) => {
    const iconName = fieldIcons?.[fieldKey] || defaultIconName;
    const IconComponent = FIELD_ICONS_MAP[iconName] || HelpCircle;
    const color = getIconColor(iconName);
    return <IconComponent size={13} style={{ color }} />;
  };

  const formatFreshness = (timestamp?: number) => {
    if (!timestamp) return '';
    return ` (Last updated: ${new Date(timestamp).toLocaleDateString()})`;
  };

  const undoBtn = (currentVal: string, savedVal: string | undefined, onRestore: () => void) => {
    if (!savedValues || savedVal === undefined || currentVal === savedVal) return null;
    return (
      <button
        type="button"
        onClick={onRestore}
        data-tooltip="Restore saved value"
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px',
          color: 'var(--text-muted)', display: 'flex', alignItems: 'center', lineHeight: 1
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-primary)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
      >
        <RotateCcw size={11} />
      </button>
    );
  };

  const orderedFields = getOrderedPlaceFields(customAiFields, disabledPlaceFields, placeFieldsOrder);

  return (
    <div className="place-form-grid">
      <div className="place-form-left-col">
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            Place Title
            {undoBtn(title, savedValues?.title, () => setTitle(savedValues!.title!))}
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Eiffel Tower"
            required
          />
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            Description
            {undoBtn(description, savedValues?.description, () => setDescription(savedValues!.description!))}
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Short summary..."
            rows={2}
          />
        </div>

        <div className="form-row" style={{ alignItems: 'flex-start' }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              Opening Hours
              {undoBtn(openingHours, savedValues?.openingHours, () => setOpeningHours(savedValues!.openingHours!))}
            </label>
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
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            Google Maps Link (Optional)
            {undoBtn(mapsLink, savedValues?.mapsLink, () => setMapsLink(savedValues!.mapsLink!))}
          </label>
          <input
            type="text"
            value={mapsLink}
            onChange={e => setMapsLink(e.target.value)}
            placeholder="e.g. https://maps.google.com/..."
          />
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            Hero Image Photo URL (Optional)
            {undoBtn(photoUrl, savedValues?.photoUrl, () => setPhotoUrl(savedValues!.photoUrl!))}
          </label>
          <input
            type="text"
            value={photoUrl}
            onChange={e => setPhotoUrl(e.target.value)}
            placeholder="Photo URL..."
          />
          <ImagePreview url={photoUrl} alt="Place image preview" width={120} height={120} />
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            Notes
            {undoBtn(notes, savedValues?.notes, () => setNotes(savedValues!.notes!))}
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Travel notes, tips, things to try..."
            rows={3}
          />
        </div>
      </div>

      <div className="place-form-right-col">
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

        <div className="form-group" style={{ marginBottom: '16px' }}>
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

        {/* AI Fields Section */}
        <div className="modal-section-divider">
          <div className="modal-ai-header">
            <h4 className="modal-ai-title">
              <Sparkles size={14} style={{ color: 'var(--accent-primary)' }} />
              AI Travel Insights {formatFreshness(aiUpdatedAt)}
            </h4>

            <div 
              data-tooltip={!hasKeys ? NO_API_KEY_TOOLTIP : (!title.trim() ? 'Enter a place title to enable AI insights' : 'Auto-populate these fields with AI')}
              data-tooltip-position="bottom"
              style={{ display: 'inline-block' }}
            >
              <button
                type="button"
                className="btn-secondary flex-align"
                style={{ 
                  fontSize: '11px', 
                  padding: '4px 10px', 
                  borderRadius: '6px',
                  gap: '6px',
                  borderColor: 'rgba(99, 102, 241, 0.2)',
                  background: 'rgba(99, 102, 241, 0.05)',
                  cursor: (isAiGenerating || !title.trim() || !hasKeys) ? 'not-allowed' : 'pointer'
                }}
                onClick={onAutoFill}
                disabled={isAiGenerating || !title.trim() || !hasKeys}
              >
                {isAiGenerating ? (
                  <RefreshCw size={11} className="spin" />
                ) : (
                  <Sparkles size={11} />
                )}
                {isAiGenerating ? 'Generating...' : 'Fill with AI'}
              </button>
            </div>
          </div>

          {aiError && (
            <div className="ai-settings-test-panel error" style={{ margin: '8px 0 16px 0', padding: '8px 10px' }}>
              <AlertTriangle size={13} style={{ flexShrink: 0 }} />
              <span style={{ textTransform: 'none', fontSize: '11.5px', lineHeight: 1.3 }}>{aiError}</span>
            </div>
          )}

          {orderedFields.map(field => {
            if (field.disabled) return null;

            return (
              <div className="form-group" key={field.key} style={{ marginTop: '12px' }}>
                <label className="modal-field-title">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {getFieldIcon(field.key, field.icon || '')}
                    {field.title}
                    {undoBtn(
                      aiDetails[field.key] || '',
                      savedValues?.aiDetails !== undefined ? (savedValues.aiDetails[field.key] ?? '') : undefined,
                      () => setAiDetails({ ...aiDetails, [field.key]: savedValues!.aiDetails![field.key] ?? '' })
                    )}
                  </span>
                  <span data-tooltip="AI generated field" style={{ display: 'flex', alignItems: 'center' }}>
                    <Sparkles size={12} style={{ color: '#c084fc' }} />
                  </span>
                </label>
                <textarea
                  className="form-group-textarea"
                  value={aiDetails[field.key] || ''}
                  onChange={e => {
                    setAiDetails({
                      ...aiDetails,
                      [field.key]: e.target.value
                    });
                  }}
                  placeholder={field.isDefault ? `AI will generate details for ${field.title}...` : `AI will generate custom details...`}
                  rows={4}
                  style={{ fontSize: '13px', textTransform: 'none', width: '100%', padding: '8px 12px', background: 'var(--bg-dark)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'var(--text-primary)' }}
                />
                <span className="modal-field-details">
                  {field.description}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
