import React from 'react';
import { 
  MapPin, Plus, Trash2, Edit2, Share2, Sparkles, MoreVertical,
  Calendar, Layers, Check, X, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Plane, Train, Bus, Car, Anchor, Navigation, Building,
  Search, FileText, RefreshCw, ArrowRight
} from 'lucide-react';
import type { Trip, Plan, Location, Place, Hotel, Transportation } from '../types';
import { DEFAULT_PLACE_GROUPS, getFormattedLocationName, getLocIcon, buildMapsLink } from '../utils/api';
import { getOptimizedImageUrl } from '../utils/image';
import FunGeneratingLoader from './FunGeneratingLoader';
import AiMarkdownSection from './AiMarkdownSection';
import AiDetailsView from './AiDetailsView';
import LocationSelect from './LocationSelect';

const hexToRgba = (hex: string, alpha: number) => {
  if (!hex || !hex.startsWith('#') || hex.length !== 7) return `rgba(99, 102, 241, ${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

interface ItineraryPanelProps {
  trip: Trip;
  activePlan: Plan;
  activePlanId: string;
  setActivePlanId: (id: string) => void;
  activeDayStr: string;
  setActiveDayStr: (day: string) => void;
  activeDay: any;
  activeDayLocation: Location | undefined;
  catalogLocation: Location | undefined;
  daysList: string[];
  activeMobileTab: 'catalog' | 'itinerary' | 'map';
  isGoogleSignedIn?: boolean;
  onShareTrip: ((trip: Trip) => void) | undefined;
  formatDisplayDate: (dateStr: string) => string;
  getHotelsForDay: (dateStr: string) => Hotel[];
  getTransportsForDay: (dateStr: string) => Transportation[];
  scheduledPlaces: Place[];
  displayScheduledPlaces: Place[];
  activePlaceId: string | undefined;
  setActivePlaceId: (id: string | undefined) => void;
  placeGeneratingIds: Set<string>;
  editingPlaceNotesId: string | null;
  setEditingPlaceNotesId: (id: string | null) => void;
  tempNotes: string;
  setTempNotes: (notes: string) => void;
  placeQuery: string;
  setPlaceQuery: (query: string) => void;
  placeSuggestions: Omit<Place, 'placeGroupId'>[];
  isSearchingPlace: boolean;
  draggedPlaceId: string | null;
  draggedDayPlaceIndex: number | null;
  setDraggedDayPlaceIndex: (idx: number | null) => void;
  dragOverDayPlaceIndex: number | null;
  setDragOverDayPlaceIndex: (idx: number | null) => void;
  dragOverDayPlacePosition: 'top' | 'bottom';
  setDragOverDayPlacePosition: (pos: 'top' | 'bottom') => void;
  setShowEditTripModal: (show: boolean) => void;
  setShowTripAiConfigModal: (show: boolean) => void;
  setShowHotelModal: (show: boolean) => void;
  setShowTransportModal: (show: boolean) => void;
  setShowAddLocationModal: (show: boolean) => void;
  setAddLocationForDay: (forDay: boolean) => void;
  setShowDayOptionsMenu: (show: boolean) => void;
  showDayOptionsMenu: boolean;
  setShowMoveDayModal: (show: boolean) => void;
  setShowAiGenerateDaysModal: (show: boolean) => void;
  setShowCustomPlaceModal: (show: boolean) => void;
  setAutoScheduleOnActiveDay: (auto: boolean) => void;
  setEditingPlace: (place: Place | null) => void;
  setAiGeneratePlaces: (places: Place[]) => void;
  setAiGenerateCity: (city: string) => void;
  setAiGenerateCountry: (country: string) => void;
  setShowAiGenerateModal: (show: boolean) => void;
  isRenamingPlan: boolean;
  setIsRenamingPlan: (renaming: boolean) => void;
  editPlanName: string;
  setEditPlanName: (name: string) => void;
  handleRenamePlan: () => void;
  handleDeletePlan: (planId: string) => void;
  handleMovePlan: (direction: 'up' | 'down') => void;
  showPlanMenu: boolean;
  setShowPlanMenu: (show: boolean) => void;
  setShowNewPlanModal: (show: boolean) => void;
  handleSetDayLocation: (locId: string) => void;
  handleDeleteHotel: (hotelId: string) => void;
  handleDeleteTransportation: (transportId: string) => void;
  handleGenerateSingleDayTips: (dateStr: string) => void;
  handleSaveDayTips: (dateStr: string, content: string) => void;
  handleSaveBabyLogistics: (dateStr: string, content: string) => void;
  handleClearDay: () => void;
  handleAddPlaceFromDayTimeline: (place: Omit<Place, 'placeGroupId'>) => void;
  handleDayPlaceDragStart: (index: number) => void;
  handleDayPlaceDrop: (targetIndex: number, position: 'top' | 'bottom') => void;
  handleCatalogPlaceDropOnTimeline: (placeId: string, targetIndex: number, position: 'top' | 'bottom') => void;
  handleMovePlaceOrder: (index: number, direction: 'up' | 'down') => void;
  handleRemovePlaceFromDay: (index: number) => void;
  handleAddPlaceToDay: (place: Place) => void;
  handleOpenEditPlace: (place: Place) => void;
  handleGenerateSinglePlaceAiDetails: (placeId: string) => void;
  startEditingNotes: (place: Place) => void;
  savePlaceNotes: (placeId: string) => void;
  activeTimelinePlaceDropdownKey: string | null;
  setActiveTimelinePlaceDropdownKey: (key: string | null) => void;
  daysGeneratingDates: Set<string>;
  daysTabsNavRef: React.RefObject<HTMLDivElement | null>;
  lastScrollLeft: React.MutableRefObject<number>;
  searchDropdownRef: React.RefObject<HTMLDivElement | null>;
  leftCollapsed?: boolean;
  setLeftCollapsed?: (val: boolean) => void;
  rightCollapsed?: boolean;
  setRightCollapsed?: (val: boolean) => void;
}

export default function ItineraryPanel({
  trip,
  activePlan,
  activePlanId,
  setActivePlanId,
  activeDayStr,
  setActiveDayStr,
  activeDay,
  activeDayLocation,
  catalogLocation,
  daysList,
  activeMobileTab,
  isGoogleSignedIn,
  onShareTrip,
  formatDisplayDate,
  getHotelsForDay,
  getTransportsForDay,
  scheduledPlaces,
  displayScheduledPlaces,
  activePlaceId,
  setActivePlaceId,
  placeGeneratingIds,
  editingPlaceNotesId,
  setEditingPlaceNotesId,
  tempNotes,
  setTempNotes,
  placeQuery,
  setPlaceQuery,
  placeSuggestions,
  isSearchingPlace,
  draggedPlaceId,
  draggedDayPlaceIndex,
  setDraggedDayPlaceIndex,
  dragOverDayPlaceIndex,
  setDragOverDayPlaceIndex,
  dragOverDayPlacePosition,
  setDragOverDayPlacePosition,
  setShowEditTripModal,
  setShowTripAiConfigModal,
  setShowHotelModal,
  setShowTransportModal,
  setShowAddLocationModal,
  setAddLocationForDay,
  setShowDayOptionsMenu,
  showDayOptionsMenu,
  setShowMoveDayModal,
  setShowAiGenerateDaysModal,
  setShowCustomPlaceModal,
  setAutoScheduleOnActiveDay,
  setEditingPlace,
  setAiGeneratePlaces,
  setAiGenerateCity,
  setAiGenerateCountry,
  setShowAiGenerateModal,
  isRenamingPlan,
  setIsRenamingPlan,
  editPlanName,
  setEditPlanName,
  handleRenamePlan,
  handleDeletePlan,
  handleMovePlan,
  showPlanMenu,
  setShowPlanMenu,
  setShowNewPlanModal,
  handleSetDayLocation,
  handleDeleteHotel,
  handleDeleteTransportation,
  handleGenerateSingleDayTips,
  handleSaveDayTips,
  handleSaveBabyLogistics,
  handleClearDay,
  handleAddPlaceFromDayTimeline,
  handleDayPlaceDragStart,
  handleDayPlaceDrop,
  handleCatalogPlaceDropOnTimeline,
  handleMovePlaceOrder,
  handleRemovePlaceFromDay,
  handleAddPlaceToDay,
  handleOpenEditPlace,
  handleGenerateSinglePlaceAiDetails,
  startEditingNotes,
  savePlaceNotes,
  activeTimelinePlaceDropdownKey,
  setActiveTimelinePlaceDropdownKey,
  daysGeneratingDates,
  daysTabsNavRef,
  lastScrollLeft,
  searchDropdownRef,
  leftCollapsed,
  setLeftCollapsed,
  rightCollapsed,
  setRightCollapsed
}: ItineraryPanelProps) {

  const getCategoryIconComponent = (iconName: string, size = 12, className?: string, style?: React.CSSProperties) => {
    switch (iconName) {
      case 'landmark': return <MapPin size={size} className={className} style={style} />;
      case 'utensils': return <MapPin size={size} className={className} style={style} />;
      case 'shopping-bag': return <MapPin size={size} className={className} style={style} />;
      case 'camera': return <MapPin size={size} className={className} style={style} />;
      case 'heart': return <MapPin size={size} className={className} style={style} />;
      default: return <MapPin size={size} className={className} style={style} />;
    }
  };

  return (
    <div className={`itinerary-panel ${activeMobileTab === 'itinerary' ? 'mobile-active' : ''}`} style={{ position: 'relative' }}>
      {setLeftCollapsed && (
        <button 
          className="panel-toggle-btn left-toggle" 
          onClick={() => setLeftCollapsed(!leftCollapsed)}
          data-tooltip={leftCollapsed ? "Expand Catalog Panel" : "Collapse Catalog Panel"}
        >
          {leftCollapsed ? <ChevronRight size={10} /> : <ChevronLeft size={10} />}
        </button>
      )}

      {setRightCollapsed && (
        <button 
          className="panel-toggle-btn right-toggle" 
          onClick={() => setRightCollapsed(!rightCollapsed)}
          data-tooltip={rightCollapsed ? "Expand Map Panel" : "Collapse Map Panel"}
        >
          {rightCollapsed ? <ChevronLeft size={10} /> : <ChevronRight size={10} />}
        </button>
      )}

      <div className="itinerary-header">
        <div className="trip-meta-info-container">
          <div className="trip-title-row">
            <h2 className="trip-title-text" style={{ fontSize: '24px', margin: 0 }}>{trip.name}</h2>
            <div className="trip-action-buttons" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {trip.isOwner !== false && (
                <button 
                  className="mini-icon-btn" 
                  onClick={() => setShowEditTripModal(true)}
                  data-tooltip="Edit Trip Details"
                  style={{ padding: '4px', opacity: 0.6 }}
                >
                  <Edit2 size={14} />
                </button>
              )}
              {trip.isOwner !== false && (
                <button 
                  className="mini-icon-btn" 
                  onClick={() => setShowTripAiConfigModal(true)}
                  data-tooltip="Trip AI Config Settings"
                  style={{ padding: '4px', opacity: 0.6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Sparkles size={14} style={{ color: 'var(--accent-primary)' }} />
                </button>
              )}
              {isGoogleSignedIn && trip.isOwner !== false && trip.driveFileId && (
                <button 
                  className="mini-icon-btn" 
                  onClick={() => onShareTrip && onShareTrip(trip)}
                  data-tooltip="Share Itinerary"
                  style={{ padding: '4px', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Share2 size={14} />
                </button>
              )}
              {trip.isOwner === false && (
                <span 
                  style={{ 
                    fontSize: '10px', 
                    padding: '2px 8px', 
                    borderRadius: '99px', 
                    background: 'rgba(96, 165, 250, 0.15)', 
                    color: '#60a5fa', 
                    fontWeight: 600,
                    textTransform: 'none'
                  }}
                >
                  {trip.canEdit === false ? 'Viewer Mode' : 'Editor Mode'}
                </span>
              )}
            </div>
          </div>
          
          <div className="trip-duration-text" style={{ color: 'var(--text-muted)', fontSize: '12px', display: 'flex', gap: '8px' }}>
            <span className="flex-align" style={{ gap: '6px' }}>
              <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
              {formatDisplayDate(trip.startDate)} - {formatDisplayDate(trip.endDate)}
            </span>
          </div>
          
          <div className="trip-plan-picker-column">
            {isRenamingPlan ? (
              <div className="flex-align" style={{ gap: '4px' }}>
                <input 
                  type="text" 
                  value={editPlanName} 
                  onChange={e => setEditPlanName(e.target.value)}
                  style={{ padding: '4px 8px', fontSize: '13px', width: '140px', background: 'var(--bg-dark)', border: '1px solid var(--border-glass)', borderRadius: '4px' }}
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRenamePlan();
                    if (e.key === 'Escape') setIsRenamingPlan(false);
                  }}
                />
                <button className="mini-icon-btn" onClick={handleRenamePlan} data-tooltip="Save Name" style={{ color: 'var(--color-success)', padding: '4px' }}>
                  <Check size={14} />
                </button>
                <button className="mini-icon-btn" onClick={() => setIsRenamingPlan(false)} data-tooltip="Cancel" style={{ color: 'var(--text-muted)', padding: '4px' }}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="plan-picker-wrapper">
                <Layers size={16} style={{ color: 'var(--text-muted)' }} />
                <select 
                  className="plan-picker" 
                  value={activePlanId} 
                  onChange={(e) => {
                    const nextPlanId = e.target.value;
                    if (daysTabsNavRef.current) {
                      lastScrollLeft.current = daysTabsNavRef.current.scrollLeft;
                    }
                    setActivePlanId(nextPlanId);
                    // Reset day string to first day of new plan if bounds differ
                    const newPlanDays = Object.keys(trip.plans.find(p => p.id === nextPlanId)?.days || {}).sort();
                    if (newPlanDays.length > 0) {
                      if (newPlanDays.includes(activeDayStr)) {
                        // Keep current activeDayStr
                      } else {
                        setActiveDayStr(newPlanDays[0]);
                      }
                    }
                  }}
                >
                  {trip.plans.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {trip.canEdit !== false && (
                  <div className="plan-dropdown-container" style={{ position: 'relative', display: 'inline-block' }}>
                    <button 
                      className="mini-icon-btn"
                      onClick={() => setShowPlanMenu(!showPlanMenu)}
                      data-tooltip="Plan Options"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <MoreVertical size={16} />
                    </button>
                    {showPlanMenu && (
                      <div className="dropdown-menu">
                        <button 
                          className="dropdown-item"
                          onClick={() => {
                            setShowNewPlanModal(true);
                            setShowPlanMenu(false);
                          }}
                        >
                          <Plus size={14} /> Add Plan
                        </button>
                        <button 
                          className="dropdown-item"
                          disabled={trip.plans.findIndex(p => p.id === activePlanId) === 0}
                          onClick={() => {
                            handleMovePlan('up');
                            setShowPlanMenu(false);
                          }}
                        >
                          <ChevronUp size={14} /> Move Plan Up
                        </button>
                        <button 
                          className="dropdown-item"
                          disabled={trip.plans.findIndex(p => p.id === activePlanId) === trip.plans.length - 1}
                          onClick={() => {
                            handleMovePlan('down');
                            setShowPlanMenu(false);
                          }}
                        >
                          <ChevronDown size={14} /> Move Plan Down
                        </button>
                        <button 
                          className="dropdown-item"
                          onClick={() => {
                            setIsRenamingPlan(true);
                            setEditPlanName(activePlan.name);
                            setShowPlanMenu(false);
                          }}
                        >
                          <Edit2 size={14} /> Rename Plan
                        </button>
                        {trip.plans.length > 1 && (
                          <button 
                            className="dropdown-item danger"
                            onClick={() => {
                              handleDeletePlan(activePlan.id);
                              setShowPlanMenu(false);
                            }}
                          >
                            <Trash2 size={14} /> Delete Plan
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Days selector tabs */}
        <div ref={daysTabsNavRef} key={activePlanId} className="days-tabs-nav">
          {daysList.map((dateStr, index) => {
            const isActive = activeDayStr === dateStr;
            const dayLoc = trip.locations.find(l => l.id === activePlan.days[dateStr]?.locationId);
            const locColor = dayLoc?.color || 'var(--accent-primary)';
            return (
              <button 
                key={dateStr} 
                className={`day-tab ${isActive ? 'active' : ''}`}
                onClick={() => {
                  setActiveDayStr(dateStr);
                  setActivePlaceId(undefined);
                }}
                style={{
                  borderTopColor: isActive ? (dayLoc ? locColor : 'var(--accent-primary)') : 'transparent',
                  borderTopWidth: '3px',
                  borderRightColor: isActive && dayLoc ? locColor : 'rgba(255, 255, 255, 0.08)',
                  borderBottomColor: isActive && dayLoc ? locColor : 'rgba(255, 255, 255, 0.08)',
                  borderLeftColor: isActive && dayLoc ? locColor : 'rgba(255, 255, 255, 0.08)',
                  boxShadow: isActive ? (dayLoc ? `0 0 10px ${hexToRgba(locColor, 0.2)}` : '0 0 10px rgba(99, 102, 241, 0.1)') : 'none',
                  background: isActive ? (dayLoc ? hexToRgba(locColor, 0.08) : 'var(--accent-primary-glow)') : 'rgba(255, 255, 255, 0.03)',
                }}
              >
                <span className="day-tab-num">
                  {formatDisplayDate(dateStr).split(',')[0]} • {formatDisplayDate(dateStr).split(',')[1]?.trim()}
                </span>
                <span className="day-tab-date">Day {index + 1}</span>
                {dayLoc && (
                  <span 
                    style={{ 
                      fontSize: '11px', 
                      fontWeight: 600, 
                      color: locColor, 
                      marginTop: '2px', 
                      textOverflow: 'ellipsis', 
                      overflow: 'hidden', 
                      maxWidth: '90px', 
                      whiteSpace: 'nowrap' 
                    }}
                    title={getFormattedLocationName(dayLoc, trip.locations)}
                  >
                    {getLocIcon(dayLoc)} {getFormattedLocationName(dayLoc, trip.locations)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Details Panel */}
      {activeDay ? (
        <div className="active-day-details">
          {/* 1. Location Selector for the Day */}
          <div 
            className="day-location-picker glass-panel" 
            style={{ 
              background: activeDayLocation?.heroPhoto 
                ? `linear-gradient(rgba(15,23,42,0.4), ${hexToRgba(activeDayLocation.color || '#6366f1', 0.85)}), url(${getOptimizedImageUrl(activeDayLocation.heroPhoto, 1200)}) center/cover` 
                : `linear-gradient(135deg, rgba(30,41,59,0.4), ${hexToRgba(activeDayLocation?.color || '#6366f1', 0.15)})` 
            }}
          >
            <div className="day-location-info" style={{ minWidth: 0, flex: 1 }}>
              {activeDayLocation ? (
                <span style={{ fontSize: '24px', marginRight: '8px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  {getLocIcon(activeDayLocation)}
                </span>
              ) : (
                <MapPin size={24} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <h3 className="day-location-name-text" style={{ fontSize: '18px', color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activeDayLocation ? getFormattedLocationName(activeDayLocation, trip.locations) : 'Not Selected'}
                </h3>
              </div>
            </div>

            {trip.canEdit !== false && (
              <LocationSelect
                value={activeDay?.locationId || ''}
                onChange={(val) => {
                  if (val === 'ADD_NEW_LOCATION') {
                    setAddLocationForDay(true);
                    setShowAddLocationModal(true);
                  } else {
                    handleSetDayLocation(val);
                  }
                }}
                locations={trip.locations}
                placeholder="Select Location..."
                showAddNew={true}
                roundTrigger={true}
                showClearOption={true}
                style={{ zIndex: 50 }}
              />
            )}
          </div>

          {/* 2. Hotel reservations overlapping this day */}
          <div className="timeline-section">
            <div className="timeline-section-header">
              <div className="timeline-section-title-row">
                <h4 className="timeline-section-title"><Building size={16} /> Hotel Stays</h4>
              </div>
              <div className="timeline-section-actions">
                {trip.canEdit !== false && (
                  <button className="mini-icon-btn flex-align" onClick={() => setShowHotelModal(true)} style={{ gap: '4px', color: 'var(--color-success)' }}>
                    <Plus size={14} /> Add Hotel
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {getHotelsForDay(activeDayStr).map(h => (
                <div key={h.id} className="hotel-card">
                  <div className="flex-align" style={{ flex: 1 }}>
                    <div className="hotel-icon-wrapper">
                      <Building size={16} />
                    </div>
                    <div style={{ marginLeft: '10px' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: 600 }}>{h.name}</h4>
                      {h.address && <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>📍 {h.address}</p>}
                      <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Check-in: {formatDisplayDate(h.checkInDate)} | Check-out: {formatDisplayDate(h.checkOutDate)}
                      </p>
                    </div>
                  </div>
                  {trip.canEdit !== false && (
                    <button className="trip-delete-btn" onClick={() => handleDeleteHotel(h.id)}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}

              {getHotelsForDay(activeDayStr).length === 0 && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No hotels booked for this day.</p>
              )}
            </div>
          </div>

          {/* 3. Transportation Schedule */}
          <div className="timeline-section">
            <div className="timeline-section-header">
              <div className="timeline-section-title-row">
                <h4 className="timeline-section-title"><Plane size={16} /> Transit Schedule</h4>
              </div>
              <div className="timeline-section-actions">
                {trip.canEdit !== false && (
                  <button className="mini-icon-btn flex-align" onClick={() => setShowTransportModal(true)} style={{ gap: '4px', color: 'var(--color-warning)' }}>
                    <Plus size={14} /> Add Transit
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {getTransportsForDay(activeDayStr).map(t => {
                const isDeparture = t.departureDate === activeDayStr;
                const isArrival = t.arrivalDate === activeDayStr;
                
                return (
                  <div key={t.id} className="transport-card">
                    <div className="flex-align" style={{ flex: 1, minWidth: 0 }}>
                      <div className="transport-icon-wrapper">
                        {t.type === 'flight' && <Plane size={16} />}
                        {t.type === 'train' && <Train size={16} />}
                        {t.type === 'bus' && <Bus size={16} />}
                        {t.type === 'car' && <Car size={16} />}
                        {t.type === 'ferry' && <Anchor size={16} />}
                        {t.type === 'other' && <Navigation size={16} />}
                      </div>

                      <div className="transport-details-grid">
                        <div className="transport-flow" style={{ opacity: isDeparture ? 1 : 0.5 }}>
                          <span className="transport-flow-sub">Departure {isDeparture && '🚩'}</span>
                          <span className="transport-flow-main">{t.departureLocationName}</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            {t.departureTime} ({t.departureTimezone}) - {formatDisplayDate(t.departureDate)}
                          </span>
                        </div>

                        <div className="transport-flow" style={{ opacity: isArrival ? 1 : 0.5 }}>
                          <span className="transport-flow-sub">Arrival {isArrival && '🏁'}</span>
                          <span className="transport-flow-main">{t.arrivalLocationName}</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            {t.arrivalTime} ({t.arrivalTimezone}) - {formatDisplayDate(t.arrivalDate)}
                          </span>
                        </div>
                      </div>
                    </div>
                    {trip.canEdit !== false && (
                      <button className="trip-delete-btn" onClick={() => handleDeleteTransportation(t.id)}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}

              {getTransportsForDay(activeDayStr).length === 0 && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No transit events scheduled.</p>
              )}
            </div>
          </div>

          {/* AI Day Assistant (Daily Tips & Baby Logistics) */}
          <div className="timeline-section">
            <div className="timeline-section-header ai-day-assistant-header">
              <div className="timeline-section-title-row">
                <h4 className="timeline-section-title">
                  <Sparkles size={16} style={{ color: 'var(--accent-primary)' }} />
                  AI Day Assistant
                </h4>
              </div>
              
              <div className="timeline-section-actions">
                {(() => {
                  const isDailyTipsEnabled = !trip.disabledDayFields?.includes('daily_tips');
                  const isBabyLogisticsEnabled = !trip.disabledDayFields?.includes('baby_logistics');
                  const isAnyDayFieldEnabled = isDailyTipsEnabled || isBabyLogisticsEnabled;
                  return (
                    <>
                      {trip.canEdit !== false && (
                        <button 
                          className="mini-icon-btn flex-align"
                          style={{ gap: '4px', color: '#a5b4fc' }}
                          onClick={() => {
                            if (isAnyDayFieldEnabled) {
                              handleGenerateSingleDayTips(activeDayStr);
                            }
                          }}
                          disabled={daysGeneratingDates.has(activeDayStr) || !isAnyDayFieldEnabled}
                          data-tooltip={!isAnyDayFieldEnabled ? 'Enable Daily Tips or Baby Logistics in Settings first' : (activeDay?.aiDetails?.daily_tips ? 'Regenerate Tips' : 'Generate Tips')}
                        >
                          {daysGeneratingDates.has(activeDayStr) ? <RefreshCw size={14} className="spin" /> : <RefreshCw size={14} />}
                          {activeDay?.aiDetails?.daily_tips ? 'Regenerate Tips' : 'Generate Tips'}
                        </button>
                      )}
                      {trip.canEdit !== false && (
                        <button 
                          className="mini-icon-btn flex-align"
                          style={{ gap: '4px' }}
                          onClick={() => {
                            if (isAnyDayFieldEnabled) {
                              setShowAiGenerateDaysModal(true);
                            }
                          }}
                          disabled={!isAnyDayFieldEnabled}
                          data-tooltip={!isAnyDayFieldEnabled ? 'Enable Daily Tips or Baby Logistics in Settings first' : 'Batch Generate Tips'}
                        >
                          <Sparkles size={14} /> Batch Generate Tips
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="glass-panel ai-day-assistant-card" style={{ padding: '12px 14px', margin: '0', borderColor: 'rgba(99, 102, 241, 0.15)', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.45) 0%, rgba(99, 102, 241, 0.03) 100%)' }}>
              {(() => {
                const isDailyTipsEnabled = !trip.disabledDayFields?.includes('daily_tips');
                const isBabyLogisticsEnabled = !trip.disabledDayFields?.includes('baby_logistics');
                const isAnyDayFieldEnabled = isDailyTipsEnabled || isBabyLogisticsEnabled;

                return daysGeneratingDates.has(activeDayStr) ? (
                  <FunGeneratingLoader message="Gemini is designing daily tips & route logistics..." />
                ) : (isDailyTipsEnabled && activeDay?.aiDetails?.daily_tips) || (isBabyLogisticsEnabled && activeDay?.aiDetails?.baby_logistics) ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    
                    {/* Daily Tips */}
                    {isDailyTipsEnabled && activeDay?.aiDetails?.daily_tips && (
                      <AiMarkdownSection 
                        content={activeDay.aiDetails.daily_tips} 
                        updatedAt={activeDay.aiUpdatedAt}
                        onSave={(newVal) => handleSaveDayTips(activeDayStr, newVal)}
                        canEdit={trip.canEdit !== false}
                      />
                    )}

                    {/* Baby Logistics (if enabled and generated) */}
                    {isBabyLogisticsEnabled && activeDay?.aiDetails?.baby_logistics && (
                      <div 
                        style={{ 
                          borderTop: isDailyTipsEnabled && activeDay?.aiDetails?.daily_tips ? '1px solid rgba(255, 255, 255, 0.05)' : 'none', 
                          paddingTop: isDailyTipsEnabled && activeDay?.aiDetails?.daily_tips ? '8px' : '0', 
                          marginTop: isDailyTipsEnabled && activeDay?.aiDetails?.daily_tips ? '4px' : '0' 
                        }}
                      >
                        <AiMarkdownSection 
                          content={activeDay.aiDetails.baby_logistics} 
                          onSave={(newVal) => handleSaveBabyLogistics(activeDayStr, newVal)}
                          canEdit={trip.canEdit !== false}
                          title={
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: '#fbcfe8' }}>
                              👶 Baby Logistics
                            </span>
                          }
                        />
                      </div>
                    )}

                  </div>
                ) : (
                  <div style={{ padding: '8px 0', textAlign: 'center' }}>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontStyle: 'italic', display: 'block', marginBottom: '6px' }}>
                      {!isAnyDayFieldEnabled 
                        ? 'All day-level AI fields are disabled in Settings.' 
                        : 'No daily tips generated for this day yet.'}
                    </span>
                    {trip.canEdit !== false && isAnyDayFieldEnabled && (
                      <button 
                        className="btn-secondary flex-align"
                        style={{ margin: '0 auto', fontSize: '11px', padding: '4px 10px', gap: '4px', borderColor: 'rgba(99, 102, 241, 0.15)' }}
                        onClick={() => handleGenerateSingleDayTips(activeDayStr)}
                      >
                        <Sparkles size={11} /> Generate Day Tips
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* 4. Timeline Schedule Places */}
          <div className="timeline-section">
            <div className="timeline-section-header day-schedule-header">
              <div className="timeline-section-title-row">
                <h4 className="timeline-section-title"><Navigation size={16} /> Day Schedule</h4>
              </div>
              {trip.canEdit !== false && (
                <div className="timeline-section-actions">
                  <button 
                    className="mini-icon-btn flex-align" 
                    onClick={() => {
                      setAiGeneratePlaces(scheduledPlaces);
                      setAiGenerateCity(activeDayLocation?.city || '');
                      setAiGenerateCountry(activeDayLocation?.country || '');
                      setShowAiGenerateModal(true);
                    }} 
                    data-tooltip="AI Insights for Day Itinerary"
                    style={{ gap: '4px', color: '#a5b4fc' }}
                    disabled={scheduledPlaces.length === 0}
                  >
                    <Sparkles size={14} /> AI Insights
                  </button>

                  <button 
                    className="mini-icon-btn flex-align" 
                    onClick={() => {
                      setEditingPlace({
                        id: `new-temp-${Date.now()}`,
                        title: '',
                        description: '',
                        openingHours: '',
                        lat: activeDayLocation?.lat || catalogLocation?.lat || 0,
                        lng: activeDayLocation?.lng || catalogLocation?.lng || 0,
                        placeGroupId: 'new',
                        notes: '',
                        photoUrl: '',
                        mapsLink: ''
                      });
                      setAutoScheduleOnActiveDay(true);
                      setShowCustomPlaceModal(true);
                    }} 
                    data-tooltip="Add New Place"
                    style={{ gap: '4px' }}
                  >
                    <Plus size={14} /> Add Place
                  </button>

                  <div className="day-options-dropdown-container" style={{ position: 'relative', display: 'inline-block' }}>
                    <button 
                      className="mini-icon-btn"
                      onClick={() => setShowDayOptionsMenu(!showDayOptionsMenu)}
                      data-tooltip="Day Options"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <MoreVertical size={14} />
                    </button>
                    {showDayOptionsMenu && (
                      <div className="dropdown-menu">
                        <button 
                          className="dropdown-item"
                          onClick={() => {
                            setShowMoveDayModal(true);
                            setShowDayOptionsMenu(false);
                          }}
                        >
                          <ArrowRight size={12} /> Move Day
                        </button>
                        <button 
                          className="dropdown-item danger"
                          onClick={() => {
                            handleClearDay();
                            setShowDayOptionsMenu(false);
                          }}
                        >
                          <Trash2 size={12} /> Clear Day
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Smart Place search suggestions input */}
            {activeDayLocation && trip.canEdit !== false ? (
              <div ref={searchDropdownRef} style={{ position: 'relative', marginBottom: '16px' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    placeholder="Type to search, or paste a Google Maps link..." 
                    value={placeQuery}
                    onChange={(e) => setPlaceQuery(e.target.value)}
                    style={{ paddingLeft: '32px' }}
                  />
                  {isSearchingPlace && (
                    <div style={{ position: 'absolute', right: '10px', top: '12px', fontSize: '10px', color: 'var(--text-muted)' }}>Loading...</div>
                  )}
                </div>

                {placeSuggestions.length > 0 && (
                  <div className="catalog-search-results">
                    {placeSuggestions.map(place => (
                      <div 
                        key={place.id} 
                        className="search-result-item"
                        onClick={() => handleAddPlaceFromDayTimeline(place)}
                      >
                        {place.photoUrl && (
                          <img 
                            src={getOptimizedImageUrl(place.photoUrl, 80)} 
                            className="search-result-thumb" 
                            alt="" 
                            loading="lazy" 
                            decoding="async" 
                          />
                        )}
                        <div className="search-result-info">
                          <div className="search-result-title">{place.title}</div>
                          <div className="search-result-desc">{place.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '16px' }}>
                Please select a Location above to enable place searching.
              </div>
            )}

            <div 
              className="day-timeline"
              style={{ minHeight: '60px' }}
              onDragOver={(e) => {
                if (draggedPlaceId || draggedDayPlaceIndex !== null) {
                  e.preventDefault();
                }
              }}
              onDragLeave={() => setDragOverDayPlaceIndex(null)}
              onDrop={() => {
                if (draggedPlaceId) {
                  handleCatalogPlaceDropOnTimeline(draggedPlaceId, scheduledPlaces.length, 'top');
                } else if (draggedDayPlaceIndex !== null) {
                  handleDayPlaceDrop(scheduledPlaces.length - 1, 'bottom');
                }
              }}
            >
              {displayScheduledPlaces.map((place, index) => {
                const isTemporary = (place as any).isTemporary;
                const isTempActive = (displayScheduledPlaces[0] as any)?.isTemporary;
                const actualIndex = isTempActive ? index - 1 : index;
                const dropTargetIndex = actualIndex < 0 ? 0 : actualIndex;

                return (
                  <div 
                    key={`${place.id}-${index}`} 
                    style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}
                  >
                    {dragOverDayPlaceIndex === index && (
                      <div style={{
                        position: 'absolute',
                        top: dragOverDayPlacePosition === 'top' ? '-10px' : 'auto',
                        bottom: dragOverDayPlacePosition === 'bottom' ? '-10px' : 'auto',
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
                      className={`timeline-card glass-panel ${isTemporary ? 'timeline-card-preview' : ''} ${activeTimelinePlaceDropdownKey === `${place.id}-${index}-mobile` ? 'dropdown-active' : ''}`}
                      data-place-id={place.id}
                      draggable={trip.canEdit !== false && !isTemporary}
                      onDragStart={() => handleDayPlaceDragStart(actualIndex)}
                      onDragEnd={() => {
                        setDraggedDayPlaceIndex(null);
                        setDragOverDayPlaceIndex(null);
                      }}
                      onDragOver={(e) => {
                        if (draggedDayPlaceIndex === index) return;
                        if (draggedDayPlaceIndex === null && !draggedPlaceId) return;
                        if (isTemporary && draggedDayPlaceIndex !== null) return;
                        e.preventDefault();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const relativeY = e.clientY - rect.top;
                        const position = relativeY < rect.height / 2 ? 'top' : 'bottom';
                        
                        if (dragOverDayPlaceIndex !== index || dragOverDayPlacePosition !== position) {
                          setDragOverDayPlaceIndex(index);
                          setDragOverDayPlacePosition(position);
                        }
                      }}
                      onDrop={(e) => {
                        e.stopPropagation();
                        if (draggedDayPlaceIndex !== null) {
                          handleDayPlaceDrop(dropTargetIndex, dragOverDayPlacePosition);
                        } else if (draggedPlaceId) {
                          handleCatalogPlaceDropOnTimeline(draggedPlaceId, dropTargetIndex, dragOverDayPlacePosition);
                        }
                        setDragOverDayPlaceIndex(null);
                      }}
                      onClick={() => setActivePlaceId(activePlaceId === place.id ? undefined : place.id)}
                      style={{
                        flexDirection: 'column',
                        alignItems: 'stretch',
                        borderColor: activePlaceId === place.id ? 'var(--accent-primary)' : 'var(--border-glass)',
                        cursor: 'pointer',
                        gap: '0'
                      }}
                    >
                      <div 
                        className="timeline-dot" 
                        style={{ 
                          backgroundColor: (trip.placeGroups || DEFAULT_PLACE_GROUPS).find(g => g.id === place.placeGroupId)?.color || '#6b7280' 
                        }}
                      >
                        {(() => {
                          const group = (trip.placeGroups || DEFAULT_PLACE_GROUPS).find(g => g.id === place.placeGroupId);
                          return getCategoryIconComponent(group?.icon || 'map-pin', 12, undefined, { color: '#ffffff' });
                        })()}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '16px' }}>
                        <div className="timeline-card-content" style={{ display: 'flex', gap: '12px', flex: 1, minWidth: 0, cursor: isTemporary ? 'default' : 'grab' }}>
                          <div 
                            style={{ 
                              width: '24px', 
                              height: '24px', 
                              borderRadius: '50%', 
                              background: isTemporary ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.08)',
                              color: isTemporary ? '#a5b4fc' : 'var(--text-primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              fontWeight: 700,
                              flexShrink: 0
                            }}
                          >
                            {isTemporary ? 'P' : actualIndex + 1}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0, alignItems: 'center' }}>
                            {place.photoUrl ? (
                              <div className="place-card-thumb-container">
                                <img 
                                  src={getOptimizedImageUrl(place.photoUrl, 80)} 
                                  alt="" 
                                  loading="lazy"
                                  decoding="async"
                                />
                              </div>
                            ) : (
                              <div className="place-card-thumb-container">
                                <MapPin size={16} style={{ color: 'var(--text-muted)' }} />
                              </div>
                            )}
                            <a 
                              href={place.mapsLink || buildMapsLink(place.title, place.lat, place.lng, activeDayLocation?.city || catalogLocation?.city)} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="btn-secondary"
                              onClick={(e) => e.stopPropagation()}
                              style={{ 
                                padding: '2px 4px', 
                                fontSize: '9px', 
                                textDecoration: 'none', 
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '36px',
                                boxSizing: 'border-box',
                                textAlign: 'center',
                                height: '18px'
                              }}
                            >
                              Map
                            </a>
                          </div>

                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>
                                {place.title}
                              </h4>
                              {isTemporary && (
                                <span className="preview-badge">Preview</span>
                              )}
                            </div>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                              {place.description ? place.description.substring(0, 50) + '...' : 'Attraction'}
                            </p>
                            {editingPlaceNotesId === place.id ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }} onClick={e => e.stopPropagation()}>
                                <textarea 
                                  value={tempNotes}
                                  onChange={(e) => setTempNotes(e.target.value)}
                                  placeholder="Add notes..."
                                  rows={2}
                                  style={{ 
                                    padding: '6px', 
                                    fontSize: '13px', 
                                    width: '100%', 
                                    background: 'var(--bg-dark)', 
                                    border: '1px solid var(--border-glass)', 
                                    color: 'var(--text-primary)',
                                    borderRadius: '4px',
                                    resize: 'vertical',
                                    textTransform: 'none'
                                  }}
                                />
                                <div style={{ display: 'flex', gap: '6px', alignSelf: 'flex-end' }}>
                                  <button 
                                    className="btn-secondary" 
                                    onClick={() => setEditingPlaceNotesId(null)} 
                                    style={{ padding: '2px 6px', fontSize: '10px' }}
                                  >
                                    Cancel
                                  </button>
                                  <button 
                                    className="btn-primary flex-align" 
                                    onClick={() => savePlaceNotes(place.id)} 
                                    style={{ padding: '2px 6px', fontSize: '10px', gap: '4px' }}
                                  >
                                    <Check size={10} /> Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                <div style={{ 
                                  fontSize: '12.5px', 
                                  color: place.notes ? 'var(--accent-primary)' : 'var(--text-muted)', 
                                  fontStyle: 'italic', 
                                  whiteSpace: 'pre-wrap',
                                  lineHeight: 1.4,
                                  margin: 0,
                                  flex: 1,
                                  textTransform: 'none',
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: '6px'
                                }}>
                                  <FileText size={13} style={{ marginTop: '2px', color: place.notes ? 'var(--accent-primary)' : 'var(--text-muted)', flexShrink: 0 }} />
                                  <span>{place.notes || 'Add notes...'}</span>
                                </div>
                                {trip.canEdit !== false && !isTemporary && (
                                  <button 
                                    className="mini-icon-btn" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startEditingNotes(place);
                                    }} 
                                    style={{ padding: '2px' }}
                                    data-tooltip="Edit Note"
                                  >
                                    <Edit2 size={10} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {trip.canEdit !== false && (
                          <div className="day-place-actions-desktop" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                            {isTemporary ? (
                              <>
                                <button 
                                  className="mini-icon-btn" 
                                  onClick={() => handleAddPlaceToDay(place)}
                                  data-tooltip="Keep / Add to Day"
                                  style={{ padding: '4px', color: 'var(--color-success)' }}
                                >
                                  <Plus size={16} />
                                </button>
                                <button 
                                  className="mini-icon-btn" 
                                  onClick={() => setActivePlaceId(undefined)}
                                  data-tooltip="Remove Preview"
                                  style={{ padding: '4px', color: 'var(--color-danger)' }}
                                >
                                  <X size={16} />
                                </button>
                              </>
                            ) : (
                              <>
                                <div className="place-card-move-buttons">
                                  <button 
                                    className="mini-icon-btn" 
                                    disabled={actualIndex === 0} 
                                    onClick={() => handleMovePlaceOrder(actualIndex, 'up')}
                                    style={{ opacity: actualIndex === 0 ? 0.3 : 1 }}
                                    data-tooltip="Move Up"
                                  >
                                    <ChevronUp size={12} />
                                  </button>
                                  <button 
                                    className="mini-icon-btn" 
                                    disabled={actualIndex === scheduledPlaces.length - 1} 
                                    onClick={() => handleMovePlaceOrder(actualIndex, 'down')}
                                    style={{ opacity: actualIndex === scheduledPlaces.length - 1 ? 0.3 : 1 }}
                                    data-tooltip="Move Down"
                                  >
                                    <ChevronDown size={12} />
                                  </button>
                                </div>
                                <div className="timeline-place-dropdown-container" style={{ position: 'relative' }}>
                                  <button 
                                    className="mini-icon-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const key = `${place.id}-${index}`;
                                      setActiveTimelinePlaceDropdownKey(activeTimelinePlaceDropdownKey === key ? null : key);
                                    }}
                                    data-tooltip="Place Options"
                                    style={{ padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                  >
                                    <MoreVertical size={14} />
                                  </button>
                                  {activeTimelinePlaceDropdownKey === `${place.id}-${index}` && (
                                    <div className="dropdown-menu" style={{ right: 0, bottom: '100%', top: 'auto', marginBottom: '4px' }}>
                                      <button 
                                        className="dropdown-item" 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenEditPlace(place);
                                          setActiveTimelinePlaceDropdownKey(null);
                                        }}
                                        data-tooltip="Edit Place"
                                      >
                                        <Edit2 size={12} /> Edit Place
                                      </button>
                                      <button 
                                        className="dropdown-item danger" 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRemovePlaceFromDay(actualIndex);
                                          setActiveTimelinePlaceDropdownKey(null);
                                        }}
                                        data-tooltip="Remove from Day"
                                      >
                                        <Trash2 size={12} /> Remove from Day
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Mobile dropdown for scheduled places (visible on mobile only, positioned absolutely top-right) */}
                      {trip.canEdit !== false && !isTemporary && (
                        <div 
                          className={`day-place-dropdown-container-mobile ${activeTimelinePlaceDropdownKey === `${place.id}-${index}-mobile` ? 'dropdown-active' : ''}`}
                          style={{ position: 'absolute', top: '0', right: '0' }}
                          onClick={e => e.stopPropagation()}
                        >
                          <button 
                            className="mini-icon-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              const key = `${place.id}-${index}-mobile`;
                              setActiveTimelinePlaceDropdownKey(activeTimelinePlaceDropdownKey === key ? null : key);
                            }}
                            data-tooltip="Place Options"
                            style={{ padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                          >
                            <MoreVertical size={14} />
                          </button>
                          {activeTimelinePlaceDropdownKey === `${place.id}-${index}-mobile` && (
                            <div className="dropdown-menu" style={{ right: 0, top: '100%', marginTop: '4px' }}>
                              <button 
                                className="dropdown-item" 
                                disabled={actualIndex === 0} 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMovePlaceOrder(actualIndex, 'up');
                                  setActiveTimelinePlaceDropdownKey(null);
                                }}
                                style={{ opacity: actualIndex === 0 ? 0.3 : 1 }}
                              >
                                <ChevronUp size={12} /> Move Up
                              </button>
                              <button 
                                className="dropdown-item" 
                                disabled={actualIndex === scheduledPlaces.length - 1} 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMovePlaceOrder(actualIndex, 'down');
                                  setActiveTimelinePlaceDropdownKey(null);
                                }}
                                style={{ opacity: actualIndex === scheduledPlaces.length - 1 ? 0.3 : 1 }}
                              >
                                <ChevronDown size={12} /> Move Down
                              </button>
                              <button 
                                className="dropdown-item" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditPlace(place);
                                  setActiveTimelinePlaceDropdownKey(null);
                                }}
                              >
                                <Edit2 size={12} /> Edit Place
                              </button>
                              <button 
                                className="dropdown-item danger" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemovePlaceFromDay(actualIndex);
                                  setActiveTimelinePlaceDropdownKey(null);
                                }}
                              >
                                <Trash2 size={12} /> Remove from Day
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Mobile action bar for temporary previews (visible on mobile only) */}
                      {trip.canEdit !== false && isTemporary && (
                        <div 
                          className="day-place-actions-mobile"
                          onClick={e => e.stopPropagation()}
                        >
                          <button 
                            className="mini-icon-btn" 
                            onClick={() => handleAddPlaceToDay(place)}
                            data-tooltip="Keep / Add to Day"
                            style={{ padding: '4px', color: 'var(--color-success)' }}
                          >
                            <Plus size={16} />
                          </button>
                          <button 
                            className="mini-icon-btn" 
                            onClick={() => setActivePlaceId(undefined)}
                            data-tooltip="Remove Preview"
                            style={{ padding: '4px', color: 'var(--color-danger)' }}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      )}

                      {/* Expand Details if selected */}
                      {activePlaceId === place.id && (
                        <div 
                          style={{ 
                            marginTop: '12px', 
                            paddingTop: '12px', 
                            borderTop: '1px solid rgba(255,255,255,0.05)', 
                            fontSize: '13px',
                            cursor: 'default',
                            width: '100%'
                          }}
                          onClick={e => e.stopPropagation()}
                        >
                          {place.description && (
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: 1.3, textTransform: 'none' }}>
                              {place.description}
                            </p>
                          )}
                          
                          <AiDetailsView
                            place={place}
                            onGenerate={() => handleGenerateSinglePlaceAiDetails(place.id)}
                            canEdit={trip.canEdit !== false}
                            isGenerating={placeGeneratingIds.has(place.id)}
                            layoutMode="adaptive-2-col"
                            customAiFields={trip.customAiFields}
                            disabledPlaceFields={trip.disabledPlaceFields}
                            fieldIcons={trip.fieldIcons}
                            placeFieldsOrder={trip.placeFieldsOrder}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {displayScheduledPlaces.length === 0 && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', paddingLeft: '6px' }}>
                  Itinerary is empty. Search above or click catalog places to schedule.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '40px', textTransform: 'none', color: 'var(--text-muted)', textAlign: 'center' }}>
          No day plan created yet.
        </div>
      )}
    </div>
  );
}
