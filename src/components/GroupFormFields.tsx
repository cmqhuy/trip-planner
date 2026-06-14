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
      
      <div className="form-row" style={{ alignItems: 'flex-start' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label style={{ marginBottom: '8px', display: 'block' }}>Color</label>
          <ColorPalette value={color} onChange={setColor} />
        </div>

        <div className="form-group" style={{ flex: 1, position: 'relative' }} ref={containerRef}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            Icon Style
            <span style={{ display: 'inline-flex', verticalAlign: 'middle' }}>
              {getIconComponent(icon)}
            </span>
          </label>
          
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
              textAlign: 'left',
              boxSizing: 'border-box'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
            onMouseLeave={e => !isOpen && (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
              <span style={{ flexShrink: 0 }}>{selectedOption.emoji}</span>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedOption.label}</span>
            </div>
            <ChevronDown size={14} style={{ opacity: 0.7, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
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
                    <span style={{ flexShrink: 0 }}>{option.emoji}</span>
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
