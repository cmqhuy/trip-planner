import { Sparkles, RefreshCw, AlertTriangle, Calendar, Ticket, Compass, AlertCircle, HelpCircle } from 'lucide-react';
import ImagePreview from './ImagePreview';
import CategoryGroupSelect from './CategoryGroupSelect';
import MapPicker from './MapPicker';
import type { PlaceGroup } from '../types';
import { AI_DETAIL_FIELDS, GeminiService } from '../utils/ai';

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
  aiUpdatedAt
}: PlaceFormFieldsProps) {
  const hasKeys = GeminiService.hasApiKey();

  const getFieldIcon = (iconName: string) => {
    switch (iconName) {
      case 'Sparkles':
        return <Sparkles size={13} style={{ color: '#a5b4fc' }} />;
      case 'Calendar':
        return <Calendar size={13} style={{ color: '#fda4af' }} />;
      case 'Ticket':
        return <Ticket size={13} style={{ color: '#6ee7b7' }} />;
      case 'Compass':
        return <Compass size={13} style={{ color: '#93c5fd' }} />;
      case 'AlertCircle':
        return <AlertCircle size={13} style={{ color: '#fde047' }} />;
      default:
        return <HelpCircle size={13} style={{ color: '#c084fc' }} />;
    }
  };

  const formatFreshness = (timestamp?: number) => {
    if (!timestamp) return '';
    return ` (Last updated: ${new Date(timestamp).toLocaleDateString()})`;
  };

  return (
    <div className="place-form-grid">
      <div className="place-form-left-col">
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
        <div style={{ borderTop: '1px dashed var(--border-glass)', paddingTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#a5b4fc', textTransform: 'none', margin: 0, fontWeight: 600 }}>
              <Sparkles size={14} style={{ color: 'var(--accent-primary)' }} />
              AI Travel Insights {formatFreshness(aiUpdatedAt)}
            </h4>

            <div 
              data-tooltip={!hasKeys ? 'Configure Gemini API keys in settings to use this feature' : (!title.trim() ? 'Enter a place title to enable AI insights' : 'Auto-populate these fields with Gemini AI')}
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
                {isAiGenerating ? 'Generating...' : 'Auto-Fill with AI'}
              </button>
            </div>
          </div>

          {aiError && (
            <div className="ai-settings-test-panel error" style={{ margin: '8px 0 16px 0', padding: '8px 10px' }}>
              <AlertTriangle size={13} style={{ flexShrink: 0 }} />
              <span style={{ textTransform: 'none', fontSize: '11.5px', lineHeight: 1.3 }}>{aiError}</span>
            </div>
          )}

          {AI_DETAIL_FIELDS.map(field => (
            <div className="form-group" key={field.key} style={{ marginTop: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', fontSize: '12px', textTransform: 'none', fontWeight: 500 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {getFieldIcon(field.icon)}
                  {field.label}
                </span>
                <span title="AI Generated Field" style={{ display: 'flex', alignItems: 'center' }}>
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
                placeholder={field.placeholder}
                rows={4}
                style={{ fontSize: '13px', textTransform: 'none', width: '100%', padding: '8px 12px', background: 'var(--bg-dark)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'var(--text-primary)' }}
              />
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginTop: '2px', textTransform: 'none', lineHeight: 1.3 }}>
                {field.instruction}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
