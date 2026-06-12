import { del } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { isAuthed } from '@/lib/auth';
import { readPlaylist, writePlaylist } from '@/lib/playlist';

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

  const body = await request.json().catch(() => null);
  if (!body?.url) {
    return NextResponse.json({ error: 'Missing url.' }, { status: 400 });
  }

  await del(body.url);

  const playlist = await readPlaylist();
  playlist.items = playlist.items.filter((item) => item.url !== body.url);
  await writePlaylist(playlist);
  return NextResponse.json(playlist);
}
