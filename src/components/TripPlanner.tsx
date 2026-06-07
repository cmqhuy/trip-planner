import { useState, useEffect } from 'react';
import type { Trip, Plan, PlanDay, Location, Place, PlaceGroup, Transportation, Hotel } from '../types';
import { 
  ArrowLeft, MapPin, Plus, Trash2, Edit2, 
  ExternalLink, Navigation, ChevronUp, ChevronDown, 
  Search, Plane, Train, Bus, Car, Anchor, 
  Building, BookOpen, Clock, Check, Layers, X
} from 'lucide-react';
import { searchLocation, searchPlacesNearLocation, DEFAULT_PLACE_GROUPS } from '../utils/api';
import MapComponent from './MapComponent';

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
}

export default function TripPlanner({ trip, onBack, onUpdateTrip }: TripPlannerProps) {
  // Plan State
  const [activePlanId, setActivePlanId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('plan') || trip.plans[0]?.id || '';
  });
  const activePlan = trip.plans.find(p => p.id === activePlanId) || trip.plans[0];

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
  const [locationSuggestions, setLocationSuggestions] = useState<Omit<Location, 'places' | 'placeGroups'>[]>([]);
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
  const handleAddNewLocationToCatalog = (loc: Omit<Location, 'places' | 'placeGroups'>) => {
    let existingLoc = trip.locations.find(
      l => l.city.toLowerCase() === loc.city.toLowerCase() && 
           l.country.toLowerCase() === loc.country.toLowerCase()
    );

    let updatedLocations = [...trip.locations];

    if (!existingLoc) {
      const colorIndex = trip.locations.length % LOCATION_COLORS.length;
      const color = LOCATION_COLORS[colorIndex];
      const newLoc: Location = {
        ...loc,
        places: [],
        placeGroups: [...DEFAULT_PLACE_GROUPS],
        color
      };
      updatedLocations.push(newLoc);
      existingLoc = newLoc;
    }

    onUpdateTrip({
      ...trip,
      locations: updatedLocations
    });

    setSelectedCatalogLocId(existingLoc.id);
    setLocationQuery('');
    setLocationSuggestions([]);
  };

  const handleAddNewLocationForDay = (loc: Omit<Location, 'places' | 'placeGroups'>) => {
    let existingLoc = trip.locations.find(
      l => l.city.toLowerCase() === loc.city.toLowerCase() && 
           l.country.toLowerCase() === loc.country.toLowerCase()
    );

    let updatedLocations = [...trip.locations];

    if (!existingLoc) {
      const colorIndex = trip.locations.length % LOCATION_COLORS.length;
      const color = LOCATION_COLORS[colorIndex];
      const newLoc: Location = {
        ...loc,
        places: [],
        placeGroups: [...DEFAULT_PLACE_GROUPS],
        color
      };
      updatedLocations.push(newLoc);
      existingLoc = newLoc;
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
  };

  const handleDeleteLocation = (locId: string) => {
    if (!confirm('Are you sure you want to delete this location? This will remove all its places from the catalog and any day plans.')) return;

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

    onUpdateTrip({
      ...trip,
      locations: updatedLocations,
      plans: updatedPlans
    });

    // 3. Reset selectedCatalogLocId to first available location
    const remaining = updatedLocations[0]?.id || '';
    setSelectedCatalogLocId(remaining);
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
      alert('A trip must have at least one plan option.');
      return;
    }
    if (confirm('Are you sure you want to delete this plan option?')) {
      const remainingPlans = trip.plans.filter(p => p.id !== planId);
      onUpdateTrip({
        ...trip,
        plans: remainingPlans
      });
      setActivePlanId(remainingPlans[0].id);
    }
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

    const isAlreadyInCatalog = activeDayLocation.places.some(p => p.title.toLowerCase() === place.title.toLowerCase());
    let updatedLocations = [...trip.locations];

    let placeId = place.id;
    if (!isAlreadyInCatalog) {
      const newPlace: Place = {
        ...place,
        placeGroupId: 'new'
      };
      updatedLocations = trip.locations.map(l => {
        if (l.id === activeDayLocation.id) {
          return {
            ...l,
            places: [...l.places, newPlace]
          };
        }
        return l;
      });
      placeId = newPlace.id;
    }

    const updatedPlans = trip.plans.map(p => {
      if (p.id === activePlan.id) {
        const currentPlaces = p.days[activeDayStr]?.placeIds || [];
        return {
          ...p,
          days: {
            ...p.days,
            [activeDayStr]: {
              ...p.days[activeDayStr],
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

    setPlaceSuggestions([]);
  };

  const handleCreateCustomPlace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPlaceTitle.trim() || !catalogLocation) return;

    const customId = `custom-place-${Date.now()}`;
    const newPlace: Place = {
      id: customId,
      title: customPlaceTitle,
      description: customPlaceDesc || 'Custom attraction',
      openingHours: customPlaceHours || '24/7',
      lat: parseFloat(customPlaceLat) || catalogLocation.lat + (Math.random() - 0.5) * 0.01,
      lng: parseFloat(customPlaceLng) || catalogLocation.lng + (Math.random() - 0.5) * 0.01,
      placeGroupId: 'new',
      notes: ''
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

    onUpdateTrip({
      ...trip,
      locations: updatedLocations
    });

    setCustomPlaceTitle('');
    setCustomPlaceDesc('');
    setCustomPlaceHours('');
    setCustomPlaceLat('');
    setCustomPlaceLng('');
    setShowCustomPlaceModal(false);
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

  // Re-group place inside catalog
  const handleMovePlaceGroup = (placeId: string, groupId: string) => {
    if (!catalogLocation) return;
    const updatedLocations = trip.locations.map(l => {
      if (l.id === catalogLocation.id) {
        const updatedPlaces = l.places.map(p => {
          if (p.id === placeId) {
            return { ...p, placeGroupId: groupId };
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
  };

  // ----------------------------------------------------
  // Notes Editing (Shared at Trip / Location level)
  // ----------------------------------------------------
  const startEditingNotes = (place: Place) => {
    setEditingPlaceNotesId(place.id);
    setTempNotes(place.notes || '');
  };

  const savePlaceNotes = (placeId: string) => {
    if (!catalogLocation) return;
    const updatedLocations = trip.locations.map(l => {
      if (l.id === catalogLocation.id) {
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
    if (!newGroupName.trim() || !catalogLocation) return;

    const newGroup: PlaceGroup = {
      id: `group-${Date.now()}`,
      name: newGroupName,
      color: newGroupColor,
      icon: newGroupIcon
    };

    const updatedLocations = trip.locations.map(l => {
      if (l.id === catalogLocation.id) {
        return {
          ...l,
          placeGroups: [...l.placeGroups, newGroup]
        };
      }
      return l;
    });

    onUpdateTrip({
      ...trip,
      locations: updatedLocations
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
    if (!editingGroup || !editGroupName.trim() || !catalogLocation) return;

    const updatedLocations = trip.locations.map(l => {
      if (l.id === catalogLocation.id) {
        const updatedGroups = l.placeGroups.map(pg => {
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
        return { ...l, placeGroups: updatedGroups };
      }
      return l;
    });

    onUpdateTrip({
      ...trip,
      locations: updatedLocations
    });

    setEditingGroup(null);
    setShowEditGroupModal(false);
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
    if (confirm('Delete this transport booking?')) {
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
    if (confirm('Delete this hotel reservation?')) {
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
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="planner-view">
      {/* LEFT PANEL: Catalog */}
      <div className="catalog-panel">
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
              style={{ flex: 1, padding: '6px 10px', fontSize: '12px', background: 'var(--bg-dark)' }}
            >
              {trip.locations.length === 0 && <option value="">No Locations Added</option>}
              {trip.locations.map(loc => (
                <option key={loc.id} value={loc.id}>{getFormattedLocationName(loc)}</option>
              ))}
            </select>
            {catalogLocation && (
              <button 
                className="mini-icon-btn" 
                onClick={() => handleDeleteLocation(catalogLocation.id)}
                title="Delete Location"
                style={{ color: 'var(--color-danger)', padding: '6px', height: '32px', width: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Trash2 size={14} />
              </button>
            )}
            <button 
              className="btn-primary flex-align"
              style={{ padding: '6px 10px', fontSize: '11px', gap: '4px', height: '32px' }}
              onClick={() => {
                setAddLocationForDay(false);
                setShowAddLocationModal(true);
              }}
            >
              <Plus size={12} /> Location
            </button>
          </div>
        </div>

        {catalogLocation ? (
          <div className="catalog-content">
            {/* Catalog Group Management */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Categorized Lists</span>
              <button 
                className="mini-icon-btn" 
                onClick={() => setShowGroupModal(true)} 
                title="Add custom group"
                style={{ color: 'var(--accent-secondary)' }}
              >
                <Plus size={14} />
              </button>
            </div>

            {/* List by Groups */}
            {[
              ...catalogLocation.placeGroups,
              { id: 'new', name: 'New / Unassigned', color: '#6b7280', icon: 'map-pin' }
            ].map(group => {
              const placesInGroup = catalogLocation.places.filter(p => p.placeGroupId === group.id);
              if (placesInGroup.length === 0 && group.id === 'new') return null; // Hide new section if empty

              return (
                <div key={group.id} className="place-group-section">
                  <div className="place-group-header">
                    <span className="place-group-title">
                      <span className="group-badge-dot" style={{ backgroundColor: group.color }} />
                      {group.name}
                    </span>
                    <div className="flex-align">
                      {group.id !== 'new' && (
                        <button className="mini-icon-btn" onClick={() => startEditingGroup(group)} title="Edit Group" style={{ padding: '2px' }}>
                          <Edit2 size={10} />
                        </button>
                      )}
                      <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                        {placesInGroup.length}
                      </span>
                    </div>
                  </div>

                  <div className="catalog-places-list">
                    {placesInGroup.map(place => (
                      <div 
                        key={place.id} 
                        className="catalog-place-card"
                        onClick={() => setActivePlaceId(place.id)}
                        style={{ borderColor: activePlaceId === place.id ? 'var(--accent-primary)' : 'var(--border-glass)' }}
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
                          <div className="place-card-info">
                            <h4 className="place-card-title">{place.title}</h4>
                            {place.openingHours && (
                              <div className="place-card-hours">
                                <Clock size={10} /> {place.openingHours}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Expand Details if selected */}
                        {activePlaceId === place.id && (
                          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '12px' }}>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.3 }}>{place.description}</p>
                            
                            {/* Notes Field (Shared at Trip level) */}
                            <div style={{ margin: '8px 0', padding: '6px 8px', background: 'rgba(99,102,241,0.04)', borderLeft: '2px solid var(--accent-primary)', borderRadius: '0 4px 4px 0' }}>
                              <label style={{ fontSize: '10px', color: 'var(--accent-primary)', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Place Notes</label>
                              
                              {editingPlaceNotesId === place.id ? (
                                <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                                  <input 
                                    type="text" 
                                    value={tempNotes}
                                    onChange={(e) => setTempNotes(e.target.value)}
                                    placeholder="Add notes..."
                                    style={{ padding: '4px 6px', fontSize: '11px', flex: 1 }}
                                  />
                                  <button className="btn-primary" onClick={() => savePlaceNotes(place.id)} style={{ padding: '4px 8px', fontSize: '11px' }}>
                                    <Check size={12} />
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <span style={{ fontStyle: 'italic', color: place.notes ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                    {place.notes || 'No notes added yet.'}
                                  </span>
                                  <button className="mini-icon-btn" onClick={() => startEditingNotes(place)} style={{ padding: '2px' }}>
                                    <Edit2 size={10} />
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Actions & Categorize */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                              <select 
                                value={place.placeGroupId || 'new'} 
                                onChange={(e) => handleMovePlaceGroup(place.id, e.target.value)}
                                style={{ padding: '4px 8px', fontSize: '11px', width: 'auto', background: 'var(--bg-dark)' }}
                              >
                                <option value="new">Unassigned</option>
                                {catalogLocation.placeGroups.map(pg => (
                                  <option key={pg.id} value={pg.id}>{pg.name}</option>
                                ))}
                              </select>
                              
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <a 
                                  href={`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="btn-secondary flex-align"
                                  style={{ padding: '4px 8px', fontSize: '11px', gap: '4px', textDecoration: 'none' }}
                                >
                                  Map <ExternalLink size={10} />
                                </a>
                                <button 
                                  className="btn-primary" 
                                  style={{ padding: '4px 8px', fontSize: '11px' }}
                                  onClick={() => {
                                    // Add directly from catalog list to timeline
                                    handleAddPlaceToDay(place);
                                  }}
                                >
                                  + Add Day
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
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
      <div className="itinerary-panel">
        <div className="itinerary-header">
          <div className="trip-meta-info">
            <div>
              <h2 style={{ fontSize: '24px' }}>{trip.name}</h2>
              <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px', display: 'flex', gap: '8px' }}>
                <span>📅 {formatDisplayDate(trip.startDate)} - {formatDisplayDate(trip.endDate)}</span>
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
                <button className="mini-icon-btn" onClick={handleRenamePlan} title="Save Name" style={{ color: 'var(--color-success)', padding: '4px' }}>
                  <Check size={14} />
                </button>
                <button className="mini-icon-btn" onClick={() => setIsRenamingPlan(false)} title="Cancel" style={{ color: 'var(--text-muted)', padding: '4px' }}>
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
                    setActivePlanId(e.target.value);
                    // Reset day string to first day of new plan if bounds differ
                    const newPlanDays = Object.keys(trip.plans.find(p => p.id === e.target.value)?.days || {}).sort();
                    if (newPlanDays.length > 0) setActiveDayStr(newPlanDays[0]);
                  }}
                >
                  {trip.plans.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button 
                  className="mini-icon-btn" 
                  onClick={() => {
                    setIsRenamingPlan(true);
                    setEditPlanName(activePlan.name);
                  }} 
                  title="Rename Plan"
                >
                  <Edit2 size={14} />
                </button>
                <button className="mini-icon-btn" onClick={() => setShowNewPlanModal(true)} title="Add Plan">
                  <Plus size={16} />
                </button>
                {trip.plans.length > 1 && (
                  <button className="mini-icon-btn" onClick={() => handleDeletePlan(activePlan.id)} title="Delete Plan" style={{ color: 'var(--color-danger)' }}>
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Days selector tabs */}
          <div className="days-tabs-nav">
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
                    borderTop: dayLoc ? `3px solid ${locColor}` : undefined,
                    borderColor: isActive && dayLoc ? locColor : undefined,
                    boxShadow: isActive && dayLoc ? `0 0 10px ${hexToRgba(locColor, 0.2)}` : undefined,
                    background: isActive && dayLoc ? `${hexToRgba(locColor, 0.08)}` : undefined,
                  }}
                >
                  <span className="day-tab-num">Day {index + 1}</span>
                  <span className="day-tab-date">{formatDisplayDate(dateStr).split(',')[1]}</span>
                  {dayLoc && (
                    <span 
                      style={{ 
                        fontSize: '9px', 
                        fontWeight: 600, 
                        color: locColor, 
                        marginTop: '2px', 
                        textOverflow: 'ellipsis', 
                        overflow: 'hidden', 
                        maxWidth: '80px', 
                        whiteSpace: 'nowrap' 
                      }}
                      title={getFormattedLocationName(dayLoc)}
                    >
                      📍 {getFormattedLocationName(dayLoc)}
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
                <MapPin size={24} style={{ color: activeDayLocation?.color || 'var(--color-danger)' }} />
                <div>
                  <label style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Location</label>
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
                    <option key={l.id} value={l.id}>{getFormattedLocationName(l)}</option>
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
                  <button className="mini-icon-btn" onClick={() => setShowCustomPlaceModal(true)} title="Add Custom Place">
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
              <div className="day-timeline">
                {scheduledPlaces.map((place, index) => (
                  <div key={`${place.id}-${index}`} className="timeline-item">
                    <div className="timeline-dot" style={{ backgroundColor: trip.locations.flatMap(l => l.placeGroups).find(g => g.id === place.placeGroupId)?.color || '#6b7280' }} />
                    
                    <div className="timeline-card glass-panel" onClick={() => setActivePlaceId(place.id)}>
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
                        <div style={{ minWidth: 0 }}>
                          <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {place.title}
                          </h4>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {place.description ? place.description.substring(0, 50) + '...' : 'Attraction'}
                          </p>
                          {place.notes && (
                            <p style={{ fontSize: '11px', color: 'var(--accent-primary)', fontStyle: 'italic', marginTop: '2px' }}>
                              📝 Note: {place.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex-align" style={{ flexShrink: 0 }} onClick={e => e.stopPropagation()}>
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
                        <button className="trip-delete-btn" onClick={() => handleRemovePlaceFromDay(index)}>
                          <Trash2 size={14} />
                        </button>
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
      <div className="map-panel">
        <MapComponent 
          places={scheduledPlaces} 
          activePlaceId={activePlaceId}
        />
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
        <div className="modal-overlay">
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Place</h3>
              <button className="modal-close" onClick={() => setShowCustomPlaceModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateCustomPlace}>
              <div className="form-group">
                <label>Place Title</label>
                <input type="text" value={customPlaceTitle} onChange={e => setCustomPlaceTitle(e.target.value)} placeholder="e.g. Eiffel Tower" required />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={customPlaceDesc} onChange={e => setCustomPlaceDesc(e.target.value)} placeholder="Short summary..." rows={2} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Opening Hours</label>
                  <input type="text" value={customPlaceHours} onChange={e => setCustomPlaceHours(e.target.value)} placeholder="e.g. 09:00 - 18:00" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Latitude (Optional)</label>
                  <input type="text" value={customPlaceLat} onChange={e => setCustomPlaceLat(e.target.value)} placeholder="e.g. 48.8584" />
                </div>
                <div className="form-group">
                  <label>Longitude (Optional)</label>
                  <input type="text" value={customPlaceLng} onChange={e => setCustomPlaceLng(e.target.value)} placeholder="e.g. 2.2945" />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowCustomPlaceModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Add Place</button>
              </div>
            </form>
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
              <div className="form-group">
                <label>Group Name</label>
                <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="e.g. Museums, Coffee Shops" required autoFocus />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Color</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input type="color" value={newGroupColor} onChange={e => setNewGroupColor(e.target.value)} style={{ padding: '0', width: '40px', height: '40px', border: 'none', borderRadius: '4px', cursor: 'pointer' }} />
                    <span style={{ fontSize: '13px', fontFamily: 'monospace' }}>{newGroupColor}</span>
                  </div>
                </div>

                <div className="form-group">
                  <label>Icon Style</label>
                  <select value={newGroupIcon} onChange={e => setNewGroupIcon(e.target.value)}>
                    <option value="landmark">🏛️ Landmark</option>
                    <option value="utensils">🍴 Restaurant / Food</option>
                    <option value="shopping-bag">🛍️ Shopping</option>
                    <option value="camera">📷 Photography</option>
                    <option value="map-pin">📍 General</option>
                    <option value="heart">💖 Favorite</option>
                  </select>
                </div>
              </div>

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
              <div className="form-group">
                <label>Group Name</label>
                <input type="text" value={editGroupName} onChange={e => setEditGroupName(e.target.value)} placeholder="e.g. Attractions, Food" required autoFocus />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Color</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input type="color" value={editGroupColor} onChange={e => setEditGroupColor(e.target.value)} style={{ padding: '0', width: '40px', height: '40px', border: 'none', borderRadius: '4px', cursor: 'pointer' }} />
                    <span style={{ fontSize: '13px', fontFamily: 'monospace' }}>{editGroupColor}</span>
                  </div>
                </div>

                <div className="form-group">
                  <label>Icon Style</label>
                  <select value={editGroupIcon} onChange={e => setEditGroupIcon(e.target.value)}>
                    <option value="landmark">🏛️ Landmark</option>
                    <option value="utensils">🍴 Restaurant / Food</option>
                    <option value="shopping-bag">🛍️ Shopping</option>
                    <option value="camera">📷 Photography</option>
                    <option value="map-pin">📍 General</option>
                    <option value="heart">💖 Favorite</option>
                  </select>
                </div>
              </div>

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
        <div className="modal-overlay">
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{addLocationForDay ? 'Add Location for Day' : 'Add Location to Trip'}</h3>
              <button className="modal-close" onClick={() => {
                setShowAddLocationModal(false);
                setLocationQuery('');
                setLocationSuggestions([]);
              }}>
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
              <button type="button" className="btn-secondary" onClick={() => {
                setShowAddLocationModal(false);
                setLocationQuery('');
                setLocationSuggestions([]);
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
