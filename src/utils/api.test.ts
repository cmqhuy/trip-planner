import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWikipediaData, searchLocation, searchPlacesNearLocation } from './api';

describe('api.ts - fetchWikipediaData', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should return description and photoUrl when Wikipedia API succeeds', async () => {
    const mockResponse = {
      query: {
        pages: {
          '12345': {
            extract: 'Eiffel Tower is a famous tower in Paris.\nIt was built in 1889.',
            thumbnail: {
              source: 'https://example.com/eiffel.jpg'
            }
          }
        }
      }
    };

    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    });

    const result = await fetchWikipediaData('Eiffel Tower');
    expect(result).toEqual({
      description: 'Eiffel Tower is a famous tower in Paris.',
      photoUrl: 'https://example.com/eiffel.jpg'
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('titles=Eiffel%20Tower')
    );
  });

  it('should return empty values when Wikipedia API returns no pages', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ query: { pages: { '-1': {} } } })
    });

    const result = await fetchWikipediaData('NonexistentPlace');
    expect(result).toEqual({ description: '', photoUrl: '' });
  });

  it('should handle network failures gracefully', async () => {
    (globalThis.fetch as any).mockRejectedValue(new Error('Network error'));
    
    const result = await fetchWikipediaData('Eiffel Tower');
    expect(result).toEqual({ description: '', photoUrl: '' });
    expect(console.warn).toHaveBeenCalled();
  });
});

describe('api.ts - searchLocation', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should return empty array for short query strings', async () => {
    const result = await searchLocation('a');
    expect(result).toEqual([]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('should check local fallback database first and find matching cities', async () => {
    (globalThis.fetch as any).mockRejectedValue(new Error('Offline'));

    // "Paris" query should match local database
    const results = await searchLocation('Paris');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].city).toBe('Paris');
    expect(results[0].country).toBe('France');
    expect(results[0].heroPhoto).toBeDefined();
    expect(console.error).toHaveBeenCalled();
  });

  it('should search OSM Nominatim API and merge results without duplicates', async () => {
    const mockOsmResponse = [
      {
        osm_id: 98765,
        name: 'Paris',
        address: {
          city: 'Paris',
          country: 'France',
          country_code: 'fr'
        },
        lat: '48.8566',
        lon: '2.3522'
      },
      {
        osm_id: 11223,
        name: 'London',
        address: {
          city: 'London',
          country: 'United Kingdom',
          country_code: 'gb'
        },
        lat: '51.5074',
        lon: '-0.1278'
      }
    ];

    const mockWikiResponse = {
      query: {
        pages: {
          '777': {
            thumbnail: { source: 'https://example.com/london.jpg' }
          }
        }
      }
    };

    // First fetch is Nominatim query, subsequent fetches are Wikipedia queries
    let fetchCount = 0;
    (globalThis.fetch as any).mockImplementation(() => {
      fetchCount++;
      if (fetchCount === 1) {
        return Promise.resolve({
          ok: true,
          json: async () => mockOsmResponse
        });
      } else {
        return Promise.resolve({
          ok: true,
          json: async () => mockWikiResponse
        });
      }
    });

    const results = await searchLocation('Paris');
    
    // London should have been merged in as Paris is already in local fallbacks
    expect(results.some(r => r.city === 'London')).toBe(true);
    expect(results.some(r => r.city === 'Paris')).toBe(true);
    
    const londonResult = results.find(r => r.city === 'London');
    expect(londonResult?.country).toBe('United Kingdom');
    expect(londonResult?.countryCode).toBe('GB');
    expect(londonResult?.heroPhoto).toBe('https://example.com/london.jpg');
  });
});

describe('api.ts - searchPlacesNearLocation', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should return local matches for places in known fallback cities', async () => {
    (globalThis.fetch as any).mockRejectedValue(new Error('Offline'));

    const location = { city: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 };
    const results = await searchPlacesNearLocation('Eiffel', location);
    
    expect(results.length).toBeGreaterThan(0);
    const eiffel = results.find(r => r.title === 'Eiffel Tower');
    expect(eiffel).toBeDefined();
    expect(eiffel?.description).toContain('Iconic 19th-century iron tower');
    expect(eiffel?.openingHours).toBe('09:00 - 00:00');
    expect(console.error).toHaveBeenCalled();
  });

  it('should search OSM for places near coordinate and parse category fallbacks', async () => {
    const mockOsmPlaceResponse = [
      {
        osm_id: 111,
        name: 'Great Cafe',
        type: 'restaurant',
        address: { suburb: 'Marais' },
        lat: '48.8580',
        lon: '2.3400'
      }
    ];

    let fetchCount = 0;
    (globalThis.fetch as any).mockImplementation(() => {
      fetchCount++;
      if (fetchCount === 1) {
        return Promise.resolve({
          ok: true,
          json: async () => mockOsmPlaceResponse
        });
      } else {
        return Promise.resolve({
          ok: true,
          json: async () => ({ query: { pages: { '-1': {} } } }) // empty wiki
        });
      }
    });

    const location = { city: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 };
    const results = await searchPlacesNearLocation('Great Cafe', location);
    
    const cafe = results.find(r => r.title === 'Great Cafe');
    expect(cafe).toBeDefined();
    expect(cafe?.description).toBe('Restaurant in Marais');
    // Check fallback food photourl is set since Wikipedia fetch was empty
    expect(cafe?.photoUrl).toBe('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80');
  });
});
