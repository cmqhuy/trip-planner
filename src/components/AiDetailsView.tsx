import { Sparkles, RefreshCw, HelpCircle } from 'lucide-react';
import type { Place } from '../types';
import { getOrderedPlaceFields } from '../utils/ai';
import FunGeneratingLoader from './FunGeneratingLoader';
import { FIELD_ICONS_MAP, getIconColor } from './TripAiConfigModal';

interface AiDetailsViewProps {
  place: Place;
  onGenerate?: () => void;
  canEdit?: boolean;
  isGenerating?: boolean;
  layoutMode?: 'single-col' | 'adaptive-2-col';
  customAiFields?: { title: string; key: string; description: string; icon?: string; disabled?: boolean; }[];
  disabledPlaceFields?: string[];
  fieldIcons?: { [key: string]: string };
  placeFieldsOrder?: string[];
}

export default function AiDetailsView({
  place,
  onGenerate,
  canEdit = true,
  isGenerating = false,
  layoutMode = 'single-col',
  customAiFields,
  disabledPlaceFields = [],
  fieldIcons = {},
  placeFieldsOrder = []
}: AiDetailsViewProps) {
  const hasAiDetails = place.aiDetails && Object.keys(place.aiDetails).length > 0;

  const getFieldIcon = (fieldKey: string, defaultIconName: string) => {
    const iconName = fieldIcons?.[fieldKey] || defaultIconName;
    const IconComponent = FIELD_ICONS_MAP[iconName] || HelpCircle;
    const color = getIconColor(iconName);
    return <IconComponent size={13} style={{ color }} />;
  };

  const formatFreshness = (timestamp?: number) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const orderedFields = getOrderedPlaceFields(customAiFields, disabledPlaceFields, placeFieldsOrder);

  return (
    <div className={`ai-details-container ${isGenerating ? 'ai-generating-glow' : ''}`}>
      <div className="ai-details-header">
        <span className="ai-details-freshness">
          <Sparkles size={12} className={isGenerating ? 'spin' : ''} />
          {hasAiDetails ? 'AI Travel Guide' : 'AI Travel Insights'}
        </span>

        {canEdit && onGenerate && (
          <button
            className="mini-icon-btn flex-align"
            style={{ 
              fontSize: '10px', 
              gap: '4px', 
              padding: '2px 6px', 
              borderRadius: '4px',
              background: 'rgba(99, 102, 241, 0.15)',
              borderColor: 'rgba(99, 102, 241, 0.3)',
              color: '#a5b4fc'
            }}
            onClick={(e) => {
              e.stopPropagation();
              onGenerate();
            }}
            disabled={isGenerating}
          >
            <RefreshCw size={10} className={isGenerating ? 'spin' : ''} />
            {hasAiDetails ? 'Regenerate' : 'Generate'}
          </button>
        )}
      </div>

      {hasAiDetails && place.aiUpdatedAt && !isGenerating && (
        <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px', marginBottom: '8px', textTransform: 'none' }}>
          Updated: {formatFreshness(place.aiUpdatedAt)}
        </div>
      )}

      {isGenerating ? (
        <FunGeneratingLoader message="Asking Gemini AI for travel insights..." />
      ) : hasAiDetails ? (
        <div className={layoutMode === 'adaptive-2-col' ? 'ai-details-grid' : 'ai-details-list'}>
          {orderedFields.map(field => {
            if (field.disabled) return null;

            const content = place.aiDetails?.[field.key];
            if (!content || !content.trim()) return null;

            return (
              <div key={field.key} className="ai-detail-block">
                <div className="ai-detail-block-title">
                  {getFieldIcon(field.key, field.icon)}
                  <span>{field.title}</span>
                </div>
                <div className="ai-detail-block-content">
                  {content}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ padding: '12px 6px', textAlign: 'center', textTransform: 'none' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            No AI travel insights generated for this place yet.
          </p>
          {canEdit && onGenerate && (
            <button
              className="btn-secondary flex-align"
              style={{ 
                margin: '0 auto', 
                fontSize: '11px', 
                padding: '4px 10px', 
                borderRadius: '6px',
                gap: '6px',
                borderColor: 'rgba(99, 102, 241, 0.2)'
              }}
              onClick={(e) => {
                e.stopPropagation();
                onGenerate();
              }}
            >
              <Sparkles size={11} /> Generate AI Guide
            </button>
          )}
        </div>
      )}
    </div>
  );
}
