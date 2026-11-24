// /api/task-deadline-sweep — notificación automatizada de TAREAS vencidas.
//
// Cron */5 (vercel.json). Escanea la colección `tasks`: si `dueAt` venció, la tarea NO está
// marcada como completada (status != 'completed') y todavía no se notificó (notifiedAt vacío),
// dispara la alerta por el MISMO pipeline del front desk — Telegram + email (Resend) +
// SMS (Twilio) vía /api/notify-escalation in-process — y sella notifiedAt para avisar una sola vez.
//
// Reglas:
//   · Horas de silencio 21:00–07:00 Bogotá: se difiere TODO (igual que el sweep SLA). ?force=true salta.
//   · CRON_SECRET obligatorio para invocaciones externas (Vercel cron manda el header solo).
//   · ?dryRun=true simula (plan) sin enviar nada ni marcar notifiedAt.
//   · Marcar la tarea como completada ANTES de la fecha límite es lo único que la exime:
//     el gate de completado se evalúa en cada corrida.

import { getGoogleAccessToken } from './_google-auth.js';
import { fromValue, setDoc } from './_firestore-rest.js';
import { projectId } from './_analytics-core.js';
import { callNotifyEscalation } from './_alert.js';
import { skipForeignCron } from './_cron-guard.js';

export const config = { maxDuration: 60 };

const BRAND_LABEL = { unitec: 'UNITEC USA DESIGN', building: 'Building Innovation' };

async function listTaskDocs(token) {
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  const out = [];
  let pageToken = '';
  while (true) {
    const url = `${base}/tasks?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(`list tasks: ${r.status}`);
    const data = await r.json();
    (data.documents || []).forEach((d) => {
      const fields = {};
      for (const [k, v] of Object.entries(d?.fields || {})) fields[k] = fromValue(v);
      out.push({ id: d?.name?.split('/').pop() || '', ...fields });
    });
    pageToken = data.nextPageToken || '';
    if (!pageToken) break;
  }
  return out;
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
  const force = String(req.query?.force || '') === 'true';
  const now = Date.now();
  const bogotaHour = Number(new Date().toLocaleString('en-GB', { timeZone: 'America/Bogota', hour: '2-digit', hour12: false }));
  const quietHours = !force && Number.isFinite(bogotaHour) && (bogotaHour < 7 || bogotaHour >= 21);

  try {
    const token = await getGoogleAccessToken().catch(() => null);
    if (!token) return res.status(503).json({ ok: false, error: 'service_account_missing' });

    const tasks = await listTaskDocs(token);
    const plan = [];
    const done = [];
    const skippedCompleted = [];

    for (const t of tasks) {
      if (!t?.id) continue;
      if ((t.status || 'open') === 'completed') {
        skippedCompleted.push(t.id); // tarea marcada como completada → la fecha límite no notifica
        continue;
      }
      const due = Date.parse(t.dueAt || '');
      if (!Number.isFinite(due) || due > now) continue; // aún no vence
      if (t.notifiedAt) continue; // ya se notificó (una sola vez)

      const entry = {
        id: t.id,
        title: String(t.title || '').slice(0, 80),
        brandId: t.brandId || 'unitec',
        dueAt: t.dueAt || '',
        status: t.status || 'open',
        actions: [],
      };
      if (quietHours) {
        entry.actions.push('defer:quiet_hours');
        plan.push(entry);
        continue;
      }

      entry.actions.push('notify:deadline');
      plan.push(entry);
      if (dryRun) continue;

      const brandLabel = BRAND_LABEL[t.brandId] || t.brandId || 'unitec';
      const alert = await callNotifyEscalation({
        type: 'task',
        priority: 'high',
        customerName: `Tarea: ${String(t.title || 'Sin título').slice(0, 60)}`,
        customerPhone: '',
        customerEmail: '',
        message: `TAREA VENCIDA — "${String(t.title || '').slice(0, 120)}" (${brandLabel}) no fue marcada como completada antes de su fecha límite: ${t.dueAt || 'no indicada'}.${t.note ? ` Nota: ${String(t.note).slice(0, 300)}` : ''}`,
        brand: t.brandId || 'unitec',
        sessionId: `task-${t.id}`,
        waitingSince: t.dueAt || '',
      });
      const ok = alert?.statusCode === 200;
      await setDoc(`tasks/${t.id}`, {
        notifiedAt: new Date().toISOString(),
        lastNotifiedError: ok ? '' : String(alert?.body?.error || `status ${alert?.statusCode}`).slice(0, 200),
      }, ['notifiedAt', 'lastNotifiedError'], token).catch((e) => console.warn('[task-sweep] notifiedAt write failed:', e?.message || e));
      done.push({ ...entry, ok, status: alert?.statusCode, results: alert?.body?.results || null });
    }

    return res.status(200).json({
      ok: true,
      dryRun,
      scanned: tasks.length,
      candidates: plan.length,
      acted: done.length,
      skippedCompleted: skippedCompleted.length,
      plan,
      done,
      ranAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[task-deadline-sweep] failed:', err?.message || err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
