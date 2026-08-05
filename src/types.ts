export interface Attachment {
  fileId: string;
  filename?: string; // original Drive filename
  name: string;      // user-customizable display name
}

export interface ExpenseLine {
  id: string;
  description: string;
  price: number;
  currency: string;
  paid: boolean;
}

/**
 * One place's AI-generated details, exactly as the model returns them.
 *
 * `id` correlates the entry back to the place that was requested, and
 * `suggestedMarkers` is lifted onto `Place` as a sibling of `aiDetails`. Every
 * remaining key is an AI field key — one of the 7 built-ins or a user-defined
 * entry in `Trip.customAiFields` — so the set is configuration, not something
 * this interface can enumerate.
 */
export interface AiPlaceDetailsUpdate {
  suggestedMarkers?: SuggestedMarker[];
  [fieldKey: string]: string | SuggestedMarker[] | undefined;
}

/** As above, plus the `id` correlating the entry back to the requested place. */
export interface AiPlaceDetailsResult extends AiPlaceDetailsUpdate {
  id: string;
}

export interface SuggestedMarker {
  title: string;
  lat: number;
  lng: number;
  description: string;
  type: string; // e.g. 'street' | 'landmark' | 'shop' | 'station' | 'cafe' | 'other'
}

export interface Place {
  id: string; // OSM ID or custom ID
  title: string;
  description: string;
  openingHours?: string;
  photoUrl?: string;
  lat: number;
  lng: number;
  placeGroupId?: string; // Links to PlaceGroup.id or 'new' or undefined
  notes?: string;        // Notes are shared across all plans in the trip
  mapsLink?: string;     // Optional custom Google Maps link
  aiDetails?: {
    [key: string]: string;
  };
  aiUpdatedAt?: number; // Timestamp when AI details were populated/updated
  suggestedMarkers?: SuggestedMarker[];
}

/**
 * A Place carrying the transient flags the day-schedule preview row reads.
 *
 * Never persisted: TripPlanner prepends one synthesized entry to the displayed
 * place list while a catalog place is selected, so the timeline can show where
 * it would land before the user commits to adding it.
 */
export interface PreviewPlace extends Place {
  isTemporary?: boolean;
  isAiSuggestion?: boolean;
}

export interface PlaceGroup {
  id: string;
  name: string;
  color: string; // hex or HSL color representation
  icon: string;  // icon key
}

export interface Location {
  id: string; // OSM ID or custom ID
  city: string;
  state?: string;
  country: string;
  countryCode?: string; // 2-letter ISO code
  heroPhoto?: string;
  lat: number;
  lng: number;
  places: Place[];
  color?: string; // Hex color for color coding
  aiDetails?: {
    [key: string]: string;
  };
  aiUpdatedAt?: {
    [key: string]: number;
  };
}

// Transportation — a single departure→arrival leg within a TransportationReservation
export interface Transportation {
  id: string;
  carrier?: string;
  transitCode?: string;
  departureLocationName: string;
  departureAddress?: string;
  departureDate: string;        // YYYY-MM-DD
  departureTime: string;        // HH:MM
  departureTimezone: string;    // e.g. "GMT+1" or "America/New_York"
  departureLat?: number;
  departureLng?: number;
  arrivalLocationName: string;
  arrivalAddress?: string;
  arrivalDate: string;          // YYYY-MM-DD
  arrivalTime: string;          // HH:MM
  arrivalTimezone: string;      // e.g. "GMT+9" or "Asia/Tokyo"
  arrivalLat?: number;
  arrivalLng?: number;
}

// TransportationReservation — booking-level container for one or more transit legs
export interface TransportationReservation {
  id: string;
  type: 'flight' | 'train' | 'bus' | 'car' | 'ferry' | 'other';
  name?: string;
  confirmationNo?: string;
  bookedThrough?: string;
  notes?: string;
  status?: 'Confirmed' | 'Planning' | 'Canceled';
  attachments?: Attachment[];
  expenses?: ExpenseLine[];
  segments: Transportation[];  // always length >= 1
}

// FlatTransportationSegment — view model for display components.
// One Transportation merged with its parent TransportationReservation's shared fields.
export interface FlatTransportationSegment extends Transportation {
  reservationId: string;
  segmentIndex: number;
  totalSegments: number;
  type: TransportationReservation['type'];
  reservationName?: string;
  confirmationNo?: string;
  bookedThrough?: string;
  notes?: string;
  status?: TransportationReservation['status'];
  attachments?: Attachment[];
  expenses?: ExpenseLine[];
}

export function flattenReservations(reservations: TransportationReservation[]): FlatTransportationSegment[] {
  return reservations.flatMap((r, _ri) =>
    r.segments.map((seg, idx) => ({
      ...seg,
      reservationId: r.id,
      segmentIndex: idx,
      totalSegments: r.segments.length,
      type: r.type,
      reservationName: r.name,
      confirmationNo: r.confirmationNo,
      bookedThrough: r.bookedThrough,
      notes: r.notes,
      status: r.status,
      attachments: r.attachments,
      expenses: r.expenses,
    }))
  );
}

export interface Hotel {
  id: string;
  name: string;
  address?: string;
  checkInDate: string;  // YYYY-MM-DD
  checkInTime?: string; // HH:MM
  checkOutDate: string; // YYYY-MM-DD
  checkOutTime?: string; // HH:MM
  notes?: string;
  confirmationNo?: string;
  bookedThrough?: string;
  lat?: number;
  lng?: number;
  attachments?: Attachment[];
  expenses?: ExpenseLine[];
  status?: 'Confirmed' | 'Planning' | 'Canceled';
}

export interface SchedulePlaceItem {
  type: 'place';
  placeId: string;
}

export interface ScheduleNoteItem {
  type: 'note';
  id: string;
  text: string;
}

export interface ScheduleHotelEventItem {
  type: 'hotel-event';
  hotelId: string;
  event: 'check-in' | 'check-out';
  time?: string; // HH:MM — user-editable, pre-populated from hotel.checkInTime/checkOutTime
}

export interface ScheduleTransitEventItem {
  type: 'transit-event';
  reservationId: string;
  segmentIndex: number;
  event: 'departure' | 'arrival';
  time?: string; // HH:MM — user-editable, pre-populated from segment.departureTime/arrivalTime
}

export interface SchedulePlaceReservationEventItem {
  type: 'place-reservation-event';
  reservationId: string;
  time?: string; // HH:MM
}

export type ScheduleItem = SchedulePlaceItem | ScheduleNoteItem | ScheduleHotelEventItem | ScheduleTransitEventItem | SchedulePlaceReservationEventItem;

export interface ExpenseGroup {
  id: string;
  name: string;
  icon: string; // Lucide icon key
  color?: string; // hex representation
}

export interface ReservationGroup {
  id: string;
  name: string;
  icon: string; // Lucide icon key
  color?: string; // hex representation
}

export interface PlaceReservation {
  id: string;
  type: 'attraction' | 'dining';
  placeId?: string;       // Optional linked catalog place ID
  title: string;
  date?: string;          // YYYY-MM-DD
  time?: string;          // HH:MM
  address?: string;
  lat?: number;
  lng?: number;
  confirmationNo?: string;
  bookedThrough?: string;
  notes?: string;
  status?: 'Confirmed' | 'Planning' | 'Canceled';
  attachments?: Attachment[];
  expenses?: ExpenseLine[];
}

export interface GenericReservation {
  id: string;
  title: string;
  groupId: string;
  date?: string;           // YYYY-MM-DD
  time?: string;           // HH:MM
  confirmationNo?: string;
  bookedThrough?: string;
  notes?: string;
  status?: 'Confirmed' | 'Planning' | 'Canceled';
}

export interface ExpenseItem {
  id: string;
  title: string;
  notes?: string;
  date?: string; // YYYY-MM-DD, optional/custom
  groupId: string; // Links to ExpenseGroup.id
  linkedReservationId?: string; // Links to Hotel.id, TransportationReservation.id, or PlaceReservation.id
  linkedReservationType?: 'hotel' | 'transit' | 'place' | 'generic';
  lineItems: ExpenseLine[];
}

export interface PlanDay {
  dateStr: string; // YYYY-MM-DD
  locationId?: string; // Reference to Location.id (where the day ends)
  placeIds: string[];  // Kept in sync with scheduleItems (derived); used for backward compat
  scheduleItems?: ScheduleItem[]; // Unified ordered list of all schedule items
  aiDetails?: {
    [key: string]: string;
  };
  aiUpdatedAt?: number;
  noHotel?: boolean;
}

export interface Plan {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  days: { [dateStr: string]: PlanDay };
  hotels: Hotel[];
  transports: TransportationReservation[];
  placeReservations?: PlaceReservation[];
  manualChecklist?: { id: string; text: string; completed: boolean; }[];
  expenseGroups?: ExpenseGroup[];
  expenses?: ExpenseItem[];
  reservationGroups?: ReservationGroup[];
  genericReservations?: GenericReservation[];
  aiDetails?: {
    [key: string]: string;
  };
  aiUpdatedAt?: {
    [key: string]: number;
  };
}

export interface Trip {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  locations: Location[];
  plans: Plan[];
  placeGroups: PlaceGroup[]; // Trip-level categorized lists / place groups
  hiddenMapGroupIds?: string[]; // placeGroup ids hidden from the map's background/shadow layer (default: all visible)
  schemaVersion?: number;    // Incremented when the data model changes; used to skip no-op migrations
  updatedAt?: number;        // Timestamp of last modification
  driveFileId?: string;      // Google Drive file ID
  shadowFileId?: string;     // Google Drive file ID of the shadow file (for shared users)
  filesFolderId?: string;    // Google Drive folder ID for this trip's uploaded attachment files
  isShadow?: boolean;        // True if this is a shadow file pointing to another user's shared file
  realDriveFileId?: string;  // Only on a shadow pointer file: the owner's real trip file to read through to
  ownerEmail?: string;       // Email of the owner
  isOwner?: boolean;         // True if the current user is the owner
  canEdit?: boolean;         // True if the current user has edit permission
  shared?: boolean;          // True if the trip is shared with others
  disabledPlaceFields?: string[];
  disabledDayFields?: string[];
  fieldIcons?: { [key: string]: string };
  placeFieldsOrder?: string[];
  customAiFields?: { title: string; key: string; description: string; icon?: string; disabled?: boolean; }[];
  aiDetails?: {
    [key: string]: string;
  };
  aiUpdatedAt?: {
    [key: string]: number;
  };
}
