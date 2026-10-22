// api/_staff-token.js — short-lived HMAC token so a staff alert link can open ONE conversation
// without the admin password (the reason "no había forma de entrar al chat" from the alert).
//
// Underscore prefix => Vercel does not expose it as an endpoint.
// Token = "<expMs>.<base64url hmac_sha256(`${sessionId}.${expMs}`)>", signed with ADMIN_SECRET.
// Bound to the sessionId, so a token cannot be replayed on another conversation.

import { createHmac, timingSafeEqual } from 'crypto';

const DEFAULT_TTL_HOURS = 48;

/** Canonical origin the staff alert links must point at (NOT the widget iframe origin). */
export const STAFF_PANEL_ORIGIN = process.env.STAFF_PANEL_ORIGIN || 'https://www.chatbuildinginnovation.us';

const secret = () => process.env.ADMIN_SECRET || '';

function sign(payload) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

/** Returns '' when it cannot sign (no ADMIN_SECRET / no sessionId) — caller must degrade gracefully. */
export function signStaffToken(sessionId, ttlHours = DEFAULT_TTL_HOURS) {
  if (!secret() || !sessionId) return '';
  const exp = Date.now() + ttlHours * 3600 * 1000;
  return `${exp}.${sign(`${sessionId}.${exp}`)}`;
}

/** Full one-tap URL for the staff alert. '' when signing is unavailable. */
export function staffUrl(sessionId, ttlHours = DEFAULT_TTL_HOURS) {
  const token = signStaffToken(sessionId, ttlHours);
  if (!token) return '';
  return `${STAFF_PANEL_ORIGIN}/?staff=${encodeURIComponent(token)}&session=${encodeURIComponent(sessionId)}`;
}

/** Constant-time verify. `tokenExpiresAt` (ms) is returned so callers can log it. */
export function verifyStaffToken(sessionId, token) {
  if (!secret() || !sessionId || !token) return { ok: false, reason: 'not_configured_or_missing' };
  const raw = String(token);
  const dot = raw.indexOf('.');
  if (dot <= 0) return { ok: false, reason: 'malformed' };
  const exp = Number(raw.slice(0, dot));
  const sig = raw.slice(dot + 1);
  if (!Number.isFinite(exp)) return { ok: false, reason: 'bad_exp' };
  if (Date.now() > exp) return { ok: false, reason: 'expired', tokenExpiresAt: exp };
  const expected = sign(`${sessionId}.${exp}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'bad_signature' };
  return { ok: true, tokenExpiresAt: exp };
}
