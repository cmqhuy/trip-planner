import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import Modal from './Modal';

interface DayOption {
  value: string;
  label: string;
  locationName?: string;
  locationColor?: string;
  locationIcon?: string;
}

interface MoveDayModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDayLabel: string;
  initialTargetDate?: string;
  daysOptions: DayOption[];
  onConfirmMove: (targetDateStr: string) => void;
}

export default function MoveDayModal({
  isOpen,
  onClose,
  activeDayLabel,
  initialTargetDate,
  daysOptions,
  onConfirmMove
}: MoveDayModalProps) {
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
    onConfirmMove(targetDate);
    onClose();
  };

  const selectedOption = daysOptions.find(opt => opt.value === targetDate);

  return (
    <Modal title="Move Day" onClose={onClose} maxWidth={400}>

        <div style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'none' }}>
          Move all scheduled places of <strong>{activeDayLabel}</strong> to another day. This will override the destination day's scheduled places.
        </div>

        <div className="form-group" style={{ marginBottom: '20px', position: 'relative' }} ref={comboRef}>
          <label htmlFor="destination-day-combo-trigger">Select Destination Day</label>
          <button
            id="destination-day-combo-trigger"
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
            Move Day
          </button>
        </div>
    </Modal>
  );
}
