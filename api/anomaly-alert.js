import { createRequire } from 'module';
import { sendTelegramAlert, escapeHtml } from './telegram-send.js';

const require_ = createRequire(import.meta.url);
const firebaseConfig = require_('../firebase-applet-config.json');

const recent = new Map();
const DEDUPE_MS = 10 * 60 * 1000;

function sanitize(detail) {
  return String(detail || '')
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-***')
    .replace(/AIza[A-Za-z0-9_-]{8,}/g, 'AIza***')
    .replace(/xai-[A-Za-z0-9_-]{8,}/g, 'xai-***')
    .slice(0, 500);
}

function bogotaNow() {
  return new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', hour12: false });
}

async function remember(code, detail) {
  try {
    const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true }),
    });
    if (!authRes.ok) return;
    const { idToken } = await authRes.json();
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/config/main?updateMask.fieldPaths=recentAnomaly&updateMask.fieldPaths=recentAnomalyAt`;
    const payload = JSON.stringify({ code, detail, at: new Date().toISOString() });
    await fetch(url, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          recentAnomaly: { stringValue: payload },
          recentAnomalyAt: { stringValue: new Date().toISOString() },
        },
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    console.warn('remember anomaly failed:', e?.message);
  }
}

export async function alertAnomaly(code, detail, sessionId = '') {
  const key = String(code || 'ANOMALIA');
  const now = Date.now();
  const last = recent.get(key) || 0;
  if (now - last < DEDUPE_MS) return { sent: false, deduped: true };
  recent.set(key, now);

  const safe = sanitize(detail);
  const previous = await readRecent().catch(() => null);
  if (previous?.code === key && previous?.at) {
    const age = now - new Date(previous.at).getTime();
    if (age >= 0 && age < DEDUPE_MS) return { sent: false, deduped: true };
  }

  const text =
    `<b>ALERTA DEL ASISTENTE</b>\n\n` +
    `<b>Qué pasó:</b> ${escapeHtml(key)}\n` +
    `<b>Detalle:</b> ${escapeHtml(safe || 'sin detalle')}\n` +
    (sessionId ? `<b>Sesión:</b> ${escapeHtml(String(sessionId).slice(0, 80))}\n` : '') +
    `<b>Hora (COL):</b> ${escapeHtml(bogotaNow())}\n\n` +
    `Revisar antes de que el cliente se quede sin respuesta.`;

  const telegram = await sendTelegramAlert(text).catch((e) => ({ sent: false, error: e?.message }));
  await remember(key, safe);
  return { sent: !!telegram?.sent, telegram };
}

async function readRecent() {
  const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  if (!authRes.ok) return null;
  const { idToken } = await authRes.json();
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/config/main`;
  const docRes = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!docRes.ok) return null;
  const doc = await docRes.json();
  const raw = doc?.fields?.recentAnomaly?.stringValue || '';
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
