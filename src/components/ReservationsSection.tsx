import { useState } from 'react';
import {
  Plane, Building, Ticket, AlertTriangle, MapPin, Hash,
  Calendar, ChevronDown, ChevronUp, ExternalLink, Edit2, Trash2,
  Train, Bus, Car, Anchor, Navigation
} from 'lucide-react';
import type { Trip, Plan, Hotel, Transportation } from '../types';

interface ReservationsSectionProps {
  trip: Trip;
  activePlan: Plan;
  daysList: string[];
  onPlaceClick: (placeId: string) => void;
  formatDisplayDate: (dateStr: string) => string;
  onEditHotel: (hotel: Hotel) => void;
  onDeleteHotel: (id: string) => void;
  onEditTransport: (transport: Transportation) => void;
  onDeleteTransport: (id: string) => void;
}

function TransportTypeIcon({ type, size = 14 }: { type: string; size?: number }) {
  switch (type) {
    case 'flight': return <Plane size={size} />;
    case 'train': return <Train size={size} />;
    case 'bus': return <Bus size={size} />;
    case 'car': return <Car size={size} />;
    case 'ferry': return <Anchor size={size} />;
    default: return <Navigation size={size} />;
  }
}

export default function ReservationsSection({
  trip,
  activePlan,
  daysList,
  onPlaceClick,
  formatDisplayDate,
  onEditHotel,
  onDeleteHotel,
  onEditTransport,
  onDeleteTransport,
}: ReservationsSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpanded = (id: string) => setExpandedId(prev => prev === id ? null : id);

  // --- Hotel helpers ---

  const getHotelLocationName = (h: Hotel): string | undefined => {
    const coveredDay = daysList.find(d => h.checkInDate <= d && d < h.checkOutDate);
    if (!coveredDay) return undefined;
    const locId = activePlan.days[coveredDay]?.locationId;
    return locId ? trip.locations.find(l => l.id === locId)?.city : undefined;
  };

  const computeHotelWarnings = (): { locationName: string; start: string; end: string }[] => {
    const warnings: { locationName: string; start: string; end: string }[] = [];
    let groupStart: string | null = null;
    let groupLocId: string | null = null;

    for (let i = 0; i < daysList.length; i++) {
      const dayStr = daysList[i];
      const locId = activePlan.days[dayStr]?.locationId;
      const covered = activePlan.hotels.some(h => h.checkInDate <= dayStr && dayStr < h.checkOutDate);

      if (!covered && locId) {
        if (groupStart === null || groupLocId !== locId) {
          if (groupStart !== null) {
            const loc = trip.locations.find(l => l.id === groupLocId);
            if (loc) warnings.push({ locationName: loc.city, start: groupStart, end: daysList[i - 1] });
          }
          groupStart = dayStr;
          groupLocId = locId;
        }
      } else {
        if (groupStart !== null) {
          const loc = trip.locations.find(l => l.id === groupLocId);
          if (loc) warnings.push({ locationName: loc.city, start: groupStart, end: daysList[i - 1] });
          groupStart = null;
          groupLocId = null;
        }
      }
    }
    if (groupStart !== null) {
      const loc = trip.locations.find(l => l.id === groupLocId);
      if (loc) warnings.push({ locationName: loc.city, start: groupStart, end: daysList[daysList.length - 1] });
    }
    return warnings;
  };

  // --- Transit helpers ---

  const computeTransitWarnings = (): { from: string; to: string }[] => {
    const warnings: { from: string; to: string }[] = [];
    for (let i = 1; i < daysList.length; i++) {
      const prevDayStr = daysList[i - 1];
      const dayStr = daysList[i];
      const prevLocId = activePlan.days[prevDayStr]?.locationId;
      const currLocId = activePlan.days[dayStr]?.locationId;
      if (prevLocId && currLocId && prevLocId !== currLocId) {
        const hasTransit = activePlan.transports.some(
          t => t.departureDate === prevDayStr || t.arrivalDate === dayStr
        );
        if (!hasTransit) {
          const prevLoc = trip.locations.find(l => l.id === prevLocId);
          const currLoc = trip.locations.find(l => l.id === currLocId);
          warnings.push({ from: prevLoc?.city ?? 'previous location', to: currLoc?.city ?? 'next location' });
        }
      }
    }
    return warnings;
  };

  const hotelWarnings = computeHotelWarnings();
  const transitWarnings = computeTransitWarnings();

  return (
    <div className="accordion-content">
      <div className="reservations-inner">

        {/* 1. Hotels */}
        <div className="left-panel-subsection">
          <div className="subsection-header">
            <h4 className="subsection-title">
              <Building size={12} /> Hotels ({activePlan.hotels.length})
            </h4>
          </div>
          <div className="subsection-content">
            {hotelWarnings.map((w, i) => (
              <div key={i} className="reservation-warning">
                <AlertTriangle size={11} />
                No hotels for {w.locationName} {w.start === w.end ? `on ${formatDisplayDate(w.start)}` : `from ${formatDisplayDate(w.start)} to ${formatDisplayDate(w.end)}`}.
              </div>
            ))}

            {activePlan.hotels.map(h => {
              const key = `hotel-${h.id}`;
              const isExpanded = expandedId === key;
              const locationName = getHotelLocationName(h);
              return (
                <div key={h.id} className="glass-panel reservation-card reservation-card--expandable">
                  <div className="reservation-card-expand" onClick={() => toggleExpanded(key)}>
                    <div className="reservation-card-expand-main">
                      <div className="reservation-card-icon-row">
                        <Building size={13} className="reservation-card-type-icon" />
                        {locationName && <span className="reservation-card-location">{locationName}</span>}
                      </div>
                      <strong className="reservation-card-title">{h.name}</strong>
                      {h.address && (
                        <div className="reservation-card-field-row">
                          <MapPin size={11} /> <span>{h.address}</span>
                        </div>
                      )}
                      {h.confirmationNo && (
                        <div className="reservation-card-field-row">
                          <Hash size={11} /> <span>{h.confirmationNo}</span>
                        </div>
                      )}
                      <div className="reservation-card-field-row">
                        <Calendar size={11} />
                        <span>{formatDisplayDate(h.checkInDate)}{h.checkInTime ? ` ${h.checkInTime}` : ''} → {formatDisplayDate(h.checkOutDate)}{h.checkOutTime ? ` ${h.checkOutTime}` : ''}</span>
                      </div>
                    </div>
                    <span className="reservation-card-chevron">
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </span>
                  </div>

                  {isExpanded && (
                    <div className="reservation-card-expanded-content">
                      {h.notes && <p className="reservation-card-notes">{h.notes}</p>}
                      <div className="reservation-card-actions">
                        {h.address && (
                          <button
                            className="mini-icon-btn flex-align"
                            onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.address!)}`, '_blank')}
                            data-tooltip="Open in Maps"
                          >
                            <ExternalLink size={12} /> Map
                          </button>
                        )}
                        {trip.canEdit !== false && (
                          <>
                            <button className="mini-icon-btn flex-align" onClick={() => onEditHotel(h)} data-tooltip="Edit">
                              <Edit2 size={12} /> Edit
                            </button>
                            <button className="mini-icon-btn mini-icon-btn--danger flex-align" onClick={() => onDeleteHotel(h.id)} data-tooltip="Delete">
                              <Trash2 size={12} /> Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {activePlan.hotels.length === 0 && hotelWarnings.length === 0 && (
              <span className="subsection-subtitle">No hotels booked.</span>
            )}
          </div>
        </div>

        {/* 2. Transits & Flights */}
        <div className="left-panel-subsection">
          <div className="subsection-header">
            <h4 className="subsection-title">
              <Plane size={12} /> Transits & Flights ({activePlan.transports.length})
            </h4>
          </div>
          <div className="subsection-content">
            {transitWarnings.map((w, i) => (
              <div key={i} className="reservation-warning">
                <AlertTriangle size={11} />
                No transit booked from {w.from} to {w.to}.
              </div>
            ))}

            {activePlan.transports.map(t => {
              const key = `transport-${t.id}`;
              const isExpanded = expandedId === key;
              return (
                <div key={t.id} className="glass-panel reservation-card reservation-card--expandable">
                  <div className="reservation-card-expand" onClick={() => toggleExpanded(key)}>
                    <div className="reservation-card-expand-main">
                      <div className="reservation-card-icon-row">
                        <TransportTypeIcon type={t.type} size={13} />
                        <strong className="reservation-card-title">{t.departureLocationName} → {t.arrivalLocationName}</strong>
                      </div>
                      <div className="reservation-card-field-row">
                        <Calendar size={11} />
                        <span>Departs {formatDisplayDate(t.departureDate)}{t.departureTime ? ` ${t.departureTime}` : ''}{t.departureTimezone ? ` (${t.departureTimezone})` : ''}</span>
                      </div>
                      {t.carrier && (
                        <div className="reservation-card-field-row">
                          <span className="reservation-card-meta">{t.carrier}{t.transitCode ? ` · ${t.transitCode}` : ''}</span>
                        </div>
                      )}
                      {t.confirmationNo && (
                        <div className="reservation-card-field-row">
                          <Hash size={11} /> <span>{t.confirmationNo}</span>
                        </div>
                      )}
                    </div>
                    <span className="reservation-card-chevron">
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </span>
                  </div>

                  {isExpanded && (
                    <div className="reservation-card-expanded-content">
                      {t.notes && <p className="reservation-card-notes">{t.notes}</p>}
                      <div className="reservation-card-actions">
                        {trip.canEdit !== false && (
                          <>
                            <button className="mini-icon-btn flex-align" onClick={() => onEditTransport(t)} data-tooltip="Edit">
                              <Edit2 size={12} /> Edit
                            </button>
                            <button className="mini-icon-btn mini-icon-btn--danger flex-align" onClick={() => onDeleteTransport(t.id)} data-tooltip="Delete">
                              <Trash2 size={12} /> Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {activePlan.transports.length === 0 && transitWarnings.length === 0 && (
              <span className="subsection-subtitle">No transit booked.</span>
            )}
          </div>
        </div>

        {/* 3. Suggested Reservations */}
        <div className="left-panel-subsection">
          <div className="subsection-header">
            <h4 className="subsection-title">
              <Ticket size={12} /> Suggested Reservations
            </h4>
          </div>
          <div className="subsection-content">
            {(() => {
              const allScheduledPlaceIds = new Set<string>();
              Object.values(activePlan.days).forEach(day => {
                day.placeIds.forEach(pid => allScheduledPlaceIds.add(pid));
              });

              const placesNeedBooking: { id: string; title: string; reservation?: string; earliestDate: string }[] = [];
              trip.locations.forEach(loc => {
                loc.places.forEach(p => {
                  if (allScheduledPlaceIds.has(p.id) && (p.aiDetails?.reservation || p.notes?.toLowerCase().includes('book') || p.notes?.toLowerCase().includes('reserv'))) {
                    const dates = Object.entries(activePlan.days)
                      .filter(([_, day]) => day.placeIds.includes(p.id))
                      .map(([dateStr]) => dateStr);
                    const earliestDate = dates.length > 0 ? dates.sort()[0] : '';
                    placesNeedBooking.push({
                      id: p.id,
                      title: p.title,
                      reservation: p.aiDetails?.reservation || p.notes,
                      earliestDate
                    });
                  }
                });
              });

              if (placesNeedBooking.length === 0) {
                return <span className="subsection-subtitle">No scheduled places require reservations.</span>;
              }

              placesNeedBooking.sort((a, b) => {
                if (!a.earliestDate) return 1;
                if (!b.earliestDate) return -1;
                return a.earliestDate.localeCompare(b.earliestDate);
              });

              return placesNeedBooking.map(p => {
                const dayIndex = p.earliestDate ? daysList.indexOf(p.earliestDate) + 1 : -1;
                const dayLabel = dayIndex > 0
                  ? `Day ${dayIndex} (${formatDisplayDate(p.earliestDate).split(',')[1]?.trim() || p.earliestDate})`
                  : '';

                return (
                  <div
                    key={p.id}
                    className="glass-panel reservation-card reservation-card--clickable"
                    onClick={() => onPlaceClick(p.id)}
                  >
                    <div className="reservation-card-header">
                      <strong className="reservation-card-name">{p.title}</strong>
                      {dayLabel && <span className="reservation-day-badge">{dayLabel}</span>}
                    </div>
                    <span className="reservation-card-note">{p.reservation}</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>

      </div>
    </div>
  );
}
