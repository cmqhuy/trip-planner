import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Building2, Check, MapPin, Plane, StickyNote, Ticket } from 'lucide-react';
import type { ItineraryDocument, ItineraryEntry, ItineraryEntryKind } from '../utils/itineraryDocument';
import { formatTotals } from '../utils/itineraryDocument';

/**
 * The printable rendering of an `ItineraryDocument`, portaled to `document.body`
 * as a sibling of `#root` so the print stylesheet can hide the app wholesale
 * (`@media print { #root { display: none } }`) without fighting the planner's
 * three-panel layout.
 *
 * **Why the browser's print dialog and not a PDF library:** `jsPDF`/`pdfmake`
 * would add ~300 kB to a bundle that is already a single 996 kB chunk, and hand
 * back a rasterised or hand-laid-out document. Printing to PDF is built into
 * every target browser, produces selectable text and real page breaks, costs
 * zero bytes, and works offline.
 *
 * **This view deliberately opts out of the glassmorphism theme.** Paper is
 * white; a dark translucent panel prints as a grey smear and burns ink. The
 * `.print-doc-*` classes in `index.css` are a self-contained light stylesheet.
 */

const ENTRY_ICONS: Record<ItineraryEntryKind, typeof MapPin> = {
  place: MapPin,
  note: StickyNote,
  hotel: Building2,
  transit: Plane,
  booking: Ticket,
};

interface ItineraryPrintViewProps {
  doc: ItineraryDocument;
  /** Fired once the print dialog closes, so the caller can unmount this view. */
  onDone: () => void;
  /** Set false in tests to render the markup without opening a print dialog. */
  autoPrint?: boolean;
}

function EntryRow({ entry }: { entry: ItineraryEntry }) {
  const Icon = ENTRY_ICONS[entry.kind];
  return (
    <li className={`print-entry print-entry--${entry.kind}`}>
      <span className="print-entry-time">{entry.time || ''}</span>
      <span className="print-entry-icon"><Icon size={13} /></span>
      <div className="print-entry-body">
        <p className="print-entry-title">
          {entry.title}
          {entry.groupName && <span className="print-entry-tag">{entry.groupName}</span>}
          {entry.status && entry.status !== 'Confirmed' && (
            <span className="print-entry-tag">{entry.status}</span>
          )}
        </p>
        {entry.subtitle && <p className="print-entry-line">{entry.subtitle}</p>}
        {entry.openingHours && <p className="print-entry-line">Hours: {entry.openingHours}</p>}
        {entry.confirmationNo && <p className="print-entry-line">Confirmation: {entry.confirmationNo}</p>}
        {entry.detail && <p className="print-entry-detail">{entry.detail}</p>}
        {entry.notes && <p className="print-entry-notes">{entry.notes}</p>}
      </div>
    </li>
  );
}

export default function ItineraryPrintView({ doc, onDone, autoPrint = true }: ItineraryPrintViewProps) {
  useEffect(() => {
    if (!autoPrint) return;

    // `afterprint` fires whether the user saves or cancels, which is exactly the
    // signal to unmount. If the environment has no print (jsdom, embedded
    // webviews), release the caller immediately rather than stranding the modal.
    const finish = () => onDone();
    window.addEventListener('afterprint', finish);

    if (typeof window.print !== 'function') {
      window.removeEventListener('afterprint', finish);
      onDone();
      return;
    }

    // One frame so the portal's layout is settled before the dialog snapshots it.
    const frame = requestAnimationFrame(() => {
      try {
        window.print();
      } catch {
        onDone();
      }
    });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('afterprint', finish);
    };
  }, [autoPrint, onDone]);

  return createPortal(
    <div className="itinerary-print-root" role="document" aria-label={`${doc.tripName} itinerary`}>
      <header className="print-doc-cover">
        <h1 className="print-doc-title">{doc.tripName}</h1>
        <p className="print-doc-dates">{doc.dateRangeLabel}</p>
        <dl className="print-doc-meta">
          <div>
            <dt>Plan</dt>
            <dd>{doc.planName}</dd>
          </div>
          <div>
            <dt>Length</dt>
            <dd>{doc.dayCount} {doc.dayCount === 1 ? 'day' : 'days'}</dd>
          </div>
          {doc.destinations.length > 0 && (
            <div>
              <dt>Destinations</dt>
              <dd>{doc.destinations.join(' · ')}</dd>
            </div>
          )}
        </dl>
      </header>

      {doc.reservationSections.length > 0 && (
        <section className="print-doc-section">
          <h2 className="print-doc-heading">Reservations</h2>
          {doc.reservationSections.map(section => (
            <div key={section.title} className="print-res-group">
              <h3 className="print-doc-subheading">{section.title}</h3>
              <table className="print-res-table">
                <thead>
                  <tr>
                    <th>What</th>
                    <th>When</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map(row => (
                    <tr key={row.key}>
                      <td>
                        <span className="print-res-title">{row.title}</span>
                        {row.status && row.status !== 'Confirmed' && (
                          <span className="print-entry-tag">{row.status}</span>
                        )}
                      </td>
                      <td className="print-res-when">{row.when}</td>
                      <td>
                        {row.detail && <span className="print-res-line">{row.detail}</span>}
                        {row.confirmationNo && <span className="print-res-line">Confirmation: {row.confirmationNo}</span>}
                        {row.bookedThrough && <span className="print-res-line">Booked via: {row.bookedThrough}</span>}
                        {row.notes && <span className="print-res-line print-res-notes">{row.notes}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      )}

      <section className="print-doc-section">
        <h2 className="print-doc-heading">Day by day</h2>
        {doc.days.map(day => (
          <article key={day.dateStr} className="print-day">
            <div className="print-day-header">
              <h3 className="print-day-title">
                <span className="print-day-number">Day {day.dayNumber}</span>
                {day.dateLabel}
              </h3>
              {day.locationLabel && <span className="print-day-location">{day.locationLabel}</span>}
            </div>
            {/* "Hotel", not "Staying at" — the stay window is inclusive of the
                check-out date, so the last day would otherwise claim a night the
                traveller does not have. The date range disambiguates. */}
            {day.lodging.length > 0 && (
              <p className="print-day-lodging">Hotel: {day.lodging.join('; ')}</p>
            )}
            {day.entries.length > 0 ? (
              <ul className="print-entry-list">
                {day.entries.map(entry => <EntryRow key={entry.key} entry={entry} />)}
              </ul>
            ) : (
              <p className="print-day-empty">Nothing scheduled.</p>
            )}
          </article>
        ))}
      </section>

      {doc.checklist.length > 0 && (
        <section className="print-doc-section">
          <h2 className="print-doc-heading">Checklist</h2>
          <ul className="print-checklist">
            {doc.checklist.map((item, idx) => (
              <li key={idx} className={item.completed ? 'is-done' : undefined}>
                <span className="print-checkbox" aria-hidden="true">{item.completed && <Check size={11} />}</span>
                {item.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      {doc.expenses && (
        <section className="print-doc-section">
          <h2 className="print-doc-heading">Budget</h2>
          <table className="print-res-table">
            <tbody>
              <tr>
                <td className="print-res-title">Total</td>
                <td>{formatTotals(doc.expenses.overall)}</td>
              </tr>
              <tr>
                <td className="print-res-title">Paid</td>
                <td>{formatTotals(doc.expenses.paid)}</td>
              </tr>
              <tr>
                <td className="print-res-title">Outstanding</td>
                <td>{formatTotals(doc.expenses.unpaid)}</td>
              </tr>
              {doc.expenses.byGroup.map(group => (
                <tr key={group.name}>
                  <td>{group.name}</td>
                  <td>{formatTotals(group.totals)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <footer className="print-doc-footer">
        {doc.tripName} · {doc.planName} · Generated {doc.generatedOnLabel} with Trip Planner
      </footer>
    </div>,
    document.body,
  );
}
