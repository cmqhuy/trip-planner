# AI & Development Guidelines (GEMINI.md)

Codebase context, design guidelines, state layout, and developer SOPs for the Trip Planner application.

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
│   ├── components/       # UI Components & extracted reusable dialogs
│   │   ├── TripDashboard.tsx      # Dashboard listing trips, allowing trip creation & deletion
│   │   ├── TripPlanner.tsx        # Main application workspace (Catalog, Timeline, Modals, State)
│   │   ├── MapComponent.tsx       # Leaflet-based map displaying places and route sequences
│   │   ├── MapPicker.tsx          # Leaflet-based interactive mini-map for lat/lng picking in modals
│   │   ├── ConfirmationModal.tsx  # Reusable glassmorphic alert/confirm dialog
│   │   ├── ItineraryPanel.tsx     # Handles the display of schedule days, hotels, transits, and place mapping
│   │   ├── CatalogSection.tsx     # Handles place management, group categorization, and list views
│   │   ├── ChecklistSection.tsx   # Manages manual to-dos, support drag-and-drop reordering with drop indicators
│   │   ├── GoogleAuthSection.tsx  # UI for Google Drive authentication status and controls
│   │   ├── ShareTripModal.tsx     # Settings for sharing trips with viewer permissions
│   │   ├── SyncConflictModal.tsx  # Resolves differences between local data and Google Drive copies
│   │   ├── TripAiConfigModal.tsx  # UI to enable/disable, reorder, and add custom AI fields
│   │   ├── AiDetailsView.tsx      # Renders generated AI advice for places
│   │   ├── AiMarkdownSection.tsx  # Handles displaying markdown sections with custom styling
│   │   ├── LeftPanelAccordion.tsx # Accordion layout for checklist, reservations, and tips
│   │   └── *Modal.tsx / *FormFields.tsx # Specialized creation/edit dialogs (Hotel, Transport, Location, Group, Place)
│   ├── utils/            # Utilities for Geocoding, Google Drive syncing, and AI
│   │   ├── ai.ts          # Integrations with Gemini API, prompt design, custom AI fields list
│   │   ├── api.ts         # Geocoding APIs, OSM place search, default place groups
│   │   ├── dateUtils.ts   # Formatting, date range calculations
│   │   ├── googleDrive.ts # App folder detection, file syncing, silent re-auth, shadow files
│   │   └── image.ts       # Queries Wikimedia Commons for high-resolution images
│   ├── types.ts          # TypeScript interfaces defining the entire state model
│   ├── App.tsx           # Base entry point managing Trip selection, Google Auth, and LocalStorage sync
│   └── index.css         # Main styling rules, CSS variables, and animation keyframes
```

### 🧪 Test Conventions
Unit tests are co-located in the same directory as their implementation files, named as `[module].test.ts` or `[component].test.tsx`. They use Vitest and standard React Testing Library mocks.

---

## 💾 Data Storage & Schema
All user data is stored in the browser's `localStorage` and synced with Google Drive.

### LocalStorage Keys
- **`vacation-itineraries`**: JSON string representing `Trip[]`.
- **`vacation-itineraries-gemini-api-keys`**: String array containing rotated/fallback Gemini API keys.
- **`vacation-itineraries-gemini-model`**: Currently active Gemini API model name (default: `gemini-2.5-flash`).
- **`vacation-itineraries-gemini-sync-drive`**: Boolean flag indicating if AI settings should be saved to Google Drive.
- **`vacation-itineraries-sync-timestamps`**: Key-value mapping of trip ID to last-synced epoch timestamp.
- **`google-access-token` / `google-token-expires-at` / `google-user`**: Google authentication tokens and metadata.
- **`google-folder-id`**: ID of the `Trip Planner` folder on Google Drive.

### Core Data Models
Refer directly to [types.ts](file:///d:/OneDrive/Documents/Projects/trip-planner/src/types.ts) for full detail:
- **`Trip`**: Root container containing locations, plans, custom AI fields, custom order preferences, Google Drive sharing fields (`driveFileId`, `shadowFileId`, `isShadow`, `ownerEmail`).
- **`Location`**: City/country coordinate pair containing `Place[]` cataloged for that area.
- **`Place`**: Points of interest with coordinates, category group ID (`placeGroupId`), note shared across plans, and AI fields.
- **`Plan`**: A specific itinerary version containing `PlanDay` schedule mappings, hotels, transports, and manual checklists.
- **`PlanDay`**: Mappings of a specific date to list of place IDs and AI daily details.

---

## 🧠 AI Details & Customization
AI-generated content is saved directly into the state schema to support offline reading and prevent redundant API calls:
- **Details Schema**: `aiDetails?: { [fieldKey: string]: string }` and `aiUpdatedAt?: number | { [fieldKey: string]: number }` are present on `Trip`, `Location`, `Place`, `Plan`, and `PlanDay`.
- **Custom AI Fields**: Configured inside `Trip` via `customAiFields` (e.g. `title`, `key`, `description`, `icon`).
- **Order & Display**: Configured via `placeFieldsOrder` and `disabledPlaceFields` in the `Trip` interface. All active fields are resolved by `getOrderedPlaceFields()` in `src/utils/ai.ts`.

---

## ☁️ Synchronization & Multi-User Sharing
- **App Folder**: All synchronized trip files are stored in a dedicated folder named `Trip Planner` on the user's Google Drive.
- **Shadow Files**: Shared trips utilize "shadow" files (`isShadow: true`) pointing to the owner's file ID. Viewers retrieve the owner's updates but cannot modify the owner's document without permissions.
- **Conflict Resolution**: Detected by comparing updated timestamps. The application prompts the user via `SyncConflictModal` to choose between merging, keeping the local copy, or using the cloud copy.

---

## ⚠️ Data Storage Rules & Backward Compatibility
> [!IMPORTANT]
> **Schema updates MUST be backward compatible.** Mark new properties as optional (`?`), define defaults/fallbacks on read, and add migration logic in App.tsx's LocalStorage mount `useEffect` if restructuring fields.

---

## 🎨 Visual & Design System Guidelines
Futuristic, glassmorphism dark theme. CSS variables (defined in [index.css](file:///d:/OneDrive/Documents/Projects/trip-planner/src/index.css)):
- `--bg-dark`: Dark background (`#0b0f19`)
- `--bg-panel`: Glass panel background (`rgba(17, 24, 39, 0.6)`)
- `--accent-primary`: Indigo accent (`#6366f1`)
- `--border-glass`: Universal glass border (`rgba(255, 255, 255, 0.08)`)
- **Glassmorphism rule**: Background (`rgba(255,255,255,0.03)`), border (`1px solid rgba(255,255,255,0.08)`), blur (`backdrop-filter: blur(12px)`).

### 📐 Component & Layout Conventions
To maintain UI consistency and simplify styling updates, always use the following shared classes:

#### 1. Left Panel Subsections
Apply this layout pattern to segment checklists, transit summaries, and local tips inside the left accordion:
- `.left-panel-subsection`: Outermost vertical flex container with a top divider border on siblings.
- `.subsection-header`: Flex row holding the title and header action buttons.
- `.subsection-title`: Font size `11px`, bold, uppercase header (supports prefix icons).
- `.subsection-subtitle`: Font size `11px`, italicized, muted subtext for empty lists.
- `.subsection-actions`: Flex row container aligning subsection action buttons.
- `.subsection-content`: Scrollable content container for rows/lists.

#### 2. Day Details timeline Sections
Apply this structure for Hotel Stays, Transit, AI Day Assistant, and Day Schedule subsections:
- `.timeline-section`: Outer container with standard spacing.
- `.timeline-section-header`: Flex row grouping the title column and actions.
- `.timeline-section-title-row`: Layout block for the title and subtitle.
- `.timeline-section-title`: Font size `14px` bold heading (supports prefix icons).
- `.timeline-section-subtitle`: Font size `11px` muted section description.
- `.timeline-section-actions`: Container for section action buttons.

#### 3. Place Cards & Thumbnails (Catalog & Itinerary)
- `.place-card-thumb-container`: Shared wrapper ensuring identical aspect ratio (`40px` x `40px`) and border-radius (`6px`) for photo thumbs and empty placeholders.
- `.place-card-move-buttons`: Standard vertical flex container wrapping up/down buttons on cards.
- **Select Dropdown arrows**: When styling selects, use `.catalog-location-select` or `.tips-location-select` and avoid inline `background` overrides (use `backgroundColor` instead) to prevent browser-rendered chevron dropdown arrows from being hidden.
- **Mobile Active Location**: Change location switcher trigger on mobile to a `ChevronDown` arrow inside `.day-location-select-wrapper` instead of `MoreVertical` to clarify it is a combo box.

#### 4. Edit/Creation Dialogs (Forms & AI sections)
- `.modal-field-title`: Font size `12.5px`, bold, matching primary text token (uses flex alignment for AI sparkles).
- `.modal-field-details`: Font size `10px`, muted color description for the input field.
- `.modal-section-divider`: Standard dashed top border separating card details and AI options.
- `.modal-ai-header`: Header flex layout for AI triggers inside modal forms.
- `.modal-ai-title`: Font size `13px` bold AI heading with Sparkles icon.

---

## 💻 Environment Commands (Windows Specific)
Run commands using the `.cmd` suffix for npm binaries in powershell:
- **Start Dev Server**: `npm.cmd run dev`
- **Build Client Bundle**: `npm.cmd run build`
- **Execute Vitest Unit Tests**: `npm.cmd run test`

