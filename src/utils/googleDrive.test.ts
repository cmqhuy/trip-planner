import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mergeTrips, fetchTripsFromDrive, saveTripsToDrive, fetchSingleTripFromDrive, extractFileIdFromUrl } from './googleDrive';
import type { Trip } from '../types';

describe('googleDrive mergeTrips tests', () => {
  const createMockTrip = (id: string, name: string): Trip => ({
    id,
    name,
    startDate: '2026-06-01',
    endDate: '2026-06-03',
    locations: [],
    plans: [],
    placeGroups: [],
  });

  test('merges disjoint local and cloud trips correctly', () => {
    const local = [createMockTrip('trip-1', 'Paris'), createMockTrip('trip-2', 'Rome')];
    const cloud = [createMockTrip('trip-3', 'Tokyo')];

    const result = mergeTrips(local, cloud);

    expect(result).toHaveLength(3);
    expect(result.map(t => t.id)).toEqual(expect.arrayContaining(['trip-1', 'trip-2', 'trip-3']));
  });

  test('prefers cloud trip version in case of ID conflict', () => {
    const local = [createMockTrip('trip-1', 'Paris (Local Name)')];
    const cloud = [createMockTrip('trip-1', 'Paris (Cloud Name)')];

    const result = mergeTrips(local, cloud);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('trip-1');
    expect(result[0].name).toBe('Paris (Cloud Name)');
  });

  test('prefers version with newer updatedAt timestamp', () => {
    const local = { ...createMockTrip('trip-1', 'Paris (Local Name)'), updatedAt: 1000 };
    const cloud = { ...createMockTrip('trip-1', 'Paris (Cloud Name)'), updatedAt: 500 };

    const result = mergeTrips([local], [cloud]);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Paris (Local Name)');
  });

  test('handles empty local or cloud lists gracefully', () => {
    const local = [createMockTrip('trip-1', 'Paris')];
    
    expect(mergeTrips(local, [])).toEqual(local);
    expect(mergeTrips([], local)).toEqual(local);
    expect(mergeTrips([], [])).toEqual([]);
  });
});

describe('googleDrive api operations', () => {
  const createMockTrip = (id: string, name: string): Trip => ({
    id,
    name,
    startDate: '2026-06-01',
    endDate: '2026-06-03',
    locations: [],
    plans: [],
    placeGroups: [],
  });

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('fetchTripsFromDrive lists and fetches individual files', async () => {
    const mockFetch = vi.mocked(fetch);

    // First fetch: list files
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        files: [
          { id: 'file-1', name: 'trip-1.json' },
          { id: 'file-2', name: 'trip-2.json' },
          { id: 'file-3', name: 'other-file.txt' },
        ],
      }),
    } as Response);

    // Parallel fetches: media content for trip-1.json and trip-2.json
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createMockTrip('1', 'Trip 1'),
    } as Response);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createMockTrip('2', 'Trip 2'),
    } as Response);

    const result = await fetchTripsFromDrive('token', 'folder');

    expect(result?.activeTrips).toHaveLength(2);
    expect(result?.activeTrips?.[0].id).toBe('1');
    expect(result?.activeTrips?.[1].id).toBe('2');
    expect(result?.deletedTripIds).toEqual([]);

    // Verify first call (list query)
    expect(mockFetch.mock.calls[0][0]).toContain('https://www.googleapis.com/drive/v3/files?q=');
    // Verify subsequent media calls
    expect(mockFetch.mock.calls[1][0]).toBe('https://www.googleapis.com/drive/v3/files/file-1?alt=media');
    // Note: since list contains mock files, mockFetch.mock.calls[2] is the second active media request
    expect(mockFetch.mock.calls[2][0]).toBe('https://www.googleapis.com/drive/v3/files/file-2?alt=media');
  });

  test('saveTripsToDrive updates existing, creates new, and deletes orphaned files', async () => {
    const mockFetch = vi.mocked(fetch);

    // 1. List files call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        files: [
          { id: 'file-1', name: 'trip-1.json' }, // Needs update
          { id: 'file-2', name: 'trip-2.json' }, // Needs delete (orphaned)
        ],
      }),
    } as Response);

    // 2. We'll pass trips: trip-1 (existing) and trip-3 (new)
    const tripsToSave = [
      createMockTrip('1', 'Trip 1 Updated'),
      createMockTrip('3', 'Trip 3 New'),
    ];

    // Response for patching file-1
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    // Response for creating trip-3 metadata (POST)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'file-3' }),
    } as Response);

    // Response for patching content for new file-3 (PATCH)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    // Response for renaming file-2 (PATCH delete mark)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    await saveTripsToDrive('token', 'folder', tripsToSave);

    // Check calls
    // Call 0: list
    expect(mockFetch.mock.calls[0][0]).toContain('https://www.googleapis.com/drive/v3/files?q=');

    // Call 1: PATCH update for trip-1
    const patchCall = mockFetch.mock.calls.find(c => c[0] === 'https://www.googleapis.com/upload/drive/v3/files/file-1?uploadType=media');
    expect(patchCall).toBeDefined();
    expect(patchCall?.[1]?.method).toBe('PATCH');

    // Call 2: POST create metadata for trip-3
    const createCall = mockFetch.mock.calls.find(c => c[0] === 'https://www.googleapis.com/drive/v3/files');
    expect(createCall).toBeDefined();
    expect(createCall?.[1]?.method).toBe('POST');
    expect(JSON.parse(createCall?.[1]?.body as string).name).toBe('trip-3.json');

    // Call 3: PATCH upload media content for file-3
    const uploadCall = mockFetch.mock.calls.find(c => c[0] === 'https://www.googleapis.com/upload/drive/v3/files/file-3?uploadType=media');
    expect(uploadCall).toBeDefined();
    expect(uploadCall?.[1]?.method).toBe('PATCH');

    // Call 4: PATCH rename for orphaned trip-2
    const deleteCall = mockFetch.mock.calls.find(c => c[0] === 'https://www.googleapis.com/drive/v3/files/file-2');
    expect(deleteCall).toBeDefined();
    expect(deleteCall?.[1]?.method).toBe('PATCH');
    expect(JSON.parse(deleteCall?.[1]?.body as string).name).toBe('[Deleted] trip-2.json');
  });

  test('fetchSingleTripFromDrive queries by name and downloads content', async () => {
    const mockFetch = vi.mocked(fetch);

    // 1. Search file by name call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        files: [{ id: 'file-123' }],
      }),
    } as Response);

    // 2. Fetch media contents call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createMockTrip('123', 'Trip 123'),
    } as Response);

    const trip = await fetchSingleTripFromDrive('token', 'folder', '123');

    expect(trip).toBeDefined();
    expect(trip?.id).toBe('123');
    expect(trip?.name).toBe('Trip 123');

    // Check query URL contains the filename search
    expect(decodeURIComponent(mockFetch.mock.calls[0][0] as string)).toContain("name = 'trip-123.json'");
    // Check media URL
    expect(mockFetch.mock.calls[1][0]).toBe('https://www.googleapis.com/drive/v3/files/file-123?alt=media');
  });

  test('extractFileIdFromUrl extracts file IDs correctly', () => {
    expect(extractFileIdFromUrl('1A2B3C4D5E')).toBe('1A2B3C4D5E');
    expect(extractFileIdFromUrl('  1A2B3C4D5E  ')).toBe('1A2B3C4D5E');
    expect(extractFileIdFromUrl('https://drive.google.com/file/d/1A2B3C4D5E/view?usp=sharing')).toBe('1A2B3C4D5E');
    expect(extractFileIdFromUrl('https://drive.google.com/open?id=1A2B3C4D5E')).toBe('1A2B3C4D5E');
    expect(extractFileIdFromUrl('https://example.com/not-gdrive')).toBe('');
  });

  test('fetchTripsFromDrive resolves shadow files correctly', async () => {
    const mockFetch = vi.mocked(fetch);

    // 1. List files (contains one shadow file)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        files: [{ id: 'shadow-file-id', name: 'trip-1.json', owners: [{ emailAddress: 'me@me.com', me: true }], capabilities: { canEdit: true }, shared: false }],
      }),
    } as Response);

    // 2. Download shadow file content
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: '1',
        isShadow: true,
        realDriveFileId: 'real-file-id',
      }),
    } as Response);

    // 3. Download real file content
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: '1',
        name: 'Shared Paris Trip',
        locations: [],
        plans: [],
        placeGroups: [],
      }),
    } as Response);

    // 4. Fetch metadata for real file
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        owners: [{ emailAddress: 'owner@owner.com', me: false }],
        capabilities: { canEdit: false },
        shared: true,
      }),
    } as Response);

    const result = await fetchTripsFromDrive('token', 'folder');

    expect(result?.activeTrips).toHaveLength(1);
    const trip = result?.activeTrips[0];
    expect(trip?.id).toBe('1');
    expect(trip?.name).toBe('Shared Paris Trip');
    expect(trip?.isShadow).toBe(true);
    expect(trip?.driveFileId).toBe('real-file-id');
    expect(trip?.shadowFileId).toBe('shadow-file-id');
    expect(trip?.ownerEmail).toBe('owner@owner.com');
    expect(trip?.isOwner).toBe(false);
    expect(trip?.canEdit).toBe(false);
    expect(trip?.shared).toBe(true);
  });

  test('fetchTripsFromDrive cleans up inaccessible shadow files', async () => {
    const mockFetch = vi.mocked(fetch);

    // 1. List files
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        files: [{ id: 'shadow-file-id', name: 'trip-1.json' }],
      }),
    } as Response);

    // 2. Download shadow file content
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: '1',
        isShadow: true,
        realDriveFileId: 'real-file-id',
      }),
    } as Response);

    // 3. Download real file content fails (404)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    // 4. DELETE call for shadow file succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
    } as Response);

    const result = await fetchTripsFromDrive('token', 'folder');

    expect(result?.activeTrips).toHaveLength(0);
    // Verify DELETE was called on shadow-file-id
    const deleteCall = mockFetch.mock.calls.find(c => c[0] === 'https://www.googleapis.com/drive/v3/files/shadow-file-id' && c[1]?.method === 'DELETE');
    expect(deleteCall).toBeDefined();
  });

  test('saveTripsToDrive strips user-specific metadata from payload', async () => {
    const mockFetch = vi.mocked(fetch);

    // 1. List files
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        files: [],
      }),
    } as Response);

    // 2. POST create metadata
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'new-file-id' }),
    } as Response);

    // 3. PATCH upload content
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    const tripWithMetadata: Trip = {
      id: '1',
      name: 'Paris',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      locations: [],
      plans: [],
      placeGroups: [],
      driveFileId: 'real-file-id',
      shadowFileId: 'shadow-file-id',
      isShadow: true,
      isOwner: false,
      ownerEmail: 'owner@owner.com',
      canEdit: true,
      shared: true,
    };

    await saveTripsToDrive('token', 'folder', [tripWithMetadata]);

    // Check payload sent in PATCH upload
    const uploadCall = mockFetch.mock.calls.find(c => c[0] === 'https://www.googleapis.com/upload/drive/v3/files/real-file-id?uploadType=media');
    expect(uploadCall).toBeDefined();
    const body = JSON.parse(uploadCall?.[1]?.body as string);

    // Should NOT have metadata keys
    expect(body.driveFileId).toBeUndefined();
    expect(body.shadowFileId).toBeUndefined();
    expect(body.isShadow).toBeUndefined();
    expect(body.isOwner).toBeUndefined();
    expect(body.ownerEmail).toBeUndefined();
    expect(body.canEdit).toBeUndefined();
    expect(body.shared).toBeUndefined();

    // Should have content keys
    expect(body.id).toBe('1');
    expect(body.name).toBe('Paris');
  });

  test('saveTripsToDrive keeps Viewer shadow file intact', async () => {
    const mockFetch = vi.mocked(fetch);

    // 1. List files (has the shadow file)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        files: [
          { id: 'shadow-file-id', name: 'trip-1.json' }
        ],
      }),
    } as Response);

    const viewerTrip: Trip = {
      id: '1',
      name: 'Paris',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      locations: [],
      plans: [],
      placeGroups: [],
      driveFileId: 'real-file-id',
      shadowFileId: 'shadow-file-id',
      isShadow: true,
      isOwner: false,
      canEdit: false, // Viewer!
    };

    const result = await saveTripsToDrive('token', 'folder', [viewerTrip]);

    // Check that we did NOT call PATCH to rename (delete) trip-1.json
    const deleteCall = mockFetch.mock.calls.find(c => String(c[0]).includes('shadow-file-id') && c[1]?.method === 'PATCH');
    expect(deleteCall).toBeUndefined();
    expect(result.driveFileIds['1']).toBe('real-file-id');
  });
});
