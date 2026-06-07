import type { Trip } from '../types';

// Declare global google variable
declare global {
  interface Window {
    google?: any;
  }
}

// Default Client ID configured for localhost:5173 and localhost:5174
export const DEFAULT_CLIENT_ID = '370189493068-6pnu5gv03ctdn87u2mnkbb0jpaakk47r.apps.googleusercontent.com';

let tokenClient: any = null;

/**
 * Dynamically loads the Google Identity Services SDK script.
 */
export function loadGsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
}

/**
 * Initializes the OAuth 2.0 token client.
 */
export function initTokenClient(
  clientId: string,
  onTokenReceived: (token: string, expiresIn: number) => void,
  onError?: (error: any) => void
) {
  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services SDK not loaded');
  }

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'https://www.googleapis.com/auth/drive.file email profile openid',
    callback: (response: any) => {
      if (response.error) {
        if (onError) onError(response);
      } else if (response.access_token) {
        onTokenReceived(response.access_token, response.expires_in || 3600);
      }
    },
  });
}

/**
 * Requests an access token from Google (shows consent/login popup if needed).
 */
export function requestAccessToken() {
  if (!tokenClient) {
    throw new Error('Token client not initialized');
  }
  tokenClient.requestAccessToken({ prompt: 'consent' });
}

/**
 * Fetches basic Google user profile info.
 */
export async function fetchGoogleUserInfo(accessToken: string): Promise<{ name: string; email: string; picture: string }> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch user info');
  }
  return response.json();
}

/**
 * Helper to find a folder by name in a given parent (or root).
 */
async function findFolder(accessToken: string, name: string, parentId?: string): Promise<string | null> {
  let query = `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  } else {
    query += ` and 'root' in parents`;
  }
  
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to search folder: ${name}`);
  }
  const data = await response.json();
  return data.files && data.files.length > 0 ? data.files[0].id : null;
}

/**
 * Helper to create a folder.
 */
async function createFolder(accessToken: string, name: string, parentId?: string): Promise<string> {
  const body: any = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) {
    body.parents = [parentId];
  } else {
    body.parents = ['root'];
  }

  const response = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to create folder: ${name}`);
  }
  const data = await response.json();
  return data.id;
}

/**
 * Ensures that the folder chain apps/trip_planner/ exists and returns the ID of the trip_planner folder.
 */
export async function getOrCreateTripPlannerFolder(accessToken: string): Promise<string> {
  let appsId = await findFolder(accessToken, 'apps');
  if (!appsId) {
    appsId = await createFolder(accessToken, 'apps');
  }
  
  let tripPlannerId = await findFolder(accessToken, 'trip_planner', appsId);
  if (!tripPlannerId) {
    tripPlannerId = await createFolder(accessToken, 'trip_planner', appsId);
  }
  
  return tripPlannerId;
}

/**
 * Searches for trips.json inside a folder.
 */
async function findTripsFile(accessToken: string, folderId: string): Promise<string | null> {
  const query = `name = 'trips.json' and '${folderId}' in parents and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to find trips file');
  }
  const data = await response.json();
  return data.files && data.files.length > 0 ? data.files[0].id : null;
}

/**
 * Fetches the trips.json contents from Google Drive.
 */
export async function fetchTripsFromDrive(accessToken: string, folderId: string): Promise<Trip[] | null> {
  const fileId = await findTripsFile(accessToken, folderId);
  if (!fileId) {
    return null;
  }
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to download trips file');
  }
  return response.json();
}

/**
 * Saves/updates the trips.json file in the specified folder.
 */
export async function saveTripsToDrive(accessToken: string, folderId: string, trips: Trip[]): Promise<string> {
  let fileId = await findTripsFile(accessToken, folderId);
  const contentString = JSON.stringify(trips, null, 2);
  
  if (fileId) {
    const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: contentString,
    });
    if (!response.ok) {
      throw new Error('Failed to update trips file on Google Drive');
    }
    return fileId;
  } else {
    // Two-step file creation
    const createUrl = 'https://www.googleapis.com/drive/v3/files';
    const createResponse = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'trips.json',
        parents: [folderId],
      }),
    });
    if (!createResponse.ok) {
      throw new Error('Failed to create trips file metadata on Google Drive');
    }
    const createData = await createResponse.json();
    const newFileId = createData.id;

    const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${newFileId}?uploadType=media`;
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: contentString,
    });
    if (!uploadResponse.ok) {
      throw new Error('Failed to upload trips content to Google Drive');
    }
    return newFileId;
  }
}

/**
 * Merges two arrays of trips. If a trip exists in both arrays (same ID),
 * the version from the cloud is preferred.
 */
export function mergeTrips(localTrips: Trip[], cloudTrips: Trip[]): Trip[] {
  const mergedMap = new Map<string, Trip>();

  localTrips.forEach(trip => {
    mergedMap.set(trip.id, trip);
  });

  cloudTrips.forEach(trip => {
    mergedMap.set(trip.id, trip);
  });

  return Array.from(mergedMap.values());
}
