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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
        {PRESET_COLORS.map(color => {
          const isSelected = value.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              onClick={() => { onChange(color); setShowCustom(false); }}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: color,
                border: isSelected ? '2px solid #fff' : '2px solid transparent',
                outline: isSelected ? `2px solid ${color}` : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
                flexShrink: 0,
                padding: 0,
              }}
              title={color}
            >
              {isSelected && <Check size={14} color="#fff" strokeWidth={3} />}
            </button>
          );
        })}
        {/* Custom color trigger */}
        <button
          type="button"
          onClick={() => setShowCustom(!showCustom)}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: !isPreset ? value : 'conic-gradient(from 0deg, #ef4444, #f59e0b, #22c55e, #3b82f6, #8b5cf6, #ec4899, #ef4444)',
            border: (!isPreset || showCustom) ? '2px solid #fff' : '2px solid rgba(255,255,255,0.15)',
            outline: (!isPreset || showCustom) ? `2px solid ${!isPreset ? value : '#6366f1'}` : 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
            flexShrink: 0,
            padding: 0,
          }}
          title="Custom color"
        >
          {!isPreset && <Check size={14} color="#fff" strokeWidth={3} />}
        </button>
      </div>
      {showCustom && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="color"
            value={value}
            onChange={e => onChange(e.target.value)}
            style={{
              padding: 0,
              width: '32px',
              height: '32px',
              border: '1px solid var(--border-glass)',
              borderRadius: '6px',
              cursor: 'pointer',
              background: 'none',
            }}
          />
          <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
            {value}
          </span>
        </div>
      )}
    </div>
  );
}
