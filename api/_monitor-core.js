// api/_monitor-core.js — lógica compartida del monitor del chatbot UniTEC.
// Prefijo "_" => Vercel NO lo publica como ruta.
//
// Lo consumen:
//   · /api/chatbot-watch        (cron cada 2 h: sondas + reporte a Nancy)
//   · /api/mission-control-export (GET con token: KPIs + salud + integridad, sin PII)
//
// Reglas de diseño:
//  · Solo LEE. La única escritura la hace chatbot-watch (config/main.monitor) y notify-escalation
//    (config/main.escalationHealth). Nada de esto toca sesiones ni mensajes de clientes.
//  · Las sesiones de prueba del monitor usan el prefijo `test-monitor-`, que coincide con el
//    TEST_ID_RE de _analytics-core y de staff-sla-sweep: no contaminan embudo, informe ni SLA.

import { createRequire } from 'module';
import { getToken, getDoc, setDoc, fromValue } from './_firestore-rest.js';
import { funnel, STEP_ORDER, STEP_LABELS } from './_analytics-core.js';

const require_ = createRequire(import.meta.url);
const firebaseConfig = require_('../firebase-applet-config.json');

const PROJECT = firebaseConfig.projectId;
const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
export const BOGOTA = 'America/Bogota';
export const TEST_PREFIX = 'test-monitor-';
export const isTestSession = (id) => String(id || '').startsWith(TEST_PREFIX);

/** Ahora en Bogotá como objeto {iso, dayKey, hm, hour}. */
export function bogotaNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BOGOTA, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date).reduce((acc, p) => (acc[p.type] = p.value, acc), {});
  return {
    iso: date.toISOString(),
    dayKey: `${parts.year}-${parts.month}-${parts.day}`,
    hm: `${parts.hour}:${parts.minute}`,
    hour: Number(parts.hour),
  };
}

/** Doc crudo de Firestore -> objeto plano con TODOS los campos (sin whitelist). */
export function parseDoc(doc) {
  const fields = doc.fields || {};
  const out = { id: doc.name.split('/').pop() };
  for (const [k, v] of Object.entries(fields)) out[k] = fromValue(v);
  return out;
}

/**
 * Sesiones más recientes ordenadas por lastUpdated (desc).
 * Una sola consulta acotada: el cron de 2 h no debe recorrer 4.600 documentos.
 */
export async function recentSessions(limit = 500) {
  const token = await getToken();
  const res = await fetch(`${DOCS}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'conversations' }],
        orderBy: [{ field: { fieldPath: 'lastUpdated' }, direction: 'DESCENDING' }],
        limit,
      },
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`recentSessions: ${res.status}`);
  const rows = await res.json();
  return rows.filter((r) => r.document).map((r) => parseDoc(r.document)).filter((s) => s.id && !isTestSession(s.id));
}

const hoursAgo = (iso) => {
  const t = Date.parse(iso || '');
  return Number.isNaN(t) ? null : (Date.now() - t) / 3600000;
};

/**
 * Capa B — la solicitud de asesor se avisó y se atendió.
 * Se apoya en campos de `conversations` (legibles con la identidad de la app).
 * `escalations` NO se lee: la regla la bloquea (403 verificado) — su salud llega por el rollup
 * que escribe notify-escalation en config/main.escalationHealth.
 */
export async function auditEscalations(sessions, windowHours = 2) {
  const inWindow = (iso) => {
    const h = hoursAgo(iso);
    return h !== null && h <= windowHours;
  };
  const requested = sessions.filter((s) => Number(s.analytics?.escalationCount || 0) > 0 && inWindow(s.lastEscalationAt || s.lastUpdated || s.createdAt));
  const attended = requested.filter((s) => s.status === 'human_assigned' || s.status === 'completed' || s.staffInteractions > 0);
  // Una alerta sin entregar solo cuenta si es de la ventana: un fallo de hace una semana no puede
  // dejar el monitor en ROJO para siempre.
  const undelivered = sessions.filter((s) => inWindow(s.lastEscalationAt || s.lastUpdated)
    && (s.staffAlertPending === true
      || (Number(s.analytics?.escalationCount || 0) > 0 && Array.isArray(s.lastEscalationDelivered) && s.lastEscalationDelivered.length === 0)));
  const slaFailed = sessions.filter((s) => s.lastSlaDelivery && s.lastSlaDelivery.ok === false && inWindow(s.lastSlaDelivery.at));
  const stuck = sessions.filter((s) => s.status === 'human_requested' && (hoursAgo(s.lastUpdated) ?? 0) > 1);
  const noShow = sessions.filter((s) => s.staffNoShow === true && inWindow(s.lastUpdated));
  const unattendedClosed = sessions.filter((s) => (s.closedBy === 'unattended_staff' || s.closedBy === 'staff_inactive')
    && (hoursAgo(s.closedAt || s.lastUpdated) ?? 99) <= 24);

  const brief = (s) => ({
    id: s.id,
    status: s.status,
    minutos: Math.round(hoursAgo(s.lastUpdated) * 60) || 0,
    telefono: s.customerPhone ? 'sí' : 'no',
    ultimoMensaje: String(s.lastMessage || '').slice(0, 90),
  });

  return {
    windowHours,
    requested: requested.length,
    attended: attended.length,
    attendanceRate: requested.length ? Math.round((attended.length / requested.length) * 100) : 100,
    undelivered: undelivered.length,
    undeliveredSessions: undelivered.slice(0, 5).map(brief),
    slaFailed: slaFailed.length,
    slaFailedSessions: slaFailed.slice(0, 5).map((s) => ({ ...brief(s), error: String(s.lastSlaDelivery?.error || '').slice(0, 120), status: s.lastSlaDelivery?.status })),
    stuckRequested: stuck.length,
    stuckSessions: stuck.slice(0, 5).map(brief),
    staffNoShow: noShow.length,
    unattendedClosed24h: unattendedClosed.length,
  };
}

/** Capa C — integridad de precios: catálogo que SIRVE producción vs mapa que usa /api/chat. */
export async function priceIntegrity(sampleLimit = 5) {
  const num = (v) => {
    const digits = String(v || '').replace(/[^\d]/g, '');
    return digits ? Number(digits) : null;
  };
  // Importante: se compara contra el /products.json de producción, no contra el archivo del repo
  // ni contra .vercel/output (que puede ser un build viejo y producir falsos positivos).
  let catalog; let source = 'live';
  try {
    const r = await fetch(`${BASE_URL()}/products.json`, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    catalog = await r.json();
  } catch (err) {
    try {
      catalog = require_('../public/products.json');
      source = 'local (fetch de producción falló)';
    } catch (err2) {
      return { ok: false, checked: 0, mismatches: 0, unitMismatches: 0, error: `sin catálogo: ${err.message} / ${err2.message}` };
    }
  }
  let priceMap;
  try {
    priceMap = require_('../public/price-map.json');
  } catch (err) {
    return { ok: false, checked: 0, mismatches: 0, unitMismatches: 0, error: `sin price-map: ${err.message}` };
  }
  let checked = 0;
  const mismatches = [];
  const unitMismatches = [];
  for (const p of catalog) {
    const entry = priceMap?.[p.id];
    if (!entry) continue;
    const a = num(p.price);
    const b = num(entry.price_cop);
    if (a === null || b === null) continue;
    checked += 1;
    if (a !== b) {
      mismatches.push({ id: p.id, nombre: String(p.name).slice(0, 60), catalogo: p.price, bot: entry.price_cop });
    }
    const catUnit = String(p.unit || '').toLowerCase();
    const mapUnit = String(entry.unit || '').toLowerCase();
    if (catUnit && mapUnit && !catUnit.includes(mapUnit) && !mapUnit.includes(catUnit)) {
      unitMismatches.push({ id: p.id, nombre: String(p.name).slice(0, 60), catalogo: p.unit, bot: entry.unit });
    }
  }
  return {
    ok: mismatches.length === 0 && unitMismatches.length === 0,
    source,
    checked,
    mismatches: mismatches.length,
    examples: mismatches.slice(0, sampleLimit),
    unitMismatches: unitMismatches.length,
    unitExamples: unitMismatches.slice(0, sampleLimit),
  };
}

/**
 * Capa C — widget. Modo rápido (por defecto) para no gastar 10 s escaneando chunks del sitio:
 * comprueba que el embed carga y que es enmarcable, y busca la marca del widget en el HTML.
 * `full: true` usa el chequeo completo de /api/widget-status (solo para corridas manuales).
 */
export async function widgetHealth({ full = false } = {}) {
  if (full) {
    try {
      const { checkWidget } = await import('./widget-status.js');
      const r = await checkWidget();
      return { ok: !!r.ok, full: true, problems: r.problems || [], checks: r.checks };
    } catch (err) {
      return { ok: false, full: true, problems: [`checkWidget falló: ${err?.message || err}`] };
    }
  }
  const EMBED = `${BASE_URL()}/?embed=true&brandId=unitec`;
  const SITE = 'https://www.unitecusadesign.com/';
  const [embed, site] = await Promise.allSettled([
    fetch(EMBED, { signal: AbortSignal.timeout(7000) }),
    fetch(SITE, { signal: AbortSignal.timeout(7000), headers: { 'User-Agent': 'UniTEC-widget-watch' } }),
  ]);
  const problems = [];
  const checks = {};
  try {
    const r = embed.status === 'fulfilled' ? embed.value : null;
    if (!r || !r.ok) throw new Error(r ? `HTTP ${r.status}` : 'sin respuesta');
    const frame = (r.headers.get('x-frame-options') || '').toLowerCase();
    const csp = (r.headers.get('content-security-policy') || '').toLowerCase();
    checks.embedLoads = true;
    checks.embedFrameable = frame !== 'deny' && frame !== 'sameorigin';
    checks.cspBlocksFrame = /frame-ancestors[^;]*'none'/.test(csp);
    if (!checks.embedFrameable) problems.push('el iframe está bloqueado (x-frame-options)');
    if (checks.cspBlocksFrame) problems.push('CSP frame-ancestors bloquea el embed');
  } catch (err) {
    checks.embedLoads = false;
    problems.push(`embed no responde: ${err.message}`);
  }
  try {
    const s = site.status === 'fulfilled' ? site.value : null;
    if (!s || !s.ok) throw new Error(s ? `HTTP ${s.status}` : 'sin respuesta');
    const html = await s.text();
    checks.websiteUp = true;
    // En modo rápido solo se puede confirmar si el HTML menciona el widget; si no aparece,
    // queda como "no verificable" y NO tumba el reporte (el escaneo de chunks está en full).
    checks.embedSnippet = /unitec-front-desk|unitec-chatbot/i.test(html);
    if (!checks.embedSnippet) checks.embedSnippetVerifiable = false;
  } catch (err) {
    checks.websiteUp = false;
    problems.push(`sitio no responde: ${err.message}`);
  }
  return { ok: problems.length === 0, fast: true, problems, checks };
}

/** Salud REAL de los canales de alerta, consultada en vivo (no del historial de escalaciones). */
export async function channelHealth() {
  const out = {
    telegram: { ok: false, configured: false },
    email: { ok: false, configured: false },
    sms: { ok: false, configured: false },
  };
  // Telegram: token + chat (env o config/main)
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN || '';
    const chat = process.env.TELEGRAM_CHAT_ID || '';
    let hasToken = !!token;
    let hasChat = !!chat;
    if (!hasToken || !hasChat) {
      const doc = await getDoc('config/main').catch(() => null);
      hasToken = hasToken || !!doc?.fields?.telegramBotToken;
      hasChat = hasChat || !!doc?.fields?.telegramChatId;
    }
    out.telegram = { ok: hasToken && hasChat, configured: hasToken && hasChat, error: hasToken && hasChat ? '' : 'token o chat sin configurar' };
  } catch (err) {
    out.telegram = { ok: false, configured: false, error: String(err?.message || err) };
  }
  // Email: una llamada de lectura a Resend (no envía nada)
  const key = String(process.env.RESEND_API_KEY || process.env.RESEND_KEY || '').trim().replace(/^["']|["']$/g, '');
  const m = key.match(/re_[A-Za-z0-9_-]+/);
  const resendKey = m ? m[0] : '';
  if (!resendKey) {
    out.email = { ok: false, configured: false, error: 'RESEND_API_KEY vacía' };
  } else {
    try {
      const r = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${resendKey}` }, signal: AbortSignal.timeout(8000) });
      out.email = { ok: r.ok, configured: true, status: r.status };
    } catch (err) {
      out.email = { ok: false, configured: true, error: String(err?.message || err) };
    }
  }
  // SMS: credenciales + saldo real de Twilio
  const sid = process.env.TWILIO_ACCOUNT_SID || '';
  const tok = process.env.TWILIO_AUTH_TOKEN || '';
  const from = process.env.TWILIO_PHONE_NUMBER || '';
  if (!sid || !tok || !from) {
    out.sms = { ok: false, configured: false, error: 'falta SID, token o número en Vercel' };
  } else {
    try {
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Balance.json`, {
        headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${tok}`).toString('base64') },
        signal: AbortSignal.timeout(8000),
      });
      const j = await r.json().catch(() => ({}));
      out.sms = { ok: r.ok && Number(j.balance) > 0, configured: true, status: r.status, balance: j.balance ?? null };
    } catch (err) {
      out.sms = { ok: false, configured: true, error: String(err?.message || err) };
    }
  }
  return out;
}

/** Base pública del propio deploy (para sondear /api/chat y /api/system-health). */
export const BASE_URL = () => (process.env.MONITOR_BASE_URL || process.env.BASE_URL || 'https://unitec-front-desk.vercel.app').replace(/\/$/, '');

/** Sonda HTTP simple con timeout y latencia. */
export async function probe(path, { method = 'GET', body = null, timeoutMs = 12000 } = {}) {
  const started = Date.now();
  try {
    const res = await fetch(`${BASE_URL()}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) { /* HTML o vacío */ }
    return { ok: res.ok, status: res.status, ms: Date.now() - started, json, text: text.slice(0, 400) };
  } catch (err) {
    return { ok: false, status: 0, ms: Date.now() - started, json: null, error: String(err?.message || err) };
  }
}

/** Capa A — sondas de conversación. Aserciones deterministas, sin criterio de LLM. */
export const CHAT_PROBES = [
  {
    name: 'precio/stock',
    message: '¿Cuánto cuesta la lámina PVC blanca brillante H-01-I?',
    // El bot puede responder sin repetir el SKU ("El precio es de $27.000… mide 30cm x 5.95m").
    // Se exige precio CON contexto de producto (nombre, SKU o medidas), no que repita la referencia.
    assert: (t) => /\$\s?\d{1,3}[.,]?\d{3}|\d{2}\.000/.test(t) && /(H-?01|PVC|30\s*cm|5[.,]95)/i.test(t),
    assertLabel: 'da un precio con contexto del producto',
  },
  {
    name: 'especificaciones',
    message: '¿Qué medidas tiene la lámina H-01-I?',
    assert: (t) => /30\s*cm/i.test(t) && /(5[.,]95|595)/.test(t),
    assertLabel: 'cita 30 cm y 5.95 m',
  },
  {
    name: 'envíos',
    message: '¿Hacen envíos a Medellín?',
    assert: (t) => t.trim().length > 20,
    assertLabel: 'responde (no se queda vacío)',
  },
];

export async function runChatProbes() {
  const stamp = Date.now();
  // En paralelo: 3 sondas secuenciales sumaban ~5,5 s y acercaban la función al límite de ejecución.
  // Son sesiones distintas y el rate limit es 120/min por IP+sesión, así que no se pisan.
  const settled = await Promise.all(CHAT_PROBES.map(async (p, i) => {
    const r = await probe('/api/chat', {
      method: 'POST',
      body: { message: p.message, sessionId: `${TEST_PREFIX}${stamp}-${i}`, brandId: 'unitec', history: [] },
      timeoutMs: 20000,
    });
    const text = String(r.json?.text || '');
    const passed = r.ok && r.json?.success === true && r.json?.isFallback !== true && text.length > 0 && p.assert(text);
    return {
      name: p.name,
      passed,
      ms: r.ms,
      status: r.status,
      expected: p.assertLabel,
      reply: text.slice(0, 160),
      error: r.error || (passed ? '' : (r.json?.isFallback ? 'respuesta de fallback' : r.json?.lastError || 'aserción fallida')),
    };
  }));
  const results = settled;
  const passed = results.filter((r) => r.passed).length;
  const latencies = results.map((r) => r.ms).sort((a, b) => a - b);
  return {
    ok: passed === results.length,
    passed,
    total: results.length,
    latencies,
    p50: latencies.length ? latencies[Math.floor(latencies.length / 2)] : 0,
    max: latencies.length ? latencies[latencies.length - 1] : 0,
    results,
  };
}

/** Historial del monitor (bounded) en config/main.monitor — sin PII, legible. */
export async function readMonitorHistory() {
  try {
    const doc = await getDoc('config/main');
    return doc?.fields?.monitor || null;
  } catch (_) {
    return null;
  }
}

export async function writeMonitorHistory(entry, maxRuns = 24) {
  const current = await readMonitorHistory().catch(() => null);
  const runs = Array.isArray(current?.runs) ? current.runs.slice(0, maxRuns - 1) : [];
  const monitor = { last: entry, runs: [entry, ...runs], updatedAt: new Date().toISOString() };
  // Un fallo de red transitorio no debe perder la corrida: un reintento antes de rendirse.
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await setDoc('config/main', { monitor }, ['monitor']);
      return monitor;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
  throw lastErr;
}

/** Salud rollup de escalaciones (lo escribe notify-escalation). */
export async function readEscalationHealth() {
  try {
    const doc = await getDoc('config/main');
    return doc?.fields?.escalationHealth || null;
  } catch (_) {
    return null;
  }
}

/** Embudo + KPIs por marca para Mission Control (mismos números que el panel). */
export function brandSnapshot(sessions, windowHours = 24) {
  const cutoff = Date.now() - windowHours * 3600000;
  const recent = sessions.filter((s) => (Date.parse(s.createdAt || '') || 0) >= cutoff);
  const byBrand = {};
  for (const s of recent) {
    const b = s.brandId || 'unitec';
    const acc = byBrand[b] || (byBrand[b] = {
      sessions: 0, realConversations: 0, contacts: 0, escalations: 0,
      humanAssigned: 0, completed: 0, abandonedAtGreeting: 0, avgUserMessages: 0,
    });
    acc.sessions += 1;
    const um = Number(s.analytics?.userMessageCount || 0);
    if (um > 0) acc.realConversations += 1;
    if (s.customerPhone || s.extractedData?.phone) acc.contacts += 1;
    if (Number(s.analytics?.escalationCount || 0) > 0) acc.escalations += 1;
    if (s.status === 'human_assigned') acc.humanAssigned += 1;
    if (s.status === 'completed') acc.completed += 1;
    if (String(s.status || '').startsWith('abandoned_at_greeting')) acc.abandonedAtGreeting += 1;
    acc.avgUserMessages += um;
  }
  for (const acc of Object.values(byBrand)) {
    acc.avgUserMessages = acc.sessions ? Number((acc.avgUserMessages / acc.sessions).toFixed(1)) : 0;
  }
  return { windowHours, byBrand, funnel: funnel(sessions) };
}

export const STEP_META = { order: STEP_ORDER, labels: STEP_LABELS };
