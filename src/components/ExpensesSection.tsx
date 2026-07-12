import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Check, X, Pencil, Trash2, ChevronDown, CheckSquare, Square, GripVertical } from 'lucide-react';
import type { ExpenseLine } from '../types';
import { CURRENCY_LIST } from '../utils/currencies';

interface ExpensesSectionProps {
  expenses: ExpenseLine[];
  onChange: (expenses: ExpenseLine[]) => void;
  defaultCurrency?: string;
}

export default function ExpensesSection({
  expenses = [],
  onChange,
  defaultCurrency = 'USD'
}: ExpensesSectionProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Form fields
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [paid, setPaid] = useState(false);

  // Dropdown states
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [currencyPos, setCurrencyPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const currencyTriggerRef = useRef<HTMLButtonElement>(null);

  // Reset form when cancelling or starting edit
  const resetForm = () => {
    setDescription('');
    setPrice('');
    setCurrency(defaultCurrency);
    setPaid(false);
  };

  const handleStartAdd = () => {
    resetForm();
    setIsAdding(true);
    setEditingId(null);
  };

  const handleStartEdit = (item: ExpenseLine) => {
    setDescription(item.description);
    setPrice(String(item.price));
    setCurrency(item.currency);
    setPaid(item.paid);
    setEditingId(item.id);
    setIsAdding(false);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    resetForm();
  };

  const handleSave = () => {
    if (!description.trim()) return;
    const parsedPrice = parseFloat(price) || 0;
    const finalCurrency = currency.trim() || defaultCurrency;

    if (isAdding) {
      const newItem: ExpenseLine = {
        id: `expense-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        description: description.trim(),
        price: parsedPrice,
        currency: finalCurrency,
        paid
      };
      onChange([...expenses, newItem]);
    } else if (editingId) {
      onChange(
        expenses.map(item =>
          item.id === editingId
            ? {
                ...item,
                description: description.trim(),
                price: parsedPrice,
                currency: finalCurrency,
                paid
              }
            : item
        )
      );
    }

    handleCancel();
  };

  const handleDelete = (id: string) => {
    onChange(expenses.filter(item => item.id !== id));
  };

  const handleTogglePaid = (item: ExpenseLine) => {
    onChange(
      expenses.map(exp => (exp.id === item.id ? { ...exp, paid: !exp.paid } : exp))
    );
  };

  // Group totals by currency
  const totals = expenses.reduce((acc, item) => {
    acc[item.currency] = (acc[item.currency] || 0) + item.price;
    return acc;
  }, {} as Record<string, number>);

  const formatPrice = (amount: number) => {
    return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  };

  return (
    <div className="expense-section">
      <div className="expense-header-row">
        <span className="expense-section-label">Expenses</span>
        {!isAdding && !editingId && (
          <button
            type="button"
            className="mini-icon-btn flex-align"
            onClick={handleStartAdd}
            data-tooltip="Add Expense Line"
            data-tooltip-position="bottom"
          >
            <Plus size={13} />
            <span>Add</span>
          </button>
        )}
      </div>

      {/* Inline Form */}
      {(isAdding || editingId) && (
        <div className="expense-form-row">
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              placeholder="Description (e.g. Resort fee, Extra bag)"
              className="modal-input"
              value={description}
              onChange={e => setDescription(e.target.value)}
              style={{ flex: 1 }}
              autoFocus
            />
            <input
              type="number"
              placeholder="0.00"
              step="any"
              className="modal-input"
              value={price}
              onChange={e => setPrice(e.target.value)}
              style={{ width: '80px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="combo-wrapper" style={{ display: 'flex', position: 'relative', width: '130px' }}>
              <input
                type="text"
                placeholder="Currency"
                className="modal-input"
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                style={{ width: '100%', paddingRight: '22px' }}
              />
              <button
                ref={currencyTriggerRef}
                type="button"
                className="combo-trigger-chevron-only"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!currencyOpen && currencyTriggerRef.current) {
                    const rect = currencyTriggerRef.current.getBoundingClientRect();
                    setCurrencyPos({
                      top: rect.bottom + window.scrollY + 4,
                      left: rect.left + window.scrollX,
                      width: rect.width
                    });
                  }
                  setCurrencyOpen(!currencyOpen);
                }}
              >
                <ChevronDown size={14} className={`expand-chevron${currencyOpen ? ' is-open' : ''}`} />
              </button>
            </div>

            <label className="flex-align" style={{ gap: '6px', fontSize: '11px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={paid}
                onChange={e => setPaid(e.target.checked)}
                className="expense-item-checkbox"
              />
              <span>Paid</span>
            </label>

            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                className="mini-icon-btn flex-align"
                onClick={handleSave}
                disabled={!description.trim()}
                data-tooltip="Save line item"
                data-tooltip-position="bottom"
              >
                <Check size={13} />
              </button>
              <button
                type="button"
                className="mini-icon-btn mini-icon-btn--danger flex-align"
                onClick={handleCancel}
                data-tooltip="Cancel"
                data-tooltip-position="bottom"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Currency selection portal dropdown */}
      {currencyOpen && currencyPos && createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }} onClick={() => setCurrencyOpen(false)} />
          <div
            className="combo-dropdown--portal"
            style={{ top: currencyPos.top, left: currencyPos.left, width: Math.max(currencyPos.width, 220) }}
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              className="combo-option"
              onClick={() => { setCurrency('Custom'); setCurrencyOpen(false); }}
            >
              Custom (points, credits, etc.)
            </button>
            <div className="combo-divider" />
            {CURRENCY_LIST.map(c => (
              <button
                key={c.code}
                type="button"
                className={`combo-option${c.code === currency ? ' selected' : ''}`}
                onClick={() => { setCurrency(c.code); setCurrencyOpen(false); }}
              >
                {c.code} — {c.name}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}

      {/* Expense list */}
      {expenses.length > 0 ? (
        <div className="expense-list">
          {expenses.map((item, idx) => {
            const isDragOver = idx === dragOverIndex && draggedIndex !== null && draggedIndex !== idx;
            const showLineAtBottom = draggedIndex !== null && draggedIndex < idx;
            return (
              <div key={item.id} className="expense-item-wrapper" style={{ position: 'relative' }}>
                {isDragOver && (
                  <div
                    className="drag-indicator-line"
                    style={{
                      top: showLineAtBottom ? 'auto' : '-5px',
                      bottom: showLineAtBottom ? '-5px' : 'auto'
                    }}
                  />
                )}
                <div
                  className={`expense-item ${dragOverIndex === idx && draggedIndex !== idx ? 'drag-over' : ''}`}
                  draggable
                  onDragStart={(e) => {
                    setDraggedIndex(idx);
                    if (e.dataTransfer) {
                      e.dataTransfer.effectAllowed = 'move';
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverIndex !== idx) {
                      setDragOverIndex(idx);
                    }
                  }}
                  onDragLeave={() => {
                    setDragOverIndex(null);
                  }}
                  onDragEnd={() => {
                    setDraggedIndex(null);
                    setDragOverIndex(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverIndex(null);
                    if (draggedIndex === null || draggedIndex === idx) return;

                    const newList = [...expenses];
                    const [removed] = newList.splice(draggedIndex, 1);
                    newList.splice(idx, 0, removed);
                    onChange(newList);
                    setDraggedIndex(null);
                  }}
                  style={{
                    '--opacity': draggedIndex === idx ? 0.4 : 1
                  } as React.CSSProperties}
                >
                  <div className="expense-item-grip">
                    <GripVertical size={12} />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTogglePaid(item)}
                    className="mini-icon-btn flex-align"
                    style={{ color: item.paid ? 'var(--accent-primary)' : 'var(--text-muted)' }}
                    data-tooltip={item.paid ? 'Mark unpaid' : 'Mark paid'}
                    onDragStart={e => e.stopPropagation()}
                  >
                    {item.paid ? <CheckSquare size={14} /> : <Square size={14} />}
                  </button>
                  <span className={`expense-item-desc ${item.paid ? 'line-through' : ''}`}>
                    {item.description}
                  </span>
                  <span className={`expense-item-amount ${item.paid ? 'line-through' : ''}`}>
                    {formatPrice(item.price)}
                  </span>
                  <span className="expense-item-currency">{item.currency}</span>
                  <div className="expense-item-actions" onDragStart={e => e.stopPropagation()}>
                    <button
                      type="button"
                      className="mini-icon-btn"
                      onClick={() => handleStartEdit(item)}
                      data-tooltip="Edit Expense"
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      type="button"
                      className="mini-icon-btn mini-icon-btn--danger"
                      onClick={() => handleDelete(item.id)}
                      data-tooltip="Delete Expense"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Multiple Currencies Total */}
          <div className="expense-totals">
            <span className="expense-totals-label">Total:</span>
            {Object.entries(totals).map(([currencyCode, sum], idx) => (
              <span key={currencyCode} className="expense-total-badge">
                {idx > 0 && <span style={{ marginRight: '6px', color: 'var(--text-muted)' }}>•</span>}
                {formatPrice(sum)} {currencyCode}
              </span>
            ))}
          </div>
        </div>
      ) : (
        !isAdding && !editingId && (
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>No expenses added.</p>
        )
      )}
    </div>
  );
}
