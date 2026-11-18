import { skipForeignCron } from './_cron-guard.js';
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
// Safety rails: never touches test ids, sessions older than 6 h (except `human_requested`, which
// must always reach closure — see review 2026-11-02), one action per stage,
// `?dryRun=true` prints the plan without sending or writing anything.
//
// Protected by CRON_SECRET when that env var exists (Vercel cron sends `Authorization: Bearer …`).

import { getFirestoreToken, listAllSessions } from './_analytics-core.js';
import { getDoc, setDoc, addDoc, bumpCounter } from './_firestore-rest.js';
// Aviso EN PROCESO (sin hop HTTP a nuestro propio endpoint). El self-fetch era la causa de que la
// escalera 2/5/10 y el nudge no dejaran rastro: los flags se escribían pero la llamada al handler
// fallaba y nadie lo veía (10 nudges entre el 7 y el 9 de octubre, 0 docs de auditoría).
import { callNotifyEscalation } from './_alert.js';
// Tipificación obligatoria: recordatorios de disposición pendiente y follow-up de seguimiento.
import { isDispositionSatisfied, SEGUIMIENTO_PENDIENTE_CODE } from './_disposition.js';

const WA_LINK = 'https://wa.me/573142332147';
const WA_PHONE = '+57 314 233 2147';
const SITE = 'https://www.unitecusadesign.com/';
const STAGE_1_MIN = 2;
const STAGE_2_MIN = 5;
const STAGE_3_MIN = 10;
const TAKEOVER_NUDGE_MIN = 10;
// Política 2026-10-15: a nadie llega el asesor → la sesión ya no queda eterna en la cola. Con el
// escalón final ya disparado y el cliente sin escribir por una hora, se cierra y se cuenta.
const UNATTENDED_CLOSE_MIN = 60;
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

// Tipificación obligatoria (disposición): si el asesor tomó una escalación urgente y no la
// tipifica, el sistema insiste a las 2 h (aviso al asesor) y a las 24 h (escalación a Nancy/manager).
const DISP_REMIND_MIN = 120;
const DISP_ESCALATE_MIN = 24 * 60;

// Same signature the rest of the analytics code uses for its own probe sessions.
const TEST_ID_RE = /^(diag|lat-test|analytics-verify|post-fix-check|warm-check|secret-verify|verify|final_|n2_|nancy_|test|sla-test|v\d|v[a-z]{4,}\s)/i;

const minutesSince = (iso, now) => {
  const t = Date.parse(iso || '');
  return Number.isNaN(t) ? null : (now - t) / 60000;
};

async function sendSlaAlert(_req, session, stage, waitedMin) {
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
    // dashboardUrl se deja SIN enviar a propósito: /api/notify-escalation firma el link de un toque
    // (atado a la sesión). Un link /?admin=true caía en el muro de login del panel.
    transcript: [
      { role: 'user', text: `Esperando asesor desde hace ${Math.round(waitedMin)} min (etapa SLA ${stage}).` },
      { role: 'model', text: session.lastMessage || '' },
    ],
  };
  try {
    const r = await callNotifyEscalation(body);
    return { ok: r.statusCode === 200, status: r.statusCode, via: 'in_process', results: r.body?.results || null };
  } catch (err) {
    return { ok: false, status: 0, via: 'in_process', error: String(err?.message || err) };
  }
}

/** Aviso de tipificación pendiente (disposición): 2 h al asesor, 24 h a Nancy/manager. */
async function sendDispositionAlert(_req, session, kind, waitedMin) {
  const body = {
    type: 'disposition',
    priority: kind === 'escalate' ? 'urgent' : 'high',
    customerName: session.customerName || 'Cliente',
    customerPhone: session.customerPhone || '',
    customerEmail: session.customerEmail || '',
    message: kind === 'escalate'
      ? 'Conversación urgente pendiente de tipificación (disposición) hace más de 24 h. Requiere cierre por un administrador.'
      : `El asesor lleva ${Math.round(waitedMin)} min sin tipificar la conversación (disposición obligatoria).`,
    brand: session.brandId || 'unitec',
    sessionId: session.id,
    waitingSince: session.dispositionRequiredAt || session.lastUpdated || '',
    pageUrl: session.parentHost || '',
    // 24 h → Nancy/manager por teléfono (si está configurado); si no, va al equipo con prioridad urgente.
    ...(kind === 'escalate' && process.env.DISPOSITION_ESCALATION_PHONE
      ? { adminPhone: process.env.DISPOSITION_ESCALATION_PHONE }
      : {}),
  };
  try {
    const r = await callNotifyEscalation(body);
    return { ok: r.statusCode === 200, status: r.statusCode, via: 'in_process', results: r.body?.results || null };
  } catch (err) {
    return { ok: false, status: 0, via: 'in_process', error: String(err?.message || err) };
  }
}

/** Recordatorio de follow-up: la disposición SEGUIMIENTO_PENDIENTE llegó a su fecha de seguimiento. */
async function sendFollowUpAlert(_req, session) {
  const body = {
    type: 'disposition',
    priority: 'high',
    customerName: session.customerName || 'Cliente',
    customerPhone: session.customerPhone || '',
    customerEmail: session.customerEmail || '',
    message: `Recordatorio de seguimiento pendiente (SEGUIMIENTO_PENDIENTE). Fecha programada: ${session.followUpAt || session.disposition?.followUpAt || 'no indicada'}.`,
    brand: session.brandId || 'unitec',
    sessionId: session.id,
    waitingSince: session.followUpAt || '',
    pageUrl: session.parentHost || '',
  };
  try {
    const r = await callNotifyEscalation(body);
    return { ok: r.statusCode === 200, status: r.statusCode, via: 'in_process', results: r.body?.results || null };
  } catch (err) {
    return { ok: false, status: 0, via: 'in_process', error: String(err?.message || err) };
  }
}

/** Lo que se guarda en la sesión para que un fallo de entrega deje de ser invisible. */
const deliveryRecord = (alert, stage) => ({
  ok: !!alert?.ok,
  status: alert?.status ?? 0,
  via: alert?.via || 'in_process',
  stage,
  error: alert?.error ? String(alert.error).slice(0, 200) : '',
  at: new Date().toISOString(),
});

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
  if (skipForeignCron(req, res)) return; // cron de un proyecto duplicado: no ejecutar
  const secret = process.env.CRON_SECRET || process.env.SWEEP_KEY || '';
  if (secret) {
    const header = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const provided = header || String(req.query?.key || '');
    if (provided !== secret) return res.status(401).json({ error: 'unauthorized' });
  }

  const dryRun = String(req.query?.dryRun || '') === 'true';
  const now = Date.now();

  // Horas de silencio (Bogotá): no se despierta al equipo a las 3 AM. Se difiere TODO (ni alerta ni
  // aviso ni avance de etapa), así la escalera se reanuda a las 07:00 en vez de disparar en ráfaga.
  // `?force=true` lo salta (pruebas y operación urgente).
  const force = String(req.query?.force || '') === 'true';
  const bogotaHour = Number(new Date().toLocaleString('en-GB', { timeZone: 'America/Bogota', hour: '2-digit', hour12: false }));
  const quietHours = !force && Number.isFinite(bogotaHour) && (bogotaHour < 7 || bogotaHour >= 21);

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
      // Una escalación nocturna quedaría huérfana para siempre: las horas de silencio difieren
      // todo y, al amanecer, el cap de 6h sobre lastUpdated la salta en cada corrida (caso real
      // 2026-11-01 "Pasto", review 2026-11-02). human_requested se procesa sin importar la edad;
      // human_assigned CONSERVA el cap (no reprocesar sesiones históricas del panel sin decisión).
      const needsClosure = status === 'human_requested';
      // Tipificación obligatoria pendiente: el traspaso fue urgente y aún no está tipificado.
      // Se procesa sin importar la edad (el reloj 2h/24h arranca en dispositionRequiredAt, no en
      // lastUpdated) y toma su propia rama más abajo, en vez de la escalera SLA genérica.
      const dispositionPending = s.dispositionRequired === true && !isDispositionSatisfied(s);
      if (!lastUpdatedMs || (!needsClosure && !dispositionPending && now - lastUpdatedMs > MAX_AGE_MS)) continue;

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
      // El reloj de espera empieza cuando el cliente PIDIÓ (o en la última actividad para sesiones
      // antiguas). Usar firstUserMessageAt hacía que una sesión de todo el día pareciera "16 h
      // esperando" y disparara la etapa final de inmediato.
      const waitingSince = fields.lastEscalationAt || fields.humanRequestedAt || s.lastUpdated;
      const waitedMin = minutesSince(waitingSince, now) ?? 0;

      if (quietHours) {
        plan.push({ session: s.id, status, stage, waitedMin: Math.round(waitedMin), actions: ['deferred:quiet_hours'] });
        continue;
      }

      // ── Tipificación obligatoria: recordatorios (independientes de la escalera SLA) ──
      // 2 h → aviso al asesor; 24 h → escalación a Nancy/manager. Pendiente de tipificación
      // NO aplica la escalera 2/5/10 ni el cierre automático: se queda en cola hasta tipificar.
      if (dispositionPending) {
        const dispSince = s.dispositionRequiredAt || s.lastUpdated;
        const dispWait = minutesSince(dispSince, now) ?? 0;
        const dispStage = Number(s.dispositionReminderStage || 0);
        const dispEntry = {
          session: s.id,
          status,
          phone: s.customerPhone || '',
          stage: dispStage,
          waitedMin: Math.round(dispWait),
          actions: [],
        };
        if (dispWait >= DISP_ESCALATE_MIN && dispStage < 2) {
          dispEntry.actions.push('disposition:escalate_24h');
          if (!dryRun) {
            const alert = await sendDispositionAlert(req, s, 'escalate', dispWait);
            await setDoc(`conversations/${s.id}`, {
              dispositionReminderStage: 2,
              lastDispositionReminderAt: new Date().toISOString(),
              lastSlaDelivery: deliveryRecord(alert, 'disposition_24h'),
            }, ['dispositionReminderStage', 'lastDispositionReminderAt', 'lastSlaDelivery']);
            done.push({ ...dispEntry, alert });
          }
        } else if (dispWait >= DISP_REMIND_MIN && dispStage < 1) {
          dispEntry.actions.push('disposition:remind_2h');
          if (!dryRun) {
            const alert = await sendDispositionAlert(req, s, 'remind', dispWait);
            await setDoc(`conversations/${s.id}`, {
              dispositionReminderStage: 1,
              lastDispositionReminderAt: new Date().toISOString(),
              lastSlaDelivery: deliveryRecord(alert, 'disposition_2h'),
            }, ['dispositionReminderStage', 'lastDispositionReminderAt', 'lastSlaDelivery']);
            done.push({ ...dispEntry, alert });
          }
        }
        plan.push(dispEntry);
        continue;
      }

      const entry = {
        session: s.id,
        status,
        phone: fields.customerPhone || s.customerPhone || '',
        stage,
        waitedMin: Math.round(waitedMin),
        actions: [],
      };

      // La escalera 2/5/10 es para quien PIDIÓ asesor y nadie tomó la conversación.
      // En human_assigned el asesor ya llegó: ahí sólo cabe un recordatorio (rama nudge),
      // nunca 'SIN RESPUESTA' ni 'staff_no_show' ni decirle al cliente que "viene en camino".
      if (status === 'human_requested' && waitedMin >= STAGE_3_MIN && stage < 3) {
        entry.actions.push('alert:3');
        entry.actions.push('notice:final');
        entry.actions.push('flag:staffNoShow');
        if (!dryRun) {
          const alert = await sendSlaAlert(req, { ...s, ...fields, id: s.id, waitingSince }, 3, waitedMin);
          const notice = await writeCustomerNotice(
            s.id,
            `Sigo pendiente de un asesor para tu caso. Si necesitas atención inmediata ahora, escríbenos por WhatsApp ${WA_PHONE} (${WA_LINK}) y te atendemos sin esperar. Mientras tanto puedes seguir consultándome lo que necesites, o ver más información en ${SITE}`,
            { slaNotice: 3 }
          );
          await setDoc(`conversations/${s.id}`, {
            slaStage: 3,
            lastSlaAt: new Date().toISOString(),
            staffNoShow: true,
            lastSlaDelivery: deliveryRecord(alert, 3),
          }, ['slaStage', 'lastSlaAt', 'staffNoShow', 'lastSlaDelivery']);
          await bumpCounter(`conversations/${s.id}`, 'analytics.slaBreaches');
          done.push({ ...entry, alert, notice });
        }
      } else if (status === 'human_requested' && waitedMin >= STAGE_2_MIN && stage < 2) {
        entry.actions.push('alert:2');
        entry.actions.push('notice:waiting');
        if (!dryRun) {
          const alert = await sendSlaAlert(req, { ...s, ...fields, id: s.id, waitingSince }, 2, waitedMin);
          const notice = await writeCustomerNotice(
            s.id,
            'Sigo aquí con tu conversación y tu solicitud sigue con prioridad: un asesor del equipo está en camino y te escribe por aquí. Mientras llega puedes seguir preguntándome lo que necesites. Si prefieres no esperar, WhatsApp: ' + WA_LINK,
            { slaNotice: 2 }
          );
          await setDoc(`conversations/${s.id}`, { slaStage: 2, lastSlaAt: new Date().toISOString(), lastSlaDelivery: deliveryRecord(alert, 2) }, ['slaStage', 'lastSlaAt', 'lastSlaDelivery']);
          done.push({ ...entry, alert, notice });
        }
      } else if (waitedMin >= STAGE_1_MIN && stage < 1 && status === 'human_requested') {
        entry.actions.push('alert:1');
        if (!dryRun) {
          const alert = await sendSlaAlert(req, { ...s, ...fields, id: s.id, waitingSince }, 1, waitedMin);
          await setDoc(`conversations/${s.id}`, { slaStage: 1, lastSlaAt: new Date().toISOString(), lastSlaDelivery: deliveryRecord(alert, 1) }, ['slaStage', 'lastSlaAt', 'lastSlaDelivery']);
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
          await setDoc(`conversations/${s.id}`, { staffNudgedAt: new Date().toISOString(), lastSlaDelivery: deliveryRecord(alert, 'nudge') }, ['staffNudgedAt', 'lastSlaDelivery']);
          await bumpCounter(`conversations/${s.id}`, 'analytics.staffNudges');
          done.push({ ...entry, alert });
        }
      } else if (
        (status === 'human_requested' || status === 'human_assigned') &&
        (minutesSince(s.lastUpdated, now) ?? 0) >= UNATTENDED_CLOSE_MIN
      ) {
        // Política 2026-10-15: nadie llegó (human_requested) o el asesor se quedó callado
        // (human_assigned) y el cliente lleva una hora sin escribir. La sesión se cierra para que
        // deje de quedar eterna en la cola y para que el caso CUENTE en el informe. El
        // `staffNoShow`/`staffInteractions` quedan intactos: son la evidencia del incumplimiento.
        entry.actions.push(status === 'human_requested' ? 'close:unattended_staff' : 'close:staff_inactive');
        if (!dryRun) {
          await setDoc(`conversations/${s.id}`, {
            status: 'completed',
            closedBy: status === 'human_requested' ? 'unattended_staff' : 'staff_inactive',
            closedAt: new Date().toISOString(),
          }, ['status', 'closedBy', 'closedAt']);
          if (status === 'human_requested') {
            await bumpCounter(`conversations/${s.id}`, 'analytics.unattendedClosures');
          }
          done.push(entry);
        }
      } else {
        continue;
      }
      plan.push(entry);
    }

    // ── Recordatorios de follow-up (SEGUIMIENTO_PENDIENTE con fecha de seguimiento vencida) ──
    // Estas sesiones ya están 'completed' (disposición hecha), por eso se barren en una pasada
    // aparte: la escalera SLA y el cierre solo miran human_requested/human_assigned.
    for (const s of sessions) {
      if (!s?.id || TEST_ID_RE.test(s.id)) continue;
      if (s.dispositionStatus !== 'done') continue;
      if (s.disposition?.code !== SEGUIMIENTO_PENDIENTE_CODE) continue;
      const due = Date.parse(s.followUpAt || s.disposition?.followUpAt || '');
      if (!Number.isFinite(due) || due > now) continue; // aún no vence
      if (s.followUpRemindedAt) continue; // ya se recordó
      const fuEntry = { session: s.id, status: s.status, phone: s.customerPhone || '', actions: [] };
      if (quietHours) {
        fuEntry.actions.push('defer:followup_quiet');
        plan.push(fuEntry);
        continue;
      }
      fuEntry.actions.push('followup:reminder');
      if (!dryRun) {
        const alert = await sendFollowUpAlert(req, s);
        await setDoc(`conversations/${s.id}`, { followUpRemindedAt: new Date().toISOString() }, ['followUpRemindedAt']);
        done.push({ ...fuEntry, alert });
      }
      plan.push(fuEntry);
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
