# AI & Development Guidelines

Codebase context, design guidelines, state layout, and developer SOPs for the Trip Planner application.

---

## Technology Stack

- **Frontend**: React 19, TypeScript, Vite (Oxc transpiler, base path `/trip-planner/`)
- **Styling**: Vanilla CSS with unified CSS variables — dark glassmorphism theme, no CSS-in-JS or Tailwind
- **Map**: Leaflet via `MapComponent` (display) and `MapPicker` (coordinate selection in modals)
- **Icons**: Lucide React
- **Testing**: Vitest + jsdom + @testing-library/react

---

## Commands

> **Windows PowerShell requires the `.cmd` suffix on npm binaries.**

| Task | Command |
|---|---|
| Start dev server | `npm.cmd run dev` |
| Production build | `npm.cmd run build` |
| Lint | `npm.cmd run lint` |
| Run all tests | `npm.cmd run test` |
| Preview production build | `npm.cmd run preview` |

Tests are co-located next to source files as `[module].test.ts` / `[component].test.tsx`. To run a single file, append its path: `npm.cmd run test src/utils/ai.test.ts`.

---

## Project Directory Structure

```
trip-planner/
├── src/
│   ├── components/       # UI Components & extracted reusable dialogs
│   │   ├── TripDashboard.tsx      # Landing screen: trip list, creation, deletion, import
│   │   ├── TripPlanner.tsx        # Main workspace: catalog, timeline, map, all dialogs
│   │   ├── MapComponent.tsx       # Leaflet map displaying places and route sequences
│   │   ├── MapPicker.tsx          # Interactive mini-map for lat/lng picking in modals
│   │   ├── ConfirmationModal.tsx  # Reusable glassmorphic alert/confirm dialog
│   │   ├── ItineraryPanel.tsx     # Day schedule, hotels, transits, place mapping
│   │   ├── CatalogSection.tsx     # Place management, group categorization, list views
│   │   ├── ChecklistSection.tsx   # Manual to-dos with drag-and-drop reordering
│   │   ├── GoogleAuthSection.tsx  # Google Drive auth status and sync controls
│   │   ├── ShareTripModal.tsx     # Sharing trips with viewer permissions
│   │   ├── SyncConflictModal.tsx  # Resolves local vs. Drive copy conflicts
│   │   ├── TripAiConfigModal.tsx  # Enable/disable, reorder, and add custom AI fields
│   │   ├── AiDetailsView.tsx      # Renders generated AI advice for places
│   │   ├── AiMarkdownSection.tsx  # Displays markdown AI sections with custom styling
│   │   ├── LeftPanelAccordion.tsx # Accordion: checklist, reservations, tips
│   │   └── *Modal.tsx / *FormFields.tsx  # Creation/edit dialogs (Hotel, Transport, Location, Group, Place)
│   ├── utils/
│   │   ├── ai.ts          # GeminiService class, prompt design, custom AI fields
│   │   ├── api.ts         # Geocoding (OSM Nominatim, Photon), default place groups
│   │   ├── dateUtils.ts   # Formatting, date range calculations
│   │   ├── googleDrive.ts # Drive folder management, file sync, silent re-auth, shadow files
│   │   └── image.ts       # Wikimedia Commons image queries
│   ├── types.ts           # TypeScript interfaces for the entire state model — read this first
│   ├── App.tsx            # Root: trip list, Google auth, Gemini settings, localStorage sync
│   └── index.css          # All styling: CSS variables, glassmorphism rules, animation keyframes
```

---

## Architecture

### State & Entry Points

There is no global state library. All state lives in **`App.tsx`** (~1,175 lines) and flows down as props — no React Context.

- **`App.tsx`** — manages trip array, auth tokens, Gemini settings, sync timestamps, modal flags, and localStorage hydration/migration on mount.
- **`TripPlanner.tsx`** — the main workspace once a trip is selected.
- **`TripDashboard.tsx`** — trip list landing screen.
- **`types.ts`** — single source of truth for all interfaces. Read before touching data models.

### Data Storage & LocalStorage Keys

All user data is stored in `localStorage` and optionally synced to Google Drive.

| Key | Content |
|---|---|
| `vacation-itineraries` | `Trip[]` — the entire dataset |
| `vacation-itineraries-sync-timestamps` | `{ [tripId]: epochMs }` — conflict detection |
| `vacation-itineraries-gemini-api-keys` | `string[]` — rotated Gemini keys |
| `vacation-itineraries-gemini-model` | Active model name (default: `gemini-2.5-flash`) |
| `vacation-itineraries-gemini-sync-drive` | Boolean — sync AI settings to Drive |
| `google-access-token` / `google-token-expires-at` / `google-user` | OAuth session |
| `google-folder-id` | ID of the `Trip Planner` Drive folder |

### Core Data Models

Refer to `src/types.ts` for full detail:

- **`Trip`** — root container: locations, plans, custom AI fields, field order preferences, Drive sharing fields (`driveFileId`, `shadowFileId`, `isShadow`, `ownerEmail`).
- **`Location`** — city/country with coordinate pair containing `Place[]`.
- **`Place`** — POI with coordinates, `placeGroupId`, shared note, and AI fields.
- **`Plan`** — itinerary version with `PlanDay[]`, hotels, transports, checklists.
- **`PlanDay`** — maps a date to place IDs and AI daily tips.

### Google Drive Sync

- All logic in `src/utils/googleDrive.ts`.
- Trips are individual JSON files inside a `Trip Planner` Drive folder.
- **Shadow files** (`isShadow: true`) — shared trips: viewers sync from the owner's file but cannot overwrite it.
- Conflict detection compares `updatedAt` timestamps; `SyncConflictModal` resolves via merge, keep-local, or take-cloud.

### AI Integration

`src/utils/ai.ts` — `GeminiService` class calling the Gemini REST API directly via `fetch`:

```
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
```

Key behaviors:
- **Structured JSON output**: all generation uses `responseMimeType: application/json` + `responseSchema`.
- **Key rotation**: multiple keys tried in sequence on failure; updated order persisted to localStorage.
- **Result caching**: stored in `aiDetails: { [fieldKey]: string }` and `aiUpdatedAt` directly on `Trip`, `Location`, `Place`, `Plan`, and `PlanDay` — no separate cache layer.
- **Custom fields**: `Trip.customAiFields` defines user-added fields. `getOrderedPlaceFields()` in `ai.ts` resolves the active ordered list.
- **Suggested markers**: large areas generate nested `suggestedMarkers` (lat/lng + type) rendered as child map pins.

The 7 built-in place fields: `what_special`, `best_time`, `reservation`, `directions`, `area_guide`, `pro_tips`, `other_info`.

External APIs (no keys required): OSM Nominatim (geocoding), Photon/Komoot (place search), Wikipedia/Wikimedia Commons (descriptions and images).

---

## Schema Rules

> **All schema changes MUST be backward compatible.**

- New fields on interfaces must be optional (`?`).
- Provide defaults/fallbacks wherever new fields are read.
- If restructuring existing fields, add a one-time migration in the `localStorage` mount `useEffect` in `App.tsx`.

---

## Design System

Glassmorphism dark theme. Key CSS variables from `index.css`:

| Variable | Value |
|---|---|
| `--bg-dark` | `#0b0f19` |
| `--bg-panel` | `rgba(17, 24, 39, 0.6)` |
| `--accent-primary` | `#6366f1` (indigo) |
| `--border-glass` | `rgba(255, 255, 255, 0.08)` |

**Glassmorphism rule**: `background: rgba(255,255,255,0.03)`, `border: 1px solid rgba(255,255,255,0.08)`, `backdrop-filter: blur(12px)`.

### Shared Layout Classes

**Left panel accordion subsections** (checklist, transit, tips):
- `.left-panel-subsection` → `.subsection-header` / `.subsection-title` / `.subsection-subtitle` / `.subsection-actions` / `.subsection-content`

**Day timeline sections** (hotel stays, transit, AI assistant, schedule):
- `.timeline-section` → `.timeline-section-header` → `.timeline-section-title-row` / `.timeline-section-actions`

**Place cards** (catalog and itinerary):
- `.place-card-thumb-container` — fixed `40×40px` photo/placeholder wrapper
- `.place-card-move-buttons` — vertical up/down reorder controls
- For `<select>` dropdowns, use `.catalog-location-select` or `.tips-location-select`; set `backgroundColor` (not `background`) to avoid hiding the browser-rendered chevron.

**Dialogs / forms**:
- `.modal-field-title` / `.modal-field-details` — field label and description
- `.modal-section-divider` — dashed separator between card detail and AI sections
- `.modal-ai-header` / `.modal-ai-title` — AI trigger layout inside modals

### Tooltips

**All tooltips must use `data-tooltip` (never `title`).** The `[data-tooltip]` CSS in `index.css` renders a styled dark glassmorphic bubble with animation. Using a bare `title` attribute bypasses the system and shows the browser's unstyled default. Use `data-tooltip-position="bottom"` to flip the bubble below the element.
