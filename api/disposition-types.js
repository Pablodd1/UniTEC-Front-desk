// api/disposition-types.js — CRUD for the disposition (tipificación) taxonomy.
//
// GET    /api/disposition-types                     -> list (seeds the 12 defaults on first read)
// POST   /api/disposition-types  {code,label}        -> create (admin)
// PUT    /api/disposition-types  {code,label?,active?}-> update (admin)
// DELETE /api/disposition-types  {code}              -> soft-delete (admin)
//
// Admin auth = shared ADMIN_SECRET via `Authorization: Bearer <secret>` (same as /api/gemini-key).
// Taxonomy lives in Firestore collection `disposition_types`, keyed by code. Codes are unique and
// never hard-deleted (soft-delete with `active:false`), so existing dispositions keep resolving.

import { createRequire } from 'module';
import { getToken, getDoc, commitWrites } from './_firestore-rest.js';
import { DISPOSITION_DEFAULTS, isValidDispositionCode, verifyAdmin } from './_disposition.js';
import { getGoogleAccessToken } from './_google-auth.js';

// `disposition_types` no está en las reglas públicas: con el token anónimo de Firebase daba
// 403 (listTypes 403) y el selector del asesor salía vacío. Se usa el token de la cuenta de
// servicio (IAM), al que las reglas no aplican. Si no hay credenciales, cae al token anónimo.
async function firestoreToken() {
  const admin = await getGoogleAccessToken();
  return admin || (await getToken());
}

const require_ = createRequire(import.meta.url);
const firebaseConfig = require_('../firebase-applet-config.json');
const PROJECT = firebaseConfig.projectId;
const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

const COLLECTION = 'disposition_types';

/** Read every doc in `disposition_types` (small, bounded collection). */
async function listTypes() {
  const token = await firestoreToken();
  const out = [];
  let pageToken = '';
  while (true) {
    const url = `${DOCS}/${COLLECTION}?pageSize=100${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(9000) });
    if (!r.ok) throw new Error(`listTypes ${r.status}`);
    const data = await r.json();
    for (const d of data.documents || []) {
      const f = d.fields || {};
      out.push({
        code: f.code?.stringValue || d.name.split('/').pop(),
        label: f.label?.stringValue || '',
        active: f.active?.booleanValue !== false,
        order: Number(f.order?.integerValue ?? f.order?.doubleValue ?? 0),
        createdAt: f.createdAt?.stringValue || '',
      });
    }
    pageToken = data.nextPageToken || '';
    if (!pageToken) break;
  }
  return out.sort((a, b) => a.order - b.order || a.code.localeCompare(b.code));
}

/** Seed the 12 defaults if the collection is empty (idempotent: only creates what's missing). */
async function ensureSeeded() {
  const existing = await listTypes();
  const have = new Set(existing.map((t) => t.code));
  const missing = DISPOSITION_DEFAULTS.filter((d) => !have.has(d.code));
  if (!missing.length) return existing;
  const now = new Date().toISOString();
  const token = await firestoreToken();
  await commitWrites(missing.map((d) => ({
    path: `${COLLECTION}/${d.code}`,
    fields: { code: d.code, label: d.label, active: true, order: DISPOSITION_DEFAULTS.indexOf(d), createdAt: now },
  })), token);
  return listTypes();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    // GET is public (the taxonomy is not secret — it drives the advisor's picker).
    if (req.method === 'GET') {
      const types = await ensureSeeded();
      res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
      return res.status(200).json({ ok: true, count: types.length, types });
    }

    // Everything below is admin-only.
    const admin = verifyAdmin(req);
    if (!admin.ok) return res.status(admin.status).json({ ok: false, error: admin.error });

    const body = req.body || {};
    const code = String(body.code || '').trim().toUpperCase();
    // Token con permisos IAM: las reglas de Firestore no cubren `disposition_types`.
    const token = await firestoreToken();

    if (req.method === 'POST') {
      const label = String(body.label || '').trim();
      if (!isValidDispositionCode(code)) return res.status(400).json({ ok: false, error: 'invalid_code' });
      if (!label || label.length > 120) return res.status(400).json({ ok: false, error: 'invalid_label' });
      const existing = await getDoc(`${COLLECTION}/${code}`, token);
      if (existing) return res.status(409).json({ ok: false, error: 'code_already_exists' });
      const now = new Date().toISOString();
      await commitWrites([{ path: `${COLLECTION}/${code}`, fields: { code, label, active: true, order: 0, createdAt: now } }], token);
      return res.status(200).json({ ok: true, type: { code, label, active: true } });
    }

    if (req.method === 'PUT') {
      if (!isValidDispositionCode(code)) return res.status(400).json({ ok: false, error: 'invalid_code' });
      const existing = await getDoc(`${COLLECTION}/${code}`, token);
      if (!existing) return res.status(404).json({ ok: false, error: 'code_not_found' });
      const fields = {};
      if (body.label !== undefined) {
        const label = String(body.label || '').trim();
        if (!label || label.length > 120) return res.status(400).json({ ok: false, error: 'invalid_label' });
        fields.label = label;
      }
      if (body.active !== undefined) fields.active = !!body.active;
      if (!Object.keys(fields).length) return res.status(400).json({ ok: false, error: 'nothing_to_update' });
      await commitWrites([{ path: `${COLLECTION}/${code}`, fields, mask: Object.keys(fields) }], token);
      return res.status(200).json({ ok: true, updated: { code, ...fields } });
    }

    if (req.method === 'DELETE') {
      if (!isValidDispositionCode(code)) return res.status(400).json({ ok: false, error: 'invalid_code' });
      const existing = await getDoc(`${COLLECTION}/${code}`, token);
      if (!existing) return res.status(404).json({ ok: false, error: 'code_not_found' });
      // Soft-delete only: never hard-delete a code that may already be referenced by dispositions.
      await commitWrites([{ path: `${COLLECTION}/${code}`, fields: { active: false }, mask: ['active'] }], token);
      return res.status(200).json({ ok: true, softDeleted: code });
    }

    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  } catch (err) {
    console.error('[disposition-types] failed:', err?.message || err);
    return res.status(500).json({ ok: false, error: 'server_error', detail: String(err?.message || err) });
  }
}
