// api/_alert.js — shared alert/abandon helpers for the serverless routes.
//
// Why: both the tab-close beacon (/api/session-exit) and the */5 fallback sweep must fire the SAME
// "cliente abandonó" alert, with the SAME one-per-session guard. Reuse the audited escalation stack
// (Telegram + email + phone rail + `escalations` audit doc) instead of a second delivery path.

import notifyEscalation from './notify-escalation.js';

/** Test/diagnostic session ids (same family the analytics core excludes from reports). */
export const TEST_SESSION_RE = /^(diag|lat-test|verify|warm-check|secret-verify|post-fix|analytics-verify|sweep|abandon-test|staff-test|rules-probe)/;

/** Statuses an abandon alert must never touch: a human is involved or the chat is closed. */
export const PROTECTED_STATUS = /^(human_requested|human_assigned|completed|resolved)$/;

/**
 * Call the escalation handler in-process (mock req/res) so an abandon alert reuses every rail,
 * the audit doc and the session counters without a network hop or a copy of the delivery code.
 */
export async function callNotifyEscalation(body) {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(j) { this.body = j; return this; },
    end() { return this; },
  };
  const req = { method: 'POST', headers: {}, body, query: {} };
  try {
    await notifyEscalation(req, res);
  } catch (err) {
    console.error('[alert] notify-escalation threw:', err?.message || err);
    return { statusCode: 500, body: { error: String(err?.message || err) } };
  }
  return { statusCode: res.statusCode, body: res.body };
}

/**
 * Fire the ONE "cliente abandonó" alert for a session, if it deserves one.
 * deserving = the customer actually wrote (userMessageCount >= 1), no human is on it, not already alerted.
 * `session` = { id, fields } as returned by _firestore-rest getDoc.
 */
export async function alertAbandon(session, { stage, brand, origin } = {}) {
  const f = session?.fields || {};
  const sessionId = session?.id;
  if (!sessionId) return { sent: false, why: 'no_session' };
  if (TEST_SESSION_RE.test(sessionId)) return { sent: false, why: 'test_session' };

  const status = String(f.status || '');
  if (PROTECTED_STATUS.test(status)) return { sent: false, why: 'protected_status' };
  if (f.abandonAlertedAt) return { sent: false, why: 'already_alerted' };

  const userMessages = Number(f.analytics?.userMessageCount || 0);
  if (userMessages < 1) return { sent: false, why: 'no_customer_message' };

  const step = stage || f.funnelStep || '';
  const hasContact = Boolean(String(f.customerPhone || '').trim());
  const payload = {
    type: 'abandon',
    priority: 'medium',
    customerName: f.customerName || '',
    customerPhone: f.customerPhone || '',
    customerEmail: f.customerEmail || '',
    message: `El cliente abandonó la conversación${step ? ` en la etapa "${step}"` : ''}. Último mensaje: ${String(f.lastMessage || '').slice(0, 200) || 'N/A'}`,
    brand: brand || f.brandId || 'unitec',
    sessionId,
    product: `Abandonó en la etapa: ${step || 'sin etapa'} · mensajes del cliente: ${userMessages}`,
    waitingSince: f.firstUserMessageAt || '',
    pageUrl: f.pageUrl || '',
    // Sin contacto capturado no se alborota a los 8 teléfonos: Telegram + correo bastan.
    ...(hasContact ? {} : { phones: [] }),
  };

  const r = await callNotifyEscalation(payload);
  return { sent: r.statusCode === 200, status: r.statusCode, why: r.statusCode === 200 ? 'sent' : 'delivery_failed' };
}
