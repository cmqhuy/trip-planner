import { useState, useEffect } from 'react';
import { 
  X, Sparkles, Plus, Trash2, AlertCircle, Edit2, ChevronUp, ChevronDown, GripVertical,
  Calendar, Ticket, Compass, HelpCircle, MapPin, Info, Smile, Camera, Utensils, 
  ShoppingBag, Coffee, DollarSign, BookOpen, Clock, Baby,
  Sparkle, Wand2, Brain, Bot, Activity, TrendingUp, Flame, Gem, Sun, Heart, Globe, Languages, Map
} from 'lucide-react';
import type { Trip } from '../types';
import { AI_DETAIL_FIELDS, DEFAULT_AI_ICONS } from '../utils/ai';

// Mapping string to Lucide component
export const FIELD_ICONS_MAP: { [key: string]: React.ComponentType<any> } = {
  Sparkles,
  Sparkle,
  Wand2,
  Brain,
  Bot,
  Calendar,
  Ticket,
  Compass,
  AlertCircle,
  HelpCircle,
  MapPin,
  Info,
  Smile,
  Camera,
  Utensils,
  ShoppingBag,
  Coffee,
  DollarSign,
  BookOpen,
  Clock,
  Baby,
  Activity,
  TrendingUp,
  Flame,
  Gem,
  Sun,
  Heart,
  Globe,
  Languages,
  Map
};

export const getIconColor = (iconName: string) => {
  switch (iconName) {
    case 'Sparkles': return '#a5b4fc'; // Indigo
    case 'Sparkle': return '#c084fc'; // Purple
    case 'Wand2': return '#e9d5ff'; // Light purple
    case 'Brain': return '#f472b6'; // Pink
    case 'Bot': return '#60a5fa'; // Blue
    case 'Calendar': return '#fda4af'; // Rose
    case 'Ticket': return '#6ee7b7'; // Emerald
    case 'Compass': return '#93c5fd'; // Sky blue
    case 'AlertCircle': return '#fde047'; // Yellow
    case 'HelpCircle': return '#c084fc'; // Purple
    case 'MapPin': return '#f87171'; // Red
    case 'Info': return '#38bdf8'; // Light blue
    case 'Smile': return '#facc15'; // Yellow-green
    case 'Camera': return '#ec4899'; // Pink
    case 'Utensils': return '#fb923c'; // Orange
    case 'ShoppingBag': return '#a7f3d0'; // Light emerald
    case 'Coffee': return '#b45309'; // Brown/Amber
    case 'DollarSign': return '#34d399'; // Green
    case 'BookOpen': return '#818cf8'; // Violet
    case 'Clock': return '#a3a3a3'; // Gray
    case 'Baby': return '#fbcfe8'; // Pastel Pink
    case 'Activity': return '#fb7185'; // Rose
    case 'TrendingUp': return '#34d399'; // Green
    case 'Flame': return '#f97316'; // Orange
    case 'Gem': return '#38bdf8'; // Cyan
    case 'Sun': return '#f59e0b'; // Amber
    case 'Heart': return '#ec4899'; // Pink
    case 'Globe': return '#60a5fa'; // Blue
    case 'Languages': return '#818cf8'; // Indigo
    case 'Map': return '#10b981'; // Green
    default: return '#c084fc';
  }
};

const DAY_LEVEL_FIELDS = [
  { key: 'daily_tips', label: 'Daily Tips & Routes', defaultIcon: 'Compass', description: 'Generates daily summaries, optimal routing sequences, timing guidelines, and logistics warnings based on scheduled places.' },
  { key: 'baby_logistics', label: 'Baby Logistics', defaultIcon: 'Baby', description: 'Generates baby-specific logistics like stroller friendliness, diaper changing spots, nursing facilities, and nap planning.' }
];

interface TripAiConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
  onSave: (
    customAiFields: { title: string; key: string; description: string; icon?: string; disabled?: boolean; }[],
    disabledPlaceFields: string[],
    disabledDayFields: string[],
    placeFieldsOrder: string[]
  ) => void;
}

interface PlaceFieldItem {
  key: string;
  title: string;
  description: string;
  icon: string;
  isDefault: boolean;
  disabled: boolean;
}

export default function TripAiConfigModal({
  isOpen,
  onClose,
  trip,
  onSave
}: TripAiConfigModalProps) {
  const [disabledDayFields, setDisabledDayFields] = useState<string[]>([]);
  const [allPlaceFields, setAllPlaceFields] = useState<PlaceFieldItem[]>([]);

  // Add field form state
  const [newTitle, setNewTitle] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newIcon, setNewIcon] = useState('Sparkles');
  const [error, setError] = useState<string | null>(null);

  // Edit field states
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editIcon, setEditIcon] = useState('Sparkles');
  const [editError, setEditError] = useState<string | null>(null);

  // Popover state
  const [activeIconPickerKey, setActiveIconPickerKey] = useState<string | null>(null);

  // Drag and Drop state
  const [draggedFieldIndex, setDraggedFieldIndex] = useState<number | null>(null);
  const [dragOverFieldIndex, setDragOverFieldIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDisabledDayFields(trip.disabledDayFields || []);

      // Construct Place-Level fields
      const disabledPlaces = trip.disabledPlaceFields || [];
      const defaultFields = AI_DETAIL_FIELDS.map(f => ({
        key: f.key,
        title: f.label,
        description: f.instruction,
        icon: f.icon,
        isDefault: true,
        disabled: disabledPlaces.includes(f.key)
      }));

      const customFields = (trip.customAiFields || []).map(f => ({
        key: f.key,
        title: f.title,
        description: f.description,
        icon: f.icon || 'Sparkles',
        isDefault: false,
        disabled: !!f.disabled
      }));

      let merged = [...defaultFields, ...customFields];

      // Sort by trip.placeFieldsOrder if available
      const order = trip.placeFieldsOrder || [];
      if (order.length > 0) {
        merged.sort((a, b) => {
          let idxA = order.indexOf(a.key);
          let idxB = order.indexOf(b.key);
          if (idxA === -1) idxA = 999;
          if (idxB === -1) idxB = 999;
          return idxA - idxB;
        });
      }

      setAllPlaceFields(merged);

      setNewTitle('');
      setNewKey('');
      setNewDesc('');
      setNewIcon('Sparkles');
      setError(null);
      setEditingKey(null);
      setEditTitle('');
      setEditDesc('');
      setEditIcon('Sparkles');
      setEditError(null);
      setActiveIconPickerKey(null);
    }
  }, [isOpen, trip]);

  if (!isOpen) return null;

  const handleSelectIcon = (fieldKey: string, iconName: string) => {
    if (fieldKey === 'new-field') {
      setNewIcon(iconName);
    } else if (fieldKey === 'edit-field') {
      setEditIcon(iconName);
    } else {
      setAllPlaceFields(prev => prev.map(f => {
        if (f.key === fieldKey) {
          return { ...f, icon: iconName };
        }
        return f;
      }));
    }
  };

  const handleAddField = () => {
    setError(null);

    const title = newTitle.trim();
    const key = newKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const desc = newDesc.trim();

    if (!title || !key || !desc) {
      setError('Please fill out all fields (Title, Key, Description) for the custom field.');
      return;
    }

    if (key === 'id' || key === 'places') {
      setError('The key name is reserved. Please choose another key.');
      return;
    }

    if (
      allPlaceFields.some(f => f.key === key) || 
      DAY_LEVEL_FIELDS.some(f => f.key === key)
    ) {
      setError(`A field with the key "${key}" already exists.`);
      return;
    }

    setAllPlaceFields([...allPlaceFields, { 
      key, 
      title, 
      description: desc, 
      icon: newIcon, 
      isDefault: false, 
      disabled: false 
    }]);

    setNewTitle('');
    setNewKey('');
    setNewDesc('');
    setNewIcon('Sparkles');
  };

  const handleStartEdit = (field: PlaceFieldItem) => {
    setEditingKey(field.key);
    setEditTitle(field.title);
    setEditDesc(field.description);
    setEditIcon(field.icon || 'Sparkles');
    setEditError(null);
  };

  const handleSaveEdit = (key: string) => {
    setEditError(null);
    const title = editTitle.trim();
    const desc = editDesc.trim();

    if (!title || !desc) {
      setEditError('Title and description cannot be empty.');
      return;
    }

    setAllPlaceFields(allPlaceFields.map(f => {
      if (f.key === key) {
        return { ...f, title, description: desc, icon: editIcon };
      }
      return f;
    }));
    setEditingKey(null);
  };

  const handleRemoveField = (keyToRemove: string) => {
    setAllPlaceFields(allPlaceFields.filter(f => f.key !== keyToRemove));
    if (editingKey === keyToRemove) {
      setEditingKey(null);
    }
  };

  const handleMovePlaceField = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index > 0) {
      const list = [...allPlaceFields];
      const [item] = list.splice(index, 1);
      list.splice(index - 1, 0, item);
      setAllPlaceFields(list);
    } else if (direction === 'down' && index < allPlaceFields.length - 1) {
      const list = [...allPlaceFields];
      const [item] = list.splice(index, 1);
      list.splice(index + 1, 0, item);
      setAllPlaceFields(list);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const disabledPlaceFields = allPlaceFields.filter(f => f.isDefault && f.disabled).map(f => f.key);
    const customFields = allPlaceFields.filter(f => !f.isDefault).map(f => ({
      title: f.title,
      key: f.key,
      description: f.description,
      icon: f.icon,
      disabled: !!f.disabled
    }));
    const placeFieldsOrder = allPlaceFields.map(f => f.key);

    onSave(customFields, disabledPlaceFields, disabledDayFields, placeFieldsOrder);
    onClose();
  };

  const renderIconPicker = (fieldKey: string, currentIconName: string) => {
    const IconComponent = FIELD_ICONS_MAP[currentIconName] || HelpCircle;
    const color = getIconColor(currentIconName);
    const isOpen = activeIconPickerKey === fieldKey;

    return (
      <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, marginTop: '-3px' }}>
        <button
          type="button"
          className="btn-secondary"
          style={{
            padding: '4px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '28px',
            width: '28px',
            borderColor: 'rgba(255, 255, 255, 0.08)',
            background: 'rgba(255, 255, 255, 0.02)',
            cursor: trip.canEdit !== false ? 'pointer' : 'default'
          }}
          disabled={trip.canEdit === false}
          onClick={(e) => {
            e.stopPropagation();
            setActiveIconPickerKey(isOpen ? null : fieldKey);
          }}
          title="Choose Icon"
        >
          <IconComponent size={14} style={{ color }} />
        </button>

        {isOpen && (
          <>
            <div 
              style={{ 
                position: 'fixed', 
                top: 0, 
                left: 0, 
                width: '100vw',
                height: '100vh',
                background: 'transparent',
                zIndex: 999 
              }} 
              onClick={(e) => {
                e.stopPropagation();
                setActiveIconPickerKey(null);
              }} 
            />
            <div 
              className="glass-panel" 
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                padding: '8px',
                display: 'grid',
                gridTemplateColumns: 'repeat(6, 1fr)',
                gap: '6px',
                zIndex: 1000,
                width: '210px',
                backgroundColor: 'rgba(11, 15, 25, 0.95)',
                borderColor: 'rgba(255, 255, 255, 0.12)',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
                borderRadius: '8px',
                backdropFilter: 'blur(12px)'
              }}
              onClick={e => e.stopPropagation()}
            >
              {DEFAULT_AI_ICONS.map(iconName => {
                const PickerIcon = FIELD_ICONS_MAP[iconName] || HelpCircle;
                const pickerColor = getIconColor(iconName);
                return (
                  <button
                    key={iconName}
                    type="button"
                    style={{
                      padding: '6px',
                      borderRadius: '4px',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: currentIconName === iconName ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onClick={() => {
                      handleSelectIcon(fieldKey, iconName);
                      setActiveIconPickerKey(null);
                    }}
                    title={iconName}
                  >
                    <PickerIcon size={14} style={{ color: pickerColor }} />
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderIcon = (iconName: string) => {
    const IconComponent = FIELD_ICONS_MAP[iconName] || HelpCircle;
    const color = getIconColor(iconName);
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '28px', width: '28px', flexShrink: 0, marginTop: '-3px' }}>
        <IconComponent size={14} style={{ color }} />
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content glass-panel scrollable" 
        style={{ maxWidth: '560px' }} 
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} style={{ color: 'var(--accent-primary)' }} />
            Trip AI Config Settings
          </h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-scroll-body" style={{ marginTop: '4px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '20px', textTransform: 'none' }}>
              Configure and rearrange which AI fields will be generated by Gemini for <strong>{trip.name}</strong>.
            </p>

            {/* GROUP 1: Day-Level Fields */}
            <div style={{ marginBottom: '24px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '4px' }}>
                Day-Level Fields
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {DAY_LEVEL_FIELDS.map(field => {
                  const isEnabled = !disabledDayFields.includes(field.key);
                  const iconName = field.defaultIcon; // Static icons for day-level fields as well

                  return (
                    <div 
                      key={field.key} 
                      className="glass-panel" 
                      style={{ 
                        padding: '10px 12px', 
                        display: 'flex', 
                        alignItems: 'flex-start',
                        gap: '10px',
                        borderColor: 'rgba(255,255,255,0.04)',
                        backgroundColor: 'rgba(255,255,255,0.01)'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        disabled={trip.canEdit === false}
                        onChange={e => {
                          if (e.target.checked) {
                            setDisabledDayFields(prev => prev.filter(k => k !== field.key));
                          } else {
                            setDisabledDayFields(prev => [...prev, field.key]);
                          }
                        }}
                        style={{ width: '16px', height: '16px', margin: '4px 0 0 0', flexShrink: 0, cursor: trip.canEdit !== false ? 'pointer' : 'default' }}
                      />
                      
                      {renderIcon(iconName)}

                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {field.label}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.3, textTransform: 'none' }}>
                          {field.description}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* GROUP 2: Place-Level Fields */}
            <div style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '4px' }}>
                Place-Level Fields
              </span>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {allPlaceFields.map((field, idx) => {
                  const isEditing = editingKey === field.key;
                  const isDragOver = idx === dragOverFieldIndex && draggedFieldIndex !== null && draggedFieldIndex !== idx;
                  const showLineAtBottom = draggedFieldIndex !== null && draggedFieldIndex < idx;

                  return (
                    <div 
                      key={field.key} 
                      className="glass-panel" 
                      draggable={trip.canEdit !== false && !isEditing}
                      onDragStart={(e) => {
                        setDraggedFieldIndex(idx);
                        if (e.dataTransfer) {
                          e.dataTransfer.effectAllowed = 'move';
                        }
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOverFieldIndex !== idx) {
                          setDragOverFieldIndex(idx);
                        }
                      }}
                      onDragLeave={() => {
                        setDragOverFieldIndex(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOverFieldIndex(null);
                        if (draggedFieldIndex === null || draggedFieldIndex === idx) return;
                        const list = [...allPlaceFields];
                        const [removed] = list.splice(draggedFieldIndex, 1);
                        list.splice(idx, 0, removed);
                        setAllPlaceFields(list);
                        setDraggedFieldIndex(null);
                      }}
                      onDragEnd={() => {
                        setDraggedFieldIndex(null);
                        setDragOverFieldIndex(null);
                      }}
                      style={{ 
                        padding: '10px 12px', 
                        display: 'flex', 
                        flexDirection: 'column',
                        borderColor: 'rgba(255,255,255,0.05)',
                        backgroundColor: 'rgba(255,255,255,0.01)',
                        gap: '8px',
                        position: 'relative',
                        opacity: draggedFieldIndex === idx ? 0.4 : 1,
                        cursor: trip.canEdit !== false && !isEditing ? 'grab' : 'default',
                        transition: 'opacity 0.2s ease',
                        zIndex: (activeIconPickerKey === field.key || (editingKey === field.key && activeIconPickerKey === 'edit-field')) ? 100 : (draggedFieldIndex === idx ? 0.4 : 1)
                      }}
                    >
                      {isDragOver && (
                        <div style={{
                          position: 'absolute',
                          top: showLineAtBottom ? 'auto' : '-4px',
                          bottom: showLineAtBottom ? '-4px' : 'auto',
                          left: 0,
                          right: 0,
                          height: '4px',
                          background: 'var(--accent-primary)',
                          borderRadius: '2px',
                          boxShadow: '0 0 8px var(--accent-primary)',
                          zIndex: 10,
                          pointerEvents: 'none'
                        }} />
                      )}

                      {isEditing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                              Editing Custom Field
                            </span>
                            <code style={{ fontSize: '10px', color: 'var(--accent-primary)', background: 'rgba(99,102,241,0.1)', padding: '1px 5px', borderRadius: '4px' }}>
                              key: {field.key}
                            </code>
                          </div>
                          
                          <div className="form-row" style={{ gap: '8px', alignItems: 'flex-end' }}>
                            <div className="form-group" style={{ margin: 0, flex: 1 }}>
                              <label style={{ fontSize: '11px', marginBottom: '2px' }}>Field Title</label>
                              <input
                                type="text"
                                value={editTitle}
                                onChange={e => setEditTitle(e.target.value)}
                                style={{ padding: '5px 8px', fontSize: '12px', height: '30px' }}
                              />
                            </div>
                            <div className="form-group" style={{ margin: 0, flexShrink: 0 }}>
                              <label style={{ fontSize: '11px', marginBottom: '2px' }}>Icon</label>
                              <div style={{ display: 'block' }}>
                                {renderIconPicker('edit-field', editIcon)}
                              </div>
                            </div>
                          </div>

                          <div className="form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '11px', marginBottom: '2px' }}>Instructions for Gemini</label>
                            <textarea
                              value={editDesc}
                              onChange={e => setEditDesc(e.target.value)}
                              rows={2}
                              style={{ padding: '6px 8px', fontSize: '12px', minHeight: '48px', resize: 'vertical' }}
                            />
                          </div>

                          {editError && (
                            <div className="ai-settings-test-panel error" style={{ padding: '4px 8px', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <AlertCircle size={12} style={{ flexShrink: 0 }} />
                              <span style={{ fontSize: '11px', textTransform: 'none' }}>{editError}</span>
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '4px' }}
                              onClick={() => {
                                setEditingKey(null);
                                setEditError(null);
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="btn-primary"
                              style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '4px' }}
                              onClick={() => handleSaveEdit(field.key)}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', width: '100%' }}>
                          
                          {/* Drag handle */}
                          {trip.canEdit !== false && (
                            <div 
                              style={{ 
                                cursor: 'grab', 
                                color: 'var(--text-muted)', 
                                display: 'flex', 
                                alignItems: 'center',
                                alignSelf: 'stretch',
                                paddingRight: '2px',
                                opacity: 0.6
                              }}
                            >
                              <GripVertical size={14} />
                            </div>
                          )}

                          <input
                            type="checkbox"
                            checked={!field.disabled}
                            disabled={trip.canEdit === false}
                            onChange={e => {
                              const nextFields = allPlaceFields.map((f, fIdx) => {
                                if (fIdx === idx) {
                                  return { ...f, disabled: !e.target.checked };
                                }
                                return f;
                              });
                              setAllPlaceFields(nextFields);
                            }}
                            style={{ width: '16px', height: '16px', margin: '4px 0 0 0', flexShrink: 0, cursor: trip.canEdit !== false ? 'pointer' : 'default' }}
                          />

                          {/* Default fields render static icon, Custom fields render picker */}
                          {field.isDefault ? renderIcon(field.icon) : renderIconPicker(field.key, field.icon)}

                          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <strong style={{ fontSize: '13px', color: 'var(--text-primary)', textTransform: 'none' }}>{field.title}</strong>
                              {!field.isDefault && (
                                <code style={{ fontSize: '10px', color: 'var(--accent-primary)', background: 'rgba(99,102,241,0.1)', padding: '1px 5px', borderRadius: '4px' }}>
                                  key: {field.key}
                                </code>
                              )}
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', textTransform: 'none', lineHeight: 1.3 }}>
                              {field.description}
                            </span>
                          </div>

                          {trip.canEdit !== false && (
                            <div style={{ display: 'flex', gap: '4px', flexShrink: 0, alignItems: 'center', alignSelf: 'center' }}>
                              {/* Move Up */}
                              <button
                                type="button"
                                className="mini-icon-btn desktop-only"
                                onClick={() => handleMovePlaceField(idx, 'up')}
                                disabled={idx === 0}
                                style={{
                                  padding: '4px',
                                  height: '24px',
                                  width: '24px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: '4px',
                                  opacity: idx === 0 ? 0.3 : 1
                                }}
                                title="Move Up"
                              >
                                <ChevronUp size={13} />
                              </button>
                              {/* Move Down */}
                              <button
                                type="button"
                                className="mini-icon-btn desktop-only"
                                onClick={() => handleMovePlaceField(idx, 'down')}
                                disabled={idx === allPlaceFields.length - 1}
                                style={{
                                  padding: '4px',
                                  height: '24px',
                                  width: '24px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: '4px',
                                  opacity: idx === allPlaceFields.length - 1 ? 0.3 : 1
                                }}
                                title="Move Down"
                              >
                                <ChevronDown size={13} />
                              </button>

                              {/* Only custom fields can be edited/deleted */}
                              {!field.isDefault && (
                                <>
                                  {/* Edit */}
                                  <button 
                                    type="button" 
                                    className="btn-secondary" 
                                    onClick={() => handleStartEdit(field)}
                                    style={{ padding: '4px', height: '24px', width: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}
                                    title="Edit Field"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  {/* Delete */}
                                  <button 
                                    type="button" 
                                    className="trip-delete-btn" 
                                    onClick={() => handleRemoveField(field.key)}
                                    style={{ padding: '4px', height: '24px', width: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    title="Delete Field"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {allPlaceFields.length === 0 && (
                  <div style={{ padding: '16px', textTransform: 'none', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic' }}>
                    No Place-Level fields active.
                  </div>
                )}
              </div>

              {/* Add Custom Field Form */}
              {trip.canEdit !== false && (
                <div 
                  className="glass-panel" 
                  style={{ 
                    marginTop: '12px', 
                    padding: '12px', 
                    borderStyle: 'dashed', 
                    borderColor: 'rgba(255,255,255,0.12)',
                    backgroundColor: 'rgba(255,255,255,0.01)',
                    position: 'relative',
                    zIndex: activeIconPickerKey === 'new-field' ? 100 : 1
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Add Custom Field</span>
                  
                  {error && (
                    <div 
                      className="ai-settings-test-panel error" 
                      style={{ padding: '8px 10px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <AlertCircle size={14} style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: '11.5px', textTransform: 'none', lineHeight: 1.3 }}>{error}</span>
                    </div>
                  )}

                  <div className="form-row" style={{ gap: '8px', alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ flex: 1, margin: 0 }}>
                      <label htmlFor="new-field-title" style={{ fontSize: '11px' }}>Field Title</label>
                      <input
                        type="text"
                        id="new-field-title"
                        placeholder="e.g. Photography Spots"
                        value={newTitle}
                        onChange={e => {
                          setNewTitle(e.target.value);
                          const rawKey = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
                          setNewKey(rawKey);
                        }}
                        style={{ padding: '5px 8px', fontSize: '12px', height: '30px' }}
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1, margin: 0 }}>
                      <label htmlFor="new-field-key" style={{ fontSize: '11px' }}>System Key (alphanumeric)</label>
                      <input
                        type="text"
                        id="new-field-key"
                        placeholder="e.g. photo_spots"
                        value={newKey}
                        onChange={e => setNewKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        style={{ padding: '5px 8px', fontSize: '12px', height: '30px' }}
                      />
                    </div>
                    <div className="form-group" style={{ flexShrink: 0, margin: 0 }}>
                      <label style={{ fontSize: '11px', marginBottom: '2px' }}>Icon</label>
                      <div style={{ display: 'block' }}>
                        {renderIconPicker('new-field', newIcon)}
                      </div>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginTop: '8px', marginBottom: 0 }}>
                    <label htmlFor="new-field-desc" style={{ fontSize: '11px' }}>Instructions for Gemini</label>
                    <textarea
                      id="new-field-desc"
                      placeholder="e.g. Provide 2-3 bullet points on the best spots, angles, or timings to take pictures."
                      value={newDesc}
                      onChange={e => setNewDesc(e.target.value)}
                      rows={2}
                      style={{ padding: '6px 8px', fontSize: '12px', minHeight: '48px', resize: 'vertical' }}
                    />
                  </div>

                  <button
                    type="button"
                    className="btn-secondary flex-align"
                    style={{ fontSize: '11px', padding: '6px 12px', gap: '4px', marginTop: '10px', width: '100%', justifyContent: 'center' }}
                    onClick={handleAddField}
                  >
                    <Plus size={12} /> Add Field
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: '16px', flexShrink: 0 }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save AI Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
