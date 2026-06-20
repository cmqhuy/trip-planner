export interface Attachment {
  fileId: string;
  filename?: string; // original Drive filename
  name: string;      // user-customizable display name
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

export interface Transportation {
  id: string;
  type: 'flight' | 'train' | 'bus' | 'car' | 'ferry' | 'other';
  name?: string;
  departureLocationName: string;
  arrivalLocationName: string;
  departureDate: string;        // YYYY-MM-DD
  departureTime: string;        // HH:MM
  departureTimezone: string;    // e.g. "GMT+1" or "America/New_York"
  arrivalDate: string;          // YYYY-MM-DD
  arrivalTime: string;          // HH:MM
  arrivalTimezone: string;      // e.g. "GMT+9" or "Asia/Tokyo"
  carrier?: string;
  transitCode?: string;
  notes?: string;
  confirmationNo?: string;
  bookedThrough?: string;
  price?: number;
  currency?: string;
  departureAddress?: string;
  departureLat?: number;
  departureLng?: number;
  arrivalAddress?: string;
  arrivalLat?: number;
  arrivalLng?: number;
  attachments?: Attachment[];
  status?: 'Confirmed' | 'Planning' | 'Canceled';
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
  price?: number;
  currency?: string;
  lat?: number;
  lng?: number;
  attachments?: Attachment[];
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

export type ScheduleItem = SchedulePlaceItem | ScheduleNoteItem;

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
  transports: Transportation[];
  manualChecklist?: { id: string; text: string; completed: boolean; }[];
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
  schemaVersion?: number;    // Incremented when the data model changes; used to skip no-op migrations
  updatedAt?: number;        // Timestamp of last modification
  driveFileId?: string;      // Google Drive file ID
  shadowFileId?: string;     // Google Drive file ID of the shadow file (for shared users)
  filesFolderId?: string;    // Google Drive folder ID for this trip's uploaded attachment files
  isShadow?: boolean;        // True if this is a shadow file pointing to another user's shared file
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
