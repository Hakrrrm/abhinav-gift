import { NextResponse } from 'next/server';
import { isAuthed } from '@/lib/auth';
import { readPlaylist, writePlaylist, hasBlobStore, DEFAULT_SETTINGS } from '@/lib/playlist';

export const dynamic = 'force-dynamic';

// Public: the TV player polls this.
export async function GET() {
  try {
    const playlist = await readPlaylist();
    return NextResponse.json(playlist, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Admin: save full playlist (order + settings).
export async function PUT(request) {
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
  if (!body || !Array.isArray(body.items)) {
    return NextResponse.json({ error: 'Invalid playlist.' }, { status: 400 });
  }

  const imageDurationSeconds = Number(body.settings?.imageDurationSeconds);
  const playlist = {
    items: body.items,
    settings: {
      imageDurationSeconds:
        Number.isFinite(imageDurationSeconds) && imageDurationSeconds >= 1
          ? Math.round(imageDurationSeconds)
          : DEFAULT_SETTINGS.imageDurationSeconds,
    },
  };

  await writePlaylist(playlist);
  return NextResponse.json(playlist);
}
