import { del } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { isAuthed } from '@/lib/auth';
import { readPlaylist, writePlaylist, hasBlobStore, DEFAULT_SETTINGS } from '@/lib/playlist';

export const dynamic = 'force-dynamic';

function cleanSettings(settings) {
  const imageDurationSeconds = Number(settings?.imageDurationSeconds);
  return {
    imageDurationSeconds:
      Number.isFinite(imageDurationSeconds) && imageDurationSeconds >= 1
        ? Math.round(imageDurationSeconds)
        : DEFAULT_SETTINGS.imageDurationSeconds,
  };
}

function hasIdentifier(body) {
  return Boolean(body?.url || body?.pathname || body?.id);
}

function identifiersMatch(entry, body) {
  const checks = [
    ['url', body.url],
    ['pathname', body.pathname],
    ['id', body.id],
  ].filter(([, value]) => Boolean(value));

  return checks.length > 0 && checks.every(([key, value]) => entry[key] === value);
}

function findItemIndex(items, body) {
  const requestedIndex = Number(body.index);
  if (Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < items.length) {
    const item = items[requestedIndex];
    if (identifiersMatch(item, body)) return requestedIndex;
  }

  return items.findIndex((item) => identifiersMatch(item, body));
}

// Admin: register an uploaded blob as a playlist item (called after a
// client-side upload completes).
export async function POST(request) {
  if (!isAuthed(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.url || !body?.contentType) {
    return NextResponse.json({ error: 'Missing url or contentType.' }, { status: 400 });
  }

  const type = body.contentType.startsWith('video/') ? 'video' : 'image';
  const item = {
    id: body.pathname || body.url,
    url: body.url,
    pathname: body.pathname || '',
    name: body.name || body.pathname || 'media',
    type,
    contentType: body.contentType,
    uploadedAt: new Date().toISOString(),
  };

  const playlist = await readPlaylist();
  playlist.settings = cleanSettings(body.settings || playlist.settings);
  playlist.items.push(item);
  await writePlaylist(playlist);
  return NextResponse.json(playlist);
}

// Admin: delete a media file and remove it from the playlist.
export async function DELETE(request) {
  if (!isAuthed(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasBlobStore()) {
    return NextResponse.json(
      { error: 'No Blob store configured (BLOB_READ_WRITE_TOKEN missing).' },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!hasIdentifier(body)) {
    return NextResponse.json({ error: 'Missing media identifier.' }, { status: 400 });
  }

  const playlist = await readPlaylist();
  const itemIndex = findItemIndex(playlist.items, body);

  if (itemIndex === -1) {
    return NextResponse.json(playlist);
  }

  const item = playlist.items[itemIndex];
  const nextPlaylist = {
    ...playlist,
    settings: cleanSettings(body.settings || playlist.settings),
    items: playlist.items.filter((_, index) => index !== itemIndex),
  };

  await writePlaylist(nextPlaylist);

  try {
    const stillUsed = nextPlaylist.items.some(
      (entry) =>
        (item.pathname && entry.pathname === item.pathname) ||
        (item.url && entry.url === item.url)
    );

    if (!stillUsed) {
      await del(item.pathname || item.url);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      ...nextPlaylist,
      warning: `Removed from playlist, but deleting the file from Blob failed: ${message}`,
    });
  }

  return NextResponse.json(nextPlaylist);
}
