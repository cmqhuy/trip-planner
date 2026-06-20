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
              className="checklist-add-form"
            >
              <input
                type="text"
                placeholder="Add new task..."
                value={manualChecklistInput}
                onChange={(e) => setManualChecklistInput(e.target.value)}
                className="checklist-text-input"
              />
              <button
                type="submit"
                className="btn-primary checklist-add-btn"
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
                <div key={item.id} className="checklist-item-wrapper">
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
                      opacity: draggedChecklistIndex === idx ? 0.4 : 1,
                      cursor: trip.canEdit !== false ? 'grab' : 'default',
                    }}
                  >
                    <div className="checklist-item-content">
                      {trip.canEdit !== false && (
                        <span className="checklist-grip">
                          <GripVertical size={11} />
                        </span>
                      )}
                      <label className="flex-align checklist-item-label" style={{ cursor: trip.canEdit !== false ? 'pointer' : 'default' }}>
                        <input
                          type="checkbox"
                          checked={item.completed}
                          disabled={trip.canEdit === false}
                          onChange={() => handleToggleManualChecklistItem(item.id)}
                          className="checklist-checkbox"
                          style={{ cursor: trip.canEdit !== false ? 'pointer' : 'default' }}
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
                      <div className="checklist-item-end-actions">
                        <span className="checklist-move-actions-desktop">
                          <button
                            type="button"
                            className="mini-icon-btn checklist-move-btn"
                            onClick={() => handleMoveManualChecklistItem(item.id, 'up')}
                            disabled={(activePlan.manualChecklist || []).indexOf(item) === 0}
                            style={{ opacity: (activePlan.manualChecklist || []).indexOf(item) === 0 ? 0.3 : 1 }}
                            data-tooltip="Move Up"
                          >
                            <ChevronUp size={12} />
                          </button>
                          <button
                            type="button"
                            className="mini-icon-btn checklist-move-btn"
                            onClick={() => handleMoveManualChecklistItem(item.id, 'down')}
                            disabled={(activePlan.manualChecklist || []).indexOf(item) === (activePlan.manualChecklist || []).length - 1}
                            style={{ opacity: (activePlan.manualChecklist || []).indexOf(item) === (activePlan.manualChecklist || []).length - 1 ? 0.3 : 1 }}
                            data-tooltip="Move Down"
                          >
                            <ChevronDown size={12} />
                          </button>
                        </span>
                        <button
                          type="button"
                          className="trip-delete-btn checklist-delete-btn"
                          onClick={() => handleDeleteManualChecklistItem(item.id)}
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
                  className="panel-ai-action-btn checklist-ai-btn"
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
              <div className="checklist-empty-state">
                <span className="subsection-subtitle checklist-empty-subtitle">
                  No AI checklist generated yet.
                </span>
                {trip.canEdit !== false && (
                  <button
                    className="btn-secondary flex-align checklist-generate-btn"
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
