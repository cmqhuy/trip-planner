import { useState, useEffect } from 'react';
import { X, Sparkles, AlertTriangle, CheckSquare, Square } from 'lucide-react';
import { GeminiService } from '../utils/ai';
import FunGeneratingLoader from './FunGeneratingLoader';
import { formatFreshness } from './AiMarkdownSection';

interface DayOption {
  dateStr: string;
  label: string;
  hasTips: boolean;
  tipsUpdatedAt?: number;
}

interface AiGenerateDaysModalProps {
  isOpen: boolean;
  onClose: () => void;
  days: DayOption[];
  onGenerate: (selectedDateStrs: string[]) => Promise<void>;
}

export default function AiGenerateDaysModal({
  isOpen,
  onClose,
  days,
  onGenerate
}: AiGenerateDaysModalProps) {
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasKeys = GeminiService.hasApiKey();

  useEffect(() => {
    if (isOpen) {
      // By default, select days that don't have tips yet
      const unpopulated = days.filter(d => !d.hasTips);
      setSelectedDates(new Set(unpopulated.map(d => d.dateStr)));
      setError(null);
      setGenerating(false);
    }
  }, [isOpen, days]);

  if (!isOpen) return null;

  const toggleSelectAll = () => {
    if (selectedDates.size === days.length) {
      setSelectedDates(new Set());
    } else {
      setSelectedDates(new Set(days.map(d => d.dateStr)));
    }
  };

  const selectUnpopulated = () => {
    const unpopulated = days.filter(d => !d.hasTips);
    setSelectedDates(new Set(unpopulated.map(d => d.dateStr)));
  };

  const handleToggleDay = (dateStr: string) => {
    const next = new Set(selectedDates);
    if (next.has(dateStr)) {
      next.delete(dateStr);
    } else {
      next.add(dateStr);
    }
    setSelectedDates(next);
  };

  const handleGenerate = async () => {
    if (selectedDates.size === 0) return;

    setError(null);
    setGenerating(true);

    try {
      await onGenerate(Array.from(selectedDates));
      onClose();
    } catch (err: any) {
      console.error('AI generation for days failed:', err);
      setError(err?.message || 'An error occurred during AI generation. Please check your API key(s) or model configuration.');
    } finally {
      setGenerating(false);
    }
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
            AI Day Tips Generator
          </h3>
          {!generating && (
            <button className="modal-close" onClick={onClose}>
              <X size={20} />
            </button>
          )}
        </div>

        <div className="modal-scroll-body" style={{ marginTop: '12px' }}>
          {generating ? (
            <div className="ai-generate-loading-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '180px' }}>
              <FunGeneratingLoader message={`Asking Gemini to build local routes, departure times, weather check reminders, transit options, and baby logistics for ${selectedDates.size} day(s)...`} />
            </div>
          ) : (
            <>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4, textTransform: 'none' }}>
                Select the days of your plan to generate or update AI daily tips, transit logistics, and weather reminders.
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
                  {selectedDates.size === days.length ? 'Deselect All' : 'Select All'}
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
              <div className="ai-generate-list" style={{ marginTop: '12px', maxHeight: '300px', overflowY: 'auto' }}>
                {days.map(d => {
                  const isChecked = selectedDates.has(d.dateStr);
                  return (
                    <div 
                      key={d.dateStr} 
                      className="ai-generate-item"
                      onClick={() => handleToggleDay(d.dateStr)}
                      style={{ cursor: 'pointer' }}
                    >
                      <button 
                        type="button" 
                        style={{ background: 'transparent', border: 'none', padding: 0, display: 'flex', color: isChecked ? 'var(--accent-primary)' : 'var(--text-muted)' }}
                      >
                        {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                      </button>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, marginLeft: '10px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'none' }}>
                          {d.label}
                        </span>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'none' }}>
                            {d.dateStr}
                          </span>
                          {d.tipsUpdatedAt ? (
                            <span style={{ color: 'var(--color-success)', fontSize: '11px' }}>
                              Updated: {formatFreshness(d.tipsUpdatedAt)}
                            </span>
                          ) : d.hasTips ? (
                            <span style={{ color: 'var(--color-success)', fontSize: '11px' }}>Has AI tips</span>
                          ) : (
                            <span style={{ color: '#fbbf24', fontSize: '11px' }}>No tips generated yet</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {days.length === 0 && (
                  <div style={{ padding: '24px', textTransform: 'none', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                    No days found in active plan.
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
              disabled={selectedDates.size === 0 || !hasKeys}
            >
              <Sparkles size={14} />
              Generate ({selectedDates.size})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
