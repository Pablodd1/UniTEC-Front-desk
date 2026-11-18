// GET /api/sessions?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=500
// Lista de sesiones para el Registro del panel de Analíticas, calculada SERVER-SIDE.
//
// Por qué existe: la tabla y los contadores "en vivo" del panel dependían de la suscripción
// Firestore del navegador (4.700+ documentos). Esa lista llegaba incompleta/tarde y con
// `createdAt` como Timestamp (no parseable por el filtro de fechas), así que con un filtro activo
// la tabla mostraba "0 de 0" y "Ingresaron hoy 0" aunque el servidor sí tuviera datos.
// Ahora el panel lee el mismo Firestore desde el servidor, con los MISMOS días Bogotá y el MISMO
// filtro de sesiones de prueba que /api/analytics.

import { getToken } from './_firestore-rest.js';
import { isTestSession, projectId, parseFirestoreDoc, filterByBogotaRange } from './_analytics-core.js';

const DOCS = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

async function runQuery(token, structuredQuery) {
  const r = await fetch(`${DOCS}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery }),
    signal: AbortSignal.timeout(9000),
  });
  if (!r.ok) throw new Error(`runQuery ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const from = String(req.query?.from || '');
  const to = String(req.query?.to || '');
  const limitRaw = parseInt(String(req.query?.limit || '500'), 10);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 500, 1), 2000);

  try {
    const token = await getToken();

    // Días BOGOTÁ (UTC-5) = [from 05:00Z, (to+1día) 05:00Z). Con comparación de texto UTC la
    // ventana se corría un día y no coincidía con los KPIs (que sí son Bogotá).
    const plusOneDay = (day) => {
      const dt = new Date(`${day}T00:00:00Z`);
      if (Number.isNaN(dt.getTime())) return day;
      dt.setUTCDate(dt.getUTCDate() + 1);
      return dt.toISOString().slice(0, 10);
    };
    const filters = [];
    if (from) filters.push({ fieldFilter: { field: { fieldPath: 'createdAt' }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: `${from}T05:00:00.000Z` } } });
    if (to) filters.push({ fieldFilter: { field: { fieldPath: 'createdAt' }, op: 'LESS_THAN', value: { stringValue: `${plusOneDay(to)}T05:00:00.000Z` } } });

    const structuredQuery = {
      from: [{ collectionId: 'conversations' }],
      ...(filters.length
        ? { where: filters.length > 1 ? { compositeFilter: { op: 'AND', filters } } : filters[0] }
        : {}),
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
      limit,
    };

    let sessions;
    try {
      const rows = await runQuery(token, structuredQuery);
      sessions = rows
        .filter((x) => x.document)
        .map((x) => parseFirestoreDoc(x.document))
        .filter((s) => !isTestSession(s.id));
    } catch (queryErr) {
      // Sin índice / query rechazada: se recorre la colección y se filtra en memoria (más lento).
      console.warn('[sessions] runQuery falló, usando fallback:', queryErr?.message || queryErr);
      const { listAllSessions, getFirestoreToken } = await import('./_analytics-core.js');
      const all = await listAllSessions(getFirestoreToken ? await getFirestoreToken() : token);
      const ranged = from || to ? filterByBogotaRange(all, from || null, to || null) : all;
      sessions = ranged
        .filter((s) => !isTestSession(s.id))
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, limit);
    }

    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=40');
    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      range: { from: from || null, to: to || null },
      limit,
      count: sessions.length,
      hasMore: sessions.length >= limit,
      sessions,
    });
  } catch (err) {
    console.error('[sessions] failed:', err?.message || err);
    return res.status(500).json({ error: 'sessions_failed', detail: String(err?.message || err) });
  }
}
