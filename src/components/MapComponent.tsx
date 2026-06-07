import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Place } from '../types';

interface MapComponentProps {
  places: Place[];
  activePlaceId?: string;
}

export default function MapComponent({ places, activePlaceId }: MapComponentProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerGroupRef = useRef<L.FeatureGroup | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Center on Europe/World default if empty
    const map = L.map(mapContainerRef.current, {
      zoomControl: false // Custom placement later or default
    }).setView([20, 0], 2);

    // Zoom buttons in top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Use OpenStreetMap Dark-adjusted Carto tiles or standard OpenStreetMap
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    mapInstance.current = map;
    markerGroupRef.current = L.featureGroup().addTo(map);

    return () => {
      map.remove();
      mapInstance.current = null;
      markerGroupRef.current = null;
      polylineRef.current = null;
    };
  }, []);

  // Update Markers & Lines
  useEffect(() => {
    const map = mapInstance.current;
    const markerGroup = markerGroupRef.current;
    if (!map || !markerGroup) return;

    // Clear previous markers
    markerGroup.clearLayers();

    // Clear previous polyline
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    if (places.length === 0) {
      // Zoom out to global view if no places
      map.setView([20, 0], 2);
      return;
    }

    // Add new markers
    const latlngs: [number, number][] = [];
    
    places.forEach((place, index) => {
      latlngs.push([place.lat, place.lng]);

      // Premium CSS-styled marker showing sequence number (1, 2, 3...)
      const icon = L.divIcon({
        className: 'custom-map-marker-container',
        html: `
          <div style="
            width: 30px;
            height: 30px;
            background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
            border: 2px solid #ffffff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5), 0 0 12px rgba(99, 102, 241, 0.4);
            color: #ffffff;
            font-size: 11px;
            font-weight: 700;
            font-family: sans-serif;
            transition: all 0.2s ease-in-out;
            ${activePlaceId === place.id ? 'transform: scale(1.25); border-color: #f59e0b; box-shadow: 0 0 20px #f59e0b;' : ''}
          ">
            ${index + 1}
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -15]
      });

      const mapsLink = `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
      const directionsLink = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;

      const marker = L.marker([place.lat, place.lng], { icon })
        .bindPopup(`
          <div class="map-popup-card">
            <h4>${place.title}</h4>
            <p style="margin-bottom: 6px;">${place.description || 'No description available.'}</p>
            ${place.openingHours ? `<p style="font-size:10px; color:#94a3b8; margin-bottom: 8px;">🕒 ${place.openingHours}</p>` : ''}
            <div style="display: flex; gap: 8px; margin-top: 8px;">
              <a href="${mapsLink}" target="_blank" rel="noopener noreferrer" style="font-size:10px; text-decoration:none; color:#818cf8; font-weight:600; display:inline-block;">Google Maps</a>
              <span style="color:#64748b;">|</span>
              <a href="${directionsLink}" target="_blank" rel="noopener noreferrer" style="font-size:10px; text-decoration:none; color:#34d399; font-weight:600; display:inline-block;">Directions</a>
            </div>
          </div>
        `);

      markerGroup.addLayer(marker);

      // Programmatically open popup if it's the active place
      if (activePlaceId === place.id) {
        setTimeout(() => {
          marker.openPopup();
        }, 100);
      }
    });

    // Draw route line
    if (latlngs.length > 1) {
      polylineRef.current = L.polyline(latlngs, {
        color: '#6366f1',
        weight: 3,
        opacity: 0.8,
        dashArray: '5, 8', // dashed lines look great
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
    }

    // Fit map view to markers
    try {
      const bounds = markerGroup.getBounds();
      map.fitBounds(bounds, {
        padding: [60, 60],
        maxZoom: 16
      });
    } catch (e) {
      // Fallback centering
      map.setView(latlngs[0], 13);
    }
  }, [places, activePlaceId]);

  return (
    <div 
      ref={mapContainerRef} 
      className="leaflet-container" 
      style={{ width: '100%', height: '100%', minHeight: '300px' }}
    />
  );
}
