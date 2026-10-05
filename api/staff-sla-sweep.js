// api/staff-sla-sweep.js — "si el asesor no llega, el sistema insiste solo".
//
// The complaint this closes: a customer asks for a human (or a quote), the alert fires ONCE, and if
// no advisor shows up the chat just sits there — no second alert, no email/Telegram re-escalation,
// no word to the customer, no record. Verified live: 52 of 97 real conversations ended on the
// customer's turn with nobody replying, and `analytics.escalationCount` was 0 in all 4,523 sessions.
//
// Ladder (per session, each stage fires at most once):
//   T+2 min  → re-alert to the staff channels (Telegram + email + WhatsApp/SMS) with the digest
//   T+5 min  → second re-alert + a visible "sigo pendiente, tu asesor está en camino" in the chat
//   T+10 min → final notice to the customer with an explicit WhatsApp/phone + `staffNoShow: true`
// Takeover that goes quiet (human_assigned, no activity for 10 min) gets one nudge to staff.
//
// Safety rails: never touches test ids, never reopens sessions older than 6 h, one action per stage,
// `?dryRun=true` prints the plan without sending or writing anything.
//
// Protected by CRON_SECRET when that env var exists (Vercel cron sends `Authorization: Bearer …`).

import { getFirestoreToken, listAllSessions } from './_analytics-core.js';
import { getDoc, setDoc, addDoc, bumpCounter } from './_firestore-rest.js';

const WA_LINK = 'https://wa.me/573142332147';
const WA_PHONE = '+57 314 233 2147';
const STAGE_1_MIN = 2;
const STAGE_2_MIN = 5;
const STAGE_3_MIN = 10;
const TAKEOVER_NUDGE_MIN = 10;
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

// Same signature the rest of the analytics code uses for its own probe sessions.
const TEST_ID_RE = /^(diag|lat-test|analytics-verify|post-fix-check|warm-check|secret-verify|verify|final_|n2_|nancy_|test|sla-test|v\d|v[a-z]{4,}\s)/i;

const minutesSince = (iso, now) => {
  const t = Date.parse(iso || '');
  return Number.isNaN(t) ? null : (now - t) / 60000;
};

async function sendSlaAlert(req, session, stage, waitedMin) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const url = `${proto}://${host}/api/notify-escalation`;
  const body = {
    type: 'sla',
    priority: stage >= 3 ? 'urgent' : 'high',
    customerName: session.customerName || 'Cliente',
    customerPhone: session.customerPhone || '',
    customerEmail: session.customerEmail || '',
    message: session.lastMessage || 'El cliente sigue esperando respuesta de un asesor.',
    brand: session.brandId || 'unitec',
    sessionId: session.id,
    waitingSince: session.waitingSince,
    slaStage: stage,
    pageUrl: session.parentHost || '',
    dashboardUrl: `${proto}://${host}/?admin=true&session=${encodeURIComponent(session.id)}`,
    transcript: [
      { role: 'user', text: `Esperando asesor desde hace ${Math.round(waitedMin)} min (etapa SLA ${stage}).` },
      { role: 'model', text: session.lastMessage || '' },
    ],
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, status: 0, error: String(err?.message || err) };
  }
}

/** Write a customer-visible line into the transcript (the widget renders message docs live). */
async function writeCustomerNotice(sessionId, text, flag) {
  try {
    const id = await addDoc(`conversations/${sessionId}/messages`, {
      role: 'model',
      text,
      timestamp: new Date().toISOString(),
      ...flag,
    });
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET || process.env.SWEEP_KEY || '';
  if (secret) {
    const header = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const provided = header || String(req.query?.key || '');
    if (provided !== secret) return res.status(401).json({ error: 'unauthorized' });
  }

  const dryRun = String(req.query?.dryRun || '') === 'true';
  const now = Date.now();

  try {
    const token = await getFirestoreToken();
    const sessions = await listAllSessions(token);

    const plan = [];
    const done = [];

    for (const s of sessions) {
      if (!s?.id || TEST_ID_RE.test(s.id)) continue;
      const status = s.status || '';
      if (status !== 'human_requested' && status !== 'human_assigned') continue;

      const lastUpdatedMs = Date.parse(s.lastUpdated || '') || 0;
      if (!lastUpdatedMs || now - lastUpdatedMs > MAX_AGE_MS) continue;

      // Extra fields (slaStage, lastEscalationAt) live outside the parser's whitelist → read the doc.
      let doc = null;
      try {
        doc = await getDoc(`conversations/${s.id}`);
      } catch (err) {
        plan.push({ session: s.id, action: 'skip', reason: `read failed: ${err?.message || err}` });
        continue;
      }
      const fields = doc?.fields || {};
      const analytics = fields.analytics || {};
      const stage = Number(fields.slaStage || 0);
      const waitingSince = fields.lastEscalationAt || fields.firstUserMessageAt || s.lastUpdated;
      const waitedMin = minutesSince(waitingSince, now) ?? 0;

      const entry = {
        session: s.id,
        status,
        phone: fields.customerPhone || s.customerPhone || '',
        stage,
        waitedMin: Math.round(waitedMin),
        actions: [],
      };

      if (waitedMin >= STAGE_3_MIN && stage < 3) {
        entry.actions.push('alert:3');
        entry.actions.push('notice:final');
        entry.actions.push('flag:staffNoShow');
        if (!dryRun) {
          const alert = await sendSlaAlert(req, { ...s, ...fields, id: s.id, waitingSince }, 3, waitedMin);
          const notice = await writeCustomerNotice(
            s.id,
            `Sigo pendiente de un asesor para tu caso. Si necesitas atención inmediata ahora, escríbenos por WhatsApp ${WA_PHONE} (${WA_LINK}) y te atendemos sin esperar.`,
            { slaNotice: 3 }
          );
          await setDoc(`conversations/${s.id}`, {
            slaStage: 3,
            lastSlaAt: new Date().toISOString(),
            staffNoShow: true,
          }, ['slaStage', 'lastSlaAt', 'staffNoShow']);
          await bumpCounter(`conversations/${s.id}`, 'analytics.slaBreaches');
          done.push({ ...entry, alert, notice });
        }
      } else if (waitedMin >= STAGE_2_MIN && stage < 2) {
        entry.actions.push('alert:2');
        entry.actions.push('notice:waiting');
        if (!dryRun) {
          const alert = await sendSlaAlert(req, { ...s, ...fields, id: s.id, waitingSince }, 2, waitedMin);
          const notice = await writeCustomerNotice(
            s.id,
            'Sigo aquí con tu conversación y tu solicitud sigue con prioridad: un asesor del equipo está en camino y te escribe por aquí. Si prefieres no esperar, WhatsApp: ' + WA_LINK,
            { slaNotice: 2 }
          );
          await setDoc(`conversations/${s.id}`, { slaStage: 2, lastSlaAt: new Date().toISOString() }, ['slaStage', 'lastSlaAt']);
          done.push({ ...entry, alert, notice });
        }
      } else if (waitedMin >= STAGE_1_MIN && stage < 1 && status === 'human_requested') {
        entry.actions.push('alert:1');
        if (!dryRun) {
          const alert = await sendSlaAlert(req, { ...s, ...fields, id: s.id, waitingSince }, 1, waitedMin);
          await setDoc(`conversations/${s.id}`, { slaStage: 1, lastSlaAt: new Date().toISOString() }, ['slaStage', 'lastSlaAt']);
          done.push({ ...entry, alert });
        }
      } else if (
        status === 'human_assigned' &&
        stage >= 0 &&
        (minutesSince(s.lastUpdated, now) ?? 0) >= TAKEOVER_NUDGE_MIN &&
        !fields.staffNudgedAt
      ) {
        // Staff took the chat and went quiet for 10 min: one nudge, then never again.
        entry.actions.push('nudge:staff');
        if (!dryRun) {
          const alert = await sendSlaAlert(req, { ...s, ...fields, id: s.id, waitingSince }, 2, waitedMin);
          await setDoc(`conversations/${s.id}`, { staffNudgedAt: new Date().toISOString() }, ['staffNudgedAt']);
          await bumpCounter(`conversations/${s.id}`, 'analytics.staffNudges');
          done.push({ ...entry, alert });
        }
      } else {
        continue;
      }
      plan.push(entry);
    }

    return res.status(200).json({
      ok: true,
      dryRun,
      scanned: sessions.length,
      candidates: plan.length,
      acted: done.length,
      plan,
      done,
      ranAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[staff-sla-sweep] failed:', err?.message || err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
