import { useState, useEffect } from 'react';
import {
  Sparkles, Plus, Trash2, AlertCircle, Edit2, ChevronUp, ChevronDown, GripVertical,
  Calendar, CalendarCheck, Ticket, Compass, HelpCircle, MapPin, Info, Smile, Camera, Utensils,
  ShoppingBag, Coffee, DollarSign, BookOpen, Clock, Baby,
  Sparkle, Wand2, Brain, Bot, Activity, TrendingUp, Flame, Gem, Sun, Heart, Globe, Languages, Map
} from 'lucide-react';
import type { Trip } from '../types';
import Modal from './Modal';
import SortableList from './SortableList';
import { AI_DETAIL_FIELDS, DEFAULT_AI_ICONS } from '../utils/ai';
import { moveItem } from '../utils/sortable';

// Mapping string to Lucide component
export const FIELD_ICONS_MAP: { [key: string]: React.ComponentType<any> } = {
  Sparkles,
  Sparkle,
  Wand2,
  Brain,
  Bot,
  Calendar,
  CalendarCheck,
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
  { key: 'suggested_reservations', label: 'Suggested Reservations', defaultIcon: 'CalendarCheck', description: 'Lists attractions that require advance reservations, tickets, or bookings, and how far ahead they should be booked.' },
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
      <div className="ai-config-icon-picker-wrapper">
        <button
          type="button"
          className="btn-secondary ai-config-icon-btn"
          style={{ cursor: trip.canEdit !== false ? 'pointer' : 'default' }}
          disabled={trip.canEdit === false}
          onClick={(e) => {
            e.stopPropagation();
            setActiveIconPickerKey(isOpen ? null : fieldKey);
          }}
          data-tooltip="Choose Icon"
        >
          <IconComponent size={14} style={{ color }} />
        </button>

        {isOpen && (
          <>
            <div
              className="ai-config-icon-backdrop"
              onClick={(e) => {
                e.stopPropagation();
                setActiveIconPickerKey(null);
              }}
            />
            <div
              className="glass-panel ai-config-icon-picker-panel"
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
      <div className="ai-config-icon-static">
        <IconComponent size={14} style={{ color }} />
      </div>
    );
  };

  return (
    <Modal
      title={<><Sparkles size={18} className="text-accent" /> Trip AI Config Settings</>}
      titleClassName="modal-header-title"
      onClose={onClose}
      className="modal-content--560"
    >
        <form onSubmit={handleSubmit}>
          <div className="modal-scroll-body modal-scroll-body--mt4">
            <p className="modal-body-intro modal-body-intro--mb20">
              Configure and rearrange which AI fields will be generated by Gemini for <strong>{trip.name}</strong>.
            </p>

            {/* GROUP 1: Day-Level Fields */}
            <div className="ai-config-day-section">
              <span className="ai-config-section-heading">
                Day-Level Fields
              </span>
              <div className="ai-config-fields-list">
                {DAY_LEVEL_FIELDS.map(field => {
                  const isEnabled = !disabledDayFields.includes(field.key);
                  const iconName = field.defaultIcon;

                  return (
                    <div
                      key={field.key}
                      className="glass-panel ai-config-day-field-card"
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

                      <div className="ai-config-field-body">
                        <span className="ai-config-field-name">
                          {field.label}
                        </span>
                        <span className="ai-config-field-desc">
                          {field.description}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* GROUP 2: Place-Level Fields */}
            <div className="ai-config-place-section">
              <span className="ai-config-section-heading">
                Place-Level Fields
              </span>

              <div className="ai-config-fields-list">
                <SortableList
                  items={allPlaceFields}
                  getId={field => field.key}
                  onReorder={(from, to) => setAllPlaceFields(moveItem(allPlaceFields, from, to))}
                  disabled={trip.canEdit === false || editingKey !== null}
                  renderItem={(field, idx, { handleProps }) => {
                  const isEditing = editingKey === field.key;
                  const iconPickerOpen =
                    activeIconPickerKey === field.key ||
                    (editingKey === field.key && activeIconPickerKey === 'edit-field');

                  return (
                    <div
                      key={field.key}
                      className="glass-panel ai-config-place-field-card"
                      {...(trip.canEdit !== false && !isEditing ? handleProps : {})}
                      style={{ zIndex: iconPickerOpen ? 100 : undefined }}
                    >
                      {isEditing ? (
                        <div className="ai-config-edit-form">
                          <div className="ai-config-edit-header">
                            <span className="ai-config-edit-label">
                              Editing Custom Field
                            </span>
                            <code className="ai-config-key-badge">
                              key: {field.key}
                            </code>
                          </div>

                          <div className="form-row form-row--compact">
                            <div className="form-group form-group--no-margin flex-1">
                              <label>Field Title</label>
                              <input
                                type="text"
                                value={editTitle}
                                onChange={e => setEditTitle(e.target.value)}
                                className="ai-config-form-input"
                              />
                            </div>
                            <div className="form-group form-group--no-margin flex-shrink-0">
                              <label>Icon</label>
                              <div>
                                {renderIconPicker('edit-field', editIcon)}
                              </div>
                            </div>
                          </div>

                          <div className="form-group form-group--no-margin">
                            <label>Instructions for Gemini</label>
                            <textarea
                              value={editDesc}
                              onChange={e => setEditDesc(e.target.value)}
                              rows={2}
                              className="ai-config-form-textarea"
                            />
                          </div>

                          {editError && (
                            <div className="ai-settings-test-panel error ai-config-edit-error">
                              <AlertCircle size={12} className="flex-shrink-0" />
                              <span className="ai-config-inline-error">{editError}</span>
                            </div>
                          )}

                          <div className="ai-config-edit-actions">
                            <button
                              type="button"
                              className="btn-secondary ai-config-action-btn"
                              onClick={() => {
                                setEditingKey(null);
                                setEditError(null);
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="btn-primary ai-config-action-btn"
                              onClick={() => handleSaveEdit(field.key)}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="ai-config-field-row">

                          {/* Drag handle */}
                          {trip.canEdit !== false && (
                            <div className="ai-config-drag-handle">
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

                          <div className="ai-config-field-body">
                            <div className="ai-config-field-title-row">
                              <strong className="ai-config-field-title">{field.title}</strong>
                              {!field.isDefault && (
                                <code className="ai-config-key-badge">
                                  key: {field.key}
                                </code>
                              )}
                            </div>
                            <span className="ai-config-field-desc">
                              {field.description}
                            </span>
                          </div>

                          {trip.canEdit !== false && (
                            <div className="ai-config-field-controls">
                              {/* Move Up */}
                              <button
                                type="button"
                                className="mini-icon-btn desktop-only ai-config-move-btn"
                                onClick={() => handleMovePlaceField(idx, 'up')}
                                disabled={idx === 0}
                                style={{ opacity: idx === 0 ? 0.3 : 1 }}
                                data-tooltip="Move Up"
                              >
                                <ChevronUp size={13} />
                              </button>
                              {/* Move Down */}
                              <button
                                type="button"
                                className="mini-icon-btn desktop-only ai-config-move-btn"
                                onClick={() => handleMovePlaceField(idx, 'down')}
                                disabled={idx === allPlaceFields.length - 1}
                                style={{ opacity: idx === allPlaceFields.length - 1 ? 0.3 : 1 }}
                                data-tooltip="Move Down"
                              >
                                <ChevronDown size={13} />
                              </button>

                              {/* Only custom fields can be edited/deleted */}
                              {!field.isDefault && (
                                <>
                                  {/* Edit */}
                                  <button
                                    type="button"
                                    className="btn-secondary ai-config-move-btn"
                                    onClick={() => handleStartEdit(field)}
                                    data-tooltip="Edit Field"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  {/* Delete */}
                                  <button
                                    type="button"
                                    className="trip-delete-btn ai-config-move-btn"
                                    onClick={() => handleRemoveField(field.key)}
                                    data-tooltip="Delete Field"
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
                  }}
                />

                {allPlaceFields.length === 0 && (
                  <div className="ai-config-empty">
                    No Place-Level fields active.
                  </div>
                )}
              </div>

              {/* Add Custom Field Form */}
              {trip.canEdit !== false && (
                <div
                  className="glass-panel ai-config-add-panel"
                  style={{ zIndex: activeIconPickerKey === 'new-field' ? 100 : 1 }}
                >
                  <span className="ai-config-add-label">Add Custom Field</span>

                  {error && (
                    <div className="ai-settings-test-panel error ai-config-add-error">
                      <AlertCircle size={14} className="flex-shrink-0" />
                      <span className="ai-error-text">{error}</span>
                    </div>
                  )}

                  <div className="form-row form-row--compact">
                    <div className="form-group form-group--no-margin flex-1">
                      <label htmlFor="new-field-title">Field Title</label>
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
                        className="ai-config-form-input"
                      />
                    </div>
                    <div className="form-group form-group--no-margin flex-1">
                      <label htmlFor="new-field-key">System Key (alphanumeric)</label>
                      <input
                        type="text"
                        id="new-field-key"
                        placeholder="e.g. photo_spots"
                        value={newKey}
                        onChange={e => setNewKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        className="ai-config-form-input"
                      />
                    </div>
                    <div className="form-group form-group--no-margin flex-shrink-0">
                      <label style={{ marginBottom: '2px' }}>Icon</label>
                      <div>
                        {renderIconPicker('new-field', newIcon)}
                      </div>
                    </div>
                  </div>

                  <div className="form-group form-group--spaced">
                    <label htmlFor="new-field-desc">Instructions for Gemini</label>
                    <textarea
                      id="new-field-desc"
                      placeholder="e.g. Provide 2-3 bullet points on the best spots, angles, or timings to take pictures."
                      value={newDesc}
                      onChange={e => setNewDesc(e.target.value)}
                      rows={2}
                      className="ai-config-form-textarea"
                    />
                  </div>

                  <button
                    type="button"
                    className="btn-secondary flex-align ai-config-add-btn"
                    onClick={handleAddField}
                  >
                    <Plus size={12} /> Add Field
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="modal-actions modal-actions--mt16">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save AI Settings
            </button>
          </div>
        </form>
    </Modal>
  );
}
