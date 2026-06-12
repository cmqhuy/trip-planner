import { Sparkles, Calendar, Ticket, Compass, AlertCircle, HelpCircle, RefreshCw } from 'lucide-react';
import type { Place } from '../types';
import { AI_DETAIL_FIELDS } from '../utils/ai';

interface AiDetailsViewProps {
  place: Place;
  onGenerate?: () => void;
  canEdit?: boolean;
  isGenerating?: boolean;
}

export default function AiDetailsView({
  place,
  onGenerate,
  canEdit = true,
  isGenerating = false
}: AiDetailsViewProps) {
  const hasAiDetails = place.aiDetails && Object.keys(place.aiDetails).length > 0;

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
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={`ai-details-container ${isGenerating ? 'ai-generating-glow' : ''}`}>
      <div className="ai-details-header">
        <span className="ai-details-freshness">
          <Sparkles size={12} className={isGenerating ? 'spin' : ''} />
          {hasAiDetails 
            ? `AI Travel Guide (Updated: ${formatFreshness(place.aiUpdatedAt)})` 
            : 'AI Travel Insights'
          }
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

      {isGenerating ? (
        <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={18} className="spin" style={{ color: 'var(--accent-primary)' }} />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'none' }}>
            Asking Gemini AI for travel insights...
          </span>
        </div>
      ) : hasAiDetails ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {AI_DETAIL_FIELDS.map(field => {
            const content = place.aiDetails?.[field.key];
            if (!content || !content.trim()) return null;

            return (
              <div key={field.key} className="ai-detail-block">
                <div className="ai-detail-block-title">
                  {getFieldIcon(field.icon)}
                  <span>{field.label}</span>
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
