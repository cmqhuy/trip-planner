import { useState, useEffect, useRef } from 'react';
import type { Trip, Plan, PlanDay } from './types';
import TripDashboard from './components/TripDashboard';
import TripPlanner from './components/TripPlanner';
import { DEFAULT_PLACE_GROUPS } from './utils/api';
import { generateDatesRange } from './utils/dateUtils';
import { X } from 'lucide-react';
import { 
  loadGsiScript, 
  initTokenClient, 
  requestAccessToken, 
  fetchGoogleUserInfo, 
  getOrCreateTripPlannerFolder, 
  fetchTripsFromDrive, 
  saveTripsToDrive, 
  fetchSingleTripFromDrive,
  checkIfTripDeletedOnDrive,
  DEFAULT_CLIENT_ID 
} from './utils/googleDrive';
import GoogleAuthSection from './components/GoogleAuthSection';

const LOCAL_STORAGE_KEY = 'vacation-itineraries';

function tripsAreEqual(a: Trip, b: Trip): boolean {
  const cleanTrip = (t: Trip) => {
    const { updatedAt, ...rest } = t as any;
    return JSON.stringify(rest);
  };
  return cleanTrip(a) === cleanTrip(b);
}

function detectConflictsAndMerge(
  localTrips: Trip[],
  cloudTrips: Trip[],
  syncTimestamps: Record<string, number>,
  onSilentUpdate: (updatedTrips: Trip[]) => void
): { tripId: string; localTrip: Trip; cloudTrip: Trip; }[] {
  const conflicts: { tripId: string; localTrip: Trip; cloudTrip: Trip; }[] = [];
  let updatedLocalTrips = [...localTrips];
  let localChanged = false;

  cloudTrips.forEach(cloudTrip => {
    const localTrip = localTrips.find(t => t.id === cloudTrip.id);
    if (localTrip) {
      if (!tripsAreEqual(localTrip, cloudTrip)) {
        const localTime = localTrip.updatedAt || 0;
        const cloudTime = cloudTrip.updatedAt || 0;
        const lastSyncedTime = syncTimestamps[cloudTrip.id] || 0;

        if (localTime === lastSyncedTime) {
          // No local changes since last sync! Silently pull cloud version
          updatedLocalTrips = updatedLocalTrips.map(t => t.id === cloudTrip.id ? cloudTrip : t);
          syncTimestamps[cloudTrip.id] = cloudTime;
          localChanged = true;
        } else {
          // Local changes exist! This is a conflict
          conflicts.push({
            tripId: cloudTrip.id,
            localTrip,
            cloudTrip
          });
        }
      } else {
        // Equal in content, make sure timestamp is marked as synced
        syncTimestamps[cloudTrip.id] = cloudTrip.updatedAt || 0;
      }
    } else {
      // Exists in cloud but not locally: silently pull
      updatedLocalTrips.push(cloudTrip);
      syncTimestamps[cloudTrip.id] = cloudTrip.updatedAt || 0;
      localChanged = true;
    }
  });

  if (localChanged) {
    onSilentUpdate(updatedLocalTrips);
  }

  return conflicts;
}

export default function App() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTripId, setActiveTripId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('trip');
  });

  // Conflict resolution states
  const [pendingConflicts, setPendingConflicts] = useState<{
    tripId: string;
    localTrip: Trip;
    cloudTrip: Trip;
  }[]>([]);
  const [appNotification, setAppNotification] = useState<{ title: string; message: string } | null>(null);
  const fetchedCloudTripsRef = useRef<Trip[]>([]);
  const syncTimestampsRef = useRef<Record<string, number>>((() => {
    try {
      const saved = localStorage.getItem('vacation-itineraries-sync-timestamps');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  })());

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

  // Load trips from LocalStorage on mount and listen to storage events from other tabs
  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        setTrips(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse trips from LocalStorage:', e);
      }
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LOCAL_STORAGE_KEY) {
        if (e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            setTrips(parsed);
            
            // If the currently active trip was deleted in another tab, reset activeTripId
            if (activeTripId && !parsed.some((t: Trip) => t.id === activeTripId)) {
              setActiveTripId(null);
            }
          } catch (err) {
            console.error('Failed to parse updated trips from storage event:', err);
          }
        } else {
          setTrips([]);
          setActiveTripId(null);
        }
      } else if (e.key === 'vacation-itineraries-sync-timestamps') {
        if (e.newValue) {
          try {
            syncTimestampsRef.current = JSON.parse(e.newValue);
          } catch (err) {
            console.error('Failed to parse sync timestamps from storage event:', err);
          }
        } else {
          syncTimestampsRef.current = {};
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [activeTripId]);

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

  // Silent background token refresh for active session (only refreshes if session is currently active and within 5 mins of expiry)
  useEffect(() => {
    if (!googleToken) return;

    const interval = setInterval(() => {
      const expiresAtStr = localStorage.getItem('google-token-expires-at');
      if (expiresAtStr) {
        const expiresAt = Number(expiresAtStr);
        const now = Date.now();
        const timeRemaining = expiresAt - now;

        // If the token is active but expires in less than 5 minutes, refresh it silently
        if (timeRemaining > 0 && timeRemaining < 300000) {
          console.log('Token expiring soon, requesting silent refresh...');
          try {
            requestAccessToken('');
          } catch (e) {
            console.error('Silent token refresh failed:', e);
          }
        }
      }
    }, 60000); // Check every 60 seconds

    return () => clearInterval(interval);
  }, [googleToken]);

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
        const syncResult = await fetchTripsFromDrive(googleToken, googleFolderId);
        const cloudTrips = syncResult?.activeTrips || [];
        const cloudDeletedTripIds = syncResult?.deletedTripIds || [];
        fetchedCloudTripsRef.current = cloudTrips;
        
        // Load local trips
        const savedLocal = localStorage.getItem(LOCAL_STORAGE_KEY);
        let localTrips: Trip[] = savedLocal ? JSON.parse(savedLocal) : [];

        // Apply cloud deletions locally
        if (cloudDeletedTripIds.length > 0) {
          localTrips = localTrips.filter(t => !cloudDeletedTripIds.includes(t.id));
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localTrips));
          setTrips(localTrips);
        }

        // Detect conflicts and silently pull changes
        const conflicts = detectConflictsAndMerge(
          localTrips,
          cloudTrips,
          syncTimestampsRef.current,
          (updated) => {
            setTrips(updated);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
          }
        );
        localStorage.setItem('vacation-itineraries-sync-timestamps', JSON.stringify(syncTimestampsRef.current));

        if (conflicts.length > 0) {
          setPendingConflicts(conflicts);
          setSyncStatus('idle');
          return;
        }

        // Get the latest merged list (silently pulled cloud trips are already included)
        const currentTrips = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');

        // Save merged result to Google Drive
        await saveTripsToDrive(googleToken, googleFolderId, currentTrips);
        
        // Mark all saved trips as synced
        currentTrips.forEach((trip: Trip) => {
          syncTimestampsRef.current[trip.id] = trip.updatedAt || 0;
        });
        localStorage.setItem('vacation-itineraries-sync-timestamps', JSON.stringify(syncTimestampsRef.current));

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

  // Poll Google Drive for the active trip every 30s
  useEffect(() => {
    if (!googleToken || !googleFolderId || !activeTripId) return;

    const pollInterval = setInterval(async () => {
      if (pendingConflicts.length > 0 || syncStatus === 'syncing') return;

      try {
        const cloudTrip = await fetchSingleTripFromDrive(googleToken, googleFolderId, activeTripId);
        if (!cloudTrip) {
          const isDeletedOnDrive = await checkIfTripDeletedOnDrive(googleToken, googleFolderId, activeTripId);
          if (isDeletedOnDrive) {
            const savedLocal = localStorage.getItem(LOCAL_STORAGE_KEY);
            const localTrips: Trip[] = savedLocal ? JSON.parse(savedLocal) : [];
            const updatedLocalTrips = localTrips.filter(t => t.id !== activeTripId);
            setTrips(updatedLocalTrips);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedLocalTrips));
            setActiveTripId(null);
            setAppNotification({ title: 'Trip Deleted', message: 'This trip was deleted on another device.' });
          }
          return;
        }

        // Find current local active trip
        const savedLocal = localStorage.getItem(LOCAL_STORAGE_KEY);
        const localTrips: Trip[] = savedLocal ? JSON.parse(savedLocal) : [];
        const localTrip = localTrips.find(t => t.id === activeTripId);

        if (localTrip && !tripsAreEqual(localTrip, cloudTrip)) {
          const localTime = localTrip.updatedAt || 0;
          const cloudTime = cloudTrip.updatedAt || 0;
          const lastSyncedTime = syncTimestampsRef.current[activeTripId] || 0;

          if (localTime === lastSyncedTime) {
            // Silently pull!
            const updatedLocalTrips = localTrips.map(t => t.id === activeTripId ? cloudTrip : t);
            setTrips(updatedLocalTrips);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedLocalTrips));
            
            syncTimestampsRef.current[activeTripId] = cloudTime;
            localStorage.setItem('vacation-itineraries-sync-timestamps', JSON.stringify(syncTimestampsRef.current));
          } else {
            // Real conflict!
            setPendingConflicts(prev => {
              if (prev.some(c => c.tripId === activeTripId)) return prev;
              return [...prev, { tripId: activeTripId, localTrip, cloudTrip }];
            });
          }
        }
      } catch (err) {
        console.error('Error polling active trip from Google Drive:', err);
      }
    }, 30000);

    return () => clearInterval(pollInterval);
  }, [googleToken, googleFolderId, activeTripId, pendingConflicts, syncStatus]);

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
          // Mark all saved trips as synced
          updatedTrips.forEach(trip => {
            syncTimestampsRef.current[trip.id] = trip.updatedAt || 0;
          });
          localStorage.setItem('vacation-itineraries-sync-timestamps', JSON.stringify(syncTimestampsRef.current));
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

  const handleResolveConflict = async (choice: 'cloud' | 'local') => {
    if (pendingConflicts.length === 0) return;
    const activeConflict = pendingConflicts[0];

    let updatedTrips = [...trips];
    if (choice === 'cloud') {
      // Replaces the local version with the cloud version
      updatedTrips = updatedTrips.map(t => 
        t.id === activeConflict.tripId ? activeConflict.cloudTrip : t
      );
      if (!updatedTrips.some(t => t.id === activeConflict.tripId)) {
        updatedTrips.push(activeConflict.cloudTrip);
      }
      syncTimestampsRef.current[activeConflict.tripId] = activeConflict.cloudTrip.updatedAt || 0;
    } else {
      // Overwrite cloud version: Keep local, but update timestamp to make it newer
      const newTimestamp = Date.now();
      updatedTrips = updatedTrips.map(t => 
        t.id === activeConflict.tripId 
          ? { ...t, updatedAt: newTimestamp } 
          : t
      );
      syncTimestampsRef.current[activeConflict.tripId] = newTimestamp;
    }
    localStorage.setItem('vacation-itineraries-sync-timestamps', JSON.stringify(syncTimestampsRef.current));

    setTrips(updatedTrips);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedTrips));

    const nextConflicts = pendingConflicts.slice(1);
    setPendingConflicts(nextConflicts);

    if (nextConflicts.length === 0) {
      setSyncStatus('syncing');
      try {
        const cloudTrips = fetchedCloudTripsRef.current || [];
        
        const finalTripsMap = new Map<string, Trip>();
        updatedTrips.forEach(t => finalTripsMap.set(t.id, t));
        cloudTrips.forEach(ct => {
          if (!finalTripsMap.has(ct.id)) {
            finalTripsMap.set(ct.id, ct);
          }
        });

        const finalTrips = Array.from(finalTripsMap.values());
        setTrips(finalTrips);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(finalTrips));

        await saveTripsToDrive(googleToken!, googleFolderId!, finalTrips);
        
        // Mark all final trips as synced
        finalTrips.forEach(trip => {
          syncTimestampsRef.current[trip.id] = trip.updatedAt || 0;
        });
        localStorage.setItem('vacation-itineraries-sync-timestamps', JSON.stringify(syncTimestampsRef.current));

        setSyncStatus('synced');
      } catch (e) {
        console.error('Failed to finalize sync after conflict resolution:', e);
        setSyncStatus('error');
      }
    }
  };

  const handleManualSync = async () => {
    if (!googleToken || !googleFolderId) return;
    setSyncStatus('syncing');
    try {
      const syncResult = await fetchTripsFromDrive(googleToken, googleFolderId);
      const cloudTrips = syncResult?.activeTrips || [];
      const cloudDeletedTripIds = syncResult?.deletedTripIds || [];
      fetchedCloudTripsRef.current = cloudTrips;

      let currentTrips = [...trips];
      if (cloudDeletedTripIds.length > 0) {
        currentTrips = currentTrips.filter(t => !cloudDeletedTripIds.includes(t.id));
        setTrips(currentTrips);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentTrips));
      }

      // Detect conflicts and silently pull changes
      const conflicts = detectConflictsAndMerge(
        currentTrips,
        cloudTrips,
        syncTimestampsRef.current,
        (updated) => {
          setTrips(updated);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
        }
      );
      localStorage.setItem('vacation-itineraries-sync-timestamps', JSON.stringify(syncTimestampsRef.current));

      if (conflicts.length > 0) {
        setPendingConflicts(conflicts);
        setSyncStatus('idle');
        return;
      }

      currentTrips = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
      await saveTripsToDrive(googleToken, googleFolderId, currentTrips);
      
      // Mark all saved trips as synced
      currentTrips.forEach((trip: Trip) => {
        syncTimestampsRef.current[trip.id] = trip.updatedAt || 0;
      });
      localStorage.setItem('vacation-itineraries-sync-timestamps', JSON.stringify(syncTimestampsRef.current));

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
      placeGroups: [...DEFAULT_PLACE_GROUPS],
      updatedAt: Date.now()
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
    const tripWithTimestamp = { ...updatedTrip, updatedAt: Date.now() };
    const updated = trips.map(t => (t.id === updatedTrip.id ? tripWithTimestamp : t));
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

      {pendingConflicts.length > 0 && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '24px'
          }}
        >
          <div 
            className="glass-panel" 
            style={{
              maxWidth: '600px',
              width: '100%',
              padding: '32px',
              borderRadius: '16px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px'
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div 
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  marginBottom: '16px'
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
                Trip Sync Conflict
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
                We detected a conflict for the trip: <strong>{pendingConflicts[0].localTrip.name}</strong>. The version stored on Google Drive is newer or different than your local version.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <button 
                onClick={() => handleResolveConflict('cloud')}
                style={{
                  textAlign: 'left',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '12px',
                  padding: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  outline: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                  e.currentTarget.style.borderColor = 'var(--border-glass)';
                }}
              >
                <div style={{ fontWeight: '600', color: '#6366f1', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Get Latest Version from Google Drive
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  This will replace your local trip with the one on Google Drive. Choose this if you edited this trip on another device and want to load those changes. <strong>Note:</strong> Any local changes since the last sync will be lost.
                </div>
              </button>

              <button 
                onClick={() => handleResolveConflict('local')}
                style={{
                  textAlign: 'left',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '12px',
                  padding: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  outline: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(52, 211, 153, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                  e.currentTarget.style.borderColor = 'var(--border-glass)';
                }}
              >
                <div style={{ fontWeight: '600', color: '#34d399', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Override Google Drive Version
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  This will keep your local trip and overwrite the version stored on Google Drive. Choose this if the current local version is the correct one. <strong>Note:</strong> This will replace the file in the cloud.
                </div>
              </button>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
              Conflict 1 of {pendingConflicts.length}
            </div>
          </div>
        </div>
      )}

      {appNotification && (
        <div className="modal-overlay" onClick={() => setAppNotification(null)}>
          <div className="modal-content glass-panel" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{appNotification.title}</h3>
              <button className="modal-close" onClick={() => setAppNotification(null)}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '16px 0', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5', textTransform: 'none' }}>
              {appNotification.message}
            </div>
            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button 
                type="button" 
                className="btn-primary" 
                style={{ background: 'var(--accent-primary)', borderColor: 'var(--accent-primary)' }}
                onClick={() => setAppNotification(null)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
