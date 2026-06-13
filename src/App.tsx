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
  leaveSharedTripFile,
  deleteFileFromDrive,
  importSharedTripFile,
  fetchAiSettingsFromDrive,
  saveAiSettingsToDrive,
  deleteAiSettingsFromDrive,
  DEFAULT_CLIENT_ID,
  GOOGLE_SCOPES
} from './utils/googleDrive';
import GoogleAuthSection from './components/GoogleAuthSection';
import ShareTripModal from './components/ShareTripModal';
import ConfirmationModal from './components/ConfirmationModal';
import SyncConflictModal from './components/SyncConflictModal';
import { GeminiService } from './utils/ai';
import AiSettingsModal from './components/AiSettingsModal';
import { Sparkles } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'vacation-itineraries';

function tripsAreEqual(a: Trip, b: Trip): boolean {
  const cleanTrip = (t: Trip) => {
    const { updatedAt, ...rest } = t as any;
    return JSON.stringify(rest);
  };
  return cleanTrip(a) === cleanTrip(b);
}


export default function App() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTripId, setActiveTripId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('trip');
  });

  // Share trip modal state
  const [shareModalTrip, setShareModalTrip] = useState<Trip | null>(null);

  // AI Settings states
  const [hasAiKey, setHasAiKey] = useState(() => GeminiService.hasApiKey());
  const [showAiSettings, setShowAiSettings] = useState(false);

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
    const storedScopes = localStorage.getItem('google-token-scopes');
    if (expiresAtStr && Number(expiresAtStr) > Date.now() && (!storedScopes || storedScopes === GOOGLE_SCOPES)) {
      return localStorage.getItem('google-access-token');
    }
    return null;
  });

  const [googleFolderId, setGoogleFolderId] = useState<string | null>(() => {
    const expiresAtStr = localStorage.getItem('google-token-expires-at');
    const storedScopes = localStorage.getItem('google-token-scopes');
    if (expiresAtStr && Number(expiresAtStr) > Date.now() && (!storedScopes || storedScopes === GOOGLE_SCOPES)) {
      return localStorage.getItem('google-folder-id');
    }
    return null;
  });

  const [syncStatus, setSyncStatus] = useState<'idle' | 'pending' | 'syncing' | 'synced' | 'error'>(() => {
    const expiresAtStr = localStorage.getItem('google-token-expires-at');
    const storedScopes = localStorage.getItem('google-token-scopes');
    if (expiresAtStr && Number(expiresAtStr) > Date.now() && (!storedScopes || storedScopes === GOOGLE_SCOPES)) {
      return 'synced';
    }
    return 'idle';
  });

  const tripsRef = useRef(trips);
  useEffect(() => {
    tripsRef.current = trips;
  }, [trips]);

  const googleTokenRef = useRef(googleToken);
  useEffect(() => {
    googleTokenRef.current = googleToken;
  }, [googleToken]);

  const googleFolderIdRef = useRef(googleFolderId);
  useEffect(() => {
    googleFolderIdRef.current = googleFolderId;
  }, [googleFolderId]);

  const activeTripIdRef = useRef(activeTripId);
  useEffect(() => {
    activeTripIdRef.current = activeTripId;
  }, [activeTripId]);

  const clientId = localStorage.getItem('google-client-id') || (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || DEFAULT_CLIENT_ID;

  const syncTimeoutRef = useRef<any>(null);
  const isSilentAuthRef = useRef(false);

  const cleanUpDeletedTrips = (deletedIds: string[]) => {
    if (!deletedIds || deletedIds.length === 0) return;

    const savedLocal = localStorage.getItem(LOCAL_STORAGE_KEY);
    const currentLocal: Trip[] = savedLocal ? JSON.parse(savedLocal) : [];
    const filteredLocal = currentLocal.filter(t => !deletedIds.includes(t.id));

    let changed = filteredLocal.length !== currentLocal.length;

    // Also clean up sync timestamps for deleted trips
    let timestampsChanged = false;
    deletedIds.forEach(id => {
      if (syncTimestampsRef.current[id] !== undefined) {
        delete syncTimestampsRef.current[id];
        timestampsChanged = true;
      }
    });

    if (timestampsChanged) {
      localStorage.setItem('vacation-itineraries-sync-timestamps', JSON.stringify(syncTimestampsRef.current));
    }

    if (changed) {
      setTrips(filteredLocal);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filteredLocal));

      setActiveTripId(currentId => {
        if (currentId && deletedIds.includes(currentId)) {
          setAppNotification({ title: 'Trip Deleted', message: 'This trip was deleted on another device.' });
          return null;
        }
        return currentId;
      });
    }
  };

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
              isSilentAuthRef.current = false;
              setGoogleToken(token);
              const expiresAt = Date.now() + expiresIn * 1000;
              localStorage.setItem('google-access-token', token);
              localStorage.setItem('google-token-expires-at', expiresAt.toString());
              localStorage.setItem('google-logged-in', 'true');
              localStorage.setItem('google-token-scopes', GOOGLE_SCOPES);
            },
            (err) => {
              console.error('Google token request failed:', err);
              setSyncStatus('error');
              if (isSilentAuthRef.current) {
                isSilentAuthRef.current = false;
                console.log('Silent re-auth failed, prompting for interactive sign-in...');
                handleSignIn();
              }
            }
          );

          // After initialization, check if we should auto-restore session silently
          const loggedIn = localStorage.getItem('google-logged-in') === 'true' || !!localStorage.getItem('google-access-token');
          const expiresAtStr = localStorage.getItem('google-token-expires-at');
          const isExpired = !expiresAtStr || Number(expiresAtStr) <= Date.now();
          const storedScopes = localStorage.getItem('google-token-scopes');

          if (loggedIn && (isExpired || storedScopes !== GOOGLE_SCOPES)) {
            console.log('User was previously logged in but token is expired or scopes mismatched. Attempting silent re-auth...');
            setSyncStatus('syncing');
            setTimeout(() => {
              try {
                requestAccessToken('');
              } catch (e) {
                console.error('Auto-login token request failed:', e);
                setSyncStatus('idle');
              }
            }, 100);
          }
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

  // Unified Synchronization function called by manual sync, timer poll, initial sync, and autosave
  const performSync = async (localTripsOverride?: Trip[]) => {
    const expiresAtStr = localStorage.getItem('google-token-expires-at');
    const isExpired = !expiresAtStr || Number(expiresAtStr) <= Date.now();

    if (isExpired && localStorage.getItem('google-logged-in') === 'true') {
      console.log('Token expired during sync attempt. Requesting silent refresh...');
      try {
        requestAccessToken('');
        return;
      } catch (e) {
        console.error('Silent refresh failed during sync:', e);
      }
    }

    const token = googleTokenRef.current;
    const folderId = googleFolderIdRef.current;
    if (!token || !folderId) return;

    setSyncStatus('syncing');
    try {
      // 1. Fetch cloud trips
      const syncResult = await fetchTripsFromDrive(token, folderId);
      const cloudTrips = syncResult?.activeTrips || [];
      const cloudDeletedTripIds = syncResult?.deletedTripIds || [];
      fetchedCloudTripsRef.current = cloudTrips;

      // 2. Load local trips
      const savedLocal = localStorage.getItem(LOCAL_STORAGE_KEY);
      let localTrips: Trip[] = localTripsOverride || (savedLocal ? JSON.parse(savedLocal) : []);

      // 3. Apply cloud deletions
      if (cloudDeletedTripIds.length > 0) {
        const originalLength = localTrips.length;
        localTrips = localTrips.filter(t => !cloudDeletedTripIds.includes(t.id));
        if (localTrips.length !== originalLength) {
          const activeId = activeTripIdRef.current;
          if (activeId && !localTrips.some(t => t.id === activeId)) {
            setActiveTripId(null);
            setAppNotification({ title: 'Trip Deleted', message: 'The active trip was deleted on another device.' });
          }
        }
      }

      // 4. Run conflict detection and silent merge
      const conflicts: { tripId: string; localTrip: Trip; cloudTrip: Trip }[] = [];
      const silentPullTrips: Trip[] = [];
      const silentPushTrips: Trip[] = [];
      let localDeletionsExist = false;
      const syncedTimestamps = { ...syncTimestampsRef.current };

      cloudTrips.forEach(cloudTrip => {
        const localTrip = localTrips.find(t => t.id === cloudTrip.id);
        const lastSynced = syncedTimestamps[cloudTrip.id] || 0;

        if (localTrip) {
          if (!tripsAreEqual(localTrip, cloudTrip)) {
            const localTime = localTrip.updatedAt || 0;
            const cloudTime = cloudTrip.updatedAt || 0;

            if (cloudTime > lastSynced && localTime > lastSynced) {
              // Both modified since last sync -> CONFLICT
              conflicts.push({ tripId: cloudTrip.id, localTrip, cloudTrip });
            } else if (cloudTime > lastSynced) {
              // Only cloud modified -> silent pull
              silentPullTrips.push(cloudTrip);
              syncedTimestamps[cloudTrip.id] = cloudTime;
            } else if (localTime > lastSynced) {
              // Only local modified -> silent push
              silentPushTrips.push(localTrip);
            }
          } else {
            // Equal, ensure timestamp matches
            syncedTimestamps[cloudTrip.id] = cloudTrip.updatedAt || 0;
          }
        } else {
          // In cloud, but not locally
          const isDeletedLocally = syncTimestampsRef.current[cloudTrip.id] !== undefined;
          if (!isDeletedLocally) {
            // New cloud trip -> silent pull
            silentPullTrips.push(cloudTrip);
            syncedTimestamps[cloudTrip.id] = cloudTrip.updatedAt || 0;
          } else {
            // Deleted locally -> we need to push this deletion to GDrive!
            localDeletionsExist = true;
          }
        }
      });

      // Check local trips not in cloud (could be new local trips or deleted on Drive)
      localTrips.forEach(localTrip => {
        const inCloud = cloudTrips.some(ct => ct.id === localTrip.id);
        if (!inCloud) {
          if (localTrip.driveFileId) {
            // Had a file ID but not in cloud list -> must have been deleted on Drive
            localTrips = localTrips.filter(t => t.id !== localTrip.id);
            if (syncedTimestamps[localTrip.id] !== undefined) {
              delete syncedTimestamps[localTrip.id];
            }
            const activeId = activeTripIdRef.current;
            if (activeId === localTrip.id) {
              setActiveTripId(null);
              setAppNotification({ title: 'Trip Deleted', message: 'The active trip was deleted on another device.' });
            }
          } else {
            // New local trip -> silent push
            silentPushTrips.push(localTrip);
          }
        }
      });

      // Apply silent pulls to localTrips
      let finalLocalTrips = localTrips.map(t => {
        const pulled = silentPullTrips.find(pt => pt.id === t.id);
        return pulled || t;
      });
      // Add new pulled trips
      silentPullTrips.forEach(pt => {
        if (!finalLocalTrips.some(t => t.id === pt.id)) {
          finalLocalTrips.push(pt);
        }
      });

      // Update state and storage with merged local trips
      setTrips(finalLocalTrips);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(finalLocalTrips));
      syncTimestampsRef.current = syncedTimestamps;
      localStorage.setItem('vacation-itineraries-sync-timestamps', JSON.stringify(syncedTimestamps));

      // If conflicts exist, show conflict modal and abort uploading
      if (conflicts.length > 0) {
        setPendingConflicts(conflicts);
        setSyncStatus('idle');
        return;
      }

      // 5. If no conflicts, save any local changes (silent push) or deletions to Drive
      if (silentPushTrips.length > 0 || localDeletionsExist || localTripsOverride) {
        const { deletedTripIds, driveFileIds } = await saveTripsToDrive(token, folderId, finalLocalTrips);
        cleanUpDeletedTrips(deletedTripIds);

        // Update local trips with their returned driveFileIds
        let hasUpdates = false;
        const mappedTrips = finalLocalTrips.map(trip => {
          const fileId = driveFileIds[trip.id];
          if (fileId && trip.driveFileId !== fileId) {
            hasUpdates = true;
            return { ...trip, driveFileId: fileId };
          }
          return trip;
        });

        if (hasUpdates) {
          setTrips(mappedTrips);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(mappedTrips));
          finalLocalTrips = mappedTrips;
        }

        // Mark all uploaded trips as synced
        finalLocalTrips.forEach(trip => {
          syncTimestampsRef.current[trip.id] = trip.updatedAt || 0;
        });
        localStorage.setItem('vacation-itineraries-sync-timestamps', JSON.stringify(syncTimestampsRef.current));
      }

      setSyncStatus('synced');
    } catch (err: any) {
      if (err.message === 'FOLDER_NOT_FOUND') {
        console.warn('Trip planner folder not found on Google Drive. Re-creating...');
        try {
          const newFolderId = await getOrCreateTripPlannerFolder(token);
          setGoogleFolderId(newFolderId);
          localStorage.setItem('google-folder-id', newFolderId);
          googleFolderIdRef.current = newFolderId;
          await performSync();
          return;
        } catch (recreateErr) {
          console.error('Failed to recreate Google Drive folder:', recreateErr);
        }
      }
      console.error('Synchronization failed:', err);
      setSyncStatus('error');
    }
  };

  // Initial Sync Logic once folder is ready
  useEffect(() => {
    if (!googleToken || !googleFolderId) return;
    performSync();
  }, [googleToken, googleFolderId]);

  // Load AI Settings from Google Drive on startup
  useEffect(() => {
    if (!googleToken || !googleFolderId) return;

    const syncAiSettingsOnStartup = async () => {
      try {
        const remoteSettings = await fetchAiSettingsFromDrive(googleToken, googleFolderId);
        if (remoteSettings) {
          GeminiService.saveApiKeys(remoteSettings.keys);
          GeminiService.saveSelectedModel(remoteSettings.model);
          GeminiService.setSyncToDrive(true);
          setHasAiKey(GeminiService.hasApiKey());
          console.log('Successfully loaded AI Settings from Google Drive on startup.');
        } else if (GeminiService.getSyncToDrive()) {
          // Sync is enabled locally but no file on drive, upload local settings
          const keys = GeminiService.getApiKeys();
          const model = GeminiService.getSelectedModel();
          if (keys.length > 0) {
            await saveAiSettingsToDrive(googleToken, googleFolderId, { keys, model });
            console.log('Successfully uploaded local AI Settings to Google Drive on startup.');
          }
        }
      } catch (err) {
        console.error('Failed to sync AI settings on startup:', err);
      }
    };

    syncAiSettingsOnStartup();
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

  // Poll Google Drive for any updates every 30s
  useEffect(() => {
    if (!googleToken || !googleFolderId) return;

    const pollInterval = setInterval(() => {
      if (pendingConflicts.length > 0 || syncStatus === 'syncing') return;
      performSync();
    }, 30000);

    return () => clearInterval(pollInterval);
  }, [googleToken, googleFolderId, pendingConflicts, syncStatus]);

  // Save trips locally and automatically sync to Google Drive
  const saveTrips = (updatedTrips: Trip[]) => {
    setTrips(updatedTrips);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedTrips));

    if (googleToken && googleFolderId) {
      setSyncStatus('pending');

      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      syncTimeoutRef.current = setTimeout(() => {
        performSync(updatedTrips);
      }, 30000);
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
    // Filter out shared trips (isOwner === false) on sign out
    const filteredTrips = trips.filter(t => t.isOwner !== false);
    setTrips(filteredTrips);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filteredTrips));

    setGoogleUser(null);
    setGoogleToken(null);
    setGoogleFolderId(null);
    setSyncStatus('idle');
    localStorage.removeItem('google-access-token');
    localStorage.removeItem('google-token-expires-at');
    localStorage.removeItem('google-user');
    localStorage.removeItem('google-folder-id');
    localStorage.removeItem('google-logged-in');
    localStorage.removeItem('google-token-scopes');
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

        const { deletedTripIds, driveFileIds } = await saveTripsToDrive(googleToken!, googleFolderId!, finalTrips);
        cleanUpDeletedTrips(deletedTripIds);

        // Update local trips with their returned driveFileIds
        let hasUpdates = false;
        const mappedTrips = finalTrips.map(trip => {
          const fileId = driveFileIds[trip.id];
          if (fileId && trip.driveFileId !== fileId) {
            hasUpdates = true;
            return { ...trip, driveFileId: fileId };
          }
          return trip;
        });

        if (hasUpdates) {
          setTrips(mappedTrips);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(mappedTrips));
        }
        
        // Mark all final trips as synced
        const latestLocal = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
        latestLocal.forEach((trip: Trip) => {
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
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
    await performSync();
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
      disabledDayFields: ['baby_logistics'],
      updatedAt: Date.now()
    };

    saveTrips([...trips, newTrip]);
    setActiveTripId(tripId);
  };

  const handleDeleteTrip = (id: string) => {
    const trip = trips.find(t => t.id === id);
    if (trip && (trip.isOwner === false || trip.isShadow === true)) {
      handleLeaveTrip(trip);
      return;
    }

    const updated = trips.filter(t => t.id !== id);
    setTrips(updated);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));

    if (activeTripId === id) {
      setActiveTripId(null);
    }

    // Trigger sync immediately to rename the file on GDrive
    if (googleToken && googleFolderId) {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      performSync(updated);
    }
  };

  const handleUpdateTrip = (updater: Trip | ((prev: Trip) => Trip)) => {
    const targetTripId = typeof updater === 'function' ? activeTripId : updater.id;
    const targetTrip = trips.find(t => t.id === targetTripId);
    
    if (targetTrip && (targetTrip.driveFileId || targetTrip.shadowFileId)) {
      const expiresAtStr = localStorage.getItem('google-token-expires-at');
      const isExpired = !expiresAtStr || Number(expiresAtStr) <= Date.now();
      const isLoggedIn = localStorage.getItem('google-logged-in') === 'true';

      if ((!googleToken || isExpired) && syncStatus !== 'syncing') {
        console.log('User is modifying a cloud-synced trip but is not signed in or token is expired. Triggering sign in flow...');
        setSyncStatus('syncing');
        if (isLoggedIn) {
          isSilentAuthRef.current = true;
          try {
            requestAccessToken('');
          } catch (e) {
            console.error('Silent re-auth failed on write, launching interactive sign-in:', e);
            isSilentAuthRef.current = false;
            handleSignIn();
          }
        } else {
          handleSignIn();
        }
      }
    }

    setTrips(prevTrips => {
      const updated = prevTrips.map(t => {
        if (typeof updater === 'function') {
          if (t.id === activeTripId) {
            const result = updater(t);
            return { ...result, updatedAt: Date.now() };
          }
          return t;
        } else {
          if (t.id === updater.id) {
            return { ...updater, updatedAt: Date.now() };
          }
          return t;
        }
      });

      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));

      if (googleToken && googleFolderId) {
        setSyncStatus('pending');

        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current);
        }

        syncTimeoutRef.current = setTimeout(() => {
          const latestRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
          const latestTrips = latestRaw ? JSON.parse(latestRaw) : updated;
          performSync(latestTrips);
        }, 30000);
      }

      return updated;
    });
  };

  const handleLeaveTrip = async (trip: Trip) => {
    if (!googleToken || !trip.driveFileId || !googleUser) return;
    
    setSyncStatus('syncing');
    try {
      await leaveSharedTripFile(googleToken, trip.driveFileId, googleUser.email);

      // If this is a shadow trip, also delete the shadow file in the user's apps/trip_planner folder
      if (trip.shadowFileId) {
        await deleteFileFromDrive(googleToken, trip.shadowFileId).catch(e => {
          console.error('Failed to delete shadow file while leaving trip:', e);
        });
      }
      
      // Clean up local storage and state for this trip
      const updated = trips.filter(t => t.id !== trip.id);
      setTrips(updated);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      
      // Remove sync timestamp
      if (syncTimestampsRef.current[trip.id] !== undefined) {
        delete syncTimestampsRef.current[trip.id];
        localStorage.setItem('vacation-itineraries-sync-timestamps', JSON.stringify(syncTimestampsRef.current));
      }

      if (activeTripId === trip.id) {
        setActiveTripId(null);
      }
      
      setAppNotification({ 
        title: 'Left Shared Trip', 
        message: `You successfully left the shared trip: "${trip.name}".` 
      });
      setSyncStatus('synced');
    } catch (err: any) {
      console.error('Failed to leave shared trip:', err);
      setSyncStatus('error');
      setAppNotification({
        title: 'Error Leaving Trip',
        message: err.message || 'An error occurred while trying to leave the shared trip. You may need to remove it from your Google Drive web UI.'
      });
    }
  };

  const handleImportSharedTrip = async (urlOrId: string) => {
    const token = googleTokenRef.current;
    const folderId = googleFolderIdRef.current;
    if (!token || !folderId) {
      throw new Error('Please sign in to Google Drive first.');
    }

    const {
      realTrip,
      realFileId,
      shadowFileId,
      isOwner,
      owners,
      capabilities,
      shared
    } = await importSharedTripFile(token, folderId, urlOrId);

    // Annotate the trip for local state
    const annotatedTrip: Trip = {
      ...realTrip,
      driveFileId: realFileId,
      shadowFileId: shadowFileId,
      isShadow: !isOwner,
      ownerEmail: owners[0]?.emailAddress,
      isOwner: isOwner,
      canEdit: isOwner || capabilities.canEdit,
      shared: shared
    };

    // Update local state and localStorage
    const savedLocal = localStorage.getItem(LOCAL_STORAGE_KEY);
    const localTrips: Trip[] = savedLocal ? JSON.parse(savedLocal) : [];
    const updatedTrips = localTrips.filter(t => t.id !== realTrip.id);
    updatedTrips.push(annotatedTrip);

    setTrips(updatedTrips);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedTrips));

    // Update sync timestamps
    syncTimestampsRef.current[realTrip.id] = realTrip.updatedAt || 0;
    localStorage.setItem('vacation-itineraries-sync-timestamps', JSON.stringify(syncTimestampsRef.current));

    setAppNotification({
      title: 'Trip Imported',
      message: `Successfully imported shared trip "${realTrip.name}"`
    });
  };

  const handleAiSettingsSaved = async () => {
    setHasAiKey(GeminiService.hasApiKey());

    // Sync / delete from GDrive if signed in
    if (googleToken && googleFolderId) {
      const isSyncEnabled = GeminiService.getSyncToDrive();
      if (isSyncEnabled) {
        const keys = GeminiService.getApiKeys();
        const model = GeminiService.getSelectedModel();
        try {
          await saveAiSettingsToDrive(googleToken, googleFolderId, { keys, model });
          console.log('AI settings successfully synced to Google Drive.');
        } catch (err) {
          console.error('Failed to sync AI settings to Drive:', err);
        }
      } else {
        try {
          await deleteAiSettingsFromDrive(googleToken, googleFolderId);
          console.log('AI settings successfully deleted from Google Drive.');
        } catch (err) {
          console.error('Failed to delete AI settings from Drive:', err);
        }
      }
    }
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
          <button
            className={`ai-status-badge ${hasAiKey ? 'active' : 'nudge'}`}
            onClick={() => setShowAiSettings(true)}
            title={hasAiKey ? 'AI Settings (Active)' : 'Setup Gemini AI (Keys Missing)'}
            style={{ display: 'flex', border: '1px solid var(--border-glass)' }}
          >
            <Sparkles size={14} className={hasAiKey ? '' : 'pulse'} />
            <span>{hasAiKey ? 'AI Active' : 'Setup AI'}</span>
          </button>

          <GoogleAuthSection
            user={googleUser}
            syncStatus={syncStatus}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
            onManualSync={handleManualSync}
          />
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeTrip ? (
          <TripPlanner 
            trip={activeTrip}
            onBack={() => setActiveTripId(null)}
            onUpdateTrip={handleUpdateTrip}
            onShareTrip={setShareModalTrip}
          />
        ) : (
          <TripDashboard 
            trips={trips}
            onCreateTrip={handleCreateTrip}
            onDeleteTrip={handleDeleteTrip}
            onSelectTrip={setActiveTripId}
            isGoogleSignedIn={googleUser !== null}
            onShareTrip={setShareModalTrip}
            onLeaveTrip={handleLeaveTrip}
            onUpdateTrip={handleUpdateTrip}
            onImportSharedTrip={handleImportSharedTrip}
          />
        )}
      </main>

      <SyncConflictModal
        isOpen={pendingConflicts.length > 0}
        localTrip={pendingConflicts[0]?.localTrip || null}
        cloudTrip={pendingConflicts[0]?.cloudTrip || null}
        conflictIndex={0}
        totalConflicts={pendingConflicts.length}
        onResolve={(choice) => handleResolveConflict(choice)}
      />

      <ConfirmationModal
        isOpen={appNotification !== null}
        title={appNotification?.title || ''}
        message={appNotification?.message || ''}
        isAlert={true}
        confirmText="OK"
        onConfirm={() => setAppNotification(null)}
        onCancel={() => setAppNotification(null)}
      />

      {shareModalTrip && googleToken && (
        <ShareTripModal
          trip={shareModalTrip}
          accessToken={googleToken}
          onClose={() => setShareModalTrip(null)}
        />
      )}

      <AiSettingsModal
        isOpen={showAiSettings}
        onClose={() => setShowAiSettings(false)}
        onSaved={handleAiSettingsSaved}
        isGoogleSignedIn={!!googleToken}
      />

    </div>
  );
}
