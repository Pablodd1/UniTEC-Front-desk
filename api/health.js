// /api/health.js — Context/memory watchdog for the UniTEC Front Desk bot.
// Purpose: detect BEFORE the AI context "memory" fills up and slows/stops the bot,
// surface live metrics on the dashboard (/api/health), and fire the existing
// Telegram + Email + WhatsApp alert stack at safety thresholds.
//
// This is the "advance warning" system: it alerts when a conversation's context
// approaches the model limit, so staff can act before the bot degrades.

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const firebaseConfig = require('../firebase-applet-config.json');

// ---- which alert channels require env keys ----
const needs = {
  telegram: () => !!(process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_CHAT_ID),
  email: () => !!(process.env.RESEND_API_KEY || process.env.RESEND_KEY || process.env.VITE_RESEND_API_KEY),
  whatsapp: () => !!(process.env.SENT_DM_API_KEY || process.env.TWILIO_ACCOUNT_SID),
};

// ---- model context budget (Gemini-family used here; 1M tokens target) ----
export const CONTEXT_BUDGET = 1_000_000; // max tokens
export const WARN_AT = 0.62;   // 62% of budget -> warning
export const CRIT_AT = 0.82;   // 82% of budget -> critical

// rough token estimator (safe: ~4 chars/token for the languages used)
export const estimateTokens = (text = '') => Math.ceil((text || '').length / 4);

// ---- in-memory rolling stats (per serverless instance; adequate for alerting) ----
const state = {
  calls: 0,
  maxContextTokens: 0,
  maxContextChars: 0,
  peakConversationLength: 0,   // most messages seen in one conversation
  avgLatencyMs: 0,
  recentLatencyMs: 0,
  lastAlertLevel: '',          // '' | 'warn' | 'crit'
  warnings: 0,
  criticals: 0,
};

function recordCall({ contextChars, contextTokens, conversationMsgs, latencyMs }) {
  state.calls += 1;
  if (contextTokens > state.maxContextTokens) state.maxContextTokens = contextTokens;
  if (contextChars > state.maxContextChars) state.maxContextChars = contextChars;
  if (conversationMsgs > state.peakConversationLength) state.peakConversationLength = conversationMsgs;
  state.recentLatencyMs = latencyMs;
  state.avgLatencyMs = state.calls === 1
    ? latencyMs
    : state.avgLatencyMs + (latencyMs - state.avgLatencyMs) / Math.min(state.calls, 100);
}

export function getHealth() {
  const pct = Math.min(1, state.maxContextTokens / CONTEXT_BUDGET);
  const level = pct >= CRIT_AT ? 'critical' : pct >= WARN_AT ? 'warning' : pct >= 0.4 ? 'elevated' : 'healthy';
  return {
    healthy: level === 'healthy' || level === 'elevated',
    level,
    contextBudgetTokens: CONTEXT_BUDGET,
    usedTokens: state.maxContextTokens,
    utilizedPct: Math.round(pct * 1000) / 10,
    peakConversationLength: state.peakConversationLength,
    calls: state.calls,
    avgLatencyMs: Math.round(state.avgLatencyMs),
    recentLatencyMs: state.recentLatencyMs,
    rates: { warn: state.warnings, crit: state.criticals },
    timestamp: new Date().toISOString(),
  };
}

// Multi-channel alert (reuses the proven Firestore-telegram + escalation channels)
async function fireAlert(severity, payload, meta) {
  const pct = Math.round((payload.contextTokens / CONTEXT_BUDGET) * 1000) / 10;
  const text = (
    `<b>🧠 MEMORIA DEL ASISTENTE ${severity === 'critical' ? 'CRÍTICA' : 'EN ALERTA'}</b>\n\n` +
    `<b>El contexto de la conversación está al ${pct}%</b> de la memoria del modelo.\n` +
    `<b>Tokens:</b> ${payload.contextTokens.toLocaleString('es-CO')}\n` +
    `<b>Mensajes en esta conversación:</b> ${payload.conversationMsgs}\n` +
    `<b>Marca:</b> ${meta.brand || 'desconocida'}\n` +
    `<b>Hora:</b> ${new Date().toISOString()}\n\n` +
    (severity === 'critical'
      ? `⚠️ El bot puede <b>detenerse o volverse lento</b> pronto. Cierre o reasigne esta conversación, o pida al cliente que inicie de nuevo.`
      : `🔸 Actúe ahora: recorte el historial o reasigne antes de que se llene la memoria y el bot se ralentice.`)
  );

  const results = {};

  // Telegram (Firestore config + env fallback, same as notify-escalation)
  if (needs.telegram()) {
    const fsConfig = await getFirestoreConfig();
    let botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    let chatId = process.env.TELEGRAM_CHAT_ID || '';
    if (fsConfig.telegramBotToken?.stringValue) botToken = fsConfig.telegramBotToken.stringValue;
    if (fsConfig.telegramChatId?.stringValue) chatId = fsConfig.telegramChatId.stringValue;
    if (botToken && chatId) {
      const tokens = botToken.split(',').map(t => t.trim()).filter(Boolean);
      const chatIds = chatId.split(',').map(c => c.trim()).filter(Boolean);
      const tgRes = await Promise.allSettled(chatIds.map((cid, i) => {
        const tok = tokens[i] || tokens[0];
        if (!tok) return Promise.resolve({ ok: false });
        return fetch(`https://api.telegram.org/bot${tok}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: cid, text, parse_mode: 'HTML' }),
          signal: AbortSignal.timeout(8000),
        });
      }));
      results.telegram = tgRes.some(r => r.status === 'fulfilled' && r.value?.ok);
    }
  }

  // Email (Resend)
  if (needs.email()) {
    const apiKey = process.env.RESEND_API_KEY || process.env.RESEND_KEY || process.env.VITE_RESEND_API_KEY;
    const adminEmail = process.env.ADMIN_EMAIL || 'lidermarketingonline@espaciosimportados.com.co';
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          from: 'UniTEC AI Desk <onboarding@resend.dev>',
          to: [adminEmail],
          subject: `[${severity === 'critical' ? 'CRÍTICO' : 'ALERTA'}] Memoria del asistente UniTEC al ${pct}%`,
          html: `<h2>🧠 Memoria del asistente UniTEC — ${severity === 'critical' ? 'CRÍTICO' : 'ALERTA'}</h2><p>El contexto de la conversación está al <b>${pct}%</b> de la memoria del modelo.</p><p>Tokens: <b>${payload.contextTokens.toLocaleString('es-CO')}</b></p><p>Mensajes: <b>${payload.conversationMsgs}</b></p><p>Marca: ${meta.brand || 'desconocida'}</p><p>Hora: ${new Date().toISOString()}</p>`,
        }),
        signal: AbortSignal.timeout(8000),
      });
      results.email = r.ok;
    } catch { results.email = false; }
  }

  // SMS al teléfono del admin (Twilio). Antes usaba Sent.dm; ahora hay un solo proveedor.
  // La clave `results.whatsapp` se conserva por compatibilidad con quien lea este objeto.
  if (needs.whatsapp()) {
    const adminPhone = process.env.ADMIN_PHONE || '+573****2147';
    const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    const authToken = process.env.TWILIO_AUTH_TOKEN || '';
    const from = process.env.TWILIO_PHONE_NUMBER || '';
    if (accountSid && authToken && from) {
      try {
        const form = new URLSearchParams();
        form.append('To', adminPhone);
        form.append('From', from);
        form.append('Body', `🧠 Memoria del asistente UniTEC al ${pct}% (${severity === 'critical' ? 'crítico' : 'alerta'}). La conversación se está llenando y el bot puede volverse lento. Tokens ${payload.contextTokens.toLocaleString('es-CO')} — Mensajes ${payload.conversationMsgs}`);
        const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
          method: 'POST',
          headers: {
            Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: form,
          signal: AbortSignal.timeout(8000),
        });
        results.whatsapp = r.ok;
      } catch { results.whatsapp = false; }
    }
  }

  return { text, results };
}

// throttled per-window + per-severity so we never spam alerts
let lastFiredAt = { warn: 0, crit: 0 };
const COOLDOWN_MS = { warn: 6 * 60 * 60 * 1000, crit: 60 * 60 * 1000 }; // warn/hr, crit/hr

export async function inspectConversation({ history = [], newMessage = '', brand = 'unknown' }) {
  const conversationMsgs = Array.isArray(history) ? history.length + (newMessage ? 1 : 0) : 1;
  const contextChars =
    (Array.isArray(history) ? history.reduce((s, h) => s + (h.text || h.content || '').length, 0) : 0) +
    (newMessage || '').length;
  const contextTokens = estimateTokens(String(contextChars));

  recordCall({ contextChars, contextTokens, conversationMsgs, latencyMs: 0 });

  const pct = contextTokens / CONTEXT_BUDGET;
  let level = '';
  if (pct >= CRIT_AT) level = 'critical';
  else if (pct >= WARN_AT) level = 'warn';

  // only alert on a genuine advance past a threshold, with cooldown
  if (level === 'critical' && state.lastAlertLevel !== 'critical' && Date.now() - lastFiredAt.crit > COOLDOWN_MS.crit) {
    state.criticals += 1;
    state.lastAlertLevel = 'critical';
    lastFiredAt.crit = Date.now();
    return { level, fired: true, severity: 'critical', alert: await fireAlert('critical', { contextTokens, contextChars, conversationMsgs }, { brand }) };
  }
  if (level === 'warn' && state.lastAlertLevel !== 'warn' && state.lastAlertLevel !== 'critical' && Date.now() - lastFiredAt.warn > COOLDOWN_MS.warn) {
    state.warnings += 1;
    state.lastAlertLevel = 'warn';
    lastFiredAt.warn = Date.now();
    return { level, fired: true, severity: 'warn', alert: await fireAlert('warn', { contextTokens, contextChars, conversationMsgs }, { brand }) };
  }
  // allow escalate warn -> critical (already handled above)
  return { level, fired: false };
}

async function getFirestoreConfig() {
  try {
    const apiKey = firebaseConfig.apiKey;
    const projectId = firebaseConfig.projectId;
    const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true }),
    });
    if (!authRes.ok) return {};
    const { idToken } = await authRes.json();
    const configRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/config/main`,
      { headers: { Authorization: `Bearer ${idToken}` } }
    );
    if (!configRes.ok) return {};
    const data = await configRes.json();
    return data.fields || {};
  } catch { return {}; }
}

// ---- CORS (mirror existing endpoints) ----
function setCORS(res, req) {
  const ALLOWED = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  let origin = req.headers.origin || '';
  if (!origin && req.headers.referer) { try { origin = new URL(req.headers.referer).origin; } catch {} }
  if (ALLOWED.length > 0 && origin) {
    const ok = ALLOWED.some(a => {
      const ac = a.replace(/^https?:\/\//, '').toLowerCase();
      const oc = origin.replace(/^https?:\/\//, '').toLowerCase();
      return oc === ac || oc.endsWith('.' + ac);
    });
    if (!ok) { res.status(403).json({ error: 'Origin not allowed' }); return false; }
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else { res.setHeader('Access-Control-Allow-Origin', origin || '*'); }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return true;
}

export default async function handler(req, res) {
  if (!setCORS(res, req)) return;
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST' && req.url.includes('inspect')) {
    const { history = [], newMessage = '', brand = 'unknown' } = req.body || {};
    const out = await inspectConversation({ history, newMessage, brand });
    return res.status(200).json({ ok: true, ...out, health: getHealth() });
  }

  // GET /api/health or /api/ctx-health -> live dashboard/cron metrics
  return res.status(200).json({ ok: true, version: '2.1-styleguard', ...getHealth() });
}
