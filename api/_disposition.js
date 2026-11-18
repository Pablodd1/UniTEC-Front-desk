// api/_disposition.js — mandatory disposition (tipificación) shared helpers.
//
// Business rule (client): every conversation escalated as URGENT — the human-transfer alert that
// fires when the customer asks for a person — must be "tipificada" (given a disposition) by the
// advisor before it can be closed. Non-urgent human assignments (quote requests, generic contact)
// are NOT blocked. The taxonomy lives in Firestore `disposition_types` (seeded with the 12
// defaults below on first read); only admins may create/update/delete types.
//
// Underscore prefix => Vercel does not expose this file as an endpoint.

// ── 12 default codes + Spanish labels (exact, per client) ──────────────────
export const DISPOSITION_DEFAULTS = [
  { code: 'CONTACTO_EFECTIVO', label: 'Contacto efectivo' },
  { code: 'VENTA_EFECTIVA', label: 'Venta efectiva' },
  { code: 'VENTA_NO_EFECTIVA', label: 'Venta no efectiva' },
  { code: 'COTIZACION_ENVIADA', label: 'Cotización enviada' },
  { code: 'SEGUIMIENTO_PENDIENTE', label: 'Seguimiento pendiente' },
  { code: 'CLIENTE_NO_RESPONDE', label: 'Cliente no responde' },
  { code: 'ABANDONO_CONVERSACION', label: 'Abandono de conversación' },
  { code: 'CLIENTE_NO_INTERESADO', label: 'Cliente no interesado' },
  { code: 'FUERA_PERFIL', label: 'Cliente fuera del perfil comercial' },
  { code: 'FUERA_COBERTURA', label: 'Cliente fuera de cobertura' },
  { code: 'SOLICITUD_INFORMACION', label: 'Solicitud de información' },
  { code: 'RECLAMACION', label: 'Reclamación' },
];

export const DISPOSITION_CODES = DISPOSITION_DEFAULTS.map((d) => d.code);
export const DISPOSITION_LABELS = Object.fromEntries(DISPOSITION_DEFAULTS.map((d) => [d.code, d.label]));

/** Required extra fields per code. VENTA_EFECTIVA is state-only (no extra field). */
export const DISPOSITION_REQUIRED_FIELDS = {
  VENTA_EFECTIVA: [],
  SEGUIMIENTO_PENDIENTE: ['followUpAt'],
  VENTA_NO_EFECTIVA: ['note'],
  CLIENTE_NO_INTERESADO: ['note'],
  FUERA_COBERTURA: ['note'],
  RECLAMACION: ['note'],
};

export const VENTA_EFECTIVA_CODE = 'VENTA_EFECTIVA';
export const SEGUIMIENTO_PENDIENTE_CODE = 'SEGUIMIENTO_PENDIENTE';

export const DISPOSITION_STATUS = {
  DONE: 'done',
  LEGACY: 'legacy',
};

/** Valid code shape: uppercase letters + underscore (the 12 codes are single words/underscores). */
const CODE_RE = /^[A-Z][A-Z0-9_]{1,60}$/;

export const isValidDispositionCode = (code) => CODE_RE.test(String(code || ''));

/** Does this escalation force a disposition? The human-transfer alert (type 'staff') or an
 *  explicitly 'urgent' escalation. 'quote'/'abandon'/'contact'/'sla' do NOT force it. */
export function isDispositionRequiredEscalation(d) {
  if (!d) return false;
  if (String(d.type || '') === 'staff') return true;
  if (String(d.priority || '') === 'urgent') return true;
  return false;
}

/** Terminal disposition states that satisfy the "must be dispositioned" guard. */
export function isDispositionSatisfied(fields) {
  const s = String(fields?.dispositionStatus || '');
  return s === DISPOSITION_STATUS.DONE || s === DISPOSITION_STATUS.LEGACY;
}

/**
 * Guard shared by every endpoint that would set a terminal status on a session.
 * Returns { blocked: true, error, status } when the session REQUIRES a disposition but has none.
 * `fields` = the session's already-parsed fields object (from getDoc).
 */
export function dispositionGuard(fields) {
  if (fields?.dispositionRequired !== true) return { blocked: false };
  if (isDispositionSatisfied(fields)) return { blocked: false };
  return { blocked: true, status: 409, error: 'DISPOSITION_REQUIRED' };
}

/** Required-field validation against the taxonomy. Returns { ok:false, field } on failure. */
export function validateDispositionFields(code, payload) {
  const required = DISPOSITION_REQUIRED_FIELDS[code] || [];
  for (const f of required) {
    if (f === 'followUpAt') {
      const t = Date.parse(String(payload?.followUpAt || ''));
      if (!Number.isFinite(t)) return { ok: false, field: 'followUpAt', reason: 'followUpAt inválida (fecha requerida)' };
    } else {
      if (!String(payload?.[f] || '').trim()) return { ok: false, field: f, reason: `${f} es obligatorio para ${code}` };
    }
  }
  return { ok: true };
}

/** Admin auth: shared ADMIN_SECRET, sent as `Authorization: Bearer <secret>` (same as /api/gemini-key). */
export function verifyAdmin(req) {
  const secret = process.env.ADMIN_SECRET || '';
  if (!secret) return { ok: false, status: 503, error: 'admin_auth_not_configured' };
  const header = String(req?.headers?.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token || token !== secret) return { ok: false, status: 401, error: 'unauthorized' };
  return { ok: true };
}

/**
 * Disposition breakdown for analytics (counts per code, conversion rate, pending >24h).
 * `typed` = dispositionStatus 'done' with a code (non-legacy). `legacy` excluded from conversion.
 * conversionRate = VENTA_EFECTIVA / typed. pending24h = required but not yet dispositioned >24h.
 */
export function dispositionBreakdown(sessions) {
  const list = Array.isArray(sessions) ? sessions : [];
  const typed = list.filter((s) => s.dispositionStatus === 'done' && s.disposition?.code);
  const counts = {};
  for (const s of typed) {
    const c = String(s.disposition.code);
    counts[c] = (counts[c] || 0) + 1;
  }
  const typedCount = typed.length;
  const ventaEfectiva = counts[VENTA_EFECTIVA_CODE] || 0;
  const legacy = list.filter((s) => s.dispositionStatus === 'legacy').length;
  const conversionRate = typedCount > 0 ? Number(((ventaEfectiva / typedCount) * 100).toFixed(1)) : 0;
  const now = Date.now();
  const pending24h = list.filter((s) =>
    s.dispositionRequired === true &&
    !isDispositionSatisfied(s) &&
    s.dispositionRequiredAt &&
    now - Date.parse(s.dispositionRequiredAt) > 24 * 3600 * 1000
  ).length;
  return { typed: typedCount, legacy, ventaEfectiva, conversionRate, counts, pending24h };
}
