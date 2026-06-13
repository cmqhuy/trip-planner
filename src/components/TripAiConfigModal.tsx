import { useState, useEffect } from 'react';
import { X, Sparkles, Plus, Trash2, AlertCircle, Edit2 } from 'lucide-react';
import type { Trip } from '../types';

interface TripAiConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
  onSave: (enableBabyLogistics: boolean, customAiFields: { title: string; key: string; description: string; }[]) => void;
}

export default function TripAiConfigModal({
  isOpen,
  onClose,
  trip,
  onSave
}: TripAiConfigModalProps) {
  const [enableBabyLogistics, setEnableBabyLogistics] = useState(false);
  const [customAiFields, setCustomAiFields] = useState<{ title: string; key: string; description: string }[]>([]);

  // Add field form state
  const [newTitle, setNewTitle] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Edit field states
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEnableBabyLogistics(!!trip.enableBabyLogistics);
      setCustomAiFields(trip.customAiFields || []);
      setNewTitle('');
      setNewKey('');
      setNewDesc('');
      setError(null);
      setEditingKey(null);
      setEditTitle('');
      setEditDesc('');
      setEditError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

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

    // Check if key already exists
    if (customAiFields.some(f => f.key === key)) {
      setError(`A custom field with the key "${key}" already exists.`);
      return;
    }

    setCustomAiFields([...customAiFields, { title, key, description: desc }]);
    setNewTitle('');
    setNewKey('');
    setNewDesc('');
  };

  const handleStartEdit = (field: { title: string; key: string; description: string }) => {
    setEditingKey(field.key);
    setEditTitle(field.title);
    setEditDesc(field.description);
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

    setCustomAiFields(customAiFields.map(f => {
      if (f.key === key) {
        return { ...f, title, description: desc };
      }
      return f;
    }));
    setEditingKey(null);
  };

  const handleRemoveField = (keyToRemove: string) => {
    setCustomAiFields(customAiFields.filter(f => f.key !== keyToRemove));
    if (editingKey === keyToRemove) {
      setEditingKey(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(enableBabyLogistics, customAiFields);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content glass-panel" 
        style={{ maxWidth: '500px' }} 
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} style={{ color: 'var(--accent-primary)' }} />
            Trip AI Settings
          </h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <div className="modal-scroll-body" style={{ marginTop: '12px', flex: 1, overflowY: 'auto', maxHeight: '70vh', paddingRight: '4px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '16px', textTransform: 'none' }}>
              Configure AI parameters and custom fields for <strong>{trip.name}</strong>.
            </p>

            {/* 1. Baby Logistics Checkbox */}
            <div className="form-group" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '16px', marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', textTransform: 'none', fontWeight: 'normal' }}>
                <input
                  type="checkbox"
                  checked={enableBabyLogistics}
                  onChange={e => setEnableBabyLogistics(e.target.checked)}
                  style={{ width: '18px', height: '18px', margin: '2px 0 0 0', flexShrink: 0, cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Baby Logistics (Day-level)</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.3 }}>
                    Check this if you are traveling with a baby or toddler. Daily tips will automatically generate baby-specific logistics like stroller friendliness, nursing spots, and nap schedules.
                  </span>
                </div>
              </label>
            </div>

            {/* 2. Custom AI Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>Custom AI Fields (Place-level)</span>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'none', lineHeight: 1.3 }}>
                Add custom fields (e.g. Photo Recommendations, Vegan Food Options) to include in place guides when generating AI details.
              </p>

              {/* Current fields list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                {customAiFields.map(field => {
                  const isEditing = editingKey === field.key;
                  return (
                    <div 
                      key={field.key} 
                      className="glass-panel" 
                      style={{ 
                        padding: '10px 12px', 
                        display: 'flex', 
                        flexDirection: 'column',
                        borderColor: 'rgba(255,255,255,0.05)',
                        backgroundColor: 'rgba(255,255,255,0.01)',
                        gap: '8px'
                      }}
                    >
                      {isEditing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                              Editing Custom Field
                            </span>
                            <code style={{ fontSize: '10px', color: 'var(--accent-primary)', background: 'rgba(99,102,241,0.1)', padding: '1px 5px', borderRadius: '4px' }}>
                              key: {field.key} (read-only)
                            </code>
                          </div>
                          
                          <div className="form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '11px', marginBottom: '2px' }}>Field Title</label>
                            <input
                              type="text"
                              value={editTitle}
                              onChange={e => setEditTitle(e.target.value)}
                              style={{ padding: '5px 8px', fontSize: '12px', height: '30px' }}
                            />
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', width: '100%' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <strong style={{ fontSize: '13px', color: 'var(--text-primary)', textTransform: 'none' }}>{field.title}</strong>
                              <code style={{ fontSize: '10px', color: 'var(--accent-primary)', background: 'rgba(99,102,241,0.1)', padding: '1px 5px', borderRadius: '4px' }}>
                                key: {field.key}
                              </code>
                            </div>
                            <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px', textTransform: 'none', lineHeight: 1.3 }}>
                              {field.description}
                            </span>
                          </div>
                          {trip.canEdit !== false && (
                            <div style={{ display: 'flex', gap: '6px', flexShrink: 0, marginTop: '2px' }}>
                              <button 
                                type="button" 
                                className="btn-secondary" 
                                onClick={() => handleStartEdit(field)}
                                style={{ padding: '4px', height: '24px', width: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}
                                title="Edit Field"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button 
                                type="button" 
                                className="trip-delete-btn" 
                                onClick={() => handleRemoveField(field.key)}
                                style={{ padding: '4px', height: '24px', width: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                title="Delete Field"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {customAiFields.length === 0 && (
                  <div style={{ padding: '16px', textTransform: 'none', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic' }}>
                    No custom AI fields added.
                  </div>
                )}
              </div>

              {/* Add field form */}
              {trip.canEdit !== false && (
                <div 
                  className="glass-panel" 
                  style={{ 
                    marginTop: '12px', 
                    padding: '12px', 
                    borderStyle: 'dashed', 
                    borderColor: 'rgba(255,255,255,0.12)',
                    backgroundColor: 'rgba(255,255,255,0.01)'
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

                  <div className="form-row" style={{ gap: '8px' }}>
                    <div className="form-group" style={{ flex: 1 }}>
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
                    <div className="form-group" style={{ flex: 1 }}>
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
                  </div>

                  <div className="form-group" style={{ marginTop: '8px' }}>
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

          <div className="modal-actions" style={{ marginTop: '20px', flexShrink: 0 }}>
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
