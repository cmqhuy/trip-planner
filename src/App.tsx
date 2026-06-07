import { useState, useEffect, useRef } from 'react';
import type { Trip, Plan, PlanDay } from './types';
import TripDashboard from './components/TripDashboard';
import TripPlanner from './components/TripPlanner';
import { DEFAULT_PLACE_GROUPS } from './utils/api';
import { generateDatesRange } from './utils/dateUtils';
import { 
  loadGsiScript, 
  initTokenClient, 
  requestAccessToken, 
  fetchGoogleUserInfo, 
  getOrCreateTripPlannerFolder, 
  fetchTripsFromDrive, 
  saveTripsToDrive, 
  mergeTrips, 
  DEFAULT_CLIENT_ID 
} from './utils/googleDrive';
import GoogleAuthSection from './components/GoogleAuthSection';

const LOCAL_STORAGE_KEY = 'vacation-itineraries';

export default function App() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTripId, setActiveTripId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('trip');
  });

  // Google Integration States
  const [googleUser, setGoogleUser] = useState<{ name: string; email: string; picture: string } | null>(() => {
    const expiresAtStr = localStorage.getItem('google-token-expires-at');
    if (expiresAtStr && Number(expiresAtStr) > Date.now()) {
      const userStr = localStorage.getItem('google-user');
      try {
        return userStr ? JSON.parse(userStr) : null;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [googleToken, setGoogleToken] = useState<string | null>(() => {
    const expiresAtStr = localStorage.getItem('google-token-expires-at');
    if (expiresAtStr && Number(expiresAtStr) > Date.now()) {
      return localStorage.getItem('google-access-token');
    }
    return null;
  });

  const [googleFolderId, setGoogleFolderId] = useState<string | null>(() => {
    const expiresAtStr = localStorage.getItem('google-token-expires-at');
    if (expiresAtStr && Number(expiresAtStr) > Date.now()) {
      return localStorage.getItem('google-folder-id');
    }
    return null;
  });

  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>(() => {
    const expiresAtStr = localStorage.getItem('google-token-expires-at');
    if (expiresAtStr && Number(expiresAtStr) > Date.now()) {
      return 'synced';
    }
    return 'idle';
  });

  const clientId = localStorage.getItem('google-client-id') || (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || DEFAULT_CLIENT_ID;

  const syncTimeoutRef = useRef<any>(null);

  // Load trips from LocalStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        setTrips(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse trips from LocalStorage:', e);
      }
    }
  }, []);

  // Load GIS script and init token client when clientId changes
  useEffect(() => {
    if (!clientId) return;

    loadGsiScript()
      .then(() => {
        try {
          initTokenClient(
            clientId,
            (token, expiresIn) => {
              setGoogleToken(token);
              const expiresAt = Date.now() + expiresIn * 1000;
              localStorage.setItem('google-access-token', token);
              localStorage.setItem('google-token-expires-at', expiresAt.toString());
            },
            (err) => {
              console.error('Google token request failed:', err);
              setSyncStatus('error');
            }
          );
        } catch (e) {
          console.error('Failed to initialize token client:', e);
        }
      })
      .catch((err) => {
        console.error('Failed to load Google Identity Services script:', err);
      });
  }, [clientId]);

  // Load user profile & Drive folder when token is received
  useEffect(() => {
    if (!googleToken) return;

    const loadCredentials = async () => {
      // Check if we already have them locally and they are valid (to avoid redundant API fetches on mount refresh)
      const cachedUser = localStorage.getItem('google-user');
      const cachedFolder = localStorage.getItem('google-folder-id');
      const cachedExpiresAt = localStorage.getItem('google-token-expires-at');

      if (cachedUser && cachedFolder && cachedExpiresAt && Number(cachedExpiresAt) > Date.now()) {
        try {
          setGoogleUser(JSON.parse(cachedUser));
          setGoogleFolderId(cachedFolder);
          return;
        } catch {
          // fall through
        }
      }

      setSyncStatus('syncing');
      try {
        const user = await fetchGoogleUserInfo(googleToken);
        setGoogleUser(user);
        localStorage.setItem('google-user', JSON.stringify(user));

        const folderId = await getOrCreateTripPlannerFolder(googleToken);
        setGoogleFolderId(folderId);
        localStorage.setItem('google-folder-id', folderId);
      } catch (e) {
        console.error('Failed to load Google credentials:', e);
        setSyncStatus('error');
      }
    };

    loadCredentials();
  }, [googleToken]);

  // Initial Sync Logic once folder is ready
  useEffect(() => {
    if (!googleToken || !googleFolderId) return;

    const performInitialSync = async () => {
      setSyncStatus('syncing');
      try {
        const cloudTrips = await fetchTripsFromDrive(googleToken, googleFolderId);
        
        // Load local trips
        const savedLocal = localStorage.getItem(LOCAL_STORAGE_KEY);
        const localTrips: Trip[] = savedLocal ? JSON.parse(savedLocal) : [];

        // Auto-merge local and cloud trips to sync both ends
        const merged = mergeTrips(localTrips, cloudTrips || []);
        
        // Save merged result locally
        setTrips(merged);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));

        // Save merged result to Google Drive
        await saveTripsToDrive(googleToken, googleFolderId, merged);
        setSyncStatus('synced');
      } catch (e) {
        console.error('Initial Google Drive sync failed:', e);
        setSyncStatus('error');
      }
    };

    performInitialSync();
  }, [googleToken, googleFolderId]);

  // Sync activeTripId with URL search parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currentTripParam = params.get('trip');
    
    if (activeTripId) {
      if (currentTripParam !== activeTripId) {
        params.set('trip', activeTripId);
        params.delete('plan');
        params.delete('day');
        const newSearch = params.toString();
        window.history.pushState({}, '', `${window.location.pathname}?${newSearch}`);
      }
    } else {
      if (currentTripParam !== null) {
        params.delete('trip');
        params.delete('plan');
        params.delete('day');
        const newSearch = params.toString();
        const newUrl = `${window.location.pathname}${newSearch ? '?' + newSearch : ''}`;
        window.history.pushState({}, '', newUrl);
      }
    }
  }, [activeTripId]);

  // Listen to browser Back/Forward navigation (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setActiveTripId(params.get('trip'));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Prevent tab close/refresh if there is active syncing to Google Drive
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (syncStatus === 'syncing') {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes syncing to Google Drive. Please wait for the sync to finish before leaving.';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [syncStatus]);

  // Save trips locally and automatically sync to Google Drive
  const saveTrips = (updatedTrips: Trip[]) => {
    setTrips(updatedTrips);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedTrips));

    if (googleToken && googleFolderId) {
      setSyncStatus('syncing');

      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      syncTimeoutRef.current = setTimeout(async () => {
        try {
          await saveTripsToDrive(googleToken, googleFolderId, updatedTrips);
          setSyncStatus('synced');
        } catch (e) {
          console.error('Automatic background sync failed:', e);
          setSyncStatus('error');
        }
      }, 1000);
    }
  };

  const handleSignIn = () => {
    setSyncStatus('syncing');
    try {
      requestAccessToken();
    } catch (e) {
      console.error('Failed to request access token:', e);
      setSyncStatus('error');
    }
  };

  const handleSignOut = () => {
    setGoogleUser(null);
    setGoogleToken(null);
    setGoogleFolderId(null);
    setSyncStatus('idle');
    localStorage.removeItem('google-access-token');
    localStorage.removeItem('google-token-expires-at');
    localStorage.removeItem('google-user');
    localStorage.removeItem('google-folder-id');
  };

  const handleManualSync = async () => {
    if (!googleToken || !googleFolderId) return;
    setSyncStatus('syncing');
    try {
      await saveTripsToDrive(googleToken, googleFolderId, trips);
      setSyncStatus('synced');
    } catch (e) {
      console.error('Manual sync failed:', e);
      setSyncStatus('error');
    }
  };



  const handleCreateTrip = (newTripData: Omit<Trip, 'id' | 'locations' | 'plans' | 'placeGroups'>) => {
    const tripId = `trip-${Date.now()}`;
    const dates = generateDatesRange(newTripData.startDate, newTripData.endDate);
    
    const defaultDays: { [dateStr: string]: PlanDay } = {};
    dates.forEach(date => {
      defaultDays[date] = {
        dateStr: date,
        placeIds: []
      };
    });

    const defaultPlan: Plan = {
      id: `plan-main-${Date.now()}`,
      name: 'Main Plan',
      startDate: newTripData.startDate,
      endDate: newTripData.endDate,
      days: defaultDays,
      hotels: [],
      transports: []
    };

    const newTrip: Trip = {
      id: tripId,
      name: newTripData.name,
      startDate: newTripData.startDate,
      endDate: newTripData.endDate,
      locations: [],
      plans: [defaultPlan],
      placeGroups: [...DEFAULT_PLACE_GROUPS]
    };

    saveTrips([...trips, newTrip]);
    setActiveTripId(tripId);
  };

  const handleDeleteTrip = (id: string) => {
    const updated = trips.filter(t => t.id !== id);
    saveTrips(updated);
    if (activeTripId === id) {
      setActiveTripId(null);
    }
  };

  const handleUpdateTrip = (updatedTrip: Trip) => {
    const updated = trips.map(t => (t.id === updatedTrip.id ? updatedTrip : t));
    saveTrips(updated);
  };

  const activeTrip = trips.find(t => t.id === activeTripId);

  return (
    <div className="app-container">
      {/* Premium Header */}
      <header className="app-header glass-panel" style={{ borderRadius: '0', borderWidth: '0 0 1px 0' }}>
        <div className="logo-section">
          <img src="logo.png" alt="Logo" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
          <h1>Trip Planner</h1>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <GoogleAuthSection
            user={googleUser}
            syncStatus={syncStatus}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
            onManualSync={handleManualSync}
          />
          <span 
            style={{ 
              fontSize: '11px', 
              color: 'var(--text-secondary)', 
              background: 'rgba(255,255,255,0.05)', 
              padding: '4px 10px', 
              borderRadius: '99px',
              border: '1px solid var(--border-glass)'
            }}
          >
            v1.0.0
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeTrip ? (
          <TripPlanner 
            trip={activeTrip}
            onBack={() => setActiveTripId(null)}
            onUpdateTrip={handleUpdateTrip}
          />
        ) : (
          <TripDashboard 
            trips={trips}
            onCreateTrip={handleCreateTrip}
            onDeleteTrip={handleDeleteTrip}
            onSelectTrip={setActiveTripId}
            isGoogleSignedIn={googleUser !== null}
          />
        )}
      </main>

    </div>
  );
}
