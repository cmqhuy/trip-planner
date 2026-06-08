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
}

export interface Transportation {
  id: string;
  type: 'flight' | 'train' | 'bus' | 'car' | 'ferry' | 'other';
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
}

export interface Hotel {
  id: string;
  name: string;
  address?: string;
  checkInDate: string;  // YYYY-MM-DD
  checkOutDate: string; // YYYY-MM-DD
  notes?: string;
}

export interface PlanDay {
  dateStr: string; // YYYY-MM-DD
  locationId?: string; // Reference to Location.id (where the day ends)
  placeIds: string[];  // Scheduled places on this day
}

export interface Plan {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  days: { [dateStr: string]: PlanDay };
  hotels: Hotel[];
  transports: Transportation[];
}

export interface Trip {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  locations: Location[];
  plans: Plan[];
  placeGroups: PlaceGroup[]; // Trip-level categorized lists / place groups
  updatedAt?: number;        // Timestamp of last modification
  driveFileId?: string;      // Google Drive file ID
  ownerEmail?: string;       // Email of the owner
  isOwner?: boolean;         // True if the current user is the owner
  canEdit?: boolean;         // True if the current user has edit permission
  shared?: boolean;          // True if the trip is shared with others
}
