import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface NewPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (planName: string) => void;
}

export default function NewPlanModal({ isOpen, onClose, onSave }: NewPlanModalProps) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim());
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Create Plan / Version</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="new-plan-name">Plan Name</label>
            <input 
              type="text" 
              id="new-plan-name"
              placeholder="e.g. Budget Version, Option B" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              required 
              autoFocus 
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Create Plan</button>
          </div>
        </form>
      </div>
    </div>
  );
}
