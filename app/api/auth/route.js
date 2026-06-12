import { NextResponse } from 'next/server';
import { isAuthed } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  return NextResponse.json({ authed: isAuthed(request) });
}
