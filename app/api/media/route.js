import { del } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { isAuthed } from '@/lib/auth';
import { readPlaylist, writePlaylist, hasBlobStore } from '@/lib/playlist';

export const dynamic = 'force-dynamic';

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
  if (!body?.url && !body?.pathname && !body?.id) {
    return NextResponse.json({ error: 'Missing media identifier.' }, { status: 400 });
  }

  const playlist = await readPlaylist();
  const item = playlist.items.find(
    (entry) =>
      entry.url === body.url ||
      entry.pathname === body.pathname ||
      entry.id === body.id
  );

  if (!item) {
    return NextResponse.json(playlist);
  }

  const nextPlaylist = {
    ...playlist,
    items: playlist.items.filter((entry) => entry !== item),
  };

  await writePlaylist(nextPlaylist);

  try {
    await del(item.pathname || item.url);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      ...nextPlaylist,
      warning: `Removed from playlist, but deleting the file from Blob failed: ${message}`,
    });
  }

  return NextResponse.json(nextPlaylist);
}
