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
│   │   ├── ReservationsSection.tsx# Timeline sub-section showing hotel stays & transportation details
│   │   ├── TipsSection.tsx        # AI Travel assistant dashboard inside left accordion
│   │   ├── GoogleAuthSection.tsx  # Google Drive auth status and sync controls
│   │   ├── ShareTripModal.tsx     # Sharing trips with viewer permissions
│   │   ├── SyncConflictModal.tsx  # Resolves local vs. Drive copy conflicts
│   │   ├── TripAiConfigModal.tsx  # Enable/disable, reorder, and add custom AI fields
│   │   ├── AiDetailsView.tsx      # Renders generated AI advice for places
│   │   ├── AiMarkdownSection.tsx  # Displays markdown AI sections with custom styling
│   │   ├── AiSettingsModal.tsx    # Configure Gemini API keys, active model, and manual mode
│   │   ├── AiRequestQueuePanel.tsx# Concurrency queue observer UI showing pending/running AI operations
│   │   ├── LeftPanelAccordion.tsx # Accordion: checklist, reservations, tips
│   │   ├── ManualAiPromptModal.tsx# Direct copy-paste UI used when Gemini is in manual mode
│   │   └── *Modal.tsx / *FormFields.tsx  # Creation/edit dialogs (Hotel, Transport, Location, Group, Place)
│   ├── utils/
│   │   ├── ai.ts          # GeminiService class, prompt design, custom AI fields
│   │   ├── aiRequestQueue.ts # Singleton AI queue managing API concurrency and limits
│   │   ├── runAiCall.ts   # Helper to route prompts through Manual, Live, or Disabled AI modes
│   │   ├── api.ts         # Geocoding (OSM Nominatim, Photon), default place groups
│   │   ├── currencies.ts  # Supported currencies mapping and metadata
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
- **Concurrency & Rate-Limiting Queue (`aiRequestQueue.ts`)**: All live AI queries route through a singleton queue (`aiRequestQueue.ts`). By default, it limits concurrency to `maxConcurrent = 1` execution thread to prevent API rate limits, overlapping prompts, and out-of-order responses. Components can subscribe to this queue to monitor pending/running states.
- **Unified Request Wrapper (`runAiCall.ts`)**: Every AI invocation runs through the unified `runAiCall` utility. This routes the prompt based on user settings: silently returns if disabled, prompts for manual copy-paste via `ManualAiPromptModal` if in manual mode, or enqueues the request in `aiRequestQueue` for live execution.

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
| `src/components/TripPlanner.tsx` | 2,398 | God component — extract a custom hook before adding new feature state |
| `src/components/ItineraryPanel.tsx` | 1,646 | Receives ~97 props from TripPlanner — don't add more; use TripContext instead |
| `src/App.tsx` | 1,115 | Auth + sync + CRUD mixed — don't expand further |
| `src/utils/googleDrive.ts` | 1,202 | No batch/retry — plan around its failure modes |
| `src/utils/ai.ts` | 1,299 | Prompt construction scattered — consolidate before adding fields |
| `src/components/TripAiConfigModal.tsx` | 719 | |
| `src/components/CatalogSection.tsx` | 759 | |
| `src/index.css` | 3,776 | 807 inline `style={{}}` occurrences exist across 79% of components — new code must use CSS classes instead |

**State ref duplication in App.tsx**: `tripsRef`, `googleTokenRef`, `googleFolderIdRef`, `activeTripIdRef`, `syncTimestampsRef` mirror their `useState` counterparts. This is intentional — sync callbacks need the latest value without re-registering effects. Don't remove these refs.

**Style Reuse & Pattern Inspection Rule**:

> **CRITICAL**: BEFORE writing code for any new component, modal, dialog, form, or section, you MUST inspect existing reference implementations (`HotelModal.tsx`, `TransportModal.tsx`, `ReservationsSection.tsx`, `index.css`) line-by-line first.

1. **Prefer the shared components below** over re-implementing a modal shell, notes editor, attachments block, combo box, undo button, or manual-prompt flow. See "Shared Controls" for the canonical list.
2. **Modal & Form Alignment**: Always copy exact form layout patterns (`.form-row` 2-column grid, `.place-form-label`, mandatory `*` indicators, `<UndoButton />` / `undoButton()` undo affordance, portal combos via `<ComboBox>`). Never write simplified custom layouts or omit standard form controls.
3. **Prop Routing & State Preservation**: When refactoring or extracting parent components (such as accordion containers), systematically trace and forward all state props (e.g. `selectedDateStr`, `activeDayStr`) to ensure active day highlighting and UI indicators remain 100% intact.

| Purpose | Context | CSS classes / component |
|---------|---------|-------------|
| Card title | Catalog | `.catalog-place-title` |
| Card title | Day view | `.place-title-text` |
| Secondary text | Catalog | `.catalog-place-desc` |
| Secondary text | Day view | `.place-desc-text` |
| Date tags | Catalog / Reservations | `.catalog-allocated-days` / `.catalog-day-tag` / `.catalog-day-tag--active` |
| Notes (all surfaces) | Everywhere | Use **`<InlineNotes>`** — do not re-implement. It emits the canonical `.notes-box` / `.notes-label` / `.notes-textarea` / `.notes-actions` / `.notes-text` / `.notes-text-wrapper` markup. `layout="card"` for catalog + left-panel reservations; `layout="compact"` for day-view cards. |
| Expand/collapse wrapper | All cards | `.card-expandable-wrapper` + `.is-expanded` on the wrapper |
| Expand/collapse chevron | All cards | `<ChevronDown className={`expand-chevron${open ? ' is-open' : ''}`} />` |

---

## Shared Controls (reuse these — do not re-implement)

| Concern | Use | Notes |
|---|---|---|
| Inline notes editor | `InlineNotes` (`src/components/InlineNotes.tsx`) | Self-managed draft state + `onSave(text)`; `layout` = `card`/`compact`; `onEditingChange` for drag-disable. |
| Reservation attachments | `useReservationAttachments` (`src/utils/useReservationAttachments.ts`) + `<AttachmentsSection>` | Hook wraps `useDriveAttachments` + shared AI file-fill (base64 upload/extract) + `aiError`/`showAccessError`/`isAiFilling` and the three-mode gating. Component renders the section + remove/access/share sub-modals. Pass `generateFromFiles` + `applyResult`. |
| Expense line items | `ExpensesSection` (`src/components/ExpensesSection.tsx`) | `expenses` + `onChange`. Owns the currency combo. |
| Modal shell | `Modal` (`src/components/Modal.tsx`) | Overlay + `.modal-content glass-panel scrollable` + header. **Always scrollable — never hand-roll the overlay/header again.** `maxWidth` prop for width. |
| Selection combo box | `ComboBox` (`src/components/ComboBox.tsx`) | Portal-based, outside-click dismiss, `options: {value,label,icon?,iconColor?}`. Use for status/type/etc. (Searchable timezone + bespoke catalog-place + linked expense-group combos remain custom.) |
| Place auto-populate search | `PlaceSearchBox` (`src/components/PlaceSearchBox.tsx`) | Debounced place-near-location search + Google-Maps-link paste + suggestions + outside-click. Pass `catalogLocation` + `onSelect`; `onQueryChange` to mirror the query. (Transport dep/arr panels + Location city search remain custom.) |
| Reservation status options | `STATUS_OPTIONS` (`src/constants/reservations.ts`) | Shared `{value,label,icon}` list + `ReservationStatus` type. |
| Group / section header shell | `SectionHeader` (`src/components/SectionHeader.tsx`) | **Both surfaces.** Slotted header via `variant`: `group` (left-panel `.place-group-header` — Catalog/Reservations/Expenses) / `section` (day-view `.timeline-section-header` — all 5 timeline sections). Props: `glyph`, `title`, `titleAttr`, `subtitle` (section), `actions`, `headerClassName`, `actionsClassName`. Each caller injects its own buttons into `actions`. |
| Group action button | `GroupActionButton` (`src/components/GroupActionButton.tsx`) | **Left panel only.** Standardizes the labeled-vs-icon-only choice via `labeled`: Catalog uses icon-only, Reservations/Expenses use labeled. Props: `icon`, `label`, `labeled`, `tooltip`, `tooltipPosition`, `disabled`, `className`. Day-view Add buttons deliberately keep their own `.timeline-add-btn--{success\|warning\|danger}` style — inject those raw into the `actions` slot, don't route them through this. |
| Group options menu | `GroupOptionsMenu` (`src/components/GroupOptionsMenu.tsx`) | **Left panel only.** Self-contained `⋮` dropdown (owns open state + outside-click). Move Up/Down + Edit + `extraItems(close)`. Replaces the per-section `activeGroupDropdownId` threading — do not reintroduce a parent-owned "which group menu is open" state. Not used in the day view; the Day Schedule's "Day Options" `⋮` (Add Note / hotel + transit events / Move Day / Clear Day, with submenus) is a distinct day-level menu (`.day-options-dropdown-container`) and stays as-is — don't fold it into this. |
| Undo / restore button | `undoButton(current, saved, onRestore)` (`src/components/UndoButton.tsx`) | Import `as undoBtn`; returns null when unchanged. |
| Manual-mode AI prompt | `useManualPrompt` (`src/utils/useManualPrompt.tsx`) | Returns `{ showManualPrompt, manualPromptModal }`; pass `showManualPrompt` to `runAiCall`, render `{manualPromptModal}`. |
| Geocoding | `geocodeAddress(address)` (`src/utils/api.ts`) | OSM Nominatim, 5s timeout. |

**AI file-fill prompts** (`ai.ts`): the three `build*DetailsFromFilesPrompt` methods share the intro sentence via `fileUploadIntro(subject)` but keep their own type-specific extraction rules and examples. Preserve that split when adding a new one.

**Modal adoption is incremental**: `Modal`, `ComboBox`, and `InlineNotes` are adopted across the reservation-family modals and surfaces; remaining modals should migrate to `Modal` the same mechanical way (replace the overlay/header wrapper, drop the `X` import) when next touched.

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
| `--card-transition` | shared card `border-color`/`box-shadow`/`background-color` transition — route every card family's `transition` through this token, don't re-type it |
| `--dropdown-bg` | `rgba(15, 23, 42, 0.9)` — single-source glass dropdown/combo surface |
| `--dropdown-shadow` | `var(--shadow-lg), 0 0 15px rgba(0, 0, 0, 0.5)` — single-source glass dropdown/combo shadow |

**Glassmorphism rule**: `background: rgba(255,255,255,0.03)`, `border: 1px solid rgba(255,255,255,0.08)`, `backdrop-filter: blur(12px)`.

**Per-reservation-type colors** — defined once in `:root`; use these for anything that represents a reservation *type* (card hover/expanded borders, type badges, type icons). Do **not** re-type the raw hex/rgba, and do **not** reuse the generic semantic colors (`--color-danger` etc.) for type meaning.

| Type | Token (solid) | Channel triple (for rgba tints) |
|---|---|---|
| Hotel | `--type-hotel` (`#4ade80`) | `--type-hotel-rgb` (`16, 185, 129`) |
| Transit | `--type-transit` (`#fb923c`) | `--type-transit-rgb` (`245, 158, 11`) |
| Attraction | `--type-attraction` (`#f87171`) | `--type-attraction-rgb` (`239, 68, 68`) |
| Dining | `--type-dining` (`#60a5fa`) | `--type-dining-rgb` (`59, 130, 246`) |

Tint usage: `rgba(var(--type-hotel-rgb), 0.35)`. Solid border: `border-color: var(--type-hotel)`.

**Day-view reservation cards share one shell** — `.reservation-day-card` backs all four types (hotel / transit / attraction / dining); there is **no** `.hotel-card` / `.transport-card` anymore. The type is a modifier — `.reservation-day-card--{hotel|transit|attraction|dining}` — and each modifier sets **only** three accent custom properties, which the shared base/hover/expanded/icon rules consume:

| Custom property | Fed from | Consumed by |
|---|---|---|
| `--card-accent` | `--type-{type}` (solid) | expanded-card border |
| `--card-accent-rgb` | `--type-{type}-rgb` | hover border/shadow tint + icon-wrapper background |
| `--card-icon-color` | icon foreground (hotel `--color-success`, transit `--color-warning`, attraction/dining their solid token) | icon-wrapper `color` |

So to add/adjust a day-card type, set those three vars on the modifier — never re-type a color in the base rules. Shared sub-parts: `.reservation-day-card-body`, `.reservation-day-card-icon`. Type-specific **content** classes stay separate (`.transport-flow*`, `.transport-details-grid`, `.hotel-name-text`, etc.). This shell is deliberately distinct from the left panel's `.reservation-card` (tighter 12px padding, lower bg) — the two surfaces share behavior, not this base class.

### Shared Layout Classes

**Left panel accordion subsections** (checklist, transit, tips):
- `.left-panel-subsection` → `.subsection-header` / `.subsection-title` / `.subsection-subtitle` / `.subsection-actions` / `.subsection-content`

**Day timeline sections** (hotel stays, transit, AI assistant, schedule):
- `.timeline-section` → `.timeline-section-header` → `.timeline-section-title-row` / `.timeline-section-actions`
- Don't hand-write this markup or the left-panel `.place-group-header` — render both through **`<SectionHeader>`** (`variant="section"` / `"group"`); see Shared Controls. In the **left panel** the injected actions use **`<GroupActionButton>`** + a **`<GroupOptionsMenu>`** `⋮`; in the **day view** inject the raw `.timeline-add-btn--*` buttons instead (those two helpers are left-panel only).

**Place cards** (catalog and itinerary):
- `.place-card-thumb-container` — fixed `40×40px` photo/placeholder wrapper
- For `<select>` dropdowns, use `.catalog-location-select` or `.tips-location-select`; set `backgroundColor` (not `background`) to avoid hiding the browser-rendered chevron.

**Card action button groups** — the little icon-button clusters on cards use two canonical containers (fill either with `.mini-icon-btn` buttons + a `.card-options-menu` for the ⋮ dropdown):
- `.card-actions-stack` — vertical (move up/down, expand, options stacked). `.place-card-move-buttons` is the legacy alias. Add `.card-actions-stack--pinned` on day-view cards to nudge the cluster into the top corner (desktop `margin-left: 4px`; mobile `margin-top: -8px; margin-right: -16px`).
- `.card-actions-row` — horizontal (map / options / date tags in a row). `.reservation-card-header-right` is grouped into it.

The expand/collapse chevron inside a cluster is a `<button type="button" className="mini-icon-btn">` wrapping `<ChevronDown className={`expand-chevron${open ? ' is-open' : ''}`} />` — the `.is-open` class drives the 180° rotation animation. Never render a bare chevron `<div>`; it must be a real button for keyboard/tooltip parity.

**Card spacing is standardized — match it, don't invent per-card values:**
- Left-panel cards (`.catalog-place-card`, `.reservation-card` + its `-expand`/`-expanded-content`, `.expense-item`) use **12px** padding on both desktop and mobile.
- Day-view card lists (`.section-item-list`) use a **16px** inter-card gap.
- On mobile the reservation ⋮ cluster is pinned flush to the card corner (negative margins on `.reservation-card-header-right`) to match the catalog place card's flush `⋮`.

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

The glass dropdown/combo surface is single-sourced through the `--dropdown-bg` and `--dropdown-shadow` tokens (see the Design System variable table). Every dropdown/combo panel (`.dropdown-menu`, `.combo-dropdown`, `.combo-dropdown--portal`, `.combo-dropdown--tz-portal`, mobile auth dropdown) consumes those tokens — **do not re-type the raw `rgba(15,23,42,…)` background or the shadow recipe.**

**1. Options menu** (contextual actions triggered by a `MoreVertical` / icon button — e.g. Day Options, Place Options): use `.dropdown-menu` + `.dropdown-item`.
```css
/* .dropdown-menu */
background: var(--dropdown-bg);
backdrop-filter: blur(16px);
border: 1px solid var(--border-glass);
border-radius: 8px;
box-shadow: var(--dropdown-shadow);
```

**2. Selection combo box** (picking a value from a list — e.g. Plan picker, Location picker): a `button.loc-select-trigger` as the trigger and a `div.loc-select-dropdown` as the panel.
```css
/* .loc-select-trigger (button) */
background: rgba(15, 23, 42, 0.6);
backdrop-filter: blur(12px);

/* .loc-select-dropdown (panel) */
background: var(--dropdown-bg);
backdrop-filter: blur(16px);
border: 1px solid var(--border-glass);
border-radius: 6px;
box-shadow: var(--dropdown-shadow);
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

**Card action dropdowns (options menus on cards)** — all card-level action menus (Edit/Delete, Map, etc.) triggered by a `mini-icon-btn` must use this exact structure:
```tsx
<div className="card-options-menu">          {/* position:relative anchor */}
  <button
    type="button"
    className="mini-icon-btn"
    onClick={() => setOpen(o => !o)}
    data-tooltip="Options"
  >
    <MoreVertical size={14} />
  </button>
  {isOpen && (
    <div className="dropdown-menu dropdown-menu--right">
      <button className="dropdown-item" onClick={handleEdit}><Pencil size={13} /> Edit</button>
      <button className="dropdown-item danger" onClick={handleDelete}><Trash2 size={13} /> Delete</button>
    </div>
  )}
</div>
```
Do **not** invent new class names or inline styles for this. `.dropdown-menu` and `.dropdown-item` are the canonical styled classes. See `CatalogSection.tsx` (group dropdown, mobile place "···" dropdown) for live examples. The card root must also receive `dropdown-active` when the menu is open — this lifts it above siblings with `z-index: 1100`.

**Combo boxes inside modals must use `createPortal`.** A `combo-dropdown` with `position: absolute` inside a scrollable modal will push the modal to overflow or get clipped by `overflow: hidden`. Always render the dropdown panel via `createPortal(…, document.body)` with a fixed-inset overlay for outside-click dismissal:
```tsx
import { createPortal } from 'react-dom';

const triggerRef = useRef<HTMLButtonElement>(null);
const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
const [open, setOpen] = useState(false);

// on trigger click:
const r = triggerRef.current!.getBoundingClientRect();
setPos({ top: r.bottom + 4, left: r.left, width: r.width });
setOpen(true);

// render:
{open && pos && createPortal(<>
  <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }} onClick={() => setOpen(false)} />
  <div className="combo-dropdown--portal" style={{ top: pos.top, left: pos.left, width: Math.max(pos.width, 220) }}>
    {items.map(item => (
      <button key={item.value} type="button" className={`combo-option${value === item.value ? ' selected' : ''}`}
        onClick={() => { setValue(item.value); setOpen(false); }}>
        {item.label}
      </button>
    ))}
  </div>
</>, document.body)}
```
CSS class `.combo-dropdown--portal` (already in `index.css`) applies `position: fixed`, `z-index: 10000`, glassmorphic styling, and `max-height: 200px; overflow-y: auto`. See `HotelModal.tsx` and `TransportModal.tsx` (currency combos) for live examples.

### Icons

**Always use Lucide React icons — never emoji.** All UI elements (cards, labels, empty states, option lists, badges) must use icons from `lucide-react`. Emoji characters are not permitted in JSX renders under any circumstances.

**Icon consistency rule**: Icons used in type-selector combo boxes must match the icon used in the corresponding card display badge. For example, `Plane` in the TransportModal type selector must match the `Plane` in the transport card's icon wrapper. Pick the icon once and use it everywhere for the same concept.

### Schema Versioning

**Only bump `CURRENT_SCHEMA_VERSION` when a migration transform is needed.** Adding optional (`?`) fields to TypeScript interfaces does NOT require a version bump — new optional fields are backward-compatible by definition and need no migration. Only increment the version (and add a migration block in `migrateTrips()`) when existing data must be transformed, renamed, or removed.

---

## AI Calls

**Always guard with `GeminiService.isAiEnabled()` before calling any GeminiService method.** This is a static method that reads from localStorage — no props or constructor injection needed.

```tsx
if (!GeminiService.isAiEnabled()) {
  showApiKeyMissingModal();   // in TripPlanner context
  // or: return;              // in modal context where showApiKeyMissingModal is unavailable
  return;
}
const result = await GeminiService.someMethod(...);
```

This guard is required even when the trigger button is already conditionally hidden via `GeminiService.isAiEnabled()` in JSX — the handler needs it for defense in depth. See `TripPlanner.tsx` (`handleGenerateSinglePlaceAiDetails` ~line 750, `handleAiSuggestPlaces` ~line 1199) for the canonical live examples.

`GeminiService` reads its API keys from `localStorage` key `vacation-itineraries-gemini-api-keys` and the active model from `vacation-itineraries-gemini-model` on every call — no singleton state to manage. Use the `*WithRotation` variants (e.g. `GeminiService.generateHotelDetailsFromFilesWithRotation(...)`) so key rotation and retry logic are handled automatically.

### All new AI calls must use `runAiCall`

Every new AI-triggered action must go through `runAiCall` (`src/utils/runAiCall.ts`). This handles all three modes uniformly:
- **Disabled** (`!isAiEnabled()`): Returns silently. Pre-guard in the handler shows a user-facing error first.
- **Manual** (`isManualMode()`): Shows `ManualAiPromptModal` via `showManualPrompt` — user copies the prompt, pastes the response.
- **Live**: Calls the API via the request queue.

`isAiEnabled()` returns `true` for both live and manual modes — manual mode is not blocked, it routes through `ManualAiPromptModal`. Never add an `isManualMode()` guard to skip or short-circuit an AI call.

The canonical pattern (see `PlaceModal.tsx: handleAutoFillWithAi`, `AiGenerateModal.tsx`):

```tsx
// 1. Add showManualPrompt in the component (identical boilerplate):
const showManualPrompt = (promptTitle: string, prompt: string, format: 'json' | 'markdown'): Promise<string | null> =>
  new Promise(resolve => {
    setPendingManualPrompt({
      title: promptTitle, promptText: prompt, responseFormat: format,
      onResponse: t => { setPendingManualPrompt(null); resolve(t); },
      onCancel: () => { setPendingManualPrompt(null); resolve(null); },
    });
  });

// 2. In the handler:
const handleMyAiAction = async () => {
  if (!GeminiService.isAiEnabled()) { setAiError(AI_NOT_CONFIGURED_MESSAGE); return; }
  setAiError(null);
  await runAiCall({
    label: 'My Action Label',
    buildPrompt: () => GeminiService.buildMyPrompt(...),
    parse: (text) => GeminiService.parseMyResponse(text),  // or JSON.parse(text) for raw JSON
    liveCall: () => GeminiService.myMethodWithRotation(...),
    onSuccess: (result) => { /* apply result to state */ },
    onError: (err) => setAiError(err.message || 'AI action failed.'),
    onLoadingChange: setIsGenerating,
    showManualPrompt,
  });
};

// 3. In JSX: show button when AI is enabled (including manual mode — runAiCall routes it):
{GeminiService.isAiEnabled() && (
  <button onClick={handleMyAiAction} disabled={isGenerating}>...</button>
)}

// 4. Add ManualAiPromptModal to the component's JSX:
{pendingManualPrompt && (
  <ManualAiPromptModal
    isOpen={true}
    title={pendingManualPrompt.title}
    promptText={pendingManualPrompt.promptText}
    responseFormat={pendingManualPrompt.responseFormat}
    onResponse={pendingManualPrompt.onResponse}
    onCancel={pendingManualPrompt.onCancel}
  />
)}
```

Reset `setPendingManualPrompt(null)` inside the `useEffect` that fires when the modal opens (`isOpen`), alongside the other state resets.

#### Exception: file-content AI calls (HotelModal / TransportModal attachment fill)

The "Fill Reservation Details with AI" button sends raw file bytes to the Gemini API. Manual mode cannot support this — there is no way to pipe file contents through copy/paste. For these buttons:
- **Disabled mode**: button shown, disabled, tooltip shows `AI_NOT_CONFIGURED_MESSAGE`
- **Manual mode**: button shown, disabled, tooltip shows `AI_FILE_CONTENTS_NOT_AVAILABLE_IN_MANUAL_MODE_MESSAGE`
- **Live mode**: button active

```tsx
{attachedFiles.length > 0 && (
  <button
    type="button"
    className="modal-ai-fill-btn"
    onClick={handleAiFill}
    disabled={isAiFilling || !GeminiService.isAiEnabled() || GeminiService.isManualMode()}
    data-tooltip={
      !GeminiService.isAiEnabled() ? AI_NOT_CONFIGURED_MESSAGE :
      GeminiService.isManualMode() ? AI_FILE_CONTENTS_NOT_AVAILABLE_IN_MANUAL_MODE_MESSAGE :
      undefined
    }
    data-tooltip-position="bottom"
  >
    ...
  </button>
)}
```

The handler guards `!isAiEnabled() || isManualMode()` and returns silently (button is already disabled — defense-in-depth only).

---

## Outside Click Dismissals & Custom Control Consistency

### Modal & Dialog Dismissal

- **All modal dialogs must close when clicking outside their content container.** The overlay wrapper (`.modal-overlay`) must trigger the `onClose` or cancel callback:
  ```tsx
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
      {/* modal content */}
    </div>
  </div>
  ```

### Custom Dropdowns & Combo Boxes

- **All custom selection dropdowns, option lists, and combo boxes must dismiss when the user clicks outside their area.**
- Implement a `useEffect` with a `mousedown` or `click` listener checking if `ref.current` contains `event.target` (as documented in the **Dropdowns** section).
- Any new custom dropdowns, combo boxes, or select lists must inherit the established styling system:
  - Option items must use `className="combo-option"` (with optional `selected` class).
  - Triggers must use `<ChevronDown />` rotated 180 degrees using CSS transition classes (e.g. `.expand-chevron.is-open`).
  - Modal portals must use `createPortal(..., document.body)` with `.combo-dropdown--portal` or `.combo-dropdown--tz-portal` style overrides.

### Custom Tooltips

- **All tooltips must use the `data-tooltip` attribute.** Never use the native browser `title` attribute.
- Tooltips are rendered as styled dark glassmorphic bubbles via the global `[data-tooltip]` selector.
- Use `data-tooltip-position="bottom"` where dropdowns or UI bounds require bottom alignment.
