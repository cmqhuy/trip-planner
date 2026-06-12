import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Place, PlaceGroup } from '../types';

interface MapComponentProps {
  places: Place[];
  activePlaceId?: string;
  placeGroups: PlaceGroup[];
  onMapClick?: (lat: number, lng: number) => void;
  previewMarker?: { lat: number; lng: number };
}

export default function MapComponent({ 
  places, 
  activePlaceId, 
  placeGroups, 
  onMapClick, 
  previewMarker 
}: MapComponentProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerGroupRef = useRef<L.FeatureGroup | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  // Store click callback in a mutable ref to prevent map re-initialization
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Center on Europe/World default if empty
    const map = L.map(mapContainerRef.current, {
      zoomControl: false
    }).setView([20, 0], 2);

    // Zoom buttons in top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Use OpenStreetMap Dark-adjusted Carto tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    // Listen to map clicks to support pin dropping
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (onMapClickRef.current) {
        onMapClickRef.current(e.latlng.lat, e.latlng.lng);
      }
    });

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

    // Process places marker positioning
    const latlngs: [number, number][] = [];
    
    places.forEach((place, index) => {
      latlngs.push([place.lat, place.lng]);

      // Resolve color of the marker based on its PlaceGroup
      const group = placeGroups.find(g => g.id === place.placeGroupId);
      const groupColor = group?.color || '#6366f1';

      const svgMap: Record<string, string> = {
        'landmark': `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><path d="m12 2-10 9h20z"/><path d="M12 11v7"/></svg>`,
        'utensils': `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>`,
        'shopping-bag': `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
        'camera': `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`,
        'map-pin': `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
        'heart': `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`
      };
      const svgIcon = svgMap[group?.icon || ''] || svgMap['map-pin'];

      // Styled marker showing sequence number and category color
      const icon = L.divIcon({
        className: 'custom-map-marker-container',
        html: `
          <div style="
            position: relative;
            width: 32px;
            height: 32px;
            background: ${groupColor};
            border: 2px solid #ffffff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5), 0 0 12px ${groupColor};
            color: #ffffff;
            transition: all 0.2s ease-in-out;
            ${activePlaceId === place.id ? 'transform: scale(1.25); border-color: #f59e0b; box-shadow: 0 0 20px #f59e0b;' : ''}
          ">
            ${svgIcon}
            <!-- Small sequence number badge on top-right -->
            <div style="
              position: absolute;
              top: -6px;
              right: -6px;
              background: #ffffff;
              color: #0b0f19;
              border: 1px solid ${groupColor};
              border-radius: 50%;
              width: 14px;
              height: 14px;
              font-size: 9px;
              font-weight: 800;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            ">
              ${index + 1}
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
      });

      const mapsLink = place.mapsLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.title)}`;
      const directionsLink = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place.title)}&destination_place_id=&travelmode=walking`;

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

    // Render AI suggested markers for active place
    const activePlace = places.find(p => p.id === activePlaceId);
    if (activePlace && activePlace.suggestedMarkers && Array.isArray(activePlace.suggestedMarkers)) {
      activePlace.suggestedMarkers.forEach(sm => {
        if (isNaN(sm.lat) || isNaN(sm.lng)) return;

        const aiSvgMap: Record<string, string> = {
          'street': `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h.01"/><path d="M6 8h.01"/><path d="M2 12h20"/><path d="M12 2v20"/><path d="M12 12H6"/></svg>`,
          'landmark': `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><path d="m12 2-10 9h20z"/></svg>`,
          'shop': `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/></svg>`,
          'station': `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 15h8"/><path d="M12 11V6"/></svg>`,
          'cafe': `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><path d="M6 2v2"/><path d="M10 2v2"/><path d="M14 2v2"/></svg>`,
          'sparkles': `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z"/></svg>`
        };

        const aiIcon = L.divIcon({
          className: 'custom-map-marker-ai-suggested',
          html: `
            <div style="
              position: relative;
              width: 26px;
              height: 26px;
              background: rgba(17, 24, 39, 0.95);
              border: 2px solid #c084fc;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 0 12px #c084fc, 0 2px 6px rgba(0,0,0,0.6);
              color: #e9d5ff;
            ">
              ${aiSvgMap[sm.type] || aiSvgMap['sparkles']}
              <!-- Small sparkles badge on top-right -->
              <div style="
                position: absolute;
                top: -5px;
                right: -5px;
                background: #c084fc;
                color: #0b0f19;
                border-radius: 50%;
                width: 11px;
                height: 11px;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
              ">
                <svg xmlns="http://www.w3.org/2000/svg" width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z"/></svg>
              </div>
            </div>
          `,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
          popupAnchor: [0, -13]
        });

        const mapsLink = `https://www.google.com/maps/search/?api=1&query=${sm.lat},${sm.lng}`;
        const directionsLink = `https://www.google.com/maps/dir/?api=1&destination=${sm.lat},${sm.lng}&travelmode=walking`;

        const marker = L.marker([sm.lat, sm.lng], { icon: aiIcon })
          .bindPopup(`
            <div class="map-popup-card">
              <h4 style="color:#d8b4fe; font-size:11.5px; display:flex; align-items:center; gap:4px; margin-top:0;">
                ✨ ${sm.title} 
                <span style="font-size:8.5px; padding:1px 4px; background:rgba(192,132,252,0.15); border:1px solid rgba(192,132,252,0.3); color:#c084fc; border-radius:4px; font-weight:normal;">
                  ${sm.type.toUpperCase()}
                </span>
              </h4>
              <p style="margin-bottom: 6px; font-size:11px; color:#cbd5e1; line-height:1.3;">${sm.description || 'Suggested area highlight.'}</p>
              <div style="display: flex; gap: 8px; margin-top: 6px; border-top:1px solid rgba(255,255,255,0.05); padding-top:6px;">
                <a href="${mapsLink}" target="_blank" rel="noopener noreferrer" style="font-size:9.5px; text-decoration:none; color:#c084fc; font-weight:600;">Google Maps</a>
                <span style="color:#475569;">|</span>
                <a href="${directionsLink}" target="_blank" rel="noopener noreferrer" style="font-size:9.5px; text-decoration:none; color:#34d399; font-weight:600;">Directions</a>
              </div>
            </div>
          `);

        markerGroup.addLayer(marker);
      });
    }

    // Render preview/pin-drop marker if available
    if (previewMarker && !isNaN(previewMarker.lat) && !isNaN(previewMarker.lng)) {
      const previewIcon = L.divIcon({
        className: 'custom-map-marker-preview',
        html: `
          <div style="
            width: 32px;
            height: 32px;
            background: #f59e0b;
            border: 2px dashed #ffffff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 15px #f59e0b;
            font-size: 16px;
          ">
            📍
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
      L.marker([previewMarker.lat, previewMarker.lng], { icon: previewIcon }).addTo(markerGroup);
      
      // Auto-pan map to the newly dropped pin location
      map.panTo([previewMarker.lat, previewMarker.lng]);
    }

    if (places.length === 0) {
      if (!previewMarker) {
        // Zoom out to global view if completely empty
        map.setView([20, 0], 2);
      }
      return;
    }

    // Draw route line
    if (latlngs.length > 1) {
      polylineRef.current = L.polyline(latlngs, {
        color: '#6366f1',
        weight: 3,
        opacity: 0.8,
        dashArray: '5, 8',
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
    }

    // Fit map view to markers (if no preview pin is active, to avoid overriding manual pin drops)
    if (!previewMarker) {
      try {
        const bounds = markerGroup.getBounds();
        map.fitBounds(bounds, {
          padding: [60, 60],
          maxZoom: 16
        });
      } catch (e) {
        map.setView(latlngs[0], 13);
      }
    }
  }, [places, activePlaceId, placeGroups, previewMarker]);

  return (
    <div 
      ref={mapContainerRef} 
      className="leaflet-container" 
      style={{ width: '100%', height: '100%', minHeight: '300px' }}
    />
  );
}
