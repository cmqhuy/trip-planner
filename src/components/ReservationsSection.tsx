import { Plane, Building, Ticket } from 'lucide-react';
import type { Trip, Plan } from '../types';

interface ReservationsSectionProps {
  trip: Trip;
  activePlan: Plan;
  daysList: string[];
  onPlaceClick: (placeId: string) => void;
  formatDisplayDate: (dateStr: string) => string;
}

export default function ReservationsSection({
  trip,
  activePlan,
  daysList,
  onPlaceClick,
  formatDisplayDate
}: ReservationsSectionProps) {
  return (
    <div className="accordion-content" style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1, minHeight: 0 }}>
      {/* Reservations Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, overflowY: 'auto', paddingRight: '2px' }}>
        
        {/* 1. Transits / Flights */}
        <div>
          <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Plane size={12} /> Transits & Flights ({activePlan.transports.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {activePlan.transports.map(t => (
              <div key={t.id} className="glass-panel" style={{ padding: '8px 10px', borderColor: 'rgba(255,255,255,0.04)', backgroundColor: 'rgba(255,255,255,0.01)', borderRadius: '8px' }}>
                <div className="flex-between">
                  <strong style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                    {t.type.toUpperCase()}: {t.departureLocationName} → {t.arrivalLocationName}
                  </strong>
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                  Departs: {t.departureDate} at {t.departureTime} ({t.departureTimezone})
                </span>
                {t.carrier && (
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginTop: '1px' }}>
                    Carrier: {t.carrier} {t.transitCode && `| Code: ${t.transitCode}`}
                  </span>
                )}
              </div>
            ))}
            {activePlan.transports.length === 0 && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No transit events.</span>
            )}
          </div>
        </div>

        {/* 2. Hotels */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
          <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Building size={12} /> Accommodations ({activePlan.hotels.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {activePlan.hotels.map(h => (
              <div key={h.id} className="glass-panel" style={{ padding: '8px 10px', borderColor: 'rgba(255,255,255,0.04)', backgroundColor: 'rgba(255,255,255,0.01)', borderRadius: '8px' }}>
                <strong style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{h.name}</strong>
                {h.address && <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>📍 {h.address}</span>}
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginTop: '1px' }}>
                  Stay: {h.checkInDate} to {h.checkOutDate}
                </span>
              </div>
            ))}
            {activePlan.hotels.length === 0 && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No hotels booked.</span>
            )}
          </div>
        </div>

        {/* 3. Places requiring early reservations */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
          <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Ticket size={12} /> Reservations Required
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
                return <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No scheduled places require reservations.</span>;
              }

              // Sort by earliest scheduled date
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
                    className="glass-panel" 
                    style={{ padding: '8px 10px', borderColor: 'rgba(255,255,255,0.04)', backgroundColor: 'rgba(255,255,255,0.01)', borderRadius: '8px', cursor: 'pointer' }}
                    onClick={() => onPlaceClick(p.id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <strong style={{ fontSize: '12px', color: 'var(--text-primary)', flex: 1 }}>{p.title}</strong>
                      {dayLabel && (
                        <span style={{ fontSize: '9px', color: 'var(--accent-primary)', fontWeight: 600, flexShrink: 0 }}>
                          {dayLabel}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginTop: '4px', textTransform: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.reservation}
                    </span>
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
