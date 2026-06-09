import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface DayOption {
  value: string;
  label: string;
}

interface MoveDayModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDayLabel: string;
  daysOptions: DayOption[];
  onConfirmMove: (targetDateStr: string) => void;
}

export default function MoveDayModal({
  isOpen,
  onClose,
  activeDayLabel,
  daysOptions,
  onConfirmMove
}: MoveDayModalProps) {
  const [targetDate, setTargetDate] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Set to first available option as default
      if (daysOptions.length > 0) {
        setTargetDate(daysOptions[0].value);
      } else {
        setTargetDate('');
      }
    }
  }, [isOpen, daysOptions]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!targetDate) return;
    onConfirmMove(targetDate);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Move Day Contents</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <div style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'none' }}>
          Move all scheduled places of <strong>{activeDayLabel}</strong> to another day. This will override the destination day's scheduled places.
        </div>

        <div className="form-group" style={{ marginBottom: '20px' }}>
          <label htmlFor="destination-day">Select Destination Day</label>
          <select 
            id="destination-day"
            value={targetDate} 
            onChange={e => setTargetDate(e.target.value)}
            style={{ width: '100%', background: 'var(--bg-dark)' }}
          >
            {daysOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button 
            className="btn-primary" 
            onClick={handleConfirm}
            disabled={!targetDate}
          >
            Move Contents
          </button>
        </div>
      </div>
    </div>
  );
}
