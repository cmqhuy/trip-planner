import { useState, useEffect, useRef } from 'react';
import type { Trip, Plan, PlanDay, Location, Place, PlaceGroup, Transportation, Hotel } from '../types';
import { 
  ArrowLeft, ArrowRight, MapPin, Plus, Trash2, Edit2, 
  ExternalLink, Navigation, ChevronUp, ChevronDown, 
  Search, Plane, Train, Bus, Car, Anchor, 
  Building, BookOpen, Clock, Check, Layers, X,
  Calendar, FileText, Landmark, Utensils, ShoppingBag,
  Camera, Heart
} from 'lucide-react';
import { searchLocation, searchPlacesNearLocation, DEFAULT_PLACE_GROUPS } from '../utils/api';
import { getDaysDiff, shiftDateString, shiftTripDates } from '../utils/dateUtils';
import MapComponent from './MapComponent';
import GroupFormFields from './GroupFormFields';
import PlaceFormFields from './PlaceFormFields';
import LocationFormFields from './LocationFormFields';

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

const buildMapsLink = (title: string, _lat: number, _lng: number, city?: string) => {
  const query = city ? `${title}, ${city}` : title;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

const getCountryFlag = (countryCode?: string): string => {
  if (!countryCode || countryCode.length !== 2) return '📍';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  try {
    return String.fromCodePoint(...codePoints);
  } catch (e) {
    return '📍';
  }
};

const getLocIcon = (loc?: Location) => {
  if (!loc) return '📍';
  if (loc.countryCode) {
    return getCountryFlag(loc.countryCode);
  }
  const name = loc.country.toLowerCase();
  if (name.includes('france')) return '🇫🇷';
  if (name.includes('italy')) return '🇮🇹';
  if (name.includes('japan')) return '🇯🇵';
  if (name.includes('united states') || name === 'us' || name === 'usa') return '🇺🇸';
  if (name.includes('vietnam') || name === 'vn') return '🇻🇳';
  if (name.includes('united kingdom') || name === 'uk' || name === 'gb') return '🇬🇧';
  if (name.includes('germany') || name === 'de') return '🇩🇪';
  if (name.includes('spain') || name === 'es') return '🇪🇸';
  if (name.includes('canada') || name === 'ca') return '🇨🇦';
  if (name.includes('australia') || name === 'au') return '🇦🇺';
  return '📍';
};

interface TripPlannerProps {
  trip: Trip;
  onBack: () => void;
  onUpdateTrip: (updatedTrip: Trip) => void;
}

export default function TripPlanner({ trip, onBack, onUpdateTrip }: TripPlannerProps) {
  // Plan State
  const [activePlanId, setActivePlanId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('plan') || trip.plans[0]?.id || '';
  });
  const activePlan = trip.plans.find(p => p.id === activePlanId) || trip.plans[0];

  const daysTabsNavRef = useRef<HTMLDivElement>(null);
  const lastScrollLeft = useRef<number>(0);

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
  const [newPlanName, setNewPlanName] = useState('');
  
  // Plan renaming state
  const [isRenamingPlan, setIsRenamingPlan] = useState(false);
  const [editPlanName, setEditPlanName] = useState('');

  // Autocomplete search states
  const [locationQuery, setLocationQuery] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<Omit<Location, 'places'>[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  
  // Add Location Modal state
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
  const [addLocationForDay, setAddLocationForDay] = useState(false);

  const [placeQuery, setPlaceQuery] = useState('');
  const [placeSuggestions, setPlaceSuggestions] = useState<Omit<Place, 'placeGroupId'>[]>([]);
  const [isSearchingPlace, setIsSearchingPlace] = useState(false);

  // Custom Place Modal
  const [showCustomPlaceModal, setShowCustomPlaceModal] = useState(false);
  const [customPlaceTitle, setCustomPlaceTitle] = useState('');
  const [customPlaceDesc, setCustomPlaceDesc] = useState('');
  const [customPlaceHours, setCustomPlaceHours] = useState('');
  const [customPlaceLat, setCustomPlaceLat] = useState('');
  const [customPlaceLng, setCustomPlaceLng] = useState('');

  // Transportation Modal
  const [showTransportModal, setShowTransportModal] = useState(false);
  const [transportType, setTransportType] = useState<Transportation['type']>('flight');
  const [depLoc, setDepLoc] = useState('');
  const [arrLoc, setArrLoc] = useState('');
  const [depDate, setDepDate] = useState('');
  const [depTime, setDepTime] = useState('');
  const [depTz, setDepTz] = useState('Local');
  const [arrDate, setArrDate] = useState('');
  const [arrTime, setArrTime] = useState('');
  const [arrTz, setArrTz] = useState('Local');
  const [transitCarrier, setTransitCarrier] = useState('');
  const [transitCode, setTransitCode] = useState('');
  const [transitNotes, setTransitNotes] = useState('');

  // Hotel Modal
  const [showHotelModal, setShowHotelModal] = useState(false);
  const [hotelName, setHotelName] = useState('');
  const [hotelAddress, setHotelAddress] = useState('');
  const [hotelCheckIn, setHotelCheckIn] = useState('');
  const [hotelCheckOut, setHotelCheckOut] = useState('');
  const [hotelNotes, setHotelNotes] = useState('');

  // Note editing state for catalog places
  const [editingPlaceNotesId, setEditingPlaceNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState('');

  // PlaceGroup Edit Modal
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#ef4444');
  const [newGroupIcon, setNewGroupIcon] = useState('landmark');

  // Edit PlaceGroup Modal State
  const [editingGroup, setEditingGroup] = useState<PlaceGroup | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupColor, setEditGroupColor] = useState('#ef4444');
  const [editGroupIcon, setEditGroupIcon] = useState('landmark');
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);

  // Edit Trip Modal state
  const [showEditTripModal, setShowEditTripModal] = useState(false);
  const [editTripName, setEditTripName] = useState('');
  const [editTripStart, setEditTripStart] = useState('');
  const [editTripEnd, setEditTripEnd] = useState('');

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
  const [editLocColor, setEditLocColor] = useState('#6366f1');
  const [editLocCity, setEditLocCity] = useState('');
  const [editLocState, setEditLocState] = useState('');
  const [editLocCountry, setEditLocCountry] = useState('');
  const [editLocCountryCode, setEditLocCountryCode] = useState('');
  const [editLocLat, setEditLocLat] = useState('');
  const [editLocLng, setEditLocLng] = useState('');
  const [editLocHeroPhoto, setEditLocHeroPhoto] = useState('');
  const [editLocSearchQuery, setEditLocSearchQuery] = useState('');
  const [editLocSuggestions, setEditLocSuggestions] = useState<Omit<Location, 'places'>[]>([]);
  const [isSearchingEditLoc, setIsSearchingEditLoc] = useState(false);
  const [draggedLocationIndex, setDraggedLocationIndex] = useState<number | null>(null);

  // Custom Place Modal additions
  const [customPlaceGroupId, setCustomPlaceGroupId] = useState('new');
  const [customPlaceMapsLink, setCustomPlaceMapsLink] = useState('');
  const [customPlaceSearchQuery, setCustomPlaceSearchQuery] = useState('');
  const [customPlaceSuggestions, setCustomPlaceSuggestions] = useState<Omit<Place, 'placeGroupId'>[]>([]);
  const [isSearchingCustomPlace, setIsSearchingCustomPlace] = useState(false);
  const [customPlacePhotoUrl, setCustomPlacePhotoUrl] = useState('');
  const [customPlaceNotes, setCustomPlaceNotes] = useState('');

  // Drag and Drop place state
  const [draggedPlaceId, setDraggedPlaceId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [dragOverPlaceId, setDragOverPlaceId] = useState<string | null>(null);
  const [dragOverPlacePosition, setDragOverPlacePosition] = useState<'top' | 'bottom'>('top');
  const [dragOverLocationIndex, setDragOverLocationIndex] = useState<number | null>(null);
  const [draggedDayPlaceIndex, setDraggedDayPlaceIndex] = useState<number | null>(null);
  const [dragOverDayPlaceIndex, setDragOverDayPlaceIndex] = useState<number | null>(null);
  const [dragOverDayPlacePosition, setDragOverDayPlacePosition] = useState<'top' | 'bottom'>('top');

  // Edit Place Modal state
  const [showEditPlaceModal, setShowEditPlaceModal] = useState(false);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [editPlaceTitle, setEditPlaceTitle] = useState('');
  const [editPlaceDesc, setEditPlaceDesc] = useState('');
  const [editPlaceHours, setEditPlaceHours] = useState('');
  const [editPlaceLat, setEditPlaceLat] = useState('');
  const [editPlaceLng, setEditPlaceLng] = useState('');
  const [editPlaceMapsLink, setEditPlaceMapsLink] = useState('');
  const [editPlaceGroupId, setEditPlaceGroupId] = useState('new');
  const [editPlaceNotes, setEditPlaceNotes] = useState('');
  const [editPlaceSearchQuery, setEditPlaceSearchQuery] = useState('');
  const [editPlaceSuggestions, setEditPlaceSuggestions] = useState<Omit<Place, 'placeGroupId'>[]>([]);
  const [isSearchingEditPlace, setIsSearchingEditPlace] = useState(false);
  const [editPlacePhotoUrl, setEditPlacePhotoUrl] = useState('');

  // Move Day Modal state
  const [showMoveDayModal, setShowMoveDayModal] = useState(false);
  const [moveDayTargetDate, setMoveDayTargetDate] = useState('');

  // Mobile UI States
  const [activeMobileTab, setActiveMobileTab] = useState<'catalog' | 'itinerary' | 'map'>('itinerary');
  const [autoScheduleOnActiveDay, setAutoScheduleOnActiveDay] = useState(false);
  const [hideAllocatedPlaces, setHideAllocatedPlaces] = useState(false);

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


  // Trigger search on location query changes
  useEffect(() => {
    if (locationQuery.trim().length < 2) {
      setLocationSuggestions([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      setIsSearchingLocation(true);
      const results = await searchLocation(locationQuery);
      setLocationSuggestions(results);
      setIsSearchingLocation(false);
    }, 450);

    return () => clearTimeout(delayDebounce);
  }, [locationQuery]);

  // Trigger search on edit location query changes
  useEffect(() => {
    if (editLocSearchQuery.trim().length < 2) {
      setEditLocSuggestions([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      setIsSearchingEditLoc(true);
      const results = await searchLocation(editLocSearchQuery);
      setEditLocSuggestions(results);
      setIsSearchingEditLoc(false);
    }, 450);

    return () => clearTimeout(delayDebounce);
  }, [editLocSearchQuery]);

  // Trigger search on place query changes
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

  // Trigger search on edit place query changes
  useEffect(() => {
    if (editPlaceSearchQuery.trim().length < 2 || !catalogLocation) {
      setEditPlaceSuggestions([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      setIsSearchingEditPlace(true);
      const results = await searchPlacesNearLocation(editPlaceSearchQuery, catalogLocation);
      setEditPlaceSuggestions(results);
      setIsSearchingEditPlace(false);
    }, 450);

    return () => clearTimeout(delayDebounce);
  }, [editPlaceSearchQuery, catalogLocation]);

  // Trigger search on custom (add) place query changes
  useEffect(() => {
    if (customPlaceSearchQuery.trim().length < 2 || !catalogLocation) {
      setCustomPlaceSuggestions([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      setIsSearchingCustomPlace(true);
      const results = await searchPlacesNearLocation(customPlaceSearchQuery, catalogLocation);
      setCustomPlaceSuggestions(results);
      setIsSearchingCustomPlace(false);
    }, 450);

    return () => clearTimeout(delayDebounce);
  }, [customPlaceSearchQuery, catalogLocation]);

  // Sync dates with modals when active day changes
  useEffect(() => {
    if (activeDayStr) {
      setDepDate(activeDayStr);
      setArrDate(activeDayStr);
      setHotelCheckIn(activeDayStr);
      setHotelCheckOut(activeDayStr);
    }
  }, [activeDayStr]);

  if (!activePlan) return null;

  // ----------------------------------------------------
  // Dynamic Location Naming Logic
  // ----------------------------------------------------
  const getFormattedLocationName = (loc: Location) => {
    const countries = new Set(trip.locations.map(l => l.country.toLowerCase()));
    const isMultiCountry = countries.size > 1;

    if (isMultiCountry) {
      return `${loc.city}, ${loc.country}`;
    }

    const isUS = trip.locations.every(l => l.country.toLowerCase().includes('united states') || l.country.toLowerCase() === 'us');
    if (isUS) {
      const states = new Set(trip.locations.map(l => l.state?.toLowerCase()).filter(Boolean));
      if (states.size > 1 && loc.state) {
        return `${loc.city}, ${loc.state}`;
      }
    }

    return loc.city;
  };

  // ----------------------------------------------------
  // Location Operations
  // ----------------------------------------------------
  const openEditLocationModal = (loc: Location) => {
    setEditLocColor(loc.color || '#6366f1');
    setEditLocCity(loc.city);
    setEditLocState(loc.state || '');
    setEditLocCountry(loc.country);
    setEditLocCountryCode(loc.countryCode || '');
    setEditLocLat(loc.lat.toString());
    setEditLocLng(loc.lng.toString());
    setEditLocHeroPhoto(loc.heroPhoto || '');
    setEditLocSearchQuery('');
    setEditLocSuggestions([]);
    setShowEditLocationModal(true);
  };

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
    setLocationQuery('');
    setLocationSuggestions([]);

    // Auto-open edit dialog for new locations so user can set color
    if (isNew) {
      setTimeout(() => openEditLocationModal(existingLoc!), 50);
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
    setLocationQuery('');
    setLocationSuggestions([]);

    // Auto-open edit dialog for new locations so user can set color
    if (isNew) {
      setTimeout(() => openEditLocationModal(existingLoc!), 50);
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

  const handleSaveEditLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catalogLocation || !editLocCity.trim() || !editLocCountry.trim()) return;

    const latVal = parseFloat(editLocLat);
    const lngVal = parseFloat(editLocLng);

    const updatedLocations = trip.locations.map(l => {
      if (l.id === catalogLocation.id) {
        return {
          ...l,
          city: editLocCity.trim(),
          state: editLocState.trim() || undefined,
          country: editLocCountry.trim(),
          countryCode: editLocCountryCode.trim().toUpperCase() || undefined,
          lat: isNaN(latVal) ? l.lat : latVal,
          lng: isNaN(lngVal) ? l.lng : lngVal,
          heroPhoto: editLocHeroPhoto.trim() || undefined,
          color: editLocColor
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

  const handleOpenEditPlace = (place: Place) => {
    setEditingPlace(place);
    setEditPlaceTitle(place.title);
    setEditPlaceDesc(place.description || '');
    setEditPlaceHours(place.openingHours || '');
    setEditPlaceLat(place.lat.toString());
    setEditPlaceLng(place.lng.toString());
    setEditPlaceMapsLink(place.mapsLink || '');
    setEditPlaceGroupId(place.placeGroupId || 'new');
    setEditPlaceNotes(place.notes || '');
    setEditPlacePhotoUrl(place.photoUrl || '');
    setEditPlaceSearchQuery('');
    setEditPlaceSuggestions([]);
    setShowEditPlaceModal(true);
  };

  // Unsaved changes detectors & modal close wrappers
  const hasUnsavedAddLocationChanges = () => {
    return locationQuery.trim() !== '';
  };

  const handleCloseAddLocation = () => {
    if (hasUnsavedAddLocationChanges()) {
      setConfirmModal({
        title: "Unsaved Changes",
        message: "You have unsaved changes. Discard changes?",
        confirmText: "Discard",
        cancelText: "Keep Editing",
        onConfirm: () => {
          setShowAddLocationModal(false);
          setLocationQuery('');
          setLocationSuggestions([]);
        }
      });
    } else {
      setShowAddLocationModal(false);
      setLocationQuery('');
      setLocationSuggestions([]);
    }
  };

  const hasUnsavedLocationChanges = () => {
    if (!catalogLocation) return false;
    return (
      editLocColor !== (catalogLocation.color || '#6366f1') ||
      editLocCity !== catalogLocation.city ||
      editLocState !== (catalogLocation.state || '') ||
      editLocCountry !== catalogLocation.country ||
      editLocCountryCode !== (catalogLocation.countryCode || '') ||
      editLocLat !== catalogLocation.lat.toString() ||
      editLocLng !== catalogLocation.lng.toString() ||
      editLocHeroPhoto !== (catalogLocation.heroPhoto || '')
    );
  };

  const handleCloseEditLocation = () => {
    if (hasUnsavedLocationChanges()) {
      setConfirmModal({
        title: "Unsaved Changes",
        message: "You have unsaved changes. Discard changes?",
        confirmText: "Discard",
        cancelText: "Keep Editing",
        onConfirm: () => {
          setShowEditLocationModal(false);
        }
      });
    } else {
      setShowEditLocationModal(false);
    }
  };

  const hasUnsavedAddPlaceChanges = () => {
    return (
      customPlaceTitle.trim() !== '' ||
      customPlaceDesc.trim() !== '' ||
      customPlaceHours.trim() !== '' ||
      customPlacePhotoUrl.trim() !== '' ||
      customPlaceNotes.trim() !== '' ||
      customPlaceLat.trim() !== '' ||
      customPlaceLng.trim() !== '' ||
      customPlaceMapsLink.trim() !== ''
    );
  };

  const handleCloseAddPlace = () => {
    if (hasUnsavedAddPlaceChanges()) {
      setConfirmModal({
        title: "Unsaved Changes",
        message: "You have unsaved changes. Discard changes?",
        confirmText: "Discard",
        cancelText: "Keep Editing",
        onConfirm: () => {
          setShowCustomPlaceModal(false);
          setCustomPlaceSearchQuery('');
          setCustomPlaceSuggestions([]);
        }
      });
    } else {
      setShowCustomPlaceModal(false);
      setCustomPlaceSearchQuery('');
      setCustomPlaceSuggestions([]);
    }
  };

  const hasUnsavedEditPlaceChanges = () => {
    if (!editingPlace) return false;
    return (
      editPlaceTitle !== editingPlace.title ||
      editPlaceDesc !== (editingPlace.description || '') ||
      editPlaceHours !== (editingPlace.openingHours || '') ||
      editPlaceLat !== editingPlace.lat.toString() ||
      editPlaceLng !== editingPlace.lng.toString() ||
      editPlaceMapsLink !== (editingPlace.mapsLink || '') ||
      editPlaceGroupId !== (editingPlace.placeGroupId || 'new') ||
      editPlaceNotes !== (editingPlace.notes || '') ||
      editPlacePhotoUrl !== (editingPlace.photoUrl || '')
    );
  };

  const handleCloseEditPlace = () => {
    if (hasUnsavedEditPlaceChanges()) {
      setConfirmModal({
        title: "Unsaved Changes",
        message: "You have unsaved changes. Discard changes?",
        confirmText: "Discard",
        cancelText: "Keep Editing",
        onConfirm: () => {
          setShowEditPlaceModal(false);
          setEditingPlace(null);
        }
      });
    } else {
      setShowEditPlaceModal(false);
      setEditingPlace(null);
    }
  };

  const handleSaveEditPlace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlace || !editPlaceTitle.trim()) return;

    const latVal = parseFloat(editPlaceLat);
    const lngVal = parseFloat(editPlaceLng);

    const updatedLocations = trip.locations.map(l => {
      if (l.places.some(p => p.id === editingPlace.id)) {
        return {
          ...l,
          places: l.places.map(p => {
            if (p.id === editingPlace.id) {
              const placeLat = isNaN(latVal) ? p.lat : latVal;
              const placeLng = isNaN(lngVal) ? p.lng : lngVal;
              return {
                ...p,
                title: editPlaceTitle.trim(),
                description: editPlaceDesc.trim(),
                openingHours: editPlaceHours.trim() || undefined,
                lat: placeLat,
                lng: placeLng,
                mapsLink: editPlaceMapsLink.trim() || buildMapsLink(editPlaceTitle.trim(), placeLat, placeLng, l.city),
                placeGroupId: editPlaceGroupId,
                notes: editPlaceNotes,
                photoUrl: editPlacePhotoUrl.trim() || undefined
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

  const handleMapClick = (lat: number, lng: number) => {
    if (showEditPlaceModal) {
      setEditPlaceLat(lat.toFixed(6));
      setEditPlaceLng(lng.toFixed(6));
    } else if (showCustomPlaceModal) {
      setCustomPlaceLat(lat.toFixed(6));
      setCustomPlaceLng(lng.toFixed(6));
    } else if (showEditLocationModal) {
      setEditLocLat(lat.toFixed(6));
      setEditLocLng(lng.toFixed(6));
    }
  };

  // Drag and Drop place handlers
  const handlePlaceDragStart = (placeId: string) => {
    setDraggedPlaceId(placeId);
  };

  const handlePlaceDropOnGroup = (targetGroupId: string) => {
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
  };

  const handlePlaceDropOnPlace = (targetPlaceId: string, targetGroupId: string, position: 'top' | 'bottom') => {
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
  };

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

  const handleEditLocationDelete = () => {
    if (!catalogLocation) return;
    setShowEditLocationModal(false);
    handleDeleteLocation(catalogLocation.id);
  };

  const handleDragStart = (index: number) => {
    setDraggedLocationIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (index: number) => {
    if (draggedLocationIndex === null || draggedLocationIndex === index) return;

    const updatedLocations = [...trip.locations];
    const draggedItem = updatedLocations[draggedLocationIndex];

    updatedLocations.splice(draggedLocationIndex, 1);
    updatedLocations.splice(index, 0, draggedItem);

    onUpdateTrip({
      ...trip,
      locations: updatedLocations
    });

    setDraggedLocationIndex(null);
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
        title: 'Move Day Scheduled Places',
        message: `Are you sure you want to move Day ${daysList.indexOf(activeDayStr) + 1} scheduled places to Day ${daysList.indexOf(destDateStr) + 1}? This will override all scheduled places on Day ${daysList.indexOf(destDateStr) + 1}.\n\n⚠️ Warning: The location of Day ${daysList.indexOf(activeDayStr) + 1} (${sourceName}) is different from Day ${daysList.indexOf(destDateStr) + 1} (${destName}). Proceeding will update Day ${daysList.indexOf(destDateStr) + 1}'s location to ${sourceName}.`,
        confirmText: 'Move Places',
        onConfirm: executeMove
      });
    } else {
      setConfirmModal({
        title: 'Move Day Scheduled Places',
        message: `Are you sure you want to move Day ${daysList.indexOf(activeDayStr) + 1} scheduled places to Day ${daysList.indexOf(destDateStr) + 1}? This will override all scheduled places on Day ${daysList.indexOf(destDateStr) + 1}.`,
        confirmText: 'Move Places',
        onConfirm: executeMove
      });
    }
  };

  const handleClearDay = () => {
    if (!activeDayStr) return;
    
    setConfirmModal({
      title: 'Clear Day Places',
      message: `Are you sure you want to clear all scheduled places from Day ${daysList.indexOf(activeDayStr) + 1}?`,
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
  const handleCreatePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanName.trim()) return;

    const newPlanId = `plan-${Date.now()}`;
    const clonedDays: { [dateStr: string]: PlanDay } = {};
    Object.keys(activePlan.days).forEach(date => {
      clonedDays[date] = {
        dateStr: date,
        locationId: activePlan.days[date].locationId,
        placeIds: []
      };
    });

    const newPlan: Plan = {
      id: newPlanId,
      name: newPlanName,
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
    setNewPlanName('');
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
  const handleAddPlaceToDay = (place: Omit<Place, 'placeGroupId'>) => {
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

    // Add to active day's scheduled list, auto-setting the day location if not set
    const updatedPlans = trip.plans.map(p => {
      if (p.id === activePlan.id) {
        const currentPlaces = p.days[activeDayStr]?.placeIds || [];
        return {
          ...p,
          days: {
            ...p.days,
            [activeDayStr]: {
              ...p.days[activeDayStr],
              locationId: p.days[activeDayStr]?.locationId || catalogLocation.id,
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
  };

  const handleAddPlaceFromDayTimeline = (place: Omit<Place, 'placeGroupId'>) => {
    if (!activeDayLocation) return;

    // Ensure the catalog location matches the active day location so it is saved in the correct city
    setSelectedCatalogLocId(activeDayLocation.id);

    // Populate all details in the Add Place modal
    setCustomPlaceTitle(place.title);
    setCustomPlaceDesc(place.description || '');
    setCustomPlaceHours(place.openingHours || '');
    setCustomPlaceLat(place.lat.toString());
    setCustomPlaceLng(place.lng.toString());
    setCustomPlaceMapsLink(place.mapsLink || buildMapsLink(place.title, place.lat, place.lng, activeDayLocation.city));
    setCustomPlacePhotoUrl(place.photoUrl || '');
    setCustomPlaceNotes(place.notes || '');

    // Configure the modal to auto-schedule the place to the active day on save
    setAutoScheduleOnActiveDay(true);
    setCustomPlaceGroupId('new');
    setShowCustomPlaceModal(true);

    // Clear search query and suggestion list
    setPlaceQuery('');
    setPlaceSuggestions([]);
  };

  const handleCreateCustomPlace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPlaceTitle.trim() || !catalogLocation) return;

    const customId = `custom-place-${Date.now()}`;
    const placeLat = parseFloat(customPlaceLat) || catalogLocation.lat + (Math.random() - 0.5) * 0.01;
    const placeLng = parseFloat(customPlaceLng) || catalogLocation.lng + (Math.random() - 0.5) * 0.01;
    const newPlace: Place = {
      id: customId,
      title: customPlaceTitle.trim(),
      description: customPlaceDesc.trim() || 'Custom attraction',
      openingHours: customPlaceHours.trim() || '24/7',
      lat: placeLat,
      lng: placeLng,
      placeGroupId: customPlaceGroupId,
      notes: customPlaceNotes.trim(),
      photoUrl: customPlacePhotoUrl.trim() || undefined,
      mapsLink: customPlaceMapsLink.trim() || buildMapsLink(customPlaceTitle.trim(), placeLat, placeLng, catalogLocation.city)
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

    setCustomPlaceTitle('');
    setCustomPlaceDesc('');
    setCustomPlaceHours('');
    setCustomPlaceLat('');
    setCustomPlaceLng('');
    setCustomPlaceGroupId('new');
    setCustomPlaceMapsLink('');
    setCustomPlacePhotoUrl('');
    setCustomPlaceNotes('');
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

  const handleMoveCatalogPlace = (placeId: string, direction: 'up' | 'down') => {
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
  };



  // ----------------------------------------------------
  // Notes Editing (Shared at Trip / Location level)
  // ----------------------------------------------------
  const startEditingNotes = (place: Place) => {
    setEditingPlaceNotesId(place.id);
    setTempNotes(place.notes || '');
  };

  const savePlaceNotes = (placeId: string) => {
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
  };

  // ----------------------------------------------------
  // Custom Groups Operations
  // ----------------------------------------------------
  const handleAddPlaceGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    const newGroup: PlaceGroup = {
      id: `group-${Date.now()}`,
      name: newGroupName,
      color: newGroupColor,
      icon: newGroupIcon
    };

    const currentGroups = trip.placeGroups || DEFAULT_PLACE_GROUPS;

    onUpdateTrip({
      ...trip,
      placeGroups: [...currentGroups, newGroup]
    });

    setNewGroupName('');
    setShowGroupModal(false);
  };

  const startEditingGroup = (group: PlaceGroup) => {
    setEditingGroup(group);
    setEditGroupName(group.name);
    setEditGroupColor(group.color);
    setEditGroupIcon(group.icon);
    setShowEditGroupModal(true);
  };

  const handleSaveEditPlaceGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup || !editGroupName.trim()) return;

    const currentGroups = trip.placeGroups || DEFAULT_PLACE_GROUPS;
    const updatedGroups = currentGroups.map(pg => {
      if (pg.id === editingGroup.id) {
        return {
          ...pg,
          name: editGroupName,
          color: editGroupColor,
          icon: editGroupIcon
        };
      }
      return pg;
    });

    onUpdateTrip({
      ...trip,
      placeGroups: updatedGroups
    });

    setEditingGroup(null);
    setShowEditGroupModal(false);
  };

  const handleMoveGroupOrder = (index: number, direction: 'up' | 'down') => {
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
  };

  const handleEditTripStartChange = (newStart: string) => {
    if (!newStart) return;
    setEditTripStart(newStart);
    
    // Auto update end date preserving duration
    if (editTripStart && editTripEnd) {
      const duration = getDaysDiff(editTripStart, editTripEnd);
      const newEnd = shiftDateString(newStart, duration);
      setEditTripEnd(newEnd);
    }
  };

  const handleEditTripEndChange = (newEnd: string) => {
    if (!newEnd) return;
    setEditTripEnd(newEnd);
  };

  const handleSaveEditTrip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTripName.trim() || !editTripStart || !editTripEnd) return;
    
    if (new Date(editTripStart) > new Date(editTripEnd)) {
      setConfirmModal({
        title: 'Invalid Dates',
        message: 'Start date must be before or equal to end date.',
        isAlert: true,
        onConfirm: () => {}
      });
      return;
    }

    const currentDuration = getDaysDiff(trip.startDate, trip.endDate) + 1;
    const newDuration = getDaysDiff(editTripStart, editTripEnd) + 1;

    const performSave = () => {
      const currentDatesList = Object.keys(activePlan?.days || {}).sort();
      const activeDayIndex = currentDatesList.indexOf(activeDayStr);

      const updatedTrip = shiftTripDates(trip, editTripStart, editTripEnd);
      updatedTrip.name = editTripName.trim();
      
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
  const handleAddTransportation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!depLoc.trim() || !arrLoc.trim() || !depDate || !depTime || !arrDate || !arrTime) return;

    const newTransport: Transportation = {
      id: `transport-${Date.now()}`,
      type: transportType,
      departureLocationName: depLoc,
      arrivalLocationName: arrLoc,
      departureDate: depDate,
      departureTime: depTime,
      departureTimezone: depTz,
      arrivalDate: arrDate,
      arrivalTime: arrTime,
      arrivalTimezone: arrTz,
      carrier: transitCarrier,
      transitCode: transitCode,
      notes: transitNotes
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

    // Reset Form
    setDepLoc('');
    setArrLoc('');
    setTransitCarrier('');
    setTransitCode('');
    setTransitNotes('');
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
  const handleAddHotel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hotelName.trim() || !hotelCheckIn || !hotelCheckOut) return;

    const newHotel: Hotel = {
      id: `hotel-${Date.now()}`,
      name: hotelName,
      address: hotelAddress,
      checkInDate: hotelCheckIn,
      checkOutDate: hotelCheckOut,
      notes: hotelNotes
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

    // Reset Form
    setHotelName('');
    setHotelAddress('');
    setHotelNotes('');
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

  // ----------------------------------------------------
  // Rendering Helpers
  // ----------------------------------------------------
  // Real-time map preview marker for coordinate pin dropping
  let previewMarker: { lat: number; lng: number } | undefined = undefined;
  if (showEditPlaceModal && editPlaceLat && editPlaceLng) {
    const lat = parseFloat(editPlaceLat);
    const lng = parseFloat(editPlaceLng);
    if (!isNaN(lat) && !isNaN(lng)) {
      previewMarker = { lat, lng };
    }
  } else if (showCustomPlaceModal && customPlaceLat && customPlaceLng) {
    const lat = parseFloat(customPlaceLat);
    const lng = parseFloat(customPlaceLng);
    if (!isNaN(lat) && !isNaN(lng)) {
      previewMarker = { lat, lng };
    }
  } else if (showEditLocationModal && editLocLat && editLocLng) {
    const lat = parseFloat(editLocLat);
    const lng = parseFloat(editLocLng);
    if (!isNaN(lat) && !isNaN(lng)) {
      previewMarker = { lat, lng };
    }
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

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    const cleanDateStr = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`;
    return new Date(cleanDateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="planner-view">
      {/* LEFT PANEL: Catalog */}
      <div className={`catalog-panel ${activeMobileTab === 'catalog' ? 'mobile-active' : ''}`}>
        <div className="panel-header">
          <button 
            className="mini-icon-btn" 
            onClick={onBack} 
            style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
          >
            <ArrowLeft size={14} /> Back to dashboard
          </button>
          
          <h3>
            <BookOpen size={18} style={{ color: 'var(--accent-primary)' }} />
            Catalog
          </h3>

          {/* Catalog Location Selector */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '12px' }}>
            <select
              value={selectedCatalogLocId}
              onChange={(e) => setSelectedCatalogLocId(e.target.value)}
              style={{ flex: 1, padding: '6px 28px 6px 10px', fontSize: '12px', background: 'var(--bg-dark)' }}
            >
              {trip.locations.length === 0 && <option value="">No Locations Added</option>}
              {trip.locations.map(loc => (
                <option key={loc.id} value={loc.id}>{getLocIcon(loc)} {getFormattedLocationName(loc)}</option>
              ))}
            </select>
            {catalogLocation && (
              <button 
                className="mini-icon-btn" 
                onClick={() => openEditLocationModal(catalogLocation)}
                data-tooltip="Edit Location Settings"
                style={{ padding: '6px', height: '32px', width: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Edit2 size={14} />
              </button>
            )}
            <button 
              className="btn-primary flex-align"
              style={{ padding: '6px', fontSize: '11px', height: '32px', width: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => {
                setAddLocationForDay(false);
                setShowAddLocationModal(true);
              }}
              data-tooltip="Add Location"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {catalogLocation ? (
          <div className="catalog-content">
            {/* Catalog Group Management */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
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
                <button 
                  className="mini-icon-btn" 
                  onClick={() => setShowGroupModal(true)} 
                  data-tooltip="Add Custom Category"
                  data-tooltip-position="bottom"
                  style={{ color: 'var(--accent-secondary)', padding: '2px' }}
                >
                  <Plus size={14} />
                </button>
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
              const placesInGroup = catalogLocation.places.filter(p => p.placeGroupId === group.id);
              const filteredPlaces = placesInGroup.filter(p => {
                if (!hideAllocatedPlaces) return true;
                return !Object.values(activePlan.days).some(day => day.placeIds.includes(p.id));
              });
              if (placesInGroup.length === 0 && group.id === 'new') return null; // Hide new section if empty

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
                      <button 
                        className="mini-icon-btn" 
                        onClick={() => {
                          setCustomPlaceTitle('');
                          setCustomPlaceDesc('');
                          setCustomPlaceHours('');
                          setCustomPlaceLat('');
                          setCustomPlaceLng('');
                          setCustomPlaceGroupId(group.id);
                          setCustomPlaceMapsLink('');
                          setAutoScheduleOnActiveDay(false);
                          setShowCustomPlaceModal(true);
                        }} 
                        data-tooltip={`Add Place to ${group.name}`} 
                        style={{ padding: '2px' }}
                      >
                        <Plus size={10} />
                      </button>
                      {group.isReorderable && (
                        <>
                          <button 
                            className="mini-icon-btn" 
                            disabled={group.isFirst} 
                            onClick={() => handleMoveGroupOrder(group.groupIdx!, 'up')} 
                            data-tooltip="Move Up" 
                            style={{ opacity: group.isFirst ? 0.3 : 1, padding: '2px' }}
                          >
                            <ChevronUp size={12} />
                          </button>
                          <button 
                            className="mini-icon-btn" 
                            disabled={group.isLast} 
                            onClick={() => handleMoveGroupOrder(group.groupIdx!, 'down')} 
                            data-tooltip="Move Down" 
                            style={{ opacity: group.isLast ? 0.3 : 1, padding: '2px' }}
                          >
                            <ChevronDown size={12} />
                          </button>
                          <button className="mini-icon-btn" onClick={() => startEditingGroup(group as PlaceGroup)} data-tooltip="Edit Group" style={{ padding: '2px' }}>
                            <Edit2 size={10} />
                          </button>
                        </>
                      )}
                      <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                        {filteredPlaces.length}
                      </span>
                    </div>
                  </div>

                  <div className="catalog-places-list" style={{ minHeight: '30px' }}>
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
                          draggable
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
                          onDragLeave={() => setDragOverPlaceId(null)}
                          onDrop={(e) => {
                            e.stopPropagation();
                            handlePlaceDropOnPlace(place.id, group.id, dragOverPlacePosition);
                            setDragOverPlaceId(null);
                          }}
                          onClick={() => setActivePlaceId(place.id)}
                          style={{ 
                            borderColor: activePlaceId === place.id ? 'var(--accent-primary)' : 'var(--border-glass)',
                            cursor: 'grab'
                          }}
                        >
                        <div className="place-card-header">
                          {place.photoUrl ? (
                            <img src={place.photoUrl} className="place-card-thumb" alt="" />
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
                                const allocatedDays = Object.keys(activePlan.days)
                                  .filter(dateStr => activePlan.days[dateStr].placeIds.includes(place.id))
                                  .sort();
                                if (allocatedDays.length === 0) return null;
                                return (
                                  <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                                    {allocatedDays.map(dateStr => (
                                      <span 
                                        key={dateStr} 
                                        style={{
                                          fontSize: '9px',
                                          fontWeight: 600,
                                          padding: '2px 5px',
                                          borderRadius: '4px',
                                          background: 'rgba(99, 102, 241, 0.15)',
                                          color: '#a78bfa',
                                          border: '1px solid rgba(139, 92, 246, 0.2)',
                                          whiteSpace: 'nowrap'
                                        }}
                                      >
                                        {formatDisplayDate(dateStr).split(',')[1]?.trim() || dateStr}
                                      </span>
                                    ))}
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
                        </div>

                        {/* Expand Details if selected */}
                        {activePlaceId === place.id && (
                          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '13px' }}>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.3 }}>{place.description}</p>
                            
                            {/* Notes Field (Shared at Trip level) */}
                            <div style={{ margin: '8px 0', padding: '6px 8px', background: 'rgba(99,102,241,0.04)', borderLeft: '2px solid var(--accent-primary)', borderRadius: '0 4px 4px 0' }}>
                              <label style={{ fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                                <FileText size={11} /> Notes
                              </label>
                              
                              {editingPlaceNotesId === place.id ? (
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
                                    lineHeight: 1.3,
                                    fontSize: '13px'
                                  }}>
                                    {place.notes || 'No notes added yet.'}
                                  </span>
                                  <button className="mini-icon-btn" onClick={() => startEditingNotes(place)} style={{ padding: '2px' }}>
                                    <Edit2 size={10} />
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', marginTop: '8px' }}>
                              <a 
                                href={place.mapsLink || buildMapsLink(place.title, place.lat, place.lng, catalogLocation?.city)} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="btn-secondary flex-align"
                                style={{ padding: '4px 8px', fontSize: '11px', gap: '4px', textDecoration: 'none', borderRadius: '8px', whiteSpace: 'nowrap' }}
                              >
                                Map <ExternalLink size={10} />
                              </a>
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
                            </div>
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

      {/* MIDDLE PANEL: Day-to-Day timeline */}
      <div className={`itinerary-panel ${activeMobileTab === 'itinerary' ? 'mobile-active' : ''}`}>
        <div className="itinerary-header">
          <div className="trip-meta-info">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '24px' }}>{trip.name}</h2>
                <button 
                  className="mini-icon-btn" 
                  onClick={() => {
                    setEditTripName(trip.name);
                    setEditTripStart(trip.startDate);
                    setEditTripEnd(trip.endDate);
                    setShowEditTripModal(true);
                  }}
                  data-tooltip="Edit Trip Details"
                  style={{ padding: '4px', opacity: 0.6 }}
                >
                  <Edit2 size={14} />
                </button>
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
                <button 
                  className="mini-icon-btn" 
                  onClick={() => handleMovePlan('up')} 
                  disabled={trip.plans.findIndex(p => p.id === activePlanId) === 0}
                  data-tooltip="Move Plan Up"
                  style={{ opacity: trip.plans.findIndex(p => p.id === activePlanId) === 0 ? 0.3 : 1 }}
                >
                  <ChevronUp size={16} />
                </button>
                <button 
                  className="mini-icon-btn" 
                  onClick={() => handleMovePlan('down')} 
                  disabled={trip.plans.findIndex(p => p.id === activePlanId) === trip.plans.length - 1}
                  data-tooltip="Move Plan Down"
                  style={{ opacity: trip.plans.findIndex(p => p.id === activePlanId) === trip.plans.length - 1 ? 0.3 : 1 }}
                >
                  <ChevronDown size={16} />
                </button>
                <button 
                  className="mini-icon-btn" 
                  onClick={() => {
                    setIsRenamingPlan(true);
                    setEditPlanName(activePlan.name);
                  }} 
                  data-tooltip="Rename Plan"
                >
                  <Edit2 size={14} />
                </button>
                <button className="mini-icon-btn" onClick={() => setShowNewPlanModal(true)} data-tooltip="Add Plan">
                  <Plus size={16} />
                </button>
                {trip.plans.length > 1 && (
                  <button className="mini-icon-btn" onClick={() => handleDeletePlan(activePlan.id)} data-tooltip="Delete Plan" style={{ color: 'var(--color-danger)' }}>
                    <Trash2 size={15} />
                  </button>
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
                  style={dayLoc ? {
                    borderTop: `3px solid ${locColor}`,
                    borderColor: isActive ? locColor : 'rgba(255, 255, 255, 0.08)',
                    boxShadow: isActive ? `0 0 10px ${hexToRgba(locColor, 0.2)}` : 'none',
                    background: isActive ? `${hexToRgba(locColor, 0.08)}` : 'rgba(255, 255, 255, 0.03)',
                  } : {
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    borderColor: isActive ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.08)',
                    boxShadow: isActive ? '0 0 10px rgba(99, 102, 241, 0.1)' : 'none',
                    background: isActive ? 'var(--accent-primary-glow)' : 'rgba(255, 255, 255, 0.03)',
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
                      title={getFormattedLocationName(dayLoc)}
                    >
                      {getLocIcon(dayLoc)} {getFormattedLocationName(dayLoc)}
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
                  ? `linear-gradient(rgba(15,23,42,0.4), ${hexToRgba(activeDayLocation.color || '#6366f1', 0.85)}), url(${activeDayLocation.heroPhoto}) center/cover` 
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
                    {activeDayLocation ? getFormattedLocationName(activeDayLocation) : 'Not Selected'}
                  </h3>
                </div>
              </div>

              <div className="flex-align" style={{ gap: '8px' }}>
                <select
                  value={activeDay?.locationId || ''}
                  onChange={(e) => handleSetDayLocation(e.target.value)}
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
                    <option key={l.id} value={l.id}>{getLocIcon(l)} {getFormattedLocationName(l)}</option>
                  ))}
                </select>
                <button 
                  className="btn-primary flex-align"
                  style={{ padding: '8px 12px', fontSize: '13px', gap: '4px', height: '38px', borderRadius: '8px' }}
                  onClick={() => {
                    setAddLocationForDay(true);
                    setShowAddLocationModal(true);
                  }}
                >
                  <Plus size={14} /> Location
                </button>
              </div>
            </div>

            {/* 2. Hotel reservations overlapping this day */}
            <div>
              <div className="timeline-section-title flex-between">
                <span className="flex-align"><Building size={16} /> Hotel Stays</span>
                <button className="mini-icon-btn" onClick={() => setShowHotelModal(true)} style={{ color: 'var(--color-success)' }}>
                  <Plus size={14} /> Add Hotel
                </button>
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
                    <button className="trip-delete-btn" onClick={() => handleDeleteHotel(h.id)}>
                      <Trash2 size={14} />
                    </button>
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
                <button className="mini-icon-btn" onClick={() => setShowTransportModal(true)} style={{ color: 'var(--color-warning)' }}>
                  <Plus size={14} /> Add Transit
                </button>
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
                      <button className="trip-delete-btn" onClick={() => handleDeleteTransportation(t.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}

                {getTransportsForDay(activeDayStr).length === 0 && (
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No transit events scheduled.</p>
                )}
              </div>
            </div>

            {/* 4. Timeline Schedule Places */}
            <div>
              <div className="timeline-section-title flex-between">
                <span className="flex-align"><Navigation size={16} /> Day Schedule</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    className="mini-icon-btn flex-align" 
                    onClick={() => {
                      const firstOtherDay = daysList.find(d => d !== activeDayStr) || '';
                      setMoveDayTargetDate(firstOtherDay);
                      setShowMoveDayModal(true);
                    }} 
                    data-tooltip="Move Places To Another Day"
                    style={{ gap: '4px' }}
                  >
                    <ArrowRight size={14} /> Move Day
                  </button>
                  <button 
                    className="mini-icon-btn" 
                    onClick={handleClearDay} 
                    data-tooltip="Clear All Places"
                    style={{ gap: '4px', color: 'var(--color-danger)' }}
                  >
                    <Trash2 size={14} /> Clear Day
                  </button>
                  <button 
                    className="mini-icon-btn flex-align" 
                    onClick={() => {
                      setCustomPlaceTitle('');
                      setCustomPlaceDesc('');
                      setCustomPlaceHours('');
                      setCustomPlaceLat('');
                      setCustomPlaceLng('');
                      setCustomPlaceGroupId('new');
                      setCustomPlaceMapsLink('');
                      setAutoScheduleOnActiveDay(true);
                      setShowCustomPlaceModal(true);
                    }} 
                    data-tooltip="Add New Place"
                    style={{ gap: '4px' }}
                  >
                    <Plus size={14} /> Add Place
                  </button>
                </div>
              </div>

              {/* Smart Place search suggestions input */}
              {activeDayLocation ? (
                <div style={{ position: 'relative', marginBottom: '16px' }}>
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
                          {place.photoUrl && <img src={place.photoUrl} className="search-result-thumb" alt="" />}
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

              {/* Timeline Cards */}
              <div 
                className="day-timeline"
                style={{ minHeight: '60px' }}
                onDragOver={(e) => {
                  if (draggedPlaceId || draggedDayPlaceIndex !== null) {
                    e.preventDefault();
                  }
                }}
                onDrop={() => {
                  if (draggedPlaceId) {
                    handleCatalogPlaceDropOnTimeline(draggedPlaceId, scheduledPlaces.length, 'top');
                  } else if (draggedDayPlaceIndex !== null) {
                    handleDayPlaceDrop(scheduledPlaces.length - 1, 'bottom');
                  }
                }}
              >
                {scheduledPlaces.map((place, index) => (
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
                      className="timeline-item"
                      draggable
                      onDragStart={() => handleDayPlaceDragStart(index)}
                      onDragEnd={() => {
                        setDraggedDayPlaceIndex(null);
                        setDragOverDayPlaceIndex(null);
                      }}
                      onDragOver={(e) => {
                        if (draggedDayPlaceIndex === index) return;
                        if (draggedDayPlaceIndex === null && !draggedPlaceId) return;
                        e.preventDefault();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const relativeY = e.clientY - rect.top;
                        const position = relativeY < rect.height / 2 ? 'top' : 'bottom';
                        
                        if (dragOverDayPlaceIndex !== index || dragOverDayPlacePosition !== position) {
                          setDragOverDayPlaceIndex(index);
                          setDragOverDayPlacePosition(position);
                        }
                      }}
                      onDragLeave={() => setDragOverDayPlaceIndex(null)}
                      onDrop={(e) => {
                        e.stopPropagation();
                        if (draggedDayPlaceIndex !== null) {
                          handleDayPlaceDrop(index, dragOverDayPlacePosition);
                        } else if (draggedPlaceId) {
                          handleCatalogPlaceDropOnTimeline(draggedPlaceId, index, dragOverDayPlacePosition);
                        }
                        setDragOverDayPlaceIndex(null);
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
                      
                      <div className="timeline-card glass-panel" onClick={() => setActivePlaceId(place.id)} style={{ cursor: 'grab' }}>
                        <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: 0 }}>
                          <div 
                            style={{ 
                              width: '24px', 
                              height: '24px', 
                              borderRadius: '50%', 
                              background: 'rgba(255,255,255,0.08)',
                              color: 'var(--text-primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              fontWeight: 700,
                              flexShrink: 0
                            }}
                          >
                            {index + 1}
                          </div>

                          {/* Place Thumbnail Image */}
                          {place.photoUrl ? (
                            <img 
                              src={place.photoUrl} 
                              alt="" 
                              style={{ 
                                width: '36px', 
                                height: '36px', 
                                borderRadius: '6px', 
                                objectFit: 'cover', 
                                flexShrink: 0 
                              }} 
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

                          <div style={{ minWidth: 0, flex: 1 }}>
                            <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {place.title}
                            </h4>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                              {place.description ? place.description.substring(0, 50) + '...' : 'Attraction'}
                            </p>
                            {editingPlaceNotesId === place.id ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
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
                                  fontSize: '13px', 
                                  color: place.notes ? 'var(--accent-primary)' : 'var(--text-muted)', 
                                  fontStyle: 'italic', 
                                  whiteSpace: 'pre-wrap',
                                  lineHeight: 1.3,
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
                                <button 
                                  className="mini-icon-btn" 
                                  onClick={() => startEditingNotes(place)} 
                                  style={{ padding: '2px' }}
                                  data-tooltip="Edit Note"
                                >
                                  <Edit2 size={10} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex-align" style={{ flexShrink: 0, gap: '4px' }} onClick={e => e.stopPropagation()}>
                          {/* Custom order re-arranging */}
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <button 
                              className="mini-icon-btn" 
                              disabled={index === 0} 
                              onClick={() => handleMovePlaceOrder(index, 'up')}
                              style={{ opacity: index === 0 ? 0.3 : 1, padding: '2px' }}
                            >
                              <ChevronUp size={14} />
                            </button>
                            <button 
                              className="mini-icon-btn" 
                              disabled={index === scheduledPlaces.length - 1} 
                              onClick={() => handleMovePlaceOrder(index, 'down')}
                              style={{ opacity: index === scheduledPlaces.length - 1 ? 0.3 : 1, padding: '2px' }}
                            >
                              <ChevronDown size={14} />
                            </button>
                          </div>
                          <button className="mini-icon-btn" onClick={() => handleOpenEditPlace(place)} data-tooltip="Edit Place" style={{ padding: '4px' }}>
                            <Edit2 size={14} />
                          </button>
                          <button className="trip-delete-btn" onClick={() => handleRemovePlaceFromDay(index)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {scheduledPlaces.length === 0 && (
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
          places={scheduledPlaces} 
          activePlaceId={activePlaceId}
          placeGroups={trip.placeGroups || DEFAULT_PLACE_GROUPS}
          onMapClick={handleMapClick}
          previewMarker={previewMarker}
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
      {showNewPlanModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Plan Option</h3>
              <button className="modal-close" onClick={() => setShowNewPlanModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreatePlan}>
              <div className="form-group">
                <label>Plan Name</label>
                <input 
                  type="text" 
                  value={newPlanName} 
                  onChange={e => setNewPlanName(e.target.value)} 
                  placeholder="e.g. Route Option B, Low Cost Option" 
                  required 
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowNewPlanModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Create Plan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Custom Place Modal */}
      {showCustomPlaceModal && (
        <div className="modal-overlay" onClick={handleCloseAddPlace}>
          <div className="modal-content glass-panel scrollable" style={{ maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Place</h3>
              <button className="modal-close" onClick={handleCloseAddPlace}>
                <X size={20} />
              </button>
            </div>

            {/* Suggestions Search / Auto-Populate */}
            <div className="form-group" style={{ padding: '0 12px', marginBottom: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '16px' }}>
              <label style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Auto-Populate Details</label>
              <div style={{ position: 'relative', marginTop: '6px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  placeholder="Search place suggestions to auto-fill..." 
                  value={customPlaceSearchQuery}
                  onChange={(e) => setCustomPlaceSearchQuery(e.target.value)}
                  style={{ paddingLeft: '32px' }}
                />
                {isSearchingCustomPlace && (
                  <div style={{ position: 'absolute', right: '10px', top: '12px', fontSize: '10px', color: 'var(--text-muted)' }}>Searching...</div>
                )}
              </div>
              
              {customPlaceSuggestions.length > 0 && (
                <div style={{ 
                  background: 'var(--bg-panel)', 
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid var(--border-glass)', 
                  borderRadius: '6px', 
                  marginTop: '6px', 
                  maxHeight: '150px', 
                  overflowY: 'auto' 
                }}>
                  {customPlaceSuggestions.map((sug) => (
                    <div 
                      key={sug.id} 
                      onClick={() => {
                        setCustomPlaceTitle(sug.title);
                        setCustomPlaceDesc(sug.description || '');
                        setCustomPlaceHours(sug.openingHours || '');
                        setCustomPlaceLat(sug.lat.toString());
                        setCustomPlaceLng(sug.lng.toString());
                        setCustomPlaceMapsLink(buildMapsLink(sug.title, sug.lat, sug.lng, catalogLocation?.city));
                        setCustomPlacePhotoUrl(sug.photoUrl || '');
                        setCustomPlaceNotes(sug.notes || '');
                        setCustomPlaceSearchQuery('');
                        setCustomPlaceSuggestions([]);
                      }}
                      style={{ 
                        padding: '8px 12px', 
                        cursor: 'pointer', 
                        borderBottom: '1px solid rgba(255,255,255,0.03)', 
                        fontSize: '12px' 
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{sug.title}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {sug.description}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleCreateCustomPlace}>
              <div className="modal-scroll-body">
                <PlaceFormFields
                  title={customPlaceTitle}
                  setTitle={setCustomPlaceTitle}
                  description={customPlaceDesc}
                  setDescription={setCustomPlaceDesc}
                  openingHours={customPlaceHours}
                  setOpeningHours={setCustomPlaceHours}
                  groupId={customPlaceGroupId}
                  setGroupId={setCustomPlaceGroupId}
                  mapsLink={customPlaceMapsLink}
                  setMapsLink={setCustomPlaceMapsLink}
                  photoUrl={customPlacePhotoUrl}
                  setPhotoUrl={setCustomPlacePhotoUrl}
                  notes={customPlaceNotes}
                  setNotes={setCustomPlaceNotes}
                  lat={customPlaceLat}
                  setLat={setCustomPlaceLat}
                  lng={customPlaceLng}
                  setLng={setCustomPlaceLng}
                  placeGroups={trip.placeGroups || DEFAULT_PLACE_GROUPS}
                />
              </div>
              <div className="modal-actions sticky">
                <button type="button" className="btn-secondary" onClick={handleCloseAddPlace}>Cancel</button>
                <button type="submit" className="btn-primary">Add Place</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Edit Place Modal */}
      {showEditPlaceModal && editingPlace && (
        <div className="modal-overlay" onClick={handleCloseEditPlace}>
          <div className="modal-content glass-panel scrollable" style={{ maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Place Details</h3>
              <button className="modal-close" onClick={handleCloseEditPlace}>
                <X size={20} />
              </button>
            </div>
            
            {/* Suggestions Search / Auto-Populate */}
            <div className="form-group" style={{ padding: '0 12px', marginBottom: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '16px' }}>
              <label style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Auto-Populate Details</label>
              <div style={{ position: 'relative', marginTop: '6px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  placeholder="Search place suggestions to auto-fill..." 
                  value={editPlaceSearchQuery}
                  onChange={(e) => setEditPlaceSearchQuery(e.target.value)}
                  style={{ paddingLeft: '32px' }}
                />
                {isSearchingEditPlace && (
                  <div style={{ position: 'absolute', right: '10px', top: '12px', fontSize: '10px', color: 'var(--text-muted)' }}>Searching...</div>
                )}
              </div>
              
              {editPlaceSuggestions.length > 0 && (
                <div style={{ 
                  background: 'var(--bg-panel)', 
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid var(--border-glass)', 
                  borderRadius: '6px', 
                  marginTop: '6px', 
                  maxHeight: '150px', 
                  overflowY: 'auto' 
                }}>
                  {editPlaceSuggestions.map((sug) => (
                    <div 
                      key={sug.id} 
                      onClick={() => {
                        setEditPlaceTitle(sug.title);
                        setEditPlaceDesc(sug.description || '');
                        setEditPlaceHours(sug.openingHours || '');
                        setEditPlaceLat(sug.lat.toString());
                        setEditPlaceLng(sug.lng.toString());
                        setEditPlaceMapsLink(sug.mapsLink || buildMapsLink(sug.title, sug.lat, sug.lng, catalogLocation?.city));
                        setEditPlacePhotoUrl(sug.photoUrl || '');
                        setEditPlaceNotes(sug.notes || '');
                        setEditPlaceSearchQuery('');
                        setEditPlaceSuggestions([]);
                      }}
                      style={{ 
                        padding: '8px 12px', 
                        cursor: 'pointer', 
                        borderBottom: '1px solid rgba(255,255,255,0.03)', 
                        fontSize: '12px' 
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{sug.title}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {sug.description}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleSaveEditPlace}>
              <div className="modal-scroll-body">
                <PlaceFormFields
                  title={editPlaceTitle}
                  setTitle={setEditPlaceTitle}
                  description={editPlaceDesc}
                  setDescription={setEditPlaceDesc}
                  openingHours={editPlaceHours}
                  setOpeningHours={setEditPlaceHours}
                  groupId={editPlaceGroupId}
                  setGroupId={setEditPlaceGroupId}
                  mapsLink={editPlaceMapsLink}
                  setMapsLink={setEditPlaceMapsLink}
                  photoUrl={editPlacePhotoUrl}
                  setPhotoUrl={setEditPlacePhotoUrl}
                  notes={editPlaceNotes}
                  setNotes={setEditPlaceNotes}
                  lat={editPlaceLat}
                  setLat={setEditPlaceLat}
                  lng={editPlaceLng}
                  setLng={setEditPlaceLng}
                  placeGroups={trip.placeGroups || DEFAULT_PLACE_GROUPS}
                />
              </div>

              <div className="modal-actions sticky" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button 
                  type="button" 
                  className="btn-secondary flex-align"
                  style={{ color: 'var(--color-danger)', borderColor: 'rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.04)', gap: '4px' }}
                  onClick={() => {
                    if (editingPlace) {
                      handleDeletePlace(editingPlace.id);
                      setShowEditPlaceModal(false);
                      setEditingPlace(null);
                    }
                  }}
                >
                  <Trash2 size={14} /> Delete Place
                </button>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="btn-secondary" onClick={handleCloseEditPlace}>Cancel</button>
                  <button type="submit" className="btn-primary">Save Changes</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Move Day Modal */}
      {showMoveDayModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Move Day Contents</h3>
              <button className="modal-close" onClick={() => setShowMoveDayModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Move all scheduled places of <strong>Day {daysList.indexOf(activeDayStr) + 1}</strong> ({formatDisplayDate(activeDayStr).split(',')[1]}) to another day. This will override the destination day's scheduled places.
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label>Select Destination Day</label>
              <select 
                value={moveDayTargetDate} 
                onChange={e => setMoveDayTargetDate(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-dark)' }}
              >
                {daysList.map((dateStr, index) => {
                  if (dateStr === activeDayStr) return null;
                  return (
                    <option key={dateStr} value={dateStr}>
                      Day {index + 1} ({formatDisplayDate(dateStr).split(',')[1]})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowMoveDayModal(false)}>Cancel</button>
              <button 
                className="btn-primary" 
                onClick={() => handleMoveDayContents(moveDayTargetDate)}
                disabled={!moveDayTargetDate}
              >
                Move Contents
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Transportation Modal */}
      {showTransportModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Schedule Transportation</h3>
              <button className="modal-close" onClick={() => setShowTransportModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddTransportation}>
              <div className="form-group">
                <label>Type</label>
                <select value={transportType} onChange={e => setTransportType(e.target.value as any)}>
                  <option value="flight">✈️ Flight</option>
                  <option value="train">🚆 Train</option>
                  <option value="bus">🚌 Bus</option>
                  <option value="car">🚗 Car Rental / Drive</option>
                  <option value="ferry">🛳️ Ferry</option>
                  <option value="other">🗺️ Other</option>
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Departure Location</label>
                  <input type="text" value={depLoc} onChange={e => setDepLoc(e.target.value)} placeholder="e.g. Paris CDG Airport" required />
                </div>
                <div className="form-group">
                  <label>Arrival Location</label>
                  <input type="text" value={arrLoc} onChange={e => setArrLoc(e.target.value)} placeholder="e.g. Rome FCO Airport" required />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Departure Date</label>
                  <input type="date" value={depDate} onChange={e => setDepDate(e.target.value)} min={trip.startDate} max={trip.endDate} required />
                </div>
                <div className="form-group">
                  <label>Arrival Date</label>
                  <input type="date" value={arrDate} onChange={e => setArrDate(e.target.value)} min={depDate || trip.startDate} max={trip.endDate} required />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Departure Time</label>
                  <input type="time" value={depTime} onChange={e => setDepTime(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Arrival Time</label>
                  <input type="time" value={arrTime} onChange={e => setArrTime(e.target.value)} required />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Departure Timezone</label>
                  <input type="text" value={depTz} onChange={e => setDepTz(e.target.value)} placeholder="e.g. GMT+1, CET" required />
                </div>
                <div className="form-group">
                  <label>Arrival Timezone</label>
                  <input type="text" value={arrTz} onChange={e => setArrTz(e.target.value)} placeholder="e.g. GMT+9, JST" required />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Carrier / Operator (Optional)</label>
                  <input type="text" value={transitCarrier} onChange={e => setTransitCarrier(e.target.value)} placeholder="e.g. Air France" />
                </div>
                <div className="form-group">
                  <label>Transit Code / Flight No (Optional)</label>
                  <input type="text" value={transitCode} onChange={e => setTransitCode(e.target.value)} placeholder="e.g. AF1234" />
                </div>
              </div>

              <div className="form-group">
                <label>Notes (Optional)</label>
                <textarea value={transitNotes} onChange={e => setTransitNotes(e.target.value)} placeholder="Gate, booking reference, details..." rows={2} />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowTransportModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Add Transport</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Hotel Stay Modal */}
      {showHotelModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Hotel Stay Planner</h3>
              <button className="modal-close" onClick={() => setShowHotelModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddHotel}>
              <div className="form-group">
                <label>Hotel Name</label>
                <input type="text" value={hotelName} onChange={e => setHotelName(e.target.value)} placeholder="e.g. Hilton Roma" required />
              </div>
              <div className="form-group">
                <label>Address (Optional)</label>
                <input type="text" value={hotelAddress} onChange={e => setHotelAddress(e.target.value)} placeholder="e.g. Via Alberto, Rome" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Check-In Date</label>
                  <input type="date" value={hotelCheckIn} onChange={e => setHotelCheckIn(e.target.value)} min={trip.startDate} max={trip.endDate} required />
                </div>
                <div className="form-group">
                  <label>Check-Out Date</label>
                  <input type="date" value={hotelCheckOut} onChange={e => setHotelCheckOut(e.target.value)} min={hotelCheckIn || trip.startDate} max={trip.endDate} required />
                </div>
              </div>
              <div className="form-group">
                <label>Notes (Optional)</label>
                <textarea value={hotelNotes} onChange={e => setHotelNotes(e.target.value)} placeholder="Booking reference, room details..." rows={2} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowHotelModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Stay</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Custom Group Modal */}
      {showGroupModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Custom Group</h3>
              <button className="modal-close" onClick={() => setShowGroupModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddPlaceGroup}>
              <GroupFormFields 
                name={newGroupName} 
                setName={setNewGroupName} 
                color={newGroupColor} 
                setColor={setNewGroupColor} 
                icon={newGroupIcon} 
                setIcon={setNewGroupIcon} 
              />

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowGroupModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Add Group</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Edit Group Modal */}
      {showEditGroupModal && editingGroup && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Group</h3>
              <button className="modal-close" onClick={() => setShowEditGroupModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveEditPlaceGroup}>
              <GroupFormFields 
                name={editGroupName} 
                setName={setEditGroupName} 
                color={editGroupColor} 
                setColor={setEditGroupColor} 
                icon={editGroupIcon} 
                setIcon={setEditGroupIcon} 
                placeholder="e.g. Attractions, Food"
              />

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowEditGroupModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Add Location Modal */}
      {showAddLocationModal && (
        <div className="modal-overlay" onClick={handleCloseAddLocation}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{addLocationForDay ? 'Add Location for Day' : 'Add Location to Trip'}</h3>
              <button className="modal-close" onClick={handleCloseAddLocation}>
                <X size={20} />
              </button>
            </div>
            <div className="form-group" style={{ position: 'relative' }}>
              <label>Search City / Location</label>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  placeholder="e.g. Rome, Tokyo, New York..." 
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  style={{ paddingLeft: '32px' }}
                  autoFocus
                />
                {isSearchingLocation && (
                  <div style={{ position: 'absolute', right: '10px', top: '12px', fontSize: '10px', color: 'var(--text-muted)' }}>Loading...</div>
                )}
              </div>
              
              {locationSuggestions.length > 0 && (
                <div className="autocomplete-dropdown" style={{ position: 'absolute', width: '100%', top: '100%' }}>
                  {locationSuggestions.map(loc => (
                    <div 
                      key={loc.id} 
                      className="autocomplete-item"
                      onClick={() => {
                        if (addLocationForDay) {
                          handleAddNewLocationForDay(loc);
                        } else {
                          handleAddNewLocationToCatalog(loc);
                        }
                        setShowAddLocationModal(false);
                      }}
                    >
                      {loc.city}{loc.state ? `, ${loc.state}` : ''}, {loc.country}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-actions" style={{ marginTop: '40px' }}>
              <button type="button" className="btn-secondary" onClick={handleCloseAddLocation}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Trip Details Modal */}
      {showEditTripModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Trip Details</h3>
              <button className="modal-close" onClick={() => setShowEditTripModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveEditTrip}>
              <div className="form-group">
                <label>Trip Name</label>
                <input 
                  type="text" 
                  value={editTripName} 
                  onChange={e => setEditTripName(e.target.value)} 
                  placeholder="e.g. Summer in Europe" 
                  required 
                  autoFocus 
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Start Date</label>
                  <input 
                    type="date" 
                    value={editTripStart} 
                    onChange={e => handleEditTripStartChange(e.target.value)} 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label>End Date</label>
                  <input 
                    type="date" 
                    value={editTripEnd} 
                    onChange={e => handleEditTripEndChange(e.target.value)} 
                    required 
                  />
                </div>
              </div>

              {(() => {
                const currentDuration = getDaysDiff(trip.startDate, trip.endDate) + 1;
                const newDuration = (editTripStart && editTripEnd) ? getDaysDiff(editTripStart, editTripEnd) + 1 : currentDuration;
                if (newDuration < currentDuration) {
                  return (
                    <div 
                      style={{ 
                        marginTop: '16px', 
                        padding: '10px 12px', 
                        background: 'rgba(239, 68, 68, 0.1)', 
                        borderLeft: '3px solid var(--color-danger)', 
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: '#fca5a5',
                        lineHeight: 1.4,
                        textTransform: 'none'
                      }}
                    >
                      ⚠️ Warning: The new duration is shorter ({newDuration} days) than the current one ({currentDuration} days). The last {currentDuration - newDuration} day(s) of your plans will be permanently deleted.
                    </div>
                  );
                }
                return null;
              })()}

              <div className="modal-actions" style={{ marginTop: '24px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowEditTripModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{confirmModal.title}</h3>
              <button className="modal-close" onClick={() => setConfirmModal(null)}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '16px 0', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5', textTransform: 'none', whiteSpace: 'pre-wrap' }}>
              {confirmModal.message}
            </div>
            <div className="modal-actions" style={{ marginTop: '20px' }}>
              {!confirmModal.isAlert && (
                <button type="button" className="btn-secondary" onClick={() => setConfirmModal(null)}>
                  {confirmModal.cancelText || 'Cancel'}
                </button>
              )}
              <button 
                type="button" 
                className="btn-primary" 
                style={{ 
                  background: confirmModal.isAlert ? 'var(--accent-primary)' : 'var(--color-danger)', 
                  borderColor: confirmModal.isAlert ? 'var(--accent-primary)' : 'var(--color-danger)' 
                }}
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
              >
                {confirmModal.confirmText || (confirmModal.isAlert ? 'OK' : 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Location Modal */}
      {showEditLocationModal && catalogLocation && (
        <div className="modal-overlay" onClick={handleCloseEditLocation}>
          <div className="modal-content glass-panel scrollable" style={{ maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Location</h3>
              <button className="modal-close" onClick={handleCloseEditLocation}>
                <X size={20} />
              </button>
            </div>

            {/* Auto-Populate suggestions search */}
            <div className="form-group" style={{ padding: '0 12px', marginBottom: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '16px' }}>
              <label style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Auto-Populate Details</label>
              <div style={{ position: 'relative', marginTop: '6px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  placeholder="Search city to auto-fill fields..." 
                  value={editLocSearchQuery}
                  onChange={(e) => setEditLocSearchQuery(e.target.value)}
                  style={{ paddingLeft: '32px' }}
                />
                {isSearchingEditLoc && (
                  <div style={{ position: 'absolute', right: '10px', top: '12px', fontSize: '10px', color: 'var(--text-muted)' }}>Searching...</div>
                )}
              </div>
              
              {editLocSuggestions.length > 0 && (
                <div style={{ 
                  background: 'var(--bg-panel)', 
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid var(--border-glass)', 
                  borderRadius: '6px', 
                  marginTop: '6px', 
                  maxHeight: '150px', 
                  overflowY: 'auto' 
                }}>
                  {editLocSuggestions.map((sug) => (
                    <div 
                      key={sug.id} 
                      onClick={() => {
                        setEditLocCity(sug.city);
                        setEditLocState(sug.state || '');
                        setEditLocCountry(sug.country);
                        setEditLocCountryCode(sug.countryCode || '');
                        setEditLocLat(sug.lat.toString());
                        setEditLocLng(sug.lng.toString());
                        setEditLocHeroPhoto(sug.heroPhoto || '');
                        setEditLocSearchQuery('');
                        setEditLocSuggestions([]);
                      }}
                      style={{ 
                        padding: '8px 12px', 
                        cursor: 'pointer', 
                        borderBottom: '1px solid rgba(255,255,255,0.03)', 
                        fontSize: '12px' 
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {getLocIcon(sug as Location)} {sug.city}, {sug.country}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleSaveEditLocation}>
              <div className="modal-scroll-body">
                <LocationFormFields
                  city={editLocCity}
                  setCity={setEditLocCity}
                  stateVal={editLocState}
                  setStateVal={setEditLocState}
                  country={editLocCountry}
                  setCountry={setEditLocCountry}
                  countryCode={editLocCountryCode}
                  setCountryCode={setEditLocCountryCode}
                  color={editLocColor}
                  setColor={setEditLocColor}
                  lat={editLocLat}
                  setLat={setEditLocLat}
                  lng={editLocLng}
                  setLng={setEditLocLng}
                  heroPhoto={editLocHeroPhoto}
                  setHeroPhoto={setEditLocHeroPhoto}
                  locations={trip.locations}
                  currentLocationId={catalogLocation.id}
                  draggedLocationIndex={draggedLocationIndex}
                  setDraggedLocationIndex={setDraggedLocationIndex}
                  dragOverLocationIndex={dragOverLocationIndex}
                  setDragOverLocationIndex={setDragOverLocationIndex}
                  handleDragStart={handleDragStart}
                  handleDragOver={handleDragOver}
                  handleDrop={handleDrop}
                  getLocIcon={getLocIcon}
                  getFormattedLocationName={getFormattedLocationName}
                />
              </div>

              <div className="modal-actions sticky" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button 
                  type="button" 
                  className="btn-secondary flex-align"
                  style={{ color: 'var(--color-danger)', borderColor: 'rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.04)', gap: '4px' }}
                  onClick={handleEditLocationDelete}
                >
                  <Trash2 size={14} /> Delete Location
                </button>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="btn-secondary" onClick={handleCloseEditLocation}>Cancel</button>
                  <button type="submit" className="btn-primary">Save</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
