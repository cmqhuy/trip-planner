import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { Trip, Plan, PlanDay, Location, Place, PlaceGroup, Transportation, Hotel } from '../types';
import { Navigation, BookOpen, Clock } from 'lucide-react';
import { searchPlacesNearLocation, DEFAULT_PLACE_GROUPS, buildMapsLink, parseGoogleMapsUrl, fetchPlaceFromGoogleMapsUrl } from '../utils/api';
import { getDaysDiff, shiftTripDates } from '../utils/dateUtils';
import MapComponent from './MapComponent';
import { GeminiService } from '../utils/ai';
import AiGenerateModal from './AiGenerateModal';


// Extracted Modals
import ConfirmationModal from './ConfirmationModal';
import NewPlanModal from './NewPlanModal';
import MoveDayModal from './MoveDayModal';
import EditTripModal from './EditTripModal';
import AddLocationModal from './AddLocationModal';
import LocationModal from './LocationModal';
import GroupModal from './GroupModal';
import TransportModal from './TransportModal';
import HotelModal from './HotelModal';
import PlaceModal from './PlaceModal';
import TripAiConfigModal from './TripAiConfigModal';
import AiGenerateDaysModal from './AiGenerateDaysModal';
import LeftPanelAccordion from './LeftPanelAccordion';
import ItineraryPanel from './ItineraryPanel';

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
}

export default function TripPlanner({ trip, onUpdateTrip, onShareTrip, isGoogleSignedIn }: TripPlannerProps) {
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
    return urlDay && daysList.includes(urlDay) ? urlDay : (daysList[0] || '');
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
    const targetDay = urlDay && planDays.includes(urlDay) ? urlDay : (planDays[0] || '');
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

  // Hotel Modal
  const [showHotelModal, setShowHotelModal] = useState(false);

  // Day timeline search state
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeSuggestions, setPlaceSuggestions] = useState<Omit<Place, 'placeGroupId'>[]>([]);
  const [isSearchingPlace, setIsSearchingPlace] = useState(false);

  // Note editing state for catalog places
  const [editingPlaceNotesId, setEditingPlaceNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState('');

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
      title: 'API Keys Missing',
      message: 'You need a Gemini API key to run AI calls. Please open AI Settings in the top-right header to configure your keys.',
      confirmText: 'OK',
      isAlert: true,
      onConfirm: () => {}
    });
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

  // Mobile UI States
  const [activeMobileTab, setActiveMobileTab] = useState<'catalog' | 'itinerary' | 'map'>('itinerary');
  const [autoScheduleOnActiveDay, setAutoScheduleOnActiveDay] = useState(false);
  const [hideAllocatedPlaces, setHideAllocatedPlaces] = useState(false);

  // Accordion state for left panel
  const [expandedLeftSection, setExpandedLeftSection] = useState<'catalog' | 'checklist' | 'reservations' | 'tips'>('catalog');
  
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
            const newDay = { ...day };
            if (day.locationId === locId) {
              newDay.locationId = undefined;
            }
            
            // Remove scheduled places that belonged to the deleted location
            const deletedLoc = trip.locations.find(l => l.id === locId);
            if (deletedLoc) {
              const deletedPlaceIds = new Set(deletedLoc.places.map(pl => pl.id));
              newDay.placeIds = day.placeIds.filter(pid => !deletedPlaceIds.has(pid));
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

    if (!GeminiService.hasApiKey()) {
      showApiKeyMissingModal();
      return;
    }

    setPlaceGeneratingIds(prev => {
      const next = new Set(prev);
      next.add(placeId);
      return next;
    });

    try {
      const results = await GeminiService.generatePlaceAiDetailsWithRotation(
        [{ id: placeId, title: targetPlace.title, description: targetPlace.description, lat: targetPlace.lat, lng: targetPlace.lng }],
        targetLoc.city,
        targetLoc.country,
        trip.customAiFields,
        undefined, // model
        trip.disabledPlaceFields
      );

      if (results && results.length > 0) {
        const { id, ...details } = results[0];
        handleSaveBatchAiDetails({ [placeId]: details });
      }
    } catch (err: any) {
      console.error('AI single generation failed:', err);
      alert(`AI generation failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setPlaceGeneratingIds(prev => {
        const next = new Set(prev);
        next.delete(placeId);
        return next;
      });
    }
  }, [trip.locations, trip.customAiFields, trip.disabledPlaceFields, handleSaveBatchAiDetails]);

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

  const handleDayPlaceDragStart = (index: number) => {
    setDraggedDayPlaceIndex(index);
  };

  const handleDayPlaceDrop = (targetIndex: number, position: 'top' | 'bottom') => {
    if (draggedDayPlaceIndex === null) return;

    const updatedPlans = trip.plans.map(p => {
      if (p.id === activePlan.id) {
        const currentPlaces = [...(p.days[activeDayStr]?.placeIds || [])];
        const draggedItem = currentPlaces[draggedDayPlaceIndex];
        
        let destIndex = targetIndex;
        if (position === 'bottom') {
          destIndex = targetIndex + 1;
        }

        // Remove from old index
        currentPlaces.splice(draggedDayPlaceIndex, 1);
        
        // Calculate insertion index in the remaining list
        let insertIndex = destIndex;
        if (draggedDayPlaceIndex < destIndex) {
          insertIndex = destIndex - 1;
        }

        // Insert at new index
        currentPlaces.splice(insertIndex, 0, draggedItem);

        return {
          ...p,
          days: {
            ...p.days,
            [activeDayStr]: {
              ...p.days[activeDayStr],
              placeIds: currentPlaces
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

    setDraggedDayPlaceIndex(null);
    setDragOverDayPlaceIndex(null);
  };

  const handleCatalogPlaceDropOnTimeline = (placeId: string, targetIndex: number, position: 'top' | 'bottom') => {
    const currentPlaceIds = [...(activePlan.days[activeDayStr]?.placeIds || [])];
    
    let destIndex = targetIndex;
    if (position === 'bottom') {
      destIndex = targetIndex + 1;
    }

    // Insert the place at the target index
    currentPlaceIds.splice(destIndex, 0, placeId);

    const updatedPlans = trip.plans.map(p => {
      if (p.id === activePlan.id) {
        return {
          ...p,
          days: {
            ...p.days,
            [activeDayStr]: {
              ...p.days[activeDayStr],
              locationId: p.days[activeDayStr]?.locationId || catalogLocation?.id || trip.locations[0]?.id,
              placeIds: currentPlaceIds
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

    setDraggedPlaceId(null);
    setDragOverDayPlaceIndex(null);
  };



  const handleSetDayLocation = (locId: string) => {
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
  };

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
          // Copy to destination day (and update locationId to match source day)
          updatedDays[destDateStr] = {
            ...updatedDays[destDateStr],
            locationId: sourceLocId,
            placeIds: [...(currentDayData.placeIds || [])]
          };
          // Clear source day
          updatedDays[activeDayStr] = {
            ...updatedDays[activeDayStr],
            placeIds: []
          };
          return {
            ...p,
            days: updatedDays
          };
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
        title: 'Move Scheduled Places',
        message: `Are you sure you want to move ${getFormattedDayLabel(activeDayStr)} scheduled places to ${getFormattedDayLabel(destDateStr)}? This will override all scheduled places on ${getFormattedDayLabel(destDateStr)}.\n\n⚠️ Warning: The location of ${getFormattedDayLabel(activeDayStr)} (${sourceName}) is different from ${getFormattedDayLabel(destDateStr)} (${destName}). Proceeding will update ${getFormattedDayLabel(destDateStr)}'s location to ${sourceName}.`,
        confirmText: 'Move Places',
        onConfirm: executeMove
      });
    } else {
      setConfirmModal({
        title: 'Move Scheduled Places',
        message: `Are you sure you want to move ${getFormattedDayLabel(activeDayStr)} scheduled places to ${getFormattedDayLabel(destDateStr)}? This will override all scheduled places on ${getFormattedDayLabel(destDateStr)}.`,
        confirmText: 'Move Places',
        onConfirm: executeMove
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
            return {
              ...p,
              days: {
                ...p.days,
                [activeDayStr]: {
                  ...p.days[activeDayStr],
                  placeIds: []
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
        placeIds: []
      };
    });

    const newPlan: Plan = {
      id: newPlanId,
      name: planName,
      startDate: trip.startDate,
      endDate: trip.endDate,
      days: clonedDays,
      hotels: [],
      transports: []
    };

    onUpdateTrip({
      ...trip,
      plans: [...trip.plans, newPlan]
    });

    setActivePlanId(newPlanId);
    setShowNewPlanModal(false);
  };

  const handleRenamePlan = () => {
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
  };

  const handleDeletePlan = (planId: string) => {
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
  };

  const handleMovePlan = (direction: 'up' | 'down') => {
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
  };

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
        const currentPlaces = p.days[currentDayStr]?.placeIds || [];
        return {
          ...p,
          days: {
            ...p.days,
            [currentDayStr]: {
              ...p.days[currentDayStr],
              locationId: p.days[currentDayStr]?.locationId || catalogLocation.id,
              placeIds: [...currentPlaces, placeId]
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

    setPlaceQuery('');
    setPlaceSuggestions([]);
  }, [catalogLocation, trip, activePlan, onUpdateTrip]);

  const handleAddPlaceFromDayTimeline = (place: Omit<Place, 'placeGroupId'>) => {
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
  };

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
          const dayData = daysCopy[activeDayStr] || { dateStr: activeDayStr, placeIds: [] };
          daysCopy[activeDayStr] = {
            ...dayData,
            placeIds: [...dayData.placeIds, customId]
          };
          return {
            ...p,
            days: daysCopy
          };
        }
        return p;
      });
    }

    onUpdateTrip({
      ...trip,
      locations: updatedLocations,
      plans: updatedPlans
    });

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
            if (updatedDays[dateStr]?.placeIds) {
              updatedDays[dateStr] = {
                ...updatedDays[dateStr],
                placeIds: updatedDays[dateStr].placeIds.filter(id => id !== placeId)
              };
            }
          });
          return {
            ...p,
            days: updatedDays
          };
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

  const handleRemovePlaceFromDay = (index: number) => {
    const updatedPlans = trip.plans.map(p => {
      if (p.id === activePlan.id) {
        const currentPlaces = [...(p.days[activeDayStr]?.placeIds || [])];
        currentPlaces.splice(index, 1);
        return {
          ...p,
          days: {
            ...p.days,
            [activeDayStr]: {
              ...p.days[activeDayStr],
              placeIds: currentPlaces
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
  };

  const handleMovePlaceOrder = (index: number, direction: 'up' | 'down') => {
    const updatedPlans = trip.plans.map(p => {
      if (p.id === activePlan.id) {
        const currentPlaces = [...(p.days[activeDayStr]?.placeIds || [])];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= currentPlaces.length) return p;

        // Swap
        const temp = currentPlaces[index];
        currentPlaces[index] = currentPlaces[targetIndex];
        currentPlaces[targetIndex] = temp;

        return {
          ...p,
          days: {
            ...p.days,
            [activeDayStr]: {
              ...p.days[activeDayStr],
              placeIds: currentPlaces
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
  };

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
  const startEditingNotes = useCallback((place: Place) => {
    setEditingPlaceNotesId(place.id);
    setTempNotes(place.notes || '');
  }, []);

  const savePlaceNotes = useCallback((placeId: string) => {
    const updatedLocations = trip.locations.map(l => {
      if (l.places.some(p => p.id === placeId)) {
        const updatedPlaces = l.places.map(p => {
          if (p.id === placeId) {
            return { ...p, notes: tempNotes };
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

    setEditingPlaceNotesId(null);
  }, [trip, tempNotes, onUpdateTrip]);

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
  const handleAddTransportation = (transportData: Omit<Transportation, 'id'>) => {
    const newTransport: Transportation = {
      id: `transport-${Date.now()}`,
      ...transportData
    };

    const updatedPlans = trip.plans.map(p => {
      if (p.id === activePlan.id) {
        return {
          ...p,
          transports: [...p.transports, newTransport]
        };
      }
      return p;
    });

    onUpdateTrip({
      ...trip,
      plans: updatedPlans
    });

    setShowTransportModal(false);
  };

  const handleDeleteTransportation = (id: string) => {
    setConfirmModal({
      title: 'Delete Transportation',
      message: 'Delete this transport booking?',
      onConfirm: () => {
        const updatedPlans = trip.plans.map(p => {
          if (p.id === activePlan.id) {
            return {
              ...p,
              transports: p.transports.filter(t => t.id !== id)
            };
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

  // Get transport active on a day
  const getTransportsForDay = (dateStr: string) => {
    return activePlan.transports.filter(t => {
      // Show on day if it departs or arrives on this day
      return t.departureDate === dateStr || t.arrivalDate === dateStr;
    });
  };

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

  const handleDeleteHotel = (id: string) => {
    setConfirmModal({
      title: 'Delete Hotel Reservation',
      message: 'Delete this hotel reservation?',
      onConfirm: () => {
        const updatedPlans = trip.plans.map(p => {
          if (p.id === activePlan.id) {
            return {
              ...p,
              hotels: p.hotels.filter(h => h.id !== id)
            };
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

  // Get hotels overlapping with active day
  const getHotelsForDay = (dateStr: string) => {
    const d = new Date(dateStr);
    return activePlan.hotels.filter(h => {
      const inD = new Date(h.checkInDate);
      const outD = new Date(h.checkOutDate);
      // Stay overlaps if active day is between checkIn and checkOut (exclusive or inclusive)
      return d >= inD && d <= outD;
    });
  };

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
    if (!GeminiService.hasApiKey()) {
      showApiKeyMissingModal();
      return;
    }

    setDaysGeneratingDates(prev => {
      const next = new Set(prev);
      next.add(dateStr);
      return next;
    });

    try {
      const day = activePlan.days[dateStr];
      if (!day) return;

      // Gather day information
      const location = trip.locations.find(l => l.id === day.locationId) || trip.locations[0];
      const dayPlaces = day.placeIds.map(pid => {
        const p = location?.places.find(pl => pl.id === pid);
        return p ? { 
          title: p.title, 
          description: p.description,
          openingHours: p.openingHours,
          lat: p.lat,
          lng: p.lng,
          notes: p.notes
        } : null;
      }).filter(Boolean) as { 
        title: string; 
        description?: string;
        openingHours?: string;
        lat?: number;
        lng?: number;
        notes?: string;
      }[];

      const dayHotels = getHotelsForDay(dateStr).map(h => h.name);
      const dayTransports = getTransportsForDay(dateStr).map(t => `${t.type.toUpperCase()}: ${t.departureLocationName} -> ${t.arrivalLocationName}`);

      const results = await GeminiService.generateDailyTipsWithRotation(
        [{
          dateStr,
          locationCity: location?.city || '',
          locationCountry: location?.country || '',
          places: dayPlaces,
          hotels: dayHotels,
          transports: dayTransports
        }],
        !trip.disabledDayFields?.includes('baby_logistics'),
        undefined, // model
        trip.disabledDayFields
      );

      if (results && results.length > 0) {
        const res = results[0];
        onUpdateTrip(prevTrip => {
          const updatedPlans = prevTrip.plans.map(p => {
            if (p.id === activePlan.id) {
              const updatedDays = {
                ...p.days,
                [dateStr]: {
                  ...p.days[dateStr],
                  aiDetails: res.aiDetails,
                  aiUpdatedAt: Date.now()
                }
              };
              return {
                ...p,
                days: updatedDays
              };
            }
            return p;
          });
          return {
            ...prevTrip,
            plans: updatedPlans
          };
        });
      }
    } catch (err: any) {
      console.error('AI day tips generation failed:', err);
      alert(`AI generation failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setDaysGeneratingDates(prev => {
        const next = new Set(prev);
        next.delete(dateStr);
        return next;
      });
    }
  };

  // Batch generate daily tips
  const handleGenerateDaysTips = async (selectedDates: string[]) => {
    if (selectedDates.length === 0) return;
    if (!GeminiService.hasApiKey()) {
      throw new Error('Gemini API keys are missing. Please add them in the AI Settings.');
    }

    setDaysGeneratingDates(prev => {
      const next = new Set(prev);
      selectedDates.forEach(d => next.add(d));
      return next;
    });

    try {
      const daysPayload = selectedDates.map(dateStr => {
        const day = activePlan.days[dateStr];
        const location = trip.locations.find(l => l.id === day?.locationId) || trip.locations[0];
        const dayPlaces = day ? day.placeIds.map(pid => {
          const p = location?.places.find(pl => pl.id === pid);
          return p ? { 
            title: p.title, 
            description: p.description,
            openingHours: p.openingHours,
            lat: p.lat,
            lng: p.lng,
            notes: p.notes
          } : null;
        }).filter(Boolean) as { 
          title: string; 
          description?: string;
          openingHours?: string;
          lat?: number;
          lng?: number;
          notes?: string;
        }[] : [];

        const dayHotels = getHotelsForDay(dateStr).map(h => h.name);
        const dayTransports = getTransportsForDay(dateStr).map(t => `${t.type.toUpperCase()}: ${t.departureLocationName} -> ${t.arrivalLocationName}`);

        return {
          dateStr,
          locationCity: location?.city || '',
          locationCountry: location?.country || '',
          places: dayPlaces,
          hotels: dayHotels,
          transports: dayTransports
        };
      });

      const results = await GeminiService.generateDailyTipsWithRotation(
        daysPayload,
        !trip.disabledDayFields?.includes('baby_logistics'),
        undefined, // model
        trip.disabledDayFields
      );

      onUpdateTrip(prevTrip => {
        const updatedPlans = prevTrip.plans.map(p => {
          if (p.id === activePlan.id) {
            const updatedDays = { ...p.days };
            results.forEach(res => {
              const day = updatedDays[res.dateStr];
              if (day) {
                updatedDays[res.dateStr] = {
                   ...day,
                   aiDetails: res.aiDetails,
                   aiUpdatedAt: Date.now()
                };
              }
            });
            return {
              ...p,
              days: updatedDays
            };
          }
          return p;
        });
        return {
          ...prevTrip,
          plans: updatedPlans
        };
      });
    } finally {
      setDaysGeneratingDates(prev => {
        const next = new Set(prev);
        selectedDates.forEach(d => next.delete(d));
        return next;
      });
    }
  };

  // Generate trip checklist
  const handleGenerateTripChecklist = async () => {
    if (!GeminiService.hasApiKey()) {
      showApiKeyMissingModal();
      return;
    }

    setGeneratingChecklist(true);
    try {
      // Find all scheduled places in the current active plan
      const allScheduledPlaceIds = new Set<string>();
      Object.values(activePlan.days).forEach(day => {
        day.placeIds.forEach(pid => allScheduledPlaceIds.add(pid));
      });

      const placesWithReservations: { title: string; reservationDetails?: string }[] = [];
      trip.locations.forEach(loc => {
        loc.places.forEach(p => {
          if (allScheduledPlaceIds.has(p.id)) {
            placesWithReservations.push({
              title: p.title,
              reservationDetails: p.aiDetails?.reservation || p.notes
            });
          }
        });
      });

      const tripInfo = {
        name: trip.name,
        startDate: trip.startDate,
        endDate: trip.endDate,
        locations: trip.locations.map(l => ({ city: l.city, country: l.country })),
        hotels: activePlan.hotels.map(h => ({ name: h.name, checkInDate: h.checkInDate, checkOutDate: h.checkOutDate })),
        transports: activePlan.transports.map(t => ({
          type: t.type,
          departureLocationName: t.departureLocationName,
          arrivalLocationName: t.arrivalLocationName,
          departureDate: t.departureDate
        })),
        places: placesWithReservations
      };

      const result = await GeminiService.generateTripChecklistWithRotation(
        tripInfo,
        !trip.disabledDayFields?.includes('baby_logistics')
      );

      onUpdateTrip(prevTrip => {
        const updatedPlans = prevTrip.plans.map(p => {
          if (p.id === activePlan.id) {
            return {
              ...p,
              aiDetails: {
                ...(p.aiDetails || {}),
                checklist: result
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
    } catch (err: any) {
      console.error('AI checklist generation failed:', err);
      alert(`AI checklist generation failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setGeneratingChecklist(false);
    }
  };

  // Generate local essentials
  const handleGenerateLocalEssentials = async () => {
    const locId = selectedCatalogLocId || (trip.locations.length > 0 ? trip.locations[0].id : '');
    const loc = trip.locations.find(l => l.id === locId);
    if (!loc) {
      alert('Please add at least one location to your trip first.');
      return;
    }
    if (!GeminiService.hasApiKey()) {
      showApiKeyMissingModal();
      return;
    }

    setGeneratingLocalEssentials(true);
    try {
      const result = await GeminiService.generateLocalEssentialsWithRotation({ city: loc.city, country: loc.country });

      onUpdateTrip(prevTrip => {
        const updatedLocations = prevTrip.locations.map(l => {
          if (l.id === locId) {
            return {
              ...l,
              aiDetails: {
                ...(l.aiDetails || {}),
                local_essentials: result
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
    } catch (err: any) {
      console.error('AI local essentials generation failed:', err);
      alert(`AI local essentials generation failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setGeneratingLocalEssentials(false);
    }
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

  const handleSaveDayTips = (dateStr: string, newContent: string) => {
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
  };

  const handleSaveBabyLogistics = (dateStr: string, newContent: string) => {
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
  };

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

  // List of scheduled Place objects for the active day
  const scheduledPlaces: Place[] = (activeDay?.placeIds || [])
    .map(id => {
      for (const loc of trip.locations) {
        const p = loc.places.find(place => place.id === id);
        if (p) return p;
      }
      return undefined;
    })
    .filter(Boolean) as Place[];

  // Find the selected catalog place if activePlaceId is set
  const selectedCatalogPlace = useMemo(() => {
    if (!activePlaceId) return null;
    for (const loc of trip.locations) {
      const p = loc.places.find(place => place.id === activePlaceId);
      if (p) return p;
    }
    return null;
  }, [activePlaceId, trip.locations]);

  const isSelectedPlaceScheduledOnActiveDay = useMemo(() => {
    if (!activePlaceId || !activeDay) return false;
    return (activeDay.placeIds || []).includes(activePlaceId);
  }, [activePlaceId, activeDay]);

  // Construct displayScheduledPlaces, prepending the temporary preview place if applicable
  const displayScheduledPlaces = useMemo(() => {
    let list = [...scheduledPlaces];
    if (selectedCatalogPlace && !isSelectedPlaceScheduledOnActiveDay) {
      list = [{ ...selectedCatalogPlace, isTemporary: true } as Place, ...list];
    }
    return list;
  }, [scheduledPlaces, selectedCatalogPlace, isSelectedPlaceScheduledOnActiveDay]);

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

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    const cleanDateStr = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`;
    return new Date(cleanDateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

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
    <div className={`planner-view${leftCollapsed ? ' left-collapsed' : ''}${rightCollapsed ? ' right-collapsed' : ''}`}>
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
        editingPlaceNotesId={editingPlaceNotesId}
        setEditingPlaceNotesId={setEditingPlaceNotesId}
        tempNotes={tempNotes}
        setTempNotes={setTempNotes}
        startEditingNotes={startEditingNotes}
        savePlaceNotes={savePlaceNotes}
        activeGroupDropdownId={activeGroupDropdownId}
        setActiveGroupDropdownId={setActiveGroupDropdownId}
        generatingChecklist={generatingChecklist}
        onGenerateTripChecklist={handleGenerateTripChecklist}
        onSaveAiChecklist={handleSaveAiChecklist}
        onUpdateTrip={onUpdateTrip}
        daysList={daysList}
        generatingLocalEssentials={generatingLocalEssentials}
        onGenerateLocalEssentials={handleGenerateLocalEssentials}
        onSaveLocalEssentials={handleSaveAiLocalEssentials}
        formatDisplayDate={formatDisplayDate}
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
        scheduledPlaces={scheduledPlaces}
        displayScheduledPlaces={displayScheduledPlaces}
        activePlaceId={activePlaceId}
        setActivePlaceId={setActivePlaceId}
        placeGeneratingIds={placeGeneratingIds}
        editingPlaceNotesId={editingPlaceNotesId}
        setEditingPlaceNotesId={setEditingPlaceNotesId}
        tempNotes={tempNotes}
        setTempNotes={setTempNotes}
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
        handleGenerateSingleDayTips={handleGenerateSingleDayTips}
        handleSaveDayTips={handleSaveDayTips}
        handleSaveBabyLogistics={handleSaveBabyLogistics}
        handleClearDay={handleClearDay}
        handleAddPlaceFromDayTimeline={handleAddPlaceFromDayTimeline}
        handleDayPlaceDragStart={handleDayPlaceDragStart}
        handleDayPlaceDrop={handleDayPlaceDrop}
        handleCatalogPlaceDropOnTimeline={handleCatalogPlaceDropOnTimeline}
        handleMovePlaceOrder={handleMovePlaceOrder}
        handleRemovePlaceFromDay={handleRemovePlaceFromDay}
        handleAddPlaceToDay={handleAddPlaceToDay}
        handleOpenEditPlace={handleOpenEditPlace}
        handleGenerateSinglePlaceAiDetails={handleGenerateSinglePlaceAiDetails}
        startEditingNotes={startEditingNotes}
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
        daysOptions={daysList
          .filter(d => d !== activeDayStr)
          .map(d => ({
            value: d,
            label: `Day ${daysList.indexOf(d) + 1} (${formatDisplayDate(d).split(',')[1]?.trim() || d})`
          }))}
        onConfirmMove={handleMoveDayContents}
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
        onClose={() => setShowTransportModal(false)}
        tripStartDate={trip.startDate}
        tripEndDate={trip.endDate}
        onSave={handleAddTransportation}
      />

      {/* 9. Hotel Modal */}
      <HotelModal
        isOpen={showHotelModal}
        onClose={() => setShowHotelModal(false)}
        tripStartDate={trip.startDate}
        tripEndDate={trip.endDate}
        onSave={handleAddHotel}
      />

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
          days={daysList.map(d => ({
            dateStr: d,
            label: `Day ${daysList.indexOf(d) + 1} (${formatDisplayDate(d).split(',')[1]?.trim() || d})`,
            hasTips: !!activePlan.days[d]?.aiDetails?.daily_tips,
            tipsUpdatedAt: activePlan.days[d]?.aiUpdatedAt
          }))}
          onGenerate={handleGenerateDaysTips}
        />
      )}
    </div>
  );
}
