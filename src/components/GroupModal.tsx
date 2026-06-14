import { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import type { PlaceGroup } from '../types';
import GroupFormFields from './GroupFormFields';

interface GroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  group?: PlaceGroup | null;
  onSave: (groupData: { name: string; color: string; icon: string }) => void;
  onDelete?: () => void;
}

export default function GroupModal({ isOpen, onClose, group, onSave, onDelete }: GroupModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1'); // Default Indigo
  const [icon, setIcon] = useState('map-pin');

  useEffect(() => {
    if (isOpen) {
      if (group) {
        setName(group.name);
        setColor(group.color);
        setIcon(group.icon);
      } else {
        setName('');
        setColor('#6366f1');
        setIcon('map-pin');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), color, icon });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{group ? 'Edit Group' : 'Create Group'}</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <GroupFormFields 
            name={name} 
            setName={setName} 
            color={color} 
            setColor={setColor} 
            icon={icon} 
            setIcon={setIcon} 
            placeholder="e.g. Attractions, Food"
          />

          <div className="modal-actions">
            {group && onDelete && (
              <button 
                type="button" 
                className="btn-danger flex-align" 
                onClick={() => {
                  onDelete();
                  onClose();
                }}
                style={{ marginRight: 'auto', gap: '6px' }}
              >
                <Trash2 size={16} /> Delete
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">
              {group ? 'Save' : 'Add Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
