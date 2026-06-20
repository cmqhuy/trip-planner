import React, { useState, useRef, useEffect, memo } from 'react';
import {
  MapPin, Plus, Trash2, Edit2, Share2, Sparkles, MoreVertical,
  Calendar, Layers, Check, X, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Plane, Train, Bus, Car, Anchor, Navigation, Building, Hash,
  Search, FileText, RefreshCw, ArrowRight, BookmarkPlus,
  ArrowUpRight, ArrowDownLeft, AlertTriangle, Copy
} from 'lucide-react';
import type { Trip, Plan, Location, Place, Hotel, Transportation, ScheduleItem, ScheduleNoteItem, SchedulePlaceItem } from '../types';
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
  handleOpenEditHotel: (hotel: Hotel) => void;
  handleOpenEditTransport: (transport: Transportation) => void;
  handleSaveHotelNotes: (hotelId: string, notes: string) => void;
  handleSaveTransportNotes: (transportId: string, notes: string) => void;
  handleGenerateSingleDayTips: (dateStr: string) => void;
  handleSaveDayTips: (dateStr: string, content: string) => void;
  handleSaveBabyLogistics: (dateStr: string, content: string) => void;
  handleClearDay: () => void;
  handleAddPlaceFromDayTimeline: (place: Omit<Place, 'placeGroupId'>) => void;
  handleDayPlaceDragStart: (index: number) => void;
  handleDayPlaceDrop: (targetIndex: number, position: 'top' | 'bottom') => void;
  handleCatalogPlaceDropOnTimeline: (placeId: string, targetIndex: number, position: 'top' | 'bottom') => void;
  scheduleItems: ScheduleItem[];
  handleMoveScheduleItem: (index: number, direction: 'up' | 'down') => void;
  handleRemovePlaceFromDay: (scheduleIndex: number) => void;
  handleAddScheduleNote: (insertAtIndex: number, text: string) => void;
  handleUpdateScheduleNote: (itemIndex: number, text: string) => void;
  handleDeleteScheduleNote: (itemIndex: number) => void;
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
  handleGenerateSingleDayTips,
  handleSaveDayTips,
  handleSaveBabyLogistics,
  handleClearDay,
  handleAddPlaceFromDayTimeline,
  handleDayPlaceDragStart,
  handleDayPlaceDrop,
  handleCatalogPlaceDropOnTimeline,
  scheduleItems,
  handleMoveScheduleItem,
  handleRemovePlaceFromDay,
  handleAddScheduleNote,
  handleUpdateScheduleNote,
  handleDeleteScheduleNote,
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
}: ItineraryPanelProps) {

  const [editingPlaceNotesId, setEditingPlaceNotesId] = useState<string | null>(null);
  const [localNotes, setLocalNotes] = useState('');
  const [editingHotelNoteId, setEditingHotelNoteId] = useState<string | null>(null);
  const [editingTransitNoteId, setEditingTransitNoteId] = useState<string | null>(null);

  const startEditingNotes = (place: Place) => {
    setEditingPlaceNotesId(place.id);
    setLocalNotes(place.notes || '');
  };

  const [prevEditingId, setPrevEditingId] = useState<string | null>(null);
  if (editingPlaceNotesId !== prevEditingId) {
    setPrevEditingId(editingPlaceNotesId);
    if (editingPlaceNotesId) {
      const placeBeingEdited = trip.locations.flatMap(l => l.places).find(p => p.id === editingPlaceNotesId);
      setLocalNotes(placeBeingEdited?.notes || '');
    } else {
      setLocalNotes('');
    }
  }

  const [hoveredScheduleItemIndex, setHoveredScheduleItemIndex] = useState<number | null>(null);
  const [editingNoteItemIndex, setEditingNoteItemIndex] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [activeAddDropdownIndex, setActiveAddDropdownIndex] = useState<number | null>(null);
  const [isPlanPickerOpen, setIsPlanPickerOpen] = useState(false);
  const [openHotelMenuId, setOpenHotelMenuId] = useState<string | null>(null);
  const [openTransportMenuId, setOpenTransportMenuId] = useState<string | null>(null);
  const [openMapMenuId, setOpenMapMenuId] = useState<string | null>(null);
  const [editingHotelNoteText, setEditingHotelNoteText] = useState('');
  const [editingTransitNoteText, setEditingTransitNoteText] = useState('');

  useEffect(() => {
    if (editingHotelNoteId) {
      const h = activePlan?.hotels.find(h => h.id === editingHotelNoteId);
      setEditingHotelNoteText(h?.notes ?? '');
    }
  }, [editingHotelNoteId, activePlan?.hotels]);

  useEffect(() => {
    if (editingTransitNoteId) {
      const t = activePlan?.transports.find(t => t.id === editingTransitNoteId);
      setEditingTransitNoteText(t?.notes ?? '');
    }
  }, [editingTransitNoteId, activePlan?.transports]);
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

  const renderAddSlot = (insertAtIndex: number, canEdit: boolean) => {
    if (!canEdit) return null;
    const isVisible = hoveredScheduleItemIndex === insertAtIndex || hoveredScheduleItemIndex === insertAtIndex - 1;
    return (
      <div
        className={`schedule-add-slot${isVisible ? ' visible' : ''}`}
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
            <button
              className="dropdown-item"
              onClick={e => {
                e.stopPropagation();
                setActiveAddDropdownIndex(null);
                handleAddScheduleNote(insertAtIndex, '');
                setEditingNoteItemIndex(insertAtIndex);
                setEditingNoteText('');
              }}
            >
              <FileText size={12} /> Add Note
            </button>
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
        draggable={canEdit}
        onDragStart={(e) => {
          handleDayPlaceDragStart(idx);
          if (e.currentTarget) {
            const card = e.currentTarget;
            card.classList.add('is-dragging-ghost');
            setTimeout(() => {
              card.classList.remove('is-dragging-ghost');
            }, 0);
          }
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
            onClick={canEdit && !isEditingThis ? () => { setEditingNoteItemIndex(idx); setEditingNoteText(note.text); } : undefined}
          >
            <div className="flex-1 min-w-0" style={{ paddingTop: '2px' }}>
              {isEditingThis ? (
                <div onClick={e => e.stopPropagation()}>
                  <textarea
                    autoFocus
                    value={editingNoteText}
                    onChange={e => setEditingNoteText(e.target.value)}
                    placeholder="Add a note here..."
                    rows={4}
                    className="note-edit-textarea"
                  />
                  <div className="note-edit-actions">
                    <button className="btn-secondary note-edit-btn" onClick={() => { if (!note.text) handleDeleteScheduleNote(idx); setEditingNoteItemIndex(null); }}>Cancel</button>
                    <button
                      className="btn-primary flex-align note-edit-btn"
                      onClick={() => {
                        if (editingNoteText.trim()) handleUpdateScheduleNote(idx, editingNoteText);
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
                <button className="mini-icon-btn" disabled={isFirst} onClick={() => handleMoveScheduleItem(idx, 'up')} style={{ opacity: isFirst ? 0.3 : 1 }} data-tooltip="Move Up"><ChevronUp size={12} /></button>
                <button className="mini-icon-btn" disabled={isLast} onClick={() => handleMoveScheduleItem(idx, 'down')} style={{ opacity: isLast ? 0.3 : 1 }} data-tooltip="Move Down"><ChevronDown size={12} /></button>
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
                    <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setEditingNoteItemIndex(idx); setEditingNoteText(note.text); setActiveTimelinePlaceDropdownKey(null); }}><Edit2 size={12} /> Edit Note</button>
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
                <button className="dropdown-item" disabled={isFirst} onClick={e => { e.stopPropagation(); handleMoveScheduleItem(idx, 'up'); setActiveTimelinePlaceDropdownKey(null); }} style={{ opacity: isFirst ? 0.3 : 1 }}>
                  <ChevronUp size={12} /> Move Up
                </button>
                <button className="dropdown-item" disabled={isLast} onClick={e => { e.stopPropagation(); handleMoveScheduleItem(idx, 'down'); setActiveTimelinePlaceDropdownKey(null); }} style={{ opacity: isLast ? 0.3 : 1 }}>
                  <ChevronDown size={12} /> Move Down
                </button>
                <button className="dropdown-item" onClick={e => { e.stopPropagation(); setEditingNoteItemIndex(idx); setEditingNoteText(note.text); setActiveTimelinePlaceDropdownKey(null); }}>
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
              <div className="timeline-section-actions">
                {trip.canEdit !== false && (
                  <button className="mini-icon-btn flex-align timeline-add-btn--success" onClick={() => setShowHotelModal(true)}>
                    <Plus size={14} /> Add Hotel
                  </button>
                )}
              </div>
            </div>

            <div className="section-item-list">
              {getHotelsForDay(activeDayStr).map(h => {
                const isExpanded = expandedHotelId === h.id;
                const isEditingNote = editingHotelNoteId === h.id;
                return (
                  <div key={h.id} className={`hotel-card${isExpanded ? ' reservation-card--expanded' : ''}${openHotelMenuId === h.id ? ' dropdown-active' : ''}`}>
                    {/* Clickable header row */}
                    <div className="hotel-card-body" onClick={() => setExpandedHotelId(isExpanded ? null : h.id)}>
                      <div className="schedule-thumb-col" onClick={e => e.stopPropagation()}>
                        <div className="hotel-icon-wrapper">
                          <Building size={16} />
                        </div>
                        {h.address && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary timeline-place-map-link"
                          >Map</a>
                        )}
                      </div>
                      <div className="hotel-text-col" style={{ flex: 1, minWidth: 0 }}>
                        <h4 className="place-title-text">{h.name}</h4>
                        <p className="place-desc-text"><Calendar size={11} /> Check-in: {formatCardDate(h.checkInDate, h.checkInTime)}</p>
                        <p className="place-desc-text"><Calendar size={11} /> Check-out: {formatCardDate(h.checkOutDate, h.checkOutTime)}</p>
                      </div>
                      <div className="hotel-card-right-actions" onClick={e => e.stopPropagation()}>
                        <ChevronDown size={14} className={`expand-chevron${isExpanded ? ' is-open' : ''}`} onClick={() => setExpandedHotelId(isExpanded ? null : h.id)} />
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
                          {h.address && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.address)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="place-desc-text"
                              style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', margin: 0, color: 'inherit', textDecoration: 'none' }}
                              onClick={e => e.stopPropagation()}
                            >
                              <MapPin size={12} style={{ flexShrink: 0, marginTop: '2px' }} /> {h.address}
                            </a>
                          )}
                          {h.confirmationNo && (
                            <p className="place-desc-text" style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', margin: 0 }}>
                              <Hash size={12} style={{ flexShrink: 0, marginTop: '2px' }} /> {h.confirmationNo}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Notes — always visible */}
                    {isEditingNote ? (
                      <div className="notes-edit-wrapper" onClick={e => e.stopPropagation()}>
                        <textarea
                          value={editingHotelNoteText}
                          onChange={e => setEditingHotelNoteText(e.target.value)}
                          placeholder="Add notes..."
                          rows={4}
                          className="notes-textarea"
                        />
                        <div className="notes-actions">
                          <button className="btn-secondary place-notes-btn" onClick={() => setEditingHotelNoteId(null)}>Cancel</button>
                          <button className="btn-primary flex-align place-notes-btn" onClick={() => { handleSaveHotelNotes(h.id, editingHotelNoteText); setEditingHotelNoteId(null); }}>
                            <Check size={10} /> Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="notes-text-wrapper"
                        style={{ marginTop: '0', paddingRight: trip.canEdit !== false ? '22px' : '0', cursor: trip.canEdit !== false ? 'pointer' : undefined }}
                        onClick={trip.canEdit !== false ? (e) => {
                          e.stopPropagation();
                          setEditingHotelNoteId(h.id);
                          setEditingTransitNoteId(null);
                          setEditingHotelNoteText(h.notes || '');
                        } : undefined}
                      >
                        <div className={`notes-text ${h.notes ? 'has-content' : 'no-content'}`}>
                          <FileText size={13} style={{ marginTop: '2px', color: h.notes ? 'var(--accent-primary)' : 'var(--text-muted)', flexShrink: 0 }} />
                          <span>{h.notes || 'Add notes...'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {getHotelsForDay(activeDayStr).length === 0 && (
                <p className="no-transport-text no-transport-text--warning">
                  <AlertTriangle size={12} /> No hotels booked for this day.
                </p>
              )}
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

            <div className="section-item-list">
              {getTransportsForDay(activeDayStr).map(t => {
                const isDeparture = t.departureDate === activeDayStr;
                const isArrival = t.arrivalDate === activeDayStr;
                const isExpanded = expandedTransitId === t.id;
                const isEditingNote = editingTransitNoteId === t.id;
                const transitName = t.name || `${t.departureLocationName} → ${t.arrivalLocationName}`;
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
                              <button className="dropdown-item" onClick={() => { window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.departureAddress || t.departureLocationName)}`, '_blank'); setOpenMapMenuId(null); }}>
                                <ArrowUpRight size={12} /> {t.departureLocationName}
                              </button>
                              <button className="dropdown-item" onClick={() => { window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.arrivalAddress || t.arrivalLocationName)}`, '_blank'); setOpenMapMenuId(null); }}>
                                <ArrowDownLeft size={12} /> {t.arrivalLocationName}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 className="place-title-text">{transitName}</h4>
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
                          </div>
                          <div className="transport-flow" style={{ opacity: isArrival ? 1 : 0.5 }}>
                            <span className="transport-flow-sub">
                              Arrival {isArrival && <ArrowDownLeft size={11} className="transport-flag-icon" />}
                            </span>
                            <span className="transport-flow-main">{t.arrivalLocationName}</span>
                            <span className="transport-time-detail">
                              <Calendar size={11} />{formatCardDate(t.arrivalDate)}{t.arrivalTime ? ` · ${t.arrivalTime}` : ''}{arrTzLabel}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="transport-card-right-actions" onClick={e => e.stopPropagation()}>
                        <ChevronDown size={14} className={`expand-chevron${isExpanded ? ' is-open' : ''}`} onClick={() => setExpandedTransitId(isExpanded ? null : t.id)} />
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
                                <button className="dropdown-item" onClick={() => { handleOpenEditTransport(t); setOpenTransportMenuId(null); }}>
                                  <Edit2 size={13} /> Edit
                                </button>
                                <button className="dropdown-item danger" onClick={() => { handleDeleteTransportation(t.id); setOpenTransportMenuId(null); }}>
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
                          {t.confirmationNo && (
                            <p className="place-desc-text" style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', margin: 0 }}>
                              <Hash size={12} style={{ flexShrink: 0, marginTop: '2px' }} /> {t.confirmationNo}
                            </p>
                          )}
                          {t.departureAddress && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.departureAddress)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="place-desc-text"
                              style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', margin: 0, color: 'inherit', textDecoration: 'none' }}
                              onClick={e => e.stopPropagation()}
                            >
                              <ArrowUpRight size={12} className="transport-flag-icon" style={{ flexShrink: 0, marginTop: '2px' }} /> Departure: {t.departureAddress}
                            </a>
                          )}
                          {t.arrivalAddress && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.arrivalAddress)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="place-desc-text"
                              style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', margin: 0, color: 'inherit', textDecoration: 'none' }}
                              onClick={e => e.stopPropagation()}
                            >
                              <ArrowDownLeft size={12} className="transport-flag-icon" style={{ flexShrink: 0, marginTop: '2px' }} /> Arrival: {t.arrivalAddress}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Notes — always visible */}
                    {isEditingNote ? (
                      <div className="notes-edit-wrapper" onClick={e => e.stopPropagation()}>
                        <textarea
                          value={editingTransitNoteText}
                          onChange={e => setEditingTransitNoteText(e.target.value)}
                          placeholder="Add notes..."
                          rows={4}
                          className="notes-textarea"
                        />
                        <div className="notes-actions">
                          <button className="btn-secondary place-notes-btn" onClick={() => setEditingTransitNoteId(null)}>Cancel</button>
                          <button className="btn-primary flex-align place-notes-btn" onClick={() => { handleSaveTransportNotes(t.id, editingTransitNoteText); setEditingTransitNoteId(null); }}>
                            <Check size={10} /> Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="notes-text-wrapper"
                        style={{ marginTop: '0', paddingRight: trip.canEdit !== false ? '22px' : '0', cursor: trip.canEdit !== false ? 'pointer' : undefined }}
                        onClick={trip.canEdit !== false ? (e) => {
                          e.stopPropagation();
                          setEditingTransitNoteId(t.id);
                          setEditingHotelNoteId(null);
                          setEditingTransitNoteText(t.notes || '');
                        } : undefined}
                      >
                        <div className={`notes-text ${t.notes ? 'has-content' : 'no-content'}`}>
                          <FileText size={13} style={{ marginTop: '2px', color: t.notes ? 'var(--accent-primary)' : 'var(--text-muted)', flexShrink: 0 }} />
                          <span>{t.notes || 'Add notes...'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {getTransportsForDay(activeDayStr).length === 0 && (() => {
                const prevDayStr = daysList[daysList.indexOf(activeDayStr) - 1] ?? null;
                const prevLocId = prevDayStr ? activePlan.days[prevDayStr]?.locationId : null;
                const currLocId = activePlan.days[activeDayStr]?.locationId;
                const prevLoc = prevLocId ? trip.locations.find(l => l.id === prevLocId) : null;
                const currLoc = currLocId ? trip.locations.find(l => l.id === currLocId) : null;
                if (prevLocId && currLocId && prevLocId !== currLocId) {
                  return (
                    <p className="no-transport-text no-transport-text--warning">
                      <AlertTriangle size={12} /> No transit from {prevLoc?.city ?? 'previous location'} to {currLoc?.city ?? 'this location'}.
                    </p>
                  );
                }
                return <p className="no-transport-text">No transit booked.</p>;
              })()}
            </div>
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
                  const isBabyLogisticsEnabled = !trip.disabledDayFields?.includes('baby_logistics');
                  const isAnyDayFieldEnabled = isDailyTipsEnabled || isBabyLogisticsEnabled;
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
                          data-tooltip={!isAnyDayFieldEnabled ? 'Enable Daily Tips or Baby Logistics in Settings first' : (activeDay?.aiDetails?.daily_tips ? 'Regenerate Tips' : 'Generate Tips')}
                        >
                          {daysGeneratingDates.has(activeDayStr) ? <RefreshCw size={14} className="spin" /> : <Sparkles size={14} />}
                          {activeDay?.aiDetails?.daily_tips ? 'Regenerate Tips' : 'Generate Tips'}
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

            <div className="glass-panel ai-day-assistant-card">
              {(() => {
                const isDailyTipsEnabled = !trip.disabledDayFields?.includes('daily_tips');
                const isBabyLogisticsEnabled = !trip.disabledDayFields?.includes('baby_logistics');
                const isAnyDayFieldEnabled = isDailyTipsEnabled || isBabyLogisticsEnabled;

                return daysGeneratingDates.has(activeDayStr) ? (
                  <FunGeneratingLoader message="Asking Gemini to design daily tips & route logistics..." />
                ) : (isDailyTipsEnabled && activeDay?.aiDetails?.daily_tips) || (isBabyLogisticsEnabled && activeDay?.aiDetails?.baby_logistics) ? (
                  <div className="day-ai-content-col">
                    
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
                        <button 
                          className="dropdown-item"
                          onClick={() => {
                            handleAddScheduleNote(scheduleItems.length, '');
                            setEditingNoteItemIndex(scheduleItems.length);
                            setEditingNoteText('');
                            setShowDayOptionsMenu(false);
                          }}
                        >
                          <FileText size={12} /> Add Note
                        </button>
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
                      const isFirst = idx === 0;
                      const isLast = idx === scheduleItems.length - 1;

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

                      // Place item
                      const placeItem = item as SchedulePlaceItem;
                      const placeNumber = ++placeCount;
                      let place: Place | undefined;
                      for (const loc of trip.locations) {
                        const found = loc.places.find(p => p.id === placeItem.placeId);
                        if (found) { place = found; break; }
                      }
                      if (!place) return null;

                      const dropdownKey = `${place.id}-${idx}`;
                      const mobileDropdownKey = `${place.id}-${idx}-mobile`;

                      return (
                        <React.Fragment key={`place-${place.id}-${idx}`}>
                          {renderAddSlot(idx, canEdit)}
                          <div
                            style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}
                            onMouseEnter={() => { cancelHideItem(); setHoveredScheduleItemIndex(idx); }}
                            onMouseLeave={scheduleHideItem}
                          >
                            {dragOverDayPlaceIndex === idx && (
                              <div style={{ position: 'absolute', top: dragOverDayPlacePosition === 'top' ? '-10px' : 'auto', bottom: dragOverDayPlacePosition === 'bottom' ? '-10px' : 'auto', left: 0, right: 0, height: '4px', background: 'var(--accent-primary)', borderRadius: '2px', boxShadow: '0 0 8px var(--accent-primary)', zIndex: 10, pointerEvents: 'none' }} />
                            )}
                            <div
                              className={`timeline-card glass-panel timeline-place-card ${activeTimelinePlaceDropdownKey === mobileDropdownKey ? 'dropdown-active' : ''}`}
                              data-place-id={place.id}
                              draggable={canEdit}
                              onDragStart={(e) => {
                                handleDayPlaceDragStart(idx);
                                if (e.currentTarget) {
                                  const card = e.currentTarget;
                                  card.classList.add('is-dragging-ghost');
                                  setTimeout(() => {
                                    card.classList.remove('is-dragging-ghost');
                                  }, 0);
                                }
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
                                if (draggedDayPlaceIndex !== null) handleDayPlaceDrop(idx, dragOverDayPlacePosition);
                                else if (draggedPlaceId) handleCatalogPlaceDropOnTimeline(draggedPlaceId, idx, dragOverDayPlacePosition);
                                setDragOverDayPlaceIndex(null);
                              }}
                              onClick={() => setActivePlaceId(activePlaceId === place!.id ? undefined : place!.id)}
                              style={{ borderColor: activePlaceId === place.id ? 'var(--accent-primary)' : 'var(--border-glass)' }}
                            >
                              <div className="timeline-dot" style={{ backgroundColor: (trip.placeGroups || DEFAULT_PLACE_GROUPS).find(g => g.id === place!.placeGroupId)?.color || '#6b7280' }}>
                                {getCategoryIconComponent((trip.placeGroups || DEFAULT_PLACE_GROUPS).find(g => g.id === place!.placeGroupId)?.icon || 'map-pin', 12, undefined, { color: '#ffffff' })}
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
                                    <p className="place-desc-text">{place.description ? place.description.substring(0, 50) + '...' : 'Attraction'}</p>
                                    {editingPlaceNotesId === place.id ? (
                                      <div className="notes-edit-wrapper" onClick={e => e.stopPropagation()}>
                                        <textarea value={localNotes} onChange={(e) => setLocalNotes(e.target.value)} placeholder="Add notes..." rows={4} className="notes-textarea" />
                                        <div className="notes-actions">
                                          <button className="btn-secondary place-notes-btn" onClick={() => setEditingPlaceNotesId(null)}>Cancel</button>
                                          <button className="btn-primary flex-align place-notes-btn" onClick={() => { savePlaceNotes(place!.id, localNotes); setEditingPlaceNotesId(null); }} style={{ gap: '4px' }}><Check size={10} /> Save</button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="notes-text-wrapper" style={{ marginTop: '4px', paddingRight: canEdit ? '22px' : '0', cursor: canEdit ? 'pointer' : undefined }} onClick={canEdit ? (e) => { e.stopPropagation(); startEditingNotes(place!); } : undefined}>
                                        <div className={`notes-text ${place.notes ? 'has-content' : 'no-content'}`}>
                                          <FileText size={13} style={{ marginTop: '2px', color: place.notes ? 'var(--accent-primary)' : 'var(--text-muted)', flexShrink: 0 }} />
                                          <span>{place.notes || 'Add notes...'}</span>
                                        </div>
                                        {canEdit && (
                                          <button className="mini-icon-btn notes-edit-btn place-note-edit-abs" onClick={(e) => { e.stopPropagation(); startEditingNotes(place!); }} data-tooltip="Edit Note"><Edit2 size={12} /></button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {canEdit && (
                                  <div className="day-place-actions-desktop" onClick={e => e.stopPropagation()}>
                                    <div className="place-card-move-buttons">
                                      <button className="mini-icon-btn" disabled={isFirst} onClick={() => handleMoveScheduleItem(idx, 'up')} style={{ opacity: isFirst ? 0.3 : 1 }} data-tooltip="Move Up"><ChevronUp size={12} /></button>
                                      <button className="mini-icon-btn" disabled={isLast} onClick={() => handleMoveScheduleItem(idx, 'down')} style={{ opacity: isLast ? 0.3 : 1 }} data-tooltip="Move Down"><ChevronDown size={12} /></button>
                                    </div>
                                    <div className="timeline-place-dropdown-container">
                                      <button className="mini-icon-btn" onClick={(e) => { e.stopPropagation(); setActiveTimelinePlaceDropdownKey(activeTimelinePlaceDropdownKey === dropdownKey ? null : dropdownKey); }} data-tooltip="Place Options"><MoreVertical size={14} /></button>
                                      {activeTimelinePlaceDropdownKey === dropdownKey && (
                                        <div className="dropdown-menu dropdown-menu-above">
                                          <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(place!.title); setActiveTimelinePlaceDropdownKey(null); }}><Copy size={12} /> Copy Name</button>
                                          <button className="dropdown-item" data-tooltip="Edit Place" onClick={(e) => { e.stopPropagation(); handleOpenEditPlace(place!); setActiveTimelinePlaceDropdownKey(null); }}><Edit2 size={12} /> Edit Place</button>
                                          <button className="dropdown-item danger" onClick={(e) => { e.stopPropagation(); handleRemovePlaceFromDay(idx); setActiveTimelinePlaceDropdownKey(null); }}><Trash2 size={12} /> Remove from Day</button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Mobile dropdown */}
                              {canEdit && (
                                <div className={`day-place-dropdown-container-mobile ${activeTimelinePlaceDropdownKey === mobileDropdownKey ? 'dropdown-active' : ''}`} onClick={e => e.stopPropagation()}>
                                  <button className="mini-icon-btn" onClick={(e) => { e.stopPropagation(); setActiveTimelinePlaceDropdownKey(activeTimelinePlaceDropdownKey === mobileDropdownKey ? null : mobileDropdownKey); }} data-tooltip="Place Options"><MoreVertical size={14} /></button>
                                  {activeTimelinePlaceDropdownKey === mobileDropdownKey && (
                                    <div className="dropdown-menu">
                                      <button className="dropdown-item" disabled={isFirst} onClick={(e) => { e.stopPropagation(); handleMoveScheduleItem(idx, 'up'); setActiveTimelinePlaceDropdownKey(null); }} style={{ opacity: isFirst ? 0.3 : 1 }}><ChevronUp size={12} /> Move Up</button>
                                      <button className="dropdown-item" disabled={isLast} onClick={(e) => { e.stopPropagation(); handleMoveScheduleItem(idx, 'down'); setActiveTimelinePlaceDropdownKey(null); }} style={{ opacity: isLast ? 0.3 : 1 }}><ChevronDown size={12} /> Move Down</button>
                                      <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(place!.title); setActiveTimelinePlaceDropdownKey(null); }}><Copy size={12} /> Copy Name</button>
                                      <button className="dropdown-item" data-tooltip="Edit Place" onClick={(e) => { e.stopPropagation(); handleOpenEditPlace(place!); setActiveTimelinePlaceDropdownKey(null); }}><Edit2 size={12} /> Edit Place</button>
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
                                    <AiDetailsView place={place} onGenerate={() => handleGenerateSinglePlaceAiDetails(place!.id)} canEdit={canEdit} isGenerating={placeGeneratingIds.has(place.id)} layoutMode="adaptive-2-col" customAiFields={trip.customAiFields} disabledPlaceFields={trip.disabledPlaceFields} fieldIcons={trip.fieldIcons} placeFieldsOrder={trip.placeFieldsOrder} />
                                  </div>
                                </div>
                              </div>
                            </div>
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
    </div>
  );
}

export default memo(ItineraryPanel);
