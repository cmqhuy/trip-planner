import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { fetchWikipediaData, searchLocation, searchPlacesNearLocation, searchPlacesNearLocationPhoton, parseGoogleMapsUrl, fetchPlaceFromGoogleMapsUrl } from './api';

/**
 * The stubbed global `fetch`.
 *
 * Tests hand back only the two `Response` members the code under test reads, so
 * this is deliberately narrower than the real signature — `vi.mocked` would
 * demand a complete `Response` for every stub.
 */
type StubbedResponse = { ok: boolean; json: () => Promise<unknown> };
const fetchMock = () =>
  globalThis.fetch as unknown as Mock<(url: string) => Promise<StubbedResponse>>;

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

    fetchMock().mockResolvedValue({
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
    fetchMock().mockResolvedValue({
      ok: true,
      json: async () => ({ query: { pages: { '-1': {} } } })
    });

    const result = await fetchWikipediaData('NonexistentPlace');
    expect(result).toEqual({ description: '', photoUrl: '' });
  });

  it('should handle network failures gracefully', async () => {
    fetchMock().mockRejectedValue(new Error('Network error'));
    
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
    fetchMock().mockRejectedValue(new Error('Offline'));

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
    fetchMock().mockImplementation(() => {
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
    fetchMock().mockRejectedValue(new Error('Offline'));

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
    fetchMock().mockImplementation(() => {
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

describe('api.ts - searchPlacesNearLocationPhoton', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should search Photon API and parse features correctly', async () => {
    const mockPhotonResponse = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [2.2945, 48.8584]
          },
          properties: {
            osm_id: 12345,
            name: 'Eiffel Tower',
            osm_value: 'attraction',
            city: 'Paris'
          }
        }
      ]
    };

    let fetchCount = 0;
    fetchMock().mockImplementation(() => {
      fetchCount++;
      if (fetchCount === 1) {
        return Promise.resolve({
          ok: true,
          json: async () => mockPhotonResponse
        });
      } else {
        return Promise.resolve({
          ok: true,
          json: async () => ({ query: { pages: { '-1': {} } } }) // empty wiki
        });
      }
    });

    const location = { city: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 };
    const results = await searchPlacesNearLocationPhoton('Eiffel Tower', location);
    
    expect(results.length).toBeGreaterThan(0);
    const tower = results.find(r => r.title === 'Eiffel Tower');
    expect(tower).toBeDefined();
    expect(tower?.description).toBe('Attraction in Paris');
    expect(tower?.lat).toBe(48.8584);
    expect(tower?.lng).toBe(2.2945);
  });
});

describe('api.ts - parallel search places merging', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should query both Nominatim and Photon, merging and deduplicating results', async () => {
    const mockOsmResponse = [
      {
        osm_id: 111,
        name: 'Shared Place',
        type: 'museum',
        address: {},
        lat: '48.8600',
        lon: '2.3300'
      },
      {
        osm_id: 222,
        name: 'Nominatim Only Place',
        type: 'restaurant',
        address: {},
        lat: '48.8610',
        lon: '2.3310'
      }
    ];

    const mockPhotonResponse = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [2.3300, 48.8600]
          },
          properties: {
            osm_id: 111,
            name: 'Shared Place',
            osm_value: 'museum'
          }
        },
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [2.3320, 48.8620]
          },
          properties: {
            osm_id: 333,
            name: 'Photon Only Place',
            osm_value: 'hotel'
          }
        }
      ]
    };

    fetchMock().mockImplementation((url: string) => {
      if (url.includes('nominatim.openstreetmap.org')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockOsmResponse
        });
      } else if (url.includes('photon.komoot.io')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockPhotonResponse
        });
      } else {
        // wikipedia requests
        return Promise.resolve({
          ok: true,
          json: async () => ({ query: { pages: { '-1': {} } } })
        });
      }
    });

    const location = { city: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 };
    const results = await searchPlacesNearLocation('Paris Search', location);

    // Results should contain Shared Place exactly once (deduplicated), Nominatim Only, and Photon Only
    const titles = results.map(r => r.title);
    expect(titles).toContain('Shared Place');
    expect(titles).toContain('Nominatim Only Place');
    expect(titles).toContain('Photon Only Place');
    
    // Total occurrences of 'Shared Place' should be 1
    const sharedOccurrences = results.filter(r => r.title === 'Shared Place');
    expect(sharedOccurrences.length).toBe(1);
  });
});

describe('api.ts - Google Maps URL Parser and Fetcher', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('parseGoogleMapsUrl', () => {
    it('should parse standard Google Maps URL with place name and coordinates', () => {
      const url = 'https://www.google.com/maps/place/Eiffel+Tower/@48.8584,2.2945,17z/data=!3m1!4b1';
      const parsed = parseGoogleMapsUrl(url);
      expect(parsed.isGoogleMapsUrl).toBe(true);
      expect(parsed.isShortUrl).toBe(false);
      expect(parsed.title).toBe('Eiffel Tower');
      expect(parsed.lat).toBe(48.8584);
      expect(parsed.lng).toBe(2.2945);
    });

    it('should identify short Google Maps URLs', () => {
      const shortUrl = 'https://maps.app.goo.gl/abcdefg';
      const parsed = parseGoogleMapsUrl(shortUrl);
      expect(parsed.isGoogleMapsUrl).toBe(true);
      expect(parsed.isShortUrl).toBe(true);
    });

    it('should return isGoogleMapsUrl: false for non-Google Maps URLs', () => {
      const normalUrl = 'https://www.example.com';
      const parsed = parseGoogleMapsUrl(normalUrl);
      expect(parsed.isGoogleMapsUrl).toBe(false);
    });
  });

  describe('fetchPlaceFromGoogleMapsUrl', () => {
    it('should resolve coordinates and reverse geocode address from Nominatim', async () => {
      const url = 'https://www.google.com/maps/place/Eiffel+Tower/@48.8584,2.2945,17z/data=!3m1!4b1';
      
      const mockReverseGeocodeResponse = {
        osm_id: 1234567,
        name: 'Eiffel Tower',
        display_name: 'Champ de Mars, 5 Avenue Anatole France, 75007 Paris, France',
        type: 'attraction'
      };

      fetchMock().mockImplementation((reqUrl: string) => {
        if (reqUrl.includes('nominatim.openstreetmap.org/reverse')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockReverseGeocodeResponse
          });
        }
        // fetchWikipediaData stub
        return Promise.resolve({
          ok: true,
          json: async () => ({ query: { pages: { '-1': {} } } })
        });
      });

      const { place, error } = await fetchPlaceFromGoogleMapsUrl(url);
      expect(error).toBeUndefined();
      expect(place).not.toBeNull();
      expect(place!.title).toBe('Eiffel Tower');
      expect(place!.lat).toBe(48.8584);
      expect(place!.lng).toBe(2.2945);
      expect(place!.address).toBe('Champ de Mars, 5 Avenue Anatole France, 75007 Paris, France');
    });

    it('should return error for short Google Maps URLs due to short-link limitation', async () => {
      const shortUrl = 'https://maps.app.goo.gl/abcdefg';
      const { place, error } = await fetchPlaceFromGoogleMapsUrl(shortUrl);
      expect(place).toBeNull();
      expect(error).toContain('Short links are not supported');
    });
  });
});


