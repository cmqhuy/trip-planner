import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapPickerProps {
  lat: number;
  lng: number;
  onPick: (lat: number, lng: number) => void;
}

export default function MapPicker({ lat, lng, onPick }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onPickRef = useRef(onPick);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  // Initialize once
  useEffect(() => {
    if (!containerRef.current) return;

    const centerLat = isNaN(lat) ? 20 : lat;
    const centerLng = isNaN(lng) ? 0 : lng;
    const zoom = isNaN(lat) || isNaN(lng) ? 2 : 13;

    const map = L.map(containerRef.current, { zoomControl: false })
      .setView([centerLat, centerLng], zoom);

    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OSM &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    // Initial marker
    if (!isNaN(lat) && !isNaN(lng)) {
      const icon = L.divIcon({
        className: 'map-picker-pin',
        html: `<div style="
          width:28px;height:28px;background:#f59e0b;border:2px dashed #fff;
          border-radius:50%;display:flex;align-items:center;justify-content:center;
          box-shadow:0 0 14px #f59e0b;font-size:14px;
        ">📍</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
      markerRef.current = L.marker([lat, lng], { icon }).addTo(map);
    }

    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat: clickLat, lng: clickLng } = e.latlng;

      // Move or create marker
      if (markerRef.current) {
        markerRef.current.setLatLng([clickLat, clickLng]);
      } else {
        const icon = L.divIcon({
          className: 'map-picker-pin',
          html: `<div style="
            width:28px;height:28px;background:#f59e0b;border:2px dashed #fff;
            border-radius:50%;display:flex;align-items:center;justify-content:center;
            box-shadow:0 0 14px #f59e0b;font-size:14px;
          ">📍</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });
        markerRef.current = L.marker([clickLat, clickLng], { icon }).addTo(map);
      }

      onPickRef.current(clickLat, clickLng);
    });

    mapRef.current = map;

    // Invalidate size after a tick (modal animation may not be done)
    setTimeout(() => map.invalidateSize(), 150);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync marker position when lat/lng props change from outside (e.g. auto-populate)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (isNaN(lat) || isNaN(lng)) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      const icon = L.divIcon({
        className: 'map-picker-pin',
        html: `<div style="
          width:28px;height:28px;background:#f59e0b;border:2px dashed #fff;
          border-radius:50%;display:flex;align-items:center;justify-content:center;
          box-shadow:0 0 14px #f59e0b;font-size:14px;
        ">📍</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
      markerRef.current = L.marker([lat, lng], { icon }).addTo(map);
    }

    map.setView([lat, lng], Math.max(map.getZoom(), 13));
  }, [lat, lng]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '200px',
        borderRadius: '8px',
        border: '1px solid var(--border-glass)',
        overflow: 'hidden',
        marginTop: '4px'
      }}
    />
  );
}
