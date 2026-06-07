# AI & Development Guidelines (GEMINI.md)

This file contains codebase context, rules, tech stack overview, key directory structures, state layout, and standard operating procedures to speed up development and save on token usage.

---

## 🛠️ Technology Stack
- **Frontend Core**: React 19, TypeScript, Vite
- **Styling**: Vanilla CSS with unified variables (dark theme, glassmorphism UI)
- **Map Library**: Leaflet (via custom `MapComponent` and `MapPicker` wrappers)
- **Icons**: Lucide React
- **Testing**: Vitest (`npm.cmd run test`)

---

## 📂 Project Directory Structure

```
trip-planner/
├── src/
│   ├── components/
│   │   ├── TripDashboard.tsx   # Dashboard listing trips, allowing trip creation & deletion
│   │   ├── TripPlanner.tsx     # Main application workspace (Catalog, Timeline, Modals, State)
│   │   ├── MapComponent.tsx    # Leaflet-based map displaying places and route sequences
│   │   └── MapPicker.tsx       # Leaflet-based interactive mini-map for lat/lng picking in modals
│   ├── utils/
│   │   ├── api.ts              # Nominatim geocoding & Wikipedia API queries
│   │   ├── dateUtils.ts        # Helper functions for date difference, shifting, and ranges
│   │   └── dateUtils.test.ts   # Unit tests for date utilities
│   ├── types.ts                # TypeScript interfaces defining the entire state model
│   ├── App.tsx                 # Base entry point managing Trip selection & LocalStorage sync
│   ├── index.css               # Main styling rules, CSS variables, and animation keyframes
│   ├── App.css                 # Minor global overrides
│   └── main.tsx                # App bootstrap
```

---

## 💾 Data Storage & Schema (`src/types.ts`)

All data is stored in the browser's `localStorage` under the key:
**`vacation-itineraries`**

The payload structure is `Trip[]`. Below is the schema representation:

```typescript
export interface Place {
  id: string;            // OSM ID or custom ID
  title: string;
  description: string;
  openingHours?: string;
  photoUrl?: string;
  lat: number;
  lng: number;
  placeGroupId?: string; // Links to PlaceGroup.id or 'new' or undefined
  notes?: string;        // Notes (shared across all plans in the trip)
  mapsLink?: string;     // Custom Google Maps link (name-based search preferred)
}

export interface PlaceGroup {
  id: string;
  name: string;
  color: string;         // hex or HSL color representation
  icon: string;          // icon key
}

export interface Location {
  id: string;            // OSM ID or custom ID
  city: string;
  state?: string;
  country: string;
  countryCode?: string;  // 2-letter ISO code (used for flag emojis)
  heroPhoto?: string;
  lat: number;
  lng: number;
  places: Place[];
  color?: string;        // Theme color override for color-coded map markers/lines
}

export interface Transportation {
  id: string;
  type: 'flight' | 'train' | 'bus' | 'car' | 'ferry' | 'other';
  departureLocationName: string;
  arrivalLocationName: string;
  departureDate: string;        // YYYY-MM-DD
  departureTime: string;        // HH:MM
  departureTimezone: string;    // e.g. "GMT+1"
  arrivalDate: string;          // YYYY-MM-DD
  arrivalTime: string;          // HH:MM
  arrivalTimezone: string;      // e.g. "GMT+9"
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
  dateStr: string;      // YYYY-MM-DD
  locationId?: string;  // Reference to Location.id (where the day ends)
  placeIds: string[];   // Scheduled places on this day
}

export interface Plan {
  id: string;
  name: string;
  startDate: string;    // YYYY-MM-DD
  endDate: string;      // YYYY-MM-DD
  days: { [dateStr: string]: PlanDay };
  hotels: Hotel[];
  transports: Transportation[];
}

export interface Trip {
  id: string;
  name: string;
  startDate: string;    // YYYY-MM-DD
  endDate: string;      // YYYY-MM-DD
  locations: Location[];
  plans: Plan[];
  placeGroups: PlaceGroup[]; // Trip-level categories/groups
}
```

---

## ⚠️ Data Storage Rules & Backward Compatibility

> [!IMPORTANT]
> **Backward Compatibility Requirement**
> Any changes to the data storage schemas (`src/types.ts` and serialization keys) **MUST** be backward compatible to protect existing user trips.

### Guidelines for Extending Data Storage:
1. **Prefer Optional Fields**: When adding properties to interfaces, mark them as optional (`?`) so that existing JSON objects load without breaking.
2. **Assign Fallbacks on Read**: Provide a default value/fallback when rendering or accessing properties that might be undefined in older user data.
3. **Write Migration / Sanitization Logic**: If fields are restructured or non-optional fields must be introduced, add a migration parser inside the mount `useEffect` in [App.tsx](file:///d:/OneDrive/Documents/Projects/trip-planner/src/App.tsx) when loading from LocalStorage.
4. **Breaking Changes Restriction**: If a schema change cannot be made backward compatible:
   - **Do not apply the change immediately.**
   - Notify the user, outline the breaking implications, and request explicit suggestions or approval before proceeding.

---

## 🎨 Visual & Design System Guidelines
The application uses a futuristic, glassmorphism dark theme. Keep the following tokens and rules in mind when styling:

- **Typography**: Clean, responsive layout fonts.
- **Glassmorphism**: Combine translucent backgrounds (`rgba(255, 255, 255, 0.03)`) with glass border borders (`1px solid rgba(255, 255, 255, 0.08)`) and high blur filter backdrop filters (`backdrop-filter: blur(12px)`).
- **Core CSS Variables** (defined in [index.css](file:///d:/OneDrive/Documents/Projects/trip-planner/src/index.css)):
  - `--bg-dark`: Dark background color (`#0b0f19`)
  - `--bg-panel`: Glassmorphic panel background (`rgba(17, 24, 39, 0.6)`)
  - `--accent-primary`: Vibrant accent color (`#6366f1` Indigo)
  - `--text-primary`: Pure text (`#f3f4f6`)
  - `--text-muted`: Dimmed subtitles (`#9ca3af`)
  - `--border-glass`: Universal glass border (`rgba(255, 255, 255, 0.08)`)

---

## 💻 Environment Commands (Windows Specific)

To avoid execution policy script issues in PowerShell on Windows, run commands using the `.cmd` suffix for npm binaries:

- **Start Dev Server**:
  ```powershell
  npm.cmd run dev
  ```
- **Build Client Bundle**:
  ```powershell
  npm.cmd run build
  ```
- **Execute Vitest Unit Tests**:
  ```powershell
  npm.cmd run test
  ```
