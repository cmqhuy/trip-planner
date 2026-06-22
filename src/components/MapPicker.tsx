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
          width:28px;height:28px;background:#6366f1;border:2px solid #fff;
          border-radius:50%;display:flex;align-items:center;justify-content:center;
          box-shadow:0 0 14px rgba(99,102,241,0.8);color:#fff;
        "><svg xmlns='http://www.w3.org/2000/svg' width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z'/><circle cx='12' cy='10' r='3'/></svg></div>`,
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
          html: `<div style='width:28px;height:28px;background:#6366f1;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 14px rgba(99,102,241,0.8);color:#fff;'><svg xmlns='http://www.w3.org/2000/svg' width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z'/><circle cx='12' cy='10' r='3'/></svg></div>`,
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
          width:28px;height:28px;background:#6366f1;border:2px solid #fff;
          border-radius:50%;display:flex;align-items:center;justify-content:center;
          box-shadow:0 0 14px rgba(99,102,241,0.8);color:#fff;
        "><svg xmlns='http://www.w3.org/2000/svg' width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z'/><circle cx='12' cy='10' r='3'/></svg></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
      markerRef.current = L.marker([lat, lng], { icon }).addTo(map);
    }

    map.setView([lat, lng], Math.max(map.getZoom(), 13));
  }, [lat, lng]);

  return (
    <div ref={containerRef} className="map-picker-container" />
  );
}
