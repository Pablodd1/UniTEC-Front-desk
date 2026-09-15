// GET /api/lifecycle-sweep?dryRun=true
// Cierra el ciclo de vida de las sesiones para que el embudo tenga caídas reales por paso.
//
// Por qué existe: `abandoned_at_greeting`, `abandoned_at_<paso>` y `completed` NO los escribía
// nadie (las 3.423 sesiones estaban en `active` salvo 8 cerradas a mano y 7 con staff), así que
// las secciones de abandono del informe diario siempre imprimían 0.
//
// Reglas (idle = minutos desde lastUpdated):
//   · idle > 15 min y 0 mensajes de usuario                        -> abandoned_at_greeting
//   · idle > 15 min y etapa name|phone|profession                  -> abandoned_at_<etapa>
//   · idle > 30 min y conversación real (menu|engaged o ≥3 msgs)   -> completed
//   · NUNCA toca: human_requested, human_assigned, completed, abandoned_*
//
// Es idempotente: volver a ejecutarlo no cambia nada.

import { getFirestoreToken, listAllSessions, isTestSession, projectId } from './_analytics-core.js';

const IDLE_ABANDON_MIN = 15;
const IDLE_COMPLETE_MIN = 30;
const MAX_WRITES_PER_RUN = 400;
const PROTECTED = /^(human_requested|human_assigned|completed|abandoned)/;

function minutesSince(iso) {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return (Date.now() - t) / 60000;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const dryRun = String(req.query?.dryRun || '') === 'true';
  const sweepKey = process.env.SWEEP_KEY || '';
  if (sweepKey && req.headers['x-sweep-key'] !== sweepKey) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const idToken = await getFirestoreToken();
    if (!idToken) return res.status(503).json({ error: 'auth_unavailable' });
    const sessions = await listAllSessions(idToken);

    const plan = [];
    for (const s of sessions) {
      if (isTestSession(s.id)) continue;
      if (PROTECTED.test(String(s.status || ''))) continue;

      const idle = minutesSince(s.lastUpdated || s.createdAt);
      const um = Number(s.analytics?.userMessageCount || 0);
      const step = s.funnelStep || '';
      let next = null;

      if (idle > IDLE_ABANDON_MIN) {
        if (um === 0) next = 'abandoned_at_greeting';
        else if (['name', 'phone', 'profession'].includes(step)) next = `abandoned_at_${step}`;
        else if (idle > IDLE_COMPLETE_MIN) next = 'completed';
      }
      if (next) plan.push({ id: s.id, status: next, idleMinutes: Math.round(idle), userMessages: um, step: step || '(sin etapa)' });
    }

    if (dryRun) {
      return res.status(200).json({ dryRun: true, scanned: sessions.length, toUpdate: plan.length, plan: plan.slice(0, 200) });
    }

    const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
    const auth = { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' };
    let updated = 0;
    const batch = plan.slice(0, MAX_WRITES_PER_RUN);
    await Promise.all(batch.map(async (p) => {
      try {
        const r = await fetch(`${base}/conversations/${p.id}?updateMask.fieldPaths=status`, {
          method: 'PATCH', headers: auth,
          body: JSON.stringify({ fields: { status: { stringValue: p.status } } }),
        });
        if (r.ok) updated += 1;
      } catch { /* se reintenta en la siguiente pasada */ }
    }));

    return res.status(200).json({
      dryRun: false,
      scanned: sessions.length,
      candidates: plan.length,
      updated,
      skippedForNextRun: Math.max(0, plan.length - batch.length),
      sample: batch.slice(0, 25),
    });
  } catch (e) {
    console.error('lifecycle-sweep error:', e);
    return res.status(500).json({ error: 'server_error', detail: String(e?.message || e) });
  }
}
