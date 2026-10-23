// api/_analytics-core.js
// ÚNICA fuente de verdad para métricas/embudo del chatbot UniTEC.
// Lo consumen: /api/analytics (panel Mission Control), /api/daily-analytics (informe diario/semanal),
// /api/record-turn y /api/chat (escritura de etapa). Si un número del panel y del informe difieren,
// el bug está en un consumidor que no usa este módulo.
//
// Nota Vercel: los archivos con prefijo "_" dentro de api/ no se publican como ruta.

import { createRequire } from 'module';
const require_ = createRequire(import.meta.url);
const firebaseConfig = require_('../firebase-applet-config.json');

/** Proyecto de Firestore en uso (exportado para evitar repetir el require en cada endpoint). */
export const projectId = firebaseConfig.projectId;

/** Sesiones de diagnóstico/prueba creadas en desarrollo o en auditorías — se excluyen SIEMPRE. */
export const TEST_ID_RE = /^(diag|lat-test|analytics-verify|post-fix|warm-check|secret-verify|verify-|test-|review-|plan-|probe[-_])/i;
export const isTestSession = (id) => TEST_ID_RE.test(String(id || ''));

/** Orden del embudo. Cada sesión se contabiliza en la etapa MÁS ALTA que alcanzó. */
export const STEP_ORDER = ['load', 'greeted', 'name', 'phone', 'profession', 'menu', 'engaged'];

export const STEP_LABELS = {
  load: 'Sesión creada (widget abierto)',
  greeted: 'El bot guardó su saludo',
  name: 'El usuario escribió (nombre capturado)',
  phone: 'El usuario dejó su teléfono',
  profession: 'El usuario completó su perfil',
  menu: 'Llegó al menú principal',
  engaged: 'Conversación real con el asistente',
};

/** Índice de una etapa para comparar "hasta dónde llegó". -1 si es desconocida. */
export const stepIndex = (step) => STEP_ORDER.indexOf(String(step || ''));

/**
 * Etapa alcanzada por una sesión.
 * Prioriza el campo explícito `funnelStep` (escrito por el servidor en cada turno).
 * Si no existe, deduce por contadores (compatibilidad con datos históricos).
 */
export function sessionStep(s) {
  const explicit = s.funnelStep || '';
  if (STEP_ORDER.includes(explicit)) return explicit;
  const um = Number(s.analytics?.userMessageCount || 0);
  const mc = Number(s.analytics?.messageCount || 0);
  if (um > 0) return 'engaged';
  if (mc > 0) return 'greeted';
  return 'load';
}

/**
 * Embudo completo. `reached[k]` = sesiones que llegaron AL MENOS a la etapa k
 * (monótono decreciente: cada etapa posterior es un subconjunto de la anterior).
 */
export function funnel(sessions) {
  const real = (sessions || []).filter((s) => !isTestSession(s.id));
  const total = real.length;

  const stoppedAt = {};
  STEP_ORDER.forEach((k) => { stoppedAt[k] = 0; });
  real.forEach((s) => {
    const step = sessionStep(s);
    stoppedAt[step] = (stoppedAt[step] || 0) + 1;
  });

  const reached = {};
  let running = total;
  STEP_ORDER.forEach((k, i) => {
    if (i === 0) { reached[k] = total; return; }
    running -= stoppedAt[STEP_ORDER[i - 1]] || 0;
    reached[k] = Math.max(0, running);
  });

  const steps = STEP_ORDER.map((k, i) => ({
    step: k,
    label: STEP_LABELS[k],
    reached: reached[k],
    pctOfTotal: total > 0 ? Number(((reached[k] / total) * 100).toFixed(2)) : 0,
    droppedBefore: i === 0 ? 0 : Math.max(0, reached[STEP_ORDER[i - 1]] - reached[k]),
    stoppedHere: i === 0 ? 0 : (stoppedAt[STEP_ORDER[i - 1]] || 0),
  }));

  return {
    total,
    testsExcluded: (sessions || []).length - total,
    steps,
    reached,
    // Etapas de negocio que el cliente pregunta explícitamente
    wroteSomething: reached.name || 0,        // iniciaron conversación
    partialOnboarding: (reached.phone || 0),  // interactuaron parcialmente
    completedOnboarding: reached.profession || 0,
    reachedMenu: reached.menu || 0,
    realConversations: (reached.engaged || 0),
    realInteractions: real.filter((s) => Number(s.analytics?.userMessageCount || 0) > 0).length,
    greetingOnly: real.filter((s) => Number(s.analytics?.messageCount || 0) > 0 && !Number(s.analytics?.userMessageCount || 0)).length,
    noMessage: real.filter((s) => !Number(s.analytics?.messageCount || 0)).length,
    contactsCaptured: real.filter((s) => s.customerPhone || s.extractedData?.phone).length,
  };
}

/** Documento REST de Firestore -> objeto plano de sesión (camelCase). */
export function parseFirestoreDoc(doc) {
  const fields = doc.fields || {};

  const parseMap = (mapField) => {
    if (!mapField?.mapValue?.fields) return {};
    const result = {};
    for (const [key, val] of Object.entries(mapField.mapValue.fields)) {
      result[key] = val.stringValue ?? val.integerValue ?? val.doubleValue ?? val.booleanValue ?? '';
    }
    return result;
  };

  const topics = fields.topics?.arrayValue?.values?.map((v) => v.stringValue).filter(Boolean) || [];

  return {
    id: fields.id?.stringValue || doc.name.split('/').pop(),
    brandId: fields.brandId?.stringValue || 'unitec',
    status: fields.status?.stringValue || 'active',
    source: fields.source?.stringValue || 'web',
    language: fields.language?.stringValue || 'es',
    createdAt: fields.createdAt?.stringValue || new Date().toISOString(),
    lastUpdated: fields.lastUpdated?.stringValue || new Date().toISOString(),
    firstUserMessageAt: fields.firstUserMessageAt?.stringValue || null,
    flowStage: fields.flowStage?.stringValue || 'greeted',
    funnelStep: fields.funnelStep?.stringValue || '',
    customerName: fields.customerName?.stringValue || '',
    customerPhone: fields.customerPhone?.stringValue || '',
    customerEmail: fields.customerEmail?.stringValue || '',
    lastMessage: fields.lastMessage?.stringValue || '',
    intentCategory: fields.intentCategory?.stringValue || '',
    sentimentScore: parseFloat(fields.sentimentScore?.doubleValue ?? fields.sentimentScore?.integerValue ?? '0'),
    duration: parseInt(fields.duration?.integerValue ?? fields.duration?.doubleValue ?? '0', 10),
    uiInteractions: parseInt(fields.uiInteractions?.integerValue ?? '0', 10),
    country: fields.country?.stringValue || '',
    city: fields.city?.stringValue || '',
    campaign: fields.campaign?.stringValue || '',
    topics,
    extractedData: parseMap(fields.extractedData),
    analytics: (() => {
      const af = fields.analytics?.mapValue?.fields || {};
      return {
        messageCount: parseInt(af.messageCount?.integerValue ?? af.messageCount?.doubleValue ?? '0', 10),
        userMessageCount: parseInt(af.userMessageCount?.integerValue ?? af.userMessageCount?.doubleValue ?? '0', 10),
        avgResponseTime: parseFloat(af.avgResponseTime?.doubleValue ?? af.avgResponseTime?.integerValue ?? '0'),
        escalationCount: parseInt(af.escalationCount?.integerValue ?? '0', 10),
        staffInteractions: parseInt(af.staffInteractions?.integerValue ?? '0', 10),
        productMentions: af.productMentions?.arrayValue?.values?.map((v) => v.stringValue).filter(Boolean) || [],
      };
    })(),
  };
}

/** Token anónimo de Firestore (cacheado ~1h). */
let cachedIdToken = { token: '', exp: 0 };
export async function getFirestoreToken() {
  if (cachedIdToken.token && Date.now() < cachedIdToken.exp) return cachedIdToken.token;
  const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  if (!authRes.ok) return null;
  const data = await authRes.json();
  cachedIdToken = { token: data.idToken, exp: Date.now() + (parseInt(data.expiresIn || '3600', 10) - 300) * 1000 };
  return data.idToken;
}

/** Lee TODAS las sesiones de Firestore (paginado). */
export async function listAllSessions(idToken, maxDocs = 20000) {
  const projectId = firebaseConfig.projectId;
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  const auth = { Authorization: `Bearer ${idToken}` };
  const out = [];
  let pageToken = '';
  while (out.length < maxDocs) {
    const url = `${base}/conversations?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await fetch(url, { headers: auth });
    if (!res.ok) break;
    const data = await res.json();
    (data.documents || []).forEach((d) => out.push(parseFirestoreDoc(d)));
    pageToken = data.nextPageToken || '';
    if (!pageToken) break;
  }
  return out;
}

/** Fecha en hora Bogotá (UTC-5) como 'YYYY-MM-DD' — el cliente reporta en Bogotá, no UTC. */
export function bogotaDayKey(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

/** Filtra sesiones por rango de días Bogotá (inclusive). */
export function filterByBogotaRange(sessions, fromDay, toDay) {
  return sessions.filter((s) => {
    const key = bogotaDayKey(s.createdAt);
    if (!key) return false;
    if (fromDay && key < fromDay) return false;
    if (toDay && key > toDay) return false;
    return true;
  });
}
