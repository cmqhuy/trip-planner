import { useEffect, useState } from 'react';
import { FileDown, Printer } from 'lucide-react';
import Modal from './Modal';
import { ComboBox, type ComboOption } from './ComboBox';
import { DEFAULT_EXPORT_OPTIONS, type ItineraryExportOptions } from '../utils/itineraryDocument';
import type { Plan } from '../types';

interface ExportItineraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  plans: Plan[];
  /** Plan preselected when the dialog opens — the one the user is looking at. */
  activePlanId: string;
  onExport: (planId: string, options: ItineraryExportOptions) => void;
}

type ToggleKey = keyof ItineraryExportOptions;

const TOGGLES: { key: ToggleKey; label: string; hint: string }[] = [
  { key: 'includeReservations', label: 'Reservations summary', hint: 'Hotels, transport, and bookings with confirmation numbers, up front.' },
  { key: 'includePlaceDetails', label: 'Place details', hint: 'Descriptions and opening hours under each stop.' },
  { key: 'includeNotes', label: 'Notes', hint: 'Your own notes on places and reservations.' },
  { key: 'includeChecklist', label: 'Checklist', hint: 'The trip checklist, with items ticked off.' },
  { key: 'includeExpenses', label: 'Budget totals', hint: 'Totals per currency, paid vs. outstanding, and a per-group breakdown.' },
];

/**
 * Picks the plan and the sections to include, then hands off to the caller,
 * which mounts `ItineraryPrintView` and opens the browser's print dialog.
 * Choosing "Save as PDF" as the destination there produces the file.
 */
export default function ExportItineraryModal({
  isOpen,
  onClose,
  plans,
  activePlanId,
  onExport,
}: ExportItineraryModalProps) {
  const [planId, setPlanId] = useState(activePlanId);
  const [options, setOptions] = useState<ItineraryExportOptions>(DEFAULT_EXPORT_OPTIONS);

  useEffect(() => {
    if (isOpen) {
      setPlanId(activePlanId);
      setOptions(DEFAULT_EXPORT_OPTIONS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const planOptions: ComboOption<string>[] = plans.map(p => ({ value: p.id, label: p.name }));

  const handleExport = () => {
    onExport(planId, options);
    onClose();
  };

  return (
    <Modal
      title={<><FileDown size={16} /> Export Itinerary</>}
      titleClassName="modal-header-title"
      onClose={onClose}
      maxWidth={480}
    >
      <p className="export-modal-intro">
        Opens your browser's print dialog. Choose <strong>Save as PDF</strong> as the destination to
        get a file, or send it straight to a printer.
      </p>

      {plans.length > 1 && (
        <div className="form-group">
          <label htmlFor="export-plan-combo">Plan</label>
          <ComboBox id="export-plan-combo" value={planId} options={planOptions} onChange={setPlanId} />
        </div>
      )}

      <div className="form-group">
        <label>Include</label>
        <div className="export-option-list">
          {TOGGLES.map(({ key, label, hint }) => (
            <label key={key} className="export-option">
              <input
                type="checkbox"
                className="catalog-checkbox"
                checked={options[key]}
                onChange={e => setOptions(prev => ({ ...prev, [key]: e.target.checked }))}
              />
              <span className="export-option-body">
                <span className="export-option-label">{label}</span>
                <span className="export-option-hint">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="modal-actions">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" onClick={handleExport} disabled={!planId}>
          <Printer size={14} /> Save as PDF
        </button>
      </div>
    </Modal>
  );
}
