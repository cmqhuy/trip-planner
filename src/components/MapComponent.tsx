import { useEffect, useRef, memo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Place, PlaceGroup, Hotel, FlatTransportationSegment, Location } from '../types';
import { buildMapsLink, buildHotelMapsLink, buildTransitMapsLink } from '../utils/api';

interface MapComponentProps {
  places: Place[];
  activePlaceId?: string;
  placeGroups: PlaceGroup[];
  onMapClick?: (lat: number, lng: number) => void;
  previewMarker?: { lat: number; lng: number };
  onPlaceSelect?: (placeId: string | undefined) => void;
  activeMobileTab?: string;
  hotels?: Hotel[];
  transports?: FlatTransportationSegment[];
  locations?: Location[];
}

// Helpers for serializing to determine semantic value changes
const serializePlaces = (placesList: Place[]) => {
  return placesList.map(p => ({
    id: p.id,
    lat: p.lat,
    lng: p.lng,
    title: p.title,
    placeGroupId: p.placeGroupId,
    suggestedMarkers: p.suggestedMarkers?.map(sm => ({
      title: sm.title,
      lat: sm.lat,
      lng: sm.lng,
      type: sm.type
    }))
  }));
};

const serializePlaceGroups = (groups: PlaceGroup[]) => {
  return groups.map(g => ({
    id: g.id,
    color: g.color,
    icon: g.icon
  }));
};

const serializeHotels = (hotelsList: Hotel[]) => {
  return hotelsList.map(h => ({
    id: h.id,
    lat: h.lat,
    lng: h.lng,
    name: h.name,
    status: h.status
  }));
};

const serializeTransports = (transportsList: FlatTransportationSegment[]) => {
  return transportsList.map(t => ({
    id: t.id,
    departureLat: t.departureLat,
    departureLng: t.departureLng,
    arrivalLat: t.arrivalLat,
    arrivalLng: t.arrivalLng,
    name: t.reservationName,
    status: t.status
  }));
};

const getStatusColor = (status?: string) => {
  const s = status || 'Planning';
  return s === 'Confirmed' ? '#4ade80' : '#facc15';
};

const getTransitSvgIcon = (type: string) => {
  switch (type) {
    case 'flight':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3.5c-.5-.5-2.5 0-4 1.5L13.5 8.5 5.3 6.7c-.9-.2-1.7.5-1.5 1.4l1.3 3.9L2 15.3V17l5.3-.9 3.2 3.2c.4.4 1 .4 1.4 0l1.8-1.8H15l-.9 5.3 1.7-1.3 3.9 1.3c.9.2 1.6-.6 1.4-1.5z"/></svg>`;
    case 'train':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="16" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="m8 19-2 3"/><path d="m16 19 2 3"/></svg>`;
    case 'bus':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h8"/><path d="M6 10h12"/><path d="M4 14h16"/><rect width="16" height="16" x="4" y="3" rx="2"/><path d="m8 19-2 3"/><path d="m16 19 2 3"/></svg>`;
    case 'car':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>`;
    case 'ferry':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2M2 17h20M12 3v10M12 3 7 8h10z"/></svg>`;
    default:
      return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>`;
  }
};

function MapComponent({ 
  places, 
  activePlaceId, 
  placeGroups, 
  onMapClick, 
  previewMarker,
  onPlaceSelect,
  activeMobileTab,
  hotels = [],
  transports = [],
  locations = []
}: MapComponentProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerGroupRef = useRef<L.FeatureGroup | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  // Store click callbacks in refs to prevent map re-initialization
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  const onPlaceSelectRef = useRef(onPlaceSelect);
  useEffect(() => {
    onPlaceSelectRef.current = onPlaceSelect;
  }, [onPlaceSelect]);

  // Track previous states to optimize rendering and view adjustments
  const prevPlacesSerializedRef = useRef<string>('');
  const prevPlaceGroupsSerializedRef = useRef<string>('');
  const prevActivePlaceIdRef = useRef<string | undefined>(undefined);
  const prevPreviewMarkerSerializedRef = useRef<string>('');
  const prevActiveMobileTabRef = useRef<string>(activeMobileTab);
  const prevHotelsSerializedRef = useRef<string>('');
  const prevTransportsSerializedRef = useRef<string>('');

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

  // Invalidate map size when tab switches to map to fix zoom/pan layout offsets
  useEffect(() => {
    const map = mapInstance.current;
    if (map && activeMobileTab === 'map' && prevActiveMobileTabRef.current !== 'map') {
      setTimeout(() => {
        if (mapInstance.current) {
          mapInstance.current.invalidateSize({ animate: false });
          
          // Force re-centering after invalidation only once on transition
          if (activePlaceId) {
            const activePlace = places.find(p => p.id === activePlaceId);
            if (activePlace) {
              mapInstance.current.setView([activePlace.lat, activePlace.lng], Math.max(mapInstance.current.getZoom(), 15));
            }
          } else if (places.length > 0) {
            const latlngs = places.map(p => [p.lat, p.lng] as [number, number]);
            mapInstance.current.fitBounds(L.latLngBounds(latlngs), { padding: [50, 50] });
          }
        }
      }, 150);
    }
    prevActiveMobileTabRef.current = activeMobileTab;
  }, [activeMobileTab, activePlaceId, places]);

  // Update Markers & Lines
  useEffect(() => {
    const map = mapInstance.current;
    const markerGroup = markerGroupRef.current;
    if (!map || !markerGroup) return;

    // Serialize current states for change detection
    const placesSerialized = JSON.stringify(serializePlaces(places));
    const placeGroupsSerialized = JSON.stringify(serializePlaceGroups(placeGroups));
    const previewMarkerSerialized = JSON.stringify(previewMarker);
    const hotelsSerialized = JSON.stringify(serializeHotels(hotels));
    const transportsSerialized = JSON.stringify(serializeTransports(transports));

    // Determine what changed
    const placesChanged = placesSerialized !== prevPlacesSerializedRef.current;
    const groupsChanged = placeGroupsSerialized !== prevPlaceGroupsSerializedRef.current;
    const activePlaceChanged = activePlaceId !== prevActivePlaceIdRef.current;
    const previewMarkerChanged = previewMarkerSerialized !== prevPreviewMarkerSerializedRef.current;
    const hotelsChanged = hotelsSerialized !== prevHotelsSerializedRef.current;
    const transportsChanged = transportsSerialized !== prevTransportsSerializedRef.current;

    const needsMarkerUpdate = placesChanged || groupsChanged || activePlaceChanged || previewMarkerChanged || hotelsChanged || transportsChanged;

    if (!needsMarkerUpdate) {
      // Nothing affecting markers or view focus has changed, skip to avoid resetting zoom/pan and closing popups
      return;
    }

    // Clear previous markers
    markerGroup.clearLayers();

    // Clear previous polyline
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    // Process places marker positioning
    const latlngs: [number, number][] = [];

    const placeCity: Record<string, string> = {};
    for (const loc of locations) {
      for (const p of loc.places) {
        placeCity[p.id] = loc.city;
      }
    }

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

      const mapsLink = place.mapsLink || buildMapsLink(place.title, place.lat, place.lng, placeCity[place.id]);

      const marker = L.marker([place.lat, place.lng], { icon })
        .on('click', () => {
          if (onPlaceSelectRef.current) {
            onPlaceSelectRef.current(place.id);
          }
        })
        .bindPopup(`
          <div class="map-popup-card">
            <h4 style="margin-top:0;">${place.title}</h4>
            <p style="margin-bottom: 6px; font-size:11px; color:#94a3b8; line-height:1.3;">${place.description || 'No description available.'}</p>
            ${place.openingHours ? `<p style="font-size:10px; color:#94a3b8; margin-bottom: 8px; display: flex; align-items: center;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; display: inline-block; flex-shrink: 0;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>${place.openingHours}</p>` : ''}
            <div style="display: flex; gap: 8px; margin-top: 8px; border-top:1px solid rgba(255,255,255,0.05); padding-top:6px;">
              <a href="${mapsLink}" target="_blank" rel="noopener noreferrer" style="font-size:10px; text-decoration:none; color:#818cf8; font-weight:600; display:inline-block;">Google Maps</a>
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
              </div>
            </div>
          `);

        markerGroup.addLayer(marker);
      });
    }

    // Process hotels and transits
    const boundsLatLngs: [number, number][] = [...latlngs];

    hotels.forEach(h => {
      if (h.lat === undefined || h.lng === undefined || isNaN(h.lat) || isNaN(h.lng)) return;
      boundsLatLngs.push([h.lat, h.lng]);
      const statusColor = getStatusColor(h.status);
      const mapsLink = buildHotelMapsLink(h);

      const icon = L.divIcon({
        className: 'custom-map-marker-hotel',
        html: `
          <div style="
            position: relative;
            width: 32px;
            height: 32px;
            background: ${statusColor};
            border: 2px solid #ffffff;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5), 0 0 12px ${statusColor};
            color: #ffffff;
          ">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="22" x2="9" y2="16"/><line x1="15" y1="22" x2="15" y2="16"/><line x1="9" y1="16" x2="15" y2="16"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/></svg>
            <div style="
              position: absolute;
              bottom: -6px;
              left: 50%;
              transform: translateX(-50%);
              background: #ffffff;
              color: #0b0f19;
              border: 1px solid ${statusColor};
              border-radius: 4px;
              padding: 1px 4px;
              font-size: 8px;
              font-weight: 800;
              text-transform: uppercase;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              white-space: nowrap;
            ">
              Hotel
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
      });

      const marker = L.marker([h.lat, h.lng], { icon })
        .bindPopup(`
          <div class="map-popup-card">
            <h4 style="color:${statusColor}; margin-top:0; display:flex; align-items:center; gap:6px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="22" x2="9" y2="16"/><line x1="15" y1="22" x2="15" y2="16"/><line x1="9" y1="16" x2="15" y2="16"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/></svg>
              ${h.name}
            </h4>
            ${h.address ? `<p style="margin-bottom:6px; font-size:11px; color:#94a3b8; line-height:1.3;">${h.address}</p>` : ''}
            <p style="font-size:10px; color:#94a3b8; margin-bottom:4px; display:flex; align-items:center;">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px; flex-shrink:0;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Check-in: ${h.checkInDate} ${h.checkInTime || ''}
            </p>
            <p style="font-size:10px; color:#94a3b8; margin-bottom:8px; display:flex; align-items:center;">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px; flex-shrink:0;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Check-out: ${h.checkOutDate} ${h.checkOutTime || ''}
            </p>
            ${h.confirmationNo ? `<p style="font-size:10px; color:#a78bfa; font-weight:600; margin-bottom:8px;">Conf #: ${h.confirmationNo}</p>` : ''}
            <div style="display: flex; gap: 8px; margin-top: 8px; border-top:1px solid rgba(255,255,255,0.05); padding-top:6px;">
              <a href="${mapsLink}" target="_blank" rel="noopener noreferrer" style="font-size:10px; text-decoration:none; color:#818cf8; font-weight:600; display:inline-block;">Google Maps</a>
            </div>
          </div>
        `);
      markerGroup.addLayer(marker);
    });

    transports.forEach(t => {
      // Departure point
      if (t.departureLat !== undefined && t.departureLng !== undefined && !isNaN(t.departureLat) && !isNaN(t.departureLng)) {
        boundsLatLngs.push([t.departureLat, t.departureLng]);
        const statusColor = getStatusColor(t.status);
        const transitSvg = getTransitSvgIcon(t.type);
        const mapsLink = buildTransitMapsLink(t.departureLocationName, t.departureAddress);

        const icon = L.divIcon({
          className: 'custom-map-marker-transit-dep',
          html: `
            <div style="
              position: relative;
              width: 32px;
              height: 32px;
              background: ${statusColor};
              border: 2px solid #ffffff;
              border-radius: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 10px rgba(0,0,0,0.5), 0 0 12px ${statusColor};
              color: #ffffff;
            ">
              ${transitSvg}
              <div style="
                position: absolute;
                bottom: -6px;
                left: 50%;
                transform: translateX(-50%);
                background: #ffffff;
                color: #0b0f19;
                border: 1px solid ${statusColor};
                border-radius: 4px;
                padding: 1px 4px;
                font-size: 8px;
                font-weight: 800;
                text-transform: uppercase;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                white-space: nowrap;
              ">
                DEP
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -16]
        });

        const marker = L.marker([t.departureLat, t.departureLng], { icon })
          .bindPopup(`
            <div class="map-popup-card">
              <h4 style="color:${statusColor}; margin-top:0; display:flex; align-items:center; gap:6px;">
                <span style="display:inline-flex; align-items:center; justify-content:center; flex-shrink:0;">${transitSvg}</span>
                ${t.reservationName || 'Transit'}
              </h4>
              <p style="margin-bottom:6px; font-size:11px; color:#94a3b8; line-height:1.3;">Departure: ${t.departureLocationName}${t.departureAddress ? ` (${t.departureAddress})` : ''}</p>
              <p style="font-size:10px; color:#94a3b8; margin-bottom:4px; display:flex; align-items:center;">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px; flex-shrink:0;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Time: ${t.departureDate} ${t.departureTime} (${t.departureTimezone || 'UTC'})
              </p>
              ${t.carrier || t.transitCode ? `<p style="font-size:10px; color:#94a3b8; margin-bottom:4px;">Carrier: ${[t.carrier, t.transitCode].filter(Boolean).join(' · ')}</p>` : ''}
              ${t.confirmationNo ? `<p style="font-size:10px; color:#a78bfa; font-weight:600; margin-bottom:8px;">Conf #: ${t.confirmationNo}</p>` : ''}
              <div style="display: flex; gap: 8px; margin-top: 8px; border-top:1px solid rgba(255,255,255,0.05); padding-top:6px;">
                <a href="${mapsLink}" target="_blank" rel="noopener noreferrer" style="font-size:10px; text-decoration:none; color:#818cf8; font-weight:600; display:inline-block;">Google Maps</a>
              </div>
            </div>
          `);
        markerGroup.addLayer(marker);
      }

      // Arrival point
      if (t.arrivalLat !== undefined && t.arrivalLng !== undefined && !isNaN(t.arrivalLat) && !isNaN(t.arrivalLng)) {
        boundsLatLngs.push([t.arrivalLat, t.arrivalLng]);
        const statusColor = getStatusColor(t.status);
        const transitSvg = getTransitSvgIcon(t.type);
        const mapsLink = buildTransitMapsLink(t.arrivalLocationName, t.arrivalAddress);

        const icon = L.divIcon({
          className: 'custom-map-marker-transit-arr',
          html: `
            <div style="
              position: relative;
              width: 32px;
              height: 32px;
              background: ${statusColor};
              border: 2px solid #ffffff;
              border-radius: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 10px rgba(0,0,0,0.5), 0 0 12px ${statusColor};
              color: #ffffff;
            ">
              ${transitSvg}
              <div style="
                position: absolute;
                bottom: -6px;
                left: 50%;
                transform: translateX(-50%);
                background: #ffffff;
                color: #0b0f19;
                border: 1px solid ${statusColor};
                border-radius: 4px;
                padding: 1px 4px;
                font-size: 8px;
                font-weight: 800;
                text-transform: uppercase;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                white-space: nowrap;
              ">
                ARR
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -16]
        });

        const marker = L.marker([t.arrivalLat, t.arrivalLng], { icon })
          .bindPopup(`
            <div class="map-popup-card">
              <h4 style="color:${statusColor}; margin-top:0; display:flex; align-items:center; gap:6px;">
                <span style="display:inline-flex; align-items:center; justify-content:center; flex-shrink:0;">${transitSvg}</span>
                ${t.reservationName || 'Transit'}
              </h4>
              <p style="margin-bottom:6px; font-size:11px; color:#94a3b8; line-height:1.3;">Arrival: ${t.arrivalLocationName}${t.arrivalAddress ? ` (${t.arrivalAddress})` : ''}</p>
              <p style="font-size:10px; color:#94a3b8; margin-bottom:4px; display:flex; align-items:center;">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px; flex-shrink:0;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Time: ${t.arrivalDate} ${t.arrivalTime} (${t.arrivalTimezone || 'UTC'})
              </p>
              ${t.carrier || t.transitCode ? `<p style="font-size:10px; color:#94a3b8; margin-bottom:4px;">Carrier: ${[t.carrier, t.transitCode].filter(Boolean).join(' · ')}</p>` : ''}
              ${t.confirmationNo ? `<p style="font-size:10px; color:#a78bfa; font-weight:600; margin-bottom:8px;">Conf #: ${t.confirmationNo}</p>` : ''}
              <div style="display: flex; gap: 8px; margin-top: 8px; border-top:1px solid rgba(255,255,255,0.05); padding-top:6px;">
                <a href="${mapsLink}" target="_blank" rel="noopener noreferrer" style="font-size:10px; text-decoration:none; color:#818cf8; font-weight:600; display:inline-block;">Google Maps</a>
              </div>
            </div>
          `);
        markerGroup.addLayer(marker);
      }
    });

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

    // Smart Map View Adjustments (zoom/pan) - Only run when the focus/day changes to avoid map snapping
    if (!previewMarker) {
      map.invalidateSize({ animate: false });
      // Scenario A: User newly selected a place/neighborhood
      if (activePlaceChanged && activePlaceId) {
        if (activePlace) {
          if (activePlace.suggestedMarkers && activePlace.suggestedMarkers.length > 0) {
            // Neighborhood/area: fit bounds around the active place and all its suggested markers
            const points: L.LatLngExpression[] = [[activePlace.lat, activePlace.lng]];
            activePlace.suggestedMarkers.forEach(sm => {
              if (!isNaN(sm.lat) && !isNaN(sm.lng)) {
                points.push([sm.lat, sm.lng]);
              }
            });
            const neighborhoodBounds = L.latLngBounds(points);
            map.fitBounds(neighborhoodBounds, {
              padding: [50, 50],
              maxZoom: 16
            });
          } else {
            // Single point: center map on the selected place at a closer zoom level
            map.setView([activePlace.lat, activePlace.lng], 15);
          }
        }
      }
      // Scenario B: Active place was cleared, or day changed with no active place
      else if ((activePlaceChanged && !activePlaceId) || (placesChanged && !activePlaceId) || hotelsChanged || transportsChanged) {
        if (boundsLatLngs.length > 0) {
          // Fit map view to see all scheduled places
          const bounds = L.latLngBounds(boundsLatLngs);
          map.fitBounds(bounds, {
            padding: [60, 60],
            maxZoom: 16
          });
        } else {
          // Empty state: default global view
          map.setView([20, 0], 2);
        }
      }
    } else if (previewMarkerChanged && !isNaN(previewMarker.lat) && !isNaN(previewMarker.lng)) {
      // Auto-pan map to the newly dropped pin location in dialog edit views
      map.setView([previewMarker.lat, previewMarker.lng], Math.max(map.getZoom(), 15));
    }

    // Save current values to refs for the next run
    prevPlacesSerializedRef.current = placesSerialized;
    prevPlaceGroupsSerializedRef.current = placeGroupsSerialized;
    prevActivePlaceIdRef.current = activePlaceId;
    prevPreviewMarkerSerializedRef.current = previewMarkerSerialized;
    prevHotelsSerializedRef.current = hotelsSerialized;
    prevTransportsSerializedRef.current = transportsSerialized;

  }, [places, activePlaceId, placeGroups, previewMarker, hotels, transports]);

  return (
    <div 
      ref={mapContainerRef} 
      className="leaflet-container" 
      style={{ width: '100%', height: '100%', minHeight: '300px' }}
    />
  );
}

export default memo(MapComponent);
