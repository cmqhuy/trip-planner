import { useState, useEffect } from 'react';
import { Sparkles, AlertTriangle, CheckSquare, Square } from 'lucide-react';
import Modal from './Modal';
import { GeminiService, AI_NOT_CONFIGURED_TITLE, AI_NOT_CONFIGURED_MESSAGE } from '../utils/ai';
import { errorMessage } from '../utils/errors';
import { formatFreshness } from '../constants/aiFieldIcons';
import FunGeneratingLoader from './FunGeneratingLoader';

interface DayOption {
  dateStr: string;
  label: string;
  hasTips: boolean;
  tipsUpdatedAt?: number;
  locationName?: string;
  locationColor?: string;
  locationIcon?: string;
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
  const [generatingCount, setGeneratingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const isAiEnabled = GeminiService.isAiEnabled();

  // Reset transient UI state only when the modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setGenerating(false);
    }
  }, [isOpen]);

  // Update day selection when the modal opens or the days list changes
  useEffect(() => {
    if (isOpen) {
      const unpopulated = days.filter(d => !d.hasTips);
      setSelectedDates(new Set(unpopulated.map(d => d.dateStr)));
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
    setGeneratingCount(selectedDates.size);
    setGenerating(true);

    try {
      await onGenerate(Array.from(selectedDates));
      onClose();
    } catch (err: unknown) {
      console.error('AI generation for days failed:', err);
      setError(errorMessage(err, 'An error occurred during AI generation. Please check your API key(s) or model configuration.'));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Modal
      title={<><Sparkles size={18} className="text-accent" /> AI Day Tips Generator</>}
      titleClassName="modal-header-title"
      onClose={onClose}
      className="modal-content--lg"
      closeOnOverlayClick={!generating}
      hideClose={generating}
    >
        <div className="modal-scroll-body modal-scroll-body--mt12">
          {generating ? (
            <FunGeneratingLoader
              title="Generating Travel Guide"
              message={`Asking Gemini for local routes, transit options, weather reminders, and logistics for ${generatingCount} day${generatingCount !== 1 ? 's' : ''}...`}
            />
          ) : (
            <>
              <p className="modal-body-intro">
                Select the days of your plan to generate or update AI daily tips, transit logistics, and weather reminders.
              </p>

              {!isAiEnabled && (
                <div className="ai-settings-test-panel error ai-warning-panel">
                  <AlertTriangle size={16} className="ai-warning-icon" />
                  <div className="ai-warning-body">
                    <strong className="ai-warning-title">{AI_NOT_CONFIGURED_TITLE}</strong>
                    <span className="ai-warning-text">{AI_NOT_CONFIGURED_MESSAGE}</span>
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
                  {selectedDates.size === days.length ? 'Deselect All' : 'Select All'}
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
              <div className="ai-generate-list ai-generate-list--taller">
                {days.map(d => {
                  const isChecked = selectedDates.has(d.dateStr);
                  return (
                    <div
                      key={d.dateStr}
                      className="ai-generate-item"
                      onClick={() => handleToggleDay(d.dateStr)}
                    >
                      <button
                        type="button"
                        className={`ai-checkbox-icon-btn${isChecked ? ' selected' : ''}`}
                      >
                        {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                      </button>

                      <div className="ai-list-row-body">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px', flexWrap: 'wrap' }}>
                          <span className="ai-list-item-title">
                            {d.label}
                          </span>
                          {d.locationName && (
                            <span 
                              style={{ 
                                color: d.locationColor || 'var(--accent-primary)',
                                fontSize: '11px',
                                fontWeight: 500,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              {d.locationIcon} {d.locationName}
                            </span>
                          )}
                        </div>
                        <div className="ai-list-item-meta">
                          <span className="ai-list-item-label">
                            {d.dateStr}
                          </span>
                          {d.tipsUpdatedAt ? (
                            <span className="ai-status-success">
                              Updated: {formatFreshness(d.tipsUpdatedAt)}
                            </span>
                          ) : d.hasTips ? (
                            <span className="ai-status-success">Has AI tips</span>
                          ) : (
                            <span className="ai-status-pending">No tips generated yet</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {days.length === 0 && (
                  <div className="ai-modal-empty">
                    No days found in active plan.
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
              disabled={selectedDates.size === 0 || !isAiEnabled}
            >
              <Sparkles size={14} />
              Generate ({selectedDates.size})
            </button>
          </div>
        )}
    </Modal>
  );
}
