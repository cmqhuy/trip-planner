import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Location } from '../types';
import { getLocIcon, getFormattedLocationName } from '../utils/api';

interface LocationSelectProps {
  value: string;
  onChange: (value: string) => void;
  locations: Location[];
  placeholder?: string;
  style?: React.CSSProperties;
  showAddNew?: boolean;
  buttonStyle?: React.CSSProperties;
  roundTrigger?: boolean;
}

export default function LocationSelect({ 
  value, 
  onChange, 
  locations, 
  placeholder = "No Locations Added", 
  style,
  showAddNew = false,
  buttonStyle,
  roundTrigger = false
}: LocationSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedLoc = locations.find(l => l.id === value);

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
    <div ref={containerRef} style={{ position: 'relative', width: roundTrigger ? 'auto' : '100%', ...style }}>
      {roundTrigger ? (
        <button
          type="button"
          onClick={() => (locations.length > 0 || showAddNew) && setIsOpen(!isOpen)}
          disabled={locations.length === 0 && !showAddNew}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            minWidth: '36px',
            borderRadius: '50%',
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid var(--border-glass)',
            color: 'var(--text-primary)',
            cursor: (locations.length > 0 || showAddNew) ? 'pointer' : 'not-allowed',
            outline: 'none',
            transition: 'all 0.15s ease',
            padding: 0,
            ...buttonStyle
          }}
          onMouseEnter={e => (locations.length > 0 || showAddNew) && (e.currentTarget.style.background = (buttonStyle?.background as string) || 'rgba(15, 23, 42, 0.95)')}
          onMouseLeave={e => !isOpen && (e.currentTarget.style.background = (buttonStyle?.background as string) || 'rgba(15, 23, 42, 0.8)')}
        >
          <ChevronDown size={16} style={{ opacity: 0.8, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => (locations.length > 0 || showAddNew) && setIsOpen(!isOpen)}
          disabled={locations.length === 0 && !showAddNew}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '6px 10px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-glass)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            cursor: (locations.length > 0 || showAddNew) ? 'pointer' : 'not-allowed',
            fontSize: '12px',
            outline: 'none',
            transition: 'all 0.15s ease',
            minHeight: '28px',
            textAlign: 'left',
            ...buttonStyle
          }}
          onMouseEnter={e => (locations.length > 0 || showAddNew) && (e.currentTarget.style.background = (buttonStyle?.background as string) || 'rgba(255, 255, 255, 0.05)')}
          onMouseLeave={e => !isOpen && (e.currentTarget.style.background = (buttonStyle?.background as string) || 'rgba(255, 255, 255, 0.03)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedLoc ? (
              <>
                <span style={{ fontSize: '14px', flexShrink: 0 }}>{getLocIcon(selectedLoc)}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {getFormattedLocationName(selectedLoc, locations)}
                </span>
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>{placeholder}</span>
            )}
          </div>
          {(locations.length > 0 || showAddNew) && (
            <ChevronDown size={12} style={{ opacity: 0.6, flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          )}
        </button>
      )}

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: roundTrigger ? 'auto' : 0,
            right: 0,
            width: roundTrigger ? '240px' : 'auto',
            zIndex: 999,
            background: 'var(--bg-panel)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid var(--border-glass)',
            borderRadius: '6px',
            maxHeight: '200px',
            overflowY: 'auto',
            padding: '4px',
            boxShadow: 'var(--shadow-lg)'
          }}
        >
          {locations.map(loc => {
            const isSelected = loc.id === value;
            return (
              <div
                key={loc.id}
                onClick={() => {
                  onChange(loc.id);
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)',
                  background: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                  transition: 'all 0.15s ease',
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
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
                <span style={{ fontSize: '14px', flexShrink: 0 }}>{getLocIcon(loc)}</span>
                <span style={{ fontWeight: isSelected ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {getFormattedLocationName(loc, locations)}
                </span>
              </div>
            );
          })}
          {showAddNew && (
            <div
              onClick={() => {
                onChange('ADD_NEW_LOCATION');
                setIsOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                color: 'var(--accent-primary)',
                background: 'transparent',
                transition: 'all 0.15s ease',
                borderTop: '1px solid var(--border-glass)',
                marginTop: '4px'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <span style={{ fontWeight: 600 }}>+ Add New Location</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
