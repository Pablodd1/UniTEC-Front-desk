import { skipForeignCron } from './_cron-guard.js';
// GET /api/abandon-sweep?dryRun=true — fallback abandonment alert (cron */5).
//
// Why: the beacon (/api/session-exit) catches a closed tab, but a killed browser, a locked phone that
// never fires pagehide, or a tab left open until it goes stale produce no signal. This sweep looks
// ONLY at sessions touched in the last window (bounded query — the */15 lifecycle-sweep already full
// scans, no need to multiply reads) and fires the ONE "cliente abandonó" alert for a real conversation
// that went quiet without a human on it.
//
// Rules:
//   · userMessageCount >= 1 (the customer actually wrote)   · status not human_*/completed
//   · no abandonAlertedAt yet (one alert per session)       · quiet hours 21:00-07:00 Bogotá => skip
//   · trigger: exitAt present (beacon missed the alert), hiddenAt older than 3 min, or idle > 6 min
//
// Query range on `lastUpdated` (ISO string) uses the default single-field index — no composite index.

import { getToken } from './_firestore-rest.js';
import { alertAbandon, TEST_SESSION_RE, PROTECTED_STATUS } from './_alert.js';

const PROJECT = 'chatbot-bi-front-desk';
const RUN = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`;

const WINDOW_MIN = 30;      // only sessions touched in the last N minutes
const IDLE_MIN = 6;         // no activity for this long => abandoned
const HIDDEN_MIN = 3;       // hidden (phone locked / app switched away) for this long => abandoned
const MAX_ALERTS_PER_RUN = 20;

const fromValue = (v) => {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fromValue(x)]));
  return null;
};
const fromFields = (f) => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, fromValue(v)]));
const minutesSince = (iso) => {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? Infinity : (Date.now() - t) / 60000;
};
const bogotaHour = () => Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Bogota' }).format(new Date()));

export default async function handler(req, res) {
  if (skipForeignCron(req, res)) return; // cron de un proyecto duplicado: no ejecutar
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const dryRun = String(req.query?.dryRun || '') === 'true';
  const sweepKey = process.env.SWEEP_KEY || '';
  if (sweepKey && req.headers['x-sweep-key'] !== sweepKey) return res.status(401).json({ error: 'unauthorized' });

  const hour = bogotaHour();
  const quiet = hour >= 21 || hour < 7;
  if (quiet && !dryRun) return res.status(200).json({ skipped: 'quiet_hours', bogotaHour: hour });

  try {
    const token = await getToken();
    const cutoff = new Date(Date.now() - WINDOW_MIN * 60000).toISOString();
    const query = {
      structuredQuery: {
        from: [{ collectionId: 'conversations' }],
        where: { fieldFilter: { field: { fieldPath: 'lastUpdated' }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: cutoff } } },
        orderBy: [{ field: { fieldPath: 'lastUpdated' }, direction: 'DESCENDING' }],
        limit: 400,
      },
    };
    const r = await fetch(RUN, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) return res.status(502).json({ error: 'runQuery_failed', status: r.status });
    const rows = await r.json();
    const docs = (Array.isArray(rows) ? rows : []).filter((x) => x.document).map((x) => ({
      id: x.document.name.split('/').pop(),
      fields: fromFields(x.document.fields),
    }));

    const plan = [];
    for (const d of docs) {
      if (TEST_SESSION_RE.test(d.id)) continue;
      if (PROTECTED_STATUS.test(String(d.fields.status || ''))) continue;
      if (d.fields.abandonAlertedAt) continue;
      if (Number(d.fields.analytics?.userMessageCount || 0) < 1) continue;
      const idle = minutesSince(d.fields.lastUpdated || d.fields.exitAt);
      const hiddenAgo = d.fields.hiddenAt ? minutesSince(d.fields.hiddenAt) : Infinity;
      const triggers = [];
      if (d.fields.exitAt) triggers.push('exit_beacon');
      if (hiddenAgo > HIDDEN_MIN) triggers.push('hidden');
      if (idle > IDLE_MIN) triggers.push('idle');
      if (!triggers.length) continue;
      plan.push({ id: d.id, triggers, idleMin: Math.round(idle), hiddenMin: hiddenAgo === Infinity ? null : Math.round(hiddenAgo), userMessages: Number(d.fields.analytics?.userMessageCount || 0), step: d.fields.funnelStep || '', doc: d });
    }

    if (dryRun) {
      return res.status(200).json({ dryRun: true, scanned: docs.length, toAlert: plan.length, plan: plan.map(({ doc, ...p }) => p).slice(0, 100) });
    }

    const results = [];
    for (const p of plan.slice(0, MAX_ALERTS_PER_RUN)) {
      const out = await alertAbandon(p.doc, { stage: p.step });
      results.push({ id: p.id, triggers: p.triggers, ...out });
    }

    return res.status(200).json({ quiet: false, scanned: docs.length, candidates: plan.length, alerted: results.filter((x) => x.sent).length, results: results.slice(0, 50) });
  } catch (err) {
    console.error('[abandon-sweep] error:', err?.message || err);
    return res.status(500).json({ error: 'server_error', detail: String(err?.message || err) });
  }
}
