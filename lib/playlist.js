import { list, put } from '@vercel/blob';

const PLAYLIST_PATH = 'playlist.json';

export const DEFAULT_SETTINGS = { imageDurationSeconds: 8 };

export function hasBlobStore() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function readPlaylist() {
  const empty = { items: [], settings: { ...DEFAULT_SETTINGS } };
  if (!hasBlobStore()) return empty;

  const { blobs } = await list({ prefix: PLAYLIST_PATH });
  const blob = blobs.find((b) => b.pathname === PLAYLIST_PATH);
  if (!blob) return empty;

  // Cache-busting query param so the blob CDN never serves a stale playlist.
  const res = await fetch(`${blob.url}?v=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) return empty;

  const data = await res.json().catch(() => null);
  if (!data) return empty;
  return {
    items: Array.isArray(data.items) ? data.items : [],
    settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
  };
}

export async function writePlaylist(playlist) {
  await put(PLAYLIST_PATH, JSON.stringify(playlist, null, 2), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
  });
}
