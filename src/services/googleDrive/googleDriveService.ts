/**
 * Google Drive integration for Media Journal.
 *
 * Uses Google Identity Services (GIS) for OAuth2 with the
 * `drive.file` scope, which limits access to only files this app
 * creates — the app can never read or modify anything else in the
 * user's Drive.
 *
 * The GIS library is loaded via a <script> tag in index.html; all
 * calls here defensively check that `window.google` is available
 * before proceeding.
 */

import { db } from '@/services/database/db';
import { exportLibrary, importLibrary } from '@/services/importExport/importExportService';
import dayjs from 'dayjs';
import type { ImportResult } from '@/services/importExport/importExportService';

// ── Configuration ────────────────────────────────────────────────────────────

const CLIENT_ID =
  '1010764655776-c8komo4unatbatna9kabvncevbo2d1b4.apps.googleusercontent.com';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FOLDER_NAME = 'Media Journal';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

// ── GIS type shim ────────────────────────────────────────────────────────────

function gis() {
  if (!window.google) throw new Error('Google Identity Services not loaded yet. Try again in a moment.');
  return window.google.accounts.oauth2;
}

// ── Token storage ────────────────────────────────────────────────────────────

interface StoredToken {
  accessToken: string;
  expiresAt: number; // ms since epoch
  email?: string;
}

const TOKEN_KEY = 'googleDriveToken';

async function loadStoredToken(): Promise<StoredToken | null> {
  const record = await db.appSettings.get(TOKEN_KEY);
  return (record?.value as StoredToken) ?? null;
}

async function saveToken(token: StoredToken): Promise<void> {
  await db.appSettings.put({ key: TOKEN_KEY, value: token });
}

async function clearToken(): Promise<void> {
  await db.appSettings.delete(TOKEN_KEY);
}

function isTokenFresh(token: StoredToken): boolean {
  // Treat as expired 2 minutes before actual expiry for safety.
  return Date.now() < token.expiresAt - 120_000;
}

// ── Public token helpers ─────────────────────────────────────────────────────

/** True if a stored token exists (may be expired — will auto-refresh on use). */
export async function isDriveConnected(): Promise<boolean> {
  const token = await loadStoredToken();
  return token !== null;
}

/** Returns the email stored with the token, if any. */
export async function getDriveEmail(): Promise<string | null> {
  const token = await loadStoredToken();
  return token?.email ?? null;
}

/**
 * Requests an access token via GIS. Shows the Google consent popup on
 * first use; subsequent calls are typically instant if the user has
 * already granted permission. Must be called from a user gesture.
 */
export async function signInToDrive(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const client = gis().initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: async (response) => {
        if (response.error) {
          reject(new Error(response.error_description ?? response.error));
          return;
        }
        const token: StoredToken = {
          accessToken: response.access_token,
          expiresAt: Date.now() + response.expires_in * 1000,
        };
        await saveToken(token);
        resolve();
      },
    });
    client.requestAccessToken({ prompt: '' });
  });
}

export async function signOutOfDrive(): Promise<void> {
  await clearToken();
}

/**
 * Returns a valid access token, silently refreshing via GIS if the
 * stored one is expired. Throws if the user is not connected.
 */
async function getToken(): Promise<string> {
  const stored = await loadStoredToken();
  if (!stored) throw new Error('Not connected to Google Drive. Please connect first.');

  if (isTokenFresh(stored)) return stored.accessToken;

  // Token expired — request a fresh one silently.
  const refreshed = await new Promise<string>((resolve, reject) => {
    const client = gis().initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: async (response) => {
        if (response.error) {
          reject(new Error(response.error_description ?? response.error));
          return;
        }
        const next: StoredToken = {
          ...stored,
          accessToken: response.access_token,
          expiresAt: Date.now() + response.expires_in * 1000,
        };
        await saveToken(next);
        resolve(response.access_token);
      },
    });
    client.requestAccessToken({ prompt: '' });
  });

  return refreshed;
}

// ── Drive API helpers ────────────────────────────────────────────────────────

async function driveGet(path: string, token: string): Promise<Response> {
  const res = await fetch(`${DRIVE_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive API error ${res.status}: ${await res.text()}`);
  return res;
}

/**
 * Finds the "Media Journal" folder in Drive, creating it if it doesn't
 * exist yet.
 */
async function getOrCreateFolder(token: string): Promise<string> {
  const query = encodeURIComponent(
    `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const listRes = await driveGet(`/files?q=${query}&fields=files(id)`, token);
  const list = await listRes.json() as { files: { id: string }[] };

  if (list.files.length > 0) {
    return list.files[0]!.id;
  }

  // Create the folder.
  const createRes = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  if (!createRes.ok) throw new Error(`Could not create Drive folder: ${await createRes.text()}`);
  const folder = await createRes.json() as { id: string };
  return folder.id;
}

/** Uploads content to Drive using multipart upload. */
async function uploadFile(
  token: string,
  folderId: string,
  name: string,
  content: string,
  existingFileId?: string,
): Promise<string> {
  const boundary = 'mj_boundary_' + Math.random().toString(36).slice(2);
  const metadata = JSON.stringify({
    name,
    mimeType: 'application/json',
    ...(existingFileId ? {} : { parents: [folderId] }),
  });

  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    content,
    `--${boundary}--`,
  ].join('\r\n');

  const url = existingFileId
    ? `${UPLOAD_API}/files/${existingFileId}?uploadType=multipart`
    : `${UPLOAD_API}/files?uploadType=multipart`;

  const res = await fetch(url, {
    method: existingFileId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) throw new Error(`Upload failed: ${await res.text()}`);
  const file = await res.json() as { id: string };
  return file.id;
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface DriveExportFile {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
}

/**
 * Lists previous Media Journal exports in the Drive folder, newest
 * first.
 */
export async function listDriveExports(): Promise<DriveExportFile[]> {
  const token = await getToken();
  const folderId = await getOrCreateFolder(token);
  const query = encodeURIComponent(
    `'${folderId}' in parents and name contains 'media-journal' and mimeType='application/json' and trashed=false`,
  );
  const res = await driveGet(
    `/files?q=${query}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc`,
    token,
  );
  const list = await res.json() as { files: DriveExportFile[] };
  return list.files;
}

/**
 * Exports the full library to Google Drive. If a file with today's
 * date already exists in the folder it is overwritten; otherwise a
 * new file is created.
 *
 * Returns the Drive file name.
 */
export async function exportToGoogleDrive(): Promise<string> {
  const token = await getToken();
  const folderId = await getOrCreateFolder(token);

  const fileName = `media-journal-${dayjs().format('YYYY-MM-DD')}.json`;
  const payload = await exportLibrary();
  const content = JSON.stringify(payload, null, 2);

  // Look for an existing file with today's name to overwrite.
  const existing = await listDriveExports();
  const todayFile = existing.find((f) => f.name === fileName);

  await uploadFile(token, folderId, fileName, content, todayFile?.id);
  return fileName;
}

/**
 * Downloads a Drive export file and passes it to the import service.
 */
export async function importFromDriveFile(fileId: string): Promise<ImportResult> {
  const token = await getToken();
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Could not download file: ${await res.text()}`);
  const raw = await res.json() as unknown;
  return importLibrary(raw);
}
