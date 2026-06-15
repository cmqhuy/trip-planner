import { useState, useEffect } from 'react';
import { X, Sparkles, AlertTriangle, CheckSquare, Square } from 'lucide-react';
import type { Place } from '../types';
import { GeminiService, NO_API_KEY_TOOLTIP } from '../utils/ai';
import FunGeneratingLoader from './FunGeneratingLoader';

interface AiGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  places: Place[];
  city: string;
  country: string;
  onSave: (updates: { [placeId: string]: { suggestedMarkers?: any[]; [key: string]: any } }) => void;
  customAiFields?: { title: string; key: string; description: string; icon?: string; disabled?: boolean; }[];
  disabledPlaceFields?: string[];
  placeFieldsOrder?: string[];
}

export default function AiGenerateModal({
  isOpen,
  onClose,
  places,
  city,
  country,
  onSave,
  customAiFields,
  disabledPlaceFields = [],
  placeFieldsOrder = []
}: AiGenerateModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState('');

  const hasKeys = GeminiService.hasApiKey();

  useEffect(() => {
    if (isOpen) {
      // By default, select only the places having no AI details yet
      const unpopulated = places.filter(
        p => !p.aiDetails || Object.keys(p.aiDetails).length === 0
      );
      setSelectedIds(new Set(unpopulated.map(p => p.id)));
      setError(null);
      setGenerating(false);
      setProgressMsg('');
    }
  }, [isOpen, places]);

  if (!isOpen) return null;

  const toggleSelectAll = () => {
    if (selectedIds.size === places.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(places.map(p => p.id)));
    }
  };

  const selectUnpopulated = () => {
    const unpopulated = places.filter(
      p => !p.aiDetails || Object.keys(p.aiDetails).length === 0
    );
    setSelectedIds(new Set(unpopulated.map(p => p.id)));
  };

  const handleTogglePlace = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleGenerate = async () => {
    if (selectedIds.size === 0) return;

    setError(null);
    setGenerating(true);
    setProgressMsg(`Asking Gemini to generate insights for ${selectedIds.size} place(s) in ${city}...`);

    try {
      const placesToGen = places
        .filter(p => selectedIds.has(p.id))
        .map(p => ({
          id: p.id,
          title: p.title,
          description: p.description
        }));

      // Direct service call with key rotation
      const results = await GeminiService.generatePlaceAiDetailsWithRotation(
        placesToGen,
        city,
        country,
        customAiFields,
        undefined, // model
        disabledPlaceFields,
        placeFieldsOrder
      );

      // Map back to update object
      const updatesMap: { [placeId: string]: { suggestedMarkers?: any[]; [key: string]: any } } = {};
      results.forEach(res => {
        const { id, ...details } = res;
        updatesMap[id] = details;
      });

      onSave(updatesMap);
      onClose();
    } catch (err: any) {
      console.error('AI generation failed:', err);
      setError(err?.message || 'An error occurred during AI generation. Please check your API key(s) or model configuration.');
    } finally {
      setGenerating(false);
    }
  };

  const formatFreshness = (p: Place) => {
    if (!p.aiDetails || Object.keys(p.aiDetails).length === 0) {
      return <span className="ai-status-pending">No AI details yet</span>;
    }
    const dateStr = new Date(p.aiUpdatedAt || 0).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });
    return <span className="ai-status-success">Updated: {dateStr}</span>;
  };

  return (
    <div className="modal-overlay" onClick={generating ? undefined : onClose}>
      <div
        className="modal-content glass-panel modal-content--lg"
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 className="modal-header-title">
            <Sparkles size={18} className="text-accent" />
            AI Place Tips Generator
          </h3>
          {!generating && (
            <button className="modal-close" onClick={onClose}>
              <X size={20} />
            </button>
          )}
        </div>

        <div className="modal-scroll-body modal-scroll-body--mt12">
          {generating ? (
            <FunGeneratingLoader title="Generating Travel Guide" message={progressMsg} />
          ) : (
            <>
              <p className="modal-body-intro">
                Select the places in <strong>{city}, {country}</strong> to populate with AI-generated details.
              </p>

              {!hasKeys && (
                <div className="ai-settings-test-panel error ai-warning-panel">
                  <AlertTriangle size={16} className="ai-warning-icon" />
                  <div className="ai-warning-body">
                    <strong className="ai-warning-title">API Keys Missing</strong>
                    <span className="ai-warning-text">
                      {NO_API_KEY_TOOLTIP}
                    </span>
                  </div>
                </div>
              )}

              {error && (
                <div className="ai-settings-test-panel error ai-panel-mt">
                  <AlertTriangle size={14} className="flex-shrink-0" />
                  <span className="ai-error-text">{error}</span>
                </div>
              )}

              {/* Quick selectors */}
              <div className="ai-selector-row">
                <button
                  type="button"
                  className="btn-secondary ai-selector-btn"
                  onClick={toggleSelectAll}
                >
                  {selectedIds.size === places.length ? 'Deselect All' : 'Select All'}
                </button>
                <button
                  type="button"
                  className="btn-secondary ai-selector-btn"
                  onClick={selectUnpopulated}
                >
                  Select Unpopulated Only
                </button>
              </div>

              {/* Checklist */}
              <div className="ai-generate-list">
                {places.map(p => {
                  const isChecked = selectedIds.has(p.id);
                  return (
                    <div
                      key={p.id}
                      className="ai-generate-item"
                      onClick={() => handleTogglePlace(p.id)}
                    >
                      <button
                        type="button"
                        className="ai-checkbox-icon-btn"
                        style={{ color: isChecked ? 'var(--accent-primary)' : 'var(--text-muted)' }}
                      >
                        {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                      </button>

                      <div className="ai-list-row-body--no-margin">
                        <span className="ai-list-item-title">
                          {p.title}
                        </span>
                        <div className="ai-list-item-meta">
                          <span className="ai-list-item-label--ellipsis">
                            {p.description || 'No description provided'}
                          </span>
                          {formatFreshness(p)}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {places.length === 0 && (
                  <div className="ai-modal-empty">
                    No places in this section to select.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {!generating && (
          <div className="modal-actions modal-actions--mt24">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary flex-align modal-generate-btn"
              onClick={handleGenerate}
              disabled={selectedIds.size === 0 || !hasKeys}
            >
              <Sparkles size={14} />
              Generate ({selectedIds.size})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
