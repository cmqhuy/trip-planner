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

There is no global state library. All state lives in **`App.tsx`** (~1,221 lines) and flows down as props — no React Context.

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

> **IMPORTANT — `scheduleItems` / `placeIds` sync invariant**: `PlanDay` holds two redundant fields that must always stay in sync:
> - `scheduleItems: ScheduleItem[]` — the ordered list of places and notes rendered in the day schedule (source of truth for display).
> - `placeIds: string[]` — derived from `scheduleItems`; kept for backward compat with map display and AI generation.
>
> **Never write `scheduleItems` and `placeIds` independently.** Always go through the `updateDayItems(day, items)` helper in `TripPlanner.tsx`, which sets both atomically:
> ```typescript
> const updateDayItems = (day: PlanDay, items: ScheduleItem[]): PlanDay => ({
>   ...day,
>   scheduleItems: items,
>   placeIds: items.filter((i): i is SchedulePlaceItem => i.type === 'place').map(i => i.placeId)
> });
> ```
> All new-day stubs must include `scheduleItems: []` alongside `placeIds: []` — they are created together everywhere (App.tsx, TripPlanner.tsx, dateUtils.ts).

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
- **Suggested markers**: large areas generate nested `suggestedMarkers` (lat/lng + type) rendered as child map pins. `suggestedMarkers` is **always** included in the `generatePlaceAiDetails` response schema (ai.ts:239–255) unless `area_guide` is in `disabledPlaceFields` — skip both the schema property and the IMPORTANT AREA MAP MARKERS REQUIREMENT paragraph when that field is off.
- **Timeouts**: all `fetch` calls in `ai.ts` must use `AbortController` with a 30-second timeout. Never leave a bare `fetch` without one.
- **Regeneration is always allowed** — do not add pre-flight guards that skip the API call when `aiDetails` already has values. Users intentionally regenerate.
- **`generateDailyTips` sends only scheduled places** (`day.placeIds.map(...)` at TripPlanner.tsx:1792) — do not change this to send all trip places.

The 7 built-in place fields: `what_special`, `best_time`, `reservation`, `directions`, `area_guide`, `pro_tips`, `other_info`.

External APIs (no keys required): OSM Nominatim (geocoding), Photon/Komoot (place search), Wikipedia/Wikimedia Commons (descriptions and images).

---

## Schema Rules

> **All schema changes MUST be backward compatible.**

- New fields on interfaces must be optional (`?`).
- Provide defaults/fallbacks wherever new fields are read.
- If restructuring existing fields, use the versioned migration system below — do **not** add ad-hoc checks scattered through the code.

### Versioned migration system (`App.tsx`)

`Trip.schemaVersion` tracks which migrations have been applied. `CURRENT_SCHEMA_VERSION` is the target. `migrateTrips()` is called on every external data entry point (localStorage load, Drive sync pull, conflict resolution) and is a **no-op for trips already at the current version** — just a version check.

**To add a new migration (e.g., v1 → v2):**

1. Increment `CURRENT_SCHEMA_VERSION = 2` in `App.tsx`.
2. Add a migration block inside `migrateTrips()`:
   ```typescript
   // v1 → v2: describe what changed
   if ((trip.schemaVersion ?? 0) < 2) {
     // transform trip data
   }
   return { ...trip, schemaVersion: CURRENT_SCHEMA_VERSION };
   ```
3. Add the new field(s) as optional (`?`) to the relevant interface in `types.ts`.
4. Provide read-time fallbacks wherever the new field is consumed.

`migrateTrips()` is called in six places — do not add a seventh; all external data flows through these already:
- Mount `useEffect` (localStorage load) — also writes migrated data back to localStorage immediately
- `StorageEvent` handler (cross-tab sync)
- `performSync` local trips load (Drive sync)
- `performSync` silent pull merge
- `handleResolveConflict` cloud-wins path
- Post-conflict final merge

---

## Component Sizes & Known Technical Debt

File sizes as of the last audit. Read these before adding features — these are large files and grow easily.

| File | Lines | Notes |
|------|-------|-------|
| `src/components/TripPlanner.tsx` | 2,650 | God component — extract a custom hook before adding new feature state |
| `src/components/ItineraryPanel.tsx` | 1,386 | Receives ~97 props from TripPlanner — don't add more; use TripContext instead |
| `src/App.tsx` | 1,221 | Auth + sync + CRUD mixed — don't expand further |
| `src/utils/googleDrive.ts` | 1,177 | No batch/retry — plan around its failure modes |
| `src/utils/ai.ts` | 964 | Prompt construction scattered — consolidate before adding fields |
| `src/components/TripAiConfigModal.tsx` | 881 | |
| `src/components/CatalogSection.tsx` | 805 | |
| `src/index.css` | 2,776 | 807 inline `style={{}}` occurrences exist across 79% of components — new code must use CSS classes instead |

**State ref duplication in App.tsx**: `tripsRef`, `googleTokenRef`, `googleFolderIdRef`, `activeTripIdRef`, `syncTimestampsRef` mirror their `useState` counterparts. This is intentional — sync callbacks need the latest value without re-registering effects. Don't remove these refs.

**Style reuse**: When a new component resembles an existing one, identify the exact CSS classes and copy them verbatim — do not create new rules for an identical visual pattern.

| Purpose | Context | CSS classes |
|---------|---------|-------------|
| Card title | Catalog | `.catalog-place-title` |
| Card title | Day view | `.place-title-text` |
| Secondary text | Catalog | `.catalog-place-desc` |
| Secondary text | Day view | `.place-desc-text` |
| Date tags | Catalog / Reservations | `.catalog-allocated-days` / `.catalog-day-tag` / `.catalog-day-tag--active` |
| Notes (view+edit) | Catalog | `.catalog-notes-box`, `.catalog-notes-label`, `.catalog-notes-textarea`, `.catalog-notes-actions` |
| Notes (view) | Day view | `.place-note-wrapper` |
| Notes (edit) | Day view | `.place-notes-btn-wrapper`, `.place-notes-textarea`, `.place-notes-actions` |
| Expand/collapse wrapper | All cards | `.card-expandable-wrapper` + `.is-expanded` on the wrapper |
| Expand/collapse chevron | All cards | `<ChevronDown className={`expand-chevron${open ? ' is-open' : ''}`} />` |

---

## Performance Guidelines

**Current state**: 0 `React.memo` usages across 47 components. Every trip mutation re-renders the full App → TripPlanner → ItineraryPanel → CatalogSection → all cards cascade.

Rules going forward:
- Wrap `React.memo` on any component that receives props from TripPlanner or ItineraryPanel.
- Wrap handlers passed to children in `useCallback` — without it, `React.memo` on children provides no benefit (new function reference every render).
- **Write component tests BEFORE adding `React.memo`** — stale closure bugs from shallow prop comparison are hard to detect without tests.
- Don't add list virtualization until tested with 50+ items under React DevTools Profiler.
- All inline styles (`style={{...}}`) bypass the CSS variable system; new code should use CSS classes.

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

### Z-Index Hierarchy

| Layer | Z-index | Examples |
|-------|---------|---------|
| Cards with open dropdowns | 1100 | `.dropdown-active` on `.timeline-card`, `.catalog-place-card` |
| Modals / overlays | 1000+ | `.modal-overlay` |
| Tooltips | 1200 | `[data-tooltip]::after` |

### Inline Styles

807 inline `style={{}}` blocks exist across the codebase. **New code must not add more.** Move dynamic values to CSS classes or CSS custom property overrides on the element (`style={{ '--color': hex }}`), then consume with `var(--color)` in CSS.

### Alert Dialogs

**Never use `window.alert()`.** All alerts must use `ConfirmationModal` with `isAlert={true}`, which renders a styled glassmorphic dialog with a single OK button. In `TripPlanner.tsx`, use the `showAlert(title, message)` helper that drives the shared `confirmModal` state.

```typescript
// correct
showAlert('AI Error', `Failed to parse AI response: ${err.message}`);

// wrong — bypasses the design system
alert(`Failed to parse AI response: ${err.message}`);
```

### Tooltips

**All tooltips must use `data-tooltip` (never `title`).** The `[data-tooltip]` CSS in `index.css` renders a styled dark glassmorphic bubble with animation. Using a bare `title` attribute bypasses the system and shows the browser's unstyled default. Use `data-tooltip-position="bottom"` to flip the bubble below the element.

### Dropdowns

**Never use a native `<select>` or unstyled combo box.** All new dropdowns and combo boxes must match the app's glassmorphism theme. There are two established patterns — pick the one that fits:

**1. Options menu** (contextual actions triggered by a `MoreVertical` / icon button — e.g. Day Options, Place Options): use `.dropdown-menu` + `.dropdown-item`.
```css
/* .dropdown-menu */
background: rgba(15, 23, 42, 0.95);
backdrop-filter: blur(16px);
border: 1px solid var(--border-glass);
border-radius: 8px;
box-shadow: var(--shadow-lg), 0 0 15px rgba(0,0,0,0.5);
```

**2. Selection combo box** (picking a value from a list — e.g. Plan picker, Location picker): a `button.loc-select-trigger` as the trigger and a `div.loc-select-dropdown` as the panel.
```css
/* .loc-select-trigger (button) */
background: rgba(15, 23, 42, 0.6);
backdrop-filter: blur(12px);

/* .loc-select-dropdown (panel) */
background: rgba(15, 23, 42, 0.95);
backdrop-filter: blur(16px);
border: 1px solid var(--border-glass);
border-radius: 6px;
box-shadow: var(--shadow-lg), 0 0 15px rgba(0,0,0,0.5);
```
The trigger chevron must be a Lucide `ChevronDown`, rotated 180° via a CSS class toggle when open — never a static `background-image` arrow. Native `<select>` elements are not permitted for combo boxes.

**Combo box items must use `className="combo-option"` (or `combo-option selected` when selected).** This class is defined in `index.css` and handles transparent background, hover highlight, and selected highlight via CSS. Use `<button type="button" className={`combo-option${isSelected ? ' selected' : ''}`}>` — no inline styles, no onMouseEnter/Leave handlers. Never invent a new class name for combo items; `.combo-option` is the single shared class.

**All dropdowns must close when the user clicks outside.** Use a `useEffect` with a `mousedown` listener and a `ref.contains()` check so the trigger button doesn't immediately close the dropdown it just opened:
```typescript
const wrapperRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  if (!isOpen) return;
  const handler = (e: MouseEvent) => {
    if (!wrapperRef.current?.contains(e.target as Node)) setIsOpen(false);
  };
  document.addEventListener('mousedown', handler);
  return () => document.removeEventListener('mousedown', handler);
}, [isOpen]);
```
Attach `ref={wrapperRef}` to the `.combo-wrapper` div. Do **not** use `e.stopPropagation()` or `e.nativeEvent.stopImmediatePropagation()` on the wrapper — those are anti-patterns that break other listeners. For portal-rendered dropdowns (e.g. timezone pickers rendered in `document.body`), use a transparent fullscreen overlay instead: render a `<div style={{ position: 'fixed', inset: 0, zIndex: 9999 }} onClick={() => setIsOpen(false)} />` before the portal content, with the portal panel at `zIndex: 10000`.

**Combo box trigger layout**: Every `.combo-trigger` must use `justify-content: space-between` to push the chevron to the right edge, and the content span must use `display: flex; align-items: center; gap: 6px`. These are enforced in CSS on `.combo-trigger` and `.combo-trigger-content` — do not add duplicate inline styles.

**Cards with open dropdowns must lift above siblings.** Schedule items (`.timeline-card`) and catalog cards (`.catalog-place-card`) use `backdrop-filter`, which creates a CSS stacking context. Adjacent elements with an explicit `z-index` (e.g., `.schedule-add-slot` at `z-index: 2`) can overlap and obscure the dropdown. When a dropdown opens, add `dropdown-active` to the card's root element — the global CSS rule sets `position: relative; z-index: 1100` to lift it above siblings:
```tsx
className={`timeline-card glass-panel ${isDropdownOpen ? 'dropdown-active' : ''}`}
```

**Dropdowns inside expandable card sections**: `.card-expandable-wrapper > div` has `overflow: hidden` (required for the grid-row CSS animation). Any `position: absolute` dropdown inside will be clipped — even when `has-open-dropdown` sets `overflow: visible` on the wrapper, the inner `> div` still clips. Fix: add BOTH `has-open-dropdown` to `.card-expandable-wrapper` AND `dropdown-active` to the card's root element. CSS handles both: `has-open-dropdown` sets `overflow: visible` on the wrapper AND the inner `> div`, while `dropdown-active` lifts the card above siblings with `z-index: 1100`. Both classes are required — one without the other still clips.
```tsx
// wrapper: overflow escape
className={`card-expandable-wrapper${isOpen ? ' has-open-dropdown' : ''}`}
// card root: lift above siblings
className={`reservation-card${isOpen ? ' dropdown-active' : ''}`}
```

### Icons

**Always use Lucide React icons — never emoji.** All UI elements (cards, labels, empty states, option lists, badges) must use icons from `lucide-react`. Emoji characters are not permitted in JSX renders under any circumstances.

**Icon consistency rule**: Icons used in type-selector combo boxes must match the icon used in the corresponding card display badge. For example, `Plane` in the TransportModal type selector must match the `Plane` in the transport card's icon wrapper. Pick the icon once and use it everywhere for the same concept.

### Schema Versioning

**Only bump `CURRENT_SCHEMA_VERSION` when a migration transform is needed.** Adding optional (`?`) fields to TypeScript interfaces does NOT require a version bump — new optional fields are backward-compatible by definition and need no migration. Only increment the version (and add a migration block in `migrateTrips()`) when existing data must be transformed, renamed, or removed.
