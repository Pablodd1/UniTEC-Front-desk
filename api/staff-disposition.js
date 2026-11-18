// api/staff-disposition.js — the advisor "tipifica" (disposes) an urgent escalation.
//
// POST /api/staff-disposition   -> advisor saves the disposition (staff token auth)
//   body: { token, sessionId, code, note?, followUpAt?, staffName? }
//   · validates code against disposition_types (Firestore + the 12 seeded defaults)
//   · validates required fields per code (SEGUIMIENTO_PENDIENTE→followUpAt, …_NO_EFECTIVA/…→note)
//   · requires session in human_assigned / pending_disposition AND dispositionRequired
//   · writes session.disposition + dispositionStatus=done + status=completed + an append-only
//     audit doc conversations/{id}/dispositions/{autoId} (code, note, followUpAt, by, byName, at,
//     previousCode, source) — ATOMIC in a single commit.
//   · idempotent: repeating the same code returns the existing disposition; a different code
//     without admin rights returns 409 change_requires_admin.
//
// PUT /api/staff-disposition    -> admin correction (ADMIN_SECRET Bearer)
//   body: { sessionId, code, note?, followUpAt?, staffName? }
//   · writes a NEW audit row with source=supervisor_correction and previousCode.

import { verifyStaffToken } from './_staff-token.js';
import { getDoc, commitWrites } from './_firestore-rest.js';
import {
  DISPOSITION_LABELS, isValidDispositionCode, validateDispositionFields, verifyAdmin,
} from './_disposition.js';

const SID_RE = /^[\w-]{1,120}$/;
const ALLOWED_PENDING_STATUS = new Set(['human_assigned', 'pending_disposition']);
const NOTE_MAX = 500;

/** Resolve a code to its label. Firestore wins (honors soft-delete); fall back to the 12 seeded
 *  defaults when the collection hasn't been seeded yet. */
async function resolveCode(code) {
  try {
    const doc = await getDoc(`disposition_types/${code}`);
    if (doc) {
      if (doc.fields?.active === false) return { ok: false, reason: 'inactive_code' };
      return { ok: true, label: String(doc.fields?.label || code) };
    }
  } catch { /* fall through to the canonical defaults */ }
  const label = DISPOSITION_LABELS[code];
  if (label) return { ok: true, label };
  return { ok: false };
}

function sanitizeNote(v) {
  return String(v || '').trim().slice(0, NOTE_MAX) || '';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST' && req.method !== 'PUT') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const body = req.body || {};
  const sessionId = String(body.sessionId || req.query?.session || '').trim();
  const code = String(body.code || '').trim().toUpperCase();

  if (!SID_RE.test(sessionId)) return res.status(400).json({ ok: false, error: 'invalid_session' });
  if (!isValidDispositionCode(code)) return res.status(400).json({ ok: false, error: 'invalid_code' });

  // Auth: advisor (staff token bound to the session) for POST; admin for PUT.
  let byName;
  if (req.method === 'POST') {
    const token = String(body.token || req.query?.token || '').trim();
    const verdict = verifyStaffToken(sessionId, token);
    if (!verdict.ok) return res.status(401).json({ ok: false, error: 'invalid_or_expired_token', reason: verdict.reason });
    byName = String(body.staffName || '').trim().slice(0, 60) || 'Asesor';
  } else {
    const admin = verifyAdmin(req);
    if (!admin.ok) return res.status(admin.status).json({ ok: false, error: admin.error });
    byName = String(body.staffName || '').trim().slice(0, 60) || 'Administrador';
  }

  // Validate the code + its required fields BEFORE touching the session.
  const resolved = await resolveCode(code);
  if (!resolved.ok) return res.status(400).json({ ok: false, error: 'unknown_code', code });
  const fieldCheck = validateDispositionFields(code, body);
  if (!fieldCheck.ok) return res.status(400).json({ ok: false, error: 'missing_required_field', ...fieldCheck });

  const note = sanitizeNote(body.note);
  const followUpAtRaw = String(body.followUpAt || '').trim();
  const followUpAt = followUpAtRaw && Number.isFinite(Date.parse(followUpAtRaw)) ? new Date(followUpAtRaw).toISOString() : '';

  try {
    const doc = await getDoc(`conversations/${sessionId}`);
    if (!doc) return res.status(404).json({ ok: false, error: 'session_not_found' });
    const f = doc.fields || {};
    const currentStatus = String(f.status || '');
    const currentDisp = f.disposition || {};
    const currentDispStatus = String(f.dispositionStatus || '');

    const now = new Date().toISOString();
    const buildDisposition = (previousCode) => ({
      code,
      label: resolved.label,
      ...(note ? { note } : {}),
      ...(followUpAt ? { followUpAt } : {}),
      by: byName,
      byName,
      at: now,
      previousCode: previousCode || '',
    });

    // ── Idempotency / change-without-admin guard ─────────────────────────
    if (currentDispStatus === 'done') {
      if (currentDisp.code === code) {
        return res.status(200).json({ ok: true, alreadyDispositioned: true, disposition: currentDisp });
      }
      // Different code: only the admin correction path may change it.
      if (req.method === 'POST') {
        return res.status(409).json({ ok: false, error: 'change_requires_admin', previousCode: currentDisp.code || '' });
      }
    }

    // ── Guards for a fresh disposition ───────────────────────────────────
    if (currentDispStatus !== 'done') {
      if (f.dispositionRequired !== true) {
        return res.status(409).json({ ok: false, error: 'disposition_not_required' });
      }
      if (!ALLOWED_PENDING_STATUS.has(currentStatus)) {
        return res.status(409).json({ ok: false, error: 'invalid_status', status: currentStatus });
      }
    }

    const previousCode = currentDisp.code || '';
    const disposition = buildDisposition(previousCode);
    const source = req.method === 'POST' ? (currentDispStatus === 'done' ? 'supervisor_correction' : 'advisor') : 'supervisor_correction';
    const auditId = `disp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const sessionFields = {
      disposition,
      dispositionStatus: 'done',
      status: 'completed',
      dispositionCompletedAt: now,
      ...(followUpAt ? { followUpAt } : {}),
    };
    const sessionMask = ['disposition', 'dispositionStatus', 'status', 'dispositionCompletedAt'];
    if (followUpAt) sessionMask.push('followUpAt');

    const auditFields = {
      code,
      note,
      followUpAt: followUpAt || '',
      by: byName,
      byName,
      at: now,
      previousCode,
      source,
    };

    await commitWrites([
      { path: `conversations/${sessionId}`, fields: sessionFields, mask: sessionMask },
      { path: `conversations/${sessionId}/dispositions/${auditId}`, fields: auditFields },
    ]);

    return res.status(200).json({ ok: true, status: 'completed', disposition, auditId, source });
  } catch (err) {
    console.error('[staff-disposition] error:', err?.message || err);
    return res.status(500).json({ ok: false, error: 'server_error', detail: String(err?.message || err) });
  }
}
