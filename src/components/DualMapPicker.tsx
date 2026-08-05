import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface SegmentCoords {
  depLat: number;
  depLng: number;
  arrLat: number;
  arrLng: number;
}

interface DualMapPickerProps {
  segments: SegmentCoords[];
  activeIndex: number;
  onDepPick: (lat: number, lng: number) => void;
  onArrPick: (lat: number, lng: number) => void;
}

function makeDepIcon(active: boolean) {
  const size = active ? 28 : 20;
  return L.divIcon({
    className: 'map-picker-pin',
    html: `<div style="
      width:${size}px;height:${size}px;background:#22c55e;border:2px solid #fff;
      border-radius:50%;display:flex;align-items:center;justify-content:center;
      box-shadow:0 0 12px #22c55e;color:#fff;font-size:${active ? 11 : 9}px;font-weight:700;
      opacity:${active ? 1 : 0.5};
    ">D</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function makeArrIcon(active: boolean) {
  const size = active ? 28 : 20;
  return L.divIcon({
    className: 'map-picker-pin',
    html: `<div style="
      width:${size}px;height:${size}px;background:#f59e0b;border:2px solid #fff;
      border-radius:50%;display:flex;align-items:center;justify-content:center;
      box-shadow:0 0 12px #f59e0b;color:#fff;font-size:${active ? 11 : 9}px;font-weight:700;
      opacity:${active ? 1 : 0.5};
    ">A</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function DualMapPicker({ segments, activeIndex, onDepPick, onArrPick }: DualMapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const allMarkersRef = useRef<{ dep: L.Marker | null; arr: L.Marker | null }[]>([]);
  const polylinesRef = useRef<L.Polyline[]>([]);
  const hasInitialFitRef = useRef(false);
  const [activeMarker, setActiveMarker] = useState<'dep' | 'arr'>('dep');
  const activeMarkerRef = useRef<'dep' | 'arr'>('dep');
  const activeIndexRef = useRef(activeIndex);
  const onDepPickRef = useRef(onDepPick);
  const onArrPickRef = useRef(onArrPick);

  useEffect(() => { onDepPickRef.current = onDepPick; }, [onDepPick]);
  useEffect(() => { onArrPickRef.current = onArrPick; }, [onArrPick]);
  useEffect(() => { activeMarkerRef.current = activeMarker; }, [activeMarker]);
  useEffect(() => { activeIndexRef.current = activeIndex; }, [activeIndex]);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current, { zoomControl: false }).setView([20, 0], 2);
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OSM &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      const idx = activeIndexRef.current;
      const markers = allMarkersRef.current;
      if (activeMarkerRef.current === 'dep') {
        if (markers[idx]?.dep) {
          markers[idx].dep!.setLatLng([lat, lng]);
        } else if (markers[idx]) {
          markers[idx].dep = L.marker([lat, lng], { icon: makeDepIcon(true) }).addTo(map);
        }
        onDepPickRef.current(lat, lng);
      } else {
        if (markers[idx]?.arr) {
          markers[idx].arr!.setLatLng([lat, lng]);
        } else if (markers[idx]) {
          markers[idx].arr = L.marker([lat, lng], { icon: makeArrIcon(true) }).addTo(map);
        }
        onArrPickRef.current(lat, lng);
      }
    });

    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 150);

    return () => {
      map.remove();
      mapRef.current = null;
      allMarkersRef.current = [];
      polylinesRef.current = [];
    };
    }, []);

  // Sync all segment markers and lines whenever segments or activeIndex changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old markers
    allMarkersRef.current.forEach(m => {
      m.dep?.remove();
      m.arr?.remove();
    });

    // Remove old polylines
    polylinesRef.current.forEach(l => l.remove());
    polylinesRef.current = [];

    const validCoords: L.LatLngTuple[] = [];

    const newMarkers: { dep: L.Marker | null; arr: L.Marker | null }[] = segments.map((seg, idx) => {
      const isActive = idx === activeIndex;
      const entry: { dep: L.Marker | null; arr: L.Marker | null } = { dep: null, arr: null };
      const hasDepCoords = !isNaN(seg.depLat) && !isNaN(seg.depLng);
      const hasArrCoords = !isNaN(seg.arrLat) && !isNaN(seg.arrLng);

      if (hasDepCoords) {
        entry.dep = L.marker([seg.depLat, seg.depLng], { icon: makeDepIcon(isActive) }).addTo(map);
        validCoords.push([seg.depLat, seg.depLng]);
      }
      if (hasArrCoords) {
        entry.arr = L.marker([seg.arrLat, seg.arrLng], { icon: makeArrIcon(isActive) }).addTo(map);
        validCoords.push([seg.arrLat, seg.arrLng]);
      }

      // Draw dep→arr line for this segment
      if (hasDepCoords && hasArrCoords) {
        const line = L.polyline(
          [[seg.depLat, seg.depLng], [seg.arrLat, seg.arrLng]],
          {
            color: isActive ? '#6366f1' : 'rgba(255,255,255,0.35)',
            weight: isActive ? 2.5 : 1.5,
            opacity: isActive ? 0.85 : 0.4,
            dashArray: isActive ? undefined : '5, 7',
          }
        ).addTo(map);
        polylinesRef.current.push(line);
      }

      return entry;
    });

    allMarkersRef.current = newMarkers;

    // On first update with valid coords, fit bounds to show all locations
    if (!hasInitialFitRef.current && validCoords.length > 0) {
      hasInitialFitRef.current = true;
      if (validCoords.length === 1) {
        map.setView(validCoords[0], 13);
      } else {
        map.fitBounds(validCoords, { padding: [30, 30] });
      }
    }
  }, [segments, activeIndex]);

  return (
    <div>
      <div className="dual-map-toggle">
        <button
          type="button"
          className={`dual-map-toggle-btn${activeMarker === 'dep' ? ' active' : ''}`}
          onClick={() => setActiveMarker('dep')}
        >
          Set Departure
        </button>
        <button
          type="button"
          className={`dual-map-toggle-btn${activeMarker === 'arr' ? ' active' : ''}`}
          onClick={() => setActiveMarker('arr')}
        >
          Set Arrival
        </button>
      </div>
      <div ref={containerRef} className="map-picker-container" />
    </div>
  );
}
