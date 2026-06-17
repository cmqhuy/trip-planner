import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import type { PlaceGroup } from '../types';

interface CategoryGroupSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeGroups: PlaceGroup[];
}

export default function CategoryGroupSelect({ value, onChange, placeGroups }: CategoryGroupSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Combine Unassigned with custom groups
  const groups = [
    { id: 'new', name: 'Unassigned', color: '#9ca3af', icon: 'map-pin' },
    ...placeGroups
  ];

  const selectedGroup = groups.find(g => g.id === value) || groups[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="category-group-select">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="category-group-btn"
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
        onMouseLeave={e => !isOpen && (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)')}
      >
        <div className="category-group-trigger-inner">
          <span
            className="category-group-color-dot"
            style={{
              backgroundColor: selectedGroup.color,
              boxShadow: `0 0 8px ${selectedGroup.color}80`,
            }}
          />
          <span className="category-group-name">{selectedGroup.name}</span>
        </div>
        <ChevronDown size={14} style={{ opacity: 0.7, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {isOpen && (
        <div className="category-group-dropdown">
          {groups.map(group => {
            const isSelected = group.id === value;
            return (
              <div
                key={group.id}
                onClick={() => {
                  onChange(group.id);
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)',
                  background: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }
                }}
              >
                <span
                  className="category-dropdown-color-dot"
                  style={{
                    backgroundColor: group.color,
                    boxShadow: `0 0 6px ${group.color}60`,
                  }}
                />
                <span style={{ fontWeight: isSelected ? 600 : 400 }}>{group.name}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
