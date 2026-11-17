// GET /api/escalations?limit=40
// Lista los avisos que el equipo YA recibió por Telegram/Email/WhatsApp, para que el panel
// pueda abrirlos. Motivo (verificado 2026-11-17): la pestaña "Alertas" solo se alimentaba de la
// colección `interventions` (29 docs), mientras en `escalations` había 419 avisos reales
// (abandon 312 · sla 71 · quote 18 · staff 11 · contact 3). El 93% de los usuarios alertados
// no tenía ninguna fila donde hacer clic en el panel.
//
// Devuelve solo metadatos (sin transcript): el chat se abre con `?admin=true&session=<id>`.

import { getToken } from './_firestore-rest.js';
import { isTestSession, projectId } from './_analytics-core.js';

const DOCS = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

const str = (v) => (v && typeof v === 'object' ? String(v.stringValue ?? '') : '');
const bool = (v) => !!(v && typeof v === 'object' && v.booleanValue === true);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const limitRaw = parseInt(String(req.query?.limit || '40'), 10);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 40, 1), 100);

  try {
    const token = await getToken();
    const url = `${DOCS}/escalations?pageSize=300&orderBy=createdAt%20desc`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(9000) });
    if (!r.ok) return res.status(502).json({ error: `firestore_${r.status}` });
    const data = await r.json();

    const items = (data.documents || [])
      .map((d) => {
        const f = d.fields || {};
        return {
          id: d.name.split('/').pop(),
          type: str(f.type) || 'custom',
          priority: str(f.priority) || 'high',
          sessionId: str(f.sessionId),
          customerName: str(f.customerName),
          customerPhone: str(f.customerPhone),
          message: str(f.message),
          at: str(f.createdAt) || str(f.timestamp) || '',
          delivered: bool(f.anyDelivered),
        };
      })
      .filter((x) => x.sessionId && !isTestSession(x.sessionId) && !/^test-monitor/i.test(x.sessionId));

    // Una fila por sesión+tipo (las re-alertas SLA repiten la misma sesión a propósito).
    const seen = new Set();
    const unique = [];
    for (const x of items) {
      const key = `${x.sessionId}|${x.type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(x);
      if (unique.length >= limit) break;
    }

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res.status(200).json({ generatedAt: new Date().toISOString(), escalations: unique });
  } catch (err) {
    console.error('[escalations] failed:', err?.message || err);
    return res.status(500).json({ error: 'escalations_failed' });
  }
}
