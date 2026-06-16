import { useEffect, useRef } from 'react';
import { X, Clock, Loader2, CheckCircle2, XCircle, ListChecks, Trash2 } from 'lucide-react';
import type { AiRequestQueueItem } from '../utils/aiRequestQueue';

interface AiRequestQueuePanelProps {
  items: AiRequestQueueItem[];
  onClearCompleted: () => void;
  onClose: () => void;
}

export default function AiRequestQueuePanel({ items, onClearCompleted, onClose }: AiRequestQueuePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const hasFinished = items.some(i => i.status === 'completed' || i.status === 'failed');
  const activeCount = items.filter(i => i.status === 'pending' || i.status === 'running').length;

  return (
    <div className="ai-queue-panel glass-panel" ref={panelRef}>
      <div className="ai-queue-panel-header">
        <span className="ai-queue-panel-title">
          <ListChecks size={14} />
          AI Queue
          {activeCount > 0 && <span className="ai-queue-panel-badge">{activeCount}</span>}
        </span>
        <div className="ai-queue-panel-actions">
          {hasFinished && (
            <button
              className="ai-queue-clear-btn"
              onClick={onClearCompleted}
              data-tooltip="Clear completed"
            >
              <Trash2 size={13} />
            </button>
          )}
          <button className="ai-queue-close-btn" onClick={onClose} data-tooltip="Close">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="ai-queue-panel-body">
        {items.length === 0 ? (
          <p className="ai-queue-empty">No queued requests</p>
        ) : (
          <ul className="ai-queue-list">
            {items.map(item => (
              <li key={item.id} className={`ai-queue-item ai-queue-item--${item.status}`}>
                <span className="ai-queue-item-icon">
                  {item.status === 'pending' && <Clock size={13} />}
                  {item.status === 'running' && <Loader2 size={13} className="spin" />}
                  {item.status === 'completed' && <CheckCircle2 size={13} />}
                  {item.status === 'failed' && <XCircle size={13} />}
                </span>
                <span className="ai-queue-item-body">
                  <span className="ai-queue-item-label">{item.label}</span>
                  {item.status === 'failed' && item.error && (
                    <span className="ai-queue-item-error">{item.error}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
