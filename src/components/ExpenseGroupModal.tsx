import { useState, useEffect, useRef } from 'react';
import { Trash2, ChevronDown } from 'lucide-react';
import type { ExpenseGroup } from '../types';
import Modal from './Modal';
import { EXPENSE_ICONS, getExpenseGroupIcon } from '../utils/expenseUtils';
import ColorPalette from './ColorPalette';

interface ExpenseGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  group?: ExpenseGroup | null;
  onSave: (groupData: { name: string; icon: string; color: string }) => void;
  onDelete?: () => void;
}

export default function ExpenseGroupModal({
  isOpen,
  onClose,
  group,
  onSave,
  onDelete
}: ExpenseGroupModalProps) {
  const [name, setName] = useState(group?.name || '');
  const [icon, setIcon] = useState(group?.icon || 'dollar-sign');
  const [color, setColor] = useState(group?.color || '#6366f1');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside listener for combo box
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), icon, color });
    onClose();
  };

  const selectedIconObj = EXPENSE_ICONS.find(item => item.value === icon) || EXPENSE_ICONS[9];
  const isDefaultGroup = group ? (group.id === 'hotels' || group.id === 'transports' || group.id === 'attractions' || group.id === 'dining') : false;

  return (
    <Modal title={group ? 'Edit Expense Group' : 'Create Expense Group'} onClose={onClose}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Group Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Attractions, Dining"
              required
              autoFocus
            />
          </div>

          <div className="form-row form-row--top" style={{ marginTop: '14px' }}>
            <div className="form-group flex-1">
              <label>Group Color</label>
              <ColorPalette value={color} onChange={setColor} />
            </div>

            <div className="form-group group-form-icon-select flex-1" ref={dropdownRef} style={{ position: 'relative' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                Icon Style
                <span className="group-icon-preview" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center' }}>
                  {getExpenseGroupIcon(icon, 16, '', { color })}
                </span>
              </label>

              <button
                type="button"
                className="loc-select-trigger combo-trigger"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  marginTop: '6px'
                }}
              >
                <div className="combo-trigger-content" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {getExpenseGroupIcon(selectedIconObj.value, 14, '', { color })}
                  <span>{selectedIconObj.label}</span>
                </div>
                <ChevronDown size={14} className={`expand-chevron${dropdownOpen ? ' is-open' : ''}`} />
              </button>

              {dropdownOpen && (
                <div
                  className="loc-select-dropdown combo-dropdown"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 10000,
                    background: 'rgba(15, 23, 42, 0.95)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '6px',
                    boxShadow: 'var(--shadow-lg), 0 4px 20px rgba(0,0,0,0.5)',
                    marginTop: '4px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    padding: '4px'
                  }}
                >
                  {EXPENSE_ICONS.map(option => {
                    const isSelected = option.value === icon;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`combo-option${isSelected ? ' selected' : ''}`}
                        onClick={() => {
                          setIcon(option.value);
                          setDropdownOpen(false);
                        }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 10px',
                          border: 'none',
                          textAlign: 'left',
                          cursor: 'pointer',
                          borderRadius: '4px'
                        }}
                      >
                        {getExpenseGroupIcon(option.value, 14, '', { color })}
                        <span style={{ flex: 1 }}>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: '24px' }}>
            {group && onDelete && !isDefaultGroup && (
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
    </Modal>
  );
}
