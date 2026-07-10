import { useState, useEffect, useRef } from 'react';
import { X, ChevronDown } from 'lucide-react';

interface DayOption {
  value: string;
  label: string;
  locationName?: string;
  locationColor?: string;
  locationIcon?: string;
}

interface SwapDaysModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDayLabel: string;
  initialTargetDate: string;
  daysOptions: DayOption[];
  onConfirmSwap: (targetDateStr: string) => void;
}

export default function SwapDaysModal({
  isOpen,
  onClose,
  activeDayLabel,
  initialTargetDate,
  daysOptions,
  onConfirmSwap
}: SwapDaysModalProps) {
  const [targetDate, setTargetDate] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const comboRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setIsDropdownOpen(false);
      if (initialTargetDate) {
        setTargetDate(initialTargetDate);
      } else if (daysOptions.length > 0) {
        setTargetDate(daysOptions[0].value);
      } else {
        setTargetDate('');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (!comboRef.current?.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isDropdownOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!targetDate) return;
    onConfirmSwap(targetDate);
    onClose();
  };

  const selectedOption = daysOptions.find(opt => opt.value === targetDate);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Swap Days</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <div style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'none' }}>
          Swap all scheduled places, notes, and AI daily tips of <strong>{activeDayLabel}</strong> with another day.
        </div>

        <div className="form-group" style={{ marginBottom: '20px', position: 'relative' }} ref={comboRef}>
          <label htmlFor="swap-day-combo-trigger">Select Day to Swap With</label>
          <button
            id="swap-day-combo-trigger"
            type="button"
            className="combo-trigger"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
          >
            <div className="combo-trigger-inner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginRight: '8px', flexWrap: 'wrap' }}>
              {selectedOption ? (
                <>
                  <span>{selectedOption.label}</span>
                  {selectedOption.locationName && (
                    <span style={{ color: selectedOption.locationColor || 'var(--accent-primary)', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      {selectedOption.locationIcon} {selectedOption.locationName}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-muted">Select a day</span>
              )}
            </div>
            <ChevronDown size={14} style={{ opacity: 0.6, transform: isDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>

          {isDropdownOpen && (
            <div className="combo-dropdown" style={{ width: '100%', top: 'calc(100% + 4px)', position: 'absolute', zIndex: 1100 }}>
              {daysOptions.map(opt => {
                const isSelected = opt.value === targetDate;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`combo-option${isSelected ? ' selected' : ''}`}
                    onClick={() => {
                      setTargetDate(opt.value);
                      setIsDropdownOpen(false);
                    }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', width: '100%', textTransform: 'none' }}
                  >
                    <span>{opt.label}</span>
                    {opt.locationName && (
                      <span style={{ color: opt.locationColor || 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: isSelected ? 600 : 500 }}>
                        {opt.locationIcon} {opt.locationName}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button 
            className="btn-primary" 
            onClick={handleConfirm}
            disabled={!targetDate}
          >
            Swap Days
          </button>
        </div>
      </div>
    </div>
  );
}
