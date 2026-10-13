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
import { getDoc, setDoc } from './_firestore-rest.js';
import { editTelegramMessage } from './_telegram.js';

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

    const f = doc.fields || {};
    const current = String(f.status || '');

    // ABRIR LA ALERTA ES TOMAR LA CONVERSACIÓN.
    // Antes este endpoint era de sólo lectura: el asesor entraba desde el link del teléfono, veía la
    // conversación y la alerta seguía marcada "necesita humano" porque el paso de aceptar vivía en el
    // panel. Reclamarla aquí apaga la alerta en el mismo toque, sin un segundo paso.
    let claimed = false;
    if (current === 'human_requested') {
      const by = String(body.by || req.query?.by || '').trim().slice(0, 60) || 'Asesor';
      try {
        await setDoc(
          `conversations/${sessionId}`,
          {
            status: 'human_assigned',
            assignedToName: by,
            claimedAt: new Date().toISOString(),
            claimedFrom: 'alert_link',
          },
          ['status', 'assignedToName', 'claimedAt', 'claimedFrom']
        );
        claimed = true;
      } catch (e) {
        // Reclamar es best-effort: si falla, el asesor debe poder entrar igual y responder.
        console.error('[staff-enter] claim failed:', e?.message || e);
      }
    }

    // Y que el teléfono deje de mostrar un ticket abierto (best effort, sólo si hay alerta registrada).
    if (claimed && f.tgAlertChatId && f.tgAlertMessageId) {
      const stamp = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
      editTelegramMessage(
        String(f.tgAlertChatId),
        String(f.tgAlertMessageId),
        `👀 <b>EN ATENCIÓN</b> — abierto por el equipo\n${stamp}\nSesión: ${sessionId}`
      ).catch(() => { /* nunca bloquea la entrada del asesor */ });
    }

    return res.status(200).json({
      ok: true,
      sessionId,
      status: claimed ? 'human_assigned' : current,
      claimed,
      customerName: f.customerName || '',
      tokenExpiresAt: verdict.tokenExpiresAt,
    });
  } catch (err) {
    console.error('[staff-enter] error:', err?.message || err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
}
