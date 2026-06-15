import { useState, memo } from 'react';
import { 
  ChevronUp, ChevronDown, Trash2, 
  RefreshCw, Sparkles, GripVertical
} from 'lucide-react';
import type { Trip, Plan } from '../types';
import FunGeneratingLoader from './FunGeneratingLoader';
import AiMarkdownSection from './AiMarkdownSection';

interface ChecklistSectionProps {
  trip: Trip;
  activePlan: Plan;
  generatingChecklist: boolean;
  onGenerateTripChecklist: () => void;
  onSaveAiChecklist: (content: string) => void;
  onUpdateTrip: (updatedTrip: Trip | ((prevTrip: Trip) => Trip)) => void;
}

function ChecklistSection({
  trip,
  activePlan,
  generatingChecklist,
  onGenerateTripChecklist,
  onSaveAiChecklist,
  onUpdateTrip
}: ChecklistSectionProps) {
  const [manualChecklistInput, setManualChecklistInput] = useState('');
  const [draggedChecklistIndex, setDraggedChecklistIndex] = useState<number | null>(null);
  const [dragOverChecklistIndex, setDragOverChecklistIndex] = useState<number | null>(null);

  const handleAddManualChecklistItem = (text: string) => {
    if (!text.trim()) return;
    const newItem = {
      id: `task-${Date.now()}`,
      text: text.trim(),
      completed: false
    };

    onUpdateTrip(prevTrip => {
      const updatedPlans = prevTrip.plans.map(p => {
        if (p.id === activePlan.id) {
          return {
            ...p,
            manualChecklist: [...(p.manualChecklist || []), newItem]
          };
        }
        return p;
      });
      return {
        ...prevTrip,
        plans: updatedPlans
      };
    });
  };

  const handleToggleManualChecklistItem = (id: string) => {
    onUpdateTrip(prevTrip => {
      const updatedPlans = prevTrip.plans.map(p => {
        if (p.id === activePlan.id) {
          const updatedList = (p.manualChecklist || []).map(item => 
            item.id === id ? { ...item, completed: !item.completed } : item
          );
          return {
            ...p,
            manualChecklist: updatedList
          };
        }
        return p;
      });
      return {
        ...prevTrip,
        plans: updatedPlans
      };
    });
  };

  const handleMoveManualChecklistItem = (id: string, direction: 'up' | 'down') => {
    onUpdateTrip(prevTrip => {
      const updatedPlans = prevTrip.plans.map(p => {
        if (p.id === activePlan.id) {
          const list = [...(p.manualChecklist || [])];
          const idx = list.findIndex(item => item.id === id);
          if (idx === -1) return p;
          if (direction === 'up' && idx > 0) {
            const temp = list[idx];
            list[idx] = list[idx - 1];
            list[idx - 1] = temp;
          } else if (direction === 'down' && idx < list.length - 1) {
            const temp = list[idx];
            list[idx] = list[idx + 1];
            list[idx + 1] = temp;
          }
          return {
            ...p,
            manualChecklist: list
          };
        }
        return p;
      });
      return {
        ...prevTrip,
        plans: updatedPlans
      };
    });
  };

  const handleDeleteManualChecklistItem = (id: string) => {
    onUpdateTrip(prevTrip => {
      const updatedPlans = prevTrip.plans.map(p => {
        if (p.id === activePlan.id) {
          return {
            ...p,
            manualChecklist: (p.manualChecklist || []).filter(item => item.id !== id)
          };
        }
        return p;
      });
      return {
        ...prevTrip,
        plans: updatedPlans
      };
    });
  };

  return (
    <div className="accordion-content">
      {/* Section A: Manual Checklist */}
      <div className="left-panel-subsection">
          <div className="subsection-header">
            <h4 className="subsection-title">Personal Checklist</h4>
          </div>
          
          {trip.canEdit !== false && (
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleAddManualChecklistItem(manualChecklistInput);
                setManualChecklistInput('');
              }}
              style={{ display: 'flex', gap: '6px', marginBottom: '2px' }}
            >
              <input 
                type="text" 
                placeholder="Add new task..." 
                value={manualChecklistInput} 
                onChange={(e) => setManualChecklistInput(e.target.value)}
                style={{ flex: 1, padding: '4px 8px', fontSize: '12px', height: '28px' }}
              />
              <button 
                type="submit" 
                className="btn-primary" 
                style={{ padding: '4px 10px', fontSize: '11px', height: '28px' }}
              >
                Add
              </button>
            </form>
          )}

          <div className="subsection-content">
            {(activePlan.manualChecklist || []).map((item, idx) => {
              const isDragOver = idx === dragOverChecklistIndex && draggedChecklistIndex !== null && draggedChecklistIndex !== idx;
              const showLineAtBottom = draggedChecklistIndex !== null && draggedChecklistIndex < idx;
              console.log('RENDER checklist item idx:', idx, 'isDragOver:', isDragOver, 'draggedIndex:', draggedChecklistIndex, 'dragOverIndex:', dragOverChecklistIndex);
              return (
                <div key={item.id} style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                  {isDragOver && (
                    <div style={{
                      position: 'absolute',
                      top: showLineAtBottom ? 'auto' : '-5px',
                      bottom: showLineAtBottom ? '-5px' : 'auto',
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
                  <div 
                    className={`checklist-item-row ${dragOverChecklistIndex === idx ? 'drag-over' : ''}`}
                    draggable={trip.canEdit !== false}
                    onDragStart={(e) => {
                      console.log('DRAGSTART checklist idx:', idx);
                      setDraggedChecklistIndex(idx);
                      if (e.dataTransfer) {
                        e.dataTransfer.effectAllowed = 'move';
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      console.log('DRAGOVER checklist idx:', idx, 'draggedIndex:', draggedChecklistIndex, 'dragOverIndex:', dragOverChecklistIndex);
                      if (dragOverChecklistIndex !== idx) {
                        setDragOverChecklistIndex(idx);
                      }
                    }}
                    onDragLeave={() => {
                      console.log('DRAGLEAVE checklist idx:', idx);
                      setDragOverChecklistIndex(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverChecklistIndex(null);
                      if (draggedChecklistIndex === null || draggedChecklistIndex === idx) return;
                      onUpdateTrip(prevTrip => {
                        const updatedPlans = prevTrip.plans.map(p => {
                          if (p.id === activePlan.id) {
                            const list = [...(p.manualChecklist || [])];
                            const [removed] = list.splice(draggedChecklistIndex, 1);
                            list.splice(idx, 0, removed);
                            return {
                              ...p,
                              manualChecklist: list
                            };
                          }
                          return p;
                        });
                        return {
                          ...prevTrip,
                          plans: updatedPlans
                        };
                      });
                    }}
                    onDragEnd={() => {
                      console.log('DRAGEND checklist idx:', idx);
                      setDraggedChecklistIndex(null);
                      setDragOverChecklistIndex(null);
                    }}
                    style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px', 
                      borderColor: 'rgba(255,255,255,0.04)',
                      backgroundColor: 'rgba(255,255,255,0.01)',
                      borderRadius: '8px',
                      opacity: draggedChecklistIndex === idx ? 0.4 : 1,
                      cursor: trip.canEdit !== false ? 'grab' : 'default',
                      transition: 'opacity 0.2s ease, background-color 0.2s ease',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                      {trip.canEdit !== false && (
                        <span 
                          style={{ 
                            cursor: 'grab', 
                            color: 'var(--text-muted)', 
                            display: 'flex', 
                            alignItems: 'center',
                            opacity: 0.6,
                            paddingRight: '2px'
                          }}
                        >
                          <GripVertical size={11} />
                        </span>
                      )}
                      <label className="flex-align" style={{ gap: '8px', cursor: trip.canEdit !== false ? 'pointer' : 'default', textTransform: 'none', flex: 1, minWidth: 0 }}>
                        <input 
                          type="checkbox" 
                          checked={item.completed} 
                          disabled={trip.canEdit === false}
                          onChange={() => handleToggleManualChecklistItem(item.id)}
                          style={{ width: '14px', height: '14px', margin: 0, cursor: trip.canEdit !== false ? 'pointer' : 'default' }}
                        />
                        <span style={{ 
                          fontSize: '12px', 
                          color: item.completed ? 'var(--text-muted)' : 'var(--text-primary)',
                          textDecoration: item.completed ? 'line-through' : 'none',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap'
                        }}>
                          {item.text}
                        </span>
                      </label>
                    </div>
                    {trip.canEdit !== false && (
                      <div style={{ display: 'flex', gap: '2px', alignItems: 'center', marginLeft: '6px' }}>
                        <span className="checklist-move-actions-desktop" style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                          <button 
                            type="button" 
                            className="mini-icon-btn" 
                            onClick={() => handleMoveManualChecklistItem(item.id, 'up')}
                            disabled={(activePlan.manualChecklist || []).indexOf(item) === 0}
                            style={{ padding: '2px', height: '20px', width: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (activePlan.manualChecklist || []).indexOf(item) === 0 ? 0.3 : 1 }}
                            data-tooltip="Move Up"
                          >
                            <ChevronUp size={12} />
                          </button>
                          <button 
                            type="button" 
                            className="mini-icon-btn" 
                            onClick={() => handleMoveManualChecklistItem(item.id, 'down')}
                            disabled={(activePlan.manualChecklist || []).indexOf(item) === (activePlan.manualChecklist || []).length - 1}
                            style={{ padding: '2px', height: '20px', width: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (activePlan.manualChecklist || []).indexOf(item) === (activePlan.manualChecklist || []).length - 1 ? 0.3 : 1 }}
                            data-tooltip="Move Down"
                          >
                            <ChevronDown size={12} />
                          </button>
                        </span>
                        <button 
                          type="button" 
                          className="trip-delete-btn" 
                          onClick={() => handleDeleteManualChecklistItem(item.id)}
                          style={{ padding: '2px', marginLeft: '4px' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {(activePlan.manualChecklist || []).length === 0 && (
              <span className="subsection-subtitle">
                No personal tasks added.
              </span>
            )}
          </div>
        </div>

        {/* Section B: AI Generated Checklist */}
        <div className="left-panel-subsection">
          <div className="subsection-header">
            <h4 className="subsection-title">
              AI Preparation Checklist
            </h4>
            <div className="subsection-actions">
              {trip.canEdit !== false && (
                <button 
                  className="mini-icon-btn flex-align"
                  style={{ fontSize: '10px', padding: '2px 8px', gap: '4px', color: '#a5b4fc', background: 'rgba(99, 102, 241, 0.12)' }}
                  onClick={onGenerateTripChecklist}
                  disabled={generatingChecklist}
                >
                  {generatingChecklist ? <RefreshCw size={10} className="spin" /> : <Sparkles size={10} />}
                  {activePlan.aiDetails?.checklist ? 'Regenerate' : 'Generate'}
                </button>
              )}
            </div>
          </div>

          <div className="subsection-content">
            {generatingChecklist ? (
              <FunGeneratingLoader message="Analyzing trip logistics & requirements..." />
            ) : activePlan.aiDetails?.checklist ? (
              <AiMarkdownSection
                content={activePlan.aiDetails.checklist}
                updatedAt={activePlan.aiUpdatedAt?.checklist}
                onSave={onSaveAiChecklist}
                canEdit={trip.canEdit !== false}
              />
            ) : (
              <div style={{ padding: '16px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '8px' }}>
                <span className="subsection-subtitle" style={{ display: 'block', marginBottom: '8px' }}>
                  No AI checklist generated.
                </span>
                {trip.canEdit !== false && (
                  <button 
                    className="btn-secondary flex-align"
                    style={{ margin: '0 auto', fontSize: '11px', padding: '4px 10px', gap: '4px' }}
                    onClick={onGenerateTripChecklist}
                  >
                    <Sparkles size={11} /> Generate Checklist
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
    </div>
  );
}

export default memo(ChecklistSection);
