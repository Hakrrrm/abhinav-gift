import { createHash } from 'crypto';

export const COOKIE_NAME = 'mp_session';

// Single-admin auth: the session cookie is a hash derived from the admin
// password, so changing the password invalidates existing sessions.
export function sessionToken() {
  const pw = process.env.ADMIN_PASSWORD || '';
  return createHash('sha256').update(`media-player-session:${pw}`).digest('hex');
}

export function isAuthed(request) {
  if (!process.env.ADMIN_PASSWORD) return false;
  const cookie = request.cookies.get(COOKIE_NAME);
  return cookie?.value === sessionToken();
}
