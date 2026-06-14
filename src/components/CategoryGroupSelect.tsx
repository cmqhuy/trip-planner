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
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '8px 12px',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-glass)',
          borderRadius: '6px',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          fontSize: '13px',
          outline: 'none',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
        onMouseLeave={e => !isOpen && (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: selectedGroup.color,
              display: 'inline-block',
              boxShadow: `0 0 8px ${selectedGroup.color}80`,
              flexShrink: 0,
            }}
          />
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedGroup.name}</span>
        </div>
        <ChevronDown size={14} style={{ opacity: 0.7, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 999,
            background: 'var(--bg-panel)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid var(--border-glass)',
            borderRadius: '8px',
            maxHeight: '200px',
            overflowY: 'auto',
            padding: '4px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
          }}
        >
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
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: group.color,
                    display: 'inline-block',
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
