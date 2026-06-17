import { useState } from 'react';
import { Check } from 'lucide-react';

const PRESET_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#f43f5e', // Rose
];

interface ColorPaletteProps {
  value: string;
  onChange: (color: string) => void;
}

export default function ColorPalette({ value, onChange }: ColorPaletteProps) {
  const [showCustom, setShowCustom] = useState(false);
  const isPreset = PRESET_COLORS.includes(value.toLowerCase());

  return (
    <div className="color-palette-wrapper">
      <div className="color-palette-swatches">
        {PRESET_COLORS.map(color => {
          const isSelected = value.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              className="color-btn"
              onClick={() => { onChange(color); setShowCustom(false); }}
              style={{
                background: color,
                border: isSelected ? '2px solid #fff' : '2px solid transparent',
                outline: isSelected ? `2px solid ${color}` : 'none',
              }}
              data-tooltip={color}
            >
              {isSelected && <Check size={14} color="#fff" strokeWidth={3} />}
            </button>
          );
        })}
        {/* Custom color trigger */}
        <button
          type="button"
          className="color-btn"
          onClick={() => setShowCustom(!showCustom)}
          style={{
            background: !isPreset ? value : 'conic-gradient(from 0deg, #ef4444, #f59e0b, #22c55e, #3b82f6, #8b5cf6, #ec4899, #ef4444)',
            border: (!isPreset || showCustom) ? '2px solid #fff' : '2px solid rgba(255,255,255,0.15)',
            outline: (!isPreset || showCustom) ? `2px solid ${!isPreset ? value : '#6366f1'}` : 'none',
          }}
          data-tooltip="Custom color"
        >
          {!isPreset && <Check size={14} color="#fff" strokeWidth={3} />}
        </button>
      </div>
      {showCustom && (
        <div className="color-palette-custom-row">
          <input
            type="color"
            className="color-picker-input"
            value={value}
            onChange={e => onChange(e.target.value)}
          />
          <span className="color-palette-hex">
            {value}
          </span>
        </div>
      )}
    </div>
  );
}
