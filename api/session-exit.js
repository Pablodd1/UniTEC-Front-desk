// POST /api/session-exit — records that the visitor CLOSED the chat (tab / computer / phone).
//
// Why: the only abandonment signal before this was "idle > 15 min" inferred by the */15 sweep, so a
// customer who closed the tab mid-conversation produced no event at all. The widget now beacons here:
//   reason "pagehide" -> the tab is really going away  -> mark exitAt AND alert if the customer wrote
//   reason "hidden"   -> app switched / phone locked   -> only mark hiddenAt (no alert; it may come back)
//   reason "visible"  -> came back                     -> clear hiddenAt
// The */5 fallback sweep catches the cases where no beacon survived (crash, killed browser).
//
// Body: {sessionId, brand?, reason, stage?, dwellMs?}   (sent as text/plain to stay a simple request)

import { setDoc, getDoc } from './_firestore-rest.js';
import { alertAbandon, TEST_SESSION_RE } from './_alert.js';

const SID_RE = /^[\w-]{1,120}$/;

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  const chunks = [];
  try { for await (const c of req) chunks.push(c); } catch { /* ignore */ }
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return JSON.parse(raw); } catch { return {}; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  const body = await readBody(req);
  const sessionId = String(body.sessionId || '').trim();
  const reason = String(body.reason || '').trim();
  const stage = String(body.stage || '').slice(0, 40);
  const brand = String(body.brand || '').slice(0, 40);

  if (!SID_RE.test(sessionId)) return res.status(400).json({ ok: false, error: 'invalid_session' });
  if (TEST_SESSION_RE.test(sessionId)) return res.status(200).json({ ok: true, skipped: 'test_session' });

  const path = `conversations/${sessionId}`;
  const now = new Date().toISOString();

  try {
    const doc = await getDoc(path);
    if (!doc) return res.status(200).json({ ok: false, reason: 'session_missing' });

    if (reason === 'visible') {
      await setDoc(path, { hiddenAt: null, lastStage: stage }, ['hiddenAt', 'lastStage']);
      return res.status(200).json({ ok: true, reason });
    }

    if (reason === 'hidden') {
      await setDoc(path, { hiddenAt: now, lastStage: stage }, ['hiddenAt', 'lastStage']);
      return res.status(200).json({ ok: true, reason });
    }

    // pagehide / unload => the visitor really left. Stamp the exit and decide on the alert.
    await setDoc(
      path,
      { exitAt: now, exitReason: 'pagehide', lastStage: stage, hiddenAt: null },
      ['exitAt', 'exitReason', 'lastStage', 'hiddenAt']
    );
    const alert = await alertAbandon(doc, { stage, brand });
    return res.status(200).json({ ok: true, reason: 'pagehide', alert });
  } catch (err) {
    console.error('[session-exit] error:', err?.message || err);
    // A beacon is fire-and-forget: never make the page retry on our error.
    return res.status(200).json({ ok: false, error: 'server_error' });
  }
}
