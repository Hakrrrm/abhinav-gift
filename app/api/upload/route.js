import { handleUpload } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { isAuthed } from '@/lib/auth';

// Issues short-lived tokens so the browser can upload files directly to
// Vercel Blob (bypasses the 4.5MB serverless request body limit).
export async function POST(request) {
  if (!isAuthed(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['image/*', 'video/*'],
        addRandomSuffix: true,
        maximumSizeInBytes: 1024 * 1024 * 1024, // 1GB per file
      }),
      onUploadCompleted: async () => {
        // Playlist registration happens via POST /api/media from the admin
        // page after the upload resolves (works in local dev too, where this
        // webhook never fires).
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
