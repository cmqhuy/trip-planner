import { useState, useEffect, useRef } from 'react';
import {
  Plane, Building, AlertTriangle, MapPin, Hash,
  Edit2, Trash2, Check, Timer, X, Calendar,
  Train, Bus, Car, Anchor, Navigation,
  MoreVertical, ArrowUpRight, ArrowDownLeft, Copy,
  Plus, Sparkles, ChevronUp, ChevronDown, Landmark, Utensils
} from 'lucide-react';
import { InlineNotes } from './InlineNotes';
import type { Trip, Plan, Hotel, TransportationReservation, ReservationGroup, GenericReservation, PlaceReservation } from '../types';
import { flattenReservations } from '../types';
import { GeminiService, AI_NOT_CONFIGURED_MESSAGE, AI_FILE_CONTENTS_NOT_AVAILABLE_IN_MANUAL_MODE_MESSAGE } from '../utils/ai';
import { buildHotelMapsLink, buildTransitMapsLink, buildMapsLink } from '../utils/api';
import { sortHotels, sortTransports } from '../utils/dateUtils';
import { getHotelResolvedLocation, getTransitResolvedLocations } from '../utils/locationUtils';
import { getExpenseGroupIcon } from '../utils/expenseUtils';
import { getReservationWarnings, isPlaceReservationUnlinkedOrDeleted } from '../utils/reservationWarnings';

interface ReservationsSectionProps {
  trip: Trip;
  activePlan: Plan;
  daysList: string[];
  selectedDateStr?: string;
  onPlaceClick: (placeId: string) => void;
  formatDisplayDate: (dateStr: string) => string;
  onEditHotel: (hotel: Hotel) => void;
  onDeleteHotel: (id: string) => void;
  onEditTransport: (reservation: TransportationReservation, segmentIndex: number) => void;
  onDeleteTransport: (reservationId: string, segmentIndex: number) => void;
  onSaveTransportNotes: (reservationId: string, notes: string) => void;
  expandedHotelId: string | null;
  setExpandedHotelId: (id: string | null) => void;
  expandedTransitId: string | null;
  setExpandedTransitId: (id: string | null) => void;
  expandedAttractionReservationId?: string | null;
  setExpandedAttractionReservationId?: (id: string | null) => void;
  expandedDiningReservationId?: string | null;
  setExpandedDiningReservationId?: (id: string | null) => void;
  onAddHotel: () => void;
  onAddTransit: () => void;
  onAddPlaceReservation?: (type: 'attraction' | 'dining') => void;
  onEditPlaceReservation?: (reservation: PlaceReservation) => void;
  onDeletePlaceReservation?: (id: string) => void;
  onImportReservationFile: (type: 'hotel' | 'transit' | 'attraction' | 'dining', file: File) => void;
  // Group management
  reservationGroups: ReservationGroup[];
  genericReservations: GenericReservation[];
  onAddReservationGroup: () => void;
  onEditReservationGroup: (group: ReservationGroup) => void;
  onMoveReservationGroup: (index: number, direction: 'up' | 'down') => void;
  onAddGenericReservation: (groupId: string) => void;
  onEditGenericReservation: (reservation: GenericReservation) => void;
  onDeleteGenericReservation?: (id: string) => void;
  activeReservationGroupDropdownId: string | null;
  setActiveReservationGroupDropdownId: (id: string | null) => void;
}

const renderStatusIcon = (status?: string) => {
  const s = status || 'Planning';
  if (s === 'Confirmed') return <Check size={10} />;
  if (s === 'Canceled') return <X size={10} />;
  return <Timer size={10} />;
};

function TransportTypeIcon({ type, size = 14, className, style }: { type: string; size?: number; className?: string; style?: React.CSSProperties }) {
  const props = { size, className, style };
  switch (type) {
    case 'flight': return <Plane {...props} />;
    case 'train': return <Train {...props} />;
    case 'bus': return <Bus {...props} />;
    case 'car': return <Car {...props} />;
    case 'ferry': return <Anchor {...props} />;
    default: return <Navigation {...props} />;
  }
}

function getUtcOffsetMinutes(tz: string): number {
  try {
    const now = new Date();
    const utcMs = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' })).getTime();
    const tzMs = new Date(now.toLocaleString('en-US', { timeZone: tz })).getTime();
    return Math.round((tzMs - utcMs) / 60000);
  } catch { return 0; }
}

function formatTzOffset(tz: string): string {
  if (!tz) return '';
  if (tz.startsWith('GMT') || tz.startsWith('UTC')) return tz;
  const offset = getUtcOffsetMinutes(tz);
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  const h = Math.floor(abs / 60).toString().padStart(2, '0');
  const m = (abs % 60).toString().padStart(2, '0');
  return `GMT${sign}${h}:${m}`;
}

function formatCardDate(dateStr: string, timeStr?: string): string {
  const d = new Date(dateStr + 'T00:00');
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const day = d.getDate();
  return timeStr ? `${month} ${day} · ${timeStr}` : `${month} ${day}`;
}

function formatCardDateTime(dateStr: string, timeStr: string, tz?: string): string {
  const base = formatCardDate(dateStr, timeStr);
  if (!tz) return base;
  const offset = formatTzOffset(tz);
  return offset ? `${base} (${offset})` : base;
}

const hexToRgba = (hex: string, alpha: number) => {
  if (!hex || !hex.startsWith('#') || hex.length !== 7) return `rgba(99, 102, 241, ${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const shortDate = (d: string) =>
  new Date(d + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const isValidDateStr = (d?: string): d is string =>
  !!d && !isNaN(new Date(d + 'T00:00').getTime());

const getGroupColor = (group: ReservationGroup) => {
  if (group.color) return group.color;
  if (group.id === 'hotels') return '#10b981';
  if (group.id === 'transports') return '#f59e0b';
  if (group.id === 'attractions') return '#ef4444';
  if (group.id === 'dining') return '#3b82f6';
  return 'var(--accent-primary)';
};

export default function ReservationsSection({
  trip,
  activePlan,
  daysList,
  selectedDateStr,
  onEditHotel,
  onDeleteHotel,
  onEditTransport,
  onDeleteTransport,
  onSaveTransportNotes,
  expandedHotelId,
  setExpandedHotelId,
  expandedTransitId,
  setExpandedTransitId,
  expandedAttractionReservationId,
  setExpandedAttractionReservationId,
  expandedDiningReservationId,
  setExpandedDiningReservationId,
  onAddHotel,
  onAddTransit,
  onAddPlaceReservation,
  onEditPlaceReservation,
  onDeletePlaceReservation,
  onImportReservationFile,
  reservationGroups,
  genericReservations,
  onAddReservationGroup,
  onEditReservationGroup,
  onMoveReservationGroup,
  onAddGenericReservation,
  onEditGenericReservation,
  onDeleteGenericReservation,
  activeReservationGroupDropdownId,
  setActiveReservationGroupDropdownId,
  formatDisplayDate,
}: ReservationsSectionProps) {
  const [expandedGenericReservationId, setExpandedGenericReservationId] = useState<string | null>(null);
  const [openTransitMapId, setOpenTransitMapId] = useState<string | null>(null);
  const [openCardOptionsMenuId, setOpenCardOptionsMenuId] = useState<string | null>(null);

  const hotelFileInputRef = useRef<HTMLInputElement>(null);
  const transitFileInputRef = useRef<HTMLInputElement>(null);
  const attractionFileInputRef = useRef<HTMLInputElement>(null);
  const diningFileInputRef = useRef<HTMLInputElement>(null);

  // Close card dropdowns on outside click
  useEffect(() => {
    if (!openTransitMapId && !openCardOptionsMenuId) return;
    const handler = () => { setOpenTransitMapId(null); setOpenCardOptionsMenuId(null); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [openTransitMapId, openCardOptionsMenuId]);

  // Close group dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.reservation-group-dropdown-container')) {
        setActiveReservationGroupDropdownId(null);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [setActiveReservationGroupDropdownId]);

  const saveHotelNotes = (hotel: Hotel, text: string) =>
    onEditHotel({ ...hotel, notes: text.trim() || undefined });
  const saveTransportNotes = (reservationId: string, text: string) =>
    onSaveTransportNotes(reservationId, text.trim());
  const savePlaceReservationNotes = (pr: PlaceReservation, text: string) =>
    onEditPlaceReservation && onEditPlaceReservation({ ...pr, notes: text.trim() || undefined });
  const saveGenericReservationNotes = (r: GenericReservation, text: string) =>
    onEditGenericReservation({ ...r, notes: text.trim() || undefined });

  const allWarnings = getReservationWarnings(trip, activePlan, daysList, formatDisplayDate);
  const hotelWarnings = allWarnings.filter(w => w.type === 'hotel');
  const transitWarnings = allWarnings.filter(w => w.type === 'transit');

  const renderHotelCards = () => (
    <>
      {hotelWarnings.map((w, i) => (
        <div key={i} className="reservation-warning">
          <AlertTriangle size={11} style={{ flexShrink: 0 }} />
          {w.message}
        </div>
      ))}
      {sortHotels(activePlan.hotels).map(h => {
        const isExpanded = expandedHotelId === h.id;
        const hotelLoc = getHotelResolvedLocation(h, activePlan.days, trip.locations);
        const isInRange = !!selectedDateStr && selectedDateStr >= h.checkInDate && selectedDateStr <= h.checkOutDate;
        return (
          <div
            key={h.id}
            className={`glass-panel reservation-card reservation-card--hotel reservation-card--expandable${isExpanded ? ' reservation-card--expanded' : ''}${openCardOptionsMenuId === h.id ? ' dropdown-active' : ''}`}
          >
            <div
              className="reservation-card-expand"
              onClick={() => { setExpandedHotelId(expandedHotelId === h.id ? null : h.id); }}
            >
              <div className="reservation-card-first-row">
                <div className="reservation-card-icon-row">
                  <Building size={13} className="reservation-card-type-icon" style={{ color: '#10b981' }} />
                  {hotelLoc && (() => {
                    const tagColor = hotelLoc.color || 'var(--accent-primary)';
                    const hexColor = hotelLoc.color || '#6366f1';
                    return (
                      <span
                        className="catalog-day-tag"
                        style={{
                          fontSize: '9px', padding: '1px 5px', color: tagColor,
                          background: hexToRgba(hexColor, 0.08), border: `1px solid ${hexToRgba(hexColor, 0.2)}`,
                          display: 'inline-flex', alignItems: 'center', gap: '3px', maxWidth: '120px', minWidth: 0, fontStyle: 'normal'
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {hotelLoc.city}
                        </span>
                      </span>
                    );
                  })()}
                </div>
                <div className="reservation-card-header-right" onClick={e => e.stopPropagation()}>
                  <div className="catalog-allocated-days">
                    <span className={`catalog-day-tag${isInRange ? ' catalog-day-tag--active' : ''}`}>{shortDate(h.checkInDate)}</span>
                    <span className={`catalog-day-tag${isInRange ? ' catalog-day-tag--active' : ''}`}>{shortDate(h.checkOutDate)}</span>
                  </div>
                  <a href={buildHotelMapsLink(h)} target="_blank" rel="noopener noreferrer" className="mini-icon-btn" data-tooltip="Open in Maps">
                    <MapPin size={14} />
                  </a>
                  <div className="card-options-menu">
                    <button className="mini-icon-btn" onClick={() => setOpenCardOptionsMenuId(prev => prev === h.id ? null : h.id)} data-tooltip="Options">
                      <MoreVertical size={14} />
                    </button>
                    {openCardOptionsMenuId === h.id && (
                      <div className="dropdown-menu dropdown-menu--right">
                        <button className="dropdown-item" onClick={() => { navigator.clipboard.writeText(h.name); setOpenCardOptionsMenuId(null); }}>
                          <Copy size={12} /> Copy Name
                        </button>
                        {h.address && (
                          <button className="dropdown-item" onClick={() => { navigator.clipboard.writeText(h.address!); setOpenCardOptionsMenuId(null); }}>
                            <Copy size={12} /> Copy Address
                          </button>
                        )}
                        {trip.canEdit !== false && <>
                          <button className="dropdown-item" onClick={() => { onEditHotel(h); setOpenCardOptionsMenuId(null); }}>
                            <Edit2 size={12} /> Edit
                          </button>
                          <button className="dropdown-item danger" onClick={() => { onDeleteHotel(h.id); setOpenCardOptionsMenuId(null); }}>
                            <Trash2 size={12} /> Delete
                          </button>
                        </>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="place-title-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, marginTop: '4px' }}>
                <h4 className="catalog-place-title catalog-place-title--no-margin" style={{ minWidth: 0 }}>{h.name}</h4>
                <span className={`reservation-status-badge reservation-status-badge--${(h.status || 'Planning').toLowerCase()}`} data-tooltip={h.status || 'Planning'}>
                  {renderStatusIcon(h.status)}
                </span>
              </div>
              <p className="place-desc-text"><Calendar size={11} /> Check-in: {formatCardDate(h.checkInDate, h.checkInTime)}</p>
              <p className="place-desc-text"><Calendar size={11} /> Check-out: {formatCardDate(h.checkOutDate, h.checkOutTime)}</p>
            </div>

            <div className={`card-expandable-wrapper${isExpanded ? ' is-expanded' : ''}`}>
              <div>
                <div className="reservation-card-expanded-content">
                  <a href={buildHotelMapsLink(h)} target="_blank" rel="noopener noreferrer" className="reservation-card-field-row" style={{ color: 'inherit', textDecoration: 'none' }} onClick={e => e.stopPropagation()}>
                    <MapPin size={11} />
                    <span className="place-desc-text">{h.address || h.name}</span>
                  </a>
                  <div className="reservation-card-field-row">
                    {h.confirmationNo && (<><Hash size={11} /><span className="place-desc-text">{h.confirmationNo}</span></>)}
                    <span className={`reservation-status-text-badge reservation-status-badge--${(h.status || 'Planning').toLowerCase()}`}>{h.status || 'Planning'}</span>
                  </div>
                  <div className="reservation-card-notes-wrap">
                    <InlineNotes
                      value={h.notes}
                      canEdit={trip.canEdit !== false}
                      onSave={(text) => saveHotelNotes(h, text)}
                      layout="card"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {activePlan.hotels.length === 0 && hotelWarnings.length === 0 && (
        <span className="subsection-subtitle">No hotels booked.</span>
      )}
    </>
  );

  const renderTransitCards = () => (
    <>
      {transitWarnings.map((w, i) => (
        <div key={i} className="reservation-warning">
          <AlertTriangle size={11} style={{ flexShrink: 0 }} />
          {w.message}
        </div>
      ))}
      {sortTransports(flattenReservations(activePlan.transports)).map(t => {
        const cardKey = t.id;
        const isExpanded = expandedTransitId === cardKey;
        const transitName = t.reservationName || `${t.departureLocationName} → ${t.arrivalLocationName}`;
        const hasOpenDropdown = openTransitMapId === cardKey || openCardOptionsMenuId === cardKey;
        const isInRange = !!selectedDateStr && selectedDateStr >= t.departureDate && selectedDateStr <= t.arrivalDate;

        return (
          <div
            key={cardKey}
            className={`glass-panel reservation-card reservation-card--transit reservation-card--expandable${isExpanded ? ' reservation-card--expanded' : ''}${hasOpenDropdown ? ' dropdown-active' : ''}`}
          >
            <div className="reservation-card-expand" onClick={() => { setExpandedTransitId(expandedTransitId === cardKey ? null : cardKey); }}>
              <div className="reservation-card-first-row">
                <div className="reservation-card-icon-row">
                  <TransportTypeIcon type={t.type} size={13} style={{ color: '#f59e0b' }} />
                  {t.totalSegments > 1 && (
                    <span className="catalog-day-tag catalog-day-tag--active">{t.segmentIndex + 1}/{t.totalSegments}</span>
                  )}
                  {(() => {
                    const { departureLocation: depLoc, arrivalLocation: arrLoc } = getTransitResolvedLocations(t.departureDate, t.arrivalDate, activePlan.days, trip.locations);
                    const renderTag = (loc: typeof trip.locations[0]) => {
                      const tagColor = loc.color || 'var(--accent-primary)';
                      const hexColor = loc.color || '#6366f1';
                      return (
                        <span className="catalog-day-tag" style={{ fontSize: '9px', padding: '1px 5px', color: tagColor, background: hexToRgba(hexColor, 0.08), border: `1px solid ${hexToRgba(hexColor, 0.2)}`, display: 'inline-flex', alignItems: 'center', gap: '3px', maxWidth: '120px', minWidth: 0 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loc.city}</span>
                        </span>
                      );
                    };
                    if (!depLoc && !arrLoc) return null;
                    if (!depLoc) return renderTag(arrLoc!);
                    if (!arrLoc) return renderTag(depLoc);
                    if (depLoc.id === arrLoc.id) return renderTag(depLoc);
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        {renderTag(depLoc)}
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>→</span>
                        {renderTag(arrLoc)}
                      </div>
                    );
                  })()}
                </div>
                <div className="reservation-card-header-right" onClick={e => e.stopPropagation()}>
                  <div className="catalog-allocated-days">
                    <span className={`catalog-day-tag${isInRange ? ' catalog-day-tag--active' : ''}`}>{shortDate(t.departureDate)}</span>
                    {t.departureDate !== t.arrivalDate && (
                      <span className={`catalog-day-tag${isInRange ? ' catalog-day-tag--active' : ''}`}>{shortDate(t.arrivalDate)}</span>
                    )}
                  </div>
                  <div className="card-options-menu">
                    <button className="mini-icon-btn" onClick={() => setOpenTransitMapId(prev => prev === cardKey ? null : cardKey)} data-tooltip="Map">
                      <MapPin size={14} />
                    </button>
                    {openTransitMapId === cardKey && (
                      <div className="dropdown-menu dropdown-menu--right">
                        <button className="dropdown-item" onClick={() => { window.open(buildTransitMapsLink(t.departureLocationName, t.departureAddress), '_blank'); setOpenTransitMapId(null); }}>
                          <ArrowUpRight size={12} /> {t.departureLocationName}
                        </button>
                        <button className="dropdown-item" onClick={() => { window.open(buildTransitMapsLink(t.arrivalLocationName, t.arrivalAddress), '_blank'); setOpenTransitMapId(null); }}>
                          <ArrowDownLeft size={12} /> {t.arrivalLocationName}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="card-options-menu">
                    <button className="mini-icon-btn" onClick={() => setOpenCardOptionsMenuId(prev => prev === cardKey ? null : cardKey)} data-tooltip="Options">
                      <MoreVertical size={14} />
                    </button>
                    {openCardOptionsMenuId === cardKey && (
                      <div className="dropdown-menu dropdown-menu--right">
                        <button className="dropdown-item" onClick={() => { navigator.clipboard.writeText(t.departureLocationName); setOpenCardOptionsMenuId(null); }}>
                          <Copy size={12} /> Copy Departure Location
                        </button>
                        {t.departureAddress && (
                          <button className="dropdown-item" onClick={() => { navigator.clipboard.writeText(t.departureAddress!); setOpenCardOptionsMenuId(null); }}>
                            <Copy size={12} /> Copy Departure Address
                          </button>
                        )}
                        <button className="dropdown-item" onClick={() => { navigator.clipboard.writeText(t.arrivalLocationName); setOpenCardOptionsMenuId(null); }}>
                          <Copy size={12} /> Copy Arrival Location
                        </button>
                        {t.arrivalAddress && (
                          <button className="dropdown-item" onClick={() => { navigator.clipboard.writeText(t.arrivalAddress!); setOpenCardOptionsMenuId(null); }}>
                            <Copy size={12} /> Copy Arrival Address
                          </button>
                        )}
                        {trip.canEdit !== false && <>
                          <button className="dropdown-item" onClick={() => {
                            const reservation = activePlan.transports.find(r => r.id === t.reservationId);
                            if (reservation) onEditTransport(reservation, t.segmentIndex);
                            setOpenCardOptionsMenuId(null);
                          }}>
                            <Edit2 size={12} /> Edit
                          </button>
                          <button className="dropdown-item danger" onClick={() => { onDeleteTransport(t.reservationId, t.segmentIndex); setOpenCardOptionsMenuId(null); }}>
                            <Trash2 size={12} /> Delete
                          </button>
                        </>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="place-title-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, marginTop: '4px' }}>
                <h4 className="catalog-place-title catalog-place-title--no-margin" style={{ minWidth: 0 }}>{transitName}</h4>
                <span className={`reservation-status-badge reservation-status-badge--${(t.status || 'Planning').toLowerCase()}`} data-tooltip={t.status || 'Planning'}>
                  {renderStatusIcon(t.status)}
                </span>
              </div>
              {t.carrier && <p className="place-desc-text">{t.carrier}{t.transitCode ? ` · ${t.transitCode}` : ''}</p>}
              <p className="place-desc-text"><Calendar size={11} /> Departs: {formatCardDateTime(t.departureDate, t.departureTime, t.departureTimezone)}</p>
              <p className="place-desc-text"><Calendar size={11} /> Arrives: {formatCardDateTime(t.arrivalDate, t.arrivalTime, t.arrivalTimezone)}</p>
            </div>

            <div className={`card-expandable-wrapper${isExpanded ? ' is-expanded' : ''}`}>
              <div>
                <div className="reservation-card-expanded-content">
                  <div className="reservation-card-field-row">
                    {t.confirmationNo && (<><Hash size={11} /><span className="place-desc-text">{t.confirmationNo}</span></>)}
                    <span className={`reservation-status-text-badge reservation-status-badge--${(t.status || 'Planning').toLowerCase()}`}>{t.status || 'Planning'}</span>
                  </div>
                  <a href={buildTransitMapsLink(t.departureLocationName, t.departureAddress)} target="_blank" rel="noopener noreferrer" className="reservation-card-field-row" style={{ color: 'inherit', textDecoration: 'none' }} onClick={e => e.stopPropagation()}>
                    <ArrowUpRight size={11} />
                    <span className="place-desc-text">Departure: {t.departureAddress || t.departureLocationName}</span>
                  </a>
                  <a href={buildTransitMapsLink(t.arrivalLocationName, t.arrivalAddress)} target="_blank" rel="noopener noreferrer" className="reservation-card-field-row" style={{ color: 'inherit', textDecoration: 'none' }} onClick={e => e.stopPropagation()}>
                    <ArrowDownLeft size={11} />
                    <span className="place-desc-text">Arrival: {t.arrivalAddress || t.arrivalLocationName}</span>
                  </a>
                  <div className="reservation-card-notes-wrap">
                    <InlineNotes
                      value={t.notes}
                      canEdit={trip.canEdit !== false}
                      onSave={(text) => saveTransportNotes(t.reservationId, text)}
                      layout="card"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {activePlan.transports.length === 0 && transitWarnings.length === 0 && (
        <span className="subsection-subtitle">No transit booked.</span>
      )}
    </>
  );

  const renderPlaceReservationCards = (targetType: 'attraction' | 'dining') => {
    const items = (activePlan.placeReservations || []).filter(pr => pr.type === targetType);
    if (items.length === 0) return <span className="subsection-subtitle">No {targetType === 'attraction' ? 'attractions' : 'dining'} booked.</span>;

    const expandedId = targetType === 'dining' ? expandedDiningReservationId : expandedAttractionReservationId;
    const setExpandedId = targetType === 'dining' ? setExpandedDiningReservationId : setExpandedAttractionReservationId;

    return items.map(pr => {
      const isExpanded = expandedId === pr.id;
      const isDeletedPlace = isPlaceReservationUnlinkedOrDeleted(pr.placeId, trip);
      const iconColor = targetType === 'attraction' ? '#ef4444' : '#3b82f6';
      const IconComp = targetType === 'attraction' ? Landmark : Utensils;
      const isDateActive = !!selectedDateStr && pr.date === selectedDateStr;
      const resLoc = (() => {
        if (pr.placeId) {
          return trip.locations.find(l => (l.places || []).some(p => p.id === pr.placeId));
        }
        if (pr.date && activePlan.days[pr.date]?.locationId) {
          const locId = activePlan.days[pr.date].locationId;
          return trip.locations.find(l => l.id === locId);
        }
        return undefined;
      })();
      const linkedPlace = pr.placeId ? (resLoc?.places || []).find(p => p.id === pr.placeId) : undefined;
      const mapUrl = linkedPlace ? (linkedPlace.mapsLink || buildMapsLink(linkedPlace.title, linkedPlace.lat, linkedPlace.lng, resLoc?.city)) : undefined;
      const cardTypeClass = targetType === 'attraction' ? 'reservation-card--attraction' : 'reservation-card--dining';

      return (
        <div
          key={pr.id}
          className={`glass-panel reservation-card ${cardTypeClass} reservation-card--expandable${isExpanded ? ' reservation-card--expanded' : ''}${openCardOptionsMenuId === `place-${pr.id}` ? ' dropdown-active' : ''}`}
        >
          <div
            className="reservation-card-expand"
            onClick={() => setExpandedId && setExpandedId(isExpanded ? null : pr.id)}
          >
            <div className="reservation-card-first-row">
              <div className="reservation-card-icon-row">
                <IconComp size={13} className="reservation-card-type-icon" style={{ color: iconColor }} />
                {resLoc && (() => {
                  const tagColor = resLoc.color || 'var(--accent-primary)';
                  const hexColor = resLoc.color || '#6366f1';
                  return (
                    <span
                      className="catalog-day-tag"
                      style={{
                        fontSize: '9px', padding: '1px 5px', color: tagColor,
                        background: hexToRgba(hexColor, 0.08), border: `1px solid ${hexToRgba(hexColor, 0.2)}`,
                        display: 'inline-flex', alignItems: 'center', gap: '3px', maxWidth: '120px', minWidth: 0, fontStyle: 'normal'
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {resLoc.city}
                      </span>
                    </span>
                  );
                })()}
              </div>
              <div className="reservation-card-header-right" onClick={e => e.stopPropagation()}>
                <div className="catalog-allocated-days">
                  {isValidDateStr(pr.date) && (
                    <span className={`catalog-day-tag${isDateActive ? ' catalog-day-tag--active' : ''}`}>
                      {shortDate(pr.date)}
                    </span>
                  )}
                </div>
                {mapUrl && (
                  <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="mini-icon-btn" data-tooltip="Open in Maps">
                    <MapPin size={14} />
                  </a>
                )}
                {trip.canEdit !== false && (
                  <div className="card-options-menu">
                    <button
                      className="mini-icon-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenCardOptionsMenuId(prev => prev === `place-${pr.id}` ? null : `place-${pr.id}`);
                      }}
                      data-tooltip="Options"
                    >
                      <MoreVertical size={14} />
                    </button>
                    {openCardOptionsMenuId === `place-${pr.id}` && (
                      <div className="dropdown-menu dropdown-menu--right">
                        <button
                          className="dropdown-item"
                          onClick={() => {
                            navigator.clipboard.writeText(pr.title);
                            setOpenCardOptionsMenuId(null);
                          }}
                        >
                          <Copy size={13} /> Copy Name
                        </button>
                        {pr.address && (
                          <button
                            className="dropdown-item"
                            onClick={() => {
                              navigator.clipboard.writeText(pr.address!);
                              setOpenCardOptionsMenuId(null);
                            }}
                          >
                            <Copy size={13} /> Copy Address
                          </button>
                        )}
                        <button
                          className="dropdown-item"
                          onClick={() => {
                            if (onEditPlaceReservation) onEditPlaceReservation(pr);
                            setOpenCardOptionsMenuId(null);
                          }}
                        >
                          <Edit2 size={13} /> Edit
                        </button>
                        <button
                          className="dropdown-item danger"
                          onClick={() => {
                            if (onDeletePlaceReservation) onDeletePlaceReservation(pr.id);
                            setOpenCardOptionsMenuId(null);
                          }}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="place-title-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, marginTop: '4px' }}>
              <h4 className="catalog-place-title catalog-place-title--no-margin" style={{ minWidth: 0 }}>{pr.title}</h4>
              <span className={`reservation-status-badge reservation-status-badge--${(pr.status || 'Planning').toLowerCase()}`} data-tooltip={pr.status || 'Planning'}>
                {renderStatusIcon(pr.status)}
              </span>
            </div>
            {isValidDateStr(pr.date) && (
              <p className="place-desc-text"><Calendar size={11} /> Date: {formatCardDate(pr.date, pr.time)}</p>
            )}

            {/* Prominent Warning Badge outside collapsed section */}
            {isDeletedPlace && (
              <div className="reservation-warning" style={{ marginTop: '4px', marginBottom: '4px' }}>
                <AlertTriangle size={11} style={{ flexShrink: 0 }} />
                Linked place deleted
              </div>
            )}
          </div>

          {/* Expandable details */}
          <div className={`card-expandable-wrapper${isExpanded ? ' is-expanded' : ''}`}>
            <div>
              <div className="reservation-card-expanded-content">
                {linkedPlace ? (
                  <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="reservation-card-field-row" style={{ color: 'inherit', textDecoration: 'none' }} onClick={e => e.stopPropagation()}>
                    <MapPin size={11} />
                    <span className="place-desc-text">{linkedPlace.title}</span>
                  </a>
                ) : pr.address && (
                  <div className="reservation-card-field-row">
                    <MapPin size={11} />
                    <span className="place-desc-text">{pr.address}</span>
                  </div>
                )}
                <div className="reservation-card-field-row">
                  {pr.confirmationNo && (<><Hash size={11} /><span className="place-desc-text">{pr.confirmationNo}</span></>)}
                  <span className={`reservation-status-text-badge reservation-status-badge--${(pr.status || 'Planning').toLowerCase()}`}>{pr.status || 'Planning'}</span>
                </div>
                <div className="reservation-card-notes-wrap">
                  <InlineNotes
                    value={pr.notes}
                    canEdit={trip.canEdit !== false}
                    onSave={(text) => savePlaceReservationNotes(pr, text)}
                    layout="card"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    });
  };

  const renderGenericCards = (groupId: string) => {
    const items = (genericReservations || []).filter(r => r.groupId === groupId);
    if (items.length === 0) return <span className="subsection-subtitle">No reservations added.</span>;

    return items.map(r => {
      const isExpanded = expandedGenericReservationId === r.id;
      const isDateActive = !!selectedDateStr && r.date === selectedDateStr;
      const genLoc = (() => {
        if (r.date && activePlan.days[r.date]?.locationId) {
          const locId = activePlan.days[r.date].locationId;
          return trip.locations.find(l => l.id === locId);
        }
        return undefined;
      })();

      return (
        <div
          key={r.id}
          className={`glass-panel reservation-card reservation-card--expandable${isExpanded ? ' reservation-card--expanded' : ''}${openCardOptionsMenuId === `generic-${r.id}` ? ' dropdown-active' : ''}`}
        >
          <div
            className="reservation-card-expand"
            onClick={() => setExpandedGenericReservationId(isExpanded ? null : r.id)}
          >
            <div className="reservation-card-first-row">
              <div className="reservation-card-icon-row">
                <Calendar size={13} className="reservation-card-type-icon" style={{ color: 'var(--accent-primary)' }} />
                {genLoc && (() => {
                  const tagColor = genLoc.color || 'var(--accent-primary)';
                  const hexColor = genLoc.color || '#6366f1';
                  return (
                    <span
                      className="catalog-day-tag"
                      style={{
                        fontSize: '9px', padding: '1px 5px', color: tagColor,
                        background: hexToRgba(hexColor, 0.08), border: `1px solid ${hexToRgba(hexColor, 0.2)}`,
                        display: 'inline-flex', alignItems: 'center', gap: '3px', maxWidth: '120px', minWidth: 0, fontStyle: 'normal'
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {genLoc.city}
                      </span>
                    </span>
                  );
                })()}
              </div>
              <div className="reservation-card-header-right" onClick={e => e.stopPropagation()}>
                <div className="catalog-allocated-days">
                  {isValidDateStr(r.date) && (
                    <span className={`catalog-day-tag${isDateActive ? ' catalog-day-tag--active' : ''}`}>
                      {shortDate(r.date)}
                    </span>
                  )}
                </div>
                {trip.canEdit !== false && (
                  <div className="card-options-menu">
                    <button className="mini-icon-btn" onClick={(e) => { e.stopPropagation(); setOpenCardOptionsMenuId(prev => prev === `generic-${r.id}` ? null : `generic-${r.id}`); }} data-tooltip="Options">
                      <MoreVertical size={14} />
                    </button>
                    {openCardOptionsMenuId === `generic-${r.id}` && (
                      <div className="dropdown-menu dropdown-menu--right">
                        <button className="dropdown-item" onClick={() => { onEditGenericReservation(r); setOpenCardOptionsMenuId(null); }}>
                          <Edit2 size={12} /> Edit
                        </button>
                        <button className="dropdown-item danger" onClick={() => { onDeleteGenericReservation?.(r.id); setOpenCardOptionsMenuId(null); }}>
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="place-title-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <h4 className="catalog-place-title catalog-place-title--no-margin" style={{ minWidth: 0 }}>{r.title}</h4>
              <span className={`reservation-status-badge reservation-status-badge--${(r.status || 'Planning').toLowerCase()}`} data-tooltip={r.status || 'Planning'}>
                {renderStatusIcon(r.status)}
              </span>
            </div>
            {isValidDateStr(r.date) && (
              <p className="place-desc-text"><Calendar size={11} /> Date: {formatCardDate(r.date, r.time)}</p>
            )}
          </div>

          {/* Expandable details */}
          <div className={`card-expandable-wrapper${isExpanded ? ' is-expanded' : ''}`}>
            <div>
              <div className="reservation-card-expanded-content">
                <div className="reservation-card-field-row">
                  {r.confirmationNo && (<><Hash size={11} /><span className="place-desc-text">{r.confirmationNo}</span></>)}
                  <span className={`reservation-status-text-badge reservation-status-badge--${(r.status || 'Planning').toLowerCase()}`}>{r.status || 'Planning'}</span>
                </div>
                <div className="reservation-card-notes-wrap">
                  <InlineNotes
                    value={r.notes}
                    canEdit={trip.canEdit !== false}
                    onSave={(text) => saveGenericReservationNotes(r, text)}
                    layout="card"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="accordion-content">
      <div className="reservations-inner">

        {/* Top header row with Add Group button */}
        <div className="subsection-header catalog-groups-header" style={{ marginBottom: '4px' }}>
          <h4 className="subsection-title catalog-groups-label">Trip Reservations</h4>
          <div className="subsection-actions catalog-groups-right">
            {trip.canEdit !== false && (
              <button
                className="mini-icon-btn catalog-add-group-btn"
                onClick={onAddReservationGroup}
                data-tooltip="Add Reservation Group"
                data-tooltip-position="bottom"
              >
                <Plus size={14} /> Add Group
              </button>
            )}
          </div>
        </div>

        {/* Groups */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {reservationGroups.map((group, groupIdx) => {
            const isFirst = groupIdx === 0;
            const isLast = groupIdx === reservationGroups.length - 1;
            const showAbove = groupIdx >= Math.max(1, reservationGroups.length - 2);
            const gColor = getGroupColor(group);
            const isDefaultGroup = group.id === 'hotels' || group.id === 'transports' || group.id === 'attractions' || group.id === 'dining';

            return (
              <div key={group.id} className="place-group-section">
                {/* Group Header */}
                <div className="place-group-header">
                  <span className="place-group-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {getExpenseGroupIcon(group.icon, 14, '', { color: gColor })}
                    <span className="catalog-group-name" style={{ fontWeight: 600 }} title={group.name}>
                      {group.name}
                    </span>
                  </span>
                  <div className="flex-align flex-align--gap4">
                    {trip.canEdit !== false && (
                      <>
                        {/* Add button */}
                        <button
                          className="mini-icon-btn catalog-group-action-btn--labeled"
                          onClick={() => {
                            if (group.id === 'hotels') onAddHotel();
                            else if (group.id === 'transports') onAddTransit();
                            else if (group.id === 'attractions' && onAddPlaceReservation) onAddPlaceReservation('attraction');
                            else if (group.id === 'dining' && onAddPlaceReservation) onAddPlaceReservation('dining');
                            else onAddGenericReservation(group.id);
                          }}
                          data-tooltip={`Add Reservation to ${group.name}`}
                        >
                          <Plus size={12} /> Add
                        </button>

                        {/* Import button — for all default groups */}
                        {isDefaultGroup && (
                          <>
                            <button
                              className="mini-icon-btn catalog-group-action-btn--labeled"
                              onClick={() => {
                                if (group.id === 'hotels') hotelFileInputRef.current?.click();
                                else if (group.id === 'transports') transitFileInputRef.current?.click();
                                else if (group.id === 'attractions') attractionFileInputRef.current?.click();
                                else if (group.id === 'dining') diningFileInputRef.current?.click();
                              }}
                              disabled={!GeminiService.isAiEnabled() || GeminiService.isManualMode()}
                              data-tooltip={
                                !GeminiService.isAiEnabled() ? AI_NOT_CONFIGURED_MESSAGE :
                                GeminiService.isManualMode() ? AI_FILE_CONTENTS_NOT_AVAILABLE_IN_MANUAL_MODE_MESSAGE :
                                `Import ${group.name} Booking Confirmation using AI`
                              }
                              data-tooltip-position="bottom"
                            >
                              <Sparkles size={12} /> Import
                            </button>
                            {group.id === 'hotels' && (
                              <input
                                ref={hotelFileInputRef}
                                type="file"
                                style={{ display: 'none' }}
                                accept="image/*,application/pdf,.eml,.txt"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) onImportReservationFile('hotel', file);
                                  e.target.value = '';
                                }}
                              />
                            )}
                            {group.id === 'transports' && (
                              <input
                                ref={transitFileInputRef}
                                type="file"
                                style={{ display: 'none' }}
                                accept="image/*,application/pdf,.eml,.txt"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) onImportReservationFile('transit', file);
                                  e.target.value = '';
                                }}
                              />
                            )}
                            {group.id === 'attractions' && (
                              <input
                                ref={attractionFileInputRef}
                                type="file"
                                style={{ display: 'none' }}
                                accept="image/*,application/pdf,.eml,.txt"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) onImportReservationFile('attraction', file);
                                  e.target.value = '';
                                }}
                              />
                            )}
                            {group.id === 'dining' && (
                              <input
                                ref={diningFileInputRef}
                                type="file"
                                style={{ display: 'none' }}
                                accept="image/*,application/pdf,.eml,.txt"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) onImportReservationFile('dining', file);
                                  e.target.value = '';
                                }}
                              />
                            )}
                          </>
                        )}

                        {/* Group options menu */}
                        <div className="reservation-group-dropdown-container" style={{ position: 'relative' }}>
                          <button
                            className="mini-icon-btn catalog-group-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveReservationGroupDropdownId(activeReservationGroupDropdownId === group.id ? null : group.id);
                            }}
                            data-tooltip="Group Options"
                          >
                            <MoreVertical size={12} />
                          </button>
                          {activeReservationGroupDropdownId === group.id && (
                            <div className={`dropdown-menu dropdown-menu--right${showAbove ? ' dropdown-menu-above' : ''}`} style={{ zIndex: 1100 }}>
                              <button
                                className="dropdown-item"
                                disabled={isFirst}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onMoveReservationGroup(groupIdx, 'up');
                                  setActiveReservationGroupDropdownId(null);
                                }}
                              >
                                <ChevronUp size={12} /> Move Up
                              </button>
                              <button
                                className="dropdown-item"
                                disabled={isLast}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onMoveReservationGroup(groupIdx, 'down');
                                  setActiveReservationGroupDropdownId(null);
                                }}
                              >
                                <ChevronDown size={12} /> Move Down
                              </button>
                              <button
                                className="dropdown-item"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditReservationGroup(group);
                                  setActiveReservationGroupDropdownId(null);
                                }}
                              >
                                <Edit2 size={12} /> Edit Group
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Group Items */}
                <div className="catalog-places-list">
                  {group.id === 'hotels' && renderHotelCards()}
                  {group.id === 'transports' && renderTransitCards()}
                  {group.id === 'attractions' && renderPlaceReservationCards('attraction')}
                  {group.id === 'dining' && renderPlaceReservationCards('dining')}
                  {group.id !== 'hotels' && group.id !== 'transports' && group.id !== 'attractions' && group.id !== 'dining' && renderGenericCards(group.id)}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
