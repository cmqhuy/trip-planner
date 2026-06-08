import ColorPalette from './ColorPalette';
import { Landmark, Utensils, ShoppingBag, Camera, MapPin, Heart } from 'lucide-react';

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

        <div className="form-group" style={{ flex: 1 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            Icon Style
            <span style={{ display: 'inline-flex', verticalAlign: 'middle' }}>
              {getIconComponent(icon)}
            </span>
          </label>
          <select value={icon} onChange={e => setIcon(e.target.value)}>
            <option value="landmark">🏛️ Landmark</option>
            <option value="utensils">🍴 Restaurant / Food</option>
            <option value="shopping-bag">🛍️ Shopping</option>
            <option value="camera">📷 Photography</option>
            <option value="map-pin">📍 General</option>
            <option value="heart">💖 Favorite</option>
          </select>
        </div>
      </div>
    </>
  );
}
