import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface DualMapPickerProps {
  depLat: number;
  depLng: number;
  arrLat: number;
  arrLng: number;
  onDepPick: (lat: number, lng: number) => void;
  onArrPick: (lat: number, lng: number) => void;
}

function makeDepIcon() {
  return L.divIcon({
    className: 'map-picker-pin',
    html: `<div style="
      width:28px;height:28px;background:#22c55e;border:2px solid #fff;
      border-radius:50%;display:flex;align-items:center;justify-content:center;
      box-shadow:0 0 12px #22c55e;color:#fff;font-size:11px;font-weight:700;
    ">D</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function makeArrIcon() {
  return L.divIcon({
    className: 'map-picker-pin',
    html: `<div style="
      width:28px;height:28px;background:#f59e0b;border:2px solid #fff;
      border-radius:50%;display:flex;align-items:center;justify-content:center;
      box-shadow:0 0 12px #f59e0b;color:#fff;font-size:11px;font-weight:700;
    ">A</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export default function DualMapPicker({ depLat, depLng, arrLat, arrLng, onDepPick, onArrPick }: DualMapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const depMarkerRef = useRef<L.Marker | null>(null);
  const arrMarkerRef = useRef<L.Marker | null>(null);
  const [activeMarker, setActiveMarker] = useState<'dep' | 'arr'>('dep');
  const activeMarkerRef = useRef<'dep' | 'arr'>('dep');
  const onDepPickRef = useRef(onDepPick);
  const onArrPickRef = useRef(onArrPick);

  useEffect(() => { onDepPickRef.current = onDepPick; }, [onDepPick]);
  useEffect(() => { onArrPickRef.current = onArrPick; }, [onArrPick]);
  useEffect(() => { activeMarkerRef.current = activeMarker; }, [activeMarker]);

  // Initialize once
  useEffect(() => {
    if (!containerRef.current) return;

    const hasDepCoords = !isNaN(depLat) && !isNaN(depLng);
    const hasArrCoords = !isNaN(arrLat) && !isNaN(arrLng);

    let centerLat = 20, centerLng = 0, zoom = 2;
    if (hasDepCoords && hasArrCoords) {
      centerLat = (depLat + arrLat) / 2;
      centerLng = (depLng + arrLng) / 2;
      zoom = 5;
    } else if (hasDepCoords) {
      centerLat = depLat; centerLng = depLng; zoom = 13;
    } else if (hasArrCoords) {
      centerLat = arrLat; centerLng = arrLng; zoom = 13;
    }

    const map = L.map(containerRef.current, { zoomControl: false }).setView([centerLat, centerLng], zoom);
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OSM &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    if (hasDepCoords) {
      depMarkerRef.current = L.marker([depLat, depLng], { icon: makeDepIcon() }).addTo(map);
    }
    if (hasArrCoords) {
      arrMarkerRef.current = L.marker([arrLat, arrLng], { icon: makeArrIcon() }).addTo(map);
    }

    // Fit bounds when both coords valid
    if (hasDepCoords && hasArrCoords) {
      map.fitBounds([[depLat, depLng], [arrLat, arrLng]], { padding: [30, 30] });
    }

    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat: clickLat, lng: clickLng } = e.latlng;
      if (activeMarkerRef.current === 'dep') {
        if (depMarkerRef.current) {
          depMarkerRef.current.setLatLng([clickLat, clickLng]);
        } else {
          depMarkerRef.current = L.marker([clickLat, clickLng], { icon: makeDepIcon() }).addTo(map);
        }
        onDepPickRef.current(clickLat, clickLng);
      } else {
        if (arrMarkerRef.current) {
          arrMarkerRef.current.setLatLng([clickLat, clickLng]);
        } else {
          arrMarkerRef.current = L.marker([clickLat, clickLng], { icon: makeArrIcon() }).addTo(map);
        }
        onArrPickRef.current(clickLat, clickLng);
      }
    });

    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 150);

    return () => {
      map.remove();
      mapRef.current = null;
      depMarkerRef.current = null;
      arrMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync departure marker when props change externally
  useEffect(() => {
    const map = mapRef.current;
    if (!map || isNaN(depLat) || isNaN(depLng)) return;
    if (depMarkerRef.current) {
      depMarkerRef.current.setLatLng([depLat, depLng]);
    } else {
      depMarkerRef.current = L.marker([depLat, depLng], { icon: makeDepIcon() }).addTo(map);
    }
  }, [depLat, depLng]);

  // Sync arrival marker when props change externally
  useEffect(() => {
    const map = mapRef.current;
    if (!map || isNaN(arrLat) || isNaN(arrLng)) return;
    if (arrMarkerRef.current) {
      arrMarkerRef.current.setLatLng([arrLat, arrLng]);
    } else {
      arrMarkerRef.current = L.marker([arrLat, arrLng], { icon: makeArrIcon() }).addTo(map);
    }
  }, [arrLat, arrLng]);

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
