// /api/tasks — TAREAS con fecha límite para el panel admin (un solo sistema, dos marcas).
//
// GET    /api/tasks[?brand=&status=&limit=]   listar (más recientes primero)
// POST   { brandId, title, note?, dueAt }     crear (brandId: 'unitec' | 'building')
// PATCH  { id, status?, title?, note?, dueAt?, brandId? }  actualizar — status:'completed'
//        sella completedAt + completedBy y libera el recordatorio de fecha límite.
// DELETE { id }                               eliminar (admin únicamente)
//
// Auth: Authorization: Bearer <ADMIN_SECRET> (el mismo secreto que /api/gemini-key).
// El sweep de fecha límite (api/task-deadline-sweep.js, cron */5) es el que notifica por
// Telegram + email (Resend) + SMS (Twilio) cuando dueAt vence y la tarea sigue abierta.
//
// Por qué existe: el dueño pidió tareas con fecha límite y notificación automatizada
// (2026-11-23). Las tareas viven en la colección `tasks` del MISMO Firestore que las
// conversaciones (projectId de _analytics-core), con brandId para que la analítica del
// panel distinga unitec vs building.

import { getGoogleAccessToken } from './_google-auth.js';
import { fromValue, docUrl, addDoc, setDoc } from './_firestore-rest.js';
import { projectId } from './_analytics-core.js';

export const config = { maxDuration: 30 };

const VALID_BRANDS = ['unitec', 'building'];
const VALID_STATUS = ['open', 'completed'];

function setCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function authorized(req) {
  const allowed = [process.env.ADMIN_SECRET, process.env.TASKS_TOKEN].filter(Boolean);
  if (!allowed.length) return false;
  const h = String(req.headers.authorization || '');
  const bearer = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  return allowed.some((s) => s === bearer);
}

/** Parses one Firestore REST document into a plain object. */
function parseDoc(d) {
  const fields = d?.fields || {};
  const out = { id: d?.name?.split('/').pop() || '' };
  for (const [k, v] of Object.entries(fields)) out[k] = fromValue(v);
  return out;
}

/** Lists all task docs (small collection — sort in memory). */
async function listTasks(token, { brand, status, limit }) {
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  const out = [];
  let pageToken = '';
  while (true) {
    const url = `${base}/${COLLECTION}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(`list tasks: ${r.status}`);
    const data = await r.json();
    (data.documents || []).forEach((d) => out.push(parseDoc(d)));
    pageToken = data.nextPageToken || '';
    if (!pageToken) break;
  }
  let rows = out;
  if (brand && VALID_BRANDS.includes(brand)) rows = rows.filter((t) => t.brandId === brand);
  if (status && VALID_STATUS.includes(status)) rows = rows.filter((t) => (t.status || 'open') === status);
  rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  return limit ? rows.slice(0, Number(limit)) : rows;
}

async function deleteTask(token, id) {
  const r = await fetch(docUrl(`tasks/${id}`), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok && r.status !== 404) throw new Error(`delete task: ${r.status}`);
  return r.status !== 404;
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!authorized(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });

  const token = await getGoogleAccessToken().catch(() => null);
  if (!token) return res.status(503).json({ ok: false, error: 'service_account_missing' });

  try {
    // ── GET: listar ────────────────────────────────────────────────
    if (req.method === 'GET') {
      const { brand, status, limit } = req.query || {};
      const tasks = await listTasks(token, { brand, status, limit });
      return res.status(200).json({ ok: true, tasks, count: tasks.length });
    }

    // ── DELETE ─────────────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const id = String(req.body?.id || req.query?.id || '').trim();
      if (!id) return res.status(400).json({ ok: false, error: 'id is required' });
      const removed = await deleteTask(token, id);
      return res.status(200).json({ ok: true, removed });
    }

    const body = req.body || {};

    // ── POST: crear ────────────────────────────────────────────────
    if (req.method === 'POST') {
      const brandId = String(body.brandId || '').trim();
      const title = String(body.title || '').trim();
      const note = String(body.note || '').trim();
      const dueRaw = String(body.dueAt || '').trim();
      if (!VALID_BRANDS.includes(brandId)) return res.status(400).json({ ok: false, error: 'brandId must be unitec|building' });
      if (!title) return res.status(400).json({ ok: false, error: 'title is required' });
      const dueMs = Date.parse(dueRaw);
      if (!Number.isFinite(dueMs)) return res.status(400).json({ ok: false, error: 'dueAt must be a valid date' });
      const now = new Date().toISOString();
      const id = await addDoc(COLLECTION, {
        brandId,
        title,
        note,
        dueAt: new Date(dueMs).toISOString(),
        status: 'open',
        createdBy: String(body.createdBy || 'admin').slice(0, 60),
        createdAt: now,
        updatedAt: now,
        completedAt: '',
        completedBy: '',
        notifiedAt: '',
      }, token);
      return res.status(200).json({ ok: true, id, task: { id, brandId, title, note, dueAt: new Date(dueMs).toISOString(), status: 'open', createdAt: now } });
    }

    // ── PATCH: actualizar ──────────────────────────────────────────
    if (req.method === 'PATCH') {
      const id = String(body.id || '').trim();
      if (!id) return res.status(400).json({ ok: false, error: 'id is required' });
      const fields = {};
      const mask = [];
      if (typeof body.title === 'string' && body.title.trim()) { fields.title = body.title.trim().slice(0, 200); mask.push('title'); }
      if (typeof body.note === 'string') { fields.note = String(body.note).trim().slice(0, 500); mask.push('note'); }
      if (typeof body.brandId === 'string' && VALID_BRANDS.includes(body.brandId)) { fields.brandId = body.brandId; mask.push('brandId'); }
      if (typeof body.dueAt === 'string' && body.dueAt.trim()) {
        const dueMs = Date.parse(body.dueAt);
        if (!Number.isFinite(dueMs)) return res.status(400).json({ ok: false, error: 'dueAt must be a valid date' });
        fields.dueAt = new Date(dueMs).toISOString();
        mask.push('dueAt');
      }
      if (typeof body.status === 'string' && VALID_STATUS.includes(body.status)) {
        fields.status = body.status;
        mask.push('status');
        if (body.status === 'completed') {
          fields.completedAt = new Date().toISOString();
          fields.completedBy = String(body.completedBy || 'admin').slice(0, 60);
          mask.push('completedAt', 'completedBy');
        } else {
          fields.completedAt = '';
          fields.completedBy = '';
          mask.push('completedAt', 'completedBy');
        }
      }
      if (!mask.length) return res.status(400).json({ ok: false, error: 'nothing to update' });
      fields.updatedAt = new Date().toISOString();
      mask.push('updatedAt');
      await setDoc(`tasks/${id}`, fields, mask, token);
      return res.status(200).json({ ok: true, id, updated: mask });
    }

    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  } catch (err) {
    console.error('[tasks] failed:', err?.message || err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
