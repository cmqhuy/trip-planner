import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X, ChevronDown, Plane, Train, Bus, Car, Anchor, Navigation,
  Sparkles, RefreshCw, RotateCcw, Paperclip, Trash2, MapPin, ExternalLink, Share2, Pencil, Check, Plus, Timer,
} from 'lucide-react';
import type { TransportationReservation, Location, Place, ExpenseLine } from '../types';
import ExpensesSection from './ExpensesSection';
import { GeminiService, AI_NOT_CONFIGURED_MESSAGE, AI_FILE_CONTENTS_NOT_AVAILABLE_IN_MANUAL_MODE_MESSAGE } from '../utils/ai';
import { lookupTimezone, parseGoogleMapsUrl, fetchPlaceFromGoogleMapsUrl, searchPlacesNearLocation } from '../utils/api';
import DualMapPicker from './DualMapPicker';
import { fetchFileContentFromDrive, uploadFile, getOrCreateTripFileFolder } from '../utils/googleDrive';
import { useDriveAttachments } from '../utils/useDriveAttachments';
import { ALL_TIMEZONES, getBrowserTimezone, formatTimezoneLabel } from '../utils/timezones';
import ConfirmationModal from './ConfirmationModal';
import ShareTripModal from './ShareTripModal';

const STATUS_OPTIONS = [
  { value: 'Confirmed' as const, Icon: Check },
  { value: 'Planning' as const, Icon: Timer },
  { value: 'Canceled' as const, Icon: X },
];

interface SegmentFormState {
  id: string;
  carrier: string;
  transitCode: string;
  depLoc: string;
  depAddress: string;
  depDate: string;
  depTime: string;
  depTz: string;
  depLat: string;
  depLng: string;
  arrLoc: string;
  arrAddress: string;
  arrDate: string;
  arrTime: string;
  arrTz: string;
  arrLat: string;
  arrLng: string;
}

interface TransportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripStartDate: string;
  onSave: (transportData: Omit<TransportationReservation, 'id'>) => void;
  onDelete?: () => void;
  editingTransport?: TransportationReservation | null;
  initialSegmentIndex?: number;
  googleToken?: string;
  tripPlannerFolderId?: string;
  tripName?: string;
  tripFilesFolderId?: string;
  onFileFolderCreated?: (folderId: string) => void;
  isOwner?: boolean;
  tripDriveFileId?: string;
  defaultDate?: string;
  catalogLocation?: Location;
}

const TRANSPORT_TYPES: { value: TransportationReservation['type']; label: string; Icon: React.ElementType }[] = [
  { value: 'flight', label: 'Flight', Icon: Plane },
  { value: 'train', label: 'Train', Icon: Train },
  { value: 'bus', label: 'Bus', Icon: Bus },
  { value: 'car', label: 'Car Rental / Drive', Icon: Car },
  { value: 'ferry', label: 'Ferry', Icon: Anchor },
  { value: 'other', label: 'Other', Icon: Navigation },
];

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal, headers: { 'Accept-Language': 'en' } });
    clearTimeout(timeout);
    const data = await res.json();
    if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    return null;
  } catch { return null; }
}

type ReservationSavedValues = {
  transitName: string;
  type: TransportationReservation['type'];
  confirmationNo: string;
  bookedThrough: string;
  notes: string;
  status: 'Confirmed' | 'Planning' | 'Canceled';
};

function makeEmptySegment(defaultDate: string, browserTz: string, prevSeg?: SegmentFormState): SegmentFormState {
  return {
    id: `seg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    carrier: '',
    transitCode: '',
    depLoc: prevSeg?.arrLoc ?? '',
    depAddress: '',
    depDate: prevSeg?.arrDate ?? defaultDate,
    depTime: '12:00',
    depTz: prevSeg?.arrTz ?? browserTz,
    depLat: '',
    depLng: '',
    arrLoc: '',
    arrAddress: '',
    arrDate: prevSeg?.arrDate ?? defaultDate,
    arrTime: '14:00',
    arrTz: browserTz,
    arrLat: '',
    arrLng: '',
  };
}

export default function TransportModal({
  isOpen, onClose, tripStartDate, onSave, onDelete, editingTransport, initialSegmentIndex,
  googleToken, tripPlannerFolderId, tripName, tripFilesFolderId, onFileFolderCreated,
  isOwner = true, tripDriveFileId, defaultDate, catalogLocation,
}: TransportModalProps) {
  const browserTz = getBrowserTimezone();
  const effectiveDefaultDate = defaultDate ?? tripStartDate;

  // Reservation-level state
  const [transitName, setTransitName] = useState('');
  const [type, setType] = useState<TransportationReservation['type']>('flight');
  const [confirmationNo, setConfirmationNo] = useState('');
  const [bookedThrough, setBookedThrough] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'Confirmed' | 'Planning' | 'Canceled'>('Confirmed');
  const [expenses, setExpenses] = useState<ExpenseLine[]>([]);

  // Segment-level state
  const [segments, setSegments] = useState<SegmentFormState[]>([makeEmptySegment(effectiveDefaultDate, browserTz)]);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);

  // Undo state
  const [savedValues, setSavedValues] = useState<ReservationSavedValues | null>(null);
  // initialSegments: snapshot at open time, used for per-field undo buttons
  const [initialSegments, setInitialSegments] = useState<SegmentFormState[] | null>(null);

  // Validation errors per segment: { [segIdx]: ['depLoc', 'arrDate', ...] }
  const [segmentErrors, setSegmentErrors] = useState<Record<number, string[]>>({});

  // UI state
  const [isAiFilling, setIsAiFilling] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAccessError, setShowAccessError] = useState(false);
  const [showShareFolder, setShowShareFolder] = useState(false);
  const [editingChip, setEditingChip] = useState<{ fileId: string; value: string } | null>(null);

  // Dropdown state
  const [typeOpen, setTypeOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusPos, setStatusPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [depTzOpen, setDepTzOpen] = useState(false);
  const [depTzSearch, setDepTzSearch] = useState('');
  const [depTzPos, setDepTzPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [arrTzOpen, setArrTzOpen] = useState(false);
  const [arrTzSearch, setArrTzSearch] = useState('');
  const [arrTzPos, setArrTzPos] = useState<{ top: number; left: number; width: number } | null>(null);


  // Autocomplete suggestions and search states
  const [depSuggestions, setDepSuggestions] = useState<(Omit<Place, 'placeGroupId'> & { address?: string })[]>([]);
  const [depSuggestionsField, setDepSuggestionsField] = useState<'depLoc' | 'depAddress' | null>(null);
  const [isDepSearching, setIsDepSearching] = useState(false);
  const [depSearchError, setDepSearchError] = useState<string | null>(null);

  const [arrSuggestions, setArrSuggestions] = useState<(Omit<Place, 'placeGroupId'> & { address?: string })[]>([]);
  const [arrSuggestionsField, setArrSuggestionsField] = useState<'arrLoc' | 'arrAddress' | null>(null);
  const [isArrSearching, setIsArrSearching] = useState(false);
  const [arrSearchError, setArrSearchError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const autofillInputRef = useRef<HTMLInputElement>(null);
  const typeRef = useRef<HTMLDivElement>(null);
  const depTzTriggerRef = useRef<HTMLButtonElement>(null);
  const arrTzTriggerRef = useRef<HTMLButtonElement>(null);
  const statusTriggerRef = useRef<HTMLButtonElement>(null);
  const depSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const arrSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    attachedFiles, setAttachments, uploadingCount, removePrompt, setRemovePrompt,
    handleFileSelect, handleRemoveChip, confirmRemoveChip, renameAttachment,
  } = useDriveAttachments({
    googleToken, tripPlannerFolderId, tripName, tripFilesFolderId, onFileFolderCreated,
    initialAttachments: editingTransport?.attachments ?? [],
    onSetAiError: setAiError,
    onAccessError: () => setShowAccessError(true),
  });

  // Active segment shortcut
  const seg = segments[activeSegmentIndex] ?? segments[0];
  const updateSegment = (idx: number, patch: Partial<SegmentFormState>) =>
    setSegments(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));

  useEffect(() => {
    if (!isOpen) return;
    const t = editingTransport;
    const initSegs: SegmentFormState[] = t?.segments?.length
      ? t.segments.map(s => ({
          id: s.id,
          carrier: s.carrier ?? '',
          transitCode: s.transitCode ?? '',
          depLoc: s.departureLocationName,
          depAddress: s.departureAddress ?? '',
          depDate: s.departureDate,
          depTime: s.departureTime,
          depTz: s.departureTimezone,
          depLat: s.departureLat != null ? String(s.departureLat) : '',
          depLng: s.departureLng != null ? String(s.departureLng) : '',
          arrLoc: s.arrivalLocationName,
          arrAddress: s.arrivalAddress ?? '',
          arrDate: s.arrivalDate,
          arrTime: s.arrivalTime,
          arrTz: s.arrivalTimezone,
          arrLat: s.arrivalLat != null ? String(s.arrivalLat) : '',
          arrLng: s.arrivalLng != null ? String(s.arrivalLng) : '',
        }))
      : [makeEmptySegment(effectiveDefaultDate, browserTz)];

    const initValues: ReservationSavedValues = {
      transitName: t?.name ?? '',
      type: t?.type ?? 'flight',
      confirmationNo: t?.confirmationNo ?? '',
      bookedThrough: t?.bookedThrough ?? '',
      notes: t?.notes ?? '',
      status: t ? (t.status ?? 'Planning') : 'Confirmed',
    };

    setTransitName(initValues.transitName);
    setType(initValues.type);
    setConfirmationNo(initValues.confirmationNo);
    setBookedThrough(initValues.bookedThrough);
    setNotes(initValues.notes);
    setStatus(initValues.status);
    setSegments(initSegs);
    setActiveSegmentIndex(Math.min(initialSegmentIndex ?? 0, initSegs.length - 1));
    setExpenses(t?.expenses ?? []);
    setAttachments(t?.attachments ?? []);
    setSavedValues(initValues);
    setInitialSegments(initSegs.map(s => ({ ...s })));
    setAiError(null);
    setRemovePrompt(null);
    setSegmentErrors({});
    setTypeOpen(false);
    setDepTzOpen(false);
    setArrTzOpen(false);
    setStatusOpen(false);
    setShowAccessError(false);
    setShowShareFolder(false);
    setEditingChip(null);
    setDepSuggestions([]);
    setDepSuggestionsField(null);
    setDepSearchError(null);
    setArrSuggestions([]);
    setArrSuggestionsField(null);
    setArrSearchError(null);
  }, [isOpen]);

  const handleSelectSuggestion = (field: 'dep' | 'arr', sug: Omit<Place, 'placeGroupId'> & { address?: string }) => {
    updateSegment(activeSegmentIndex, {
      depLoc: field === 'dep' ? sug.title : seg.depLoc,
      depAddress: field === 'dep' ? (sug.address || sug.description || '') : seg.depAddress,
      depLat: field === 'dep' ? sug.lat.toString() : seg.depLat,
      depLng: field === 'dep' ? sug.lng.toString() : seg.depLng,

      arrLoc: field === 'arr' ? sug.title : seg.arrLoc,
      arrAddress: field === 'arr' ? (sug.address || sug.description || '') : seg.arrAddress,
      arrLat: field === 'arr' ? sug.lat.toString() : seg.arrLat,
      arrLng: field === 'arr' ? sug.lng.toString() : seg.arrLng,
    });

    if (sug.lat != null && sug.lng != null) {
      lookupTimezone(sug.lat, sug.lng).then(tz => {
        if (tz) {
          updateSegment(activeSegmentIndex, {
            depTz: field === 'dep' ? tz : seg.depTz,
            arrTz: field === 'arr' ? tz : seg.arrTz,
          });
        }
      });
    }

    if (field === 'dep') {
      setDepSuggestions([]);
      setDepSuggestionsField(null);
    } else {
      setArrSuggestions([]);
      setArrSuggestionsField(null);
    }
  };

  // Close suggestions on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      
      const depLocInput = document.getElementById('dep-loc');
      const depAddrInput = document.getElementById('dep-address');
      const arrLocInput = document.getElementById('arr-loc');
      const arrAddrInput = document.getElementById('arr-address');
      const suggestionsPanels = document.querySelectorAll('.modal-suggestions-panel');
      
      let clickedPanel = false;
      suggestionsPanels.forEach(panel => {
        if (panel.contains(target)) clickedPanel = true;
      });

      if (!depLocInput?.contains(target) && !depAddrInput?.contains(target) && !clickedPanel) {
        setDepSuggestions([]);
        setDepSuggestionsField(null);
      }
      if (!arrLocInput?.contains(target) && !arrAddrInput?.contains(target) && !clickedPanel) {
        setArrSuggestions([]);
        setArrSuggestionsField(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Handle departure autocomplete search / Google Maps link paste as-you-type
  useEffect(() => {
    if (depSearchError) {
      setDepSearchError(null);
    }
    
    // Determine which field is focused and what query to use
    const activeEl = document.activeElement;
    let query = '';
    let fieldName: 'depLoc' | 'depAddress' | null = null;
    
    if (activeEl?.id === 'dep-loc') {
      query = seg.depLoc;
      fieldName = 'depLoc';
    } else if (activeEl?.id === 'dep-address') {
      query = seg.depAddress;
      fieldName = 'depAddress';
    }
    
    if (!fieldName || !query.trim() || query.length < 3) {
      setDepSuggestions([]);
      setDepSuggestionsField(null);
      return;
    }

    if (depSearchTimeoutRef.current) clearTimeout(depSearchTimeoutRef.current);

    const { isGoogleMapsUrl } = parseGoogleMapsUrl(query);
    if (isGoogleMapsUrl) {
      setIsDepSearching(true);
      fetchPlaceFromGoogleMapsUrl(query, catalogLocation ?? undefined).then(async ({ place, error }) => {
        setIsDepSearching(false);
        if (error || !place) {
          setDepSearchError(error ?? 'Could not extract place info.');
          return;
        }
        
        const tz = place.lat != null && place.lng != null ? await lookupTimezone(place.lat, place.lng) : undefined;
        
        updateSegment(activeSegmentIndex, {
          depLoc: place.title,
          depAddress: place.address || place.description || '',
          depLat: place.lat.toString(),
          depLng: place.lng.toString(),
          depTz: tz || seg.depTz
        });
        setDepSuggestions([]);
        setDepSuggestionsField(null);
      });
      return;
    }

    if (!catalogLocation) {
      setDepSuggestions([]);
      setDepSuggestionsField(null);
      return;
    }

    setDepSuggestionsField(fieldName);
    depSearchTimeoutRef.current = setTimeout(async () => {
      setIsDepSearching(true);
      try {
        const results = await searchPlacesNearLocation(query, catalogLocation);
        setDepSuggestions(results);
      } catch (err) {
        console.error('Failed to search departure places:', err);
      } finally {
        setIsDepSearching(false);
      }
    }, 500);

    return () => {
      if (depSearchTimeoutRef.current) clearTimeout(depSearchTimeoutRef.current);
    };
  }, [seg.depLoc, seg.depAddress, catalogLocation, activeSegmentIndex]);

  // Handle arrival autocomplete search / Google Maps link paste as-you-type
  useEffect(() => {
    if (arrSearchError) {
      setArrSearchError(null);
    }
    
    // Determine which field is focused and what query to use
    const activeEl = document.activeElement;
    let query = '';
    let fieldName: 'arrLoc' | 'arrAddress' | null = null;
    
    if (activeEl?.id === 'arr-loc') {
      query = seg.arrLoc;
      fieldName = 'arrLoc';
    } else if (activeEl?.id === 'arr-address') {
      query = seg.arrAddress;
      fieldName = 'arrAddress';
    }
    
    if (!fieldName || !query.trim() || query.length < 3) {
      setArrSuggestions([]);
      setArrSuggestionsField(null);
      return;
    }

    if (arrSearchTimeoutRef.current) clearTimeout(arrSearchTimeoutRef.current);

    const { isGoogleMapsUrl } = parseGoogleMapsUrl(query);
    if (isGoogleMapsUrl) {
      setIsArrSearching(true);
      fetchPlaceFromGoogleMapsUrl(query, catalogLocation ?? undefined).then(async ({ place, error }) => {
        setIsArrSearching(false);
        if (error || !place) {
          setArrSearchError(error ?? 'Could not extract place info.');
          return;
        }
        
        const tz = place.lat != null && place.lng != null ? await lookupTimezone(place.lat, place.lng) : undefined;
        
        updateSegment(activeSegmentIndex, {
          arrLoc: place.title,
          arrAddress: place.address || place.description || '',
          arrLat: place.lat.toString(),
          arrLng: place.lng.toString(),
          arrTz: tz || seg.arrTz
        });
        setArrSuggestions([]);
        setArrSuggestionsField(null);
      });
      return;
    }

    if (!catalogLocation) {
      setArrSuggestions([]);
      setArrSuggestionsField(null);
      return;
    }

    setArrSuggestionsField(fieldName);
    arrSearchTimeoutRef.current = setTimeout(async () => {
      setIsArrSearching(true);
      try {
        const results = await searchPlacesNearLocation(query, catalogLocation);
        setArrSuggestions(results);
      } catch (err) {
        console.error('Failed to search arrival places:', err);
      } finally {
        setIsArrSearching(false);
      }
    }, 500);

    return () => {
      if (arrSearchTimeoutRef.current) clearTimeout(arrSearchTimeoutRef.current);
    };
  }, [seg.arrLoc, seg.arrAddress, catalogLocation, activeSegmentIndex]);

  useEffect(() => {
    if (!typeOpen) return;
    const handler = (e: MouseEvent) => {
      if (!typeRef.current?.contains(e.target as Node)) setTypeOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [typeOpen]);

  const addSegment = () => {
    const prev = segments[segments.length - 1];
    const newSeg = makeEmptySegment(effectiveDefaultDate, browserTz, prev);
    setSegments(s => [...s, newSeg]);
    setActiveSegmentIndex(segments.length);
  };

  const deleteSegment = (idx: number) => {
    if (segments.length <= 1) return;
    setSegments(prev => prev.filter((_, i) => i !== idx));
    setActiveSegmentIndex(prev => Math.min(prev, segments.length - 2));
  };

  const clearSegmentError = (segIdx: number, field: string) => {
    setSegmentErrors(prev => {
      const errs = prev[segIdx];
      if (!errs?.includes(field)) return prev;
      const remaining = errs.filter(f => f !== field);
      const next = { ...prev };
      if (remaining.length === 0) { delete next[segIdx]; } else { next[segIdx] = remaining; }
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<number, string[]> = {};
    segments.forEach((s, idx) => {
      const errs: string[] = [];
      if (!s.depLoc.trim()) errs.push('depLoc');
      if (!s.arrLoc.trim()) errs.push('arrLoc');
      if (!s.depDate) errs.push('depDate');
      if (!s.arrDate) errs.push('arrDate');
      if (!s.depTime) errs.push('depTime');
      if (!s.arrTime) errs.push('arrTime');
      if (errs.length > 0) errors[idx] = errs;
    });
    if (Object.keys(errors).length > 0) {
      setSegmentErrors(errors);
      const firstInvalid = segments.findIndex((_, idx) => (errors[idx]?.length ?? 0) > 0);
      if (firstInvalid !== -1 && firstInvalid !== activeSegmentIndex) setActiveSegmentIndex(firstInvalid);
      return;
    }
    onSave({
      type,
      name: transitName.trim() || undefined,
      confirmationNo: confirmationNo.trim() || undefined,
      bookedThrough: bookedThrough.trim() || undefined,
      notes: notes.trim() || undefined,
      status,
      expenses,
      attachments: attachedFiles,
      segments: segments.map(s => ({
        id: s.id,
        carrier: s.carrier.trim() || undefined,
        transitCode: s.transitCode.trim() || undefined,
        departureLocationName: s.depLoc.trim(),
        departureAddress: s.depAddress.trim() || undefined,
        departureDate: s.depDate,
        departureTime: s.depTime,
        departureTimezone: s.depTz,
        departureLat: s.depLat.trim() ? parseFloat(s.depLat) : undefined,
        departureLng: s.depLng.trim() ? parseFloat(s.depLng) : undefined,
        arrivalLocationName: s.arrLoc.trim(),
        arrivalAddress: s.arrAddress.trim() || undefined,
        arrivalDate: s.arrDate,
        arrivalTime: s.arrTime,
        arrivalTimezone: s.arrTz,
        arrivalLat: s.arrLat.trim() ? parseFloat(s.arrLat) : undefined,
        arrivalLng: s.arrLng.trim() ? parseFloat(s.arrLng) : undefined,
      })),
    });
    onClose();
  };

  const applyAiResult = async (result: any) => {
    if (result.name !== undefined) setTransitName(result.name ?? '');
    if (result.type && TRANSPORT_TYPES.find(t => t.value === result.type)) setType(result.type);
    if (result.confirmationNo !== undefined) setConfirmationNo(result.confirmationNo ?? '');
    if (result.bookedThrough !== undefined) setBookedThrough(result.bookedThrough ?? '');
    const parsed = GeminiService.parseExtractedExpenses(result, 'expense-autofill');
    if (parsed.length > 0) {
      setExpenses(prev => {
        const filtered = parsed.filter(ne => !prev.some(pe => pe.description === ne.description && pe.price === ne.price));
        return [...prev, ...filtered];
      });
    }
    if (result.notes !== undefined) setNotes(result.notes ?? '');
    if (result.status && ['Confirmed', 'Planning', 'Canceled'].includes(result.status)) setStatus(result.status);

    const aiSegs: any[] | undefined = Array.isArray(result.segments) && result.segments.length > 0 ? result.segments : undefined;

    if (aiSegs) {
      const newSegs: SegmentFormState[] = await Promise.all(aiSegs.map(async (aiSeg: any, idx: number) => {
        let dLat = aiSeg.departureLat ?? null;
        let dLng = aiSeg.departureLng ?? null;
        let aLat = aiSeg.arrivalLat ?? null;
        let aLng = aiSeg.arrivalLng ?? null;

        if (dLat == null && dLng == null && aiSeg.departureAddress) {
          const c = await geocodeAddress(aiSeg.departureAddress);
          if (c) { dLat = c.lat; dLng = c.lng; }
        }
        if (aLat == null && aLng == null && aiSeg.arrivalAddress) {
          const c = await geocodeAddress(aiSeg.arrivalAddress);
          if (c) { aLat = c.lat; aLng = c.lng; }
        }

        let depTz = aiSeg.departureTimezone ?? null;
        let arrTz = aiSeg.arrivalTimezone ?? null;
        if (!depTz && dLat != null && dLng != null) depTz = await lookupTimezone(dLat, dLng) ?? browserTz;
        if (!arrTz && aLat != null && aLng != null) arrTz = await lookupTimezone(aLat, aLng) ?? browserTz;

        return {
          id: segments[idx]?.id ?? `seg-${Date.now()}-${idx}`,
          carrier: aiSeg.carrier ?? '',
          transitCode: aiSeg.transitCode ?? '',
          depLoc: aiSeg.departureLocationName ?? '',
          depAddress: aiSeg.departureAddress ?? '',
          depDate: aiSeg.departureDate ?? effectiveDefaultDate,
          depTime: aiSeg.departureTime ?? '12:00',
          depTz: depTz ?? browserTz,
          depLat: dLat != null ? String(dLat) : '',
          depLng: dLng != null ? String(dLng) : '',
          arrLoc: aiSeg.arrivalLocationName ?? '',
          arrAddress: aiSeg.arrivalAddress ?? '',
          arrDate: aiSeg.arrivalDate ?? effectiveDefaultDate,
          arrTime: aiSeg.arrivalTime ?? '14:00',
          arrTz: arrTz ?? browserTz,
          arrLat: aLat != null ? String(aLat) : '',
          arrLng: aLng != null ? String(aLng) : '',
        };
      }));
      setSegments(newSegs);
      setActiveSegmentIndex(0);
    } else {
      // Flat single-segment result — apply to active segment
      const currentIdx = activeSegmentIndex;
      const currentSeg = segments[currentIdx] ?? segments[0];
      const patch: Partial<SegmentFormState> = {};

      if (result.carrier !== undefined) patch.carrier = result.carrier ?? '';
      if (result.transitCode !== undefined) patch.transitCode = result.transitCode ?? '';
      if (result.departureLocationName) patch.depLoc = result.departureLocationName;
      if (result.departureAddress) patch.depAddress = result.departureAddress;
      if (result.departureDate) patch.depDate = result.departureDate;
      if (result.departureTime) patch.depTime = result.departureTime;
      if (result.arrivalLocationName) patch.arrLoc = result.arrivalLocationName;
      if (result.arrivalAddress) patch.arrAddress = result.arrivalAddress;
      if (result.arrivalDate) patch.arrDate = result.arrivalDate;
      if (result.arrivalTime) patch.arrTime = result.arrivalTime;

      let dLat = result.departureLat ?? null;
      let dLng = result.departureLng ?? null;
      let aLat = result.arrivalLat ?? null;
      let aLng = result.arrivalLng ?? null;

      if (dLat == null && dLng == null && result.departureAddress && !currentSeg.depLat) {
        const c = await geocodeAddress(result.departureAddress);
        if (c) { dLat = c.lat; dLng = c.lng; }
      }
      if (aLat == null && aLng == null && result.arrivalAddress && !currentSeg.arrLat) {
        const c = await geocodeAddress(result.arrivalAddress);
        if (c) { aLat = c.lat; aLng = c.lng; }
      }
      if (dLat != null && dLng != null) { patch.depLat = String(dLat); patch.depLng = String(dLng); }
      if (aLat != null && aLng != null) { patch.arrLat = String(aLat); patch.arrLng = String(aLng); }

      if (result.departureTimezone) {
        patch.depTz = result.departureTimezone;
      } else if (dLat != null && dLng != null) {
        const tz = await lookupTimezone(dLat, dLng);
        if (tz) patch.depTz = tz;
      }
      if (result.arrivalTimezone) {
        patch.arrTz = result.arrivalTimezone;
      } else if (aLat != null && aLng != null) {
        const tz = await lookupTimezone(aLat, aLng);
        if (tz) patch.arrTz = tz;
      }

      updateSegment(currentIdx, patch);
    }
  };

  const handleAiFill = async () => {
    if (!googleToken || attachedFiles.length === 0) return;
    if (!GeminiService.isAiEnabled() || GeminiService.isManualMode()) return;
    setIsAiFilling(true);
    setAiError(null);
    try {
      const fileContents = await Promise.all(
        attachedFiles.map(f => fetchFileContentFromDrive(googleToken!, f.fileId))
      );
      const result = await GeminiService.generateTransitDetailsFromFilesWithRotation(fileContents);
      await applyAiResult(result);
    } catch (err: any) {
      setAiError(err.message || 'AI fill failed.');
    } finally {
      setIsAiFilling(false);
    }
  };

  const handleAutofillFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = '';
    const file = files[0];
    setIsAiFilling(true);
    setAiError(null);
    try {
      const fileData = await new Promise<{ base64: string; mimeType: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const result = reader.result as string;
          const commaIdx = result.indexOf(',');
          resolve({ base64: commaIdx > -1 ? result.substring(commaIdx + 1) : result, mimeType: file.type || 'application/octet-stream' });
        };
        reader.onerror = () => reject(new Error('Failed to read file locally.'));
      });

      if (googleToken) {
        let folderId = tripFilesFolderId;
        if (!folderId && tripPlannerFolderId && tripName) {
          folderId = await getOrCreateTripFileFolder(googleToken, tripPlannerFolderId, tripName);
          onFileFolderCreated?.(folderId);
        }
        if (folderId) {
          const fileId = await uploadFile(googleToken, folderId, file);
          setAttachments(prev => [...prev, { name: file.name, filename: file.name, fileId }]);
        }
      }

      const result = await GeminiService.generateTransitDetailsFromFilesWithRotation([fileData]);
      await applyAiResult(result);
    } catch (err: any) {
      setAiError(err.message || 'AI autofill failed.');
    } finally {
      setIsAiFilling(false);
    }
  };

  const undoBtn = (current: string, saved: string | undefined, onRestore: () => void) => {
    if (saved === undefined || current === saved) return null;
    return (
      <button type="button" className="undo-btn" onClick={onRestore} data-tooltip="Restore original value">
        <RotateCcw size={11} />
      </button>
    );
  };

  const filteredDepTz = ALL_TIMEZONES.filter(tz => tz.toLowerCase().includes(depTzSearch.toLowerCase()));
  const filteredArrTz = ALL_TIMEZONES.filter(tz => tz.toLowerCase().includes(arrTzSearch.toLowerCase()));
  const selectedTypeObj = TRANSPORT_TYPES.find(t => t.value === type) ?? TRANSPORT_TYPES[0];


  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-content glass-panel scrollable"
          style={{ maxWidth: '900px' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="modal-header">
            <h3>{editingTransport ? 'Edit Transit Details' : 'Add Transit Details'}</h3>
            <button className="modal-close" onClick={onClose}><X size={20} /></button>
          </div>

          <div className="modal-autofill-panel">
            <div className="flex-between">
              <label>Auto-Populate Details</label>
              <div
                data-tooltip={
                  !GeminiService.isAiEnabled() ? AI_NOT_CONFIGURED_MESSAGE :
                  GeminiService.isManualMode() ? AI_FILE_CONTENTS_NOT_AVAILABLE_IN_MANUAL_MODE_MESSAGE :
                  'Upload a receipt or confirmation to fill details using AI'
                }
                data-tooltip-position="bottom"
                className="flex-align"
              >
                <button
                  type="button"
                  className="btn-secondary flex-align"
                  style={{
                    fontSize: '11px', padding: '4px 10px', borderRadius: '6px', gap: '5px',
                    borderColor: 'rgba(139, 92, 246, 0.25)', background: 'rgba(139, 92, 246, 0.06)',
                    cursor: (!GeminiService.isAiEnabled() || GeminiService.isManualMode() || uploadingCount > 0 || isAiFilling) ? 'not-allowed' : 'pointer',
                  }}
                  onClick={() => autofillInputRef.current?.click()}
                  disabled={!GeminiService.isAiEnabled() || GeminiService.isManualMode() || uploadingCount > 0 || isAiFilling}
                >
                  {isAiFilling ? <RefreshCw size={11} className="spin" /> : <Sparkles size={11} />}
                  {isAiFilling ? 'Generating...' : uploadingCount > 0 ? 'Uploading...' : 'Upload & Auto-Fill'}
                </button>
                <input
                  ref={autofillInputRef}
                  type="file"
                  className="visually-hidden"
                  accept="image/*,application/pdf,.eml,.txt"
                  onChange={handleAutofillFileSelect}
                  disabled={!GeminiService.isAiEnabled() || GeminiService.isManualMode() || uploadingCount > 0 || isAiFilling}
                />
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="modal-scroll-body">

              {/* Reservation-level header: 2-col grid */}
              <div className="place-form-grid">
                <div className="place-form-left-col">
                  <div className="form-group">
                    <label htmlFor="transit-name" className="place-form-label">
                      <span className="label-text">Transit Name</span>
                      {undoBtn(transitName, savedValues?.transitName, () => setTransitName(savedValues!.transitName))}
                    </label>
                    <input type="text" id="transit-name" value={transitName} onChange={e => setTransitName(e.target.value)} placeholder="Flight to Seattle" />
                  </div>

                  <div className="form-group">
                    <label><span className="label-text">Type</span></label>
                    <div className="combo-wrapper" ref={typeRef}>
                      <button type="button" className="combo-trigger" onClick={() => setTypeOpen(o => !o)}>
                        <span className="combo-trigger-content">
                          <selectedTypeObj.Icon size={14} />
                          {selectedTypeObj.label}
                        </span>
                        <ChevronDown size={14} className={`expand-chevron${typeOpen ? ' is-open' : ''}`} />
                      </button>
                      {typeOpen && (
                        <div className="combo-dropdown">
                          {TRANSPORT_TYPES.map(opt => (
                            <button key={opt.value} type="button" className={`combo-option${type === opt.value ? ' selected' : ''}`} onClick={() => { setType(opt.value); setTypeOpen(false); }}>
                              <opt.Icon size={14} />{opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="place-form-right-col">
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="transit-conf" className="place-form-label">
                        <span className="label-text">Confirmation No</span>
                        {undoBtn(confirmationNo, savedValues?.confirmationNo, () => setConfirmationNo(savedValues!.confirmationNo))}
                      </label>
                      <input type="text" id="transit-conf" value={confirmationNo} onChange={e => setConfirmationNo(e.target.value)} />
                    </div>

                    <div className="form-group">
                      <label htmlFor="transit-booked" className="place-form-label">
                        <span className="label-text">Booked via</span>
                        {undoBtn(bookedThrough, savedValues?.bookedThrough, () => setBookedThrough(savedValues!.bookedThrough))}
                      </label>
                      <input type="text" id="transit-booked" value={bookedThrough} onChange={e => setBookedThrough(e.target.value)} placeholder="e.g. Expedia" />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="place-form-label">
                      <span className="label-text">Status</span>
                      {undoBtn(status, savedValues?.status, () => setStatus(savedValues!.status))}
                    </label>
                    <div className="combo-wrapper">
                      <button
                        ref={statusTriggerRef}
                        type="button"
                        className="combo-trigger"
                        onClick={() => {
                          if (!statusOpen && statusTriggerRef.current) {
                            const r = statusTriggerRef.current.getBoundingClientRect();
                            setStatusPos({ top: r.bottom + 4, left: r.left, width: r.width });
                          }
                          setStatusOpen(o => !o);
                        }}
                      >
                        <span className="combo-trigger-content">
                          {(() => { const S = STATUS_OPTIONS.find(o => o.value === status); return S ? <S.Icon size={13} /> : null; })()}
                          {status}
                        </span>
                        <ChevronDown size={14} className={`expand-chevron${statusOpen ? ' is-open' : ''}`} />
                      </button>
                    </div>
                    {statusOpen && statusPos && createPortal(
                      <>
                        <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }} onClick={() => setStatusOpen(false)} />
                        <div className="combo-dropdown--portal" style={{ top: statusPos.top, left: statusPos.left, width: Math.max(statusPos.width, 150) }} onClick={e => e.stopPropagation()}>
                          {STATUS_OPTIONS.map(({ value: s, Icon: StatusIcon }) => (
                            <button key={s} type="button" className={`combo-option${s === status ? ' selected' : ''}`} onClick={() => { setStatus(s); setStatusOpen(false); }}>
                              <StatusIcon size={13} />{s}
                            </button>
                          ))}
                        </div>
                      </>,
                      document.body
                    )}
                  </div>
                </div>
              </div>

              {/* Segment tab bar — only shown when >1 segment */}
              {segments.length > 1 && (
                <div className="transport-segment-tabs">
                  <div className="transport-segment-tabs-scroll">
                    {segments.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className={`day-tab${activeSegmentIndex === idx ? ' active' : ''}`}
                        onClick={() => setActiveSegmentIndex(idx)}
                        data-tooltip={(segmentErrors[idx]?.length ?? 0) > 0 ? 'Required fields missing' : undefined}
                        data-tooltip-position="bottom"
                      >
                        Segment {idx + 1}
                        {(segmentErrors[idx]?.length ?? 0) > 0 && <span className="segment-tab-error-dot" />}
                      </button>
                    ))}
                  </div>
                  <div className="transport-segment-tab-actions">
                    <button
                      type="button"
                      className="btn-secondary flex-align transport-segment-add-btn"
                      onClick={addSegment}
                    >
                      <Plus size={12} /> Add Segment
                    </button>
                    <button
                      type="button"
                      className="btn-danger transport-segment-delete-btn"
                      onClick={() => deleteSegment(activeSegmentIndex)}
                    >
                      <Trash2 size={12} /> Delete Segment
                    </button>
                  </div>
                </div>
              )}

              {/* Per-segment fields: dep left | arr right */}
              <div className="place-form-grid transport-segment-fields">
                <div className="place-form-left-col">
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="transit-carrier" className="place-form-label">
                        <span className="label-text">Carrier / Operator</span>
                        {undoBtn(seg.carrier, initialSegments?.[activeSegmentIndex]?.carrier, () => updateSegment(activeSegmentIndex, { carrier: initialSegments![activeSegmentIndex].carrier }))}
                      </label>
                      <input type="text" id="transit-carrier" value={seg.carrier} onChange={e => updateSegment(activeSegmentIndex, { carrier: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label htmlFor="transit-code" className="place-form-label">
                        <span className="label-text">Transit Code / Flight No</span>
                        {undoBtn(seg.transitCode, initialSegments?.[activeSegmentIndex]?.transitCode, () => updateSegment(activeSegmentIndex, { transitCode: initialSegments![activeSegmentIndex].transitCode }))}
                      </label>
                      <input type="text" id="transit-code" value={seg.transitCode} onChange={e => updateSegment(activeSegmentIndex, { transitCode: e.target.value })} />
                    </div>
                  </div>

                  <div className="form-group form-group--relative" id="dep-loc-container">
                    <label htmlFor="dep-loc" className="place-form-label">
                      <span className="label-text">Departure Location <span style={{ color: 'var(--color-danger)' }}>*</span></span>
                      {undoBtn(seg.depLoc, initialSegments?.[activeSegmentIndex]?.depLoc, () => updateSegment(activeSegmentIndex, { depLoc: initialSegments![activeSegmentIndex].depLoc }))}
                    </label>
                    <input
                      type="text" id="dep-loc" value={seg.depLoc}
                      className={segmentErrors[activeSegmentIndex]?.includes('depLoc') ? 'input-field-error' : undefined}
                      onChange={e => { const v = e.target.value; updateSegment(activeSegmentIndex, { depLoc: v }); if (v.trim()) clearSegmentError(activeSegmentIndex, 'depLoc'); }}
                      placeholder="e.g. SEA Airport, or paste a Google Maps link..."
                    />
                    {isDepSearching && depSuggestionsField === 'depLoc' && (
                      <div className="modal-search-loader">Searching...</div>
                    )}
                    {depSearchError && depSuggestionsField === 'depLoc' && (
                      <div style={{ fontSize: '11px', color: 'var(--color-danger, #ef4444)', marginTop: '4px' }}>{depSearchError}</div>
                    )}
                    {depSuggestions.length > 0 && depSuggestionsField === 'depLoc' && (
                      <div className="modal-suggestions-panel">
                        {depSuggestions.map((sug) => (
                          <div
                            key={sug.id}
                            className="modal-suggestion-item"
                            onClick={() => handleSelectSuggestion('dep', sug)}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <div className="modal-suggestion-name">{sug.title}</div>
                            <div className="modal-suggestion-desc">{sug.address || sug.description}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="form-group form-group--relative" id="dep-address-container">
                    <label htmlFor="dep-address" className="place-form-label">
                      <span className="label-text">Departure Address</span>
                      {undoBtn(seg.depAddress, initialSegments?.[activeSegmentIndex]?.depAddress, () => updateSegment(activeSegmentIndex, { depAddress: initialSegments![activeSegmentIndex].depAddress }))}
                    </label>
                    <input
                      type="text" id="dep-address" value={seg.depAddress}
                      onChange={e => updateSegment(activeSegmentIndex, { depAddress: e.target.value })}
                      placeholder="e.g. Address, or paste a Google Maps link..."
                    />
                    {isDepSearching && depSuggestionsField === 'depAddress' && (
                      <div className="modal-search-loader">Searching...</div>
                    )}
                    {depSearchError && depSuggestionsField === 'depAddress' && (
                      <div style={{ fontSize: '11px', color: 'var(--color-danger, #ef4444)', marginTop: '4px' }}>{depSearchError}</div>
                    )}
                    {depSuggestions.length > 0 && depSuggestionsField === 'depAddress' && (
                      <div className="modal-suggestions-panel">
                        {depSuggestions.map((sug) => (
                          <div
                            key={sug.id}
                            className="modal-suggestion-item"
                            onClick={() => handleSelectSuggestion('dep', sug)}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <div className="modal-suggestion-name">{sug.title}</div>
                            <div className="modal-suggestion-desc">{sug.address || sug.description}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="dep-date" className="place-form-label">
                        <span className="label-text">Departure Date <span style={{ color: 'var(--color-danger)' }}>*</span></span>
                        {undoBtn(seg.depDate, initialSegments?.[activeSegmentIndex]?.depDate, () => updateSegment(activeSegmentIndex, { depDate: initialSegments![activeSegmentIndex].depDate }))}
                      </label>
                      <div className="input-tooltip-wrapper" data-tooltip="Show date picker" data-tooltip-position="bottom">
                        <input
                          type="date" id="dep-date" value={seg.depDate}
                          className={segmentErrors[activeSegmentIndex]?.includes('depDate') ? 'input-field-error' : undefined}
                          onChange={e => {
                            const val = e.target.value;
                            updateSegment(activeSegmentIndex, { depDate: val, arrDate: seg.arrDate < val ? val : seg.arrDate });
                            if (val) clearSegmentError(activeSegmentIndex, 'depDate');
                          }}
                          title=""
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label htmlFor="dep-time" className="place-form-label">
                        <span className="label-text">Departure Time <span style={{ color: 'var(--color-danger)' }}>*</span></span>
                        {undoBtn(seg.depTime, initialSegments?.[activeSegmentIndex]?.depTime, () => updateSegment(activeSegmentIndex, { depTime: initialSegments![activeSegmentIndex].depTime }))}
                      </label>
                      <div className="input-tooltip-wrapper" data-tooltip="Show time picker" data-tooltip-position="bottom">
                        <input
                          type="time" id="dep-time" value={seg.depTime}
                          className={segmentErrors[activeSegmentIndex]?.includes('depTime') ? 'input-field-error' : undefined}
                          onChange={e => { const v = e.target.value; updateSegment(activeSegmentIndex, { depTime: v }); if (v) clearSegmentError(activeSegmentIndex, 'depTime'); }}
                          title=""
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="place-form-label">
                      <span className="label-text">Departure Timezone</span>
                      {undoBtn(seg.depTz, initialSegments?.[activeSegmentIndex]?.depTz, () => updateSegment(activeSegmentIndex, { depTz: initialSegments![activeSegmentIndex].depTz }))}
                    </label>
                    <div className="combo-wrapper">
                      <button
                        ref={depTzTriggerRef}
                        type="button"
                        className="combo-trigger"
                        onClick={() => {
                          if (!depTzOpen && depTzTriggerRef.current) {
                            const r = depTzTriggerRef.current.getBoundingClientRect();
                            setDepTzPos({ top: r.bottom + 4, left: r.left, width: r.width });
                          }
                          setDepTzOpen(o => !o);
                          setDepTzSearch('');
                        }}
                      >
                        <span className="combo-trigger-content">{formatTimezoneLabel(seg.depTz)}</span>
                        <ChevronDown size={14} className={`expand-chevron${depTzOpen ? ' is-open' : ''}`} />
                      </button>
                    </div>
                    {depTzOpen && depTzPos && createPortal(
                      <>
                        <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }} onClick={() => setDepTzOpen(false)} />
                        <div className="combo-dropdown--tz-portal" style={{ top: depTzPos.top, left: depTzPos.left, width: Math.max(depTzPos.width, 260), zIndex: 10000 }} onClick={e => e.stopPropagation()}>
                          <div className="tz-search-wrapper">
                            <input className="tz-search-input" type="text" placeholder="Search timezone…" value={depTzSearch} onChange={e => setDepTzSearch(e.target.value)} autoFocus />
                          </div>
                          <div className="tz-option-list">
                            {filteredDepTz.map(tz => (
                              <button key={tz} type="button" className={`combo-option${seg.depTz === tz ? ' selected' : ''}`} onClick={() => { updateSegment(activeSegmentIndex, { depTz: tz }); setDepTzOpen(false); }}>
                                {formatTimezoneLabel(tz)}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>,
                      document.body
                    )}
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="dep-lat" className="place-form-label">
                        <span className="label-text">Departure Latitude</span>
                        {undoBtn(seg.depLat, initialSegments?.[activeSegmentIndex]?.depLat, () => updateSegment(activeSegmentIndex, { depLat: initialSegments![activeSegmentIndex].depLat }))}
                      </label>
                      <input type="text" id="dep-lat" value={seg.depLat} onChange={e => updateSegment(activeSegmentIndex, { depLat: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label htmlFor="dep-lng" className="place-form-label">
                        <span className="label-text">Departure Longitude</span>
                        {undoBtn(seg.depLng, initialSegments?.[activeSegmentIndex]?.depLng, () => updateSegment(activeSegmentIndex, { depLng: initialSegments![activeSegmentIndex].depLng }))}
                      </label>
                      <input type="text" id="dep-lng" value={seg.depLng} onChange={e => updateSegment(activeSegmentIndex, { depLng: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div className="place-form-right-col">
                  {/* Matches Carrier/Code form-row height; shows Add Segment when single segment */}
                  {segments.length === 1 ? (
                    <div className="form-group transport-add-segment-desktop">
                      <label className="place-form-label"><span className="label-text">&nbsp;</span></label>
                      <button type="button" className="btn-secondary flex-align transport-add-segment-btn transport-add-segment-btn--full" onClick={addSegment}>
                        <Plus size={13} /> Add Segment
                      </button>
                    </div>
                  ) : (
                    <div className="form-group">
                      <label className="place-form-label"><span className="label-text">&nbsp;</span></label>
                      <input type="text" className="transport-segment-spacer" tabIndex={-1} readOnly aria-hidden="true" />
                    </div>
                  )}

                  <div className="form-group form-group--relative" id="arr-loc-container">
                    <label htmlFor="arr-loc" className="place-form-label">
                      <span className="label-text">Arrival Location <span style={{ color: 'var(--color-danger)' }}>*</span></span>
                      {undoBtn(seg.arrLoc, initialSegments?.[activeSegmentIndex]?.arrLoc, () => updateSegment(activeSegmentIndex, { arrLoc: initialSegments![activeSegmentIndex].arrLoc }))}
                    </label>
                    <input
                      type="text" id="arr-loc" value={seg.arrLoc}
                      className={segmentErrors[activeSegmentIndex]?.includes('arrLoc') ? 'input-field-error' : undefined}
                      onChange={e => { const v = e.target.value; updateSegment(activeSegmentIndex, { arrLoc: v }); if (v.trim()) clearSegmentError(activeSegmentIndex, 'arrLoc'); }}
                      placeholder="e.g. LAX Airport, or paste a Google Maps link..."
                    />
                    {isArrSearching && arrSuggestionsField === 'arrLoc' && (
                      <div className="modal-search-loader">Searching...</div>
                    )}
                    {arrSearchError && arrSuggestionsField === 'arrLoc' && (
                      <div style={{ fontSize: '11px', color: 'var(--color-danger, #ef4444)', marginTop: '4px' }}>{arrSearchError}</div>
                    )}
                    {arrSuggestions.length > 0 && arrSuggestionsField === 'arrLoc' && (
                      <div className="modal-suggestions-panel">
                        {arrSuggestions.map((sug) => (
                          <div
                            key={sug.id}
                            className="modal-suggestion-item"
                            onClick={() => handleSelectSuggestion('arr', sug)}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <div className="modal-suggestion-name">{sug.title}</div>
                            <div className="modal-suggestion-desc">{sug.address || sug.description}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="form-group form-group--relative" id="arr-address-container">
                    <label htmlFor="arr-address" className="place-form-label">
                      <span className="label-text">Arrival Address</span>
                      {undoBtn(seg.arrAddress, initialSegments?.[activeSegmentIndex]?.arrAddress, () => updateSegment(activeSegmentIndex, { arrAddress: initialSegments![activeSegmentIndex].arrAddress }))}
                    </label>
                    <input
                      type="text" id="arr-address" value={seg.arrAddress}
                      onChange={e => updateSegment(activeSegmentIndex, { arrAddress: e.target.value })}
                      placeholder="e.g. Address, or paste a Google Maps link..."
                    />
                    {isArrSearching && arrSuggestionsField === 'arrAddress' && (
                      <div className="modal-search-loader">Searching...</div>
                    )}
                    {arrSearchError && arrSuggestionsField === 'arrAddress' && (
                      <div style={{ fontSize: '11px', color: 'var(--color-danger, #ef4444)', marginTop: '4px' }}>{arrSearchError}</div>
                    )}
                    {arrSuggestions.length > 0 && arrSuggestionsField === 'arrAddress' && (
                      <div className="modal-suggestions-panel">
                        {arrSuggestions.map((sug) => (
                          <div
                            key={sug.id}
                            className="modal-suggestion-item"
                            onClick={() => handleSelectSuggestion('arr', sug)}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <div className="modal-suggestion-name">{sug.title}</div>
                            <div className="modal-suggestion-desc">{sug.address || sug.description}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="arr-date" className="place-form-label">
                        <span className="label-text">Arrival Date <span style={{ color: 'var(--color-danger)' }}>*</span></span>
                        {undoBtn(seg.arrDate, initialSegments?.[activeSegmentIndex]?.arrDate, () => updateSegment(activeSegmentIndex, { arrDate: initialSegments![activeSegmentIndex].arrDate }))}
                      </label>
                      <div className="input-tooltip-wrapper" data-tooltip="Show date picker" data-tooltip-position="bottom">
                        <input
                          type="date" id="arr-date" value={seg.arrDate}
                          className={segmentErrors[activeSegmentIndex]?.includes('arrDate') ? 'input-field-error' : undefined}
                          onChange={e => { const v = e.target.value; updateSegment(activeSegmentIndex, { arrDate: v }); if (v) clearSegmentError(activeSegmentIndex, 'arrDate'); }}
                          title=""
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label htmlFor="arr-time" className="place-form-label">
                        <span className="label-text">Arrival Time <span style={{ color: 'var(--color-danger)' }}>*</span></span>
                        {undoBtn(seg.arrTime, initialSegments?.[activeSegmentIndex]?.arrTime, () => updateSegment(activeSegmentIndex, { arrTime: initialSegments![activeSegmentIndex].arrTime }))}
                      </label>
                      <div className="input-tooltip-wrapper" data-tooltip="Show time picker" data-tooltip-position="bottom">
                        <input
                          type="time" id="arr-time" value={seg.arrTime}
                          className={segmentErrors[activeSegmentIndex]?.includes('arrTime') ? 'input-field-error' : undefined}
                          onChange={e => { const v = e.target.value; updateSegment(activeSegmentIndex, { arrTime: v }); if (v) clearSegmentError(activeSegmentIndex, 'arrTime'); }}
                          title=""
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="place-form-label">
                      <span className="label-text">Arrival Timezone</span>
                      {undoBtn(seg.arrTz, initialSegments?.[activeSegmentIndex]?.arrTz, () => updateSegment(activeSegmentIndex, { arrTz: initialSegments![activeSegmentIndex].arrTz }))}
                    </label>
                    <div className="combo-wrapper">
                      <button
                        ref={arrTzTriggerRef}
                        type="button"
                        className="combo-trigger"
                        onClick={() => {
                          if (!arrTzOpen && arrTzTriggerRef.current) {
                            const r = arrTzTriggerRef.current.getBoundingClientRect();
                            setArrTzPos({ top: r.bottom + 4, left: r.left, width: r.width });
                          }
                          setArrTzOpen(o => !o);
                          setArrTzSearch('');
                        }}
                      >
                        <span className="combo-trigger-content">{formatTimezoneLabel(seg.arrTz)}</span>
                        <ChevronDown size={14} className={`expand-chevron${arrTzOpen ? ' is-open' : ''}`} />
                      </button>
                    </div>
                    {arrTzOpen && arrTzPos && createPortal(
                      <>
                        <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }} onClick={() => setArrTzOpen(false)} />
                        <div className="combo-dropdown--tz-portal" style={{ top: arrTzPos.top, left: arrTzPos.left, width: Math.max(arrTzPos.width, 260), zIndex: 10000 }} onClick={e => e.stopPropagation()}>
                          <div className="tz-search-wrapper">
                            <input className="tz-search-input" type="text" placeholder="Search timezone…" value={arrTzSearch} onChange={e => setArrTzSearch(e.target.value)} autoFocus />
                          </div>
                          <div className="tz-option-list">
                            {filteredArrTz.map(tz => (
                              <button key={tz} type="button" className={`combo-option${seg.arrTz === tz ? ' selected' : ''}`} onClick={() => { updateSegment(activeSegmentIndex, { arrTz: tz }); setArrTzOpen(false); }}>
                                {formatTimezoneLabel(tz)}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>,
                      document.body
                    )}
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="arr-lat" className="place-form-label">
                        <span className="label-text">Arrival Latitude</span>
                        {undoBtn(seg.arrLat, initialSegments?.[activeSegmentIndex]?.arrLat, () => updateSegment(activeSegmentIndex, { arrLat: initialSegments![activeSegmentIndex].arrLat }))}
                      </label>
                      <input type="text" id="arr-lat" value={seg.arrLat} onChange={e => updateSegment(activeSegmentIndex, { arrLat: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label htmlFor="arr-lng" className="place-form-label">
                        <span className="label-text">Arrival Longitude</span>
                        {undoBtn(seg.arrLng, initialSegments?.[activeSegmentIndex]?.arrLng, () => updateSegment(activeSegmentIndex, { arrLng: initialSegments![activeSegmentIndex].arrLng }))}
                      </label>
                      <input type="text" id="arr-lng" value={seg.arrLng} onChange={e => updateSegment(activeSegmentIndex, { arrLng: e.target.value })} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile-only: Add Segment below arrival info, before map/notes */}
              {segments.length === 1 && (
                <div className="transport-add-segment-mobile">
                  <button type="button" className="btn-secondary flex-align transport-add-segment-btn" onClick={addSegment}>
                    <Plus size={13} /> Add Segment
                  </button>
                </div>
              )}

              {/* Map + Undo AI Fill (left) | Notes + Attachments (right) */}
              <div className="place-form-grid">
                <div className="place-form-left-col">
                  <div className="form-group form-group--mb16">
                    <label className="place-form-label">
                      <MapPin size={13} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                      <span className="label-text">Click on the map to set coordinates</span>
                    </label>
                    <DualMapPicker
                      segments={segments.map(s => ({
                        depLat: parseFloat(s.depLat),
                        depLng: parseFloat(s.depLng),
                        arrLat: parseFloat(s.arrLat),
                        arrLng: parseFloat(s.arrLng),
                      }))}
                      activeIndex={activeSegmentIndex}
                      onDepPick={(lat, lng) => updateSegment(activeSegmentIndex, { depLat: lat.toFixed(6), depLng: lng.toFixed(6) })}
                      onArrPick={(lat, lng) => updateSegment(activeSegmentIndex, { arrLat: lat.toFixed(6), arrLng: lng.toFixed(6) })}
                    />
                  </div>
                </div>

                <div className="place-form-right-col">
                  <div className="form-group">
                    <label htmlFor="transit-notes" className="place-form-label">
                      <span className="label-text">Notes</span>
                      {undoBtn(notes, savedValues?.notes, () => setNotes(savedValues!.notes))}
                    </label>
                    <textarea id="transit-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Booking reference, details, ..." rows={2} />
                  </div>

                  <ExpensesSection
                    expenses={expenses}
                    onChange={setExpenses}
                  />

                  {googleToken && (
                    <div className="attachment-section">
                      <div className="attachment-header-row">
                        <span className="attachment-section-label">Attachments</span>
                        <div className="attachment-header-actions">
                          {attachedFiles.length > 0 && (
                            <button
                              type="button"
                              className="modal-ai-fill-btn modal-ai-fill-btn--inline"
                              onClick={handleAiFill}
                              disabled={isAiFilling || !GeminiService.isAiEnabled() || GeminiService.isManualMode()}
                              data-tooltip={
                                !GeminiService.isAiEnabled() ? AI_NOT_CONFIGURED_MESSAGE :
                                GeminiService.isManualMode() ? AI_FILE_CONTENTS_NOT_AVAILABLE_IN_MANUAL_MODE_MESSAGE :
                                undefined
                              }
                              data-tooltip-position="bottom"
                            >
                              {isAiFilling ? <RefreshCw size={13} className="spin" /> : <Sparkles size={13} />}
                              {isAiFilling ? 'Generating…' : 'Fill Details with AI'}
                            </button>
                          )}
                          <button type="button" className="mini-icon-btn flex-align" onClick={() => fileInputRef.current?.click()} disabled={uploadingCount > 0}>
                            <Paperclip size={13} />
                            {uploadingCount > 0 ? 'Uploading…' : 'Attach Files'}
                          </button>
                        </div>
                      </div>
                      {isOwner && tripDriveFileId && (
                        <p className="attachment-share-notice">
                          For shared users to access attachments, share the trip folder with them.
                          {tripFilesFolderId && (
                            <button type="button" className="attachment-share-btn" onClick={() => setShowShareFolder(true)}>
                              <Share2 size={11} /> Share Folder
                            </button>
                          )}
                        </p>
                      )}
                      <input ref={fileInputRef} type="file" multiple accept="image/*,application/pdf,.eml,.txt" className="visually-hidden" onChange={handleFileSelect} />
                      {attachedFiles.length > 0 && (
                        <div className="attachment-chip-list">
                          {attachedFiles.map(f => (
                            <span key={f.fileId} className="attachment-chip">
                              {editingChip?.fileId === f.fileId ? (
                                <>
                                  <input
                                    className="attachment-chip-edit-input"
                                    value={editingChip.value}
                                    onChange={e => setEditingChip({ fileId: f.fileId, value: e.target.value })}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') { renameAttachment(f.fileId, editingChip.value.trim() || (f.filename ?? f.name)); setEditingChip(null); }
                                      if (e.key === 'Escape') setEditingChip(null);
                                    }}
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    className="attachment-chip-action"
                                    onClick={() => { renameAttachment(f.fileId, editingChip.value.trim() || (f.filename ?? f.name)); setEditingChip(null); }}
                                    data-tooltip="Save name"
                                  >
                                    <Check size={10} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <a
                                    href={`https://drive.google.com/file/d/${f.fileId}/view`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="attachment-chip-name"
                                    data-tooltip={f.filename && f.filename !== f.name ? f.filename : 'Open file'}
                                  >
                                    <ExternalLink size={10} />
                                    <span className="attachment-chip-filename">{f.name}</span>
                                  </a>
                                  <button
                                    type="button"
                                    className="attachment-chip-action"
                                    onClick={() => setEditingChip({ fileId: f.fileId, value: f.name })}
                                    data-tooltip="Rename file"
                                  >
                                    <Pencil size={10} />
                                  </button>
                                  <button type="button" className="attachment-chip-remove" onClick={() => handleRemoveChip(f)} data-tooltip="Remove file">
                                    <X size={10} />
                                  </button>
                                </>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                      {aiError && <p className="form-error-text">{aiError}</p>}
                    </div>
                  )}
                  {!googleToken && aiError && <p className="form-error-text">{aiError}</p>}
                </div>
              </div>

            </div>

            <div className="modal-actions modal-actions--between">
              {onDelete && editingTransport && (
                <button type="button" className="btn-danger flex-align" onClick={onDelete}>
                  <Trash2 size={14} /><span>Delete<span className="desktop-only"> Transit</span></span>
                </button>
              )}
              <div className="modal-actions-right">
                <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn-primary">{editingTransport ? <><span>Save</span><span className="desktop-only"> Transit</span></> : 'Add Transit'}</button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {showShareFolder && googleToken && tripFilesFolderId && (
        <ShareTripModal
          accessToken={googleToken}
          folderId={tripFilesFolderId}
          folderDisplayName={tripName ? `${tripName}_files` : tripFilesFolderId}
          onClose={() => setShowShareFolder(false)}
        />
      )}

      {showAccessError && (
        <ConfirmationModal
          isOpen={true}
          isAlert={true}
          title="Cannot Upload File"
          message="You don't have write access to this trip's folder. Please ask the trip owner to share the trip folder with you."
          onConfirm={() => setShowAccessError(false)}
          onCancel={() => setShowAccessError(false)}
        />
      )}

      {removePrompt && (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => setRemovePrompt(null)}>
          <div className="modal-content glass-panel" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Remove File</h3>
              <button className="modal-close" onClick={() => setRemovePrompt(null)}><X size={20} /></button>
            </div>
            <p className="modal-body-text">What should happen to <strong>{removePrompt.name}</strong> on Google Drive?</p>
            <div className="modal-actions modal-actions--column">
              <button className="btn-danger" onClick={() => confirmRemoveChip('delete')}><Trash2 size={14} /> Delete from Drive</button>
              <button className="btn-secondary" onClick={() => confirmRemoveChip('archive')}>Archive on Drive (rename with [Archived])</button>
              <button className="btn-secondary" onClick={() => confirmRemoveChip('keep')}>Keep on Drive, remove link only</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
