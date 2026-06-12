import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { Trip, Plan, PlanDay, Location, Place, PlaceGroup, Transportation, Hotel } from '../types';
import { 
  ArrowLeft, ArrowRight, MapPin, Plus, Trash2, Edit2, 
  ExternalLink, Navigation, ChevronUp, ChevronDown, 
  Search, Plane, Train, Bus, Car, Anchor, 
  Building, BookOpen, Clock, Check, Layers, X,
  Calendar, FileText, Landmark, Utensils, ShoppingBag,
  Camera, Heart, Share2, Sparkles, MoreVertical,
  CheckSquare, RefreshCw, Ticket, GripVertical
} from 'lucide-react';
import { searchPlacesNearLocation, DEFAULT_PLACE_GROUPS, getFormattedLocationName, getLocIcon, buildMapsLink } from '../utils/api';
import { getDaysDiff, shiftTripDates } from '../utils/dateUtils';
import MapComponent from './MapComponent';
import { GeminiService } from '../utils/ai';
import AiDetailsView from './AiDetailsView';
import { getOptimizedImageUrl } from '../utils/image';
import AiGenerateModal from './AiGenerateModal';
import AiMarkdownSection from './AiMarkdownSection';
import FunGeneratingLoader from './FunGeneratingLoader';

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

const hexToRgba = (hex: string, alpha: number) => {
  if (!hex || !hex.startsWith('#') || hex.length !== 7) return `rgba(99, 102, 241, ${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};



interface TripPlannerProps {
  trip: Trip;
  onBack: () => void;
  onUpdateTrip: (updatedTrip: Trip) => void;
  onShareTrip?: (trip: Trip) => void;
  isGoogleSignedIn?: boolean;
}

export default function TripPlanner({ trip, onBack, onUpdateTrip, onShareTrip, isGoogleSignedIn }: TripPlannerProps) {
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
      if (!target.closest('.timeline-place-dropdown-container')) {
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
  
  // Manual checklist inputs
  const [manualChecklistInput, setManualChecklistInput] = useState('');
  const [draggedChecklistIndex, setDraggedChecklistIndex] = useState<number | null>(null);

  // Trigger search on place query changes (Day timeline inline search)
  useEffect(() => {
    if (placeQuery.trim().length < 2 || !activeDayLocation) {
      setPlaceSuggestions([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      setIsSearchingPlace(true);
      const results = await searchPlacesNearLocation(placeQuery, activeDayLocation);
      setPlaceSuggestions(results);
      setIsSearchingPlace(false);
    }, 450);

    return () => clearTimeout(delayDebounce);
  }, [placeQuery, activeDayLocation]);

  const getCategoryIconComponent = (iconName: string, size = 12, className?: string, style?: React.CSSProperties) => {
    switch (iconName) {
      case 'landmark': return <Landmark size={size} className={className} style={style} />;
      case 'utensils': return <Utensils size={size} className={className} style={style} />;
      case 'shopping-bag': return <ShoppingBag size={size} className={className} style={style} />;
      case 'camera': return <Camera size={size} className={className} style={style} />;
      case 'heart': return <Heart size={size} className={className} style={style} />;
      default: return <MapPin size={size} className={className} style={style} />;
    }
  };

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
    const updatedLocations = trip.locations.map(l => {
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

    onUpdateTrip({
      ...trip,
      locations: updatedLocations
    });
  }, [trip, onUpdateTrip]);

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
      alert('Gemini API keys are missing. Please add them in the AI Settings (top-right header).');
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
        trip.customAiFields
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
  }, [trip, onUpdateTrip, handleSaveBatchAiDetails]);

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

    const customId = `custom-place-${Date.now()}`;
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
  const handleSaveTripAiConfig = (enableBabyLogistics: boolean, customAiFields: { title: string; key: string; description: string; }[]) => {
    onUpdateTrip({
      ...trip,
      enableBabyLogistics,
      customAiFields
    });
  };

  // Generate tips for a single day
  const handleGenerateSingleDayTips = async (dateStr: string) => {
    if (!GeminiService.hasApiKey()) {
      alert('Gemini API keys are missing. Please add them in the AI Settings (top-right header).');
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
        !!trip.enableBabyLogistics
      );

      if (results && results.length > 0) {
        const res = results[0];
        const updatedDays = {
          ...activePlan.days,
          [dateStr]: {
            ...day,
            aiTips: res.tips,
            aiBabyLogistics: res.babyLogistics,
            aiTipsUpdatedAt: Date.now()
          }
        };

        const updatedPlans = trip.plans.map(p => {
          if (p.id === activePlan.id) {
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
        !!trip.enableBabyLogistics
      );

      const updatedDays = { ...activePlan.days };
      results.forEach(res => {
        const day = updatedDays[res.dateStr];
        if (day) {
          updatedDays[res.dateStr] = {
             ...day,
             aiTips: res.tips,
             aiBabyLogistics: res.babyLogistics,
             aiTipsUpdatedAt: Date.now()
          };
        }
      });

      const updatedPlans = trip.plans.map(p => {
        if (p.id === activePlan.id) {
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
      alert('Gemini API keys are missing. Please add them in the AI Settings (top-right header).');
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
        !!trip.enableBabyLogistics
      );

      onUpdateTrip({
        ...trip,
        aiChecklist: result,
        aiChecklistUpdatedAt: Date.now()
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
    if (trip.locations.length === 0) {
      alert('Please add at least one location to your trip first.');
      return;
    }
    if (!GeminiService.hasApiKey()) {
      alert('Gemini API keys are missing. Please add them in the AI Settings (top-right header).');
      return;
    }

    setGeneratingLocalEssentials(true);
    try {
      const locations = trip.locations.map(l => ({ city: l.city, country: l.country }));
      const result = await GeminiService.generateLocalEssentialsWithRotation(locations);

      onUpdateTrip({
        ...trip,
        aiLocalEssentials: result,
        aiLocalEssentialsUpdatedAt: Date.now()
      });
    } catch (err: any) {
      console.error('AI local essentials generation failed:', err);
      alert(`AI local essentials generation failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setGeneratingLocalEssentials(false);
    }
  };

  // Manual checklist operations
  const handleAddManualChecklistItem = (text: string) => {
    if (!text.trim()) return;
    const newItem = {
      id: `chk-${Date.now()}`,
      text: text.trim(),
      completed: false
    };
    onUpdateTrip({
      ...trip,
      manualChecklist: [...(trip.manualChecklist || []), newItem]
    });
  };

  const handleToggleManualChecklistItem = (id: string) => {
    const updated = (trip.manualChecklist || []).map(item => {
      if (item.id === id) {
        return { ...item, completed: !item.completed };
      }
      return item;
    });
    onUpdateTrip({
      ...trip,
      manualChecklist: updated
    });
  };

  const handleDeleteManualChecklistItem = (id: string) => {
    onUpdateTrip({
      ...trip,
      manualChecklist: (trip.manualChecklist || []).filter(item => item.id !== id)
    });
  };

  const handleMoveManualChecklistItem = (id: string, direction: 'up' | 'down') => {
    if (!trip.manualChecklist) return;
    const list = [...trip.manualChecklist];
    const index = list.findIndex(item => item.id === id);
    if (index === -1) return;
    
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;
    
    // Swap
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;
    
    onUpdateTrip({
      ...trip,
      manualChecklist: list
    });
  };

  const handleSaveAiChecklist = (newContent: string) => {
    onUpdateTrip({
      ...trip,
      aiChecklist: newContent,
      aiChecklistUpdatedAt: Date.now()
    });
  };

  const handleSaveAiLocalEssentials = (newContent: string) => {
    onUpdateTrip({
      ...trip,
      aiLocalEssentials: newContent,
      aiLocalEssentialsUpdatedAt: Date.now()
    });
  };

  const handleSaveDayTips = (dateStr: string, newContent: string) => {
    const day = activePlan.days[dateStr];
    if (!day) return;
    const updatedDays = {
      ...activePlan.days,
      [dateStr]: {
        ...day,
        aiTips: newContent,
        aiTipsUpdatedAt: Date.now()
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
        aiBabyLogistics: newContent,
        aiTipsUpdatedAt: Date.now()
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

  const leftPanelJSX = useMemo(() => {
    // Pre-calculate allocated days mapping once for all catalog cards to prevent heavy calculations in render loops
    const placeAllocatedDaysMap = new Map<string, string[]>();
    Object.keys(activePlan.days).forEach(dateStr => {
      activePlan.days[dateStr].placeIds.forEach(placeId => {
        if (!placeAllocatedDaysMap.has(placeId)) {
          placeAllocatedDaysMap.set(placeId, []);
        }
        placeAllocatedDaysMap.get(placeId)!.push(dateStr);
      });
    });
    // Sort the dates
    placeAllocatedDaysMap.forEach(dates => dates.sort());

    // Local cached display date formatter to avoid running slow Intl engines in nested loops
    const displayDateCache = new Map<string, string>();
    const getCachedFormattedDisplayDate = (dateStr: string) => {
      if (!displayDateCache.has(dateStr)) {
        displayDateCache.set(dateStr, formatDisplayDate(dateStr));
      }
      return displayDateCache.get(dateStr)!;
    };

    return (
      <div className={`catalog-panel left-panel-accordion ${activeMobileTab === 'catalog' ? 'mobile-active' : ''}`}>
        {/* Back to dashboard button (always visible at the top) */}
        <button 
          className="mini-icon-btn" 
          onClick={onBack} 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            fontSize: '12px', 
            width: 'fit-content',
            padding: '6px 10px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '6px',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            marginBottom: '4px'
          }}
        >
          <ArrowLeft size={14} /> Back to dashboard
        </button>

        {/* Accordion Item 1: Catalog */}
        <div className={`accordion-section ${expandedLeftSection === 'catalog' ? 'expanded' : 'collapsed'}`}>
          <div 
            className="accordion-header flex-between"
            onClick={() => setExpandedLeftSection('catalog')}
          >
            <span className="flex-align" style={{ gap: '8px', fontSize: '14px', fontWeight: 600 }}>
              <BookOpen size={16} style={{ color: 'var(--accent-primary)' }} />
              Catalog
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {catalogLocation ? `${catalogLocation.places.length} places` : 'Empty'}
            </span>
          </div>
          
          {expandedLeftSection === 'catalog' && (
            <div className="accordion-content">
              {/* Back to dashboard and select location inside catalog */}
              <div className="panel-header" style={{ padding: '0 0 12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '12px' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <select
                    value={selectedCatalogLocId}
                    onChange={(e) => setSelectedCatalogLocId(e.target.value)}
                    style={{ flex: 1, padding: '6px 28px 6px 10px', fontSize: '12px', background: 'var(--bg-dark)', minWidth: 0 }}
                  >
                    {trip.locations.length === 0 && <option value="">No Locations Added</option>}
                    {trip.locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{getLocIcon(loc)} {getFormattedLocationName(loc, trip.locations)}</option>
                    ))}
                  </select>
                  
                  {catalogLocation && trip.canEdit !== false && (
                    <button 
                      className="mini-icon-btn" 
                      onClick={() => setShowEditLocationModal(true)}
                      data-tooltip="Edit Location Settings"
                      style={{ padding: '6px', height: '28px', width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                    >
                      <Edit2 size={12} />
                    </button>
                  )}
                  {trip.canEdit !== false && (
                    <button 
                      className="btn-primary flex-align"
                      style={{ padding: '6px', fontSize: '11px', height: '28px', width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                      onClick={() => {
                        setAddLocationForDay(false);
                        setShowAddLocationModal(true);
                      }}
                      data-tooltip="Add Location"
                    >
                      <Plus size={12} />
                    </button>
                  )}
                </div>
              </div>

              {catalogLocation ? (
                <div className="catalog-content" style={{ padding: 0 }}>
                  {/* Catalog Group Management */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Groups</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <label className="flex-align" style={{ fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none', gap: '4px' }}>
                        <input
                          type="checkbox"
                          checked={hideAllocatedPlaces}
                          onChange={(e) => setHideAllocatedPlaces(e.target.checked)}
                          style={{ margin: 0, width: '13px', height: '13px', accentColor: 'var(--accent-primary)', minHeight: 'auto', cursor: 'pointer' }}
                        />
                        Hide Allocated
                      </label>
                      {trip.canEdit !== false && (
                        <button 
                          className="mini-icon-btn" 
                          onClick={() => setShowGroupModal(true)} 
                          data-tooltip="Add Custom Category"
                          data-tooltip-position="bottom"
                          style={{ color: 'var(--accent-secondary)', padding: '2px' }}
                        >
                          <Plus size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* List by Groups */}
                  {[
                    ...(trip.placeGroups || DEFAULT_PLACE_GROUPS).map((group, groupIdx, allGroups) => ({
                      ...group,
                      groupIdx,
                      isReorderable: true,
                      isFirst: groupIdx === 0,
                      isLast: groupIdx === allGroups.length - 1
                    })),
                    { id: 'new', name: 'New / Unassigned', color: '#6b7280', icon: 'map-pin', isReorderable: false, groupIdx: -1, isFirst: false, isLast: false }
                  ].map(group => {
                    const placesInGroup = catalogLocation.places.filter(p => {
                      if (group.id === 'new') {
                        return !p.placeGroupId || p.placeGroupId === 'new';
                      }
                      return p.placeGroupId === group.id;
                    });
                    const filteredPlaces = placesInGroup.filter(p => {
                      if (!hideAllocatedPlaces) return true;
                      return !Object.values(activePlan.days).some(day => day.placeIds.includes(p.id));
                    });
                    if (placesInGroup.length === 0 && group.id === 'new') return null;

                    return (
                      <div 
                        key={group.id} 
                        className="place-group-section"
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (draggedPlaceId && dragOverGroupId !== group.id) {
                            setDragOverGroupId(group.id);
                          }
                        }}
                        onDragLeave={() => setDragOverGroupId(null)}
                        onDrop={() => {
                          handlePlaceDropOnGroup(group.id);
                          setDragOverGroupId(null);
                        }}
                        style={{
                          border: (dragOverGroupId === group.id && draggedPlaceId) ? '2px dashed var(--accent-primary)' : '2px dashed transparent',
                          borderRadius: '8px',
                          padding: '4px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div className="place-group-header">
                          <span className="place-group-title">
                            <span className="group-badge-dot" style={{ backgroundColor: group.color }} />
                            {group.name}
                          </span>
                          <div className="flex-align" style={{ gap: '4px' }}>
                            {trip.canEdit !== false && (
                              <>
                                <button 
                                  className="mini-icon-btn" 
                                  onClick={() => {
                                    setAiGeneratePlaces(placesInGroup);
                                    setAiGenerateCity(catalogLocation?.city || '');
                                    setAiGenerateCountry(catalogLocation?.country || '');
                                    setShowAiGenerateModal(true);
                                  }} 
                                  data-tooltip={`AI Travel Guide for ${group.name}`} 
                                  style={{ padding: '2px', color: '#a5b4fc', display: 'flex', alignItems: 'center' }}
                                >
                                  <Sparkles size={12} />
                                </button>
                                
                                <button 
                                  className="mini-icon-btn" 
                                  onClick={() => {
                                    setEditingPlace({
                                      id: `new-temp-${Date.now()}`,
                                      title: '',
                                      description: '',
                                      openingHours: '',
                                      lat: catalogLocation?.lat || 0,
                                      lng: catalogLocation?.lng || 0,
                                      placeGroupId: group.id,
                                      notes: '',
                                      photoUrl: '',
                                      mapsLink: ''
                                    });
                                    setAutoScheduleOnActiveDay(false);
                                    setShowCustomPlaceModal(true);
                                  }} 
                                  data-tooltip={`Add Place to ${group.name}`} 
                                  style={{ padding: '2px' }}
                                >
                                  <Plus size={10} />
                                </button>
                              </>
                            )}
                            {group.isReorderable && trip.canEdit !== false && (
                              <div className="group-dropdown-container" style={{ position: 'relative', display: 'inline-block' }}>
                                <button 
                                  className="mini-icon-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveGroupDropdownId(activeGroupDropdownId === group.id ? null : group.id);
                                  }}
                                  data-tooltip="Group Options"
                                  style={{ 
                                    padding: '6px', 
                                    height: '28px', 
                                    width: '28px', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <MoreVertical size={14} />
                                </button>
                                {activeGroupDropdownId === group.id && (
                                  <div className="dropdown-menu" style={{ right: 0, left: 'auto' }}>
                                    <button 
                                      className="dropdown-item"
                                      disabled={group.isFirst}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMoveGroupOrder(group.groupIdx!, 'up');
                                        setActiveGroupDropdownId(null);
                                      }}
                                    >
                                      <ChevronUp size={12} /> Move Up
                                    </button>
                                    <button 
                                      className="dropdown-item"
                                      disabled={group.isLast}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMoveGroupOrder(group.groupIdx!, 'down');
                                        setActiveGroupDropdownId(null);
                                      }}
                                    >
                                      <ChevronDown size={12} /> Move Down
                                    </button>
                                    <button 
                                      className="dropdown-item"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        startEditingGroup(group as PlaceGroup);
                                        setActiveGroupDropdownId(null);
                                      }}
                                    >
                                      <Edit2 size={12} /> Edit Group
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                            <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                              {filteredPlaces.length}
                            </span>
                          </div>
                        </div>

                        <div 
                          className="catalog-places-list" 
                          onDragLeave={() => setDragOverPlaceId(null)}
                          style={{ minHeight: '30px' }}
                        >
                          {filteredPlaces.map((place, placeIndexInGroup) => (
                            <div key={place.id} style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                              {dragOverPlaceId === place.id && draggedPlaceId !== place.id && (
                                <div style={{
                                  position: 'absolute',
                                  top: dragOverPlacePosition === 'top' ? '-6px' : 'auto',
                                  bottom: dragOverPlacePosition === 'bottom' ? '-6px' : 'auto',
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
                                className="catalog-place-card"
                                draggable={trip.canEdit !== false}
                                onDragStart={() => handlePlaceDragStart(place.id)}
                                onDragEnd={() => {
                                  setDraggedPlaceId(null);
                                  setDragOverPlaceId(null);
                                  setDragOverGroupId(null);
                                  setDragOverDayPlaceIndex(null);
                                }}
                                onDragOver={(e) => {
                                  if (!draggedPlaceId || draggedPlaceId === place.id) return;
                                  e.preventDefault();
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const relativeY = e.clientY - rect.top;
                                  const position = relativeY < rect.height / 2 ? 'top' : 'bottom';
                                  
                                  if (dragOverPlaceId !== place.id || dragOverPlacePosition !== position) {
                                    setDragOverPlaceId(place.id);
                                    setDragOverPlacePosition(position);
                                  }
                                }}
                                onDrop={(e) => {
                                  e.stopPropagation();
                                  handlePlaceDropOnPlace(place.id, group.id, dragOverPlacePosition);
                                  setDragOverPlaceId(null);
                                }}
                                onClick={() => setActivePlaceId(activePlaceId === place.id ? undefined : place.id)}
                                style={{ 
                                  borderColor: activePlaceId === place.id ? 'var(--accent-primary)' : 'var(--border-glass)',
                                  cursor: 'grab'
                                }}
                              >
                                <div className="place-card-header">
                                  {place.photoUrl ? (
                                    <img 
                                      src={getOptimizedImageUrl(place.photoUrl, 120)} 
                                      className="place-card-thumb" 
                                      alt="" 
                                      loading="lazy"
                                      decoding="async"
                                    />
                                  ) : (
                                    <div 
                                      className="place-card-thumb" 
                                      style={{ 
                                        background: 'rgba(255,255,255,0.05)', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center'
                                      }}
                                    >
                                      <MapPin size={16} />
                                    </div>
                                  )}
                                  <div className="place-card-info" style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '6px' }}>
                                      <h4 className="place-card-title" style={{ margin: 0, flex: 1, minWidth: 0 }}>{place.title}</h4>
                                      {(() => {
                                        const allocatedDays = placeAllocatedDaysMap.get(place.id) || [];
                                        if (allocatedDays.length === 0) return null;
                                        return (
                                          <div style={{ display: 'flex', gap: '3px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '120px' }}>
                                            {allocatedDays.map(dateStr => {
                                              const isActiveDay = dateStr === activeDayStr;
                                              const formatted = getCachedFormattedDisplayDate(dateStr);
                                              return (
                                                <span 
                                                  key={dateStr} 
                                                  style={{
                                                    fontSize: '9px',
                                                    fontWeight: 600,
                                                    padding: '2px 5px',
                                                    borderRadius: '4px',
                                                    background: isActiveDay ? 'rgba(99, 102, 241, 0.35)' : 'rgba(255, 255, 255, 0.03)',
                                                    color: isActiveDay ? '#ffffff' : 'var(--text-muted)',
                                                    border: isActiveDay ? '1px solid var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.05)',
                                                    whiteSpace: 'nowrap'
                                                  }}
                                                  title={isActiveDay ? 'Scheduled for today' : `Scheduled for ${formatted}`}
                                                >
                                                  {formatted.split(',')[1]?.trim() || dateStr}
                                                </span>
                                              );
                                            })}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                    {place.openingHours && (
                                      <div className="place-card-hours" style={{ marginTop: '2px' }}>
                                        <Clock size={10} /> {place.openingHours}
                                      </div>
                                    )}
                                  </div>
                                  {trip.canEdit !== false && (
                                    <div 
                                      style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignSelf: 'center', flexShrink: 0 }} 
                                      onClick={e => e.stopPropagation()}
                                    >
                                      <button 
                                        className="mini-icon-btn" 
                                        disabled={placeIndexInGroup === 0} 
                                        onClick={() => handleMoveCatalogPlace(place.id, 'up')}
                                        style={{ opacity: placeIndexInGroup === 0 ? 0.3 : 1, padding: '2px' }}
                                        data-tooltip="Move Up"
                                        draggable={false}
                                        onDragStart={e => e.stopPropagation()}
                                      >
                                        <ChevronUp size={12} />
                                      </button>
                                      <button 
                                        className="mini-icon-btn" 
                                        disabled={placeIndexInGroup === filteredPlaces.length - 1} 
                                        onClick={() => handleMoveCatalogPlace(place.id, 'down')}
                                        style={{ opacity: placeIndexInGroup === filteredPlaces.length - 1 ? 0.3 : 1, padding: '2px' }}
                                        data-tooltip="Move Down"
                                        draggable={false}
                                        onDragStart={e => e.stopPropagation()}
                                      >
                                        <ChevronDown size={12} />
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Expand Details if selected */}
                                {activePlaceId === place.id && (
                                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '13px' }} onClick={e => e.stopPropagation()}>
                                    {place.description && <p style={{ color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.3, textTransform: 'none' }}>{place.description}</p>}
                                    
                                    {/* Notes Field (Shared at Trip level) */}
                                    <div style={{ margin: '8px 0', padding: '6px 8px', background: 'rgba(99,102,241,0.04)', borderLeft: '2px solid var(--accent-primary)', borderRadius: '0 4px 4px 0' }}>
                                      <label style={{ fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                                        <FileText size={11} /> Notes
                                      </label>
                                      
                                      {editingPlaceNotesId === place.id && trip.canEdit !== false ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                                          <textarea 
                                            value={tempNotes}
                                            onChange={(e) => setTempNotes(e.target.value)}
                                            placeholder="Add notes..."
                                            rows={3}
                                            style={{ 
                                              padding: '6px', 
                                              fontSize: '13px', 
                                              width: '100%', 
                                              background: 'var(--bg-dark)', 
                                              border: '1px solid var(--border-glass)', 
                                              color: 'var(--text-primary)',
                                              borderRadius: '4px',
                                              resize: 'vertical'
                                            }}
                                          />
                                          <div style={{ display: 'flex', gap: '6px', alignSelf: 'flex-end' }}>
                                            <button 
                                              className="btn-secondary" 
                                              onClick={() => setEditingPlaceNotesId(null)} 
                                              style={{ padding: '4px 8px', fontSize: '11px' }}
                                            >
                                              Cancel
                                            </button>
                                            <button 
                                              className="btn-primary flex-align" 
                                              onClick={() => savePlaceNotes(place.id)} 
                                              style={{ padding: '4px 8px', fontSize: '11px', gap: '4px' }}
                                            >
                                              <Check size={12} /> Save Notes
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                          <span style={{ 
                                            fontStyle: 'italic', 
                                            color: place.notes ? 'var(--text-primary)' : 'var(--text-muted)',
                                            whiteSpace: 'pre-wrap',
                                            display: 'block',
                                            width: '100%',
                                            lineHeight: 1.4,
                                            fontSize: '12.5px'
                                          }}>
                                            {place.notes || 'No notes added yet.'}
                                          </span>
                                          {trip.canEdit !== false && (
                                            <button className="mini-icon-btn" onClick={() => startEditingNotes(place)} style={{ padding: '2px' }}>
                                              <Edit2 size={10} />
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', marginBottom: '8px' }}>
                                      <a 
                                        href={place.mapsLink || buildMapsLink(place.title, place.lat, place.lng, catalogLocation?.city)} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="btn-secondary flex-align"
                                        style={{ padding: '4px 8px', fontSize: '11px', gap: '4px', textDecoration: 'none', borderRadius: '8px', whiteSpace: 'nowrap' }}
                                      >
                                        Map <ExternalLink size={10} />
                                      </a>
                                      {trip.canEdit !== false && (
                                        <>
                                          <button 
                                            className="btn-secondary flex-align"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenEditPlace(place);
                                            }}
                                            style={{ padding: '4px 8px', fontSize: '11px', gap: '4px', borderRadius: '8px', whiteSpace: 'nowrap' }}
                                            data-tooltip="Edit Place Details"
                                          >
                                            <Edit2 size={12} /> Edit
                                          </button>
                                          <button 
                                            className="btn-primary" 
                                            style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '8px', whiteSpace: 'nowrap' }}
                                            onClick={() => {
                                              handleAddPlaceToDay(place);
                                            }}
                                          >
                                            + Add to Day
                                          </button>
                                        </>
                                      )}
                                    </div>

                                    <AiDetailsView
                                      place={place}
                                      onGenerate={() => handleGenerateSinglePlaceAiDetails(place.id)}
                                      canEdit={trip.canEdit !== false}
                                      isGenerating={placeGeneratingIds.has(place.id)}
                                      layoutMode="single-col"
                                      customAiFields={trip.customAiFields}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: '40px 20px', textTransform: 'none', color: 'var(--text-muted)', textAlign: 'center', fontSize: '14px' }}>
                  Add locations above to start building your Catalog.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Accordion Item 2: Checklist */}
        <div className={`accordion-section ${expandedLeftSection === 'checklist' ? 'expanded' : 'collapsed'}`}>
          <div 
            className="accordion-header flex-between"
            onClick={() => setExpandedLeftSection(expandedLeftSection === 'checklist' ? 'catalog' : 'checklist')}
          >
            <span className="flex-align" style={{ gap: '8px', fontSize: '14px', fontWeight: 600 }}>
              <CheckSquare size={16} style={{ color: 'var(--accent-secondary)' }} />
              Checklist
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {(() => {
                const total = (trip.manualChecklist || []).length;
                const done = (trip.manualChecklist || []).filter(c => c.completed).length;
                return `${done}/${total} done`;
              })()}
            </span>
          </div>
          
          {expandedLeftSection === 'checklist' && (
            <div className="accordion-content">
              {/* Checklist Content */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', flex: 1, minHeight: 0 }}>
                
                {/* Section A: Manual Checklist */}
                <div>
                  <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Personal Checklist</span>
                  </h4>
                  
                  {trip.canEdit !== false && (
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleAddManualChecklistItem(manualChecklistInput);
                        setManualChecklistInput('');
                      }}
                      style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}
                    >
                      <input 
                        type="text" 
                        placeholder="Add new task..." 
                        value={manualChecklistInput} 
                        onChange={(e) => setManualChecklistInput(e.target.value)}
                        style={{ flex: 1, padding: '4px 8px', fontSize: '12px', height: '28px' }}
                      />
                      <button 
                        type="submit" 
                        className="btn-primary" 
                        style={{ padding: '4px 10px', fontSize: '11px', height: '28px' }}
                      >
                        Add
                      </button>
                    </form>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto', paddingRight: '2px' }}>
                    {(trip.manualChecklist || []).map((item, idx) => (
                      <div 
                        key={item.id} 
                        className="flex-between glass-panel"
                        draggable={trip.canEdit !== false}
                        onDragStart={(e) => {
                          setDraggedChecklistIndex(idx);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggedChecklistIndex === null || draggedChecklistIndex === idx) return;
                          const list = [...(trip.manualChecklist || [])];
                          const [removed] = list.splice(draggedChecklistIndex, 1);
                          list.splice(idx, 0, removed);
                          onUpdateTrip({
                            ...trip,
                            manualChecklist: list
                          });
                        }}
                        onDragEnd={() => setDraggedChecklistIndex(null)}
                        style={{ 
                          padding: '6px 10px', 
                          borderColor: 'rgba(255,255,255,0.04)',
                          backgroundColor: 'rgba(255,255,255,0.01)',
                          borderRadius: '8px',
                          opacity: draggedChecklistIndex === idx ? 0.4 : 1,
                          cursor: trip.canEdit !== false ? 'grab' : 'default',
                          transition: 'opacity 0.2s ease, background-color 0.2s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                          {trip.canEdit !== false && (
                            <span 
                              style={{ 
                                cursor: 'grab', 
                                color: 'var(--text-muted)', 
                                display: 'flex', 
                                alignItems: 'center',
                                opacity: 0.6,
                                paddingRight: '2px'
                              }}
                            >
                              <GripVertical size={11} />
                            </span>
                          )}
                          <label className="flex-align" style={{ gap: '8px', cursor: trip.canEdit !== false ? 'pointer' : 'default', textTransform: 'none', flex: 1, minWidth: 0 }}>
                            <input 
                              type="checkbox" 
                              checked={item.completed} 
                              disabled={trip.canEdit === false}
                              onChange={() => handleToggleManualChecklistItem(item.id)}
                              style={{ width: '14px', height: '14px', margin: 0, cursor: trip.canEdit !== false ? 'pointer' : 'default' }}
                            />
                          <span style={{ 
                            fontSize: '12px', 
                            color: item.completed ? 'var(--text-muted)' : 'var(--text-primary)',
                            textDecoration: item.completed ? 'line-through' : 'none',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap'
                          }}>
                            {item.text}
                          </span>
                        </label>
                      </div>
                        {trip.canEdit !== false && (
                          <div style={{ display: 'flex', gap: '2px', alignItems: 'center', marginLeft: '6px' }}>
                            <button 
                              type="button" 
                              className="mini-icon-btn" 
                              onClick={() => handleMoveManualChecklistItem(item.id, 'up')}
                              disabled={(trip.manualChecklist || []).indexOf(item) === 0}
                              style={{ padding: '2px', height: '20px', width: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (trip.manualChecklist || []).indexOf(item) === 0 ? 0.3 : 1 }}
                              data-tooltip="Move Up"
                            >
                              <ChevronUp size={12} />
                            </button>
                            <button 
                              type="button" 
                              className="mini-icon-btn" 
                              onClick={() => handleMoveManualChecklistItem(item.id, 'down')}
                              disabled={(trip.manualChecklist || []).indexOf(item) === (trip.manualChecklist || []).length - 1}
                              style={{ padding: '2px', height: '20px', width: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (trip.manualChecklist || []).indexOf(item) === (trip.manualChecklist || []).length - 1 ? 0.3 : 1 }}
                              data-tooltip="Move Down"
                            >
                              <ChevronDown size={12} />
                            </button>
                            <button 
                              type="button" 
                              className="trip-delete-btn" 
                              onClick={() => handleDeleteManualChecklistItem(item.id)}
                              style={{ padding: '2px', marginLeft: '4px' }}
                              data-tooltip="Delete Task"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}

                    {(trip.manualChecklist || []).length === 0 && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        No personal tasks added.
                      </span>
                    )}
                  </div>
                </div>

                {/* Section B: AI Generated Checklist */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                  <div className="flex-between" style={{ marginBottom: '8px' }}>
                    <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', margin: 0 }}>
                      AI Preparation Checklist
                    </h4>
                    {trip.canEdit !== false && (
                      <button 
                        className="mini-icon-btn flex-align"
                        style={{ fontSize: '10px', padding: '2px 8px', gap: '4px', color: '#a5b4fc', background: 'rgba(99, 102, 241, 0.12)' }}
                        onClick={handleGenerateTripChecklist}
                        disabled={generatingChecklist}
                      >
                        {generatingChecklist ? <RefreshCw size={10} className="spin" /> : <Sparkles size={10} />}
                        {trip.aiChecklist ? 'Regenerate' : 'Generate'}
                      </button>
                    )}
                  </div>

                  {generatingChecklist ? (
                    <FunGeneratingLoader message="Analyzing trip logistics & requirements..." />
                  ) : trip.aiChecklist ? (
                    <AiMarkdownSection 
                      content={trip.aiChecklist} 
                      updatedAt={trip.aiChecklistUpdatedAt} 
                      onSave={handleSaveAiChecklist}
                      canEdit={trip.canEdit !== false}
                      style={{ maxHeight: 'none', overflowY: 'auto', flex: 1 }}
                    />
                  ) : (
                    <div style={{ padding: '16px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', display: 'block', marginBottom: '8px' }}>
                        No AI checklist generated.
                      </span>
                      {trip.canEdit !== false && (
                        <button 
                          className="btn-secondary flex-align"
                          style={{ margin: '0 auto', fontSize: '11px', padding: '4px 10px', gap: '4px' }}
                          onClick={handleGenerateTripChecklist}
                        >
                          <Sparkles size={11} /> Generate Checklist
                        </button>
                      )}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}
        </div>

        {/* Accordion Item 3: Reservations */}
        <div className={`accordion-section ${expandedLeftSection === 'reservations' ? 'expanded' : 'collapsed'}`}>
          <div 
            className="accordion-header flex-between"
            onClick={() => setExpandedLeftSection(expandedLeftSection === 'reservations' ? 'catalog' : 'reservations')}
          >
            <span className="flex-align" style={{ gap: '8px', fontSize: '14px', fontWeight: 600 }}>
              <Building size={16} style={{ color: 'var(--color-success)' }} />
              Reservations
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {(() => {
                const hotelsCount = activePlan.hotels.length;
                const transitCount = activePlan.transports.length;
                return `${hotelsCount}H / ${transitCount}T`;
              })()}
            </span>
          </div>
          
          {expandedLeftSection === 'reservations' && (
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
                            onClick={() => {
                              setExpandedLeftSection('catalog');
                              setActivePlaceId(p.id);
                            }}
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
          )}
        </div>

        {/* Accordion Item 4: Tips */}
        <div className={`accordion-section ${expandedLeftSection === 'tips' ? 'expanded' : 'collapsed'}`}>
          <div 
            className="accordion-header flex-between"
            onClick={() => setExpandedLeftSection(expandedLeftSection === 'tips' ? 'catalog' : 'tips')}
          >
            <span className="flex-align" style={{ gap: '8px', fontSize: '14px', fontWeight: 600 }}>
              <Sparkles size={16} style={{ color: 'var(--accent-primary)' }} />
              Tips (Local Essentials)
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {trip.aiLocalEssentials ? 'Ready' : 'Empty'}
            </span>
          </div>
          
          {expandedLeftSection === 'tips' && (
            <div className="accordion-content" style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1, minHeight: 0 }}>
              {/* Local Essentials Content */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', flex: 1, minHeight: 0 }}>
                <div className="flex-between">
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', textTransform: 'none' }}>
                    Quick reference for convenience stores, currencies, local apps, dress codes, etc.
                  </span>
                  {trip.locations.length > 0 && trip.canEdit !== false && (
                    <button 
                      className="mini-icon-btn flex-align"
                      style={{ fontSize: '10px', padding: '2px 8px', gap: '4px', color: '#a5b4fc', background: 'rgba(99, 102, 241, 0.12)', flexShrink: 0 }}
                      onClick={handleGenerateLocalEssentials}
                      disabled={generatingLocalEssentials}
                    >
                      {generatingLocalEssentials ? <RefreshCw size={10} className="spin" /> : <Sparkles size={10} />}
                      {trip.aiLocalEssentials ? 'Regenerate' : 'Generate'}
                    </button>
                  )}
                </div>

                {generatingLocalEssentials ? (
                  <FunGeneratingLoader message="Gathering destination reference guide..." />
                ) : trip.aiLocalEssentials ? (
                  <AiMarkdownSection 
                    content={trip.aiLocalEssentials} 
                    updatedAt={trip.aiLocalEssentialsUpdatedAt} 
                    onSave={handleSaveAiLocalEssentials}
                    canEdit={trip.canEdit !== false}
                    style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}
                  />
                ) : (
                  <div style={{ padding: '20px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', display: 'block', marginBottom: '8px' }}>
                      No Local Essentials Reference guide generated yet.
                    </span>
                    {trip.locations.length > 0 && trip.canEdit !== false && (
                      <button 
                        className="btn-secondary flex-align"
                        style={{ margin: '0 auto', fontSize: '11px', padding: '4px 10px', gap: '4px' }}
                        onClick={handleGenerateLocalEssentials}
                      >
                        <Sparkles size={11} /> Generate Tips
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    );
  }, [
    activeMobileTab,
    trip.locations,
    trip.placeGroups,
    trip.canEdit,
    selectedCatalogLocId,
    catalogLocation,
    hideAllocatedPlaces,
    activePlan.days,
    dragOverGroupId,
    draggedPlaceId,
    dragOverPlaceId,
    dragOverPlacePosition,
    activePlaceId,
    editingPlaceNotesId,
    tempNotes,
    onBack,
    handlePlaceDragStart,
    handlePlaceDropOnGroup,
    handlePlaceDropOnPlace,
    handleMoveGroupOrder,
    startEditingGroup,
    handleMoveCatalogPlace,
    savePlaceNotes,
    startEditingNotes,
    handleOpenEditPlace,
    handleAddPlaceToDay,
    activeGroupDropdownId,
    activeDayStr,
    placeGeneratingIds,
    handleGenerateSinglePlaceAiDetails,
    expandedLeftSection,
    manualChecklistInput,
    generatingChecklist,
    generatingLocalEssentials,
    trip.manualChecklist,
    trip.aiChecklist,
    trip.aiChecklistUpdatedAt,
    trip.aiLocalEssentials,
    trip.aiLocalEssentialsUpdatedAt,
    trip.customAiFields,
    activePlan.hotels,
    activePlan.transports
  ]);

  return (
    <div className="planner-view">
      {/* LEFT PANEL: Accordion (Catalog, Checklist, Reservations, Tips) */}
      {leftPanelJSX}

      {/* MIDDLE PANEL: Day-to-Day timeline */}
      <div className={`itinerary-panel ${activeMobileTab === 'itinerary' ? 'mobile-active' : ''}`}>
        <div className="itinerary-header">
          <div className="trip-meta-info">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '24px' }}>{trip.name}</h2>
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
              <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px', display: 'flex', gap: '8px' }}>
                <span className="flex-align" style={{ gap: '6px' }}>
                  <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                  {formatDisplayDate(trip.startDate)} - {formatDisplayDate(trip.endDate)}
                </span>
              </div>
            </div>
            
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
                  <span style={{ fontSize: '24px', marginRight: '8px', display: 'flex', alignItems: 'center' }}>
                    {getLocIcon(activeDayLocation)}
                  </span>
                ) : (
                  <MapPin size={24} style={{ color: 'var(--color-danger)' }} />
                )}
                <div>
                  <h3 style={{ fontSize: '18px', color: 'var(--text-primary)' }}>
                    {activeDayLocation ? getFormattedLocationName(activeDayLocation, trip.locations) : 'Not Selected'}
                  </h3>
                </div>
              </div>

              {trip.canEdit !== false && (
                <div className="flex-align" style={{ gap: '8px' }}>
                  <select
                    value={activeDay?.locationId || ''}
                    onChange={(e) => {
                      if (e.target.value === 'ADD_NEW_LOCATION') {
                        setAddLocationForDay(true);
                        setShowAddLocationModal(true);
                      } else {
                        handleSetDayLocation(e.target.value);
                      }
                    }}
                    style={{ 
                      padding: '8px 12px', 
                      fontSize: '13px', 
                      background: 'rgba(15,23,42,0.8)', 
                      width: 'auto', 
                      border: '1px solid var(--border-glass)', 
                      borderRadius: '8px' 
                    }}
                  >
                    <option value="">Select Location...</option>
                    {trip.locations.map(l => (
                      <option key={l.id} value={l.id}>{getLocIcon(l)} {getFormattedLocationName(l, trip.locations)}</option>
                    ))}
                    <option value="ADD_NEW_LOCATION">Add Location...</option>
                  </select>
                </div>
              )}
            </div>

            {/* 2. Hotel reservations overlapping this day */}
            <div>
              <div className="timeline-section-title flex-between">
                <span className="flex-align"><Building size={16} /> Hotel Stays</span>
                {trip.canEdit !== false && (
                  <button className="mini-icon-btn" onClick={() => setShowHotelModal(true)} style={{ color: 'var(--color-success)' }}>
                    <Plus size={14} /> Add Hotel
                  </button>
                )}
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
            <div>
              <div className="timeline-section-title flex-between">
                <span className="flex-align"><Plane size={16} /> Transit Schedule</span>
                {trip.canEdit !== false && (
                  <button className="mini-icon-btn" onClick={() => setShowTransportModal(true)} style={{ color: 'var(--color-warning)' }}>
                    <Plus size={14} /> Add Transit
                  </button>
                )}
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
            <div className="glass-panel ai-day-assistant-card" style={{ padding: '12px 14px', margin: '8px 0 16px 0', borderColor: 'rgba(99, 102, 241, 0.15)', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.45) 0%, rgba(99, 102, 241, 0.03) 100%)' }}>
              <div className="flex-between" style={{ marginBottom: '8px' }}>
                <span className="flex-align" style={{ gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  <Sparkles size={14} style={{ color: 'var(--accent-primary)' }} />
                  AI Day Assistant
                </span>
                
                <div style={{ display: 'flex', gap: '6px' }}>
                  {trip.canEdit !== false && (
                    <button 
                      className="mini-icon-btn flex-align"
                      style={{ fontSize: '10px', padding: '2px 8px', gap: '4px', background: 'rgba(99, 102, 241, 0.12)', color: '#a5b4fc' }}
                      onClick={() => handleGenerateSingleDayTips(activeDayStr)}
                      disabled={daysGeneratingDates.has(activeDayStr)}
                    >
                      {daysGeneratingDates.has(activeDayStr) ? <RefreshCw size={10} className="spin" /> : <RefreshCw size={10} />}
                      {activeDay?.aiTips ? 'Regenerate Tips' : 'Generate Tips'}
                    </button>
                  )}
                  {trip.canEdit !== false && (
                    <button 
                      className="mini-icon-btn flex-align"
                      style={{ fontSize: '10px', padding: '2px 8px', gap: '4px' }}
                      onClick={() => {
                        setShowAiGenerateDaysModal(true);
                      }}
                    >
                      <Sparkles size={10} /> Batch Generate Tips
                    </button>
                  )}
                </div>
              </div>

              {daysGeneratingDates.has(activeDayStr) ? (
                <FunGeneratingLoader message="Gemini is designing daily tips & route logistics..." />
              ) : activeDay?.aiTips ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  
                  {/* Daily Tips */}
                  <AiMarkdownSection 
                    content={activeDay.aiTips} 
                    updatedAt={activeDay.aiTipsUpdatedAt}
                    onSave={(newVal) => handleSaveDayTips(activeDayStr, newVal)}
                    canEdit={trip.canEdit !== false}
                  />

                  {/* Baby Logistics (if enabled and generated) */}
                  {trip.enableBabyLogistics && activeDay.aiBabyLogistics && (
                    <div 
                      style={{ 
                        borderTop: '1px solid rgba(255, 255, 255, 0.05)', 
                        paddingTop: '8px', 
                        marginTop: '4px' 
                      }}
                    >
                      <AiMarkdownSection 
                        content={activeDay.aiBabyLogistics} 
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
                    No daily tips or transit warnings generated for this day yet.
                  </span>
                  {trip.canEdit !== false && (
                    <button 
                      className="btn-secondary flex-align"
                      style={{ margin: '0 auto', fontSize: '11px', padding: '4px 10px', gap: '4px', borderColor: 'rgba(99, 102, 241, 0.15)' }}
                      onClick={() => handleGenerateSingleDayTips(activeDayStr)}
                    >
                      <Sparkles size={11} /> Generate Day Tips
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 4. Timeline Schedule Places */}
            <div>
              <div className="timeline-section-title flex-between">
                <span className="flex-align"><Navigation size={16} /> Day Schedule</span>
                {trip.canEdit !== false && (
                  <div style={{ display: 'flex', gap: '8px' }}>
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
                      placeholder="Search and add place to itinerary..." 
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
                        className={`timeline-card glass-panel ${isTemporary ? 'timeline-card-preview' : ''}`}
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
                          if (isTemporary && draggedDayPlaceIndex !== null) return; // Don't allow re-sorting itself
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
                          <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: 0, cursor: isTemporary ? 'default' : 'grab' }}>
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

                            {/* Place Thumbnail Image & Map Button */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0, alignItems: 'center' }}>
                              {place.photoUrl ? (
                                <img 
                                  src={getOptimizedImageUrl(place.photoUrl, 80)} 
                                  alt="" 
                                  style={{ 
                                    width: '36px', 
                                    height: '36px', 
                                    borderRadius: '6px', 
                                    objectFit: 'cover', 
                                    flexShrink: 0 
                                  }} 
                                  loading="lazy"
                                  decoding="async"
                                />
                              ) : (
                                <div 
                                  style={{ 
                                    width: '36px', 
                                    height: '36px', 
                                    borderRadius: '6px', 
                                    background: 'rgba(255,255,255,0.05)', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    flexShrink: 0
                                  }}
                                >
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
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
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
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <button 
                                      className="mini-icon-btn" 
                                      disabled={actualIndex === 0} 
                                      onClick={() => handleMovePlaceOrder(actualIndex, 'up')}
                                      style={{ opacity: actualIndex === 0 ? 0.3 : 1, padding: '2px' }}
                                      data-tooltip="Move Up"
                                    >
                                      <ChevronUp size={14} />
                                    </button>
                                    <button 
                                      className="mini-icon-btn" 
                                      disabled={actualIndex === scheduledPlaces.length - 1} 
                                      onClick={() => handleMovePlaceOrder(actualIndex, 'down')}
                                      style={{ opacity: actualIndex === scheduledPlaces.length - 1 ? 0.3 : 1, padding: '2px' }}
                                      data-tooltip="Move Down"
                                    >
                                      <ChevronDown size={14} />
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

      {/* RIGHT PANEL: Interactive Leaflet Map */}
      <div className={`map-panel ${activeMobileTab === 'map' ? 'mobile-active' : ''}`}>
        <MapComponent 
          places={displayScheduledPlaces} 
          activePlaceId={activePlaceId}
          placeGroups={trip.placeGroups || DEFAULT_PLACE_GROUPS}
          onMapClick={handleMapClick}
          previewMarker={previewMarker}
          onPlaceSelect={setActivePlaceId}
        />
      </div>

      {/* Mobile Tab Navigation */}
      <div className="mobile-tab-nav">
        <button 
          className={`mobile-tab-btn ${activeMobileTab === 'catalog' ? 'active' : ''}`}
          onClick={() => setActiveMobileTab('catalog')}
        >
          <BookOpen size={20} />
          <span>Catalog</span>
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
            hasTips: !!activePlan.days[d]?.aiTips,
            tipsUpdatedAt: activePlan.days[d]?.aiTipsUpdatedAt
          }))}
          onGenerate={handleGenerateDaysTips}
        />
      )}
    </div>
  );
}
