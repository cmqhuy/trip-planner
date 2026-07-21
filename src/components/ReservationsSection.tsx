import { useState, useEffect, useRef } from 'react';
import {
  Plane, Building, AlertTriangle, MapPin, Hash,
  Edit2, Trash2, Check, Timer, X, Calendar,
  Train, Bus, Car, Anchor, Navigation, FileText,
  MoreVertical, ArrowUpRight, ArrowDownLeft, Copy,
  Plus, Sparkles, ChevronUp, ChevronDown
} from 'lucide-react';
import type { Trip, Plan, Hotel, TransportationReservation, ReservationGroup, GenericReservation } from '../types';
import { flattenReservations } from '../types';
import { GeminiService, AI_NOT_CONFIGURED_MESSAGE, AI_FILE_CONTENTS_NOT_AVAILABLE_IN_MANUAL_MODE_MESSAGE } from '../utils/ai';
import { buildHotelMapsLink, buildTransitMapsLink } from '../utils/api';
import { sortHotels, sortTransports } from '../utils/dateUtils';
import { getHotelResolvedLocation, getTransitResolvedLocations } from '../utils/locationUtils';
import { getExpenseGroupIcon } from '../utils/expenseUtils';

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
  onAddHotel: () => void;
  onAddTransit: () => void;
  onImportReservationFile: (type: 'hotel' | 'transit', file: File) => void;
  // Group management
  reservationGroups: ReservationGroup[];
  genericReservations: GenericReservation[];
  onAddReservationGroup: () => void;
  onEditReservationGroup: (group: ReservationGroup) => void;
  onMoveReservationGroup: (index: number, direction: 'up' | 'down') => void;
  onAddGenericReservation: (groupId: string) => void;
  onEditGenericReservation: (reservation: GenericReservation) => void;
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
  onAddHotel,
  onAddTransit,
  onImportReservationFile,
  reservationGroups,
  genericReservations,
  onAddReservationGroup,
  onEditReservationGroup,
  onMoveReservationGroup,
  onAddGenericReservation,
  onEditGenericReservation,
  activeReservationGroupDropdownId,
  setActiveReservationGroupDropdownId,
  formatDisplayDate,
}: ReservationsSectionProps) {
  const [editingHotelNoteId, setEditingHotelNoteId] = useState<string | null>(null);
  const [editingTransitNoteId, setEditingTransitNoteId] = useState<string | null>(null);
  const [editingHotelNotesText, setEditingHotelNotesText] = useState('');
  const [editingTransitNotesText, setEditingTransitNotesText] = useState('');
  const [openTransitMapId, setOpenTransitMapId] = useState<string | null>(null);
  const [openCardOptionsMenuId, setOpenCardOptionsMenuId] = useState<string | null>(null);

  const hotelFileInputRef = useRef<HTMLInputElement>(null);
  const transitFileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (editingHotelNoteId) {
      const h = activePlan.hotels.find(h => h.id === editingHotelNoteId);
      setEditingHotelNotesText(h?.notes ?? '');
    }
  }, [editingHotelNoteId, activePlan.hotels]);

  useEffect(() => {
    if (editingTransitNoteId) {
      const reservation = activePlan.transports.find(r => r.id === editingTransitNoteId);
      setEditingTransitNotesText(reservation?.notes ?? '');
    }
  }, [editingTransitNoteId, activePlan.transports]);

  const saveHotelNotes = (hotel: Hotel, text: string) =>
    onEditHotel({ ...hotel, notes: text.trim() || undefined });
  const saveTransportNotes = (reservationId: string, text: string) =>
    onSaveTransportNotes(reservationId, text.trim());

  const getDailyHotelWarnings = (): { dateStr: string; message: string }[] => {
    const dailyStatuses = daysList.map(d => {
      const isNoHotel = activePlan.days[d]?.noHotel;
      const hotelsForDay = activePlan.hotels.filter(
        h => h.status !== 'Canceled' && h.checkInDate <= d && d < h.checkOutDate
      );
      const confirmedHotels = hotelsForDay.filter(h => h.status === 'Confirmed');
      const pendingHotels = hotelsForDay.filter(h => !h.status || h.status === 'Planning');

      if (confirmedHotels.length === 0) {
        if (isNoHotel) return { dateStr: d, type: 'none' as const };
        if (pendingHotels.length > 0) return { dateStr: d, type: 'pending-no-confirmed' as const };
        const locId = activePlan.days[d]?.locationId;
        if (locId) return { dateStr: d, type: 'no-hotel' as const };
      } else {
        if (pendingHotels.length > 0) return { dateStr: d, type: 'pending-with-confirmed' as const };
      }
      return { dateStr: d, type: 'none' as const };
    });

    const warnings: { dateStr: string; message: string }[] = [];
    let currentNoHotelRun: string[] = [];

    const flushNoHotelRun = () => {
      if (currentNoHotelRun.length === 0) return;
      if (currentNoHotelRun.length === 1) {
        const d = currentNoHotelRun[0];
        warnings.push({ dateStr: d, message: `No hotels booked for ${formatDisplayDate(d)}.` });
      } else {
        const startDay = currentNoHotelRun[0];
        const endDay = currentNoHotelRun[currentNoHotelRun.length - 1];
        warnings.push({ dateStr: startDay, message: `No hotels booked for ${formatDisplayDate(startDay)} - ${formatDisplayDate(endDay)}.` });
      }
      currentNoHotelRun = [];
    };

    for (const status of dailyStatuses) {
      if (status.type === 'no-hotel') {
        currentNoHotelRun.push(status.dateStr);
      } else {
        flushNoHotelRun();
        if (status.type === 'pending-no-confirmed') {
          warnings.push({ dateStr: status.dateStr, message: `No confirmed hotels booked for ${formatDisplayDate(status.dateStr)}. Please mark the pending hotel to confirmed.` });
        } else if (status.type === 'pending-with-confirmed') {
          warnings.push({ dateStr: status.dateStr, message: `There are pending hotels for ${formatDisplayDate(status.dateStr)}. Please confirm or cancel them.` });
        }
      }
    }
    flushNoHotelRun();
    return warnings;
  };

  const getDailyTransitWarnings = (): { message: string }[] => {
    const warnings: { message: string }[] = [];
    for (let i = 1; i < daysList.length; i++) {
      const prevDayStr = daysList[i - 1];
      const dayStr = daysList[i];
      const prevLocId = activePlan.days[prevDayStr]?.locationId;
      const currLocId = activePlan.days[dayStr]?.locationId;
      if (prevLocId && currLocId && prevLocId !== currLocId) {
        const prevLoc = trip.locations.find(l => l.id === prevLocId);
        const currLoc = trip.locations.find(l => l.id === currLocId);
        const prevCity = prevLoc?.city ?? 'previous location';
        const currCity = currLoc?.city ?? 'next location';

        const transits = activePlan.transports.filter(
          t => t.status !== 'Canceled' && t.segments.some(s => s.departureDate === prevDayStr || s.arrivalDate === dayStr)
        );
        const confirmedTransports = transits.filter(t => t.status === 'Confirmed');
        const pendingTransports = transits.filter(t => !t.status || t.status === 'Planning');

        if (confirmedTransports.length === 0) {
          if (pendingTransports.length > 0) {
            warnings.push({ message: `No confirmed transit from ${prevCity} to ${currCity}. Please mark the pending transit to confirmed.` });
          } else {
            warnings.push({ message: `No transit from ${prevCity} to ${currCity}.` });
          }
        } else if (pendingTransports.length > 0) {
          warnings.push({ message: `There are pending transits from ${prevCity} to ${currCity}. Please confirm or cancel them.` });
        }
      }
    }
    return warnings;
  };

  const hotelWarnings = getDailyHotelWarnings();
  const transitWarnings = getDailyTransitWarnings();

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
                    <div className="notes-box">
                      <label className="notes-label">
                        <FileText size={11} /> Notes
                        {trip.canEdit !== false && editingHotelNoteId !== h.id && (
                          <button className="mini-icon-btn notes-edit-btn" onClick={e => { e.stopPropagation(); setEditingHotelNoteId(h.id); setEditingTransitNoteId(null); setEditingHotelNotesText(h.notes ?? ''); }} data-tooltip="Edit notes">
                            <Edit2 size={12} />
                          </button>
                        )}
                      </label>
                      {editingHotelNoteId === h.id ? (
                        <div className="notes-edit-wrapper">
                          <textarea className="notes-textarea" rows={3} value={editingHotelNotesText} onChange={e => setEditingHotelNotesText(e.target.value)} placeholder="Add notes..." />
                          <div className="notes-actions">
                            <button className="btn-secondary catalog-place-action-btn" onClick={() => setEditingHotelNoteId(null)}>Cancel</button>
                            <button className="btn-primary flex-align catalog-place-action-btn" onClick={() => { saveHotelNotes(h, editingHotelNotesText); setEditingHotelNoteId(null); }}>
                              <Check size={12} /> Save Notes
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className={`notes-text ${h.notes ? 'has-content' : 'no-content'}`}>{h.notes || 'No notes added yet.'}</span>
                      )}
                    </div>
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
                    <div className="notes-box">
                      <label className="notes-label">
                        <FileText size={11} /> Notes
                        {trip.canEdit !== false && editingTransitNoteId !== t.reservationId && (
                          <button className="mini-icon-btn notes-edit-btn" onClick={e => { e.stopPropagation(); setEditingTransitNoteId(t.reservationId); setEditingHotelNoteId(null); setEditingTransitNotesText(t.notes ?? ''); }} data-tooltip="Edit notes">
                            <Edit2 size={12} />
                          </button>
                        )}
                      </label>
                      {editingTransitNoteId === t.reservationId ? (
                        <div className="notes-edit-wrapper">
                          <textarea className="notes-textarea" rows={3} value={editingTransitNotesText} onChange={e => setEditingTransitNotesText(e.target.value)} placeholder="Add notes..." />
                          <div className="notes-actions">
                            <button className="btn-secondary catalog-place-action-btn" onClick={() => setEditingTransitNoteId(null)}>Cancel</button>
                            <button className="btn-primary flex-align catalog-place-action-btn" onClick={() => { saveTransportNotes(t.reservationId, editingTransitNotesText); setEditingTransitNoteId(null); }}>
                              <Check size={12} /> Save Notes
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className={`notes-text ${t.notes ? 'has-content' : 'no-content'}`}>{t.notes || 'No notes added yet.'}</span>
                      )}
                    </div>
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

  const renderGenericCards = (groupId: string) => {
    const items = (genericReservations || []).filter(r => r.groupId === groupId);
    if (items.length === 0) return <span className="subsection-subtitle">No reservations added.</span>;

    return items.map(r => {
      const isExpanded = openCardOptionsMenuId === `generic-${r.id}`;
      return (
        <div
          key={r.id}
          className={`glass-panel reservation-card reservation-card--expandable${isExpanded ? ' dropdown-active' : ''}`}
          onClick={() => trip.canEdit !== false && onEditGenericReservation(r)}
          style={{ cursor: trip.canEdit !== false ? 'pointer' : 'default' }}
        >
          <div className="reservation-card-first-row">
            <div className="reservation-card-icon-row">
              {r.date && (
                <span className="catalog-day-tag" style={{ fontSize: '9px', padding: '1px 5px' }}>
                  {shortDate(r.date)}{r.time ? ` · ${r.time}` : ''}
                </span>
              )}
            </div>
            <div className="reservation-card-header-right" onClick={e => e.stopPropagation()}>
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
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="place-title-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, marginTop: '4px' }}>
            <h4 className="catalog-place-title catalog-place-title--no-margin" style={{ minWidth: 0 }}>{r.title}</h4>
            <span className={`reservation-status-badge reservation-status-badge--${(r.status || 'Planning').toLowerCase()}`} data-tooltip={r.status || 'Planning'}>
              {renderStatusIcon(r.status)}
            </span>
          </div>
          {r.confirmationNo && (
            <p className="place-desc-text"><Hash size={11} /> {r.confirmationNo}</p>
          )}
          {r.notes && (
            <p className="place-desc-text" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <FileText size={11} /> {r.notes}
            </p>
          )}
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
                <Plus size={14} />
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
            const isDefaultGroup = group.id === 'hotels' || group.id === 'transports';

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
                          className="mini-icon-btn catalog-group-action-btn"
                          onClick={() => {
                            if (group.id === 'hotels') onAddHotel();
                            else if (group.id === 'transports') onAddTransit();
                            else onAddGenericReservation(group.id);
                          }}
                          data-tooltip={`Add Reservation to ${group.name}`}
                        >
                          <Plus size={12} />
                        </button>

                        {/* Import button — only for hotels/transits */}
                        {isDefaultGroup && (
                          <>
                            <button
                              className="mini-icon-btn catalog-group-action-btn"
                              onClick={() => {
                                if (group.id === 'hotels') hotelFileInputRef.current?.click();
                                else transitFileInputRef.current?.click();
                              }}
                              disabled={!GeminiService.isAiEnabled() || GeminiService.isManualMode()}
                              data-tooltip={
                                !GeminiService.isAiEnabled() ? AI_NOT_CONFIGURED_MESSAGE :
                                GeminiService.isManualMode() ? AI_FILE_CONTENTS_NOT_AVAILABLE_IN_MANUAL_MODE_MESSAGE :
                                `Import ${group.name.toLowerCase()} booking confirmation using AI`
                              }
                              data-tooltip-position="bottom"
                            >
                              <Sparkles size={12} />
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
                  {group.id !== 'hotels' && group.id !== 'transports' && renderGenericCards(group.id)}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
