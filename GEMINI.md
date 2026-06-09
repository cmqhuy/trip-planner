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
│   │   ├── TripDashboard.tsx   # Dashboard listing trips, allowing trip creation & deletion
│   │   ├── TripPlanner.tsx     # Main application workspace (Catalog, Timeline, Modals, State)
│   │   ├── MapComponent.tsx    # Leaflet-based map displaying places and route sequences
│   │   ├── MapPicker.tsx       # Leaflet-based interactive mini-map for lat/lng picking in modals
│   │   └── ConfirmationModal.tsx # Reusable glassmorphic alert/confirm dialog
│   ├── utils/            # Geocoding APIs, date utilities, and Google Drive syncing
│   ├── types.ts          # TypeScript interfaces defining the entire state model
│   ├── App.tsx           # Base entry point managing Trip selection & LocalStorage sync
│   └── index.css         # Main styling rules, CSS variables, and animation keyframes
```

---

## 💾 Data Storage & Schema
All data is stored in the browser's `localStorage` under the key **`vacation-itineraries`** as a JSON string of `Trip[]`.
For the exact schema, refer directly to [types.ts](file:///d:/OneDrive/Documents/Projects/trip-planner/src/types.ts). Core models include:
- `Trip`: Main container holding locations, plans, and place groups.
- `Location`: A city/country coordinate pair containing cataloged places.
- `Place`: Points of interest with coords, category group, mapsLink, notes.
- `Plan`: Itinerary version containing days schedule mapping, hotels, and transportation.
- `PlanDay`: Holds scheduled place IDs for a specific date YYYY-MM-DD.

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

---

## 💻 Environment Commands (Windows Specific)
Run commands using the `.cmd` suffix for npm binaries in powershell:
- **Start Dev Server**: `npm.cmd run dev`
- **Build Client Bundle**: `npm.cmd run build`
- **Execute Vitest Unit Tests**: `npm.cmd run test`
