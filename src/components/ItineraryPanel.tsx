import React, { useState, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import {
  MapPin, Plus, Trash2, Edit2, Share2, Sparkles, MoreVertical,
  Calendar, Layers, Check, Timer, X, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Plane, Train, Bus, Car, Anchor, Navigation, Building, Hash,
  Search, FileText, RefreshCw, ArrowRight, BookmarkPlus,
  ArrowUpRight, ArrowDownLeft, AlertTriangle, Copy, ArrowUpDown, Landmark, Utensils, Clock
} from 'lucide-react';
import type { Trip, Plan, Location, Place, Hotel, FlatTransportationSegment, TransportationReservation, ScheduleItem, ScheduleNoteItem, SchedulePlaceItem, ScheduleHotelEventItem, ScheduleTransitEventItem, SchedulePlaceReservationEventItem, PlaceReservation } from '../types';
import { flattenReservations } from '../types';
import { InlineNotes } from './InlineNotes';
import { computeMergePartners } from '../utils/scheduleMerge';
import { DEFAULT_PLACE_GROUPS, getFormattedLocationName, getLocIcon, buildMapsLink, buildHotelMapsLink, buildTransitMapsLink } from '../utils/api';
import { isPlaceReservationUnlinkedOrDeleted } from '../utils/reservationWarnings';
import { getOptimizedImageUrl } from '../utils/image';
import { sortHotels, sortTransports } from '../utils/dateUtils';
import FunGeneratingLoader from './FunGeneratingLoader';
import AiMarkdownSection from './AiMarkdownSection';
import AiDetailsView from './AiDetailsView';
import LocationSelect from './LocationSelect';

const renderStatusIcon = (status?: string) => {
  const s = status || 'Planning';
  if (s === 'Confirmed') return <Check size={10} />;
  if (s === 'Canceled') return <X size={10} />;
  return <Timer size={10} />;
};

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
  setActiveDayStr: (dayStr: string) => void;
  daysList: string[];
  formatDisplayDate: (dateStr: string) => string;
  activeDay: any;
  activeDayLocation: Location | undefined;
  catalogLocation?: Location;
  getHotelsForDay: (dateStr: string) => Hotel[];
  getTransportsForDay: (dateStr: string) => FlatTransportationSegment[];
  onOpenAddPlaceReservation?: (type: 'attraction' | 'dining') => void;
  onOpenEditPlaceReservation?: (reservation: PlaceReservation) => void;
  onDeletePlaceReservation?: (id: string) => void;
  expandedAttractionReservationId?: string | null;
  setExpandedAttractionReservationId?: (id: string | null) => void;
  expandedDiningReservationId?: string | null;
  setExpandedDiningReservationId?: (id: string | null) => void;
  scheduledPlaces: Place[];
  displayScheduledPlaces: Place[];
  activePlaceId: string | undefined;
  setActivePlaceId: (id: string | undefined) => void;
  placeGeneratingIds: Set<string>;
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
  setShowSwapDaysModal: (show: boolean) => void;
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
  handleDeleteTransportation: (reservationId: string, segmentIndex: number) => void;
  handleOpenEditHotel: (hotel: Hotel) => void;
  handleOpenEditTransport: (reservation: TransportationReservation, segmentIndex: number) => void;
  handleSaveHotelNotes: (hotelId: string, notes: string) => void;
  handleSaveTransportNotes: (transportId: string, notes: string) => void;
  handleSavePlaceReservationNotes: (reservationId: string, notes: string) => void;
  handleGenerateSingleDayTips: (dateStr: string) => void;
  handleSaveDayTips: (dateStr: string, content: string) => void;
  handleSaveBabyLogistics: (dateStr: string, content: string) => void;
  handleSaveSuggestedReservations: (dateStr: string, content: string) => void;
  handleClearDay: () => void;
  handleAddPlaceFromDayTimeline: (place: Omit<Place, 'placeGroupId'>) => void;
  handleOpenAddPlaceAtIndex: (insertAtIndex: number) => void;
  handleDayPlaceDragStart: (index: number) => void;
  handleDayPlaceDrop: (targetIndex: number, position: 'top' | 'bottom') => void;
  handleCatalogPlaceDropOnTimeline: (placeId: string, targetIndex: number, position: 'top' | 'bottom') => void;
  scheduleItems: ScheduleItem[];
  handleMoveScheduleItem: (index: number, direction: 'up' | 'down') => void;
  handleRemovePlaceFromDay: (scheduleIndex: number) => void;
  handleAddScheduleNote: (insertAtIndex: number, text: string) => void;
  handleUpdateScheduleNote: (itemIndex: number, text: string) => void;
  handleDeleteScheduleNote: (itemIndex: number) => void;
  activeMobileTab?: string;
  isGoogleSignedIn?: boolean;
  onShareTrip?: (trip?: any) => void;
  handleAddReservationEventToSchedule: (item: ScheduleHotelEventItem | ScheduleTransitEventItem | SchedulePlaceReservationEventItem, insertAtIndex?: number) => void;
  handleUpdateScheduleItemTime: (itemIndex: number, time: string) => void;
  handleAddPlaceToDay: (place: Place) => void;
  handleAddAiSuggestionToCatalog: (place: Place) => void;
  handleOpenEditPlace: (place: Place) => void;
  handleGenerateSinglePlaceAiDetails: (placeId: string) => void;
  savePlaceNotes: (placeId: string, notes: string) => void;
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
  expandedHotelId: string | null;
  setExpandedHotelId: (id: string | null) => void;
  expandedTransitId: string | null;
  setExpandedTransitId: (id: string | null) => void;
  onToggleNoHotel?: (dateStr: string, checked: boolean) => void;
}


function ItineraryPanel({
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
  onOpenAddPlaceReservation,
  onOpenEditPlaceReservation,
  onDeletePlaceReservation,
  expandedAttractionReservationId,
  setExpandedAttractionReservationId,
  expandedDiningReservationId,
  setExpandedDiningReservationId,
  scheduledPlaces,
  displayScheduledPlaces,
  activePlaceId,
  setActivePlaceId,
  placeGeneratingIds,
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
  setShowSwapDaysModal,
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
  handleOpenEditHotel,
  handleOpenEditTransport,
  handleSaveHotelNotes,
  handleSaveTransportNotes,
  handleSavePlaceReservationNotes,
  handleGenerateSingleDayTips,
  handleSaveDayTips,
  handleSaveBabyLogistics,
  handleSaveSuggestedReservations,
  handleClearDay,
  handleAddPlaceFromDayTimeline,
  handleOpenAddPlaceAtIndex,
  handleDayPlaceDragStart,
  handleDayPlaceDrop,
  handleCatalogPlaceDropOnTimeline,
  scheduleItems,
  handleMoveScheduleItem,
  handleRemovePlaceFromDay,
  handleAddScheduleNote,
  handleUpdateScheduleNote,
  handleDeleteScheduleNote,
  handleAddReservationEventToSchedule,
  handleUpdateScheduleItemTime,
  handleAddPlaceToDay,
  handleAddAiSuggestionToCatalog,
  handleOpenEditPlace,
  handleGenerateSinglePlaceAiDetails,
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
  setRightCollapsed,
  expandedHotelId,
  setExpandedHotelId,
  expandedTransitId,
  setExpandedTransitId,
  onToggleNoHotel,
}: ItineraryPanelProps) {

  // Tracks which schedule place card is editing its notes, so the card can
  // disable drag while notes are being edited (see draggable below). Driven by
  // InlineNotes.onEditingChange — no textarea refs needed.
  const [editingPlaceNotesId, setEditingPlaceNotesId] = useState<string | null>(null);

  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [hoveredScheduleItemIndex, setHoveredScheduleItemIndex] = useState<number | null>(null);
  const [editingNoteItemIndex, setEditingNoteItemIndex] = useState<number | null>(null);
  const [timePickerState, setTimePickerState] = useState<{ itemIdx: number; value: string; top: number; left: number } | null>(null);
  const [addSlotSubMenu, setAddSlotSubMenu] = useState<{ type: 'hotel' | 'transit' | 'place'; insertAtIndex: number } | null>(null);
  const [dayOptionsSubMenu, setDayOptionsSubMenu] = useState<'hotel' | 'transit' | null>(null);
  const [activeAddDropdownIndex, setActiveAddDropdownIndex] = useState<number | null>(null);
  const [isPlanPickerOpen, setIsPlanPickerOpen] = useState(false);
  const [openHotelMenuId, setOpenHotelMenuId] = useState<string | null>(null);
  const [openTransportMenuId, setOpenTransportMenuId] = useState<string | null>(null);
  const [openMapMenuId, setOpenMapMenuId] = useState<string | null>(null);

  const planPickerRef = useRef<HTMLDivElement>(null);
  const hideItemTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleHideItem = () => {
    hideItemTimer.current = setTimeout(() => setHoveredScheduleItemIndex(null), 150);
  };
  const cancelHideItem = () => {
    if (hideItemTimer.current) { clearTimeout(hideItemTimer.current); hideItemTimer.current = null; }
  };

  const formatCardDate = (dateStr: string, timeStr?: string): string => {
    try {
      const [, mo, d] = dateStr.split('-').map(Number);
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const base = `${months[mo - 1]} ${d}`;
      return timeStr ? `${base} · ${timeStr}` : base;
    } catch { return dateStr; }
  };

  const getUtcOffsetMinutes = (tz: string): number => {
    try {
      const now = new Date();
      const utcStr = now.toLocaleString('en-US', { timeZone: 'UTC' });
      const tzStr = now.toLocaleString('en-US', { timeZone: tz });
      return (new Date(tzStr).getTime() - new Date(utcStr).getTime()) / 60000;
    } catch { return 0; }
  };

  const formatTzOffset = (tz: string): string => {
    const mins = getUtcOffsetMinutes(tz);
    const sign = mins >= 0 ? '+' : '-';
    const absMins = Math.abs(mins);
    const h = String(Math.floor(absMins / 60)).padStart(2, '0');
    const m = String(absMins % 60).padStart(2, '0');
    return `GMT${sign}${h}:${m}`;
  };

  // Close Add Item dropdown when clicking outside
  useEffect(() => {
    if (activeAddDropdownIndex === null) return;
    const handler = () => setActiveAddDropdownIndex(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [activeAddDropdownIndex]);

  useEffect(() => {
    if (!openHotelMenuId) return;
    const handler = () => setOpenHotelMenuId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [openHotelMenuId]);

  useEffect(() => {
    if (!openTransportMenuId) return;
    const handler = () => setOpenTransportMenuId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [openTransportMenuId]);

  useEffect(() => {
    if (!openMapMenuId) return;
    const handler = () => setOpenMapMenuId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [openMapMenuId]);

  // Close plan picker dropdown when clicking outside
  useEffect(() => {
    if (!isPlanPickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (planPickerRef.current && !planPickerRef.current.contains(e.target as Node)) {
        setIsPlanPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isPlanPickerOpen]);

  const getTransitIcon = (type: string, size = 14) => {
    if (type === 'flight') return <Plane size={size} />;
    if (type === 'train') return <Train size={size} />;
    if (type === 'bus') return <Bus size={size} />;
    if (type === 'car') return <Car size={size} />;
    if (type === 'ferry') return <Anchor size={size} />;
    return <Navigation size={size} />;
  };

  const [openPlaceReservationMenuId, setOpenPlaceReservationMenuId] = useState<string | null>(null);

  const isHotelEventInSchedule = (hotelId: string, event: 'check-in' | 'check-out') =>
    scheduleItems.some(i => i.type === 'hotel-event' && (i as ScheduleHotelEventItem).hotelId === hotelId && (i as ScheduleHotelEventItem).event === event);

  const isTransitEventInSchedule = (reservationId: string, segmentIndex: number, event: 'departure' | 'arrival') =>
    scheduleItems.some(i => i.type === 'transit-event' && (i as ScheduleTransitEventItem).reservationId === reservationId && (i as ScheduleTransitEventItem).segmentIndex === segmentIndex && (i as ScheduleTransitEventItem).event === event);

  const isPlaceReservationEventInSchedule = (reservationId: string) =>
    scheduleItems.some(i => i.type === 'place-reservation-event' && (i as SchedulePlaceReservationEventItem).reservationId === reservationId);

  // A place-reservation-event and its linked place render as one merged card when adjacent.
  // `mergePartners[i]` is the paired index, or -1. Reordering/dragging treats the pair as a unit.
  const mergePartners = computeMergePartners(scheduleItems, activePlan.placeReservations);
  const sameMergeUnit = (a: number, b: number) => a === b || mergePartners[a] === b;
  // Drops onto a merged card snap to the whole unit's edge — hovering the top half of a
  // merged pair drops above the unit, the bottom half drops below it (never between the two).
  const clampMergePosition = (idx: number, pos: 'top' | 'bottom'): 'top' | 'bottom' => {
    const p = mergePartners[idx];
    if (p === -1) return pos;
    if (p === idx + 1) return 'top';
    if (p === idx - 1) return 'bottom';
    return pos;
  };

  const renderAddSlot = (insertAtIndex: number, canEdit: boolean) => {
    if (!canEdit) return null;
    const isVisible = hoveredScheduleItemIndex === insertAtIndex || hoveredScheduleItemIndex === insertAtIndex - 1;
    return (
      <div
        className={`schedule-add-slot${isVisible ? ' visible' : ''}${activeAddDropdownIndex === insertAtIndex ? ' schedule-add-slot--open' : ''}`}
        onMouseEnter={cancelHideItem}
        onMouseLeave={scheduleHideItem}
        onClick={e => e.stopPropagation()}
      >
        <button
          className="schedule-add-btn"
          onClick={e => { e.stopPropagation(); setActiveAddDropdownIndex(activeAddDropdownIndex === insertAtIndex ? null : insertAtIndex); }}
          data-tooltip="Add Item"
        >
          <Plus size={11} /><span className="add-item-label">Add Item</span>
        </button>
        {activeAddDropdownIndex === insertAtIndex && (
          <div className="schedule-add-dropdown dropdown-menu">
            {addSlotSubMenu && addSlotSubMenu.insertAtIndex === insertAtIndex ? (
              <>
                <button className="dropdown-item" style={{ opacity: 0.6, pointerEvents: 'none', fontSize: '11px' }}>
                  {addSlotSubMenu.type === 'hotel' ? <Building size={12} /> : addSlotSubMenu.type === 'transit' ? getTransitIcon('flight', 12) : <Landmark size={12} />} {addSlotSubMenu.type === 'hotel' ? 'Hotel Events' : addSlotSubMenu.type === 'transit' ? 'Transit Events' : 'Reservation Events'}
                </button>
                <button className="dropdown-item" onClick={e => { e.stopPropagation(); setAddSlotSubMenu(null); }}>
                  ← Back
                </button>
                {addSlotSubMenu.type === 'hotel' && activePlan.hotels.filter(h => h.status !== 'Canceled' && (h.checkInDate === activeDayStr || h.checkOutDate === activeDayStr)).map(h => (
                  <React.Fragment key={h.id}>
                    {h.checkInDate === activeDayStr && !isHotelEventInSchedule(h.id, 'check-in') && (
                      <button className="dropdown-item" onClick={e => {
                        e.stopPropagation();
                        handleAddReservationEventToSchedule({ type: 'hotel-event', hotelId: h.id, event: 'check-in', time: h.checkInTime }, insertAtIndex);
                        setActiveAddDropdownIndex(null); setAddSlotSubMenu(null);
                      }}>
                        <Building size={12} /> {h.name} — Check-in
                      </button>
                    )}
                    {h.checkOutDate === activeDayStr && !isHotelEventInSchedule(h.id, 'check-out') && (
                      <button className="dropdown-item" onClick={e => {
                        e.stopPropagation();
                        handleAddReservationEventToSchedule({ type: 'hotel-event', hotelId: h.id, event: 'check-out', time: h.checkOutTime }, insertAtIndex);
                        setActiveAddDropdownIndex(null); setAddSlotSubMenu(null);
                      }}>
                        <Building size={12} /> {h.name} — Check-out
                      </button>
                    )}
                  </React.Fragment>
                ))}
                {addSlotSubMenu.type === 'transit' && flattenReservations(activePlan.transports.filter(t => t.status !== 'Canceled')).filter(t => t.departureDate === activeDayStr || t.arrivalDate === activeDayStr).map(t => (
                  <React.Fragment key={`${t.reservationId}-${t.segmentIndex}`}>
                    {t.departureDate === activeDayStr && !isTransitEventInSchedule(t.reservationId, t.segmentIndex, 'departure') && (
                      <button className="dropdown-item" onClick={e => {
                        e.stopPropagation();
                        handleAddReservationEventToSchedule({ type: 'transit-event', reservationId: t.reservationId, segmentIndex: t.segmentIndex, event: 'departure', time: t.departureTime }, insertAtIndex);
                        setActiveAddDropdownIndex(null); setAddSlotSubMenu(null);
                      }}>
                        {getTransitIcon(t.type, 12)} {t.reservationName || t.departureLocationName} — Departure
                      </button>
                    )}
                    {t.arrivalDate === activeDayStr && !isTransitEventInSchedule(t.reservationId, t.segmentIndex, 'arrival') && (
                      <button className="dropdown-item" onClick={e => {
                        e.stopPropagation();
                        handleAddReservationEventToSchedule({ type: 'transit-event', reservationId: t.reservationId, segmentIndex: t.segmentIndex, event: 'arrival', time: t.arrivalTime }, insertAtIndex);
                        setActiveAddDropdownIndex(null); setAddSlotSubMenu(null);
                      }}>
                        {getTransitIcon(t.type, 12)} {t.reservationName || t.arrivalLocationName} — Arrival
                      </button>
                    )}
                  </React.Fragment>
                ))}
                {addSlotSubMenu.type === 'place' && (activePlan.placeReservations || []).filter(pr => pr.status !== 'Canceled' && pr.date === activeDayStr).map(pr => (
                  !isPlaceReservationEventInSchedule(pr.id) && (
                    <button key={pr.id} className="dropdown-item" onClick={e => {
                      e.stopPropagation();
                      handleAddReservationEventToSchedule({ type: 'place-reservation-event', reservationId: pr.id, time: pr.time }, insertAtIndex);
                      setActiveAddDropdownIndex(null); setAddSlotSubMenu(null);
                    }}>
                      {pr.type === 'dining' ? <Utensils size={12} /> : <Landmark size={12} />} {pr.title}
                    </button>
                  )
                ))}
              </>
            ) : (
              <>
                <button
                  className="dropdown-item"
                  onClick={e => {
                    e.stopPropagation();
                    setActiveAddDropdownIndex(null);
                    handleOpenAddPlaceAtIndex(insertAtIndex);
                  }}
                >
                  <MapPin size={12} /> Add Place
                </button>
                <button
                  className="dropdown-item"
                  onClick={e => {
                    e.stopPropagation();
                    setActiveAddDropdownIndex(null);
                    handleAddScheduleNote(insertAtIndex, '');
                    setEditingNoteItemIndex(insertAtIndex);
                  }}
                >
                  <FileText size={12} /> Add Note
                </button>
                {activePlan.hotels.filter(h => h.status !== 'Canceled' && (h.checkInDate === activeDayStr || h.checkOutDate === activeDayStr)).length > 0 && (
                  <button className="dropdown-item" onClick={e => {
                    e.stopPropagation();
                    setAddSlotSubMenu({ type: 'hotel', insertAtIndex });
                  }}>
                    <Building size={12} /> Add Hotel Event →
                  </button>
                )}
                {flattenReservations(activePlan.transports.filter(t => t.status !== 'Canceled')).filter(t => t.departureDate === activeDayStr || t.arrivalDate === activeDayStr).length > 0 && (
                  <button className="dropdown-item" onClick={e => {
                    e.stopPropagation();
                    setAddSlotSubMenu({ type: 'transit', insertAtIndex });
                  }}>
                    <Plane size={12} /> Add Transit Event →
                  </button>
                )}
                {(activePlan.placeReservations || []).filter(pr => pr.status !== 'Canceled' && pr.date === activeDayStr).length > 0 && (
                  <button className="dropdown-item" onClick={e => {
                    e.stopPropagation();
                    setAddSlotSubMenu({ type: 'place', insertAtIndex });
                  }}>
                    <Landmark size={12} /> Add Reservation Event →
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderNoteCard = (note: ScheduleNoteItem, idx: number, isFirst: boolean, isLast: boolean, canEdit: boolean) => {
    const dropdownKey = `note-${note.id}-${idx}`;
    const mobileDropdownKey = `note-${note.id}-${idx}-mobile`;
    const isEditingThis = editingNoteItemIndex === idx;

    return (
      <div
        className={`timeline-card glass-panel schedule-note-card ${activeTimelinePlaceDropdownKey === dropdownKey || activeTimelinePlaceDropdownKey === mobileDropdownKey ? 'dropdown-active' : ''}`}
        onClick={e => e.stopPropagation()}
        draggable={canEdit && !isEditingThis}
        onDragStart={(e) => {
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(idx));
          }
          setTimeout(() => {
            handleDayPlaceDragStart(idx);
          }, 0);
        }}
        onDragEnd={() => { setDraggedDayPlaceIndex(null); setDragOverDayPlaceIndex(null); }}
        onDragOver={(e) => {
          if (draggedDayPlaceIndex === idx) return;
          if (draggedDayPlaceIndex === null && !draggedPlaceId) return;
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          const position = (e.clientY - rect.top) < rect.height / 2 ? 'top' : 'bottom';
          if (dragOverDayPlaceIndex !== idx || dragOverDayPlacePosition !== position) {
            setDragOverDayPlaceIndex(idx);
            setDragOverDayPlacePosition(position);
          }
        }}
        onDrop={(e) => {
          e.stopPropagation();
          if (draggedPlaceId) handleCatalogPlaceDropOnTimeline(draggedPlaceId, idx, dragOverDayPlacePosition);
          else if (draggedDayPlaceIndex !== null) handleDayPlaceDrop(idx, dragOverDayPlacePosition);
          setDragOverDayPlaceIndex(null);
        }}
      >
        <div className="timeline-dot" style={{ backgroundColor: 'var(--accent-primary)' }}>
          <FileText size={12} className="text-white" />
        </div>
        <div className="card-header-row">
          <div
            className="timeline-card-content"
            style={{ cursor: canEdit && !isEditingThis ? 'pointer' : 'default' }}
            onClick={canEdit && !isEditingThis ? () => { setEditingNoteItemIndex(idx); } : undefined}
          >
            <div className="flex-1 min-w-0" style={{ paddingTop: '2px' }}>
              {isEditingThis ? (
                <div onClick={e => e.stopPropagation()}>
                  <textarea
                    ref={noteTextareaRef}
                    autoFocus
                    defaultValue={note.text}
                    placeholder="Add a note here..."
                    rows={4}
                    className="note-edit-textarea"
                  />
                  <div className="note-edit-actions">
                    <button className="btn-secondary note-edit-btn" onClick={() => { if (!note.text) handleDeleteScheduleNote(idx); setEditingNoteItemIndex(null); }}>Cancel</button>
                    <button
                      className="btn-primary flex-align note-edit-btn"
                      onClick={() => {
                        const text = noteTextareaRef.current?.value ?? '';
                        if (text.trim()) handleUpdateScheduleNote(idx, text);
                        setEditingNoteItemIndex(null);
                      }}
                      style={{ gap: '4px' }}
                    >
                      <Check size={10} /> Save
                    </button>
                  </div>
                </div>
              ) : (
                <span className="schedule-note-text" style={{ display: 'block' }}>
                  {note.text}
                </span>
              )}
            </div>
          </div>

          {canEdit && !isEditingThis && (
            <div className="day-place-actions-desktop" onClick={e => e.stopPropagation()}>
              <div className="place-card-move-buttons">
                <button className="mini-icon-btn" disabled={isFirst} onClick={() => handleMoveScheduleItem(idx, 'up')} data-tooltip="Move Up"><ChevronUp size={12} /></button>
                <button className="mini-icon-btn" disabled={isLast} onClick={() => handleMoveScheduleItem(idx, 'down')} data-tooltip="Move Down"><ChevronDown size={12} /></button>
              </div>
              <div className="timeline-place-dropdown-container">
                <button
                  className="mini-icon-btn"
                  onClick={e => { e.stopPropagation(); setActiveTimelinePlaceDropdownKey(activeTimelinePlaceDropdownKey === dropdownKey ? null : dropdownKey); }}
                  data-tooltip="Note Options"
                >
                  <MoreVertical size={14} />
                </button>
                {activeTimelinePlaceDropdownKey === dropdownKey && (
                  <div className="dropdown-menu dropdown-menu-above">
                    <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setEditingNoteItemIndex(idx); setActiveTimelinePlaceDropdownKey(null); }}><Edit2 size={12} /> Edit Note</button>
                    <button className="dropdown-item danger" onClick={e => { e.stopPropagation(); handleDeleteScheduleNote(idx); setActiveTimelinePlaceDropdownKey(null); }}>
                      <Trash2 size={12} /> Delete Note
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Mobile dropdown */}
        {canEdit && (
          <div className={`day-place-dropdown-container-mobile ${activeTimelinePlaceDropdownKey === mobileDropdownKey ? 'dropdown-active' : ''}`} onClick={e => e.stopPropagation()}>
            <button
              className="mini-icon-btn"
              onClick={e => { e.stopPropagation(); setActiveTimelinePlaceDropdownKey(activeTimelinePlaceDropdownKey === mobileDropdownKey ? null : mobileDropdownKey); }}
              data-tooltip="Note Options"
            >
              <MoreVertical size={14} />
            </button>
            {activeTimelinePlaceDropdownKey === mobileDropdownKey && (
              <div className="dropdown-menu">
                <button className="dropdown-item" disabled={isFirst} onClick={e => { e.stopPropagation(); handleMoveScheduleItem(idx, 'up'); setActiveTimelinePlaceDropdownKey(null); }}>
                  <ChevronUp size={12} /> Move Up
                </button>
                <button className="dropdown-item" disabled={isLast} onClick={e => { e.stopPropagation(); handleMoveScheduleItem(idx, 'down'); setActiveTimelinePlaceDropdownKey(null); }}>
                  <ChevronDown size={12} /> Move Down
                </button>
                <button className="dropdown-item" onClick={e => { e.stopPropagation(); setEditingNoteItemIndex(idx); setActiveTimelinePlaceDropdownKey(null); }}>
                  <Edit2 size={12} /> Edit Note
                </button>
                <button className="dropdown-item danger" onClick={e => { e.stopPropagation(); handleDeleteScheduleNote(idx); setActiveTimelinePlaceDropdownKey(null); }}>
                  <Trash2 size={12} /> Delete Note
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderReservationEventDragHandlers = (idx: number) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      handleDayPlaceDragStart(idx);
      if (e.currentTarget) {
        const card = e.currentTarget as HTMLElement;
        card.classList.add('is-dragging-ghost');
        setTimeout(() => card.classList.remove('is-dragging-ghost'), 0);
      }
    },
    onDragEnd: () => { setDraggedDayPlaceIndex(null); setDragOverDayPlaceIndex(null); },
    onDragOver: (e: React.DragEvent) => {
      if (draggedDayPlaceIndex !== null && sameMergeUnit(draggedDayPlaceIndex, idx)) return;
      if (draggedDayPlaceIndex === null && !draggedPlaceId) return;
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const position = clampMergePosition(idx, (e.clientY - rect.top) < rect.height / 2 ? 'top' : 'bottom');
      if (dragOverDayPlaceIndex !== idx || dragOverDayPlacePosition !== position) {
        setDragOverDayPlaceIndex(idx);
        setDragOverDayPlacePosition(position);
      }
    },
    onDrop: (e: React.DragEvent) => {
      e.stopPropagation();
      if (draggedDayPlaceIndex !== null) handleDayPlaceDrop(idx, dragOverDayPlacePosition);
      else if (draggedPlaceId) handleCatalogPlaceDropOnTimeline(draggedPlaceId, idx, dragOverDayPlacePosition);
      setDragOverDayPlaceIndex(null);
    },
  });

  const renderEventTimeTag = (item: ScheduleHotelEventItem | ScheduleTransitEventItem | SchedulePlaceReservationEventItem, idx: number, canEdit: boolean) => (
    <div
      className="timeline-event-time-tag"
      onClick={canEdit ? e => {
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setTimePickerState({ itemIdx: idx, value: item.time || '', top: rect.bottom + 6, left: rect.left });
      } : undefined}
      data-tooltip={canEdit ? 'Click to edit time' : undefined}
      style={{ cursor: canEdit ? 'pointer' : 'default' }}
    >
      {item.time || '--:--'}
    </div>
  );

  const renderReservationEventMoveButtons = (idx: number, isFirst: boolean, isLast: boolean, dropdownKey: string, label: string) => (
    <div className="day-place-actions-desktop" onClick={e => e.stopPropagation()}>
      <div className="place-card-move-buttons">
        <button className="mini-icon-btn" disabled={isFirst} onClick={() => handleMoveScheduleItem(idx, 'up')} data-tooltip="Move Up"><ChevronUp size={12} /></button>
        <button className="mini-icon-btn" disabled={isLast} onClick={() => handleMoveScheduleItem(idx, 'down')} data-tooltip="Move Down"><ChevronDown size={12} /></button>
      </div>
      <div className="timeline-place-dropdown-container">
        <button className="mini-icon-btn" onClick={e => { e.stopPropagation(); setActiveTimelinePlaceDropdownKey(activeTimelinePlaceDropdownKey === dropdownKey ? null : dropdownKey); }} data-tooltip={`${label} Options`}><MoreVertical size={14} /></button>
        {activeTimelinePlaceDropdownKey === dropdownKey && (
          <div className="dropdown-menu dropdown-menu-above">
            <button className="dropdown-item danger" onClick={e => { e.stopPropagation(); handleRemovePlaceFromDay(idx); setActiveTimelinePlaceDropdownKey(null); }}>
              <Trash2 size={12} /> Remove from Day
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderHotelEventCard = (item: ScheduleHotelEventItem, idx: number, isFirst: boolean, isLast: boolean, canEdit: boolean) => {
    const hotel = activePlan.hotels.find(h => h.id === item.hotelId);
    const isMismatch = hotel && (item.event === 'check-in' ? hotel.checkInDate !== activeDayStr : hotel.checkOutDate !== activeDayStr);
    const dropdownKey = `hotel-event-${item.hotelId}-${item.event}-${idx}`;
    const mobileDropdownKey = `${dropdownKey}-mobile`;

    return (
      <div
        className={`timeline-card glass-panel timeline-place-card ${activeTimelinePlaceDropdownKey === dropdownKey || activeTimelinePlaceDropdownKey === mobileDropdownKey ? 'dropdown-active' : ''}`}
        onClick={e => e.stopPropagation()}
        {...(canEdit ? renderReservationEventDragHandlers(idx) : {})}
      >
        <div className="timeline-dot" style={{ backgroundColor: '#10b981' }}>
          <Building size={12} style={{ color: '#ffffff' }} />
        </div>
        <div className="card-header-row">
          <div className="timeline-card-content">
            {renderEventTimeTag(item, idx, canEdit)}
            <div className="schedule-thumb-col">
              <div className="place-card-thumb-container" style={{ color: '#10b981' }}><Building size={16} /></div>
              {hotel && (
                <a href={buildHotelMapsLink(hotel)} target="_blank" rel="noopener noreferrer" className="btn-secondary timeline-place-map-link" onClick={e => e.stopPropagation()}>Map</a>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="place-title-row" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h4 className="place-title-text">{hotel ? hotel.name : <span style={{ color: '#ef4444' }}>Hotel (deleted)</span>}</h4>
                {isMismatch && <span data-tooltip="Hotel dates have changed — this event may be on the wrong day" style={{ color: '#f59e0b', flexShrink: 0 }}><AlertTriangle size={13} /></span>}
              </div>
              <p className="place-desc-text"><Building size={11} /> {item.event === 'check-in' ? 'Check-in' : 'Check-out'}{(() => { const t = item.event === 'check-in' ? hotel?.checkInTime : hotel?.checkOutTime; return t ? <> · {t}</> : null; })()}</p>
              {hotel?.address && <p className="place-desc-text"><MapPin size={11} /> {hotel.address}</p>}
              {hotel?.confirmationNo && <p className="place-desc-text"><Hash size={11} /> {hotel.confirmationNo}</p>}
            </div>
          </div>
          {canEdit && renderReservationEventMoveButtons(idx, isFirst, isLast, dropdownKey, 'Hotel Event')}
        </div>

        {/* Mobile dropdown */}
        {canEdit && (
          <div className={`day-place-dropdown-container-mobile ${activeTimelinePlaceDropdownKey === mobileDropdownKey ? 'dropdown-active' : ''}`} onClick={e => e.stopPropagation()}>
            <button className="mini-icon-btn" onClick={e => { e.stopPropagation(); setActiveTimelinePlaceDropdownKey(activeTimelinePlaceDropdownKey === mobileDropdownKey ? null : mobileDropdownKey); }} data-tooltip="Hotel Event Options"><MoreVertical size={14} /></button>
            {activeTimelinePlaceDropdownKey === mobileDropdownKey && (
              <div className="dropdown-menu">
                <button className="dropdown-item" disabled={isFirst} onClick={e => { e.stopPropagation(); handleMoveScheduleItem(idx, 'up'); setActiveTimelinePlaceDropdownKey(null); }}><ChevronUp size={12} /> Move Up</button>
                <button className="dropdown-item" disabled={isLast} onClick={e => { e.stopPropagation(); handleMoveScheduleItem(idx, 'down'); setActiveTimelinePlaceDropdownKey(null); }}><ChevronDown size={12} /> Move Down</button>
                <button className="dropdown-item danger" onClick={e => { e.stopPropagation(); handleRemovePlaceFromDay(idx); setActiveTimelinePlaceDropdownKey(null); }}><Trash2 size={12} /> Remove from Day</button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderTransitEventCard = (item: ScheduleTransitEventItem, idx: number, isFirst: boolean, isLast: boolean, canEdit: boolean) => {
    const reservation = activePlan.transports.find(r => r.id === item.reservationId);
    const segment = reservation?.segments[item.segmentIndex];
    const isMismatch = segment && (item.event === 'departure' ? segment.departureDate !== activeDayStr : segment.arrivalDate !== activeDayStr);
    const dropdownKey = `transit-event-${item.reservationId}-${item.segmentIndex}-${item.event}-${idx}`;
    const mobileDropdownKey = `${dropdownKey}-mobile`;
    const locationName = segment ? (item.event === 'departure' ? segment.departureLocationName : segment.arrivalLocationName) : '';
    const isDeleted = !reservation;
    const reservationName = reservation?.name || '';
    const title = [reservationName, locationName].filter(Boolean).join(' · ') || (isDeleted ? 'Transit (deleted)' : '');
    const eventLabel = item.event === 'departure' ? 'Departure' : 'Arrival';
    const carrierLine = [segment?.carrier, segment?.transitCode].filter(Boolean).join(' · ');
    const mapUrl = segment ? buildTransitMapsLink(item.event === 'departure' ? segment.departureLocationName : segment.arrivalLocationName, item.event === 'departure' ? segment.departureAddress : segment.arrivalAddress) : undefined;

    return (
      <div
        className={`timeline-card glass-panel timeline-place-card ${activeTimelinePlaceDropdownKey === dropdownKey || activeTimelinePlaceDropdownKey === mobileDropdownKey ? 'dropdown-active' : ''}`}
        onClick={e => e.stopPropagation()}
        {...(canEdit ? renderReservationEventDragHandlers(idx) : {})}
      >
        <div className="timeline-dot" style={{ backgroundColor: '#f59e0b', color: '#ffffff' }}>
          {reservation ? getTransitIcon(reservation.type, 12) : <Navigation size={12} />}
        </div>
        <div className="card-header-row">
          <div className="timeline-card-content">
            {renderEventTimeTag(item, idx, canEdit)}
            <div className="schedule-thumb-col">
              <div className="place-card-thumb-container" style={{ color: '#f59e0b' }}>
                {reservation ? getTransitIcon(reservation.type, 16) : <Navigation size={16} />}
              </div>
              {mapUrl && (
                <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary timeline-place-map-link" onClick={e => e.stopPropagation()}>Map</a>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="place-title-row" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h4 className="place-title-text" style={isDeleted ? { color: '#ef4444' } : undefined}>{title}</h4>
                {isMismatch && <span data-tooltip="Transit dates have changed — this event may be on the wrong day" style={{ color: '#f59e0b', flexShrink: 0 }}><AlertTriangle size={13} /></span>}
              </div>
              <p className="place-desc-text">{reservation ? getTransitIcon(reservation.type, 11) : <Navigation size={11} />} {eventLabel}{locationName ? (item.event === 'departure' ? ` from ${locationName}` : ` at ${locationName}`) : ''}{(() => { const t = segment ? (item.event === 'departure' ? segment.departureTime : segment.arrivalTime) : undefined; return t ? <> · {t}</> : null; })()}</p>
              {(() => {
                const addr = segment ? (item.event === 'departure' ? segment.departureAddress : segment.arrivalAddress) : undefined;
                return addr ? <p className="place-desc-text"><MapPin size={11} /> {addr}</p> : null;
              })()}
              {carrierLine && <p className="place-desc-text"><Navigation size={11} /> {carrierLine}</p>}
              {reservation?.confirmationNo && <p className="place-desc-text"><Hash size={11} /> {reservation.confirmationNo}</p>}
            </div>
          </div>
          {canEdit && renderReservationEventMoveButtons(idx, isFirst, isLast, dropdownKey, 'Transit Event')}
        </div>

        {/* Mobile dropdown */}
        {canEdit && (
          <div className={`day-place-dropdown-container-mobile ${activeTimelinePlaceDropdownKey === mobileDropdownKey ? 'dropdown-active' : ''}`} onClick={e => e.stopPropagation()}>
            <button className="mini-icon-btn" onClick={e => { e.stopPropagation(); setActiveTimelinePlaceDropdownKey(activeTimelinePlaceDropdownKey === mobileDropdownKey ? null : mobileDropdownKey); }} data-tooltip="Transit Event Options"><MoreVertical size={14} /></button>
            {activeTimelinePlaceDropdownKey === mobileDropdownKey && (
              <div className="dropdown-menu">
                <button className="dropdown-item" disabled={isFirst} onClick={e => { e.stopPropagation(); handleMoveScheduleItem(idx, 'up'); setActiveTimelinePlaceDropdownKey(null); }}><ChevronUp size={12} /> Move Up</button>
                <button className="dropdown-item" disabled={isLast} onClick={e => { e.stopPropagation(); handleMoveScheduleItem(idx, 'down'); setActiveTimelinePlaceDropdownKey(null); }}><ChevronDown size={12} /> Move Down</button>
                <button className="dropdown-item danger" onClick={e => { e.stopPropagation(); handleRemovePlaceFromDay(idx); setActiveTimelinePlaceDropdownKey(null); }}><Trash2 size={12} /> Remove from Day</button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderPlaceReservationEventCard = (item: SchedulePlaceReservationEventItem, idx: number, isFirst: boolean, isLast: boolean, canEdit: boolean, mergeClass = '', linkedPlaceId?: string) => {
    const reservation = (activePlan.placeReservations || []).find(r => r.id === item.reservationId);
    const isMismatch = reservation && reservation.date && reservation.date !== activeDayStr;
    const dropdownKey = `place-reservation-event-${item.reservationId}-${idx}`;
    const mobileDropdownKey = `${dropdownKey}-mobile`;
    const isDeleted = !reservation;
    const typeColor = reservation?.type === 'dining' ? '#3b82f6' : '#ef4444';
    const IconComp = reservation?.type === 'dining' ? Utensils : Landmark;
    const title = reservation ? reservation.title : 'Reservation (deleted)';
    const mapUrl = reservation ? (reservation.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${reservation.title} ${reservation.address}`)}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(reservation.title)}`) : undefined;

    return (
      <div
        className={`timeline-card glass-panel timeline-place-card${mergeClass}${linkedPlaceId ? ' timeline-card--merge-clickable' : ''} ${activeTimelinePlaceDropdownKey === dropdownKey || activeTimelinePlaceDropdownKey === mobileDropdownKey ? 'dropdown-active' : ''}`}
        onClick={e => {
          e.stopPropagation();
          // When merged, clicking either half toggles the linked place's expanded state.
          if (linkedPlaceId) setActivePlaceId(activePlaceId === linkedPlaceId ? undefined : linkedPlaceId);
        }}
        {...(canEdit ? renderReservationEventDragHandlers(idx) : {})}
      >
        <div className="timeline-dot" style={{ backgroundColor: typeColor, color: '#ffffff' }}>
          <IconComp size={12} />
        </div>
        <div className="card-header-row">
          <div className="timeline-card-content">
            {renderEventTimeTag(item, idx, canEdit)}
            <div className="schedule-thumb-col">
              <div className="place-card-thumb-container" style={{ color: typeColor }}>
                <IconComp size={16} />
              </div>
              {mapUrl && (
                <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary timeline-place-map-link" onClick={e => e.stopPropagation()}>Map</a>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="place-title-row" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h4 className="place-title-text" style={isDeleted ? { color: '#ef4444' } : undefined}>{title}</h4>
                {isMismatch && <span data-tooltip="Reservation date has changed — this event may be on the wrong day" style={{ color: '#f59e0b', flexShrink: 0 }}><AlertTriangle size={13} /></span>}
              </div>
              <p className="place-desc-text"><IconComp size={11} /> {reservation?.type === 'dining' ? 'Dining Reservation' : 'Attraction Reservation'}{reservation?.time ? ` · ${reservation.time}` : ''}</p>
              {reservation?.address && <p className="place-desc-text"><MapPin size={11} /> {reservation.address}</p>}
              {reservation?.confirmationNo && <p className="place-desc-text"><Hash size={11} /> {reservation.confirmationNo}</p>}
            </div>
          </div>
          {canEdit && renderReservationEventMoveButtons(idx, isFirst, isLast, dropdownKey, 'Reservation Event')}
        </div>

        {/* Mobile dropdown */}
        {canEdit && (
          <div className={`day-place-dropdown-container-mobile ${activeTimelinePlaceDropdownKey === mobileDropdownKey ? 'dropdown-active' : ''}`} onClick={e => e.stopPropagation()}>
            <button className="mini-icon-btn" onClick={e => { e.stopPropagation(); setActiveTimelinePlaceDropdownKey(activeTimelinePlaceDropdownKey === mobileDropdownKey ? null : mobileDropdownKey); }} data-tooltip="Reservation Event Options"><MoreVertical size={14} /></button>
            {activeTimelinePlaceDropdownKey === mobileDropdownKey && (
              <div className="dropdown-menu">
                <button className="dropdown-item" disabled={isFirst} onClick={e => { e.stopPropagation(); handleMoveScheduleItem(idx, 'up'); setActiveTimelinePlaceDropdownKey(null); }}><ChevronUp size={12} /> Move Up</button>
                <button className="dropdown-item" disabled={isLast} onClick={e => { e.stopPropagation(); handleMoveScheduleItem(idx, 'down'); setActiveTimelinePlaceDropdownKey(null); }}><ChevronDown size={12} /> Move Down</button>
                <button className="dropdown-item danger" onClick={e => { e.stopPropagation(); handleRemovePlaceFromDay(idx); setActiveTimelinePlaceDropdownKey(null); }}><Trash2 size={12} /> Remove from Day</button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // The scheduled place card body (the inner .timeline-card). Extracted so a merged unit can
  // render it and the reservation card side-by-side inside one container.
  const renderScheduledPlaceCard = (place: Place, placeNumber: number, idx: number, isFirst: boolean, isLast: boolean, canEdit: boolean, mergeClass = '') => {
    const dropdownKey = `${place.id}-${idx}`;
    const mobileDropdownKey = `${place.id}-${idx}-mobile`;
    return (
      <div
        className={`timeline-card glass-panel timeline-place-card${mergeClass} ${activePlaceId === place.id ? 'timeline-place-card--active' : ''} ${activeTimelinePlaceDropdownKey === mobileDropdownKey ? 'dropdown-active' : ''}`}
        data-place-id={place.id}
        draggable={canEdit && editingPlaceNotesId !== place.id}
        onDragStart={(e) => {
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(idx));
          }
          setTimeout(() => {
            handleDayPlaceDragStart(idx);
          }, 0);
        }}
        onDragEnd={() => { setDraggedDayPlaceIndex(null); setDragOverDayPlaceIndex(null); }}
        onDragOver={(e) => {
          if (draggedDayPlaceIndex !== null && sameMergeUnit(draggedDayPlaceIndex, idx)) return;
          if (draggedDayPlaceIndex === null && !draggedPlaceId) return;
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          const position = clampMergePosition(idx, (e.clientY - rect.top) < rect.height / 2 ? 'top' : 'bottom');
          if (dragOverDayPlaceIndex !== idx || dragOverDayPlacePosition !== position) {
            setDragOverDayPlaceIndex(idx);
            setDragOverDayPlacePosition(position);
          }
        }}
        onDrop={(e) => {
          e.stopPropagation();
          if (draggedDayPlaceIndex !== null) handleDayPlaceDrop(idx, dragOverDayPlacePosition);
          else if (draggedPlaceId) handleCatalogPlaceDropOnTimeline(draggedPlaceId, idx, dragOverDayPlacePosition);
          setDragOverDayPlaceIndex(null);
        }}
        onClick={() => setActivePlaceId(activePlaceId === place.id ? undefined : place.id)}
      >
        <div className="timeline-dot" style={{ backgroundColor: (trip.placeGroups || DEFAULT_PLACE_GROUPS).find(g => g.id === place.placeGroupId)?.color || '#6b7280' }}>
          {getCategoryIconComponent((trip.placeGroups || DEFAULT_PLACE_GROUPS).find(g => g.id === place.placeGroupId)?.icon || 'map-pin', 12, undefined, { color: '#ffffff' })}
        </div>

        <div className="card-header-row">
          <div className="timeline-card-content" style={{ cursor: 'grab' }}>
            <div className="timeline-place-number">
              {placeNumber}
            </div>

            <div className="schedule-thumb-col">
              {place.photoUrl ? (
                <div className="place-card-thumb-container"><img src={getOptimizedImageUrl(place.photoUrl, 80)} alt="" loading="lazy" decoding="async" /></div>
              ) : (
                <div className="place-card-thumb-container"><MapPin size={16} className="text-muted" /></div>
              )}
              <a href={place.mapsLink || buildMapsLink(place.title, place.lat, place.lng, activeDayLocation?.city || catalogLocation?.city)} target="_blank" rel="noopener noreferrer" className="btn-secondary timeline-place-map-link" onClick={(e) => e.stopPropagation()}>Map</a>
            </div>

            <div className="flex-1 min-w-0">
              <div className="place-title-row">
                <h4 className="place-title-text">{place.title}</h4>
              </div>
              {place.openingHours && (
                <div className="place-card-hours">
                  <Clock size={10} /> <span>{place.openingHours}</span>
                </div>
              )}
              <p className="place-desc-text">{place.description || 'Attraction'}</p>
              {/* Inline notes slot (desktop): hidden on mobile in favor of the
                  full-width card-level slot below. */}
              <div className="place-notes-slot place-notes-slot--inline">
                <InlineNotes
                  value={place.notes}
                  canEdit={canEdit}
                  layout="compact"
                  onSave={(text) => savePlaceNotes(place.id, text)}
                  onEditingChange={(e) => setEditingPlaceNotesId(e ? place.id : null)}
                />
              </div>
            </div>
          </div>

          {canEdit && (
            <div className="day-place-actions-desktop" onClick={e => e.stopPropagation()}>
              <div className="place-card-move-buttons">
                <button className="mini-icon-btn" disabled={isFirst} onClick={() => handleMoveScheduleItem(idx, 'up')} data-tooltip="Move Up"><ChevronUp size={12} /></button>
                <button className="mini-icon-btn" disabled={isLast} onClick={() => handleMoveScheduleItem(idx, 'down')} data-tooltip="Move Down"><ChevronDown size={12} /></button>
              </div>
              <div className="timeline-place-dropdown-container">
                <button className="mini-icon-btn" onClick={(e) => { e.stopPropagation(); setActiveTimelinePlaceDropdownKey(activeTimelinePlaceDropdownKey === dropdownKey ? null : dropdownKey); }} data-tooltip="Place Options"><MoreVertical size={14} /></button>
                {activeTimelinePlaceDropdownKey === dropdownKey && (
                  <div className="dropdown-menu dropdown-menu-above">
                    <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(place.title); setActiveTimelinePlaceDropdownKey(null); }}><Copy size={12} /> Copy Name</button>
                    <button className="dropdown-item" data-tooltip="Edit Place" onClick={(e) => { e.stopPropagation(); handleOpenEditPlace(place); setActiveTimelinePlaceDropdownKey(null); }}><Edit2 size={12} /> Edit Place</button>
                    <button className="dropdown-item danger" onClick={(e) => { e.stopPropagation(); handleRemovePlaceFromDay(idx); setActiveTimelinePlaceDropdownKey(null); }}><Trash2 size={12} /> Remove from Day</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Mobile-only full-width notes slot — a card-level sibling so both the
            view and the editor span the full card content width (like the
            reservation card), instead of being indented inside the thumbnail
            column. Hidden on desktop; the inline slot above is hidden on mobile. */}
        <div className="place-notes-slot place-notes-slot--mobile">
          <InlineNotes
            value={place.notes}
            canEdit={canEdit}
            layout="compact"
            onSave={(text) => savePlaceNotes(place.id, text)}
            onEditingChange={(e) => setEditingPlaceNotesId(e ? place.id : null)}
          />
        </div>

        {/* Mobile dropdown */}
        {canEdit && (
          <div className={`day-place-dropdown-container-mobile ${activeTimelinePlaceDropdownKey === mobileDropdownKey ? 'dropdown-active' : ''}`} onClick={e => e.stopPropagation()}>
            <button className="mini-icon-btn" onClick={(e) => { e.stopPropagation(); setActiveTimelinePlaceDropdownKey(activeTimelinePlaceDropdownKey === mobileDropdownKey ? null : mobileDropdownKey); }} data-tooltip="Place Options"><MoreVertical size={14} /></button>
            {activeTimelinePlaceDropdownKey === mobileDropdownKey && (
              <div className="dropdown-menu">
                <button className="dropdown-item" disabled={isFirst} onClick={(e) => { e.stopPropagation(); handleMoveScheduleItem(idx, 'up'); setActiveTimelinePlaceDropdownKey(null); }}><ChevronUp size={12} /> Move Up</button>
                <button className="dropdown-item" disabled={isLast} onClick={(e) => { e.stopPropagation(); handleMoveScheduleItem(idx, 'down'); setActiveTimelinePlaceDropdownKey(null); }}><ChevronDown size={12} /> Move Down</button>
                <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(place.title); setActiveTimelinePlaceDropdownKey(null); }}><Copy size={12} /> Copy Name</button>
                <button className="dropdown-item" data-tooltip="Edit Place" onClick={(e) => { e.stopPropagation(); handleOpenEditPlace(place); setActiveTimelinePlaceDropdownKey(null); }}><Edit2 size={12} /> Edit Place</button>
                <button className="dropdown-item danger" onClick={(e) => { e.stopPropagation(); handleRemovePlaceFromDay(idx); setActiveTimelinePlaceDropdownKey(null); }}><Trash2 size={12} /> Remove from Day</button>
              </div>
            )}
          </div>
        )}

        {/* Expand Details if selected */}
        <div className={`card-expandable-wrapper${activePlaceId === place.id ? ' is-expanded' : ''}`}>
          <div>
            <div className="card-expanded-section" onClick={e => e.stopPropagation()}>
              {place.description && <p style={{ color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: 1.3, textTransform: 'none' }}>{place.description}</p>}
              <AiDetailsView place={place} onGenerate={() => handleGenerateSinglePlaceAiDetails(place.id)} canEdit={canEdit} isGenerating={placeGeneratingIds.has(place.id)} layoutMode="adaptive-2-col" customAiFields={trip.customAiFields} disabledPlaceFields={trip.disabledPlaceFields} fieldIcons={trip.fieldIcons} placeFieldsOrder={trip.placeFieldsOrder} />
            </div>
          </div>
        </div>
      </div>
    );
  };

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
    <div className={`itinerary-panel ${activeMobileTab === 'itinerary' ? 'mobile-active' : ''}`}>
      {setLeftCollapsed && (
        <button 
          className="panel-toggle-btn left-toggle" 
          onClick={() => setLeftCollapsed(!leftCollapsed)}
          data-tooltip={leftCollapsed ? "Expand Panel" : "Collapse Panel"}
        >
          {leftCollapsed ? <ChevronRight size={10} /> : <ChevronLeft size={10} />}
        </button>
      )}

      {setRightCollapsed && (
        <button 
          className="panel-toggle-btn right-toggle" 
          onClick={() => setRightCollapsed(!rightCollapsed)}
          data-tooltip={rightCollapsed ? "Expand Panel" : "Collapse Panel"}
        >
          {rightCollapsed ? <ChevronLeft size={10} /> : <ChevronRight size={10} />}
        </button>
      )}

      <div className="itinerary-header">
        <div className="trip-meta-info-container">
          <div className="trip-title-row">
            <h2 className="trip-title-text">{trip.name}</h2>
            <div className="trip-action-buttons">
              {trip.isOwner !== false && (
                <button
                  className="mini-icon-btn"
                  onClick={() => setShowEditTripModal(true)}
                  data-tooltip="Edit Trip Details"
                  style={{ opacity: 0.6 }}
                >
                  <Edit2 size={14} />
                </button>
              )}
              {trip.isOwner !== false && (
                <button
                  className="mini-icon-btn"
                  onClick={() => setShowTripAiConfigModal(true)}
                  data-tooltip="Trip AI Config Settings"
                  style={{ opacity: 0.6 }}
                >
                  <Sparkles size={14} className="text-accent" />
                </button>
              )}
              {isGoogleSignedIn && trip.isOwner !== false && trip.driveFileId && (
                <button
                  className="mini-icon-btn text-accent"
                  onClick={() => onShareTrip && onShareTrip(trip)}
                  data-tooltip="Share Itinerary"
                >
                  <Share2 size={14} />
                </button>
              )}
              {trip.isOwner === false && (
                <span className="trip-mode-badge">
                  {trip.canEdit === false ? 'Viewer Mode' : 'Editor Mode'}
                </span>
              )}
            </div>
          </div>
          
          <div className="trip-duration-text">
            <span className="flex-align" style={{ gap: '6px' }}>
              <Calendar size={13} className="text-muted" />
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
                  className="plan-rename-input"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRenamePlan();
                    if (e.key === 'Escape') setIsRenamingPlan(false);
                  }}
                />
                <button className="mini-icon-btn plan-rename-save" onClick={handleRenamePlan} data-tooltip="Save Name">
                  <Check size={14} />
                </button>
                <button className="mini-icon-btn plan-rename-cancel" onClick={() => setIsRenamingPlan(false)} data-tooltip="Cancel">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="plan-picker-wrapper">
                <Layers size={16} className="text-muted" />
                <div ref={planPickerRef} className={`plan-picker-select-wrapper${isPlanPickerOpen ? ' plan-picker-open' : ''}`}>
                  <button
                    type="button"
                    className="combo-trigger plan-picker"
                    onClick={() => setIsPlanPickerOpen(!isPlanPickerOpen)}
                  >
                    <span className="plan-picker-label">{activePlan?.name}</span>
                    <ChevronDown size={14} className="plan-picker-chevron" />
                  </button>
                  {isPlanPickerOpen && (
                    <div className="combo-dropdown plan-picker-dropdown">
                      {trip.plans.map(p => (
                        <div
                          key={p.id}
                          className={`plan-picker-option${p.id === activePlanId ? ' selected' : ''}`}
                          onClick={() => {
                            if (daysTabsNavRef.current) {
                              lastScrollLeft.current = daysTabsNavRef.current.scrollLeft;
                            }
                            setActivePlanId(p.id);
                            const newPlanDays = Object.keys(trip.plans.find(pl => pl.id === p.id)?.days || {}).sort();
                            if (newPlanDays.length > 0 && !newPlanDays.includes(activeDayStr)) {
                              setActiveDayStr(newPlanDays[0]);
                            }
                            setIsPlanPickerOpen(false);
                          }}
                        >
                          {p.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {trip.canEdit !== false && (
                  <div className="plan-dropdown-container">
                    <button
                      className="mini-icon-btn"
                      onClick={() => setShowPlanMenu(!showPlanMenu)}
                      data-tooltip="Plan Options"
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
                <span className="day-tab-date" style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                  Day {index + 1}
                </span>
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
            <div className="day-location-info">
              {activeDayLocation ? (
                <span className="day-location-emoji">
                  {getLocIcon(activeDayLocation)}
                </span>
              ) : (
                <MapPin size={24} className="no-location-icon" />
              )}
              <div className="location-name-wrapper">
                <h3 className="day-location-name-text">
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
                <h4 className="timeline-section-title"><Building size={16} /> Hotels</h4>
              </div>
              <div className="timeline-section-actions" style={{ gap: '12px' }}>
                {trip.canEdit !== false && (
                  <>
                    <label className="flex-align" style={{ fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer', gap: '5px', userSelect: 'none', whiteSpace: 'nowrap' }}>
                      <input
                        type="checkbox"
                        checked={!!activePlan.days[activeDayStr]?.noHotel}
                        onChange={(e) => onToggleNoHotel?.(activeDayStr, e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      No Hotel Needed
                    </label>
                    <button className="mini-icon-btn flex-align timeline-add-btn--success" onClick={() => setShowHotelModal(true)}>
                      <Plus size={14} /> Add Hotel
                    </button>
                  </>
                )}
              </div>
            </div>

            {(() => {
              const dayHotels = getHotelsForDay(activeDayStr).filter(h => h.status !== 'Canceled');
              const confirmedHotels = dayHotels.filter(h => h.status === 'Confirmed');
              const pendingHotels = dayHotels.filter(h => !h.status || h.status === 'Planning');
              const isNoHotel = activePlan.days[activeDayStr]?.noHotel;

              if (confirmedHotels.length === 0) {
                if (isNoHotel) return null;
                if (pendingHotels.length > 0) {
                  return (
                    <p className="no-transport-text no-transport-text--warning" style={{ margin: '0 0 10px 0' }}>
                      <AlertTriangle size={12} /> No confirmed hotels booked for this day. Please mark the pending hotel to confirmed.
                    </p>
                  );
                }
                return (
                  <p className="no-transport-text no-transport-text--warning" style={{ margin: '0 0 10px 0' }}>
                    <AlertTriangle size={12} /> No hotels booked for this day.
                  </p>
                );
              } else {
                if (pendingHotels.length > 0) {
                  return (
                    <p className="no-transport-text no-transport-text--warning" style={{ margin: '0 0 10px 0' }}>
                      <AlertTriangle size={12} /> There are pending hotels for this day. Please confirm or cancel them.
                    </p>
                  );
                }
              }
              return null;
            })()}

            <div className="section-item-list">
              {sortHotels(getHotelsForDay(activeDayStr))
                .map(h => {
                  const isExpanded = expandedHotelId === h.id;
                return (
                  <div key={h.id} className={`hotel-card${isExpanded ? ' reservation-card--expanded' : ''}${openHotelMenuId === h.id ? ' dropdown-active' : ''}`}>
                    {/* Clickable header row */}
                    <div className="hotel-card-body" onClick={() => setExpandedHotelId(isExpanded ? null : h.id)}>
                      <div className="schedule-thumb-col" onClick={e => e.stopPropagation()}>
                        <div className="hotel-icon-wrapper">
                          <Building size={16} />
                        </div>
                        <a
                          href={buildHotelMapsLink(h)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary timeline-place-map-link"
                        >Map</a>
                      </div>
                      <div className="hotel-text-col" style={{ flex: 1, minWidth: 0 }}>
                        <div className="place-title-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h4 className="place-title-text">{h.name}</h4>
                          <span
                            className={`reservation-status-badge reservation-status-badge--${(h.status || 'Planning').toLowerCase()}`}
                            data-tooltip={h.status || 'Planning'}
                          >
                            {renderStatusIcon(h.status)}
                          </span>
                        </div>
                        <p className="place-desc-text"><Calendar size={11} /> Check-in: {formatCardDate(h.checkInDate, h.checkInTime)}</p>
                        <p className="place-desc-text"><Calendar size={11} /> Check-out: {formatCardDate(h.checkOutDate, h.checkOutTime)}</p>
                        {trip.canEdit !== false && (
                          <div className="reservation-add-to-schedule-row" onClick={e => e.stopPropagation()}>
                            {h.checkInDate === activeDayStr && !isHotelEventInSchedule(h.id, 'check-in') && (
                              <button className="btn-secondary reservation-add-to-schedule-btn" onClick={() => handleAddReservationEventToSchedule({ type: 'hotel-event', hotelId: h.id, event: 'check-in', time: h.checkInTime })}>
                                <Plus size={10} /> Add Check-in to Day Schedule
                              </button>
                            )}
                            {h.checkOutDate === activeDayStr && !isHotelEventInSchedule(h.id, 'check-out') && (
                              <button className="btn-secondary reservation-add-to-schedule-btn" onClick={() => handleAddReservationEventToSchedule({ type: 'hotel-event', hotelId: h.id, event: 'check-out', time: h.checkOutTime })}>
                                <Plus size={10} /> Add Check-out to Day Schedule
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="card-actions-stack card-actions-stack--pinned" onClick={e => e.stopPropagation()}>
                        <button type="button" className="mini-icon-btn" onClick={() => setExpandedHotelId(isExpanded ? null : h.id)} data-tooltip={isExpanded ? 'Collapse' : 'Expand'}>
                          <ChevronDown size={14} className={`expand-chevron${isExpanded ? ' is-open' : ''}`} />
                        </button>
                        <div className="card-options-menu">
                          <button
                            className="mini-icon-btn"
                            onClick={() => setOpenHotelMenuId(prev => prev === h.id ? null : h.id)}
                            data-tooltip="Options"
                          >
                            <MoreVertical size={14} />
                          </button>
                          {openHotelMenuId === h.id && (
                            <div className="dropdown-menu dropdown-menu--right">
                              <button className="dropdown-item" onClick={() => { navigator.clipboard.writeText(h.name); setOpenHotelMenuId(null); }}>
                                <Copy size={13} /> Copy Name
                              </button>
                              {h.address && (
                                <button className="dropdown-item" onClick={() => { navigator.clipboard.writeText(h.address!); setOpenHotelMenuId(null); }}>
                                  <Copy size={13} /> Copy Address
                                </button>
                              )}
                              {trip.canEdit !== false && <>
                                <button className="dropdown-item" onClick={() => { handleOpenEditHotel(h); setOpenHotelMenuId(null); }}>
                                  <Edit2 size={13} /> Edit
                                </button>
                                <button className="dropdown-item danger" onClick={() => { handleDeleteHotel(h.id); setOpenHotelMenuId(null); }}>
                                  <Trash2 size={13} /> Delete
                                </button>
                              </>}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expandable details — above notes */}
                    <div className={`card-expandable-wrapper${isExpanded ? ' is-expanded' : ''}`}>
                      <div>
                        <div className="card-expanded-inner">
                          <a
                            href={buildHotelMapsLink(h)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="place-desc-text"
                            style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', margin: 0, color: 'inherit', textDecoration: 'none' }}
                            onClick={e => e.stopPropagation()}
                          >
                            <MapPin size={12} style={{ flexShrink: 0, marginTop: '2px' }} /> {h.address || h.name}
                          </a>
                          <div className="reservation-card-field-row">
                            {h.confirmationNo && (
                              <>
                                <Hash size={12} />
                                <span className="place-desc-text">{h.confirmationNo}</span>
                              </>
                            )}
                            <span className={`reservation-status-text-badge reservation-status-badge--${(h.status || 'Planning').toLowerCase()}`}>
                              {h.status || 'Planning'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Notes — always visible */}
                    <InlineNotes
                      value={h.notes}
                      canEdit={trip.canEdit !== false}
                      layout="compact"
                      onSave={(text) => handleSaveHotelNotes(h.id, text)}
                      reserveActionSpace
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Transportation Schedule */}
          <div className="timeline-section">
            <div className="timeline-section-header">
              <div className="timeline-section-title-row">
                <h4 className="timeline-section-title"><Plane size={16} /> Transits & Flights</h4>
              </div>
              <div className="timeline-section-actions">
                {trip.canEdit !== false && (
                  <button className="mini-icon-btn flex-align timeline-add-btn--warning" onClick={() => setShowTransportModal(true)}>
                    <Plus size={14} /> Add Transit
                  </button>
                )}
              </div>
            </div>

            {(() => {
              const activeIndex = daysList.indexOf(activeDayStr);
              const prevDayStr = activeIndex > 0 ? daysList[activeIndex - 1] : null;
              const prevLocId = prevDayStr ? activePlan.days[prevDayStr]?.locationId : null;
              const currLocId = activePlan.days[activeDayStr]?.locationId;
              const isLocationChange = prevLocId && currLocId && prevLocId !== currLocId;

              const prevLoc = prevLocId ? trip.locations.find(l => l.id === prevLocId) : null;
              const currLoc = currLocId ? trip.locations.find(l => l.id === currLocId) : null;
              const prevCity = prevLoc?.city ?? 'previous location';
              const currCity = currLoc?.city ?? 'next location';

              const allTransports = getTransportsForDay(activeDayStr).filter(t => t.status !== 'Canceled');

              if (allTransports.length === 0) {
                if (isLocationChange) {
                  return (
                    <p className="no-transport-text no-transport-text--warning" style={{ margin: '0 0 10px 0' }}>
                      <AlertTriangle size={12} /> No transit from {prevCity} to {currCity}.
                    </p>
                  );
                }
                return <p className="no-transport-text" style={{ margin: '0 0 10px 0' }}>No transit booked.</p>;
              }

              if (isLocationChange) {
                const transits = allTransports.filter(
                  t => t.departureDate === prevDayStr || t.arrivalDate === activeDayStr
                );
                const confirmedTransports = transits.filter(t => t.status === 'Confirmed');
                const pendingTransports = transits.filter(t => !t.status || t.status === 'Planning');

                if (confirmedTransports.length === 0) {
                  if (pendingTransports.length > 0) {
                    return (
                      <p className="no-transport-text no-transport-text--warning" style={{ margin: '0 0 10px 0' }}>
                        <AlertTriangle size={12} /> No confirmed transit from {prevCity} to {currCity}. Please mark the pending transit to confirmed.
                      </p>
                    );
                  }
                  return (
                    <p className="no-transport-text no-transport-text--warning" style={{ margin: '0 0 10px 0' }}>
                      <AlertTriangle size={12} /> No transit from {prevCity} to {currCity}.
                    </p>
                  );
                } else {
                  if (pendingTransports.length > 0) {
                    return (
                      <p className="no-transport-text no-transport-text--warning" style={{ margin: '0 0 10px 0' }}>
                        <AlertTriangle size={12} /> There are pending transits from {prevCity} to {currCity}. Please confirm or cancel them.
                      </p>
                    );
                  }
                }
              }
              return null;
            })()}

            <div className="section-item-list">
              {sortTransports(getTransportsForDay(activeDayStr))
                .map(t => {
                  const isDeparture = t.departureDate === activeDayStr;
                  const isArrival = t.arrivalDate === activeDayStr;
                  const isExpanded = expandedTransitId === t.id;
                const transitName = t.reservationName || `${t.departureLocationName} → ${t.arrivalLocationName}`;
                const carrierLine = [t.carrier, t.transitCode].filter(Boolean).join(' · ');
                const depTzLabel = t.departureTimezone ? ` (${formatTzOffset(t.departureTimezone)})` : '';
                const arrTzLabel = t.arrivalTimezone ? ` (${formatTzOffset(t.arrivalTimezone)})` : '';

                return (
                  <div key={t.id} className={`transport-card${isExpanded ? ' reservation-card--expanded' : ''}${openTransportMenuId === t.id || openMapMenuId === t.id ? ' dropdown-active' : ''}`}>
                    {/* Clickable header row */}
                    <div className="transport-card-body" onClick={() => setExpandedTransitId(isExpanded ? null : t.id)}>
                      <div className="schedule-thumb-col" onClick={e => e.stopPropagation()}>
                        <div className="transport-icon-wrapper">
                          {t.type === 'flight' && <Plane size={16} />}
                          {t.type === 'train' && <Train size={16} />}
                          {t.type === 'bus' && <Bus size={16} />}
                          {t.type === 'car' && <Car size={16} />}
                          {t.type === 'ferry' && <Anchor size={16} />}
                          {t.type === 'other' && <Navigation size={16} />}
                        </div>
                        <div className="card-options-menu">
                          <button
                            type="button"
                            className="btn-secondary timeline-place-map-link"
                            onClick={() => setOpenMapMenuId(prev => prev === t.id ? null : t.id)}
                          >Map</button>
                          {openMapMenuId === t.id && (
                            <div className="dropdown-menu dropdown-menu--left">
                              <button className="dropdown-item" onClick={() => { window.open(buildTransitMapsLink(t.departureLocationName, t.departureAddress), '_blank'); setOpenMapMenuId(null); }}>
                                <ArrowUpRight size={12} /> {t.departureLocationName}
                              </button>
                              <button className="dropdown-item" onClick={() => { window.open(buildTransitMapsLink(t.arrivalLocationName, t.arrivalAddress), '_blank'); setOpenMapMenuId(null); }}>
                                <ArrowDownLeft size={12} /> {t.arrivalLocationName}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="place-title-row">
                          <h4 className="place-title-text">{transitName}</h4>
                          <span
                            className={`reservation-status-badge reservation-status-badge--${(t.status || 'Planning').toLowerCase()}`}
                            data-tooltip={t.status || 'Planning'}
                          >
                            {renderStatusIcon(t.status)}
                          </span>
                        </div>
                        {carrierLine && <p className="place-desc-text">{carrierLine}</p>}
                        <div className="transport-details-grid" style={{ marginTop: '2px' }}>
                          <div className="transport-flow" style={{ opacity: isDeparture ? 1 : 0.5 }}>
                            <span className="transport-flow-sub">
                              Departure {isDeparture && <ArrowUpRight size={11} className="transport-flag-icon" />}
                            </span>
                            <span className="transport-flow-main">{t.departureLocationName}</span>
                            <span className="transport-time-detail">
                              <Calendar size={11} />{formatCardDate(t.departureDate)}{t.departureTime ? ` · ${t.departureTime}` : ''}{depTzLabel}
                            </span>
                            {isDeparture && trip.canEdit !== false && !isTransitEventInSchedule(t.reservationId, t.segmentIndex, 'departure') && (
                              <button className="btn-secondary reservation-add-to-schedule-btn" style={{ alignSelf: 'flex-start' }} onClick={e => { e.stopPropagation(); handleAddReservationEventToSchedule({ type: 'transit-event', reservationId: t.reservationId, segmentIndex: t.segmentIndex, event: 'departure', time: t.departureTime }); }}>
                                <Plus size={10} /> Add Departure to Day Schedule
                              </button>
                            )}
                          </div>
                          <div className="transport-flow" style={{ opacity: isArrival ? 1 : 0.5 }}>
                            <span className="transport-flow-sub">
                              Arrival {isArrival && <ArrowDownLeft size={11} className="transport-flag-icon" />}
                            </span>
                            <span className="transport-flow-main">{t.arrivalLocationName}</span>
                            <span className="transport-time-detail">
                              <Calendar size={11} />{formatCardDate(t.arrivalDate)}{t.arrivalTime ? ` · ${t.arrivalTime}` : ''}{arrTzLabel}
                            </span>
                            {isArrival && trip.canEdit !== false && !isTransitEventInSchedule(t.reservationId, t.segmentIndex, 'arrival') && (
                              <button className="btn-secondary reservation-add-to-schedule-btn" style={{ alignSelf: 'flex-start' }} onClick={e => { e.stopPropagation(); handleAddReservationEventToSchedule({ type: 'transit-event', reservationId: t.reservationId, segmentIndex: t.segmentIndex, event: 'arrival', time: t.arrivalTime }); }}>
                                <Plus size={10} /> Add Arrival to Day Schedule
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="card-actions-stack card-actions-stack--pinned" onClick={e => e.stopPropagation()}>
                        <button type="button" className="mini-icon-btn" onClick={() => setExpandedTransitId(isExpanded ? null : t.id)} data-tooltip={isExpanded ? 'Collapse' : 'Expand'}>
                          <ChevronDown size={14} className={`expand-chevron${isExpanded ? ' is-open' : ''}`} />
                        </button>
                        <div className="card-options-menu">
                          <button
                            className="mini-icon-btn"
                            onClick={() => setOpenTransportMenuId(prev => prev === t.id ? null : t.id)}
                            data-tooltip="Options"
                          >
                            <MoreVertical size={14} />
                          </button>
                          {openTransportMenuId === t.id && (
                            <div className="dropdown-menu dropdown-menu--right">
                              <button className="dropdown-item" onClick={() => { navigator.clipboard.writeText(t.departureLocationName); setOpenTransportMenuId(null); }}>
                                <Copy size={13} /> Copy Departure Location
                              </button>
                              {t.departureAddress && (
                                <button className="dropdown-item" onClick={() => { navigator.clipboard.writeText(t.departureAddress!); setOpenTransportMenuId(null); }}>
                                  <Copy size={13} /> Copy Departure Address
                                </button>
                              )}
                              <button className="dropdown-item" onClick={() => { navigator.clipboard.writeText(t.arrivalLocationName); setOpenTransportMenuId(null); }}>
                                <Copy size={13} /> Copy Arrival Location
                              </button>
                              {t.arrivalAddress && (
                                <button className="dropdown-item" onClick={() => { navigator.clipboard.writeText(t.arrivalAddress!); setOpenTransportMenuId(null); }}>
                                  <Copy size={13} /> Copy Arrival Address
                                </button>
                              )}
                              {trip.canEdit !== false && <>
                                <button className="dropdown-item" onClick={() => {
                                  const reservation = activePlan.transports.find(r => r.id === t.reservationId);
                                  if (reservation) handleOpenEditTransport(reservation, t.segmentIndex);
                                  setOpenTransportMenuId(null);
                                }}>
                                  <Edit2 size={13} /> Edit
                                </button>
                                <button className="dropdown-item danger" onClick={() => { handleDeleteTransportation(t.reservationId, t.segmentIndex); setOpenTransportMenuId(null); }}>
                                  <Trash2 size={13} /> Delete
                                </button>
                              </>}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expandable details — above notes */}
                    <div className={`card-expandable-wrapper${isExpanded ? ' is-expanded' : ''}`}>
                      <div>
                        <div className="card-expanded-inner">
                          <div className="reservation-card-field-row">
                            {t.confirmationNo && (
                              <>
                                <Hash size={12} />
                                <span className="place-desc-text">{t.confirmationNo}</span>
                              </>
                            )}
                            <span className={`reservation-status-text-badge reservation-status-badge--${(t.status || 'Planning').toLowerCase()}`}>
                              {t.status || 'Planning'}
                            </span>
                          </div>
                          <a
                            href={buildTransitMapsLink(t.departureLocationName, t.departureAddress)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="place-desc-text"
                            style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', margin: 0, color: 'inherit', textDecoration: 'none' }}
                            onClick={e => e.stopPropagation()}
                          >
                            <ArrowUpRight size={12} className="transport-flag-icon" style={{ flexShrink: 0, marginTop: '2px' }} /> Departure: {t.departureAddress || t.departureLocationName}
                          </a>
                          <a
                            href={buildTransitMapsLink(t.arrivalLocationName, t.arrivalAddress)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="place-desc-text"
                            style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', margin: 0, color: 'inherit', textDecoration: 'none' }}
                            onClick={e => e.stopPropagation()}
                          >
                            <ArrowDownLeft size={12} className="transport-flag-icon" style={{ flexShrink: 0, marginTop: '2px' }} /> Arrival: {t.arrivalAddress || t.arrivalLocationName}
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Notes — always visible */}
                    <InlineNotes
                      value={t.notes}
                      canEdit={trip.canEdit !== false}
                      layout="compact"
                      onSave={(text) => handleSaveTransportNotes(t.reservationId, text)}
                      reserveActionSpace
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Attractions & Dining Reservations */}
          <div className="timeline-section">
            <div className="timeline-section-header">
              <div className="timeline-section-title-row">
                <h4 className="timeline-section-title"><Landmark size={16} /> Reservations</h4>
              </div>
              <div className="timeline-section-actions">
                {trip.canEdit !== false && (
                  <button
                    className="mini-icon-btn flex-align timeline-add-btn--danger"
                    onClick={() => onOpenAddPlaceReservation && onOpenAddPlaceReservation('attraction')}
                  >
                    <Plus size={14} /> Add Reservation
                  </button>
                )}
              </div>
            </div>

            {(() => {
              const dayPlaceReservations = (activePlan.placeReservations || []).filter(pr => pr.date === activeDayStr);
              if (dayPlaceReservations.length === 0) {
                return <p className="no-transport-text" style={{ margin: '0 0 10px 0' }}>No reservations booked.</p>;
              }
              return (
                <div className="section-item-list">
                  {dayPlaceReservations.map(pr => {
                    const expandedResId = pr.type === 'dining' ? expandedDiningReservationId : expandedAttractionReservationId;
                    const setExpandedResId = pr.type === 'dining' ? setExpandedDiningReservationId : setExpandedAttractionReservationId;
                    const isExpanded = expandedResId === pr.id;
                    const isDeletedPlace = isPlaceReservationUnlinkedOrDeleted(pr.placeId, trip);
                    const iconColor = pr.type === 'attraction' ? '#ef4444' : '#3b82f6';
                    const IconComp = pr.type === 'attraction' ? Landmark : Utensils;
                    const isInSchedule = isPlaceReservationEventInSchedule(pr.id);
                    const linkedPlace = pr.placeId ? trip.locations.flatMap(l => l.places || []).find(p => p.id === pr.placeId) : undefined;
                    const addressText = linkedPlace ? linkedPlace.title : pr.address;
                    const dayMapUrl = linkedPlace
                      ? (linkedPlace.mapsLink || buildMapsLink(linkedPlace.title, linkedPlace.lat, linkedPlace.lng))
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pr.address ? `${pr.title} ${pr.address}` : pr.title)}`;

                    return (
                      <div key={pr.id} className={`transport-card transport-card--${pr.type === 'attraction' ? 'attraction' : 'dining'}${isExpanded ? ' reservation-card--expanded' : ''}${openPlaceReservationMenuId === pr.id ? ' dropdown-active' : ''}`}>
                        <div className="transport-card-body" onClick={() => setExpandedResId && setExpandedResId(isExpanded ? null : pr.id)}>
                          <div className="schedule-thumb-col" onClick={e => e.stopPropagation()}>
                            <div className="transport-icon-wrapper" style={{ color: iconColor, background: 'rgba(255,255,255,0.03)' }}>
                              <IconComp size={16} />
                            </div>
                            <a href={dayMapUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary timeline-place-map-link">Map</a>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="place-title-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <h4 className="place-title-text">{pr.title}</h4>
                              <span className={`reservation-status-badge reservation-status-badge--${(pr.status || 'Planning').toLowerCase()}`} data-tooltip={pr.status || 'Planning'}>
                                {renderStatusIcon(pr.status)}
                              </span>
                            </div>
                            <p className="place-desc-text"><Calendar size={11} /> {formatCardDate(pr.date || activeDayStr, pr.time)}</p>
                            {/* Prominent warning badge outside collapsed area */}
                            {isDeletedPlace && (
                              <div className="reservation-warning" style={{ marginTop: '2px', marginBottom: '2px', display: 'inline-flex' }}>
                                <AlertTriangle size={11} style={{ flexShrink: 0 }} /> Linked place deleted
                              </div>
                            )}
                            {trip.canEdit !== false && !isInSchedule && (
                              <div className="reservation-add-to-schedule-row" onClick={e => e.stopPropagation()}>
                                <button
                                  className="btn-secondary reservation-add-to-schedule-btn"
                                  onClick={() => handleAddReservationEventToSchedule({ type: 'place-reservation-event', reservationId: pr.id, time: pr.time })}
                                >
                                  <Plus size={10} /> Add to Day Schedule
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="card-actions-stack card-actions-stack--pinned" onClick={e => e.stopPropagation()}>
                            <button type="button" className="mini-icon-btn" onClick={() => setExpandedResId && setExpandedResId(isExpanded ? null : pr.id)} data-tooltip={isExpanded ? 'Collapse' : 'Expand'}>
                              <ChevronDown size={14} className={`expand-chevron${isExpanded ? ' is-open' : ''}`} />
                            </button>
                            <div className="card-options-menu">
                              <button
                                className="mini-icon-btn"
                                onClick={() => setOpenPlaceReservationMenuId(prev => prev === pr.id ? null : pr.id)}
                                data-tooltip="Options"
                              >
                                <MoreVertical size={14} />
                              </button>
                              {openPlaceReservationMenuId === pr.id && (
                                <div className="dropdown-menu dropdown-menu--right">
                                  <button className="dropdown-item" onClick={() => { navigator.clipboard.writeText(pr.title); setOpenPlaceReservationMenuId(null); }}>
                                    <Copy size={13} /> Copy Name
                                  </button>
                                  {pr.address && (
                                    <button className="dropdown-item" onClick={() => { navigator.clipboard.writeText(pr.address!); setOpenPlaceReservationMenuId(null); }}>
                                      <Copy size={13} /> Copy Address
                                    </button>
                                  )}
                                  {trip.canEdit !== false && <>
                                    <button className="dropdown-item" onClick={() => { if (onOpenEditPlaceReservation) onOpenEditPlaceReservation(pr); setOpenPlaceReservationMenuId(null); }}>
                                      <Edit2 size={13} /> Edit
                                    </button>
                                    <button className="dropdown-item danger" onClick={() => { if (onDeletePlaceReservation) onDeletePlaceReservation(pr.id); setOpenPlaceReservationMenuId(null); }}>
                                      <Trash2 size={13} /> Delete
                                    </button>
                                  </>}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expandable details — above notes */}
                        <div className={`card-expandable-wrapper${isExpanded ? ' is-expanded' : ''}`}>
                          <div>
                            <div className="card-expanded-inner">
                              {addressText && (
                                <a
                                  href={dayMapUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="place-desc-text"
                                  style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', margin: 0, color: 'inherit', textDecoration: 'none' }}
                                  onClick={e => e.stopPropagation()}
                                >
                                  <MapPin size={12} style={{ flexShrink: 0, marginTop: '2px' }} /> {addressText}
                                </a>
                              )}
                              <div className="reservation-card-field-row">
                                {pr.confirmationNo && (
                                  <>
                                    <Hash size={12} />
                                    <span className="place-desc-text">{pr.confirmationNo}</span>
                                  </>
                                )}
                                <span className={`reservation-status-text-badge reservation-status-badge--${(pr.status || 'Planning').toLowerCase()}`}>
                                  {pr.status || 'Planning'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Notes — always visible */}
                        <InlineNotes
                          value={pr.notes}
                          canEdit={trip.canEdit !== false}
                          layout="compact"
                          onSave={(text) => handleSavePlaceReservationNotes(pr.id, text)}
                          reserveActionSpace
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* AI Day Assistant (Daily Tips & Baby Logistics) */}
          <div className="timeline-section">
            <div className="timeline-section-header ai-day-assistant-header">
              <div className="timeline-section-title-row">
                <h4 className="timeline-section-title">
                  <Sparkles size={16} className="text-accent" />
                  AI Day Assistant
                </h4>
              </div>
              
              <div className="timeline-section-actions">
                {(() => {
                  const isDailyTipsEnabled = !trip.disabledDayFields?.includes('daily_tips');
                  const isSuggestedReservationsEnabled = !trip.disabledDayFields?.includes('suggested_reservations');
                  const isBabyLogisticsEnabled = !trip.disabledDayFields?.includes('baby_logistics');
                  const isAnyDayFieldEnabled = isDailyTipsEnabled || isSuggestedReservationsEnabled || isBabyLogisticsEnabled;
                  const hasExistingContent = !!(activeDay?.aiDetails?.daily_tips || activeDay?.aiDetails?.suggested_reservations || activeDay?.aiDetails?.baby_logistics);
                  return (
                    <>
                      {trip.canEdit !== false && (
                        <button
                          className="mini-icon-btn flex-align ai-insights-btn"
                          onClick={() => {
                            if (isAnyDayFieldEnabled) {
                              handleGenerateSingleDayTips(activeDayStr);
                            }
                          }}
                          disabled={daysGeneratingDates.has(activeDayStr) || !isAnyDayFieldEnabled}
                          data-tooltip={!isAnyDayFieldEnabled ? 'Enable at least one day-level AI field in Settings first' : (hasExistingContent ? 'Regenerate Tips' : 'Generate Tips')}
                        >
                          {daysGeneratingDates.has(activeDayStr) ? <RefreshCw size={14} className="spin" /> : <Sparkles size={14} />}
                          {hasExistingContent ? 'Regenerate Tips' : 'Generate Tips'}
                        </button>
                      )}
                      {trip.canEdit !== false && (
                        <button
                          className="mini-icon-btn flex-align ai-generate-btn"
                          onClick={() => {
                            if (isAnyDayFieldEnabled) {
                              setShowAiGenerateDaysModal(true);
                            }
                          }}
                          disabled={!isAnyDayFieldEnabled}
                          data-tooltip={!isAnyDayFieldEnabled ? 'Enable at least one day-level AI field in Settings first' : 'Batch Generate Tips'}
                        >
                          <Sparkles size={14} /> Batch Generate Tips
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="glass-panel ai-day-assistant-card">
              {(() => {
                const isDailyTipsEnabled = !trip.disabledDayFields?.includes('daily_tips');
                const isSuggestedReservationsEnabled = !trip.disabledDayFields?.includes('suggested_reservations');
                const isBabyLogisticsEnabled = !trip.disabledDayFields?.includes('baby_logistics');
                const isAnyDayFieldEnabled = isDailyTipsEnabled || isSuggestedReservationsEnabled || isBabyLogisticsEnabled;

                const hasDailyTips = isDailyTipsEnabled && !!activeDay?.aiDetails?.daily_tips;
                const hasSuggestedReservations = isSuggestedReservationsEnabled && !!activeDay?.aiDetails?.suggested_reservations;
                const hasBabyLogistics = isBabyLogisticsEnabled && !!activeDay?.aiDetails?.baby_logistics;
                const hasAnyContent = hasDailyTips || hasSuggestedReservations || hasBabyLogistics;

                return daysGeneratingDates.has(activeDayStr) ? (
                  <FunGeneratingLoader message="Asking Gemini to design daily tips & route logistics..." />
                ) : hasAnyContent ? (
                  <div className="day-ai-content-col">

                    {/* Daily Tips */}
                    {hasDailyTips && (
                      <AiMarkdownSection
                        content={activeDay!.aiDetails!.daily_tips!}
                        updatedAt={activeDay?.aiUpdatedAt}
                        onSave={(newVal) => handleSaveDayTips(activeDayStr, newVal)}
                        canEdit={trip.canEdit !== false}
                      />
                    )}

                    {/* Suggested Reservations */}
                    {hasSuggestedReservations && (
                      <div className={hasDailyTips ? 'day-ai-section-divider' : undefined}>
                        <AiMarkdownSection
                          content={activeDay!.aiDetails!.suggested_reservations!}
                          onSave={(newVal) => handleSaveSuggestedReservations(activeDayStr, newVal)}
                          canEdit={trip.canEdit !== false}
                          title={<span className="suggested-reservations-title">Suggested Reservations</span>}
                        />
                      </div>
                    )}

                    {/* Baby Logistics (if enabled and generated) */}
                    {hasBabyLogistics && (
                      <div className={hasDailyTips || hasSuggestedReservations ? 'day-ai-section-divider' : undefined}>
                        <AiMarkdownSection
                          content={activeDay!.aiDetails!.baby_logistics!}
                          onSave={(newVal) => handleSaveBabyLogistics(activeDayStr, newVal)}
                          canEdit={trip.canEdit !== false}
                          title={
                            <span className="baby-logistics-title">
                              👶 Baby Logistics
                            </span>
                          }
                        />
                      </div>
                    )}

                  </div>
                ) : (
                  <div className="day-no-tips">
                    <span className="day-no-tips-text">
                      {!isAnyDayFieldEnabled
                        ? 'All day-level AI fields are disabled in Trip Settings.'
                        : 'No daily tips generated for this day yet.'}
                    </span>
                    {trip.canEdit !== false && isAnyDayFieldEnabled && (
                      <button
                        className="btn-secondary flex-align day-generate-btn"
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
                    className="mini-icon-btn flex-align ai-insights-btn"
                    onClick={() => {
                      setAiGeneratePlaces(scheduledPlaces);
                      setAiGenerateCity(activeDayLocation?.city || '');
                      setAiGenerateCountry(activeDayLocation?.country || '');
                      setShowAiGenerateModal(true);
                    }}
                    data-tooltip="AI Travel Guide for Places"
                    disabled={scheduledPlaces.length === 0}
                  >
                    <Sparkles size={14} /> AI Insights
                  </button>

                  <button
                    className="mini-icon-btn flex-align ai-generate-btn"
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
                  >
                    <Plus size={14} /> Add Place
                  </button>

                  <div className="day-options-dropdown-container">
                    <button
                      className="mini-icon-btn"
                      onClick={() => setShowDayOptionsMenu(!showDayOptionsMenu)}
                      data-tooltip="Day Options"
                    >
                      <MoreVertical size={14} />
                    </button>
                    {showDayOptionsMenu && (
                      <div className="dropdown-menu">
                        {dayOptionsSubMenu ? (
                          <>
                            <button className="dropdown-item" style={{ opacity: 0.6, pointerEvents: 'none', fontSize: '11px' }}>
                              {dayOptionsSubMenu === 'hotel' ? <><Building size={12} /> Hotel Events</> : <><Plane size={12} /> Transit Events</>}
                            </button>
                            <button className="dropdown-item" onClick={() => setDayOptionsSubMenu(null)}>← Back</button>
                            {dayOptionsSubMenu === 'hotel' && activePlan.hotels.filter(h => h.status !== 'Canceled' && (h.checkInDate === activeDayStr || h.checkOutDate === activeDayStr)).map(h => (
                              <React.Fragment key={h.id}>
                                {h.checkInDate === activeDayStr && !isHotelEventInSchedule(h.id, 'check-in') && (
                                  <button className="dropdown-item" onClick={() => {
                                    handleAddReservationEventToSchedule({ type: 'hotel-event', hotelId: h.id, event: 'check-in', time: h.checkInTime });
                                    setShowDayOptionsMenu(false); setDayOptionsSubMenu(null);
                                  }}>
                                    <Building size={12} /> {h.name} — Check-in
                                  </button>
                                )}
                                {h.checkOutDate === activeDayStr && !isHotelEventInSchedule(h.id, 'check-out') && (
                                  <button className="dropdown-item" onClick={() => {
                                    handleAddReservationEventToSchedule({ type: 'hotel-event', hotelId: h.id, event: 'check-out', time: h.checkOutTime });
                                    setShowDayOptionsMenu(false); setDayOptionsSubMenu(null);
                                  }}>
                                    <Building size={12} /> {h.name} — Check-out
                                  </button>
                                )}
                              </React.Fragment>
                            ))}
                            {dayOptionsSubMenu === 'transit' && flattenReservations(activePlan.transports.filter(t => t.status !== 'Canceled')).filter(t => t.departureDate === activeDayStr || t.arrivalDate === activeDayStr).map(t => (
                              <React.Fragment key={`${t.reservationId}-${t.segmentIndex}`}>
                                {t.departureDate === activeDayStr && !isTransitEventInSchedule(t.reservationId, t.segmentIndex, 'departure') && (
                                  <button className="dropdown-item" onClick={() => {
                                    handleAddReservationEventToSchedule({ type: 'transit-event', reservationId: t.reservationId, segmentIndex: t.segmentIndex, event: 'departure', time: t.departureTime });
                                    setShowDayOptionsMenu(false); setDayOptionsSubMenu(null);
                                  }}>
                                    {getTransitIcon(t.type, 12)} {t.reservationName || t.departureLocationName} — Departure
                                  </button>
                                )}
                                {t.arrivalDate === activeDayStr && !isTransitEventInSchedule(t.reservationId, t.segmentIndex, 'arrival') && (
                                  <button className="dropdown-item" onClick={() => {
                                    handleAddReservationEventToSchedule({ type: 'transit-event', reservationId: t.reservationId, segmentIndex: t.segmentIndex, event: 'arrival', time: t.arrivalTime });
                                    setShowDayOptionsMenu(false); setDayOptionsSubMenu(null);
                                  }}>
                                    {getTransitIcon(t.type, 12)} {t.reservationName || t.arrivalLocationName} — Arrival
                                  </button>
                                )}
                              </React.Fragment>
                            ))}
                          </>
                        ) : (
                          <>
                            <button
                              className="dropdown-item"
                              onClick={() => {
                                handleAddScheduleNote(scheduleItems.length, '');
                                setEditingNoteItemIndex(scheduleItems.length);
                                setShowDayOptionsMenu(false);
                              }}
                            >
                              <FileText size={12} /> Add Note
                            </button>
                            {activePlan.hotels.filter(h => h.status !== 'Canceled' && (h.checkInDate === activeDayStr || h.checkOutDate === activeDayStr)).length > 0 && (
                              <button className="dropdown-item" onClick={e => { e.stopPropagation(); setDayOptionsSubMenu('hotel'); }}>
                                <Building size={12} /> Add Hotel Event →
                              </button>
                            )}
                            {flattenReservations(activePlan.transports.filter(t => t.status !== 'Canceled')).filter(t => t.departureDate === activeDayStr || t.arrivalDate === activeDayStr).length > 0 && (
                              <button className="dropdown-item" onClick={e => { e.stopPropagation(); setDayOptionsSubMenu('transit'); }}>
                                <Plane size={12} /> Add Transit Event →
                              </button>
                            )}
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
                              className="dropdown-item"
                              onClick={() => {
                                setShowSwapDaysModal(true);
                                setShowDayOptionsMenu(false);
                              }}
                            >
                              <ArrowUpDown size={12} /> Swap Days
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
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Smart Place search suggestions input */}
            {activeDayLocation && trip.canEdit !== false ? (
              <div ref={searchDropdownRef} className="place-search-wrapper">
                <div className="place-search-inner">
                  <Search size={14} className="place-search-icon" />
                  <input
                    type="text"
                    placeholder="Type to search, or paste a Google Maps link..."
                    value={placeQuery}
                    onChange={(e) => setPlaceQuery(e.target.value)}
                    className="place-search-input-padded"
                  />
                  {isSearchingPlace && (
                    <div className="place-search-loading">Loading...</div>
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
              <div className="no-location-text">
                Please select a Location above for this day to enable place searching.
              </div>
            )}

            <div
              className="day-timeline day-timeline-wrap"
              onDragOver={(e) => {
                if (draggedPlaceId || draggedDayPlaceIndex !== null) {
                  e.preventDefault();
                }
              }}
              onDragLeave={() => setDragOverDayPlaceIndex(null)}
              onDrop={() => {
                if (draggedPlaceId) {
                  handleCatalogPlaceDropOnTimeline(draggedPlaceId, scheduleItems.length, 'top');
                } else if (draggedDayPlaceIndex !== null) {
                  handleDayPlaceDrop(scheduleItems.length - 1, 'bottom');
                }
              }}
            >
              {/* Preview place (not yet scheduled, shown as expanded preview card at top) */}
              {(() => {
                const previewPlace = (displayScheduledPlaces[0] as any)?.isTemporary ? displayScheduledPlaces[0] : null;
                if (!previewPlace) return null;
                const isAiSuggestion = !!(previewPlace as any).isAiSuggestion;
                const dotColor = isAiSuggestion ? '#a78bfa' : ((trip.placeGroups || DEFAULT_PLACE_GROUPS).find(g => g.id === previewPlace.placeGroupId)?.color || '#6b7280');
                return (
                  <div className="timeline-card glass-panel timeline-card-preview" data-place-id={previewPlace.id}>
                    <div className="timeline-dot" style={{ backgroundColor: dotColor }}>
                      {isAiSuggestion ? <Sparkles size={12} style={{ color: '#ffffff' }} /> : getCategoryIconComponent((trip.placeGroups || DEFAULT_PLACE_GROUPS).find(g => g.id === previewPlace.placeGroupId)?.icon || 'map-pin', 12, undefined, { color: '#ffffff' })}
                    </div>
                    {/* Header row */}
                    <div className="card-header-row">
                      <div className="timeline-card-content" style={{ cursor: 'default' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: isAiSuggestion ? 'rgba(167, 139, 250, 0.2)' : 'rgba(99, 102, 241, 0.2)', color: isAiSuggestion ? '#c4b5fd' : '#a5b4fc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
                          {isAiSuggestion ? <Sparkles size={12} /> : 'P'}
                        </div>
                        <div className="schedule-thumb-col">
                          {previewPlace.photoUrl ? (
                            <div className="place-card-thumb-container"><img src={getOptimizedImageUrl(previewPlace.photoUrl, 80)} alt="" loading="lazy" decoding="async" /></div>
                          ) : (
                            <div className="place-card-thumb-container"><MapPin size={16} className="text-muted" /></div>
                          )}
                          <a href={previewPlace.mapsLink || buildMapsLink(previewPlace.title, previewPlace.lat, previewPlace.lng, activeDayLocation?.city || catalogLocation?.city)} target="_blank" rel="noopener noreferrer" className="btn-secondary timeline-place-map-link" onClick={(e) => e.stopPropagation()}>Map</a>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="preview-place-title-row">
                            <h4 className="place-title-text">{previewPlace.title}</h4>
                            <span className="preview-badge" style={isAiSuggestion ? { background: 'rgba(167,139,250,0.15)', color: '#c4b5fd', borderColor: 'rgba(167,139,250,0.3)' } : undefined}>
                              {isAiSuggestion ? 'AI Suggestion' : 'Preview'}
                            </span>
                          </div>
                          {previewPlace.openingHours && (
                            <p className="preview-hours-text">{previewPlace.openingHours}</p>
                          )}
                        </div>
                      </div>
                      {trip.canEdit !== false && (
                        <div className="day-place-actions-temporary" onClick={e => e.stopPropagation()}>
                          {isAiSuggestion ? (
                            <>
                              <button className="mini-icon-btn preview-add-to-catalog" onClick={() => handleAddAiSuggestionToCatalog(previewPlace)} data-tooltip="Add to Catalog"><BookmarkPlus size={14} /></button>
                              <button className="mini-icon-btn preview-add-to-day" onClick={() => handleAddPlaceToDay(previewPlace)} data-tooltip="Keep / Add to Day"><Plus size={14} /></button>
                            </>
                          ) : (
                            <button className="mini-icon-btn preview-add-to-day" onClick={() => handleAddPlaceToDay(previewPlace)} data-tooltip="Keep / Add to Day"><Plus size={14} /></button>
                          )}
                          <button className="mini-icon-btn preview-remove" onClick={() => setActivePlaceId(undefined)} data-tooltip="Remove Preview"><X size={14} /></button>
                        </div>
                      )}
                    </div>
                    {/* Always-expanded details */}
                    <div className="card-expanded-section" onClick={e => e.stopPropagation()}>
                      {previewPlace.description && (
                        <p className="preview-desc-text">{previewPlace.description}</p>
                      )}
                      {isAiSuggestion ? (
                        previewPlace.notes && (
                          <div className="preview-ai-notes">
                            {previewPlace.notes}
                          </div>
                        )
                      ) : (
                        <AiDetailsView
                          place={previewPlace}
                          onGenerate={() => handleGenerateSinglePlaceAiDetails(previewPlace.id)}
                          canEdit={trip.canEdit !== false}
                          isGenerating={placeGeneratingIds.has(previewPlace.id)}
                          layoutMode="adaptive-2-col"
                          customAiFields={trip.customAiFields}
                          disabledPlaceFields={trip.disabledPlaceFields}
                          fieldIcons={trip.fieldIcons}
                          placeFieldsOrder={trip.placeFieldsOrder}
                        />
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Unified schedule items (places + notes) */}
              {(() => {
                const canEdit = trip.canEdit !== false;
                let placeCount = 0;
                return (
                  <>
                    {scheduleItems.map((item, idx) => {
                      // Merge info: a place-reservation-event and its linked place adjacent to
                      // each other render as one seamless unit and reorder together.
                      const partner = mergePartners[idx];
                      const isMergedTop = partner !== -1 && partner === idx + 1;
                      const isMergedBottom = partner !== -1 && partner === idx - 1;
                      const isFirst = idx === 0;
                      const isLast = idx === scheduleItems.length - 1;
                      const addSlot = renderAddSlot(idx, canEdit);

                      // The bottom half of a merged pair is rendered together with its top half
                      // (its place number is already assigned there), so skip it entirely here.
                      if (isMergedBottom) return null;

                      // A merged pair renders as one seamless cell: both halves inside a single
                      // container (one flex child, so no negative margins) with a borderless seam.
                      if (isMergedTop) {
                        const bottomIdx = idx + 1;
                        const bottomItem = scheduleItems[bottomIdx];
                        const unitFirst = idx === 0;
                        const unitLast = bottomIdx === scheduleItems.length - 1;
                        // Linked place id shared by both halves (for the reservation half's click-to-expand).
                        const unitPlaceId = item.type === 'place'
                          ? (item as SchedulePlaceItem).placeId
                          : bottomItem.type === 'place' ? (bottomItem as SchedulePlaceItem).placeId : undefined;
                        const mergeActive = !!unitPlaceId && activePlaceId === unitPlaceId;
                        const mergeHover = hoveredScheduleItemIndex !== null && sameMergeUnit(idx, hoveredScheduleItemIndex);
                        const stateClass = (mergeActive ? ' timeline-card--merge-active' : '') + (mergeHover ? ' timeline-card--merge-hover' : '');
                        const findPlace = (placeId: string) => {
                          for (const loc of trip.locations) {
                            const found = loc.places.find(p => p.id === placeId);
                            if (found) return found;
                          }
                          return undefined;
                        };
                        const renderHalf = (halfItem: ScheduleItem, halfIdx: number, edgeClass: string) => {
                          if (halfItem.type === 'place-reservation-event') {
                            return renderPlaceReservationEventCard(halfItem as SchedulePlaceReservationEventItem, halfIdx, unitFirst, unitLast, canEdit, edgeClass + stateClass, unitPlaceId);
                          }
                          const pl = findPlace((halfItem as SchedulePlaceItem).placeId);
                          if (!pl) return null;
                          const num = ++placeCount;
                          return renderScheduledPlaceCard(pl, num, halfIdx, unitFirst, unitLast, canEdit, edgeClass + stateClass);
                        };
                        const dragIndicator = (di: number) => dragOverDayPlaceIndex === di && (
                          <div style={{ position: 'absolute', top: dragOverDayPlacePosition === 'top' ? '-10px' : 'auto', bottom: dragOverDayPlacePosition === 'bottom' ? '-10px' : 'auto', left: 0, right: 0, height: '4px', background: 'var(--accent-primary)', borderRadius: '2px', boxShadow: '0 0 8px var(--accent-primary)', zIndex: 10, pointerEvents: 'none' }} />
                        );
                        return (
                          <React.Fragment key={`merge-${idx}`}>
                            {addSlot}
                            <div
                              className="schedule-merged-cell"
                              onMouseEnter={() => { cancelHideItem(); setHoveredScheduleItemIndex(idx); }}
                              onMouseLeave={scheduleHideItem}
                            >
                              <div style={{ position: 'relative' }}>
                                {dragIndicator(idx)}
                                {renderHalf(item, idx, ' timeline-card--merged-top')}
                              </div>
                              <div style={{ position: 'relative' }}>
                                {dragIndicator(bottomIdx)}
                                {renderHalf(bottomItem, bottomIdx, ' timeline-card--merged-bottom')}
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      }

                      if (item.type === 'note') {
                        const note = item as ScheduleNoteItem;
                        return (
                          <React.Fragment key={`note-${note.id}`}>
                            {renderAddSlot(idx, canEdit)}
                            <div
                              style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}
                              onMouseEnter={() => { cancelHideItem(); setHoveredScheduleItemIndex(idx); }}
                              onMouseLeave={scheduleHideItem}
                            >
                              {dragOverDayPlaceIndex === idx && (
                                <div style={{ position: 'absolute', top: dragOverDayPlacePosition === 'top' ? '-10px' : 'auto', bottom: dragOverDayPlacePosition === 'bottom' ? '-10px' : 'auto', left: 0, right: 0, height: '4px', background: 'var(--accent-primary)', borderRadius: '2px', boxShadow: '0 0 8px var(--accent-primary)', zIndex: 10, pointerEvents: 'none' }} />
                              )}
                              {renderNoteCard(note, idx, isFirst, isLast, canEdit)}
                            </div>
                          </React.Fragment>
                        );
                      }

                      if (item.type === 'hotel-event') {
                        const hotelItem = item as ScheduleHotelEventItem;
                        return (
                          <React.Fragment key={`hotel-event-${hotelItem.hotelId}-${hotelItem.event}-${idx}`}>
                            {renderAddSlot(idx, canEdit)}
                            <div
                              style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}
                              onMouseEnter={() => { cancelHideItem(); setHoveredScheduleItemIndex(idx); }}
                              onMouseLeave={scheduleHideItem}
                            >
                              {dragOverDayPlaceIndex === idx && (
                                <div style={{ position: 'absolute', top: dragOverDayPlacePosition === 'top' ? '-10px' : 'auto', bottom: dragOverDayPlacePosition === 'bottom' ? '-10px' : 'auto', left: 0, right: 0, height: '4px', background: 'var(--accent-primary)', borderRadius: '2px', boxShadow: '0 0 8px var(--accent-primary)', zIndex: 10, pointerEvents: 'none' }} />
                              )}
                              {renderHotelEventCard(hotelItem, idx, isFirst, isLast, canEdit)}
                            </div>
                          </React.Fragment>
                        );
                      }

                      if (item.type === 'transit-event') {
                        const transitItem = item as ScheduleTransitEventItem;
                        return (
                          <React.Fragment key={`transit-event-${transitItem.reservationId}-${transitItem.segmentIndex}-${transitItem.event}-${idx}`}>
                            {renderAddSlot(idx, canEdit)}
                            <div
                              style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}
                              onMouseEnter={() => { cancelHideItem(); setHoveredScheduleItemIndex(idx); }}
                              onMouseLeave={scheduleHideItem}
                            >
                              {dragOverDayPlaceIndex === idx && (
                                <div style={{ position: 'absolute', top: dragOverDayPlacePosition === 'top' ? '-10px' : 'auto', bottom: dragOverDayPlacePosition === 'bottom' ? '-10px' : 'auto', left: 0, right: 0, height: '4px', background: 'var(--accent-primary)', borderRadius: '2px', boxShadow: '0 0 8px var(--accent-primary)', zIndex: 10, pointerEvents: 'none' }} />
                              )}
                              {renderTransitEventCard(transitItem, idx, isFirst, isLast, canEdit)}
                            </div>
                          </React.Fragment>
                        );
                      }

                      if (item.type === 'place-reservation-event') {
                        const placeResItem = item as SchedulePlaceReservationEventItem;
                        return (
                          <React.Fragment key={`place-reservation-event-${placeResItem.reservationId}-${idx}`}>
                            {addSlot}
                            <div
                              style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}
                              onMouseEnter={() => { cancelHideItem(); setHoveredScheduleItemIndex(idx); }}
                              onMouseLeave={scheduleHideItem}
                            >
                              {dragOverDayPlaceIndex === idx && (
                                <div style={{ position: 'absolute', top: dragOverDayPlacePosition === 'top' ? '-10px' : 'auto', bottom: dragOverDayPlacePosition === 'bottom' ? '-10px' : 'auto', left: 0, right: 0, height: '4px', background: 'var(--accent-primary)', borderRadius: '2px', boxShadow: '0 0 8px var(--accent-primary)', zIndex: 10, pointerEvents: 'none' }} />
                              )}
                              {renderPlaceReservationEventCard(placeResItem, idx, isFirst, isLast, canEdit)}
                            </div>
                          </React.Fragment>
                        );
                      }

                      // Place item (non-merged)
                      const placeItem = item as SchedulePlaceItem;
                      const placeNumber = ++placeCount;
                      let place: Place | undefined;
                      for (const loc of trip.locations) {
                        const found = loc.places.find(p => p.id === placeItem.placeId);
                        if (found) { place = found; break; }
                      }
                      if (!place) return null;

                      return (
                        <React.Fragment key={`place-${place.id}-${idx}`}>
                          {addSlot}
                          <div
                            style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}
                            onMouseEnter={() => { cancelHideItem(); setHoveredScheduleItemIndex(idx); }}
                            onMouseLeave={scheduleHideItem}
                          >
                            {dragOverDayPlaceIndex === idx && (
                              <div style={{ position: 'absolute', top: dragOverDayPlacePosition === 'top' ? '-10px' : 'auto', bottom: dragOverDayPlacePosition === 'bottom' ? '-10px' : 'auto', left: 0, right: 0, height: '4px', background: 'var(--accent-primary)', borderRadius: '2px', boxShadow: '0 0 8px var(--accent-primary)', zIndex: 10, pointerEvents: 'none' }} />
                            )}
                            {renderScheduledPlaceCard(place, placeNumber, idx, isFirst, isLast, canEdit)}
                          </div>
                        </React.Fragment>
                      );
                    })}
                    {scheduleItems.length > 0 && renderAddSlot(scheduleItems.length, canEdit)}
                  </>
                );
              })()}

              {scheduleItems.length === 0 && !(displayScheduledPlaces[0] as any)?.isTemporary && (
                <p className="empty-timeline-text">
                  Itinerary is empty. Start by searching above or dragging places from the catalog to schedule.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="no-active-day">
          No day plan created yet.
        </div>
      )}

      {/* Time picker portal — rendered outside the card so it doesn't affect card layout */}
      {timePickerState && createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }} onClick={() => setTimePickerState(null)} />
          <div className="event-time-picker-popover" style={{ top: timePickerState.top, left: timePickerState.left }}>
            <input
              type="time"
              className="schedule-event-time-input"
              defaultValue={timePickerState.value}
              autoFocus
              onBlur={e => { handleUpdateScheduleItemTime(timePickerState.itemIdx, e.target.value); setTimePickerState(null); }}
              onKeyDown={e => {
                if (e.key === 'Enter') { handleUpdateScheduleItemTime(timePickerState.itemIdx, (e.target as HTMLInputElement).value); setTimePickerState(null); }
                if (e.key === 'Escape') setTimePickerState(null);
              }}
              onClick={e => e.stopPropagation()}
            />
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

export default memo(ItineraryPanel);
