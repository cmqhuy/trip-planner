import { useState, useEffect } from 'react';
import { X, Sparkles, RefreshCw, AlertTriangle, CheckSquare, Square } from 'lucide-react';
import type { Place } from '../types';
import { GeminiService } from '../utils/ai';

interface AiGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  places: Place[];
  city: string;
  country: string;
  onSave: (updates: { [placeId: string]: { [key: string]: string } }) => void;
}

export default function AiGenerateModal({
  isOpen,
  onClose,
  places,
  city,
  country,
  onSave
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
        country
      );

      // Map back to update object
      const updatesMap: { [placeId: string]: { [key: string]: string } } = {};
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
      return <span style={{ color: '#fbbf24', fontSize: '11px' }}>No AI details yet</span>;
    }
    const dateStr = new Date(p.aiUpdatedAt || 0).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });
    return <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Updated: {dateStr}</span>;
  };

  return (
    <div className="modal-overlay" onClick={generating ? undefined : onClose}>
      <div 
        className="modal-content glass-panel" 
        style={{ maxWidth: '480px' }} 
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} style={{ color: 'var(--accent-primary)' }} />
            AI Insights Generator
          </h3>
          {!generating && (
            <button className="modal-close" onClick={onClose}>
              <X size={20} />
            </button>
          )}
        </div>

        <div className="modal-scroll-body" style={{ marginTop: '12px' }}>
          {generating ? (
            <div className="ai-generate-loading-container">
              <RefreshCw size={36} className="spin" style={{ color: 'var(--accent-primary)' }} />
              <h4 style={{ textTransform: 'none' }}>Generating Travel Guide</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'none', lineHeight: 1.4 }}>
                {progressMsg}
              </p>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'none' }}>
                This may take a few seconds...
              </span>
            </div>
          ) : (
            <>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4, textTransform: 'none' }}>
                Select the places in <strong>{city}, {country}</strong> to populate with AI-generated details.
              </p>

              {!hasKeys && (
                <div 
                  className="ai-settings-test-panel error" 
                  style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '12px', marginTop: '12px' }}
                >
                  <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <strong style={{ fontSize: '12px' }}>API Keys Missing</strong>
                    <span style={{ fontSize: '11.5px', textTransform: 'none', lineHeight: 1.3 }}>
                      You need a Gemini API key to run AI calls. Please open AI Settings in the top-right header to configure your keys.
                    </span>
                  </div>
                </div>
              )}

              {error && (
                <div className="ai-settings-test-panel error" style={{ marginTop: '12px' }}>
                  <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                  <span style={{ textTransform: 'none', lineHeight: 1.3 }}>{error}</span>
                </div>
              )}

              {/* Quick selectors */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px' }}
                  onClick={toggleSelectAll}
                >
                  {selectedIds.size === places.length ? 'Deselect All' : 'Select All'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px' }}
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
                        style={{ background: 'transparent', border: 'none', padding: 0, display: 'flex', color: isChecked ? 'var(--accent-primary)' : 'var(--text-muted)' }}
                      >
                        {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                      </button>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'none' }}>
                          {p.title}
                        </span>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px', textTransform: 'none' }}>
                            {p.description || 'No description provided'}
                          </span>
                          {formatFreshness(p)}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {places.length === 0 && (
                  <div style={{ padding: '24px', textTransform: 'none', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                    No places in this section to select.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {!generating && (
          <div className="modal-actions" style={{ marginTop: '24px' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button 
              type="button" 
              className="btn-primary flex-align" 
              style={{ gap: '6px' }}
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
