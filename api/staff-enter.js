// POST /api/staff-enter — validates the signed one-tap staff link and returns that ONE session.
//
// Why: the alert link used to point at /?admin=true&session=<id>, which renders the admin LOGIN wall
// on any device that is not already logged in (sessionStorage is per-tab and is not shared with a tab
// opened from Telegram) — the client's "no había forma de entrar al chat". This endpoint lets the
// alert open a single conversation without exposing the admin panel.
//
// POST {token, sessionId} -> {ok:true, sessionId, status, tokenExpiresAt}
// The client then renders the reply view for that session only.

import { verifyStaffToken } from './_staff-token.js';
import { getDoc } from './_firestore-rest.js';

const SID_RE = /^[\w-]{1,120}$/;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  const body = req.body || {};
  const sessionId = String(body.sessionId || req.query?.session || '').trim();
  const token = String(body.token || req.query?.token || '').trim();

  if (!SID_RE.test(sessionId)) return res.status(400).json({ ok: false, error: 'invalid_session' });

  const verdict = verifyStaffToken(sessionId, token);
  if (!verdict.ok) return res.status(401).json({ ok: false, error: 'invalid_or_expired_token', reason: verdict.reason });

  try {
    const doc = await getDoc(`conversations/${sessionId}`);
    if (!doc) return res.status(404).json({ ok: false, error: 'session_not_found' });
    return res.status(200).json({
      ok: true,
      sessionId,
      status: String(doc.fields?.status || ''),
      customerName: doc.fields?.customerName || '',
      tokenExpiresAt: verdict.tokenExpiresAt,
    });
  } catch (err) {
    console.error('[staff-enter] error:', err?.message || err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
}
