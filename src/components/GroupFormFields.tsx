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
    { value: 'landmark', label: 'Landmark', iconName: 'landmark' },
    { value: 'utensils', label: 'Restaurant / Food', iconName: 'utensils' },
    { value: 'shopping-bag', label: 'Shopping', iconName: 'shopping-bag' },
    { value: 'camera', label: 'Photography', iconName: 'camera' },
    { value: 'map-pin', label: 'General', iconName: 'map-pin' },
    { value: 'heart', label: 'Favorite', iconName: 'heart' },
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

        <div className="form-group group-form-icon-select flex-1" ref={containerRef} style={{ position: 'relative' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            Icon Style
            <span className="group-icon-preview" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center' }}>
              {getIconComponent(icon)}
            </span>
          </label>

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="loc-select-trigger combo-trigger"
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
              {getIconComponent(selectedOption.value)}
              <span>{selectedOption.label}</span>
            </div>
            <ChevronDown size={14} className={`expand-chevron${isOpen ? ' is-open' : ''}`} />
          </button>

          {isOpen && (
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
              {options.map(option => {
                const isSelected = option.value === icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`combo-option${isSelected ? ' selected' : ''}`}
                    onClick={() => {
                      setIcon(option.value);
                      setIsOpen(false);
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
                    {getIconComponent(option.value)}
                    <span style={{ flex: 1 }}>{option.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
