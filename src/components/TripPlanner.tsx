import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { Trip, Plan, PlanDay, Location, Place, PlaceGroup, Hotel, ScheduleItem, SchedulePlaceItem, ScheduleHotelEventItem, ScheduleTransitEventItem, SchedulePlaceReservationEventItem, TransportationReservation, FlatTransportationSegment, ExpenseGroup, ExpenseItem, ExpenseLine, ReservationGroup, GenericReservation, PlaceReservation } from '../types';
import { flattenReservations } from '../types';
import PlaceReservationModal from './PlaceReservationModal';

const updateDayItems = (day: PlanDay, items: ScheduleItem[]): PlanDay => ({
  ...day,
  scheduleItems: items,
  placeIds: items.filter((i): i is SchedulePlaceItem => i.type === 'place').map(i => i.placeId)
});

// Items that move with days (Move Day, Swap Days). Non-transferable items (hotel/transit events) stay on their original day.
const isTransferableItem = (item: ScheduleItem): item is SchedulePlaceItem => item.type === 'place' || item.type === 'note';

const transferDayFields = (source: PlanDay, target: PlanDay): PlanDay => {
  const sourceItems = (source.scheduleItems || []).filter(isTransferableItem);
  // Preserve the target day's hotel/transit events — they are tied to that date
  const targetNonTransferable = (target.scheduleItems || []).filter(i => !isTransferableItem(i));
  const updatedTarget = {
    ...target,
    locationId: source.locationId,
    aiDetails: source.aiDetails,
    aiUpdatedAt: source.aiUpdatedAt,
    noHotel: source.noHotel,
  };
  return updateDayItems(updatedTarget, [...targetNonTransferable, ...sourceItems]);
};

const clearDayFields = (day: PlanDay): PlanDay => {
  // Keep non-transferable items (hotel/transit events) — used by Move Day source side
  const remainingItems = (day.scheduleItems || []).filter(i => !isTransferableItem(i));
  const clearedDay = {
    ...day,
    aiDetails: undefined,
    aiUpdatedAt: undefined,
    noHotel: undefined
  };
  return updateDayItems(clearedDay, remainingItems);
};
import { Navigation, BookOpen, Clock, Loader2 } from 'lucide-react';
import { searchPlacesNearLocation, DEFAULT_PLACE_GROUPS, DEFAULT_EXPENSE_GROUPS, DEFAULT_RESERVATION_GROUPS, buildMapsLink, parseGoogleMapsUrl, fetchPlaceFromGoogleMapsUrl, getLocIcon, getFormattedLocationName } from '../utils/api';
import { getDaysDiff, shiftTripDates, getTodayDateString } from '../utils/dateUtils';
import MapComponent from './MapComponent';
import { GeminiService, AI_NOT_CONFIGURED_TITLE, AI_NOT_CONFIGURED_MESSAGE, AI_FILE_CONTENTS_NOT_AVAILABLE_IN_MANUAL_MODE_MESSAGE } from '../utils/ai';
import { aiRequestQueue } from '../utils/aiRequestQueue';
import { runAiCall } from '../utils/runAiCall';
import { getOrCreateTripFileFolder, uploadFile } from '../utils/googleDrive';
import AiGenerateModal from './AiGenerateModal';
import ManualAiPromptModal from './ManualAiPromptModal';


// Extracted Modals
import ConfirmationModal from './ConfirmationModal';
import NewPlanModal from './NewPlanModal';
import MoveDayModal from './MoveDayModal';
import SwapDaysModal from './SwapDaysModal';
import EditTripModal from './EditTripModal';
import AddLocationModal from './AddLocationModal';
import LocationModal from './LocationModal';
import GroupModal from './GroupModal';
import TransportModal from './TransportModal';
import HotelModal from './HotelModal';
import DeleteReservationModal from './DeleteReservationModal';
import PlaceModal from './PlaceModal';
import TripAiConfigModal from './TripAiConfigModal';
import AiGenerateDaysModal from './AiGenerateDaysModal';
import LeftPanelAccordion from './LeftPanelAccordion';
import ItineraryPanel from './ItineraryPanel';
import ExpenseGroupModal from './ExpenseGroupModal';
import ExpenseModal from './ExpenseModal';
import ReservationGroupModal from './ReservationGroupModal';
import GenericReservationModal from './GenericReservationModal';

const LOCATION_COLORS = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#8b5cf6', // Violet
  '#ef4444'  // Red
];


interface TripPlannerProps {
  trip: Trip;
  onBack?: () => void;
  onUpdateTrip: (updatedTrip: Trip | ((prevTrip: Trip) => Trip)) => void;
  onShareTrip?: (trip: Trip) => void;
  isGoogleSignedIn?: boolean;
  googleToken?: string;
  googleFolderId?: string;
}

export default function TripPlanner({ trip, onUpdateTrip, onShareTrip, isGoogleSignedIn, googleToken, googleFolderId }: TripPlannerProps) {
  // Plan State
  const [activePlanId, setActivePlanId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('plan') || trip.plans[0]?.id || '';
  });
  const activePlan = trip.plans.find(p => p.id === activePlanId) || trip.plans[0];

  const daysTabsNavRef = useRef<HTMLDivElement>(null);
  const lastScrollLeft = useRef<number>(0);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  // Close search suggestions and dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(target)) {
        setPlaceSuggestions([]);
      }
      if (!target.closest('.group-dropdown-container')) {
        setActiveGroupDropdownId(null);
      }
      if (!target.closest('.plan-dropdown-container')) {
        setShowPlanMenu(false);
      }
      if (!target.closest('.day-options-dropdown-container')) {
        setShowDayOptionsMenu(false);
      }
      if (!target.closest('.timeline-place-dropdown-container') && !target.closest('.timeline-place-dropdown-container-mobile') && !target.closest('.day-place-dropdown-container-mobile')) {
        setActiveTimelinePlaceDropdownKey(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // Restore day switcher scroll position across plan transitions
  useEffect(() => {
    if (daysTabsNavRef.current) {
      daysTabsNavRef.current.scrollLeft = lastScrollLeft.current;
    }
  }, [activePlanId]);

  // Handle horizontal scroll for the day switcher using middle mouse button and wheel scroll
  useEffect(() => {
    const el = daysTabsNavRef.current;
    if (!el) return;

    // 1. Wheel scroll mapping (vertical scroll wheel scrolls horizontally)
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        el.scrollBy({
          left: e.deltaY,
          behavior: 'smooth'
        });
      }
    };

    // 2. Middle-mouse click and drag scrolling
    let isDragging = false;
    let startX = 0;
    let startScrollLeft = 0;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 1) { // Middle mouse button
        e.preventDefault(); // Prevent standard browser autoscroll icon
        isDragging = true;
        startX = e.clientX;
        startScrollLeft = el.scrollLeft;
        el.style.cursor = 'grabbing';
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      el.scrollLeft = startScrollLeft - dx;
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 1 && isDragging) {
        isDragging = false;
        el.style.cursor = '';
      }
    };

    const handleAuxClick = (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    el.addEventListener('auxclick', handleAuxClick);

    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      el.removeEventListener('auxclick', handleAuxClick);
    };
  }, [activePlanId]);

  // Active Day State
  const daysList = Object.keys(activePlan?.days || {}).sort();
  const [activeDayStr, setActiveDayStr] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const urlDay = params.get('day');
    if (urlDay && daysList.includes(urlDay)) {
      return urlDay;
    }
    const todayStr = getTodayDateString();
    if (daysList.includes(todayStr)) {
      return todayStr;
    }
    return daysList[0] || '';
  });
  const activeDay = activePlan?.days[activeDayStr];

  const activeDayStrRef = useRef<string>(activeDayStr);
  useEffect(() => {
    activeDayStrRef.current = activeDayStr;
  }, [activeDayStr]);

  // Selected Catalog Location ID (decoupled from day details)
  const [selectedCatalogLocId, setSelectedCatalogLocId] = useState<string>(
    activeDay?.locationId || (trip.locations.length > 0 ? trip.locations[0].id : '')
  );

  // Sync plan and day when trip prop changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlPlanId = params.get('plan');
    const defaultPlanId = trip.plans[0]?.id || '';
    
    let targetPlanId = urlPlanId && trip.plans.some(p => p.id === urlPlanId) ? urlPlanId : defaultPlanId;
    setActivePlanId(targetPlanId);
    
    const plan = trip.plans.find(p => p.id === targetPlanId) || trip.plans[0];
    const planDays = Object.keys(plan?.days || {}).sort();
    const urlDay = params.get('day');
    const todayStr = getTodayDateString();
    const targetDay = urlDay && planDays.includes(urlDay)
      ? urlDay
      : (planDays.includes(todayStr) ? todayStr : (planDays[0] || ''));
    setActiveDayStr(targetDay);
  }, [trip.id]);

  // Auto-validate plan and day selection when trip prop changes (e.g. due to other tab updates or syncs)
  useEffect(() => {
    if (!trip) return;
    
    // Check if the currently selected activePlanId is still valid in trip.plans
    const planExists = trip.plans.some(p => p.id === activePlanId);
    let validPlanId = activePlanId;
    if (!planExists && trip.plans.length > 0) {
      validPlanId = trip.plans[0].id;
      setActivePlanId(validPlanId);
    }
    
    // Check if the currently selected activeDayStr is still valid within the active plan
    const activePlanObj = trip.plans.find(p => p.id === validPlanId) || trip.plans[0];
    if (activePlanObj) {
      const planDays = Object.keys(activePlanObj.days || {}).sort();
      if (planDays.length > 0 && !planDays.includes(activeDayStr)) {
        setActiveDayStr(planDays[0]);
      }
    }
  }, [trip, activePlanId, activeDayStr]);

  // Sync activePlanId and activeDayStr to URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let changed = false;
    
    if (activePlanId) {
      if (params.get('plan') !== activePlanId) {
        params.set('plan', activePlanId);
        changed = true;
      }
    } else {
      if (params.has('plan')) {
        params.delete('plan');
        changed = true;
      }
    }
    
    if (activeDayStr) {
      if (params.get('day') !== activeDayStr) {
        params.set('day', activeDayStr);
        changed = true;
      }
    } else {
      if (params.has('day')) {
        params.delete('day');
        changed = true;
      }
    }
    
    if (changed) {
      const newSearch = params.toString();
      window.history.pushState({}, '', `${window.location.pathname}?${newSearch}`);
    }
  }, [activePlanId, activeDayStr]);

  // Listen to browser Back/Forward navigation (popstate) for plan/day
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const urlPlanId = params.get('plan');
      const urlDay = params.get('day');
      
      if (urlPlanId && urlPlanId !== activePlanId) {
        const foundPlan = trip.plans.find(p => p.id === urlPlanId);
        if (foundPlan) {
          setActivePlanId(urlPlanId);
        }
      }
      
      if (urlDay && urlDay !== activeDayStr) {
        setActiveDayStr(urlDay);
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activePlanId, activeDayStr, trip.plans]);

  // Sync catalog selection with active day's location changes
  useEffect(() => {
    if (activeDay?.locationId) {
      setSelectedCatalogLocId(activeDay.locationId);
    }
  }, [activeDay?.locationId]);

  // Active Location for active day (can be undefined if no location selected)
  const activeDayLocation = trip.locations.find(l => l.id === activeDay?.locationId);

  // Active Location for Catalog sidebar (falls back to activeDayLocation or first trip location)
  const catalogLocation = trip.locations.find(l => l.id === selectedCatalogLocId) || activeDayLocation || trip.locations[0];

  // UI Control States
  const [activePlaceId, setActivePlaceId] = useState<string | undefined>(undefined);
  const [showNewPlanModal, setShowNewPlanModal] = useState(false);

  // AI Generation States
  const [showAiGenerateModal, setShowAiGenerateModal] = useState(false);
  const [aiGeneratePlaces, setAiGeneratePlaces] = useState<Place[]>([]);
  const [aiGenerateCity, setAiGenerateCity] = useState('');
  const [aiGenerateCountry, setAiGenerateCountry] = useState('');
  const [placeGeneratingIds, setPlaceGeneratingIds] = useState<Set<string>>(new Set());

  // AI Suggested Places States
  const [aiSuggestedPlaces, setAiSuggestedPlaces] = useState<Place[]>([]);
  const [isLoadingAiSuggestions, setIsLoadingAiSuggestions] = useState(false);
  const [aiSuggestionsLocId, setAiSuggestionsLocId] = useState<string | null>(null);
  const [aiSuggestionsError, setAiSuggestionsError] = useState<string | null>(null);
  
  // Rename plan state
  const [isRenamingPlan, setIsRenamingPlan] = useState(false);
  const [editPlanName, setEditPlanName] = useState('');

  // Dropdown states
  const [activeGroupDropdownId, setActiveGroupDropdownId] = useState<string | null>(null);
  const [showPlanMenu, setShowPlanMenu] = useState(false);
  const [showDayOptionsMenu, setShowDayOptionsMenu] = useState(false);
  const [activeTimelinePlaceDropdownKey, setActiveTimelinePlaceDropdownKey] = useState<string | null>(null);

  // Add Location Modal state
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
  const [addLocationForDay, setAddLocationForDay] = useState(false);

  // Custom Place Modal
  const [showCustomPlaceModal, setShowCustomPlaceModal] = useState(false);

  // Transportation Modal
  const [showTransportModal, setShowTransportModal] = useState(false);
  const [editingTransport, setEditingTransport] = useState<TransportationReservation | null>(null);
  const [editingTransportationSegmentIndex, setEditingTransportationSegmentIndex] = useState(0);
  const [deleteTransportData, setDeleteTransportData] = useState<{ reservation: TransportationReservation; segmentIndex: number } | null>(null);

  // Hotel Modal
  const [showHotelModal, setShowHotelModal] = useState(false);
  const [editingHotel, setEditingHotel] = useState<Hotel | null>(null);
  const [deleteHotelData, setDeleteHotelData] = useState<Hotel | null>(null);
  const [expandedHotelId, setExpandedHotelId] = useState<string | null>(null);
  const [expandedTransitId, setExpandedTransitId] = useState<string | null>(null);

  // Place Reservation Modal (Attraction / Dining)
  const [showPlaceReservationModal, setShowPlaceReservationModal] = useState(false);
  const [editingPlaceReservation, setEditingPlaceReservation] = useState<PlaceReservation | null>(null);
  const [placeReservationDefaultType, setPlaceReservationDefaultType] = useState<'attraction' | 'dining'>('attraction');
  const [expandedPlaceReservationId, setExpandedPlaceReservationId] = useState<string | null>(null);

  // Reservation Import States
  const [isImportingReservationFile, setIsImportingReservationFile] = useState(false);
  const [importingReservationMessage, setImportingReservationMessage] = useState('');

  // Day timeline search state
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeSuggestions, setPlaceSuggestions] = useState<Omit<Place, 'placeGroupId'>[]>([]);
  const [isSearchingPlace, setIsSearchingPlace] = useState(false);

  // PlaceGroup Edit Modal
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PlaceGroup | null>(null);

  // Edit Trip Modal state
  const [showEditTripModal, setShowEditTripModal] = useState(false);

  // Custom Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isAlert?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const showApiKeyMissingModal = () => {
    setConfirmModal({
      title: AI_NOT_CONFIGURED_TITLE,
      message: AI_NOT_CONFIGURED_MESSAGE,
      confirmText: 'OK',
      isAlert: true,
      onConfirm: () => {}
    });
  };

  const showAlert = (title: string, message: string) => {
    setConfirmModal({ title, message, confirmText: 'OK', isAlert: true, onConfirm: () => {} });
  };

  // Edit Location Modal state
  const [showEditLocationModal, setShowEditLocationModal] = useState(false);

  // Drag and Drop place state
  const [draggedPlaceId, setDraggedPlaceId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [dragOverPlaceId, setDragOverPlaceId] = useState<string | null>(null);
  const [dragOverPlacePosition, setDragOverPlacePosition] = useState<'top' | 'bottom'>('top');
  const [draggedDayPlaceIndex, setDraggedDayPlaceIndex] = useState<number | null>(null);
  const [dragOverDayPlaceIndex, setDragOverDayPlaceIndex] = useState<number | null>(null);
  const [dragOverDayPlacePosition, setDragOverDayPlacePosition] = useState<'top' | 'bottom'>('top');

  // Edit Place Modal state
  const [showEditPlaceModal, setShowEditPlaceModal] = useState(false);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);

  // Move Day Modal state
  const [showMoveDayModal, setShowMoveDayModal] = useState(false);

  // Swap Days Modal state
  const [showSwapDaysModal, setShowSwapDaysModal] = useState(false);

  // Mobile UI States
  const [activeMobileTab, setActiveMobileTab] = useState<'catalog' | 'itinerary' | 'map'>('itinerary');
  const [autoScheduleOnActiveDay, setAutoScheduleOnActiveDay] = useState(false);
  const [pendingPlaceInsertIndex, setPendingPlaceInsertIndex] = useState<number | null>(null);

  const MOBILE_TABS: Array<'catalog' | 'itinerary' | 'map'> = ['catalog', 'itinerary', 'map'];
  const swipeTouchStart = useRef<{ x: number; y: number } | null>(null);
  const handleSwipeTouchStart = (e: React.TouchEvent) => {
    // Don't hijack touches on the map or any horizontally scrollable element
    let el = e.target as HTMLElement | null;
    while (el) {
      if (el.classList?.contains('map-panel') || el.classList?.contains('leaflet-container')) return;
      const ox = window.getComputedStyle(el).overflowX;
      if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth) return;
      el = el.parentElement;
    }
    const t = e.touches[0];
    swipeTouchStart.current = { x: t.clientX, y: t.clientY };
  };
  const handleSwipeTouchEnd = (e: React.TouchEvent) => {
    if (!swipeTouchStart.current) return;
    const dx = e.changedTouches[0].clientX - swipeTouchStart.current.x;
    const dy = e.changedTouches[0].clientY - swipeTouchStart.current.y;
    swipeTouchStart.current = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    setActiveMobileTab(prev => {
      const idx = MOBILE_TABS.indexOf(prev);
      if (dx < 0) return MOBILE_TABS[Math.min(idx + 1, MOBILE_TABS.length - 1)];
      return MOBILE_TABS[Math.max(idx - 1, 0)];
    });
  };
  const [hideAllocatedPlaces, setHideAllocatedPlaces] = useState(false);

  // Accordion state for left panel
  const [expandedLeftSection, setExpandedLeftSection] = useState<'catalog' | 'checklist' | 'reservations' | 'tips' | 'expenses'>('catalog');
  
  // Expense Modal and Group states
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);
  const [showExpenseGroupModal, setShowExpenseGroupModal] = useState(false);
  const [editingExpenseGroup, setEditingExpenseGroup] = useState<ExpenseGroup | null>(null);
  const [activeExpenseGroupDropdownId, setActiveExpenseGroupDropdownId] = useState<string | null>(null);

  // Reservation Group and GenericReservation states
  const [showReservationGroupModal, setShowReservationGroupModal] = useState(false);
  const [editingReservationGroup, setEditingReservationGroup] = useState<ReservationGroup | null>(null);
  const [activeReservationGroupDropdownId, setActiveReservationGroupDropdownId] = useState<string | null>(null);
  const [showGenericReservationModal, setShowGenericReservationModal] = useState(false);
  const [editingGenericReservation, setEditingGenericReservation] = useState<GenericReservation | null>(null);
  const [targetGenericReservationGroupId, setTargetGenericReservationGroupId] = useState<string | null>(null);
  
  // Left and Right panel collapsed states (desktop only)
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  
  // Trip AI settings modal state
  const [showTripAiConfigModal, setShowTripAiConfigModal] = useState(false);
  
  // AI Generate Days Modal state
  const [showAiGenerateDaysModal, setShowAiGenerateDaysModal] = useState(false);
  
  // Daily tips generating state (per-day dates)
  const [daysGeneratingDates, setDaysGeneratingDates] = useState<Set<string>>(new Set());
  
  // Trip Checklist generation states
  const [generatingChecklist, setGeneratingChecklist] = useState(false);
  
  // Local Essentials generation states
  const [generatingLocalEssentials, setGeneratingLocalEssentials] = useState(false);

  // Manual AI prompt modal state
  const [pendingManualAiPrompt, setPendingManualAiPrompt] = useState<{
    title: string;
    promptText: string;
    responseFormat: 'json' | 'markdown';
    onResponse: (text: string) => void;
    onCancel: () => void;
  } | null>(null);

  useEffect(() => {
    aiRequestQueue.setMaxConcurrent(GeminiService.getMaxConcurrentRequests());
  }, []);

  const showManualAiPrompt = (title: string, promptText: string, responseFormat: 'json' | 'markdown'): Promise<string | null> =>
    new Promise(resolve => {
      setPendingManualAiPrompt({
        title, promptText, responseFormat,
        onResponse: text => { setPendingManualAiPrompt(null); resolve(text); },
        onCancel: () => { setPendingManualAiPrompt(null); resolve(null); }
      });
    });

  // Trigger search on place query changes (Day timeline inline search)
  useEffect(() => {
    if (placeQuery.trim().length < 2 || !activeDayLocation) {
      setPlaceSuggestions([]);
      return;
    }

    const { isGoogleMapsUrl } = parseGoogleMapsUrl(placeQuery);
    if (isGoogleMapsUrl) {
      const delayDebounce = setTimeout(async () => {
        setIsSearchingPlace(true);
        const { place } = await fetchPlaceFromGoogleMapsUrl(placeQuery, activeDayLocation);
        setIsSearchingPlace(false);
        if (place) setPlaceSuggestions([place]);
      }, 300);
      return () => clearTimeout(delayDebounce);
    }

    const delayDebounce = setTimeout(async () => {
      setIsSearchingPlace(true);
      const results = await searchPlacesNearLocation(placeQuery, activeDayLocation);
      setPlaceSuggestions(results);
      setIsSearchingPlace(false);
    }, 450);

    return () => clearTimeout(delayDebounce);
  }, [placeQuery, activeDayLocation]);

  if (!activePlan) return null;



  // ----------------------------------------------------
  // Location Operations
  // ----------------------------------------------------
  const handleAddNewLocationToCatalog = (loc: Omit<Location, 'places'>) => {
    let existingLoc = trip.locations.find(
      l => l.city.toLowerCase() === loc.city.toLowerCase() && 
           l.country.toLowerCase() === loc.country.toLowerCase()
    );

    let updatedLocations = [...trip.locations];
    let isNew = false;

    if (!existingLoc) {
      const colorIndex = trip.locations.length % LOCATION_COLORS.length;
      const color = LOCATION_COLORS[colorIndex];
      const newLoc: Location = {
        ...loc,
        places: [],
        color
      };
      updatedLocations.push(newLoc);
      existingLoc = newLoc;
      isNew = true;
    }

    onUpdateTrip({
      ...trip,
      locations: updatedLocations
    });

    setSelectedCatalogLocId(existingLoc.id);

    // Auto-open edit dialog for new locations so user can set color
    if (isNew) {
      setTimeout(() => setShowEditLocationModal(true), 50);
    }
  };

  const handleAddNewLocationForDay = (loc: Omit<Location, 'places'>) => {
    let existingLoc = trip.locations.find(
      l => l.city.toLowerCase() === loc.city.toLowerCase() && 
           l.country.toLowerCase() === loc.country.toLowerCase()
    );

    let updatedLocations = [...trip.locations];
    let isNew = false;

    if (!existingLoc) {
      const colorIndex = trip.locations.length % LOCATION_COLORS.length;
      const color = LOCATION_COLORS[colorIndex];
      const newLoc: Location = {
        ...loc,
        places: [],
        color
      };
      updatedLocations.push(newLoc);
      existingLoc = newLoc;
      isNew = true;
    }

    const updatedPlans = trip.plans.map(p => {
      if (p.id === activePlan.id) {
        return {
          ...p,
          days: {
            ...p.days,
            [activeDayStr]: {
              ...p.days[activeDayStr],
              locationId: existingLoc!.id
            }
          }
        };
      }
      return p;
    });

    onUpdateTrip({
      ...trip,
      locations: updatedLocations,
      plans: updatedPlans
    });

    setSelectedCatalogLocId(existingLoc.id);

    // Auto-open edit dialog for new locations so user can set color
    if (isNew) {
      setTimeout(() => setShowEditLocationModal(true), 50);
    }
  };

  const handleDeleteLocation = (locId: string) => {
    setConfirmModal({
      title: 'Delete Location',
      message: 'Are you sure you want to delete this location? This will remove all its places from the catalog and any day plans.',
      onConfirm: () => {
        // 1. Remove location from trip.locations
        const updatedLocations = trip.locations.filter(l => l.id !== locId);

        // 2. Remove locationId from any plan days using it, and filter out places from the catalog
        const updatedPlans = trip.plans.map(p => {
          const updatedDays = { ...p.days };
          Object.keys(updatedDays).forEach(dateStr => {
            const day = updatedDays[dateStr];
            let newDay: PlanDay = day.locationId === locId ? { ...day, locationId: undefined } : { ...day };

            // Remove scheduled items that belonged to the deleted location
            const deletedLoc = trip.locations.find(l => l.id === locId);
            if (deletedLoc) {
              const deletedPlaceIds = new Set(deletedLoc.places.map(pl => pl.id));
              const newItems = (newDay.scheduleItems || []).filter(item => {
                if (item.type === 'place') return !deletedPlaceIds.has(item.placeId);
                return true;
              });
              newDay = updateDayItems(newDay, newItems);
            }
            updatedDays[dateStr] = newDay;
          });

          return {
            ...p,
            days: updatedDays
          };
        });

        // 3. Reset selectedCatalogLocId to first available location
        const remaining = updatedLocations[0]?.id || '';
        setSelectedCatalogLocId(remaining);

        onUpdateTrip({
          ...trip,
          locations: updatedLocations,
          plans: updatedPlans
        });
      }
    });
  };

  const handleSaveEditLocation = (locData: Partial<Location>) => {
    if (!catalogLocation) return;

    const updatedLocations = trip.locations.map(l => {
      if (l.id === catalogLocation.id) {
        return {
          ...l,
          ...locData
        };
      }
      return l;
    });

    onUpdateTrip({
      ...trip,
      locations: updatedLocations
    });
    setShowEditLocationModal(false);
  };

  const handleOpenEditPlace = useCallback((place: Place) => {
    setEditingPlace(place);
    setShowEditPlaceModal(true);
  }, []);

  const handleSaveEditPlace = (placeData: Omit<Place, 'id'>) => {
    if (!editingPlace) return;

    const updatedLocations = trip.locations.map(l => {
      if (l.places.some(p => p.id === editingPlace.id)) {
        return {
          ...l,
          places: l.places.map(p => {
            if (p.id === editingPlace.id) {
              return {
                ...p,
                ...placeData
              };
            }
            return p;
          })
        };
      }
      return l;
    });

    onUpdateTrip({
      ...trip,
      locations: updatedLocations
    });
    setShowEditPlaceModal(false);
    setEditingPlace(null);
  };

  const handleSaveBatchAiDetails = useCallback((updates: { [placeId: string]: { suggestedMarkers?: any[]; [key: string]: any } }) => {
    onUpdateTrip(prevTrip => {
      const updatedLocations = prevTrip.locations.map(l => {
        let locationChanged = false;
        const updatedPlaces = l.places.map(p => {
          if (updates[p.id]) {
            locationChanged = true;
            const { suggestedMarkers, ...aiDetails } = updates[p.id];
            return {
              ...p,
              aiDetails,
              suggestedMarkers,
              aiUpdatedAt: Date.now()
            };
          }
          return p;
        });
        if (locationChanged) {
          return {
            ...l,
            places: updatedPlaces
          };
        }
        return l;
      });

      return {
        ...prevTrip,
        locations: updatedLocations
      };
    });
  }, [onUpdateTrip]);

  const handleGenerateSinglePlaceAiDetails = useCallback(async (placeId: string) => {
    let targetPlace: Place | null = null;
    let targetLoc: Location | null = null;
    for (const l of trip.locations) {
      const found = l.places.find(p => p.id === placeId);
      if (found) {
        targetPlace = found;
        targetLoc = l;
        break;
      }
    }

    if (!targetPlace || !targetLoc) return;

    if (!GeminiService.isAiEnabled()) {
      showApiKeyMissingModal();
      return;
    }

    const placePayload = [{ id: placeId, title: targetPlace.title, description: targetPlace.description, lat: targetPlace.lat, lng: targetPlace.lng }];
    await runAiCall({
      label: `AI Details: ${targetPlace.title}`,
      buildPrompt: () => GeminiService.buildPlaceAiDetailsPrompt(placePayload, targetLoc.city, targetLoc.country, trip.customAiFields, trip.disabledPlaceFields, trip.placeFieldsOrder),
      parse: GeminiService.parsePlaceAiDetailsResponse,
      liveCall: () => GeminiService.generatePlaceAiDetailsWithRotation(placePayload, targetLoc.city, targetLoc.country, trip.customAiFields, undefined, trip.disabledPlaceFields),
      onSuccess: (results) => {
        if (results && results.length > 0) {
          const { id: _id, ...details } = results[0];
          handleSaveBatchAiDetails({ [placeId]: details });
        }
      },
      onError: (err) => showAlert('AI Error', `Failed to parse AI response: ${err.message}`),
      onLoadingChange: (loading) => setPlaceGeneratingIds(prev => { const next = new Set(prev); loading ? next.add(placeId) : next.delete(placeId); return next; }),
      showManualPrompt: showManualAiPrompt,
    });
  }, [trip.locations, trip.customAiFields, trip.disabledPlaceFields, trip.placeFieldsOrder, handleSaveBatchAiDetails]);

  const handleMapClick = (_lat: number, _lng: number) => {
    // No-op. Modals now use their own self-contained MapPicker components.
  };

  // Drag and Drop place handlers
  const handlePlaceDragStart = useCallback((placeId: string) => {
    setDraggedPlaceId(placeId);
  }, []);

  const handlePlaceDropOnGroup = useCallback((targetGroupId: string) => {
    if (!draggedPlaceId || !catalogLocation) return;

    const updatedLocations = trip.locations.map(l => {
      if (l.id === catalogLocation.id) {
        const placesCopy = [...l.places];
        const dragIndex = placesCopy.findIndex(p => p.id === draggedPlaceId);
        if (dragIndex === -1) return l;

        const [draggedPlace] = placesCopy.splice(dragIndex, 1);
        draggedPlace.placeGroupId = targetGroupId;
        placesCopy.push(draggedPlace);

        return {
          ...l,
          places: placesCopy
        };
      }
      return l;
    });

    onUpdateTrip({
      ...trip,
      locations: updatedLocations
    });
    setDraggedPlaceId(null);
  }, [draggedPlaceId, catalogLocation, trip, onUpdateTrip]);

  const handlePlaceDropOnPlace = useCallback((targetPlaceId: string, targetGroupId: string, position: 'top' | 'bottom') => {
    if (!draggedPlaceId || !catalogLocation) return;
    if (draggedPlaceId === targetPlaceId) return;

    const updatedLocations = trip.locations.map(l => {
      if (l.id === catalogLocation.id) {
        const placesCopy = [...l.places];
        const dragIndex = placesCopy.findIndex(p => p.id === draggedPlaceId);
        if (dragIndex === -1) return l;

        const [draggedPlace] = placesCopy.splice(dragIndex, 1);
        draggedPlace.placeGroupId = targetGroupId;

        const targetIndex = placesCopy.findIndex(p => p.id === targetPlaceId);
        if (targetIndex === -1) {
          placesCopy.push(draggedPlace);
        } else {
          let insertIndex = targetIndex;
          if (position === 'bottom') {
            insertIndex = targetIndex + 1;
          }
          placesCopy.splice(insertIndex, 0, draggedPlace);
        }

        return {
          ...l,
          places: placesCopy
        };
      }
      return l;
    });

    onUpdateTrip({
      ...trip,
      locations: updatedLocations
    });
    setDraggedPlaceId(null);
  }, [draggedPlaceId, catalogLocation, trip, onUpdateTrip]);

  const handleDayPlaceDragStart = useCallback((index: number) => {
    setDraggedDayPlaceIndex(index);
  }, []);

  const handleDayPlaceDrop = useCallback((targetIndex: number, position: 'top' | 'bottom') => {
    if (draggedDayPlaceIndex === null) return;

    const updatedPlans = trip.plans.map(p => {
      if (p.id === activePlan.id) {
        const currentItems = [...(p.days[activeDayStr]?.scheduleItems || [])];
        const draggedItem = currentItems[draggedDayPlaceIndex];

        let destIndex = targetIndex;
        if (position === 'bottom') destIndex = targetIndex + 1;

        currentItems.splice(draggedDayPlaceIndex, 1);
        let insertIndex = destIndex;
        if (draggedDayPlaceIndex < destIndex) insertIndex = destIndex - 1;
        currentItems.splice(insertIndex, 0, draggedItem);

        return {
          ...p,
          days: { ...p.days, [activeDayStr]: updateDayItems(p.days[activeDayStr]!, currentItems) }
        };
      }
      return p;
    });

    onUpdateTrip({ ...trip, plans: updatedPlans });
    setDraggedDayPlaceIndex(null);
    setDragOverDayPlaceIndex(null);
  }, [draggedDayPlaceIndex, trip, activePlan, activeDayStr, onUpdateTrip]);

  const handleCatalogPlaceDropOnTimeline = useCallback((placeId: string, targetIndex: number, position: 'top' | 'bottom') => {
    let destIndex = targetIndex;
    if (position === 'bottom') destIndex = targetIndex + 1;

    const updatedPlans = trip.plans.map(p => {
      if (p.id === activePlan.id) {
        const currentItems = [...(p.days[activeDayStr]?.scheduleItems || [])];
        currentItems.splice(destIndex, 0, { type: 'place', placeId });
        return {
          ...p,
          days: {
            ...p.days,
            [activeDayStr]: updateDayItems({
              ...p.days[activeDayStr]!,
              locationId: p.days[activeDayStr]?.locationId || catalogLocation?.id || trip.locations[0]?.id,
            }, currentItems)
          }
        };
      }
      return p;
    });

    onUpdateTrip({ ...trip, plans: updatedPlans });
    setDraggedPlaceId(null);
    setDragOverDayPlaceIndex(null);
  }, [trip, activePlan, activeDayStr, catalogLocation, onUpdateTrip]);



  const handleSetDayLocation = useCallback((locId: string) => {
    const updatedPlans = trip.plans.map(p => {
      if (p.id === activePlan.id) {
        return {
          ...p,
          days: {
            ...p.days,
            [activeDayStr]: {
              ...p.days[activeDayStr],
              locationId: locId || undefined
            }
          }
        };
      }
      return p;
    });

    onUpdateTrip({
      ...trip,
      plans: updatedPlans
    });
  }, [trip, activePlan, activeDayStr, onUpdateTrip]);

  const handleMoveDayContents = (destDateStr: string) => {
    if (!activeDayStr || !destDateStr || activeDayStr === destDateStr) return;
    
    const currentDayData = activePlan.days[activeDayStr];
    if (!currentDayData) return;

    const destDayData = activePlan.days[destDateStr];
    const sourceLocId = currentDayData.locationId;
    const destLocId = destDayData?.locationId;

    const getFormattedDayLabel = (dateStr: string) => {
      const idx = daysList.indexOf(dateStr) + 1;
      const formattedDate = formatDisplayDate(dateStr).split(',')[1]?.trim() || dateStr;
      return `Day ${idx} (${formattedDate})`;
    };

    const executeMove = () => {
      const updatedPlans = trip.plans.map(p => {
        if (p.id === activePlan.id) {
          const updatedDays = { ...p.days };
          const sourceDay = updatedDays[activeDayStr];
          const destDay = updatedDays[destDateStr];
          if (sourceDay && destDay) {
            updatedDays[destDateStr] = transferDayFields(sourceDay, destDay);
            updatedDays[activeDayStr] = clearDayFields(sourceDay);
          }
          return { ...p, days: updatedDays };
        }
        return p;
      });

      onUpdateTrip({
        ...trip,
        plans: updatedPlans
      });

      // Switch to the destination day
      setActiveDayStr(destDateStr);
      setShowMoveDayModal(false);
    };

    if (sourceLocId !== destLocId) {
      const sourceLoc = trip.locations.find(l => l.id === sourceLocId);
      const destLoc = trip.locations.find(l => l.id === destLocId);
      const sourceName = sourceLoc ? `${sourceLoc.city}, ${sourceLoc.country}` : 'Not Selected';
      const destName = destLoc ? `${destLoc.city}, ${destLoc.country}` : 'Not Selected';

      setConfirmModal({
        title: 'Move Day',
        message: `Are you sure you want to move ${getFormattedDayLabel(activeDayStr)} to ${getFormattedDayLabel(destDateStr)}? This will override all scheduled items on ${getFormattedDayLabel(destDateStr)}.\n\n⚠️ Warning: The location of ${getFormattedDayLabel(activeDayStr)} (${sourceName}) is different from ${getFormattedDayLabel(destDateStr)} (${destName}). Proceeding will update ${getFormattedDayLabel(destDateStr)}'s location to ${sourceName}.`,
        confirmText: 'Move Day',
        onConfirm: executeMove
      });
    } else {
      setConfirmModal({
        title: 'Move Day',
        message: `Are you sure you want to move ${getFormattedDayLabel(activeDayStr)} to ${getFormattedDayLabel(destDateStr)}? This will override all scheduled items on ${getFormattedDayLabel(destDateStr)}.`,
        confirmText: 'Move Day',
        onConfirm: executeMove
      });
    }
  };

  const handleSwapDaysContents = (destDateStr: string) => {
    if (!activeDayStr || !destDateStr || activeDayStr === destDateStr) return;

    const currentDayData = activePlan.days[activeDayStr];
    if (!currentDayData) return;

    const destDayData = activePlan.days[destDateStr];
    if (!destDayData) return;

    const getFormattedDayLabel = (dateStr: string) => {
      const idx = daysList.indexOf(dateStr) + 1;
      const formattedDate = formatDisplayDate(dateStr).split(',')[1]?.trim() || dateStr;
      return `Day ${idx} (${formattedDate})`;
    };

    const executeSwap = () => {
      const updatedPlans = trip.plans.map(p => {
        if (p.id === activePlan.id) {
          const updatedDays = { ...p.days };
          const sourceDay = updatedDays[activeDayStr];
          const destDay = updatedDays[destDateStr];
          if (sourceDay && destDay) {
            // Swap everything using the shared transferDayFields helper
            updatedDays[activeDayStr] = transferDayFields(destDay, sourceDay);
            updatedDays[destDateStr] = transferDayFields(sourceDay, destDay);
          }
          return { ...p, days: updatedDays };
        }
        return p;
      });

      onUpdateTrip({
        ...trip,
        plans: updatedPlans
      });

      // Switch to the destination day
      setActiveDayStr(destDateStr);
      setShowSwapDaysModal(false);
    };

    const sourceLocId = currentDayData.locationId;
    const destLocId = destDayData.locationId;

    if (sourceLocId !== destLocId) {
      const sourceLoc = trip.locations.find(l => l.id === sourceLocId);
      const destLoc = trip.locations.find(l => l.id === destLocId);
      const sourceName = sourceLoc ? `${sourceLoc.city}, ${sourceLoc.country}` : 'Not Selected';
      const destName = destLoc ? `${destLoc.city}, ${destLoc.country}` : 'Not Selected';

      setConfirmModal({
        title: 'Swap Days',
        message: `Are you sure you want to swap the contents of ${getFormattedDayLabel(activeDayStr)} and ${getFormattedDayLabel(destDateStr)}?\n\n⚠️ Warning: The location of ${getFormattedDayLabel(activeDayStr)} (${sourceName}) is different from ${getFormattedDayLabel(destDateStr)} (${destName}). Swapping will swap their locations too.`,
        confirmText: 'Swap Days',
        onConfirm: executeSwap
      });
    } else {
      setConfirmModal({
        title: 'Swap Days',
        message: `Are you sure you want to swap the contents of ${getFormattedDayLabel(activeDayStr)} and ${getFormattedDayLabel(destDateStr)}?`,
        confirmText: 'Swap Days',
        onConfirm: executeSwap
      });
    }
  };

  const handleClearDay = () => {
    if (!activeDayStr) return;

    const formattedDay = `Day ${daysList.indexOf(activeDayStr) + 1} (${formatDisplayDate(activeDayStr).split(',')[1]?.trim() || activeDayStr})`;

    setConfirmModal({
      title: 'Clear Day',
      message: `Are you sure you want to clear all scheduled places from ${formattedDay}?`,
      confirmText: 'Clear Day',
      onConfirm: () => {
        const updatedPlans = trip.plans.map(p => {
          if (p.id === activePlan.id) {
            const day = p.days[activeDayStr];
            if (!day) return p;
            // clearDayFields removes place/note but keeps hotel/transit events (for Move Day compat).
            // Here we want a full clear, so additionally remove hotel/transit events.
            const base = clearDayFields(day);
            const fullyCleared = updateDayItems(base, (base.scheduleItems || []).filter(isTransferableItem));
            return { ...p, days: { ...p.days, [activeDayStr]: fullyCleared } };
          }
          return p;
        });

        onUpdateTrip({
          ...trip,
          plans: updatedPlans
        });
      }
    });
  };

  // ----------------------------------------------------
  // Plan Operations
  // ----------------------------------------------------
  const handleCreatePlan = (planName: string) => {
    if (!planName.trim()) return;

    const newPlanId = `plan-${Date.now()}`;
    const clonedDays: { [dateStr: string]: PlanDay } = {};
    Object.keys(activePlan.days).forEach(date => {
      clonedDays[date] = {
        dateStr: date,
        placeIds: [],
        scheduleItems: []
      };
    });

    const newPlan: Plan = {
      id: newPlanId,
      name: planName,
      startDate: trip.startDate,
      endDate: trip.endDate,
      days: clonedDays,
      hotels: [],
      transports: [],
      expenseGroups: [...DEFAULT_EXPENSE_GROUPS],
      expenses: [],
      reservationGroups: [...DEFAULT_RESERVATION_GROUPS],
      genericReservations: []
    };

    onUpdateTrip({
      ...trip,
      plans: [...trip.plans, newPlan]
    });

    setActivePlanId(newPlanId);
    setShowNewPlanModal(false);
  };

  const handleRenamePlan = useCallback(() => {
    if (!editPlanName.trim()) return;
    const updatedPlans = trip.plans.map(p => {
      if (p.id === activePlan.id) {
        return {
          ...p,
          name: editPlanName
        };
      }
      return p;
    });
    onUpdateTrip({
      ...trip,
      plans: updatedPlans
    });
    setIsRenamingPlan(false);
  }, [editPlanName, trip, activePlan, onUpdateTrip]);

  const handleDeletePlan = useCallback((planId: string) => {
    if (trip.plans.length <= 1) {
      setConfirmModal({
        title: 'Delete Plan Option',
        message: 'A trip must have at least one plan option.',
        isAlert: true,
        onConfirm: () => {}
      });
      return;
    }
    setConfirmModal({
      title: 'Delete Plan Option',
      message: 'Are you sure you want to delete this plan option?',
      onConfirm: () => {
        const remainingPlans = trip.plans.filter(p => p.id !== planId);
        onUpdateTrip({
          ...trip,
          plans: remainingPlans
        });
        setActivePlanId(remainingPlans[0].id);
      }
    });
  }, [trip, onUpdateTrip]);

  const handleMovePlan = useCallback((direction: 'up' | 'down') => {
    const index = trip.plans.findIndex(p => p.id === activePlanId);
    if (index === -1) return;

    const newPlans = [...trip.plans];
    if (direction === 'up' && index > 0) {
      const temp = newPlans[index];
      newPlans[index] = newPlans[index - 1];
      newPlans[index - 1] = temp;
    } else if (direction === 'down' && index < newPlans.length - 1) {
      const temp = newPlans[index];
      newPlans[index] = newPlans[index + 1];
      newPlans[index + 1] = temp;
    } else {
      return;
    }

    onUpdateTrip({
      ...trip,
      plans: newPlans
    });
  }, [trip, activePlanId, onUpdateTrip]);

  // ----------------------------------------------------
  // Place Catalog & Itinerary Operations
  // ----------------------------------------------------
  const handleAddPlaceToDay = useCallback((place: Omit<Place, 'placeGroupId'>) => {
    if (!catalogLocation) return;

    const isAlreadyInCatalog = catalogLocation.places.some(p => p.id === place.id);
    let updatedLocations = [...trip.locations];

    let placeId = place.id;
    if (!isAlreadyInCatalog) {
      const newPlace: Place = {
        ...place,
        placeGroupId: 'new'
      };
      updatedLocations = trip.locations.map(l => {
        if (l.id === catalogLocation.id) {
          return {
            ...l,
            places: [...l.places, newPlace]
          };
        }
        return l;
      });
      placeId = newPlace.id;
    }

    const currentDayStr = activeDayStrRef.current;

    // Add to active day's scheduled list, auto-setting the day location if not set
    const updatedPlans = trip.plans.map(p => {
      if (p.id === activePlan.id) {
        const currentItems = [...(p.days[currentDayStr]?.scheduleItems || [])];
        currentItems.push({ type: 'place', placeId });
        return {
          ...p,
          days: {
            ...p.days,
            [currentDayStr]: updateDayItems({
              ...p.days[currentDayStr]!,
              locationId: p.days[currentDayStr]?.locationId || catalogLocation.id,
            }, currentItems)
          }
        };
      }
      return p;
    });

    onUpdateTrip({
      ...trip,
      locations: updatedLocations,
      plans: updatedPlans
    });

    setPlaceQuery('');
    setPlaceSuggestions([]);
    setActivePlaceId(placeId);
    // Remove from AI suggestions if it was suggested
    if (placeId.startsWith('ai-suggest-')) {
      setAiSuggestedPlaces(prev => prev.filter(p => p.id !== placeId));
    }
  }, [catalogLocation, trip, activePlan, onUpdateTrip]);

  const handleAiSuggestPlaces = useCallback(async () => {
    if (!catalogLocation) return;
    if (!GeminiService.isAiEnabled()) {
      showApiKeyMissingModal();
      return;
    }

    setIsLoadingAiSuggestions(true);
    setAiSuggestedPlaces([]);
    setAiSuggestionsError(null);
    setAiSuggestionsLocId(catalogLocation.id);

    const existingTitles = catalogLocation.places.map(p => p.title);
    const toPlaces = (suggestions: { title: string; description?: string; openingHours?: string; notes?: string; lat: number; lng: number; photoUrl?: string; category?: string }[]): Place[] =>
      suggestions.map((s, i) => ({
        id: `ai-suggest-${Date.now()}-${i}`,
        title: s.title, description: s.description || '', openingHours: s.openingHours, notes: s.notes,
        lat: s.lat, lng: s.lng, photoUrl: s.photoUrl, placeGroupId: s.category,
        mapsLink: buildMapsLink(s.title, s.lat, s.lng, catalogLocation.city)
      }));

    // Loading spinner = "preparing prompt"; turn off before modal opens in manual mode.
    setIsLoadingAiSuggestions(false);

    await runAiCall({
      label: `Suggest Places: ${catalogLocation.city}`,
      buildPrompt: () => GeminiService.buildSuggestedPlacesPrompt(catalogLocation.city, catalogLocation.country, existingTitles),
      parse: (text) => toPlaces(GeminiService.parseSuggestedPlacesResponse(text)),
      liveCall: async () => {
        setIsLoadingAiSuggestions(true);
        return toPlaces(await GeminiService.generateSuggestedPlacesWithRotation(catalogLocation.city, catalogLocation.country, existingTitles));
      },
      onSuccess: setAiSuggestedPlaces,
      onError: (err) => setAiSuggestionsError(err.message),
      onLoadingChange: (loading) => { if (!loading) setIsLoadingAiSuggestions(false); },
      showManualPrompt: showManualAiPrompt,
    });
  }, [catalogLocation]);

  const handleAddAiSuggestionToCatalog = useCallback((place: Place) => {
    if (!catalogLocation) return;
    const newPlace: Place = { ...place, placeGroupId: 'new' };
    const updatedLocations = trip.locations.map(l => {
      if (l.id === catalogLocation.id) {
        return { ...l, places: [...l.places, newPlace] };
      }
      return l;
    });
    onUpdateTrip({ ...trip, locations: updatedLocations });
    setAiSuggestedPlaces(prev => prev.filter(p => p.id !== place.id));
    setActivePlaceId(newPlace.id);
  }, [catalogLocation, trip, onUpdateTrip]);

  const handleAddPlaceFromDayTimeline = useCallback((place: Omit<Place, 'placeGroupId'>) => {
    if (!activeDayLocation) return;

    // Ensure the catalog location matches the active day location so it is saved in the correct city
    setSelectedCatalogLocId(activeDayLocation.id);

    // Create a temporary Place object to pass to PlaceModal
    const tempPlace: Place = {
      id: `new-temp-${Date.now()}`,
      title: place.title,
      description: place.description || '',
      openingHours: place.openingHours || '',
      lat: place.lat,
      lng: place.lng,
      placeGroupId: 'new',
      notes: place.notes || '',
      photoUrl: place.photoUrl || '',
      mapsLink: place.mapsLink || buildMapsLink(place.title, place.lat, place.lng, activeDayLocation.city)
    };

    setEditingPlace(tempPlace);

    // Configure the modal to auto-schedule the place to the active day on save
    setAutoScheduleOnActiveDay(true);
    setShowCustomPlaceModal(true);

    // Clear search query and suggestion list
    setPlaceQuery('');
    setPlaceSuggestions([]);
  }, [activeDayLocation]);

  const handleOpenAddPlaceAtIndex = useCallback((insertAtIndex: number) => {
    if (!activeDayLocation) return;
    setSelectedCatalogLocId(activeDayLocation.id);
    setEditingPlace({
      id: `new-temp-${Date.now()}`,
      title: '',
      description: '',
      openingHours: '',
      lat: activeDayLocation.lat,
      lng: activeDayLocation.lng,
      placeGroupId: 'new',
      notes: '',
      photoUrl: '',
      mapsLink: ''
    });
    setPendingPlaceInsertIndex(insertAtIndex);
    setAutoScheduleOnActiveDay(true);
    setShowCustomPlaceModal(true);
  }, [activeDayLocation]);

  const handleCreateCustomPlace = (placeData: Omit<Place, 'id'>) => {
    if (!catalogLocation) return;

    const customId = `place-${Date.now()}`;
    const newPlace: Place = {
      id: customId,
      ...placeData
    };

    const updatedLocations = trip.locations.map(l => {
      if (l.id === catalogLocation.id) {
        return {
          ...l,
          places: [...l.places, newPlace]
        };
      }
      return l;
    });

    let updatedPlans = trip.plans;
    if (autoScheduleOnActiveDay && activePlan && activeDayStr) {
      updatedPlans = trip.plans.map(p => {
        if (p.id === activePlan.id) {
          const daysCopy = { ...p.days };
          const dayData = daysCopy[activeDayStr] ?? { dateStr: activeDayStr, placeIds: [], scheduleItems: [] };
          const existingItems = [...(dayData.scheduleItems || [])];
          const insertIdx = pendingPlaceInsertIndex !== null ? pendingPlaceInsertIndex : existingItems.length;
          existingItems.splice(insertIdx, 0, { type: 'place' as const, placeId: customId });
          daysCopy[activeDayStr] = updateDayItems(dayData, existingItems);
          return { ...p, days: daysCopy };
        }
        return p;
      });
    }

    onUpdateTrip({
      ...trip,
      locations: updatedLocations,
      plans: updatedPlans
    });

    setPendingPlaceInsertIndex(null);
    setShowCustomPlaceModal(false);
  };

  const handleDeletePlace = (placeId: string) => {
    if (!catalogLocation) return;
    
    setConfirmModal({
      title: 'Delete Place from Catalog',
      message: 'Are you sure you want to delete this place from the catalog? This will also remove it from all days in your plans.',
      confirmText: 'Delete Place',
      onConfirm: () => {
        // Remove from the location's places
        const updatedLocations = trip.locations.map(l => {
          if (l.id === catalogLocation.id) {
            return {
              ...l,
              places: l.places.filter(p => p.id !== placeId)
            };
          }
          return l;
        });

        // Remove from all plan days
        const updatedPlans = trip.plans.map(p => {
          const updatedDays = { ...p.days };
          Object.keys(updatedDays).forEach(dateStr => {
            const day = updatedDays[dateStr];
            if (!day) return;
            const newItems = (day.scheduleItems || []).filter(
              item => !(item.type === 'place' && item.placeId === placeId)
            );
            updatedDays[dateStr] = updateDayItems(day, newItems);
          });
          return { ...p, days: updatedDays };
        });

        onUpdateTrip({
          ...trip,
          locations: updatedLocations,
          plans: updatedPlans
        });

        if (activePlaceId === placeId) {
          setActivePlaceId(undefined);
        }
      }
    });
  };

  const handleRemovePlaceFromDay = useCallback((scheduleIndex: number) => {
    const updatedPlans = trip.plans.map(p => {
      if (p.id === activePlan.id) {
        const currentItems = [...(p.days[activeDayStr]?.scheduleItems || [])];
        currentItems.splice(scheduleIndex, 1);
        return {
          ...p,
          days: { ...p.days, [activeDayStr]: updateDayItems(p.days[activeDayStr]!, currentItems) }
        };
      }
      return p;
    });
    onUpdateTrip({ ...trip, plans: updatedPlans });
  }, [trip, activePlan, activeDayStr, onUpdateTrip]);

  const handleMoveScheduleItem = useCallback((index: number, direction: 'up' | 'down') => {
    const updatedPlans = trip.plans.map(p => {
      if (p.id === activePlan.id) {
        const currentItems = [...(p.days[activeDayStr]?.scheduleItems || [])];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= currentItems.length) return p;
        [currentItems[index], currentItems[targetIndex]] = [currentItems[targetIndex], currentItems[index]];
        return {
          ...p,
          days: { ...p.days, [activeDayStr]: updateDayItems(p.days[activeDayStr]!, currentItems) }
        };
      }
      return p;
    });
    onUpdateTrip({ ...trip, plans: updatedPlans });
  }, [trip, activePlan, activeDayStr, onUpdateTrip]);

  const handleMoveCatalogPlace = useCallback((placeId: string, direction: 'up' | 'down') => {
    if (!catalogLocation) return;
    
    const place = catalogLocation.places.find(p => p.id === placeId);
    if (!place) return;
    
    const groupId = place.placeGroupId || 'new';
    const placesInGroup = catalogLocation.places.filter(p => (p.placeGroupId || 'new') === groupId);
    const indexInGroup = placesInGroup.findIndex(p => p.id === placeId);
    if (indexInGroup === -1) return;
    
    let targetSibling: Place | null = null;
    if (direction === 'up' && indexInGroup > 0) {
      targetSibling = placesInGroup[indexInGroup - 1];
    } else if (direction === 'down' && indexInGroup < placesInGroup.length - 1) {
      targetSibling = placesInGroup[indexInGroup + 1];
    }
    
    if (!targetSibling) return;
    
    const updatedLocations = trip.locations.map(l => {
      if (l.id === catalogLocation.id) {
        const placesCopy = [...l.places];
        const idxA = placesCopy.findIndex(p => p.id === place.id);
        const idxB = placesCopy.findIndex(p => p.id === targetSibling!.id);
        if (idxA !== -1 && idxB !== -1) {
          const temp = placesCopy[idxA];
          placesCopy[idxA] = placesCopy[idxB];
          placesCopy[idxB] = temp;
        }
        return {
          ...l,
          places: placesCopy
        };
      }
      return l;
    });
    
    onUpdateTrip({
      ...trip,
      locations: updatedLocations
    });
  }, [catalogLocation, trip, onUpdateTrip]);



  // ----------------------------------------------------
  // Notes Editing (Shared at Trip / Location level)
  // ----------------------------------------------------
  const savePlaceNotes = useCallback((placeId: string, notes: string) => {
    const updatedLocations = trip.locations.map(l => {
      if (l.places.some(p => p.id === placeId)) {
        const updatedPlaces = l.places.map(p => {
          if (p.id === placeId) {
            return { ...p, notes };
          }
          return p;
        });
        return { ...l, places: updatedPlaces };
      }
      return l;
    });

    onUpdateTrip({
      ...trip,
      locations: updatedLocations
    });
  }, [trip, onUpdateTrip]);

  const handleAddScheduleNote = useCallback((insertAtIndex: number, text: string) => {
    onUpdateTrip(prevTrip => {
      const updatedPlans = prevTrip.plans.map(p => {
        if (p.id !== activePlan.id) return p;
        const day = p.days[activeDayStr];
        if (!day) return p;
        const currentItems = [...(day.scheduleItems || [])];
        currentItems.splice(insertAtIndex, 0, { type: 'note', id: crypto.randomUUID(), text: text.trim() });
        return { ...p, days: { ...p.days, [activeDayStr]: updateDayItems(day, currentItems) } };
      });
      return { ...prevTrip, plans: updatedPlans };
    });
  }, [activePlan.id, activeDayStr, onUpdateTrip]);

  const handleUpdateScheduleNote = useCallback((itemIndex: number, text: string) => {
    onUpdateTrip(prevTrip => {
      const updatedPlans = prevTrip.plans.map(p => {
        if (p.id !== activePlan.id) return p;
        const day = p.days[activeDayStr];
        if (!day) return p;
        const currentItems = day.scheduleItems ? [...day.scheduleItems] : [];
        const item = currentItems[itemIndex];
        if (!item || item.type !== 'note') return p;
        currentItems[itemIndex] = { ...item, text: text.trim() };
        return { ...p, days: { ...p.days, [activeDayStr]: { ...day, scheduleItems: currentItems } } };
      });
      return { ...prevTrip, plans: updatedPlans };
    });
  }, [activePlan.id, activeDayStr, onUpdateTrip]);

  const handleDeleteScheduleNote = useCallback((itemIndex: number) => {
    onUpdateTrip(prevTrip => {
      const updatedPlans = prevTrip.plans.map(p => {
        if (p.id !== activePlan.id) return p;
        const day = p.days[activeDayStr];
        if (!day) return p;
        const currentItems = [...(day.scheduleItems || [])];
        currentItems.splice(itemIndex, 1);
        return { ...p, days: { ...p.days, [activeDayStr]: updateDayItems(day, currentItems) } };
      });
      return { ...prevTrip, plans: updatedPlans };
    });
  }, [activePlan.id, activeDayStr, onUpdateTrip]);

  const handleAddReservationEventToSchedule = useCallback((item: ScheduleHotelEventItem | ScheduleTransitEventItem | SchedulePlaceReservationEventItem, insertAtIndex?: number) => {
    onUpdateTrip(prevTrip => {
      const updatedPlans = prevTrip.plans.map(p => {
        if (p.id !== activePlan.id) return p;
        const day = p.days[activeDayStr];
        if (!day) return p;
        const current = day.scheduleItems ?? [];
        const idx = insertAtIndex ?? current.length;
        const newItems = [...current.slice(0, idx), item, ...current.slice(idx)];
        return { ...p, days: { ...p.days, [activeDayStr]: updateDayItems(day, newItems) } };
      });
      return { ...prevTrip, plans: updatedPlans };
    });
  }, [activePlan.id, activeDayStr, onUpdateTrip]);

  const handleUpdateScheduleItemTime = useCallback((itemIndex: number, time: string) => {
    onUpdateTrip(prevTrip => {
      const updatedPlans = prevTrip.plans.map(p => {
        if (p.id !== activePlan.id) return p;
        const day = p.days[activeDayStr];
        if (!day) return p;
        const items = [...(day.scheduleItems ?? [])];
        const it = items[itemIndex];
        if (!it || (it.type !== 'hotel-event' && it.type !== 'transit-event')) return p;
        items[itemIndex] = { ...it, time };
        return { ...p, days: { ...p.days, [activeDayStr]: updateDayItems(day, items) } };
      });
      return { ...prevTrip, plans: updatedPlans };
    });
  }, [activePlan.id, activeDayStr, onUpdateTrip]);

  // ----------------------------------------------------
  // Custom Groups Operations
  // ----------------------------------------------------
  const handleSavePlaceGroup = (groupData: { name: string; color: string; icon: string }) => {
    const currentGroups = trip.placeGroups || DEFAULT_PLACE_GROUPS;

    if (editingGroup) {
      // Edit mode
      const updatedGroups = currentGroups.map(pg => {
        if (pg.id === editingGroup.id) {
          return {
            ...pg,
            ...groupData
          };
        }
        return pg;
      });

      onUpdateTrip({
        ...trip,
        placeGroups: updatedGroups
      });
      setEditingGroup(null);
    } else {
      // Create mode
      const newGroup: PlaceGroup = {
        id: `group-${Date.now()}`,
        ...groupData
      };

      onUpdateTrip({
        ...trip,
        placeGroups: [...currentGroups, newGroup]
      });
    }

    setShowGroupModal(false);
  };

  const handleDeletePlaceGroup = () => {
    if (!editingGroup) return;

    setConfirmModal({
      title: 'Delete Place Group',
      message: `Are you sure you want to delete the group "${editingGroup.name}"? All places in this group will be moved to "New / Unassigned".`,
      confirmText: 'Delete Group',
      onConfirm: () => {
        const currentGroups = trip.placeGroups || DEFAULT_PLACE_GROUPS;
        const updatedGroups = currentGroups.filter(pg => pg.id !== editingGroup.id);

        // Reassign all places that have placeGroupId === editingGroup.id to 'new'
        const updatedLocations = trip.locations.map(l => {
          const updatedPlaces = l.places.map(p => {
            if (p.placeGroupId === editingGroup.id) {
              return {
                ...p,
                placeGroupId: 'new'
              };
            }
            return p;
          });
          return {
            ...l,
            places: updatedPlaces
          };
        });

        onUpdateTrip({
          ...trip,
          placeGroups: updatedGroups,
          locations: updatedLocations
        });

        setEditingGroup(null);
        setShowGroupModal(false);
      }
    });
  };

  const startEditingGroup = useCallback((group: PlaceGroup) => {
    setEditingGroup(group);
    setShowGroupModal(true);
  }, []);

  const handleMoveGroupOrder = useCallback((index: number, direction: 'up' | 'down') => {
    const currentGroups = [...(trip.placeGroups || DEFAULT_PLACE_GROUPS)];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= currentGroups.length) return;

    // Swap elements
    const temp = currentGroups[index];
    currentGroups[index] = currentGroups[targetIndex];
    currentGroups[targetIndex] = temp;

    onUpdateTrip({
      ...trip,
      placeGroups: currentGroups
    });
  }, [trip, onUpdateTrip]);

  // ==========================================
  // EXPENSES CRUD HANDLERS
  // ==========================================
  const handleAddExpense = useCallback((groupId: string) => {
    setEditingExpense({
      id: '',
      title: '',
      notes: '',
      date: '',
      groupId,
      lineItems: []
    });
    setShowExpenseModal(true);
  }, []);

  const handleEditExpense = useCallback((expense: ExpenseItem) => {
    setEditingExpense(expense);
    setShowExpenseModal(true);
  }, []);

  const handleSaveExpense = useCallback((expenseData: {
    title: string;
    notes: string;
    date?: string;
    groupId: string;
    lineItems: ExpenseLine[];
  }) => {
    if (!editingExpense) return;

    const isLinked = !!editingExpense.linkedReservationId;
    const linkedType = editingExpense.linkedReservationType;
    const linkedId = editingExpense.linkedReservationId;

    if (isLinked) {
      // Modify linked hotel or transport reservation
      const updatedPlans = trip.plans.map(p => {
        if (p.id !== activePlan.id) return p;

        if (linkedType === 'hotel') {
          const updatedHotels = (p.hotels || []).map(h => {
            if (h.id !== linkedId) return h;
            return {
              ...h,
              name: expenseData.title,
              notes: expenseData.notes,
              expenses: expenseData.lineItems
            };
          });
          return { ...p, hotels: updatedHotels };
        } else if (linkedType === 'transit') {
          const updatedTransports = (p.transports || []).map(t => {
            if (t.id !== linkedId) return t;
            return {
              ...t,
              name: expenseData.title,
              notes: expenseData.notes,
              expenses: expenseData.lineItems
            };
          });
          return { ...p, transports: updatedTransports };
        }
        return p;
      });

      onUpdateTrip({
        ...trip,
        plans: updatedPlans
      });
    } else {
      // Modify manual expense
      const updatedPlans = trip.plans.map(p => {
        if (p.id !== activePlan.id) return p;

        const currentExpenses = p.expenses ? [...p.expenses] : [];
        if (editingExpense.id) {
          // Edit existing
          const idx = currentExpenses.findIndex(e => e.id === editingExpense.id);
          if (idx !== -1) {
            currentExpenses[idx] = {
              ...currentExpenses[idx],
              title: expenseData.title,
              notes: expenseData.notes,
              date: expenseData.date,
              groupId: expenseData.groupId,
              lineItems: expenseData.lineItems
            };
          }
        } else {
          // Create new manual expense
          currentExpenses.push({
            id: `expense-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: expenseData.title,
            notes: expenseData.notes,
            date: expenseData.date,
            groupId: expenseData.groupId,
            lineItems: expenseData.lineItems
          });
        }

        return { ...p, expenses: currentExpenses };
      });

      onUpdateTrip({
        ...trip,
        plans: updatedPlans
      });
    }

    setEditingExpense(null);
    setShowExpenseModal(false);
  }, [editingExpense, activePlan, trip, onUpdateTrip]);

  const handleDeleteExpense = useCallback(() => {
    if (!editingExpense) return;

    const isLinked = !!editingExpense.linkedReservationId;
    const linkedType = editingExpense.linkedReservationType;
    const linkedId = editingExpense.linkedReservationId;

    const performDelete = () => {
      if (isLinked) {
        // Clear expenses on linked reservation
        const updatedPlans = trip.plans.map(p => {
          if (p.id !== activePlan.id) return p;

          if (linkedType === 'hotel') {
            const updatedHotels = (p.hotels || []).map(h => {
              if (h.id !== linkedId) return h;
              return { ...h, expenses: [] };
            });
            return { ...p, hotels: updatedHotels };
          } else if (linkedType === 'transit') {
            const updatedTransports = (p.transports || []).map(t => {
              if (t.id !== linkedId) return t;
              return { ...t, expenses: [] };
            });
            return { ...p, transports: updatedTransports };
          }
          return p;
        });

        onUpdateTrip({
          ...trip,
          plans: updatedPlans
        });
      } else {
        // Delete manual expense
        const updatedPlans = trip.plans.map(p => {
          if (p.id !== activePlan.id) return p;
          const currentExpenses = (p.expenses || []).filter(e => e.id !== editingExpense.id);
          return { ...p, expenses: currentExpenses };
        });

        onUpdateTrip({
          ...trip,
          plans: updatedPlans
        });
      }

      setEditingExpense(null);
      setShowExpenseModal(false);
    };

    if (isLinked) {
      setConfirmModal({
        title: 'Clear Reservation Expenses',
        message: `Are you sure you want to clear all expense items for "${editingExpense.title}"? This will keep the reservation but delete its associated expense line items.`,
        confirmText: 'Clear Expenses',
        onConfirm: performDelete
      });
    } else {
      setConfirmModal({
        title: 'Delete Expense',
        message: `Are you sure you want to delete the expense "${editingExpense.title}"?`,
        confirmText: 'Delete',
        onConfirm: performDelete
      });
    }
  }, [editingExpense, activePlan, trip, onUpdateTrip]);

  const handleAddExpenseGroup = useCallback(() => {
    setEditingExpenseGroup(null);
    setShowExpenseGroupModal(true);
  }, []);

  const handleEditExpenseGroup = useCallback((group: ExpenseGroup) => {
    setEditingExpenseGroup(group);
    setShowExpenseGroupModal(true);
  }, []);

  const handleSaveExpenseGroup = useCallback((groupData: { name: string; icon: string; color: string }) => {
    const updatedPlans = trip.plans.map(p => {
      if (p.id !== activePlan.id) return p;

      const currentGroups = p.expenseGroups ? [...p.expenseGroups] : [];
      if (editingExpenseGroup) {
        // Edit existing
        const idx = currentGroups.findIndex(g => g.id === editingExpenseGroup.id);
        if (idx !== -1) {
          currentGroups[idx] = {
            ...currentGroups[idx],
            name: groupData.name,
            icon: groupData.icon,
            color: groupData.color
          };
        }
      } else {
        // Create new group
        currentGroups.push({
          id: `expgroup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: groupData.name,
          icon: groupData.icon,
          color: groupData.color
        });
      }

      return { ...p, expenseGroups: currentGroups };
    });

    onUpdateTrip({
      ...trip,
      plans: updatedPlans
    });

    setEditingExpenseGroup(null);
    setShowExpenseGroupModal(false);
  }, [editingExpenseGroup, activePlan, trip, onUpdateTrip]);

  const handleDeleteExpenseGroup = useCallback(() => {
    if (!editingExpenseGroup) return;

    setConfirmModal({
      title: 'Delete Expense Group',
      message: `Are you sure you want to delete the group "${editingExpenseGroup.name}"? All custom manual expenses in this group will also be permanently deleted.`,
      confirmText: 'Delete Group',
      onConfirm: () => {
        const updatedPlans = trip.plans.map(p => {
          if (p.id !== activePlan.id) return p;

          const currentGroups = (p.expenseGroups || []).filter(g => g.id !== editingExpenseGroup.id);
          const currentExpenses = (p.expenses || []).filter(e => e.groupId !== editingExpenseGroup.id);

          return {
            ...p,
            expenseGroups: currentGroups,
            expenses: currentExpenses
          };
        });

        onUpdateTrip({
          ...trip,
          plans: updatedPlans
        });

        setEditingExpenseGroup(null);
        setShowExpenseGroupModal(false);
      }
    });
  }, [editingExpenseGroup, activePlan, trip, onUpdateTrip]);

  const handleMoveExpenseGroup = useCallback((index: number, direction: 'up' | 'down') => {
    const updatedPlans = trip.plans.map(p => {
      if (p.id !== activePlan.id) return p;

      const currentGroups = [...(p.expenseGroups || [])];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;

      if (targetIndex < 0 || targetIndex >= currentGroups.length) return p;

      // Swap
      const temp = currentGroups[index];
      currentGroups[index] = currentGroups[targetIndex];
      currentGroups[targetIndex] = temp;

      return { ...p, expenseGroups: currentGroups };
    });

    onUpdateTrip({
      ...trip,
      plans: updatedPlans
    });
  }, [activePlan, trip, onUpdateTrip]);

  // --- Reservation Group handlers ---

  const handleAddReservationGroup = useCallback(() => {
    setEditingReservationGroup(null);
    setShowReservationGroupModal(true);
  }, []);

  const handleEditReservationGroup = useCallback((group: ReservationGroup) => {
    setEditingReservationGroup(group);
    setShowReservationGroupModal(true);
  }, []);

  const handleSaveReservationGroup = useCallback((groupData: { name: string; icon: string; color: string }) => {
    const updatedPlans = trip.plans.map(p => {
      if (p.id !== activePlan.id) return p;
      const currentGroups = p.reservationGroups ? [...p.reservationGroups] : [...DEFAULT_RESERVATION_GROUPS];
      if (editingReservationGroup) {
        const idx = currentGroups.findIndex(g => g.id === editingReservationGroup.id);
        if (idx !== -1) {
          currentGroups[idx] = { ...currentGroups[idx], name: groupData.name, icon: groupData.icon, color: groupData.color };
        }
      } else {
        currentGroups.push({
          id: `rg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          name: groupData.name,
          icon: groupData.icon,
          color: groupData.color
        });
      }
      return { ...p, reservationGroups: currentGroups };
    });
    onUpdateTrip({ ...trip, plans: updatedPlans });
    setEditingReservationGroup(null);
    setShowReservationGroupModal(false);
  }, [editingReservationGroup, activePlan, trip, onUpdateTrip]);

  const handleDeleteReservationGroup = useCallback(() => {
    if (!editingReservationGroup) return;
    setConfirmModal({
      title: 'Delete Reservation Group',
      message: `Are you sure you want to delete the "${editingReservationGroup.name}" group and all its reservations?`,
      confirmText: 'Delete',
      onConfirm: () => {
        const updatedPlans = trip.plans.map(p => {
          if (p.id !== activePlan.id) return p;
          const currentGroups = (p.reservationGroups || []).filter(g => g.id !== editingReservationGroup.id);
          const currentReservations = (p.genericReservations || []).filter(r => r.groupId !== editingReservationGroup.id);
          return { ...p, reservationGroups: currentGroups, genericReservations: currentReservations };
        });
        onUpdateTrip({ ...trip, plans: updatedPlans });
        setEditingReservationGroup(null);
        setShowReservationGroupModal(false);
      }
    });
  }, [editingReservationGroup, activePlan, trip, onUpdateTrip]);

  const handleMoveReservationGroup = useCallback((index: number, direction: 'up' | 'down') => {
    const updatedPlans = trip.plans.map(p => {
      if (p.id !== activePlan.id) return p;
      const currentGroups = [...(p.reservationGroups || DEFAULT_RESERVATION_GROUPS)];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= currentGroups.length) return p;
      const temp = currentGroups[index];
      currentGroups[index] = currentGroups[targetIndex];
      currentGroups[targetIndex] = temp;
      return { ...p, reservationGroups: currentGroups };
    });
    onUpdateTrip({ ...trip, plans: updatedPlans });
  }, [activePlan, trip, onUpdateTrip]);

  // --- Generic Reservation handlers ---

  const handleAddGenericReservation = useCallback((groupId: string) => {
    setTargetGenericReservationGroupId(groupId);
    setEditingGenericReservation(null);
    setShowGenericReservationModal(true);
  }, []);

  const handleEditGenericReservation = useCallback((reservation: GenericReservation) => {
    setTargetGenericReservationGroupId(reservation.groupId);
    setEditingGenericReservation(reservation);
    setShowGenericReservationModal(true);
  }, []);

  const handleSaveGenericReservation = useCallback((data: Omit<GenericReservation, 'id' | 'groupId'>) => {
    const groupId = targetGenericReservationGroupId;
    if (!groupId) return;
    const updatedPlans = trip.plans.map(p => {
      if (p.id !== activePlan.id) return p;
      const current = [...(p.genericReservations || [])];
      if (editingGenericReservation) {
        const idx = current.findIndex(r => r.id === editingGenericReservation.id);
        if (idx !== -1) current[idx] = { ...editingGenericReservation, ...data };
      } else {
        current.push({
          id: `gr-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          groupId,
          ...data
        });
      }
      return { ...p, genericReservations: current };
    });
    onUpdateTrip({ ...trip, plans: updatedPlans });
    setEditingGenericReservation(null);
    setTargetGenericReservationGroupId(null);
    setShowGenericReservationModal(false);
  }, [editingGenericReservation, targetGenericReservationGroupId, activePlan, trip, onUpdateTrip]);

  const handleDeleteGenericReservation = useCallback((id?: string) => {
    const targetId = id || editingGenericReservation?.id;
    if (!targetId) return;
    const targetRes = (activePlan.genericReservations || []).find(r => r.id === targetId) || editingGenericReservation;
    setConfirmModal({
      title: 'Delete Reservation',
      message: `Are you sure you want to delete "${targetRes?.title || 'this reservation'}"?`,
      confirmText: 'Delete',
      onConfirm: () => {
        const updatedPlans = trip.plans.map(p => {
          if (p.id !== activePlan.id) return p;
          return { ...p, genericReservations: (p.genericReservations || []).filter(r => r.id !== targetId) };
        });
        onUpdateTrip({ ...trip, plans: updatedPlans });
        if (editingGenericReservation?.id === targetId) {
          setEditingGenericReservation(null);
          setShowGenericReservationModal(false);
        }
      }
    });
  }, [editingGenericReservation, activePlan, trip, onUpdateTrip]);

  // --- Place Reservation (Attraction & Dining) handlers ---

  const handleAddPlaceReservation = useCallback((type: 'attraction' | 'dining') => {
    setEditingPlaceReservation(null);
    setPlaceReservationDefaultType(type);
    setShowPlaceReservationModal(true);
  }, []);

  const handleEditPlaceReservation = useCallback((reservation: PlaceReservation) => {
    setEditingPlaceReservation(reservation);
    setPlaceReservationDefaultType(reservation.type);
    setShowPlaceReservationModal(true);
  }, []);

  const handleSavePlaceReservation = useCallback((data: Omit<PlaceReservation, 'id'>) => {
    let resId = editingPlaceReservation?.id;
    if (!resId || resId === 'imported-draft') {
      resId = `pres-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    }

    const updatedPlans = trip.plans.map(p => {
      if (p.id !== activePlan.id) return p;
      const current = [...(p.placeReservations || [])];
      const existingIdx = current.findIndex(r => r.id === resId);
      const updatedRes: PlaceReservation = { id: resId!, ...data };
      if (existingIdx !== -1) {
        current[existingIdx] = updatedRes;
      } else {
        current.push(updatedRes);
      }
      return { ...p, placeReservations: current };
    });

    // Title sync with catalog place
    let updatedLocations = trip.locations;
    if (data.placeId) {
      updatedLocations = trip.locations.map(loc => ({
        ...loc,
        places: loc.places.map(place => {
          if (place.id === data.placeId && place.title !== data.title) {
            return { ...place, title: data.title };
          }
          return place;
        })
      }));
    }

    onUpdateTrip({ ...trip, locations: updatedLocations, plans: updatedPlans });
    setEditingPlaceReservation(null);
    setShowPlaceReservationModal(false);
  }, [editingPlaceReservation, activePlan, trip, onUpdateTrip]);

  const handleDeletePlaceReservation = useCallback(() => {
    if (!editingPlaceReservation) return;
    setConfirmModal({
      title: 'Delete Reservation',
      message: `Are you sure you want to delete "${editingPlaceReservation.title}"?`,
      confirmText: 'Delete',
      onConfirm: () => {
        const id = editingPlaceReservation.id;
        const updatedPlans = trip.plans.map(p => {
          if (p.id !== activePlan.id) return p;
          const filteredReservations = (p.placeReservations || []).filter(r => r.id !== id);
          const updatedDays = { ...p.days };
          Object.keys(updatedDays).forEach(d => {
            const day = updatedDays[d];
            if (!day) return;
            const newSchedule = (day.scheduleItems || []).filter(item => !(item.type === 'place-reservation-event' && (item as SchedulePlaceReservationEventItem).reservationId === id));
            updatedDays[d] = updateDayItems(day, newSchedule);
          });
          return { ...p, placeReservations: filteredReservations, days: updatedDays };
        });
        onUpdateTrip({ ...trip, plans: updatedPlans });
        setEditingPlaceReservation(null);
        setShowPlaceReservationModal(false);
      }
    });
  }, [editingPlaceReservation, activePlan, trip, onUpdateTrip]);

  const handleSaveEditTrip = (name: string, startDate: string, endDate: string) => {
    if (!name.trim() || !startDate || !endDate) return;
    
    if (new Date(startDate) > new Date(endDate)) {
      setConfirmModal({
        title: 'Invalid Dates',
        message: 'Start date must be before or equal to end date.',
        isAlert: true,
        onConfirm: () => {}
      });
      return;
    }

    const currentDuration = getDaysDiff(trip.startDate, trip.endDate) + 1;
    const newDuration = getDaysDiff(startDate, endDate) + 1;

    const performSave = () => {
      const currentDatesList = Object.keys(activePlan?.days || {}).sort();
      const activeDayIndex = currentDatesList.indexOf(activeDayStr);

      const updatedTrip = shiftTripDates(trip, startDate, endDate);
      updatedTrip.name = name.trim();
      
      onUpdateTrip(updatedTrip);
      setShowEditTripModal(false);

      // Adjust active day string
      const newPlanDays = Object.keys(updatedTrip.plans.find(p => p.id === activePlanId)?.days || {}).sort();
      if (newPlanDays.length > 0) {
        if (activeDayIndex >= 0 && activeDayIndex < newPlanDays.length) {
          setActiveDayStr(newPlanDays[activeDayIndex]);
        } else {
          setActiveDayStr(newPlanDays[0]);
        }
      }
    };

    if (newDuration < currentDuration) {
      setConfirmModal({
        title: 'Shorten Trip Duration',
        message: `Are you sure you want to shorten the trip? The last ${currentDuration - newDuration} day(s) of your plan will be permanently deleted.`,
        onConfirm: performSave
      });
    } else {
      performSave();
    }
  };

  // ----------------------------------------------------
  // Transportation Operations
  // ----------------------------------------------------
  const handleAddTransportation = (transportData: Omit<TransportationReservation, 'id'>) => {
    const newTransport: TransportationReservation = {
      id: `transport-${Date.now()}`,
      ...transportData
    };

    const updatedPlans = trip.plans.map(p => {
      if (p.id === activePlan.id) {
        return { ...p, transports: [...p.transports, newTransport] };
      }
      return p;
    });

    onUpdateTrip({ ...trip, plans: updatedPlans });
    setShowTransportModal(false);
  };

  const handleEditTransportation = useCallback((updatedTransport: TransportationReservation) => {
    const updatedPlans = trip.plans.map(p =>
      p.id === activePlan.id
        ? { ...p, transports: p.transports.map(t => t.id === updatedTransport.id ? updatedTransport : t) }
        : p
    );
    onUpdateTrip({ ...trip, plans: updatedPlans });
    setShowTransportModal(false);
    setEditingTransport(null);
  }, [trip, activePlan, onUpdateTrip]);

  const handleOpenEditTransport = useCallback((reservation: TransportationReservation, segmentIndex: number) => {
    setEditingTransport(reservation);
    setEditingTransportationSegmentIndex(segmentIndex);
    setShowTransportModal(true);
  }, []);

  const handleSaveTransportNotes = useCallback((transportId: string, notes: string) => {
    const updatedPlans = trip.plans.map(p =>
      p.id === activePlan.id
        ? { ...p, transports: p.transports.map(t => t.id === transportId ? { ...t, notes } : t) }
        : p
    );
    onUpdateTrip({ ...trip, plans: updatedPlans });
  }, [trip, activePlan, onUpdateTrip]);

  const handleDeleteTransportation = useCallback((reservationId: string, segmentIndex: number) => {
    const reservation = activePlan.transports.find(t => t.id === reservationId);
    if (reservation) setDeleteTransportData({ reservation, segmentIndex });
  }, [activePlan.transports]);

  const handleDeleteTransportationSegment = useCallback((reservationId: string, segmentIndex: number) => {
    const reservation = activePlan.transports.find(t => t.id === reservationId);
    if (!reservation) return;
    const newSegments = reservation.segments.filter((_, i) => i !== segmentIndex);
    if (newSegments.length === 0) {
      // Last segment — delete the entire reservation
      const updatedPlans = trip.plans.map(p =>
        p.id === activePlan.id ? { ...p, transports: p.transports.filter(t => t.id !== reservationId) } : p
      );
      onUpdateTrip({ ...trip, plans: updatedPlans });
    } else {
      const updatedPlans = trip.plans.map(p =>
        p.id === activePlan.id
          ? { ...p, transports: p.transports.map(t => t.id === reservationId ? { ...t, segments: newSegments } : t) }
          : p
      );
      onUpdateTrip({ ...trip, plans: updatedPlans });
    }
    setDeleteTransportData(null);
  }, [trip, activePlan, onUpdateTrip]);

  const executeDeleteTransport = useCallback((id: string) => {
    const updatedPlans = trip.plans.map(p =>
      p.id === activePlan.id ? { ...p, transports: p.transports.filter(t => t.id !== id) } : p
    );
    onUpdateTrip({ ...trip, plans: updatedPlans });
    setDeleteTransportData(null);
    setShowTransportModal(false);
    setEditingTransport(null);
  }, [trip, activePlan.id, onUpdateTrip]);

  // Get transport segments active on a day (returns flat view model)
  const getTransportsForDay = useCallback((dateStr: string): FlatTransportationSegment[] => {
    return flattenReservations(activePlan.transports)
      .filter(seg => seg.departureDate === dateStr || seg.arrivalDate === dateStr);
  }, [activePlan]);

  // ----------------------------------------------------
  // Hotel Operations
  // ----------------------------------------------------
  const handleAddHotel = (hotelData: Omit<Hotel, 'id'>) => {
    const newHotel: Hotel = {
      id: `hotel-${Date.now()}`,
      ...hotelData
    };

    const updatedPlans = trip.plans.map(p => {
      if (p.id === activePlan.id) {
        return {
          ...p,
          hotels: [...p.hotels, newHotel]
        };
      }
      return p;
    });

    onUpdateTrip({
      ...trip,
      plans: updatedPlans
    });

    setShowHotelModal(false);
  };

  const handleEditHotel = useCallback((updatedHotel: Hotel) => {
    const updatedPlans = trip.plans.map(p =>
      p.id === activePlan.id
        ? { ...p, hotels: p.hotels.map(h => h.id === updatedHotel.id ? updatedHotel : h) }
        : p
    );
    onUpdateTrip({ ...trip, plans: updatedPlans });
    setShowHotelModal(false);
    setEditingHotel(null);
  }, [trip, activePlan, onUpdateTrip]);

  const handleOpenEditHotel = useCallback((hotel: Hotel) => {
    setEditingHotel(hotel);
    setShowHotelModal(true);
  }, []);

  const handleSaveHotelNotes = useCallback((hotelId: string, notes: string) => {
    const updatedPlans = trip.plans.map(p =>
      p.id === activePlan.id
        ? { ...p, hotels: p.hotels.map(h => h.id === hotelId ? { ...h, notes } : h) }
        : p
    );
    onUpdateTrip({ ...trip, plans: updatedPlans });
  }, [trip, activePlan, onUpdateTrip]);

  const handleDeleteHotel = useCallback((id: string) => {
    const hotel = activePlan.hotels.find(h => h.id === id);
    if (hotel) setDeleteHotelData(hotel);
  }, [activePlan.hotels]);

  const executeDeleteHotel = useCallback((id: string) => {
    const updatedPlans = trip.plans.map(p =>
      p.id === activePlan.id ? { ...p, hotels: p.hotels.filter(h => h.id !== id) } : p
    );
    onUpdateTrip({ ...trip, plans: updatedPlans });
    setDeleteHotelData(null);
    setShowHotelModal(false);
    setEditingHotel(null);
  }, [trip, activePlan.id, onUpdateTrip]);

  const handleToggleNoHotel = (dateStr: string, checked: boolean) => {
    const updatedPlans = trip.plans.map(p => {
      if (p.id === activePlan.id) {
        const day = p.days[dateStr];
        if (day) {
          return {
            ...p,
            days: {
              ...p.days,
              [dateStr]: {
                ...day,
                noHotel: checked
              }
            }
          };
        }
      }
      return p;
    });
    onUpdateTrip({ ...trip, plans: updatedPlans });
  };

  const handleImportReservationFile = async (type: 'hotel' | 'transit' | 'attraction' | 'dining', file: File) => {
    if (!GeminiService.isAiEnabled()) {
      showApiKeyMissingModal();
      return;
    }

    if (GeminiService.isManualMode()) {
      showAlert('Manual AI Mode', AI_FILE_CONTENTS_NOT_AVAILABLE_IN_MANUAL_MODE_MESSAGE);
      return;
    }

    setIsImportingReservationFile(true);
    setImportingReservationMessage('Preparing file for import...');

    try {
      const fileData = await new Promise<{ base64: string; mimeType: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const result = reader.result as string;
          const commaIdx = result.indexOf(',');
          const base64 = commaIdx > -1 ? result.substring(commaIdx + 1) : result;
          resolve({ base64, mimeType: file.type || 'application/octet-stream' });
        };
        reader.onerror = () => reject(new Error('Failed to read file locally.'));
      });

      let attachment: any = null;

      if (googleToken) {
        setImportingReservationMessage('Uploading file to Google Drive...');
        let folderId = trip.filesFolderId;
        if (!folderId && googleFolderId) {
          folderId = await getOrCreateTripFileFolder(googleToken, googleFolderId, trip.id);
          onUpdateTrip(prev => ({ ...prev, filesFolderId: folderId }));
        }
        if (folderId) {
          const fileId = await uploadFile(googleToken, folderId, file);
          attachment = { name: file.name, filename: file.name, fileId };
        }
      }

      setImportingReservationMessage('AI working in progress...');

      if (type === 'attraction' || type === 'dining') {
        const result = await GeminiService.generatePlaceReservationDetailsFromFilesWithRotation([fileData]);

        let finalLat = result.lat;
        let finalLng = result.lng;
        if (result.address && finalLat === undefined && finalLng === undefined) {
          try {
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(result.address)}&format=json&limit=1`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(url, { signal: controller.signal, headers: { 'Accept-Language': 'en' } });
            clearTimeout(timeout);
            const data = await res.json();
            if (data[0]) {
              finalLat = parseFloat(data[0].lat);
              finalLng = parseFloat(data[0].lon);
            }
          } catch (e) {
            console.error('Geocoding fallback failed:', e);
          }
        }

        const draftPlaceReservation: PlaceReservation = {
          id: 'imported-draft',
          type,
          title: result.title || file.name.substring(0, file.name.lastIndexOf('.')) || (type === 'attraction' ? 'Imported Attraction' : 'Imported Dining'),
          date: result.date || activeDayStr || daysList[0] || '',
          time: result.time || '',
          address: result.address,
          lat: finalLat,
          lng: finalLng,
          confirmationNo: result.confirmationNo,
          bookedThrough: result.bookedThrough,
          expenses: GeminiService.parseExtractedExpenses(result, 'expense-import'),
          notes: result.notes,
          status: 'Planning',
          attachments: attachment ? [attachment] : []
        };
        setEditingPlaceReservation(draftPlaceReservation);
        setPlaceReservationDefaultType(type);
        setShowPlaceReservationModal(true);
      } else if (type === 'hotel') {
        const result = await GeminiService.generateHotelDetailsFromFilesWithRotation([fileData]);
        
        let finalLat = result.lat;
        let finalLng = result.lng;
        if (result.address && finalLat === undefined && finalLng === undefined) {
          try {
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(result.address)}&format=json&limit=1`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(url, { signal: controller.signal, headers: { 'Accept-Language': 'en' } });
            clearTimeout(timeout);
            const data = await res.json();
            if (data[0]) {
              finalLat = parseFloat(data[0].lat);
              finalLng = parseFloat(data[0].lon);
            }
          } catch (e) {
            console.error('Geocoding fallback failed:', e);
          }
        }

        const draftHotel: Hotel = {
          id: 'imported-draft',
          name: result.name || file.name.substring(0, file.name.lastIndexOf('.')) || 'Imported Hotel',
          address: result.address,
          checkInDate: result.checkInDate || activeDayStr || daysList[0] || '',
          checkInTime: result.checkInTime || '15:00',
          checkOutDate: result.checkOutDate || activeDayStr || daysList[0] || '',
          checkOutTime: result.checkOutTime || '11:00',
          confirmationNo: result.confirmationNo,
          bookedThrough: result.bookedThrough,
          expenses: GeminiService.parseExtractedExpenses(result, 'expense-import'),
          lat: finalLat,
          lng: finalLng,
          notes: result.notes,
          status: 'Planning',
          attachments: attachment ? [attachment] : []
        };
        setEditingHotel(draftHotel);
        setShowHotelModal(true);
      } else {
        const result = await GeminiService.generateTransitDetailsFromFilesWithRotation([fileData]);

        let segmentsList = [];
        if (result.segments && result.segments.length > 0) {
          segmentsList = await Promise.all(result.segments.map(async (seg: any, idx: number) => {
            let finalDepLat = seg.departureLat;
            let finalDepLng = seg.departureLng;
            if (seg.departureAddress && finalDepLat === undefined && finalDepLng === undefined) {
              try {
                const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(seg.departureAddress)}&format=json&limit=1`;
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 5000);
                const res = await fetch(url, { signal: controller.signal, headers: { 'Accept-Language': 'en' } });
                clearTimeout(timeout);
                const data = await res.json();
                if (data[0]) {
                  finalDepLat = parseFloat(data[0].lat);
                  finalDepLng = parseFloat(data[0].lon);
                }
              } catch (e) {
                console.error('Departure geocoding fallback failed:', e);
              }
            }

            let finalArrLat = seg.arrivalLat;
            let finalArrLng = seg.arrivalLng;
            if (seg.arrivalAddress && finalArrLat === undefined && finalArrLng === undefined) {
              try {
                const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(seg.arrivalAddress)}&format=json&limit=1`;
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 5000);
                const res = await fetch(url, { signal: controller.signal, headers: { 'Accept-Language': 'en' } });
                clearTimeout(timeout);
                const data = await res.json();
                if (data[0]) {
                  finalArrLat = parseFloat(data[0].lat);
                  finalArrLng = parseFloat(data[0].lon);
                }
              } catch (e) {
                console.error('Arrival geocoding fallback failed:', e);
              }
            }

            return {
              id: `seg-${Date.now()}-${Math.random().toString(36).slice(2)}-${idx}`,
              carrier: seg.carrier,
              transitCode: seg.transitCode,
              departureLocationName: seg.departureLocationName || '',
              departureAddress: seg.departureAddress,
              departureDate: seg.departureDate || activeDayStr || daysList[0] || '',
              departureTime: seg.departureTime || '12:00',
              departureTimezone: seg.departureTimezone || 'UTC',
              departureLat: finalDepLat,
              departureLng: finalDepLng,
              arrivalLocationName: seg.arrivalLocationName || '',
              arrivalAddress: seg.arrivalAddress,
              arrivalDate: seg.arrivalDate || activeDayStr || daysList[0] || '',
              arrivalTime: seg.arrivalTime || '14:00',
              arrivalTimezone: seg.arrivalTimezone || 'UTC',
              arrivalLat: finalArrLat,
              arrivalLng: finalArrLng,
            };
          }));
        } else {
          let finalDepLat = result.departureLat;
          let finalDepLng = result.departureLng;
          if (result.departureAddress && finalDepLat === undefined && finalDepLng === undefined) {
            try {
              const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(result.departureAddress)}&format=json&limit=1`;
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 5000);
              const res = await fetch(url, { signal: controller.signal, headers: { 'Accept-Language': 'en' } });
              clearTimeout(timeout);
              const data = await res.json();
              if (data[0]) {
                finalDepLat = parseFloat(data[0].lat);
                finalDepLng = parseFloat(data[0].lon);
              }
            } catch (e) {
              console.error('Departure geocoding fallback failed:', e);
            }
          }

          let finalArrLat = result.arrivalLat;
          let finalArrLng = result.arrivalLng;
          if (result.arrivalAddress && finalArrLat === undefined && finalArrLng === undefined) {
            try {
              const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(result.arrivalAddress)}&format=json&limit=1`;
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 5000);
              const res = await fetch(url, { signal: controller.signal, headers: { 'Accept-Language': 'en' } });
              clearTimeout(timeout);
              const data = await res.json();
              if (data[0]) {
                finalArrLat = parseFloat(data[0].lat);
                finalArrLng = parseFloat(data[0].lon);
              }
            } catch (e) {
              console.error('Arrival geocoding fallback failed:', e);
            }
          }

          segmentsList = [{
            id: `seg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            carrier: result.carrier,
            transitCode: result.transitCode,
            departureLocationName: result.departureLocationName || '',
            departureAddress: result.departureAddress,
            departureDate: result.departureDate || activeDayStr || daysList[0] || '',
            departureTime: result.departureTime || '12:00',
            departureTimezone: result.departureTimezone || 'UTC',
            departureLat: finalDepLat,
            departureLng: finalDepLng,
            arrivalLocationName: result.arrivalLocationName || '',
            arrivalAddress: result.arrivalAddress,
            arrivalDate: result.arrivalDate || activeDayStr || daysList[0] || '',
            arrivalTime: result.arrivalTime || '14:00',
            arrivalTimezone: result.arrivalTimezone || 'UTC',
            arrivalLat: finalArrLat,
            arrivalLng: finalArrLng,
          }];
        }

        const draftTransit: TransportationReservation = {
          id: 'imported-draft',
          name: result.name || `Transit ${file.name.substring(0, file.name.lastIndexOf('.'))}`,
          type: (result.type as any) || 'flight',
          confirmationNo: result.confirmationNo,
          bookedThrough: result.bookedThrough,
          expenses: GeminiService.parseExtractedExpenses(result, 'expense-import'),
          notes: result.notes,
          status: 'Planning',
          attachments: attachment ? [attachment] : [],
          segments: segmentsList
        };
        setEditingTransport(draftTransit);
        setShowTransportModal(true);
      }
    } catch (err: any) {
      console.error(err);
      showAlert('Import Failed', err.message || 'An error occurred during file import.');
    } finally {
      setIsImportingReservationFile(false);
      setImportingReservationMessage('');
    }
  };

  // Get hotels overlapping with active day
  const getHotelsForDay = useCallback((dateStr: string) => {
    const d = new Date(dateStr);
    return activePlan.hotels.filter(h => {
      const inD = new Date(h.checkInDate);
      const outD = new Date(h.checkOutDate);
      // Stay overlaps if active day is between checkIn and checkOut (exclusive or inclusive)
      return d >= inD && d <= outD;
    });
  }, [activePlan]);

  // Save Trip AI Config (baby logistics checkbox & custom AI fields)
  const handleSaveTripAiConfig = (
    customAiFields: { title: string; key: string; description: string; icon?: string; disabled?: boolean; }[],
    disabledPlaceFields?: string[],
    disabledDayFields?: string[],
    placeFieldsOrder?: string[]
  ) => {
    onUpdateTrip({
      ...trip,
      customAiFields,
      disabledPlaceFields: disabledPlaceFields || [],
      disabledDayFields: disabledDayFields || [],
      placeFieldsOrder: placeFieldsOrder || []
    });
  };

  // Generate tips for a single day
  const handleGenerateSingleDayTips = async (dateStr: string) => {
    if (!GeminiService.isAiEnabled()) { showApiKeyMissingModal(); return; }

    const day = activePlan.days[dateStr];
    if (!day) return;

    const location = trip.locations.find(l => l.id === day.locationId) || trip.locations[0];
    const dayPlaces = day.placeIds.map(pid => {
      const p = location?.places.find(pl => pl.id === pid);
      return p ? { title: p.title, description: p.description, openingHours: p.openingHours, lat: p.lat, lng: p.lng, notes: p.notes } : null;
    }).filter(Boolean) as { title: string; description?: string; openingHours?: string; lat?: number; lng?: number; notes?: string }[];
    const dayHotels = getHotelsForDay(dateStr).filter(h => h.status !== 'Canceled').map(h =>
      `${h.name}${h.address ? ` at ${h.address}` : ''}, check-in: ${h.checkInDate}${h.checkInTime ? ` ${h.checkInTime}` : ''}, check-out: ${h.checkOutDate}${h.checkOutTime ? ` ${h.checkOutTime}` : ''}${h.confirmationNo ? `, conf#: ${h.confirmationNo}` : ''}`
    );
    const dayTransports = getTransportsForDay(dateStr).filter(t => t.status !== 'Canceled').map(t =>
      `${t.type.toUpperCase()}: ${t.departureLocationName} -> ${t.arrivalLocationName} on ${t.departureDate} ${t.departureTime} (${t.departureTimezone})${t.carrier ? `, carrier: ${t.carrier}` : ''}${t.transitCode ? ` ${t.transitCode}` : ''}${t.confirmationNo ? `, conf#: ${t.confirmationNo}` : ''}`
    );
    const dayPayload = [{ dateStr, dayNumber: daysList.indexOf(dateStr) + 1, locationCity: location?.city || '', locationCountry: location?.country || '', places: dayPlaces, hotels: dayHotels, transports: dayTransports }];
    const enableBaby = !trip.disabledDayFields?.includes('baby_logistics');

    await runAiCall({
      label: `Daily Tips: ${dateStr}`,
      buildPrompt: () => GeminiService.buildDailyTipsPrompt(dayPayload, enableBaby, trip.disabledDayFields),
      parse: GeminiService.parseDailyTipsResponse,
      liveCall: () => GeminiService.generateDailyTipsWithRotation(dayPayload, enableBaby, undefined, trip.disabledDayFields),
      onSuccess: (results) => {
        if (results && results.length > 0) {
          const res = results[0];
          onUpdateTrip(prevTrip => ({
            ...prevTrip,
            plans: prevTrip.plans.map(p => p.id === activePlan.id ? {
              ...p,
              days: { ...p.days, [dateStr]: { ...p.days[dateStr], aiDetails: res.aiDetails, aiUpdatedAt: Date.now() } }
            } : p)
          }));
        }
      },
      onError: (err) => showAlert('AI Error', `Failed to parse AI response: ${err.message}`),
      onLoadingChange: (loading) => setDaysGeneratingDates(prev => {
        const next = new Set(prev);
        loading ? next.add(dateStr) : next.delete(dateStr);
        return next;
      }),
      showManualPrompt: showManualAiPrompt,
    });
  };

  // Batch generate daily tips
  const handleGenerateDaysTips = async (selectedDates: string[]) => {
    if (selectedDates.length === 0) return;
    if (!GeminiService.isAiEnabled()) throw new Error(AI_NOT_CONFIGURED_MESSAGE);

    // Sort dates chronologically to ensure consistent sequence and avoid LLM date-mapping confusion
    const sortedDates = [...selectedDates].sort((a, b) => a.localeCompare(b));

    const daysPayload = sortedDates.map(dateStr => {
      const day = activePlan.days[dateStr];
      const location = trip.locations.find(l => l.id === day?.locationId) || trip.locations[0];
      const dayPlaces = day ? day.placeIds.map(pid => {
        const p = location?.places.find(pl => pl.id === pid);
        return p ? { title: p.title, description: p.description, openingHours: p.openingHours, lat: p.lat, lng: p.lng, notes: p.notes } : null;
      }).filter(Boolean) as { title: string; description?: string; openingHours?: string; lat?: number; lng?: number; notes?: string }[] : [];
      const dayHotels = getHotelsForDay(dateStr).filter(h => h.status !== 'Canceled').map(h =>
        `${h.name}${h.address ? ` at ${h.address}` : ''}, check-in: ${h.checkInDate}${h.checkInTime ? ` ${h.checkInTime}` : ''}, check-out: ${h.checkOutDate}${h.checkOutTime ? ` ${h.checkOutTime}` : ''}${h.confirmationNo ? `, conf#: ${h.confirmationNo}` : ''}`
      );
      const dayTransports = getTransportsForDay(dateStr).filter(t => t.status !== 'Canceled').map(t =>
        `${t.type.toUpperCase()}: ${t.departureLocationName} -> ${t.arrivalLocationName} on ${t.departureDate} ${t.departureTime} (${t.departureTimezone})${t.carrier ? `, carrier: ${t.carrier}` : ''}${t.transitCode ? ` ${t.transitCode}` : ''}${t.confirmationNo ? `, conf#: ${t.confirmationNo}` : ''}`
      );
      return { dateStr, dayNumber: daysList.indexOf(dateStr) + 1, locationCity: location?.city || '', locationCountry: location?.country || '', places: dayPlaces, hotels: dayHotels, transports: dayTransports };
    });
    const enableBaby = !trip.disabledDayFields?.includes('baby_logistics');

    await runAiCall({
      label: `Daily Tips: ${sortedDates.length} Day(s)`,
      buildPrompt: () => GeminiService.buildDailyTipsPrompt(daysPayload, enableBaby, trip.disabledDayFields),
      parse: GeminiService.parseDailyTipsResponse,
      liveCall: () => GeminiService.generateDailyTipsWithRotation(daysPayload, enableBaby, undefined, trip.disabledDayFields),
      onSuccess: (results) => {
        onUpdateTrip(prevTrip => ({
          ...prevTrip,
          plans: prevTrip.plans.map(p => {
            if (p.id === activePlan.id) {
              const updatedDays = { ...p.days };
              results.forEach(res => {
                const day = updatedDays[res.dateStr];
                if (day) updatedDays[res.dateStr] = { ...day, aiDetails: res.aiDetails, aiUpdatedAt: Date.now() };
              });
              return { ...p, days: updatedDays };
            }
            return p;
          })
        }));
      },
      onError: (err) => showAlert('AI Error', `Failed to parse AI response: ${err.message}`),
      onLoadingChange: (loading) => setDaysGeneratingDates(prev => {
        const next = new Set(prev);
        sortedDates.forEach(d => loading ? next.add(d) : next.delete(d));
        return next;
      }),
      showManualPrompt: showManualAiPrompt,
    });
  };

  // Generate trip checklist
  const handleGenerateTripChecklist = async () => {
    if (!GeminiService.isAiEnabled()) { showApiKeyMissingModal(); return; }

    const allScheduledPlaceIds = new Set<string>();
    Object.values(activePlan.days).forEach(day => { day.placeIds.forEach(pid => allScheduledPlaceIds.add(pid)); });
    const placesWithReservations: { title: string; reservationDetails?: string }[] = [];
    trip.locations.forEach(loc => {
      loc.places.forEach(p => {
        if (allScheduledPlaceIds.has(p.id)) {
          placesWithReservations.push({ title: p.title, reservationDetails: p.aiDetails?.reservation || p.notes });
        }
      });
    });
    const tripInfo = {
      name: trip.name, startDate: trip.startDate, endDate: trip.endDate,
      locations: trip.locations.map(l => ({ city: l.city, country: l.country })),
      hotels: activePlan.hotels.filter(h => h.status !== 'Canceled').map(h => ({ name: h.name, checkInDate: h.checkInDate, checkOutDate: h.checkOutDate })),
      transports: activePlan.transports.filter(t => t.status !== 'Canceled').flatMap(t =>
        t.segments.map(s => ({ type: t.type, departureLocationName: s.departureLocationName, arrivalLocationName: s.arrivalLocationName, departureDate: s.departureDate }))
      ),
      places: placesWithReservations
    };
    const enableBabyLogistics = !trip.disabledDayFields?.includes('baby_logistics');

    await runAiCall({
      label: 'Trip Checklist',
      buildPrompt: () => GeminiService.buildTripChecklistPrompt(tripInfo, enableBabyLogistics),
      responseFormat: 'markdown',
      parse: (text) => text,
      liveCall: () => GeminiService.generateTripChecklistWithRotation(tripInfo, enableBabyLogistics),
      onSuccess: (result) => {
        onUpdateTrip(prevTrip => ({
          ...prevTrip,
          plans: prevTrip.plans.map(p => p.id === activePlan.id ? {
            ...p,
            aiDetails: { ...(p.aiDetails || {}), checklist: result },
            aiUpdatedAt: { ...(p.aiUpdatedAt || {}), checklist: Date.now() }
          } : p)
        }));
      },
      onError: (err) => showAlert('AI Error', `Failed to generate checklist: ${err.message}`),
      onLoadingChange: setGeneratingChecklist,
      showManualPrompt: showManualAiPrompt,
    });
  };

  // Generate local essentials
  const handleGenerateLocalEssentials = async () => {
    const locId = selectedCatalogLocId || (trip.locations.length > 0 ? trip.locations[0].id : '');
    const loc = trip.locations.find(l => l.id === locId);
    if (!loc) { showAlert('No Location', 'Please add at least one location to your trip first.'); return; }
    if (!GeminiService.isAiEnabled()) { showApiKeyMissingModal(); return; }

    await runAiCall({
      label: `Local Essentials: ${loc.city}`,
      buildPrompt: () => GeminiService.buildLocalEssentialsPrompt({ city: loc.city, country: loc.country }),
      responseFormat: 'markdown',
      parse: (text) => text,
      liveCall: () => GeminiService.generateLocalEssentialsWithRotation({ city: loc.city, country: loc.country }),
      onSuccess: (result) => {
        onUpdateTrip(prevTrip => ({
          ...prevTrip,
          locations: prevTrip.locations.map(l => l.id === locId ? {
            ...l,
            aiDetails: { ...(l.aiDetails || {}), local_essentials: result },
            aiUpdatedAt: { ...(l.aiUpdatedAt || {}), local_essentials: Date.now() }
          } : l)
        }));
      },
      onError: (err) => showAlert('AI Error', `Failed to generate local essentials: ${err.message}`),
      onLoadingChange: setGeneratingLocalEssentials,
      showManualPrompt: showManualAiPrompt,
    });
  };

  const handleSaveAiChecklist = (newContent: string) => {
    onUpdateTrip(prevTrip => {
      const updatedPlans = prevTrip.plans.map(p => {
        if (p.id === activePlan.id) {
          return {
            ...p,
            aiDetails: {
              ...(p.aiDetails || {}),
              checklist: newContent
            },
            aiUpdatedAt: {
              ...(p.aiUpdatedAt || {}),
              checklist: Date.now()
            }
          };
        }
        return p;
      });
      return {
        ...prevTrip,
        plans: updatedPlans
      };
    });
  };

  const handleSaveAiLocalEssentials = (newContent: string) => {
    const locId = selectedCatalogLocId || (trip.locations.length > 0 ? trip.locations[0].id : '');
    onUpdateTrip(prevTrip => {
      const updatedLocations = prevTrip.locations.map(l => {
        if (l.id === locId) {
          return {
            ...l,
            aiDetails: {
              ...(l.aiDetails || {}),
              local_essentials: newContent
            },
            aiUpdatedAt: {
              ...(l.aiUpdatedAt || {}),
              local_essentials: Date.now()
            }
          };
        }
        return l;
      });
      return {
        ...prevTrip,
        locations: updatedLocations
      };
    });
  };

  const handleSaveDayTips = useCallback((dateStr: string, newContent: string) => {
    const day = activePlan.days[dateStr];
    if (!day) return;
    const updatedDays = {
      ...activePlan.days,
      [dateStr]: {
        ...day,
        aiDetails: {
          ...(day.aiDetails || {}),
          daily_tips: newContent
        },
        aiUpdatedAt: Date.now()
      }
    };
    onUpdateTrip({
      ...trip,
      plans: trip.plans.map(p => p.id === activePlan.id ? { ...p, days: updatedDays } : p)
    });
  }, [activePlan, trip, onUpdateTrip]);

  const handleSaveBabyLogistics = useCallback((dateStr: string, newContent: string) => {
    const day = activePlan.days[dateStr];
    if (!day) return;
    const updatedDays = {
      ...activePlan.days,
      [dateStr]: {
        ...day,
        aiDetails: {
          ...(day.aiDetails || {}),
          baby_logistics: newContent
        },
        aiUpdatedAt: Date.now()
      }
    };
    onUpdateTrip({
      ...trip,
      plans: trip.plans.map(p => p.id === activePlan.id ? { ...p, days: updatedDays } : p)
    });
  }, [activePlan, trip, onUpdateTrip]);

  const handleSaveSuggestedReservations = useCallback((dateStr: string, newContent: string) => {
    const day = activePlan.days[dateStr];
    if (!day) return;
    const updatedDays = {
      ...activePlan.days,
      [dateStr]: {
        ...day,
        aiDetails: {
          ...(day.aiDetails || {}),
          suggested_reservations: newContent
        },
        aiUpdatedAt: Date.now()
      }
    };
    onUpdateTrip({
      ...trip,
      plans: trip.plans.map(p => p.id === activePlan.id ? { ...p, days: updatedDays } : p)
    });
  }, [activePlan, trip, onUpdateTrip]);

  // ----------------------------------------------------
  // Rendering Helpers
  // ----------------------------------------------------
  // Real-time map preview marker for coordinate pin dropping
  let previewMarker: { lat: number; lng: number } | undefined = undefined;
  if (showEditPlaceModal && editingPlace) {
    previewMarker = { lat: editingPlace.lat, lng: editingPlace.lng };
  } else if (showCustomPlaceModal && editingPlace) {
    previewMarker = { lat: editingPlace.lat, lng: editingPlace.lng };
  } else if (showEditLocationModal && catalogLocation) {
    previewMarker = { lat: catalogLocation.lat, lng: catalogLocation.lng };
  }

  // List of scheduled Place objects for the active day (for map display and backward compat)
  const scheduledPlaces: Place[] = (activeDay?.scheduleItems || [])
    .filter(item => item.type === 'place')
    .map(item => {
      const placeId = (item as SchedulePlaceItem).placeId;
      for (const loc of trip.locations) {
        const p = loc.places.find(place => place.id === placeId);
        if (p) return p;
      }
      return undefined;
    })
    .filter(Boolean) as Place[];

  // Find the selected catalog place if activePlaceId is set (also checks AI suggestions)
  const selectedCatalogPlace = useMemo(() => {
    if (!activePlaceId) return null;
    const aiSuggested = aiSuggestedPlaces.find(p => p.id === activePlaceId);
    if (aiSuggested) return aiSuggested;
    for (const loc of trip.locations) {
      const p = loc.places.find(place => place.id === activePlaceId);
      if (p) return p;
    }
    return null;
  }, [activePlaceId, trip.locations, aiSuggestedPlaces]);

  const isSelectedPlaceScheduledOnActiveDay = useMemo(() => {
    if (!activePlaceId || !activeDay) return false;
    return (activeDay.placeIds || []).includes(activePlaceId);
  }, [activePlaceId, activeDay]);

  // Construct displayScheduledPlaces, prepending the temporary preview place if applicable
  const displayScheduledPlaces = useMemo(() => {
    let list = [...scheduledPlaces];
    if (selectedCatalogPlace && !isSelectedPlaceScheduledOnActiveDay) {
      const isAiSuggestion = aiSuggestedPlaces.some(p => p.id === selectedCatalogPlace.id);
      list = [{ ...selectedCatalogPlace, isTemporary: true, isAiSuggestion } as Place, ...list];
    }
    return list;
  }, [scheduledPlaces, selectedCatalogPlace, isSelectedPlaceScheduledOnActiveDay, aiSuggestedPlaces]);

  // Scroll selected place into view in the Day Schedule timeline
  useEffect(() => {
    if (activePlaceId) {
      const timer = setTimeout(() => {
        const element = document.querySelector(`[data-place-id="${activePlaceId}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activePlaceId, activeDayStr]);

  const formatDisplayDate = useCallback((dateStr: string) => {
    if (!dateStr) return '';
    const cleanDateStr = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`;
    return new Date(cleanDateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }, []);

  const placeAllocatedDaysMap = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!activePlan) return map;
    Object.keys(activePlan.days).forEach(dateStr => {
      activePlan.days[dateStr].placeIds.forEach(placeId => {
        if (!map.has(placeId)) {
          map.set(placeId, []);
        }
        map.get(placeId)!.push(dateStr);
      });
    });
    map.forEach(dates => dates.sort());
    return map;
  }, [activePlan]);

  return (
    <div
      className={`planner-view${leftCollapsed ? ' left-collapsed' : ''}${rightCollapsed ? ' right-collapsed' : ''}`}
      onTouchStart={handleSwipeTouchStart}
      onTouchEnd={handleSwipeTouchEnd}
    >
      {/* LEFT PANEL: Accordion (Catalog, Checklist, Reservations, Tips) */}
      <LeftPanelAccordion
        activeMobileTab={activeMobileTab}
        expandedLeftSection={expandedLeftSection}
        setExpandedLeftSection={setExpandedLeftSection}
        trip={trip}
        catalogLocation={catalogLocation}
        selectedCatalogLocId={selectedCatalogLocId}
        setSelectedCatalogLocId={setSelectedCatalogLocId}
        hideAllocatedPlaces={hideAllocatedPlaces}
        setHideAllocatedPlaces={setHideAllocatedPlaces}
        activePlaceId={activePlaceId}
        setActivePlaceId={setActivePlaceId}
        onPlaceClick={(id) => {
          setExpandedLeftSection('catalog');
          setActivePlaceId(id);
        }}
        placeAllocatedDaysMap={placeAllocatedDaysMap}
        getCachedFormattedDisplayDate={formatDisplayDate}
        activeDayStr={activeDayStr}
        activePlan={activePlan}
        onEditLocation={() => setShowEditLocationModal(true)}
        onAddLocation={() => {
          setAddLocationForDay(false);
          setShowAddLocationModal(true);
        }}
        onAddPlaceToDay={handleAddPlaceToDay}
        onOpenEditPlace={handleOpenEditPlace}
        draggedPlaceId={draggedPlaceId}
        dragOverGroupId={dragOverGroupId}
        dragOverPlaceId={dragOverPlaceId}
        dragOverPlacePosition={dragOverPlacePosition}
        setDraggedPlaceId={setDraggedPlaceId}
        setDragOverGroupId={setDragOverGroupId}
        setDragOverPlaceId={setDragOverPlaceId}
        setDragOverPlacePosition={setDragOverPlacePosition}
        handlePlaceDragStart={handlePlaceDragStart}
        handlePlaceDropOnGroup={handlePlaceDropOnGroup}
        handlePlaceDropOnPlace={handlePlaceDropOnPlace}
        handleMoveCatalogPlace={handleMoveCatalogPlace}
        handleMoveGroupOrder={handleMoveGroupOrder}
        startEditingGroup={startEditingGroup}
        setShowGroupModal={setShowGroupModal}
        setAiGeneratePlaces={setAiGeneratePlaces}
        setAiGenerateCity={setAiGenerateCity}
        setAiGenerateCountry={setAiGenerateCountry}
        setShowAiGenerateModal={setShowAiGenerateModal}
        setEditingPlace={setEditingPlace}
        setShowCustomPlaceModal={setShowCustomPlaceModal}
        setAutoScheduleOnActiveDay={setAutoScheduleOnActiveDay}
        savePlaceNotes={savePlaceNotes}
        activeGroupDropdownId={activeGroupDropdownId}
        setActiveGroupDropdownId={setActiveGroupDropdownId}
        aiSuggestedPlaces={aiSuggestedPlaces}
        isLoadingAiSuggestions={isLoadingAiSuggestions}
        aiSuggestionsLocId={aiSuggestionsLocId}
        aiSuggestionsError={aiSuggestionsError}
        onAiSuggestPlaces={handleAiSuggestPlaces}
        generatingChecklist={generatingChecklist}
        onGenerateTripChecklist={handleGenerateTripChecklist}
        onSaveAiChecklist={handleSaveAiChecklist}
        onUpdateTrip={onUpdateTrip}
        daysList={daysList}
        generatingLocalEssentials={generatingLocalEssentials}
        onGenerateLocalEssentials={handleGenerateLocalEssentials}
        onSaveLocalEssentials={handleSaveAiLocalEssentials}
        formatDisplayDate={formatDisplayDate}
        onEditHotel={handleOpenEditHotel}
        onDeleteHotel={handleDeleteHotel}
        onEditTransport={handleOpenEditTransport}
        onDeleteTransport={handleDeleteTransportation}
        onSaveTransportNotes={handleSaveTransportNotes}
        expandedHotelId={expandedHotelId}
        setExpandedHotelId={setExpandedHotelId}
        expandedTransitId={expandedTransitId}
        setExpandedTransitId={setExpandedTransitId}
        expandedPlaceReservationId={expandedPlaceReservationId}
        setExpandedPlaceReservationId={setExpandedPlaceReservationId}
        onAddHotel={() => { setEditingHotel(null); setShowHotelModal(true); }}
        onAddTransit={() => { setEditingTransport(null); setShowTransportModal(true); }}
        onAddPlaceReservation={handleAddPlaceReservation}
        onEditPlaceReservation={handleEditPlaceReservation}
        onDeletePlaceReservation={handleDeletePlaceReservation}
        onImportReservationFile={handleImportReservationFile}
        reservationGroups={activePlan.reservationGroups || DEFAULT_RESERVATION_GROUPS}
        genericReservations={activePlan.genericReservations || []}
        onAddReservationGroup={handleAddReservationGroup}
        onEditReservationGroup={handleEditReservationGroup}
        onMoveReservationGroup={handleMoveReservationGroup}
        onAddGenericReservation={handleAddGenericReservation}
        onEditGenericReservation={handleEditGenericReservation}
        onDeleteGenericReservation={handleDeleteGenericReservation}
        activeReservationGroupDropdownId={activeReservationGroupDropdownId}
        setActiveReservationGroupDropdownId={setActiveReservationGroupDropdownId}
        onAddExpense={handleAddExpense}
        onEditExpense={handleEditExpense}
        onAddExpenseGroup={handleAddExpenseGroup}
        onEditExpenseGroup={handleEditExpenseGroup}
        onMoveExpenseGroup={handleMoveExpenseGroup}
        activeExpenseGroupDropdownId={activeExpenseGroupDropdownId}
        setActiveExpenseGroupDropdownId={setActiveExpenseGroupDropdownId}
      />

      {/* MIDDLE PANEL: Day-to-Day timeline */}
      <ItineraryPanel
        trip={trip}
        activePlan={activePlan}
        activePlanId={activePlanId}
        setActivePlanId={setActivePlanId}
        activeDayStr={activeDayStr}
        setActiveDayStr={setActiveDayStr}
        activeDay={activeDay}
        activeDayLocation={activeDayLocation}
        catalogLocation={catalogLocation}
        daysList={daysList}
        activeMobileTab={activeMobileTab}
        isGoogleSignedIn={isGoogleSignedIn}
        onShareTrip={onShareTrip}
        formatDisplayDate={formatDisplayDate}
        getHotelsForDay={getHotelsForDay}
        getTransportsForDay={getTransportsForDay}
        onOpenAddPlaceReservation={handleAddPlaceReservation}
        onOpenEditPlaceReservation={handleEditPlaceReservation}
        onDeletePlaceReservation={handleDeletePlaceReservation}
        expandedPlaceReservationId={expandedPlaceReservationId}
        setExpandedPlaceReservationId={setExpandedPlaceReservationId}
        scheduledPlaces={scheduledPlaces}
        displayScheduledPlaces={displayScheduledPlaces}
        activePlaceId={activePlaceId}
        setActivePlaceId={setActivePlaceId}
        placeGeneratingIds={placeGeneratingIds}

        placeQuery={placeQuery}
        setPlaceQuery={setPlaceQuery}
        placeSuggestions={placeSuggestions}
        isSearchingPlace={isSearchingPlace}
        draggedPlaceId={draggedPlaceId}
        draggedDayPlaceIndex={draggedDayPlaceIndex}
        setDraggedDayPlaceIndex={setDraggedDayPlaceIndex}
        dragOverDayPlaceIndex={dragOverDayPlaceIndex}
        setDragOverDayPlaceIndex={setDragOverDayPlaceIndex}
        dragOverDayPlacePosition={dragOverDayPlacePosition}
        setDragOverDayPlacePosition={setDragOverDayPlacePosition}
        setShowEditTripModal={setShowEditTripModal}
        setShowTripAiConfigModal={setShowTripAiConfigModal}
        setShowHotelModal={setShowHotelModal}
        setShowTransportModal={setShowTransportModal}
        setShowAddLocationModal={setShowAddLocationModal}
        setAddLocationForDay={setAddLocationForDay}
        setShowDayOptionsMenu={setShowDayOptionsMenu}
        showDayOptionsMenu={showDayOptionsMenu}
        setShowMoveDayModal={setShowMoveDayModal}
        setShowSwapDaysModal={setShowSwapDaysModal}
        setShowAiGenerateDaysModal={setShowAiGenerateDaysModal}
        setShowCustomPlaceModal={setShowCustomPlaceModal}
        setAutoScheduleOnActiveDay={setAutoScheduleOnActiveDay}
        setEditingPlace={setEditingPlace}
        setAiGeneratePlaces={setAiGeneratePlaces}
        setAiGenerateCity={setAiGenerateCity}
        setAiGenerateCountry={setAiGenerateCountry}
        setShowAiGenerateModal={setShowAiGenerateModal}
        isRenamingPlan={isRenamingPlan}
        setIsRenamingPlan={setIsRenamingPlan}
        editPlanName={editPlanName}
        setEditPlanName={setEditPlanName}
        handleRenamePlan={handleRenamePlan}
        handleDeletePlan={handleDeletePlan}
        handleMovePlan={handleMovePlan}
        showPlanMenu={showPlanMenu}
        setShowPlanMenu={setShowPlanMenu}
        setShowNewPlanModal={setShowNewPlanModal}
        handleSetDayLocation={handleSetDayLocation}
        handleDeleteHotel={handleDeleteHotel}
        handleDeleteTransportation={handleDeleteTransportation}
        handleOpenEditHotel={handleOpenEditHotel}
        handleOpenEditTransport={handleOpenEditTransport}
        handleSaveHotelNotes={handleSaveHotelNotes}
        handleSaveTransportNotes={handleSaveTransportNotes}
        handleGenerateSingleDayTips={handleGenerateSingleDayTips}
        handleSaveDayTips={handleSaveDayTips}
        handleSaveBabyLogistics={handleSaveBabyLogistics}
        handleSaveSuggestedReservations={handleSaveSuggestedReservations}
        handleClearDay={handleClearDay}
        handleAddPlaceFromDayTimeline={handleAddPlaceFromDayTimeline}
        handleOpenAddPlaceAtIndex={handleOpenAddPlaceAtIndex}
        handleDayPlaceDragStart={handleDayPlaceDragStart}
        handleDayPlaceDrop={handleDayPlaceDrop}
        handleCatalogPlaceDropOnTimeline={handleCatalogPlaceDropOnTimeline}
        scheduleItems={activeDay?.scheduleItems || []}
        handleMoveScheduleItem={handleMoveScheduleItem}
        handleRemovePlaceFromDay={handleRemovePlaceFromDay}
        handleAddScheduleNote={handleAddScheduleNote}
        handleUpdateScheduleNote={handleUpdateScheduleNote}
        handleDeleteScheduleNote={handleDeleteScheduleNote}
        handleAddReservationEventToSchedule={handleAddReservationEventToSchedule}
        handleUpdateScheduleItemTime={handleUpdateScheduleItemTime}
        handleAddPlaceToDay={handleAddPlaceToDay}
        handleAddAiSuggestionToCatalog={handleAddAiSuggestionToCatalog}
        handleOpenEditPlace={handleOpenEditPlace}
        handleGenerateSinglePlaceAiDetails={handleGenerateSinglePlaceAiDetails}
        savePlaceNotes={savePlaceNotes}
        activeTimelinePlaceDropdownKey={activeTimelinePlaceDropdownKey}
        setActiveTimelinePlaceDropdownKey={setActiveTimelinePlaceDropdownKey}
        daysGeneratingDates={daysGeneratingDates}
        daysTabsNavRef={daysTabsNavRef}
        lastScrollLeft={lastScrollLeft}
        searchDropdownRef={searchDropdownRef}
        leftCollapsed={leftCollapsed}
        setLeftCollapsed={setLeftCollapsed}
        rightCollapsed={rightCollapsed}
        setRightCollapsed={setRightCollapsed}
        expandedHotelId={expandedHotelId}
        setExpandedHotelId={setExpandedHotelId}
        expandedTransitId={expandedTransitId}
        setExpandedTransitId={setExpandedTransitId}
        onToggleNoHotel={handleToggleNoHotel}
      />
      
      {/* RIGHT PANEL: Interactive Leaflet Map */}
      <div className={`map-panel ${activeMobileTab === 'map' ? 'mobile-active' : ''}`}>
        <MapComponent 
          places={displayScheduledPlaces} 
          activePlaceId={activePlaceId}
          placeGroups={trip.placeGroups || DEFAULT_PLACE_GROUPS}
          onMapClick={handleMapClick}
          previewMarker={previewMarker}
          onPlaceSelect={setActivePlaceId}
          activeMobileTab={activeMobileTab}
          hotels={getHotelsForDay(activeDayStr).filter(h => h.status !== 'Canceled')}
          transports={getTransportsForDay(activeDayStr).filter(t => t.status !== 'Canceled')}
          locations={trip.locations}
        />
      </div>

      {/* Mobile Tab Navigation */}
      <div className="mobile-tab-nav">
        <button 
          className={`mobile-tab-btn ${activeMobileTab === 'catalog' ? 'active' : ''}`}
          onClick={() => setActiveMobileTab('catalog')}
        >
          <BookOpen size={20} />
          <span>Overview</span>
        </button>
        <button 
          className={`mobile-tab-btn ${activeMobileTab === 'itinerary' ? 'active' : ''}`}
          onClick={() => setActiveMobileTab('itinerary')}
        >
          <Clock size={20} />
          <span>Itinerary</span>
        </button>
        <button 
          className={`mobile-tab-btn ${activeMobileTab === 'map' ? 'active' : ''}`}
          onClick={() => setActiveMobileTab('map')}
        >
          <Navigation size={20} />
          <span>Map</span>
        </button>
      </div>

      {/* Manual AI prompt modal */}
      {pendingManualAiPrompt && (
        <ManualAiPromptModal
          isOpen={true}
          title={pendingManualAiPrompt.title}
          promptText={pendingManualAiPrompt.promptText}
          responseFormat={pendingManualAiPrompt.responseFormat}
          onResponse={pendingManualAiPrompt.onResponse}
          onCancel={pendingManualAiPrompt.onCancel}
        />
      )}

      {/* ----------------------------------------------------
          MODALS & DIALOGS
         ---------------------------------------------------- */}

      {/* 1. New Plan Modal */}
      <NewPlanModal
        isOpen={showNewPlanModal}
        onClose={() => setShowNewPlanModal(false)}
        onSave={handleCreatePlan}
      />

      {/* 2. Move Day Modal */}
      <MoveDayModal
        isOpen={showMoveDayModal}
        onClose={() => setShowMoveDayModal(false)}
        activeDayLabel={`Day ${daysList.indexOf(activeDayStr) + 1} (${formatDisplayDate(activeDayStr).split(',')[1]?.trim() || activeDayStr})`}
        initialTargetDate={(() => {
          const activeDayIdx = daysList.indexOf(activeDayStr);
          if (activeDayIdx !== -1) {
            if (activeDayIdx < daysList.length - 1) {
              return daysList[activeDayIdx + 1];
            } else if (activeDayIdx > 0) {
              return daysList[activeDayIdx - 1];
            }
          }
          return '';
        })()}
        daysOptions={daysList
          .filter(d => d !== activeDayStr)
          .map(d => {
            const dayData = activePlan?.days[d];
            const loc = dayData?.locationId ? trip.locations.find(l => l.id === dayData.locationId) : undefined;
            return {
              value: d,
              label: `Day ${daysList.indexOf(d) + 1} (${formatDisplayDate(d).split(',')[1]?.trim() || d})`,
              locationName: loc ? getFormattedLocationName(loc, trip.locations) : undefined,
              locationColor: loc?.color,
              locationIcon: loc ? getLocIcon(loc) : undefined
            };
          })}
        onConfirmMove={handleMoveDayContents}
      />

      {/* Swap Days Modal */}
      <SwapDaysModal
        isOpen={showSwapDaysModal}
        onClose={() => setShowSwapDaysModal(false)}
        activeDayLabel={`Day ${daysList.indexOf(activeDayStr) + 1} (${formatDisplayDate(activeDayStr).split(',')[1]?.trim() || activeDayStr})`}
        initialTargetDate={(() => {
          const activeDayIdx = daysList.indexOf(activeDayStr);
          if (activeDayIdx !== -1) {
            if (activeDayIdx < daysList.length - 1) {
              return daysList[activeDayIdx + 1];
            } else if (activeDayIdx > 0) {
              return daysList[activeDayIdx - 1];
            }
          }
          return '';
        })()}
        daysOptions={daysList
          .filter(d => d !== activeDayStr)
          .map(d => {
            const dayData = activePlan?.days[d];
            const loc = dayData?.locationId ? trip.locations.find(l => l.id === dayData.locationId) : undefined;
            return {
              value: d,
              label: `Day ${daysList.indexOf(d) + 1} (${formatDisplayDate(d).split(',')[1]?.trim() || d})`,
              locationName: loc ? getFormattedLocationName(loc, trip.locations) : undefined,
              locationColor: loc?.color,
              locationIcon: loc ? getLocIcon(loc) : undefined
            };
          })}
        onConfirmSwap={handleSwapDaysContents}
      />

      {/* 3. Edit Trip Details Modal */}
      <EditTripModal
        isOpen={showEditTripModal}
        onClose={() => setShowEditTripModal(false)}
        trip={trip}
        onSave={handleSaveEditTrip}
      />

      {/* 4. Add Location Modal */}
      <AddLocationModal
        isOpen={showAddLocationModal}
        onClose={() => setShowAddLocationModal(false)}
        title={addLocationForDay ? 'Add Location for Day' : 'Add Location to Trip'}
        onSelect={(loc) => {
          if (addLocationForDay) {
            handleAddNewLocationForDay(loc);
          } else {
            handleAddNewLocationToCatalog(loc);
          }
          setShowAddLocationModal(false);
        }}
      />

      {/* 5. Location Modal (Edit Location) */}
      {catalogLocation && (
        <LocationModal
          isOpen={showEditLocationModal}
          onClose={() => setShowEditLocationModal(false)}
          location={catalogLocation}
          allLocations={trip.locations}
          onSave={handleSaveEditLocation}
          onDelete={() => handleDeleteLocation(catalogLocation.id)}
          onReorderLocations={(updatedLocs) => {
            onUpdateTrip({
              ...trip,
              locations: updatedLocs
            });
          }}
        />
      )}

      {/* 6. Place Modal (Add / Edit Place) */}
      <PlaceModal
        isOpen={showCustomPlaceModal || showEditPlaceModal}
        onClose={() => {
          setShowCustomPlaceModal(false);
          setShowEditPlaceModal(false);
          setEditingPlace(null);
          setPendingPlaceInsertIndex(null);
        }}
        place={editingPlace}
        catalogLocation={catalogLocation}
        placeGroups={trip.placeGroups || DEFAULT_PLACE_GROUPS}
        onSave={(placeData) => {
          const isEdit = !!(editingPlace && !editingPlace.id.startsWith('new-temp-'));
          if (isEdit) {
            handleSaveEditPlace(placeData);
          } else {
            handleCreateCustomPlace(placeData);
          }
        }}
        onDelete={editingPlace && !editingPlace.id.startsWith('new-temp-') ? handleDeletePlace : undefined}
        customAiFields={trip.customAiFields}
        disabledPlaceFields={trip.disabledPlaceFields}
        fieldIcons={trip.fieldIcons}
        placeFieldsOrder={trip.placeFieldsOrder}
      />

      {/* 7. Group Modal */}
      <GroupModal
        isOpen={showGroupModal}
        onClose={() => {
          setShowGroupModal(false);
          setEditingGroup(null);
        }}
        group={editingGroup}
        onSave={handleSavePlaceGroup}
        onDelete={handleDeletePlaceGroup}
      />

      {/* 8. Transport Modal */}
      <TransportModal
        isOpen={showTransportModal}
        onClose={() => { setShowTransportModal(false); setEditingTransport(null); }}
        tripStartDate={trip.startDate}
        onSave={(data: Omit<TransportationReservation, 'id'>) => {
          if (editingTransport && editingTransport.id !== 'imported-draft') {
            handleEditTransportation({ ...data, id: editingTransport.id });
          } else {
            handleAddTransportation(data);
          }
        }}
        onDelete={editingTransport ? () => setDeleteTransportData({ reservation: editingTransport, segmentIndex: editingTransportationSegmentIndex }) : undefined}
        editingTransport={editingTransport}
        initialSegmentIndex={editingTransportationSegmentIndex}
        googleToken={googleToken}
        tripPlannerFolderId={googleFolderId}
        tripName={trip.id}
        tripFilesFolderId={trip.filesFolderId}
        onFileFolderCreated={(folderId) => onUpdateTrip(t => ({ ...t, filesFolderId: folderId }))}
        isOwner={trip.isOwner !== false}
        tripDriveFileId={trip.driveFileId}
        defaultDate={activeDayStr}
        catalogLocation={catalogLocation}
      />

      {/* 9. Hotel Modal */}
      <HotelModal
        isOpen={showHotelModal}
        onClose={() => { setShowHotelModal(false); setEditingHotel(null); }}
        tripStartDate={trip.startDate}
        onSave={(data) => {
          if (editingHotel && editingHotel.id !== 'imported-draft') {
            handleEditHotel({ ...data, id: editingHotel.id });
          } else {
            handleAddHotel(data);
          }
        }}
        onDelete={editingHotel ? () => setDeleteHotelData(editingHotel) : undefined}
        editingHotel={editingHotel}
        googleToken={googleToken}
        tripPlannerFolderId={googleFolderId}
        tripName={trip.id}
        tripFilesFolderId={trip.filesFolderId}
        onFileFolderCreated={(folderId) => onUpdateTrip(t => ({ ...t, filesFolderId: folderId }))}
        isOwner={trip.isOwner !== false}
        tripDriveFileId={trip.driveFileId}
        defaultDate={activeDayStr}
        catalogLocation={catalogLocation}
      />

      {/* 9b. Delete Reservation Modal */}
      {deleteHotelData && (
        <DeleteReservationModal
          type="hotel"
          item={deleteHotelData}
          googleToken={googleToken ?? undefined}
          onConfirm={() => executeDeleteHotel(deleteHotelData.id)}
          onCancel={() => setDeleteHotelData(null)}
        />
      )}
      {deleteTransportData && (
        <DeleteReservationModal
          type="transport"
          item={deleteTransportData.reservation}
          googleToken={googleToken ?? undefined}
          segmentIndex={deleteTransportData.segmentIndex}
          totalSegments={deleteTransportData.reservation.segments.length}
          onConfirmSegmentOnly={() => handleDeleteTransportationSegment(deleteTransportData.reservation.id, deleteTransportData.segmentIndex)}
          onConfirm={() => executeDeleteTransport(deleteTransportData.reservation.id)}
          onCancel={() => setDeleteTransportData(null)}
        />
      )}

      {/* 10. Confirmation Modal */}
      {confirmModal && (
        <ConfirmationModal
          isOpen={!!confirmModal}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText={confirmModal.confirmText}
          cancelText={confirmModal.cancelText}
          isAlert={confirmModal.isAlert}
          onConfirm={() => {
            confirmModal.onConfirm();
            setConfirmModal(null);
          }}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      {showAiGenerateModal && (
        <AiGenerateModal
          isOpen={showAiGenerateModal}
          onClose={() => setShowAiGenerateModal(false)}
          places={aiGeneratePlaces}
          city={aiGenerateCity}
          country={aiGenerateCountry}
          onSave={handleSaveBatchAiDetails}
          customAiFields={trip.customAiFields}
          disabledPlaceFields={trip.disabledPlaceFields}
          placeFieldsOrder={trip.placeFieldsOrder}
        />
      )}

      {showTripAiConfigModal && (
        <TripAiConfigModal
          isOpen={showTripAiConfigModal}
          onClose={() => setShowTripAiConfigModal(false)}
          trip={trip}
          onSave={handleSaveTripAiConfig}
        />
      )}

      {showAiGenerateDaysModal && (
        <AiGenerateDaysModal
          isOpen={showAiGenerateDaysModal}
          onClose={() => setShowAiGenerateDaysModal(false)}
          days={daysList.map(d => {
            const dayData = activePlan?.days[d];
            const loc = dayData?.locationId ? trip.locations.find(l => l.id === dayData.locationId) : undefined;
            return {
              dateStr: d,
              label: `Day ${daysList.indexOf(d) + 1} (${formatDisplayDate(d).split(',')[1]?.trim() || d})`,
              hasTips: !!dayData?.aiDetails?.daily_tips,
              tipsUpdatedAt: dayData?.aiUpdatedAt,
              locationName: loc ? getFormattedLocationName(loc, trip.locations) : undefined,
              locationColor: loc?.color,
              locationIcon: loc ? getLocIcon(loc) : undefined
            };
          })}
          onGenerate={handleGenerateDaysTips}
        />
      )}
      {isImportingReservationFile && (
        <div className="modal-overlay" style={{ zIndex: 1300 }}>
          <div className="modal-content glass-panel modal-content--sm import-loader-content">
            <Loader2 size={24} className="animate-spin import-loader-spinner" />
            <h3 className="import-loader-title">{importingReservationMessage}</h3>
            <p className="modal-field-details import-loader-details">
              Please wait while Gemini processes the document and extracts reservation details.
            </p>
          </div>
        </div>
      )}
      {showExpenseModal && (
        <ExpenseModal
          isOpen={showExpenseModal}
          onClose={() => { setShowExpenseModal(false); setEditingExpense(null); }}
          expense={editingExpense}
          expenseGroups={activePlan.expenseGroups || []}
          hotels={activePlan.hotels || []}
          transports={activePlan.transports || []}
          placeReservations={activePlan.placeReservations || []}
          onSave={handleSaveExpense}
          onDelete={editingExpense && (editingExpense.id || editingExpense.linkedReservationId) ? handleDeleteExpense : undefined}
          onOpenReservation={editingExpense?.linkedReservationId ? (() => {
            const linkedId = editingExpense.linkedReservationId;
            const linkedType = editingExpense.linkedReservationType;
            setShowExpenseModal(false);
            setEditingExpense(null);
            if (linkedType === 'hotel') {
              const hotel = (activePlan.hotels || []).find(h => h.id === linkedId);
              if (hotel) handleOpenEditHotel(hotel);
            } else if (linkedType === 'transit') {
              const transport = (activePlan.transports || []).find(t => t.id === linkedId);
              if (transport) handleOpenEditTransport(transport, 0);
            } else if (linkedType === 'place') {
              const pres = (activePlan.placeReservations || []).find(p => p.id === linkedId);
              if (pres) handleEditPlaceReservation(pres);
            }
          }) : undefined}
        />
      )}

      {showExpenseGroupModal && (
        <ExpenseGroupModal
          isOpen={showExpenseGroupModal}
          onClose={() => { setShowExpenseGroupModal(false); setEditingExpenseGroup(null); }}
          group={editingExpenseGroup}
          onSave={handleSaveExpenseGroup}
          onDelete={editingExpenseGroup && editingExpenseGroup.id ? handleDeleteExpenseGroup : undefined}
        />
      )}

      {showReservationGroupModal && (
        <ReservationGroupModal
          isOpen={showReservationGroupModal}
          onClose={() => { setShowReservationGroupModal(false); setEditingReservationGroup(null); }}
          group={editingReservationGroup}
          onSave={handleSaveReservationGroup}
          onDelete={editingReservationGroup && editingReservationGroup.id ? handleDeleteReservationGroup : undefined}
        />
      )}

      {showGenericReservationModal && (
        <GenericReservationModal
          isOpen={showGenericReservationModal}
          onClose={() => { setShowGenericReservationModal(false); setEditingGenericReservation(null); setTargetGenericReservationGroupId(null); }}
          reservation={editingGenericReservation}
          groupName={(activePlan.reservationGroups || DEFAULT_RESERVATION_GROUPS).find(g => g.id === targetGenericReservationGroupId)?.name || 'Reservation'}
          onSave={handleSaveGenericReservation}
          onDelete={editingGenericReservation ? handleDeleteGenericReservation : undefined}
        />
      )}

      {showPlaceReservationModal && (
        <PlaceReservationModal
          isOpen={showPlaceReservationModal}
          onClose={() => { setShowPlaceReservationModal(false); setEditingPlaceReservation(null); }}
          reservation={editingPlaceReservation}
          defaultType={placeReservationDefaultType}
          locations={trip.locations}
          onSave={handleSavePlaceReservation}
          onDelete={editingPlaceReservation && editingPlaceReservation.id && editingPlaceReservation.id !== 'imported-draft' ? handleDeletePlaceReservation : undefined}
          defaultDate={activeDayStr}
          googleToken={googleToken}
          tripPlannerFolderId={googleFolderId}
          tripName={trip.id}
          tripFilesFolderId={trip.filesFolderId}
          onFileFolderCreated={(folderId: string) => onUpdateTrip(t => ({ ...t, filesFolderId: folderId }))}
          isOwner={trip.isOwner !== false}
          tripDriveFileId={trip.driveFileId}
          trip={trip}
        />
      )}
    </div>
  );
}
