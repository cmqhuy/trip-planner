import type { Location, Place, PlaceGroup } from '../types';

// Standard place groups template for new locations
export const DEFAULT_PLACE_GROUPS: PlaceGroup[] = [
  { id: 'attractions', name: 'Attractions', color: '#ef4444', icon: 'landmark' }, // Red
  { id: 'shopping', name: 'Shopping', color: '#3b82f6', icon: 'shopping-bag' }, // Blue
  { id: 'restaurants', name: 'Food & Dining', color: '#10b981', icon: 'utensils' }, // Green
  { id: 'other', name: 'Others', color: '#6b7280', icon: 'map-pin' } // Gray
];

// Rich local fallback database for autocomplete & offline use
const FALLBACK_CITIES = [
  {
    city: 'Paris',
    country: 'France',
    countryCode: 'FR',
    lat: 48.8566,
    lng: 2.3522,
    heroPhoto: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80',
    places: [
      { id: 'osm-paris-eiffel', title: 'Eiffel Tower', description: 'Iconic 19th-century iron tower with views.', lat: 48.8584, lng: 2.2945, openingHours: '09:00 - 00:00', photoUrl: 'https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?auto=format&fit=crop&w=600&q=80', placeGroupId: 'attractions', notes: 'Book tickets online 2 months in advance!' },
      { id: 'osm-paris-louvre', title: 'Louvre Museum', description: 'Huge art museum hosting Mona Lisa.', lat: 48.8606, lng: 2.3376, openingHours: '09:00 - 18:00', photoUrl: 'https://images.unsplash.com/photo-1565008447742-97f6f38c985c?auto=format&fit=crop&w=600&q=80', placeGroupId: 'attractions', notes: 'Closed on Tuesdays. Enter through Carousel du Louvre.' },
      { id: 'osm-paris-notre-dame', title: 'Notre-Dame Cathedral', description: 'Famed medieval Catholic cathedral.', lat: 48.8530, lng: 2.3499, openingHours: '08:00 - 18:45', photoUrl: 'https://images.unsplash.com/photo-1549849171-09f62448c5dd?auto=format&fit=crop&w=600&q=80', placeGroupId: 'attractions' },
      { id: 'osm-paris-le-jules', title: 'Le Jules Verne', description: 'Fine dining Michelin-starred restaurant in the Eiffel Tower.', lat: 48.8584, lng: 2.2945, openingHours: '12:00 - 13:30, 19:00 - 21:30', photoUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=600&q=80', placeGroupId: 'restaurants', notes: 'Smart casual dress code required.' },
      { id: 'osm-paris-angelina', title: 'Angelina Paris', description: 'Famous tea house known for hot chocolate.', lat: 48.8631, lng: 2.3276, openingHours: '08:00 - 19:00', photoUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=600&q=80', placeGroupId: 'restaurants', notes: 'Get the African Hot Chocolate and Mont-Blanc pastry.' }
    ]
  },
  {
    city: 'Rome',
    country: 'Italy',
    countryCode: 'IT',
    lat: 41.9028,
    lng: 12.4964,
    heroPhoto: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1200&q=80',
    places: [
      { id: 'osm-rome-colosseum', title: 'Colosseum', description: 'Monumental 3-tiered Roman amphitheater.', lat: 41.8902, lng: 12.4922, openingHours: '08:30 - 19:00', photoUrl: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=600&q=80', placeGroupId: 'attractions', notes: 'Skip-the-line ticket is highly recommended.' },
      { id: 'osm-rome-pantheon', title: 'Pantheon', description: 'Iconic temple with a classical portico.', lat: 41.8986, lng: 12.4769, openingHours: '09:00 - 19:00', photoUrl: 'https://images.unsplash.com/photo-1531572753322-ad063cecc140?auto=format&fit=crop&w=600&q=80', placeGroupId: 'attractions' },
      { id: 'osm-rome-trevi', title: 'Trevi Fountain', description: 'Baroque masterpiece fountain.', lat: 41.9009, lng: 12.4833, openingHours: '24/7', photoUrl: 'https://images.unsplash.com/photo-1529260830199-44552cf3725f?auto=format&fit=crop&w=600&q=80', placeGroupId: 'attractions', notes: 'Throw a coin over your left shoulder to return to Rome!' },
      { id: 'osm-rome-carbonara', title: 'Roscioli Salumeria', description: 'Renowned deli and restaurant famous for carbonara.', lat: 41.8942, lng: 12.4731, openingHours: '12:30 - 23:30', photoUrl: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?auto=format&fit=crop&w=600&q=80', placeGroupId: 'restaurants', notes: 'Reservations are mandatory weeks in advance.' }
    ]
  },
  {
    city: 'Tokyo',
    country: 'Japan',
    countryCode: 'JP',
    lat: 35.6762,
    lng: 139.6503,
    heroPhoto: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80',
    places: [
      { id: 'osm-tokyo-sensoji', title: 'Senso-ji', description: 'Tokyos oldest Buddhist temple.', lat: 35.7148, lng: 139.7967, openingHours: '06:00 - 17:00', photoUrl: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=600&q=80', placeGroupId: 'attractions', notes: 'Walk along Nakamise Street for traditional snacks.' },
      { id: 'osm-tokyo-tower', title: 'Tokyo Tower', description: 'Eiffel Tower-inspired communications landmark.', lat: 35.6586, lng: 139.7454, openingHours: '09:00 - 23:00', photoUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?auto=format&fit=crop&w=600&q=80', placeGroupId: 'attractions' },
      { id: 'osm-tokyo-shibuya', title: 'Shibuya Crossing', description: 'World-famous pedestrian intersection.', lat: 35.6580, lng: 139.7016, openingHours: '24/7', photoUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80', placeGroupId: 'attractions', notes: 'Best views from the 2nd floor of Starbucks or Shibuya Sky.' },
      { id: 'osm-tokyo-sushi', title: 'Sushi Dai', description: 'Famous breakfast sushi spot in Toyosu.', lat: 35.6447, lng: 139.7892, openingHours: '05:00 - 14:00', photoUrl: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=600&q=80', placeGroupId: 'restaurants', notes: 'Line starts forming at 4:30 AM.' }
    ]
  },
  {
    city: 'New York City',
    state: 'NY',
    country: 'United States',
    countryCode: 'US',
    lat: 40.7128,
    lng: -74.0060,
    heroPhoto: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=1200&q=80',
    places: [
      { id: 'osm-ny-statue', title: 'Statue of Liberty', description: 'Colossal neoclassical copper monument.', lat: 40.6892, lng: -74.0445, openingHours: '08:30 - 16:00', photoUrl: 'https://images.unsplash.com/photo-1508849789987-4e5333c12b78?auto=format&fit=crop&w=600&q=80', placeGroupId: 'attractions', notes: 'Take the Staten Island Ferry for a free view, or Liberty Cruise.' },
      { id: 'osm-ny-times', title: 'Times Square', description: 'Brightly illuminated commercial intersection.', lat: 40.7580, lng: -73.9855, openingHours: '24/7', photoUrl: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?auto=format&fit=crop&w=600&q=80', placeGroupId: 'attractions' },
      { id: 'osm-ny-central', title: 'Central Park', description: 'Sprawling urban park with trails and lakes.', lat: 40.7829, lng: -73.9654, openingHours: '06:00 - 01:00', photoUrl: 'https://images.unsplash.com/photo-1513829096999-4978602294f4?auto=format&fit=crop&w=600&q=80', placeGroupId: 'attractions' },
      { id: 'osm-ny-katz', title: 'Katz Deli', description: 'Legendary deli famous for pastrami on rye.', lat: 40.7222, lng: -73.9874, openingHours: '08:00 - 22:45', photoUrl: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=600&q=80', placeGroupId: 'restaurants', notes: 'Cash only! Hang on to the ticket they give you at the door.' }
    ]
  },
  {
    city: 'San Francisco',
    state: 'CA',
    country: 'United States',
    countryCode: 'US',
    lat: 37.7749,
    lng: -122.4194,
    heroPhoto: 'https://images.unsplash.com/photo-1506012787146-f92b2d7d6d96?auto=format&fit=crop&w=1200&q=80',
    places: [
      { id: 'osm-sf-bridge', title: 'Golden Gate Bridge', description: 'Famed orange suspension bridge.', lat: 37.8199, lng: -122.4783, openingHours: '24/7', photoUrl: 'https://images.unsplash.com/photo-1506012787146-f92b2d7d6d96?auto=format&fit=crop&w=600&q=80', placeGroupId: 'attractions', notes: 'Walk or rent a bike to cross. Great photos from Battery Spencer.' }
    ]
  }
];

// 1. Search Wikipedia for description and images (CORS-friendly open api)
export async function fetchWikipediaData(title: string): Promise<{ description: string; photoUrl: string }> {
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages|extracts&exintro&explaintext&titles=${encodeURIComponent(title)}&pithumbsize=1000`;
    const response = await fetch(searchUrl);
    if (!response.ok) throw new Error('Wiki network response failed');
    const data = await response.json();
    const pages = data.query?.pages;
    if (pages) {
      const pageId = Object.keys(pages)[0];
      if (pageId && pageId !== '-1') {
        const page = pages[pageId];
        const description = page.extract ? page.extract.split('\n')[0] : '';
        const photoUrl = page.thumbnail?.source || '';
        return { description, photoUrl };
      }
    }
  } catch (e) {
    console.warn('Failed Wikipedia fetch for', title, e);
  }
  return { description: '', photoUrl: '' };
}


// 2. Search Locations (cities) using OpenStreetMap Nominatim Geocoding API
export async function searchLocation(query: string): Promise<Omit<Location, 'places'>[]> {
  if (!query || query.trim().length < 2) return [];

  const trimmed = query.trim().toLowerCase();
  
  // Check local database first for instant lookup
  const localMatches = FALLBACK_CITIES.filter(c => 
    c.city.toLowerCase().includes(trimmed) || 
    c.country.toLowerCase().includes(trimmed)
  );

  const localResults = localMatches.map((c, index) => ({
    id: `location-local-${c.city.replace(/\s/g, '-')}-${index}`,
    city: c.city,
    state: c.state,
    country: c.country,
    countryCode: c.countryCode,
    heroPhoto: c.heroPhoto,
    lat: c.lat,
    lng: c.lng
  }));

  // Fetch online from OSM Nominatim Geocoder
  try {
    const osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&featuretype=settlement&limit=8`;
    
    const response = await fetch(osmUrl);

    if (!response.ok) throw new Error('OSM geocoding failed');
    
    const data = await response.json();
    
    const onlineResults = await Promise.all(data.map(async (item: any) => {
      const addr = item.address;
      const city = addr.city || addr.town || addr.village || addr.municipality || addr.suburb || item.name;
      const state = addr.state || addr.region;
      const country = addr.country;
      const lat = parseFloat(item.lat);
      const lng = parseFloat(item.lon);
      
      // Fetch photo description from Wikipedia
      let heroPhoto = '';
      let wikiData = await fetchWikipediaData(city);
      
      if (wikiData.photoUrl) {
        heroPhoto = wikiData.photoUrl;
      } else {
        // Build direct Unsplash fallback search url
        heroPhoto = `https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1200&q=80`; // city default
      }
      
      return {
        id: `location-osm-${item.osm_id || Math.random().toString(36).substr(2, 9)}`,
        city,
        state,
        country,
        countryCode: addr.country_code ? addr.country_code.toUpperCase() : undefined,
        heroPhoto,
        lat,
        lng
      };
    }));

    // Filter out duplicates (if online results contain things already in local matches)
    const combined = [...localResults];
    for (const online of onlineResults) {
      const isDuplicate = combined.some(
        c => c.city.toLowerCase() === online.city.toLowerCase() && 
             c.country.toLowerCase() === online.country.toLowerCase()
      );
      if (!isDuplicate && online.city) {
        combined.push(online);
      }
    }

    return combined.slice(0, 10);
  } catch (error) {
    console.error('Online geocoding failed, returning local fallbacks:', error);
    return localResults;
  }
}

// 3. Search Places (Attractions, restaurants, etc.) near coordinates using Photon (Komoot) API
export async function searchPlacesNearLocationPhoton(
  query: string,
  location: { city: string; country: string; lat: number; lng: number }
): Promise<Omit<Place, 'placeGroupId'>[]> {
  if (!query || query.trim().length < 2) return [];

  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=${location.lat}&lon=${location.lng}&limit=10`;
    const response = await fetch(photonUrl);
    if (!response.ok) throw new Error('Photon place search failed');
    const data = await response.json();
    const features = data.features || [];

    const onlineResults = await Promise.all(features.map(async (feature: any) => {
      const props = feature.properties || {};
      const title = props.name || 'Unnamed Place';
      
      let description = props.osm_value 
        ? props.osm_value.charAt(0).toUpperCase() + props.osm_value.slice(1).replace('_', ' ')
        : (props.type || 'Point of Interest');
      if (props.city) description += ` in ${props.city}`;
      
      const coordinates = feature.geometry?.coordinates || [0, 0];
      const lng = coordinates[0];
      const lat = coordinates[1];
      
      // Wikipedia fetch for places
      let photoUrl = '';
      const wikiData = await fetchWikipediaData(title);
      if (wikiData.photoUrl) {
        photoUrl = wikiData.photoUrl;
      }
      if (wikiData.description) {
        description = wikiData.description;
      }
      
      if (!photoUrl) {
        const category = props.osm_value || props.osm_key || '';
        if (category.includes('restaurant') || category.includes('cafe') || category.includes('food') || category.includes('eating')) {
          photoUrl = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80';
        } else if (category.includes('hotel') || category.includes('motel') || category.includes('hostel') || category.includes('tourism')) {
          photoUrl = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80';
        } else {
          photoUrl = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=600&q=80';
        }
      }

      return {
        id: `photon-place-${props.osm_id || Math.random().toString(36).substr(2, 9)}`,
        title,
        description,
        openingHours: 'Varies',
        photoUrl,
        lat,
        lng,
        notes: ''
      };
    }));

    return onlineResults;
  } catch (error) {
    console.error('Photon place search failed:', error);
    return [];
  }
}

// 4. Unified Search Places function: queries both OSM Nominatim and Photon in parallel, merging & deduplicating
export async function searchPlacesNearLocation(
  query: string,
  location: { city: string; country: string; lat: number; lng: number }
): Promise<Omit<Place, 'placeGroupId'>[]> {
  if (!query || query.trim().length < 2) return [];

  const trimmed = query.trim().toLowerCase();
  
  // Check local database for match first
  const matchedCity = FALLBACK_CITIES.find(c => c.city.toLowerCase() === location.city.toLowerCase());
  let localResults: Omit<Place, 'placeGroupId'>[] = [];
  if (matchedCity) {
    const matchingPlaces = matchedCity.places.filter(p => 
      p.title.toLowerCase().includes(trimmed) || 
      p.description.toLowerCase().includes(trimmed)
    );
    localResults = matchingPlaces.map(p => ({
      id: p.id,
      title: p.title,
      description: p.description,
      openingHours: p.openingHours,
      photoUrl: p.photoUrl,
      lat: p.lat,
      lng: p.lng,
      notes: p.notes
    }));
  }

  // Fetch from both Nominatim and Photon in parallel
  const fetchNominatim = async (): Promise<Omit<Place, 'placeGroupId'>[]> => {
    try {
      const searchQuery = `${query}, ${location.city}`;
      const osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&addressdetails=1&limit=10`;
      const response = await fetch(osmUrl);
      if (!response.ok) throw new Error('OSM place search failed');
      const data = await response.json();
      
      return await Promise.all(data.map(async (item: any) => {
        const title = item.name || item.display_name.split(',')[0];
        const address = item.address || {};
        
        let description = item.type 
          ? item.type.charAt(0).toUpperCase() + item.type.slice(1).replace('_', ' ')
          : 'Point of Interest';
        if (address.suburb) description += ` in ${address.suburb}`;
        
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        
        let photoUrl = '';
        const wikiData = await fetchWikipediaData(title);
        if (wikiData.photoUrl) {
          photoUrl = wikiData.photoUrl;
        }
        if (wikiData.description) {
          description = wikiData.description;
        }
        
        if (!photoUrl) {
          const category = item.type || '';
          if (category.includes('restaurant') || category.includes('cafe') || category.includes('food')) {
            photoUrl = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80';
          } else if (category.includes('hotel') || category.includes('motel') || category.includes('hostel')) {
            photoUrl = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80';
          } else {
            photoUrl = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=600&q=80';
          }
        }

        return {
          id: `osm-place-${item.osm_id || Math.random().toString(36).substr(2, 9)}`,
          title,
          description,
          openingHours: item.extratags?.opening_hours || 'Varies',
          photoUrl,
          lat,
          lng,
          notes: ''
        };
      }));
    } catch (e) {
      console.error('OSM Nominatim fetch failed:', e);
      return [];
    }
  };

  const [nominatimResult, photonResult] = await Promise.allSettled([
    fetchNominatim(),
    searchPlacesNearLocationPhoton(query, location)
  ]);

  const onlineResults: Omit<Place, 'placeGroupId'>[] = [];
  
  if (nominatimResult.status === 'fulfilled') {
    onlineResults.push(...nominatimResult.value);
  }
  if (photonResult.status === 'fulfilled') {
    onlineResults.push(...photonResult.value);
  }

  // Combine local database, Nominatim, and Photon results, deduplicating by title (case-insensitive)
  const combined = [...localResults];
  for (const online of onlineResults) {
    if (!combined.some(p => p.title.toLowerCase() === online.title.toLowerCase())) {
      combined.push(online);
    }
  }

  return combined;
}

export function parseGoogleMapsUrl(input: string): { title?: string; lat?: number; lng?: number; isGoogleMapsUrl: boolean; isShortUrl: boolean } {
  const trimmed = input.trim();
  const isShortUrl = /https?:\/\/(goo\.gl\/maps|maps\.app\.goo\.gl)/i.test(trimmed);
  const isGoogleMapsUrl = /https?:\/\/(www\.)?(maps\.google\.com|google\.com\/maps|goo\.gl\/maps|maps\.app\.goo\.gl)/i.test(trimmed);
  if (!isGoogleMapsUrl) return { isGoogleMapsUrl: false, isShortUrl: false };
  if (isShortUrl) return { isGoogleMapsUrl: true, isShortUrl: true };
  try {
    const url = new URL(trimmed);
    let title: string | undefined;
    let lat: number | undefined;
    let lng: number | undefined;
    const placeMatch = url.pathname.match(/\/place\/([^/@]+)/);
    if (placeMatch) title = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
    const coordMatch = url.pathname.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (coordMatch) { lat = parseFloat(coordMatch[1]); lng = parseFloat(coordMatch[2]); }
    const q = url.searchParams.get('q') || url.searchParams.get('query');
    if (q) {
      const coordQ = q.match(/^(-?\d+\.\d+),(-?\d+\.\d+)$/);
      if (coordQ) { lat = parseFloat(coordQ[1]); lng = parseFloat(coordQ[2]); }
      else if (!title) title = q;
    }
    return { title, lat, lng, isGoogleMapsUrl: true, isShortUrl: false };
  } catch {
    return { isGoogleMapsUrl: true, isShortUrl: false };
  }
}

export async function fetchPlaceFromGoogleMapsUrl(
  mapsUrl: string,
  fallbackLocation?: { city: string; country: string; lat: number; lng: number }
): Promise<{ place: Omit<Place, 'placeGroupId'> | null; error?: string }> {
  const parsed = parseGoogleMapsUrl(mapsUrl);
  if (!parsed.isGoogleMapsUrl) return { place: null, error: 'Not a Google Maps URL.' };
  if (parsed.isShortUrl) {
    return { place: null, error: 'Short links are not supported. Please open Google Maps in a browser and copy the URL from the address bar.' };
  }

  if (parsed.lat !== undefined && parsed.lng !== undefined) {
    try {
      const reverseUrl = `https://nominatim.openstreetmap.org/reverse?lat=${parsed.lat}&lon=${parsed.lng}&format=json&addressdetails=1`;
      const response = await fetch(reverseUrl, { headers: { 'Accept-Language': 'en' } });
      if (response.ok) {
        const data = await response.json();
        const name = parsed.title || data.name || data.display_name?.split(',')[0] || 'Unknown Place';
        const wikiData = await fetchWikipediaData(name);
        return {
          place: {
            id: `osm-place-${data.osm_id || Math.random().toString(36).substr(2, 9)}`,
            title: name,
            description: wikiData.description || (data.type ? data.type.charAt(0).toUpperCase() + data.type.slice(1).replace(/_/g, ' ') : 'Point of Interest'),
            openingHours: data.extratags?.opening_hours || undefined,
            photoUrl: wikiData.photoUrl || undefined,
            lat: parsed.lat,
            lng: parsed.lng,
            mapsLink: mapsUrl,
            notes: undefined
          }
        };
      }
    } catch (e) {
      console.error('Reverse geocode failed:', e);
    }
    // Reverse geocode failed but we still have coordinates — return minimal place
    return {
      place: {
        id: `maps-place-${Date.now()}`,
        title: parsed.title || 'Unnamed Place',
        description: '',
        lat: parsed.lat,
        lng: parsed.lng,
        mapsLink: mapsUrl,
        notes: undefined
      }
    };
  }

  if (parsed.title && fallbackLocation) {
    const results = await searchPlacesNearLocation(parsed.title, fallbackLocation);
    if (results.length > 0) {
      return { place: { ...results[0], mapsLink: mapsUrl } };
    }
  }

  return { place: null, error: 'Could not extract place information from this URL.' };
}

export const getCountryFlag = (countryCode?: string): string => {
  if (!countryCode || countryCode.length !== 2) return '📍';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  try {
    return String.fromCodePoint(...codePoints);
  } catch (e) {
    return '📍';
  }
};

export const getLocIcon = (loc?: Location) => {
  if (!loc) return '📍';
  if (loc.countryCode) {
    return getCountryFlag(loc.countryCode);
  }
  const name = loc.country.toLowerCase();
  if (name.includes('france')) return '🇫🇷';
  if (name.includes('italy')) return '🇮🇹';
  if (name.includes('japan')) return '🇯🇵';
  if (name.includes('united states') || name === 'us' || name === 'usa') return '🇺🇸';
  if (name.includes('vietnam') || name === 'vn') return '🇻🇳';
  if (name.includes('united kingdom') || name === 'uk' || name === 'gb') return '🇬🇧';
  if (name.includes('germany') || name === 'de') return '🇩🇪';
  if (name.includes('spain') || name === 'es') return '🇪🇸';
  if (name.includes('canada') || name === 'ca') return '🇨🇦';
  if (name.includes('australia') || name === 'au') return '🇦🇺';
  return '📍';
};

export const buildMapsLink = (title: string, _lat: number, _lng: number, city?: string) => {
  const query = city ? `${title}, ${city}` : title;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

export const getFormattedLocationName = (loc: Location, allLocations: Location[]) => {
  const countries = new Set(allLocations.map(l => l.country.toLowerCase()));
  const isMultiCountry = countries.size > 1;

  if (isMultiCountry) {
    return `${loc.city}, ${loc.country}`;
  }

  const isUS = allLocations.every(l => l.country.toLowerCase().includes('united states') || l.country.toLowerCase() === 'us');
  if (isUS) {
    const states = new Set(allLocations.map(l => l.state?.toLowerCase()).filter(Boolean));
    if (states.size > 1 && loc.state) {
      return `${loc.city}, ${loc.state}`;
    }
  }

  return loc.city;
};
