import { useState, useRef, useEffect } from 'react';
import { ChevronDown, MapPin } from 'lucide-react';
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
  showClearOption?: boolean;
}

export default function LocationSelect({
  value,
  onChange,
  locations,
  placeholder = "No Locations Added",
  style,
  showAddNew = false,
  buttonStyle,
  roundTrigger = false,
  showClearOption = false
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
          className="loc-select-trigger-round"
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
            boxSizing: 'border-box',
            flexShrink: 0,
            border: '1px solid var(--border-glass)',
            color: 'var(--text-primary)',
            cursor: (locations.length > 0 || showAddNew) ? 'pointer' : 'not-allowed',
            outline: 'none',
            transition: 'all 0.15s ease',
            padding: 0,
            ...buttonStyle
          }}
        >
          <ChevronDown size={16} style={{ opacity: 0.8, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
        </button>
      ) : (
        <button
          type="button"
          className="loc-select-trigger"
          onClick={() => (locations.length > 0 || showAddNew) && setIsOpen(!isOpen)}
          disabled={locations.length === 0 && !showAddNew}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '6px 10px',
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
        >
          <div className="loc-select-trigger-inner">
            {selectedLoc ? (
              <>
                <span className="loc-select-emoji">{getLocIcon(selectedLoc)}</span>
                <span className="loc-select-name">
                  {getFormattedLocationName(selectedLoc, locations)}
                </span>
              </>
            ) : (
              <span className="text-muted">{placeholder}</span>
            )}
          </div>
          {(locations.length > 0 || showAddNew) && (
            <ChevronDown size={12} style={{ opacity: 0.6, flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          )}
        </button>
      )}

      {isOpen && (
        <div
          className="loc-select-dropdown"
          style={{ left: roundTrigger ? 'auto' : 0, width: roundTrigger ? '240px' : 'auto' }}
        >
          {showClearOption && locations.length > 0 && (
            <>
              <div
                onClick={() => {
                  onChange('');
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
                  color: !value ? 'var(--text-primary)' : 'var(--text-muted)',
                  background: !value ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                  transition: 'all 0.15s ease',
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={e => {
                  if (value) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={e => {
                  if (value) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }
                }}
              >
                <MapPin size={14} className="flex-shrink-0" />
                <span style={{ fontWeight: !value ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {placeholder && placeholder !== "No Locations Added" ? placeholder : "Select Location..."}
                </span>
              </div>
              <div className="loc-select-divider" />
            </>
          )}
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
                <span className="loc-select-emoji">{getLocIcon(loc)}</span>
                <span style={{ fontWeight: isSelected ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {getFormattedLocationName(loc, locations)}
                </span>
              </div>
            );
          })}
          {showAddNew && (
            <div
              className="loc-select-add-new"
              onClick={() => {
                onChange('ADD_NEW_LOCATION');
                setIsOpen(false);
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <span className="loc-select-add-new-label">+ Add New Location</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
