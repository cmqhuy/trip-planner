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
export function requestAccessToken(prompt: string = 'consent') {
  if (!tokenClient) {
    throw new Error('Token client not initialized');
  }
  tokenClient.requestAccessToken({ prompt });
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
 * Fetches all individual trip-*.json files from the Google Drive trip_planner folder.
 */
export interface FetchTripsResult {
  activeTrips: Trip[];
  deletedTripIds: string[];
}

export async function fetchTripsFromDrive(
  accessToken: string,
  folderId: string
): Promise<FetchTripsResult | null> {
  const query = `('${folderId}' in parents or sharedWithMe = true) and mimeType = 'application/json' and name contains 'trip-' and name contains '.json' and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name, owners, capabilities, shared)`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    if (response.status === 404 || response.status === 400 || response.status === 403) {
      throw new Error('FOLDER_NOT_FOUND');
    }
    throw new Error('Failed to list files on Google Drive');
  }
  const data = await response.json();
  const files = data.files || [];
  
  // Extract deleted trip IDs
  const deletedTripIds = files
    .filter((f: any) => f.name.startsWith('[Deleted] trip-') && f.name.endsWith('.json'))
    .map((f: any) => {
      return f.name.replace('[Deleted] trip-', '').replace('.json', '');
    });

  // Filter for active trip-*.json files
  const tripFiles = files.filter((f: any) => f.name.startsWith('trip-') && f.name.endsWith('.json'));
  if (tripFiles.length === 0) {
    return { activeTrips: [], deletedTripIds };
  }

  // Fetch each active file in parallel
  const tripPromises = tripFiles.map(async (file: any) => {
    try {
      const mediaUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
      const res = await fetch(mediaUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!res.ok) {
        console.error(`Failed to download trip file ${file.name} (${file.id})`);
        return null;
      }
      const trip = await res.json() as Trip;
      if (trip && typeof trip === 'object' && typeof trip.id === 'string') {
        // If it's a shadow pointer file, fetch the real trip data instead
        if ((trip as any).isShadow === true && (trip as any).realDriveFileId) {
          const realDriveFileId = (trip as any).realDriveFileId;
          try {
            const realMediaUrl = `https://www.googleapis.com/drive/v3/files/${realDriveFileId}?alt=media`;
            const realRes = await fetch(realMediaUrl, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            });
            if (!realRes.ok) {
              console.warn(`Failed to download real trip file for shadow ${trip.id}. Deleting shadow file...`);
              await deleteFileFromDrive(accessToken, file.id);
              return null;
            }
            const realTrip = await realRes.json() as Trip;
            if (realTrip && typeof realTrip === 'object' && typeof realTrip.id === 'string') {
              // Fetch metadata for the real file to get its permissions, owner, and canEdit flag
              const metaUrl = `https://www.googleapis.com/drive/v3/files/${realDriveFileId}?fields=owners,capabilities,shared`;
              const metaRes = await fetch(metaUrl, {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              });
              let owners: any[] = [];
              let capabilities: any = {};
              let shared = true;
              if (metaRes.ok) {
                const meta = await metaRes.json();
                owners = meta.owners || [];
                capabilities = meta.capabilities || {};
                shared = meta.shared !== undefined ? meta.shared : true;
              }

              realTrip.driveFileId = realDriveFileId;
              realTrip.shadowFileId = file.id;
              realTrip.isShadow = true;
              realTrip.ownerEmail = owners[0]?.emailAddress;
              realTrip.isOwner = owners[0]?.me;
              realTrip.canEdit = capabilities.canEdit;
              realTrip.shared = shared;
              return realTrip;
            }
          } catch (realErr) {
            console.error(`Error processing shadow trip real file ${realDriveFileId}:`, realErr);
            // Attempt to clean up shadow file since we can't access the real one
            await deleteFileFromDrive(accessToken, file.id).catch(() => {});
            return null;
          }
        } else {
          // Normal non-shadow trip file
          trip.driveFileId = file.id;
          trip.ownerEmail = file.owners?.[0]?.emailAddress;
          trip.isOwner = file.owners?.[0]?.me;
          trip.canEdit = file.capabilities?.canEdit;
          trip.shared = file.shared;
        }
      }
      return trip;
    } catch (err) {
      console.error(`Error downloading/parsing trip file ${file.name}:`, err);
      return null;
    }
  });

  const trips = await Promise.all(tripPromises);
  // Filter out any failed downloads or invalid files
  const activeTrips = trips.filter((t): t is Trip => t !== null && typeof t === 'object' && typeof t.id === 'string');
  
  return { activeTrips, deletedTripIds };
}

/**
 * Saves/updates individual trip files on Google Drive, and deletes any orphaned ones.
 */
export interface SaveTripsResult {
  deletedTripIds: string[];
  driveFileIds: Record<string, string>;
}

async function createNewTripFile(
  accessToken: string,
  folderId: string,
  filename: string,
  contentString: string
): Promise<string> {
  const createUrl = 'https://www.googleapis.com/drive/v3/files';
  const createResponse = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: filename,
      parents: [folderId],
    }),
  });
  if (!createResponse.ok) {
    if (createResponse.status === 404 || createResponse.status === 400 || createResponse.status === 403) {
      throw new Error('FOLDER_NOT_FOUND');
    }
    throw new Error(`Failed to create trip file metadata ${filename} on Google Drive`);
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
    if (uploadResponse.status === 404 || uploadResponse.status === 400 || uploadResponse.status === 403) {
      throw new Error('FOLDER_NOT_FOUND');
    }
    throw new Error(`Failed to upload trip content for ${filename} to Google Drive`);
  }
  return newFileId;
}

export async function saveTripsToDrive(
  accessToken: string,
  folderId: string,
  trips: Trip[]
): Promise<SaveTripsResult> {
  // 1. List existing files in the folder (only for owner/owned files delete reconciliations)
  const query = `'${folderId}' in parents and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name)`;
  const listResponse = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!listResponse.ok) {
    if (listResponse.status === 404 || listResponse.status === 400 || listResponse.status === 403) {
      throw new Error('FOLDER_NOT_FOUND');
    }
    throw new Error('Failed to list files on Google Drive during save');
  }
  const listData = await listResponse.json();
  const existingFiles = listData.files || [];

  // Extract deleted trip IDs from existing files
  const deletedTripIds = existingFiles
    .filter((f: any) => f.name.startsWith('[Deleted] trip-') && f.name.endsWith('.json'))
    .map((f: any) => f.name.replace('[Deleted] trip-', '').replace('.json', ''));

  // Filter out any local trips that have been deleted in the cloud
  const activeTripsToSave = trips.filter(t => !deletedTripIds.includes(t.id));

  // Filter for trip-*.json files and map name -> id
  const existingTripFilesMap = new Map<string, string>();
  existingFiles.forEach((f: any) => {
    if (f.name.startsWith('trip-') && f.name.endsWith('.json')) {
      existingTripFilesMap.set(f.name, f.id);
    }
  });

  const driveFileIds: Record<string, string> = {};
  const activeFilenames = new Set<string>();

  // Helper function to create/update a single trip file
  const savePromises = activeTripsToSave.map(async (trip) => {
    const filename = trip.id.startsWith('trip-') ? `${trip.id}.json` : `trip-${trip.id}.json`;
    activeFilenames.add(filename);

    // If the trip is marked as read-only (Viewer), we should skip saving edits to Drive
    if (trip.canEdit === false) {
      if (trip.driveFileId) {
        driveFileIds[trip.id] = trip.driveFileId;
      }
      return;
    }

    // Strip user/connection-specific metadata before saving to Google Drive
    const cleanTrip = { ...trip };
    delete cleanTrip.driveFileId;
    delete cleanTrip.shadowFileId;
    delete cleanTrip.isShadow;
    delete cleanTrip.isOwner;
    delete cleanTrip.ownerEmail;
    delete cleanTrip.canEdit;
    delete cleanTrip.shared;
    const contentString = JSON.stringify(cleanTrip, null, 2);

    // If we have a file ID, update it directly (works for editors on shared files too)
    if (trip.driveFileId) {
      const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${trip.driveFileId}?uploadType=media`;
      const response = await fetch(uploadUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: contentString,
      });

      if (response.ok) {
        driveFileIds[trip.id] = trip.driveFileId;
      } else if (response.status === 404 && trip.isOwner !== false) {
        // If file ID not found (deleted from Drive) and we are the owner, recreate it
        const newId = await createNewTripFile(accessToken, folderId, filename, contentString);
        driveFileIds[trip.id] = newId;
      } else if (response.status === 404 || response.status === 400 || response.status === 403) {
        throw new Error('FOLDER_NOT_FOUND');
      } else {
        throw new Error(`Failed to update trip file ${filename} (${trip.driveFileId}) on Google Drive`);
      }
    } else {
      // No file ID: check if it already exists in parent folder by filename
      const existingFileId = existingTripFilesMap.get(filename);
      if (existingFileId) {
        const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`;
        const response = await fetch(uploadUrl, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: contentString,
        });
        if (response.ok) {
          driveFileIds[trip.id] = existingFileId;
        } else if (response.status === 404 || response.status === 400 || response.status === 403) {
          throw new Error('FOLDER_NOT_FOUND');
        } else {
          throw new Error(`Failed to update trip file ${filename} on Google Drive`);
        }
      } else {
        // Recreate completely new file
        const newId = await createNewTripFile(accessToken, folderId, filename, contentString);
        driveFileIds[trip.id] = newId;
      }
    }
  });

  // 3. Find files to delete (those in existingTripFilesMap but not in activeFilenames)
  const deletePromises: Promise<void>[] = [];
  existingTripFilesMap.forEach((fileId, filename) => {
    if (!activeFilenames.has(filename)) {
      const renameUrl = `https://www.googleapis.com/drive/v3/files/${fileId}`;
      deletePromises.push(
        fetch(renameUrl, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: `[Deleted] ${filename}`
          })
        }).then(async (response) => {
          if (!response.ok) {
            console.error(`Failed to mark trip file ${filename} as deleted (${fileId})`);
          }
        })
      );
    }
  });

  // Wait for all saves and deletions to finish
  await Promise.all([...savePromises, ...deletePromises]);
  return { deletedTripIds, driveFileIds };
}

/**
 * Lightweight helper to fetch only the list of deleted trip IDs from Google Drive.
 * This runs exactly 1 metadata listing API call instead of downloading files.
 */
export async function fetchDeletedTripIdsFromDrive(
  accessToken: string,
  folderId: string
): Promise<string[]> {
  const query = `'${folderId}' in parents and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(name)`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    if (response.status === 404 || response.status === 400 || response.status === 403) {
      throw new Error('FOLDER_NOT_FOUND');
    }
    throw new Error('Failed to list files on Google Drive for deletions check');
  }
  const data = await response.json();
  const files = data.files || [];
  
  return files
    .filter((f: any) => f.name.startsWith('[Deleted] trip-') && f.name.endsWith('.json'))
    .map((f: any) => f.name.replace('[Deleted] trip-', '').replace('.json', ''));
}

/**
 * Fetches a single trip file by name from Google Drive.
 */
export async function fetchSingleTripFromDrive(
  accessToken: string,
  folderId: string,
  tripId: string
): Promise<Trip | null> {
  const filename = tripId.startsWith('trip-') ? `${tripId}.json` : `trip-${tripId}.json`;
  const query = `name = '${filename}' and '${folderId}' in parents and trashed = false`;
  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`;
  
  const listRes = await fetch(listUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!listRes.ok) {
    if (listRes.status === 404 || listRes.status === 400 || listRes.status === 403) {
      throw new Error('FOLDER_NOT_FOUND');
    }
    throw new Error(`Failed to find trip file ${filename} on Google Drive`);
  }
  const listData = await listRes.json();
  const files = listData.files || [];
  if (files.length === 0) {
    return null;
  }
  const fileId = files[0].id;

  const mediaUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const contentRes = await fetch(mediaUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!contentRes.ok) {
    if (contentRes.status === 404 || contentRes.status === 400 || contentRes.status === 403) {
      throw new Error('FOLDER_NOT_FOUND');
    }
    throw new Error(`Failed to download trip content for ${filename}`);
  }
  return contentRes.json();
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
    const local = mergedMap.get(trip.id);
    if (!local) {
      mergedMap.set(trip.id, trip);
    } else {
      const localTime = local.updatedAt || 0;
      const cloudTime = trip.updatedAt || 0;
      if (cloudTime >= localTime) {
        mergedMap.set(trip.id, trip);
      }
    }
  });

  return Array.from(mergedMap.values());
}

/**
 * Checks if a trip file marked with [Deleted] prefix exists on Google Drive.
 */
export async function checkIfTripDeletedOnDrive(
  accessToken: string,
  folderId: string,
  tripId: string
): Promise<boolean> {
  const filename = tripId.startsWith('trip-') ? `[Deleted] ${tripId}.json` : `[Deleted] trip-${tripId}.json`;
  const query = `name = '${filename}' and '${folderId}' in parents and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`;
  
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!res.ok) return false;
    const data = await res.json();
    return (data.files || []).length > 0;
  } catch {
    return false;
  }
}

/**
 * Share a Google Drive trip file with a collaborator.
 */
export async function shareTripFile(
  accessToken: string,
  fileId: string,
  emailAddress: string,
  role: 'reader' | 'writer'
): Promise<any> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      role,
      type: 'user',
      emailAddress,
    }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to share file');
  }
  return response.json();
}

/**
 * List all sharing permissions for a Google Drive trip file.
 */
export async function listTripFilePermissions(accessToken: string, fileId: string): Promise<any[]> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?fields=permissions(id,emailAddress,role,displayName)`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to list permissions');
  }
  const data = await response.json();
  return data.permissions || [];
}

/**
 * Remove a sharing permission for a Google Drive trip file.
 */
export async function removeTripFilePermission(accessToken: string, fileId: string, permissionId: string): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}/permissions/${permissionId}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to remove permission');
  }
}

/**
 * Update a sharing permission (role) for a Google Drive trip file.
 */
export async function updateTripFilePermission(
  accessToken: string,
  fileId: string,
  permissionId: string,
  role: 'reader' | 'writer'
): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}/permissions/${permissionId}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role }),
  });
  if (!response.ok) {
    throw new Error('Failed to update permission');
  }
}

/**
 * Removes the logged-in user from a shared file (allows a collaborator to leave a trip).
 */
export async function leaveSharedTripFile(accessToken: string, fileId: string, currentUserEmail: string): Promise<void> {
  let permissions: any[] = [];
  try {
    permissions = await listTripFilePermissions(accessToken, fileId);
  } catch (e) {
    console.error('Failed to list permissions for leaving file:', e);
    throw new Error('Cannot identify your permission ID to leave this trip. You may need to remove it from your Google Drive web UI.');
  }

  const cleanEmail = currentUserEmail.trim().toLowerCase();
  const myPermission = permissions.find(p => p.emailAddress && p.emailAddress.trim().toLowerCase() === cleanEmail);
  if (!myPermission) {
    throw new Error('Your email address was not found in the trip permissions list.');
  }

  await removeTripFilePermission(accessToken, fileId, myPermission.id);
}

/**
 * Delete a file from Google Drive.
 */
export async function deleteFileFromDrive(accessToken: string, fileId: string): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete file ${fileId} from Google Drive`);
  }
}

/**
 * Extracts the Google Drive file ID from a URL or raw ID string.
 */
export function extractFileIdFromUrl(urlOrId: string): string {
  const trimmed = urlOrId.trim();
  // Regex for /file/d/FILE_ID
  const dRegex = /\/file\/d\/([a-zA-Z0-9-_]+)/;
  const matchD = trimmed.match(dRegex);
  if (matchD) return matchD[1];

  // Regex for id=FILE_ID
  const idParamRegex = /[?&]id=([a-zA-Z0-9-_]+)/;
  const matchParam = trimmed.match(idParamRegex);
  if (matchParam) return matchParam[1];

  // Otherwise assume it's the raw ID if it doesn't contain slashes or dots
  if (!trimmed.includes('/') && !trimmed.includes('.')) {
    return trimmed;
  }
  return '';
}
