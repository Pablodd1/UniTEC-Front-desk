// POST /api/session-resolve — the advisor CLOSES a conversation. Terminal `resolved`, alert cleared.
//
// What was wrong: "resolved" existed only as client-side dead code — clearIntervention() in
// conversationService.ts has no caller anywhere in the UI — and even if it were called it never
// touched the SESSION. So a conversation stayed `human_assigned` forever: the badge stayed in the
// panel, the SLA sweep kept it in scope, and the alert stayed open on the phone.
//
// This is the single server-side close, so it also works from the one-tap alert link on a phone that
// has no admin session:
//   1. session -> status 'resolved' + resolvedAt / resolvedBy / resolution   (leaves the alert queue)
//   2. a transcript line so the customer sees a person closed it
//   3. the ORIGINAL Telegram alert is edited into a resolved state (the phone stops showing a ticket)
//
// Idempotent: closing an already-terminal session returns ok without rewriting it.
// POST {token, sessionId, staffName?, resolution?} -> {ok, status, notice, telegram}
import { verifyStaffToken } from './_staff-token.js';
import { getDoc, setDoc, addDoc } from './_firestore-rest.js';
import { editTelegramMessage } from './_telegram.js';

const SID_RE = /^[\w-]{1,120}$/;
const TERMINAL = new Set(['resolved', 'completed', 'abandoned', 'abandoned_at_greeting']);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  const body = req.body || {};
  const sessionId = String(body.sessionId || req.query?.session || '').trim();
  const token = String(body.token || req.query?.token || '').trim();
  const staffName = String(body.staffName || '').trim().slice(0, 60) || 'Asesor';
  const resolution = String(body.resolution || '').trim().slice(0, 300);

  if (!SID_RE.test(sessionId)) return res.status(400).json({ ok: false, error: 'invalid_session' });

  const verdict = verifyStaffToken(sessionId, token);
  if (!verdict.ok) return res.status(401).json({ ok: false, error: 'invalid_or_expired_token', reason: verdict.reason });

  try {
    const doc = await getDoc(`conversations/${sessionId}`);
    if (!doc) return res.status(404).json({ ok: false, error: 'session_not_found' });

    const f = doc.fields || {};
    const current = String(f.status || '');
    if (TERMINAL.has(current)) {
      return res.status(200).json({ ok: true, alreadyResolved: true, status: current });
    }

    const now = new Date().toISOString();
    await setDoc(
      `conversations/${sessionId}`,
      {
        status: 'resolved',
        resolvedAt: now,
        resolvedBy: staffName,
        resolution: resolution || 'Resuelta por el asesor',
        resolvedFrom: 'staff_view',
      },
      ['status', 'resolvedAt', 'resolvedBy', 'resolution', 'resolvedFrom']
    );

    // The customer is told, in the transcript, that a person closed the conversation.
    let notice = false;
    try {
      await addDoc(`conversations/${sessionId}/messages`, {
        role: 'model',
        text: `Conversación cerrada por ${staffName}. Si necesitas algo más, escríbenos y seguimos con gusto.`,
        timestamp: now,
        resolvedByStaff: true,
      });
      notice = true;
    } catch (e) {
      console.error('[session-resolve] notice failed:', e?.message || e);
    }

    // Close the loop on the phone: edit the alert that was sent for THIS session.
    let telegram = { ok: false, error: 'no_alert_on_record' };
    if (f.tgAlertChatId && f.tgAlertMessageId) {
      const stamp = new Date(now).toLocaleString('es-CO', { timeZone: 'America/Bogota' });
      telegram = await editTelegramMessage(
        String(f.tgAlertChatId),
        String(f.tgAlertMessageId),
        `✅ <b>RESUELTO</b> — ${staffName}\n${stamp}\nSesión: ${sessionId}`
      );
    }

    return res.status(200).json({ ok: true, status: 'resolved', resolvedBy: staffName, notice, telegram });
  } catch (err) {
    console.error('[session-resolve] error:', err?.message || err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
}
