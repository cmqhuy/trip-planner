import { useState, useRef, useEffect } from 'react';
import ColorPalette from './ColorPalette';
import { Landmark, Utensils, ShoppingBag, Camera, MapPin, Heart, ChevronDown } from 'lucide-react';

interface GroupFormFieldsProps {
  name: string;
  setName: (val: string) => void;
  color: string;
  setColor: (val: string) => void;
  icon: string;
  setIcon: (val: string) => void;
  placeholder?: string;
}

export default function GroupFormFields({
  name,
  setName,
  color,
  setColor,
  icon,
  setIcon,
  placeholder = "e.g. Museums, Coffee Shops"
}: GroupFormFieldsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const options = [
    { value: 'landmark', label: 'Landmark', emoji: '🏛️', iconName: 'landmark' },
    { value: 'utensils', label: 'Restaurant / Food', emoji: '🍴', iconName: 'utensils' },
    { value: 'shopping-bag', label: 'Shopping', emoji: '🛍️', iconName: 'shopping-bag' },
    { value: 'camera', label: 'Photography', emoji: '📷', iconName: 'camera' },
    { value: 'map-pin', label: 'General', emoji: '📍', iconName: 'map-pin' },
    { value: 'heart', label: 'Favorite', emoji: '💖', iconName: 'heart' },
  ];

  const selectedOption = options.find(o => o.value === icon) || options[4];

  const getIconComponent = (iconName: string) => {
    const props = { size: 14, style: { color } };
    switch (iconName) {
      case 'landmark': return <Landmark {...props} />;
      case 'utensils': return <Utensils {...props} />;
      case 'shopping-bag': return <ShoppingBag {...props} />;
      case 'camera': return <Camera {...props} />;
      case 'heart': return <Heart {...props} />;
      default: return <MapPin {...props} />;
    }
  };

  return (
    <>
      <div className="form-group">
        <label>Group Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={placeholder}
          required
          autoFocus
        />
      </div>

      <div className="form-row form-row--top">
        <div className="form-group flex-1">
          <label>Color</label>
          <ColorPalette value={color} onChange={setColor} />
        </div>

        <div className="form-group group-form-icon-select" ref={containerRef}>
          <label>
            Icon Style
            <span className="group-icon-preview">
              {getIconComponent(icon)}
            </span>
          </label>

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="group-icon-btn"
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
            onMouseLeave={e => !isOpen && (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)')}
          >
            <div className="group-icon-trigger-inner">
              <span className="flex-shrink-0">{selectedOption.emoji}</span>
              <span className="group-icon-label">{selectedOption.label}</span>
            </div>
            <ChevronDown size={14} style={{ opacity: 0.7, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
          </button>

          {isOpen && (
            <div className="group-icon-dropdown">
              {options.map(option => {
                const isSelected = option.value === icon;
                return (
                  <div
                    key={option.value}
                    onClick={() => {
                      setIcon(option.value);
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
                    <span className="flex-shrink-0">{option.emoji}</span>
                    <span style={{ fontWeight: isSelected ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{option.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
