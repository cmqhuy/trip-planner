import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App';
import type { Trip } from './types';
import { fetchTripsFromDrive, saveTripsToDrive } from './utils/googleDrive';

// Mock Leaflet-based components to avoid jsdom map errors
vi.mock('./components/MapComponent', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-map-component" />
}));

vi.mock('./components/MapPicker', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-map-picker" />
}));

// Mock Google Drive sync operations
vi.mock('./utils/googleDrive', () => ({
  loadGsiScript: vi.fn().mockResolvedValue(undefined),
  initTokenClient: vi.fn(),
  requestAccessToken: vi.fn(),
  fetchGoogleUserInfo: vi.fn().mockResolvedValue({ name: 'Test User', email: 'test@gmail.com', picture: 'pic' }),
  getOrCreateTripPlannerFolder: vi.fn().mockResolvedValue('folder-123'),
  fetchTripsFromDrive: vi.fn(),
  saveTripsToDrive: vi.fn().mockResolvedValue({ deletedTripIds: [], driveFileIds: {} }),
  fetchSingleTripFromDrive: vi.fn(),
  checkIfTripDeletedOnDrive: vi.fn().mockResolvedValue(false),
  leaveSharedTripFile: vi.fn().mockResolvedValue(true),
  DEFAULT_CLIENT_ID: 'client-id'
}));

describe('App Sync and Integration Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applies cloud deletions on initial synchronization', async () => {
    // 1. Setup localStorage with a local trip
    const localTrip: Trip = {
      id: 'trip-1',
      name: 'Local Trip',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      locations: [],
      plans: [],
      placeGroups: [],
      driveFileId: 'file-1',
      updatedAt: 1000
    };
    localStorage.setItem('vacation-itineraries', JSON.stringify([localTrip]));
    localStorage.setItem('vacation-itineraries-sync-timestamps', JSON.stringify({ 'trip-1': 1000 }));
    
    // Setup Google credentials in localStorage to auto-trigger performSync
    localStorage.setItem('google-access-token', 'fake-token');
    localStorage.setItem('google-token-expires-at', (Date.now() + 3600 * 1000).toString());
    localStorage.setItem('google-folder-id', 'folder-123');
    localStorage.setItem('google-user', JSON.stringify({ name: 'Test User', email: 'test@gmail.com', picture: 'pic' }));

    // Mock fetchTripsFromDrive to report trip-1 as deleted in cloud
    vi.mocked(fetchTripsFromDrive).mockResolvedValue({
      activeTrips: [],
      deletedTripIds: ['trip-1']
    });

    render(<App />);

    // Wait for sync to finish
    await waitFor(() => {
      expect(fetchTripsFromDrive).toHaveBeenCalled();
    });

    // Verify localStorage has removed trip-1
    await waitFor(() => {
      const saved = localStorage.getItem('vacation-itineraries');
      const parsed = saved ? JSON.parse(saved) : [];
      expect(parsed.some((t: Trip) => t.id === 'trip-1')).toBe(false);
    });
  });

  it('silently pulls cloud changes when local version is unmodified', async () => {
    // Setup local trip
    const localTrip: Trip = {
      id: 'trip-1',
      name: 'Local Version',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      locations: [],
      plans: [],
      placeGroups: [],
      driveFileId: 'file-1',
      updatedAt: 1000
    };
    localStorage.setItem('vacation-itineraries', JSON.stringify([localTrip]));
    localStorage.setItem('vacation-itineraries-sync-timestamps', JSON.stringify({ 'trip-1': 1000 }));

    // Setup Google credentials
    localStorage.setItem('google-access-token', 'fake-token');
    localStorage.setItem('google-token-expires-at', (Date.now() + 3600 * 1000).toString());
    localStorage.setItem('google-folder-id', 'folder-123');
    localStorage.setItem('google-user', JSON.stringify({ name: 'Test User', email: 'test@gmail.com', picture: 'pic' }));

    // Mock cloud trip with newer updatedAt
    const cloudTrip: Trip = {
      ...localTrip,
      name: 'Cloud Version (Updated)',
      updatedAt: 2000
    };

    vi.mocked(fetchTripsFromDrive).mockResolvedValue({
      activeTrips: [cloudTrip],
      deletedTripIds: []
    });

    render(<App />);

    await waitFor(() => {
      expect(fetchTripsFromDrive).toHaveBeenCalled();
    });

    // Local trip should be updated silently to the cloud version
    await waitFor(() => {
      const saved = localStorage.getItem('vacation-itineraries');
      const parsed = saved ? JSON.parse(saved) : [];
      expect(parsed[0].name).toBe('Cloud Version (Updated)');
    });
  });

  it('detects conflicts and opens the SyncConflictModal', async () => {
    // Local trip is modified locally since last sync (updatedAt: 2000 > lastSynced: 1000)
    const localTrip: Trip = {
      id: 'trip-1',
      name: 'Local Changes',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      locations: [],
      plans: [],
      placeGroups: [],
      driveFileId: 'file-1',
      updatedAt: 2000
    };
    localStorage.setItem('vacation-itineraries', JSON.stringify([localTrip]));
    localStorage.setItem('vacation-itineraries-sync-timestamps', JSON.stringify({ 'trip-1': 1000 }));

    // Setup Google credentials
    localStorage.setItem('google-access-token', 'fake-token');
    localStorage.setItem('google-token-expires-at', (Date.now() + 3600 * 1000).toString());
    localStorage.setItem('google-folder-id', 'folder-123');
    localStorage.setItem('google-user', JSON.stringify({ name: 'Test User', email: 'test@gmail.com', picture: 'pic' }));

    // Cloud version is also modified since last sync (updatedAt: 3000 > lastSynced: 1000)
    const cloudTrip: Trip = {
      ...localTrip,
      name: 'Cloud Changes',
      updatedAt: 3000
    };

    vi.mocked(fetchTripsFromDrive).mockResolvedValue({
      activeTrips: [cloudTrip],
      deletedTripIds: []
    });

    render(<App />);

    // Wait for the sync to run and conflict modal to open
    await waitFor(() => {
      expect(screen.getByText(/Trip Sync Conflict/i)).toBeInTheDocument();
    });

    // Verify it lists the conflict details
    expect(screen.getByText(/We detected a conflict/i)).toBeInTheDocument();
  });

  it('handles conflict resolution choice: Get Cloud Version', async () => {
    const localTrip: Trip = {
      id: 'trip-1',
      name: 'Local Changes',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      locations: [],
      plans: [],
      placeGroups: [],
      driveFileId: 'file-1',
      updatedAt: 2000
    };
    localStorage.setItem('vacation-itineraries', JSON.stringify([localTrip]));
    localStorage.setItem('vacation-itineraries-sync-timestamps', JSON.stringify({ 'trip-1': 1000 }));

    // Setup Google credentials
    localStorage.setItem('google-access-token', 'fake-token');
    localStorage.setItem('google-token-expires-at', (Date.now() + 3600 * 1000).toString());
    localStorage.setItem('google-folder-id', 'folder-123');
    localStorage.setItem('google-user', JSON.stringify({ name: 'Test User', email: 'test@gmail.com', picture: 'pic' }));

    const cloudTrip: Trip = {
      ...localTrip,
      name: 'Cloud Changes',
      updatedAt: 3000
    };

    vi.mocked(fetchTripsFromDrive).mockResolvedValue({
      activeTrips: [cloudTrip],
      deletedTripIds: []
    });

    render(<App />);

    // Wait for conflict modal
    const getCloudBtn = await screen.findByRole('button', { name: 'Get Cloud Version' });
    fireEvent.click(getCloudBtn);

    // Verify local storage updated to cloud version name and timestamp
    await waitFor(() => {
      const saved = localStorage.getItem('vacation-itineraries');
      const parsed = saved ? JSON.parse(saved) : [];
      expect(parsed[0].name).toBe('Cloud Changes');
      
      const timestamps = JSON.parse(localStorage.getItem('vacation-itineraries-sync-timestamps') || '{}');
      expect(timestamps['trip-1']).toBe(3000);
    });
  });

  it('handles conflict resolution choice: Override Cloud', async () => {
    const localTrip: Trip = {
      id: 'trip-1',
      name: 'Local Changes',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      locations: [],
      plans: [],
      placeGroups: [],
      driveFileId: 'file-1',
      updatedAt: 2000
    };
    localStorage.setItem('vacation-itineraries', JSON.stringify([localTrip]));
    localStorage.setItem('vacation-itineraries-sync-timestamps', JSON.stringify({ 'trip-1': 1000 }));

    // Setup Google credentials
    localStorage.setItem('google-access-token', 'fake-token');
    localStorage.setItem('google-token-expires-at', (Date.now() + 3600 * 1000).toString());
    localStorage.setItem('google-folder-id', 'folder-123');
    localStorage.setItem('google-user', JSON.stringify({ name: 'Test User', email: 'test@gmail.com', picture: 'pic' }));

    const cloudTrip: Trip = {
      ...localTrip,
      name: 'Cloud Changes',
      updatedAt: 3000
    };

    vi.mocked(fetchTripsFromDrive).mockResolvedValue({
      activeTrips: [cloudTrip],
      deletedTripIds: []
    });

    render(<App />);

    // Wait for conflict modal
    const overrideCloudBtn = await screen.findByRole('button', { name: 'Override Cloud' });
    fireEvent.click(overrideCloudBtn);

    // Verify local storage retains local changes, sets a new timestamp, and saves to Drive
    await waitFor(() => {
      const saved = localStorage.getItem('vacation-itineraries');
      const parsed = saved ? JSON.parse(saved) : [];
      expect(parsed[0].name).toBe('Local Changes');
      
      const timestamps = JSON.parse(localStorage.getItem('vacation-itineraries-sync-timestamps') || '{}');
      expect(timestamps['trip-1']).toBeGreaterThan(2000);
      expect(saveTripsToDrive).toHaveBeenCalled();
    });
  });

  it('triggers performSync pipeline when manual Sync Now button is clicked', async () => {
    // Setup Google credentials
    localStorage.setItem('google-access-token', 'fake-token');
    localStorage.setItem('google-token-expires-at', (Date.now() + 3600 * 1000).toString());
    localStorage.setItem('google-folder-id', 'folder-123');
    localStorage.setItem('google-user', JSON.stringify({ name: 'Test User', email: 'test@gmail.com', picture: 'pic' }));

    vi.mocked(fetchTripsFromDrive).mockResolvedValue({
      activeTrips: [],
      deletedTripIds: []
    });

    const { container } = render(<App />);

    await waitFor(() => {
      expect(fetchTripsFromDrive).toHaveBeenCalledTimes(1);
    });

    // Find and click the manual sync button (Sync Now)
    const syncBtn = container.querySelector('[data-tooltip="Sync Now"]');
    expect(syncBtn).not.toBeNull();
    
    // Clear mock calls to verify the click triggers a new fetch
    vi.mocked(fetchTripsFromDrive).mockClear();
    fireEvent.click(syncBtn!);

    await waitFor(() => {
      expect(fetchTripsFromDrive).toHaveBeenCalledTimes(1);
    });
  });
});
