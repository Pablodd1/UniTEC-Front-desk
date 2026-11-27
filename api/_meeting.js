// api/_meeting.js — Propuesta de reunión virtual (cotización/portafolio) + captura de teléfono.
//
// El prompt del bot (api/chat.js + constants.ts) propone agendar una presentación virtual
// cuando el cliente pide cotización/portafolio. Este módulo es la RED DE SEGURIDAD del
// servidor: detecta la aceptación con una regex CONSERVADORA (solo en contexto de cotización),
// dispara la alerta de Telegram por el MISMO raíl de notify-escalation.js (sin sender paralelo)
// y captura/valida el teléfono del cliente.
//
// Reglas duras:
//   · Nunca inventar ni "normalizar" un número que no sea claramente un teléfono.
//   · Nunca alertar sesiones de prueba/probe (mismo patrón que api/_alert.js TEST_SESSION_RE).
//   · La reunión NO es un escalamiento: no sube escalationCount ni pagina los 8 teléfonos.

import { getDoc, setDoc, bumpCounter, addDoc } from './_firestore-rest.js';
import { sendMeetingAlert } from './notify-escalation.js';

/** Pregunta EXACTA que el bot debe usar (mantener en sync con el prompt). */
export const MEETING_QUESTION =
  '¿Te gustaría agendar una presentación de nuestro portafolio y condiciones comerciales para distribuidores?';

/** Pregunta EXACTA en inglés para BUILDING INNOVATION (mantener en sync con el prompt BI). */
export const MEETING_QUESTION_EN =
  'Would you like to schedule a presentation of our portfolio and commercial terms for distributors?';

/** Sesiones de prueba/probe — mismas que api/_alert.js y api/anomaly-alert.js. */
export const TEST_SESSION_RE = /^(diag|lat-test|verify|warm-check|secret-verify|post-fix|analytics-verify|sweep|abandon-test|staff-test|rules-probe|test[-_]|probe[-_]|monitor)/;

// ── Aceptación afirmativa (conservadora) ─────────────────────────────────────
// Palabras/frases de aceptación del cliente. Se evalúa SOLO en contexto de cotización
// (ver isQuoteContext). Las hedge/negaciones invierten la aceptación ("sí, pero...").
const ACCEPT_WORDS = [
  /\bclaro\b/,
  /\bme interesa\b/,
  /\bagend/, // agendar / agendemos / agéndala / agendar la reunión
  /\bperfecto\b/,
  /\bde acuerdo\b/,
  /\b(?:yes|sure|ok|okay|dale|listo|por supuesto)\b/,
];

// "sí" como aceptación: mensaje completo, seguido de coma (afirmación con continuación) o de
// una continuación afirmativa. Así NO se confunde con el condicional "si" ("si me das el precio…",
// "si tienes stock") que rara vez lleva coma justo después.
const isSiAffirm = (t) => {
  if (/^\s*s[ií]\s*[,.!]?\s*$/.test(t)) return true; // "sí", "si.", "sí!"
  if (/\bs[ií]\s*[,!]/.test(t)) return true; // "sí, ..." / "sí! ..." (con continuación)
  return /\bs[ií]\s*[,.!]?\s*(gracias|claro|me interesa|perfecto|dale|listo|de acuerdo|agend|por supuesto|ya|bueno)\b/.test(t);
};

// "cuándo/cuando" solo cuenta si es claramente sobre agendar (no "¿cuándo está disponible?").
const SCHEDULE_WORDS = /agend|reuni[oó]n|presentaci[oó]n|podr[ií]amos|ser[ií]a|hablamos|nos vemos/;
const NON_SCHEDULE = /disponib|stock|env[ií]o|entrega|precio|cu[aá]nto|vale|d[oó]nde|ubicaci[oó]n/;
const isWhenAccept = (t) => {
  if (!/\bcu[aá]ndo\b/.test(t)) return false;
  if (SCHEDULE_WORDS.test(t)) return true;
  if (t.length <= 30 && !NON_SCHEDULE.test(t)) return true; // "¿cuándo?", "¿cuándo sería?"
  return false;
};

// ── Aceptación afirmativa EN INGLÉS (BUILDING INNOVATION) ─────────────────────
// Palabras/frases de aceptación en inglés. Mismas reglas: corta, en contexto de
// cotización, y las hedge/negaciones invierten la aceptación ("sure, but not now").
const ACCEPT_WORDS_EN = [
  /\bsounds good\b/,
  /\bi(?:'m|\s+am)\s+interested\b/,
  /\blet(?:'s| us)?\s+schedule\b/,
  /\bschedule it\b/,
  /\bwhen can we\b/,
  /\bof course\b/,
  /\babsolutely\b/,
  /\byes\b/,
  /\bsure\b/,
];

const EN_HEDGES = [
  /\bbut\b/,
  /\bnot\b/,
  /\bno\b/,
  /\blater\b/,
  /\bno thanks\b/,
  /\bnot interested\b/,
  /\bnot now\b/,
];

/** Aceptación en inglés: hedge primero, luego palabras afirmativas. */
function detectMeetingAcceptanceEn(t) {
  if (EN_HEDGES.some((re) => re.test(t))) return false;
  return ACCEPT_WORDS_EN.some((re) => re.test(t));
}

/** Detección conservadora de aceptación de la reunión. Sin contexto de cotización, el caller NO la usa. */
export function detectMeetingAcceptance(text, brand = 'unitec') {
  const raw = String(text || '').trim();
  if (!raw || raw.length > 200) return false; // una aceptación es corta
  const t = raw.toLowerCase();

  if (brand === 'building') return detectMeetingAcceptanceEn(t);

  // Hedge/negaciones: "sí, pero…", "claro, no por ahora", "de acuerdo, luego".
  if (
    /\bpero\b/.test(t) ||
    /\bno\b/.test(t) ||
    /\bd[eé]spu[eé]s\b/.test(t) ||
    /\bluego\b/.test(t) ||
    /\botro d[ií]a\b/.test(t) ||
    /\bm[aá]s tarde\b/.test(t) ||
    /\bpor ahora\b/.test(t) ||
    /\bno gracias\b/.test(t)
  ) return false;

  if (isSiAffirm(t)) return true;
  if (isWhenAccept(t)) return true;
  return ACCEPT_WORDS.some((re) => re.test(t));
}

// ── Teléfono (Colombia +57 / 10 dígitos móvil / E.164 internacional) ────────
const digitsOnly = (s) => String(s).replace(/\D/g, '');

/**
 * Extrae un teléfono válido del mensaje o devuelve null.
 * Nunca devuelve un número que no sea claramente un teléfono.
 *   · E.164 explícito (+57 314 233 2147, +1 786 968 5783, …) — 10 a 15 dígitos.
 *   · BUILDING INNOVATION (brand === 'building'): US — 10 dígitos (NPA 2-9) o 1 + 10 sin '+'.
 *   · UNITEC (default): móvil colombiano sin prefijo (3XXXXXXXXX), fijo con indicativo
 *     (60[1-8] + 7 dígitos), o 57 + 10 dígitos sin '+'.
 */
export function extractPhone(text, brand = 'unitec') {
  if (!text) return null;
  const raw = String(text);
  const cands = raw.match(/(?:\+?[0-9][0-9\s().\-]{5,})/g) || [];
  const isBI = brand === 'building';
  for (const c of cands) {
    const d = digitsOnly(c);
    if (c.trim().startsWith('+')) {
      if (d.length >= 10 && d.length <= 15 && /^[1-9]/.test(d)) return '+' + d;
      continue;
    }
    if (isBI) {
      if (d.length === 11 && d.startsWith('1')) return '+' + d;      // 1 + 10 dígitos sin '+'
      if (d.length === 10 && /^[2-9][0-9]{9}$/.test(d)) return '+1' + d; // 10 dígitos US
      continue;
    }
    if (d.length === 10 && d[0] === '3') return '+57' + d;      // móvil colombiano
    if (d.length === 10 && /^60[1-8]/.test(d)) return '+57' + d; // fijo colombiano
    if (d.length === 12 && d.startsWith('57')) return '+' + d;  // 57 + 10 sin '+'
  }
  return null;
}

// Palabras que indican que el cliente está dando su teléfono (evita capturar cantidades
// como "3500000000 unidades" fuera del flujo de reunión). Incluye señales en español e inglés.
const PHONE_SIGNAL = /tel[eé]fono|n[uú]mero|numero|celular|cel\b|cell\b|whatsapp|whats|ll[aá]mame|ll[aá]mame al|cont[aá]ctame|contacto|es el \d|mi cel|comunicate|comunícate|escr[ií]beme|al \d|phone\b|number\b|call me|contact me|my number|my cell|reach me/i;

/** ¿Debe capturarse un teléfono detectado? Sí en el flujo de reunión o con señal explícita. */
export function shouldCapturePhone(text, fields) {
  return Boolean(fields?.meetingRequested || fields?.meetingStatus || PHONE_SIGNAL.test(String(text || '')));
}

// ── Contexto de cotización (reutiliza el mismo patrón que PRICE_INTENT_RE en api/chat.js) ──
const PRICE_INTENT_RE = /(precio|precios|vale|valor|costo|costar|cu[aá]nto|cuanto cuesta|cotiz|presupuesto|price|pricing|cost|how much|worth|quote|dollar|usd)/i;
const PORTFOLIO_CONTEXT_RE = /presentaci[oó]n de nuestro portafolio|condiciones comerciales|agendar una presentaci[oó]n|portafolio|presentation of our portfolio|commercial terms|schedule a (?:presentation|meeting)|portfolio/i;

function isQuoteContext(text, history, fields) {
  if (PRICE_INTENT_RE.test(text)) return true;
  const turns = Array.isArray(history) ? history.slice(-8) : [];
  for (const t of turns) {
    const s = String(t?.text || '');
    if (PRICE_INTENT_RE.test(s)) return true;
    if (PORTFOLIO_CONTEXT_RE.test(s)) return true;
  }
  if (fields?.meetingStatus || fields?.meetingProposedAt || fields?.escalationType === 'quote') return true;
  return false;
}

// Dedupe en memoria: dos mensajes seguidos ("sí", "claro") no deben alertar dos veces
// antes de que el flag meetingRequested se haya commitado a Firestore.
const recentMeeting = new Map();
const MEETING_DEDUPE_MS = 60 * 1000;
function meetingDeduped(sessionId) {
  const now = Date.now();
  const last = recentMeeting.get(sessionId) || 0;
  if (now - last < MEETING_DEDUPE_MS) return true;
  recentMeeting.set(sessionId, now);
  return false;
}

/**
 * Orquesta la propuesta de reunión + captura de teléfono. Sin I/O a menos que haya señal
 * (aceptación o teléfono), así que no añade latencia al turno normal. Nunca lanza.
 *
 * @returns {Promise<{action: string|null, why?: string}>}
 */
export async function runMeetingFlow({ sessionId, message, history = [], brand = 'unitec', parentHost = '' }) {
  if (!sessionId || TEST_SESSION_RE.test(String(sessionId))) return { action: null, why: 'test_session' };
  if (brand && brand !== 'unitec' && brand !== 'building') return { action: null, why: 'brand_not_supported' };

  const text = String(message || '').trim();
  if (!text) return { action: null, why: 'no_message' };

  const acceptance = detectMeetingAcceptance(text, brand);
  const phone = extractPhone(text, brand);
  if (!acceptance && !phone) return { action: null, why: 'no_signal' };

  // Leer la sesión UNA vez (solo cuando hay señal).
  let session = null;
  try {
    session = await getDoc(`conversations/${sessionId}`);
  } catch (e) {
    console.warn('[meeting] session read failed:', e?.message);
    return { action: null, why: 'session_read_failed' };
  }
  const f = session?.fields || {};
  const nowIso = new Date().toISOString();
  const name = f.customerName || f.extractedData?.name || '';
  let knownPhone = f.customerPhone || f.extractedData?.phone || '';

  // ── Captura de teléfono: solo si es claramente un teléfono. Fuera del flujo de reunión
  // se exige una señal explícita (teléfono/número/celular/whatsapp…), para no capturar
  // cantidades ni referencias como si fueran teléfonos. No hace return: si el cliente aceptó
  // Y dio el teléfono en el mismo mensaje, la aceptación se procesa igual (con el teléfono ya).
  let capturedPhone = null;
  if (phone && !knownPhone && shouldCapturePhone(text, f)) {
    try {
      await setDoc(
        `conversations/${sessionId}`,
        { customerPhone: phone, extractedData: { ...(f.extractedData || {}), phone }, lastUpdated: nowIso },
        ['customerPhone', 'extractedData', 'lastUpdated']
      );
      await bumpCounter(`conversations/${sessionId}`, 'analytics.phoneCaptured');
      capturedPhone = phone;
      knownPhone = phone; // la alerta de aceptación debe incluir el teléfono recién capturado
    } catch (e) {
      console.warn('[meeting] phone persist failed:', e?.message);
    }
  }

  // ── Aceptación de la reunión (solo en contexto de cotización y una sola vez) ──
  if (acceptance && !f.meetingRequested && !f.meetingStatus) {
    if (!isQuoteContext(text, history, f)) return { action: null, why: 'not_quote_context' };
    if (meetingDeduped(sessionId)) return { action: null, why: 'deduped' };

    try {
      await setDoc(
        `conversations/${sessionId}`,
        { meetingRequested: true, meetingRequestedAt: nowIso, meetingStatus: 'requested', lastUpdated: nowIso },
        ['meetingRequested', 'meetingRequestedAt', 'meetingStatus', 'lastUpdated']
      );
      await bumpCounter(`conversations/${sessionId}`, 'analytics.meetingRequested');
    } catch (e) {
      console.warn('[meeting] meeting persist failed:', e?.message);
    }

    // Alerta de Telegram por el raíl existente (notify-escalation.js sendTelegram).
    let telegram = null;
    try {
      telegram = await sendMeetingAlert({
        brand,
        sessionId,
        customerName: name,
        customerPhone: knownPhone || '',
        message: text,
        timestamp: nowIso,
      });
    } catch (e) {
      console.warn('[meeting] alert failed:', e?.message);
    }

    // Auditoría append-only (misma cultura que `escalations`): una alerta sin rastro no existió.
    try {
      await addDoc('meetings', {
        sessionId,
        brand,
        customerName: name,
        customerPhone: knownPhone || '',
        acceptedText: text.slice(0, 300),
        meetingStatus: 'requested',
        createdAt: nowIso,
        telegramDelivered: !!telegram?.success,
      });
    } catch (_) { /* audit best-effort */ }

    return { action: 'meeting_requested', telegram, phoneCaptured: capturedPhone };
  }

  if (capturedPhone) return { action: 'phone_captured', phone: capturedPhone };
  return { action: null, why: 'noop' };
}
