// api/chatbot-watch.js — monitor del chatbot UniTEC. Cron cada 2 h.
//
// Qué hace, en este orden:
//   A. Sondas reales de conversación contra /api/chat (precio, especificaciones, envíos).
//   B. Auditoría de solicitudes de asesor: se avisó, se atendió, quedó alguien esperando.
//   C. Integridad: widget embebido, precios catálogo-vs-bot, Gemini, canal de voz.
//   D. Reporte a Telegram (Nancy) + push a Mission Control + historial en config/main.monitor.
//
// Reglas:
//   · Solo escribe dos cosas: config/main.monitor (aquí) y nada más. No toca sesiones ni mensajes.
//   · Las sesiones de prueba usan `test-monitor-…`, excluidas del embudo, del informe y del SLA sweep.
//   · ?dryRun=true  → no envía Telegram, no escribe historial, no hace push a Mission Control.
//   · ?force=true   → ignora las horas de silencio (21:00–07:00 Bogotá).
//   · Protegido por CRON_SECRET (o SWEEP_KEY) cuando existe; acepta `Authorization: Bearer` (Vercel cron)
//     o `?key=`.
//
// Variables de entorno:
//   CRON_SECRET / SWEEP_KEY        protección del endpoint
//   NANCY_TELEGRAM_CHAT_ID         destinatario del reporte (coma-separado para varios)
//   MONITOR_TELEGRAM_CHAT_ID       respaldo si Nancy no está configurada
//   MC_INGEST_URL + MC_INGEST_TOKEN  push a Mission Control (opcional)
//   MONITOR_BASE_URL               base para las sondas (default: deploy de Vercel)

import {
  bogotaNow, recentSessions, auditEscalations, priceIntegrity, widgetHealth,
  runChatProbes, probe, readEscalationHealth, readMonitorHistory, writeMonitorHistory,
  brandSnapshot,
} from './_monitor-core.js';
import { sendTelegramTo, escapeHtml } from './telegram-send.js';
import { createRequire } from 'module';

const require_ = createRequire(import.meta.url);
const firebaseConfig = require_('../firebase-applet-config.json');

const QUIET_FROM = 21; // Bogotá
const QUIET_TO = 7;

function authorized(req) {
  const secret = process.env.CRON_SECRET || process.env.SWEEP_KEY || '';
  if (!secret) return true;
  const header = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
  const provided = header || String(req.query?.key || '');
  return provided === secret;
}

/** Destinatarios: Nancy primero, luego un respaldo explícito. Nunca el chat del equipo por defecto. */
async function resolveRecipients() {
  const nancy = String(process.env.NANCY_TELEGRAM_CHAT_ID || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (nancy.length) return { chatIds: nancy, via: 'NANCY_TELEGRAM_CHAT_ID' };
  const fallback = String(process.env.MONITOR_TELEGRAM_CHAT_ID || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (fallback.length) return { chatIds: fallback, via: 'MONITOR_TELEGRAM_CHAT_ID' };
  // Sin destinatario explícito NO se manda al chat del equipo: un monitor cada 2 h no debe
  // empezar a sonar en el grupo de 8 asesores sin que alguien lo haya pedido.
  return { chatIds: [], via: 'sin destinatario (configura NANCY_TELEGRAM_CHAT_ID)' };
}

function severityLabel(status) {
  return status === 'red' ? '🔴 ROJO' : status === 'yellow' ? '🟡 AMARILLO' : '🟢 VERDE';
}

export function buildMessage(report) {
  const { bogota, chat, escalations, integrity, widget, health, voice, status, recipients, quiet } = report;
  const lines = [];
  lines.push(`<b>${severityLabel(status)} · MONITOR CHATBOT UNITEC</b>`);
  lines.push(`<b>${bogota.dayKey} ${bogota.hm} COL</b>${quiet ? ' · modo silencio' : ''}`);
  lines.push('');
  lines.push(`<b>Chat:</b> ${chat.passed}/${chat.total} sondas OK · p50 ${(chat.p50 / 1000).toFixed(1)} s · máx ${(chat.max / 1000).toFixed(1)} s`);
  if (chat.passed < chat.total) {
    for (const r of chat.results.filter((x) => !x.passed).slice(0, 3)) {
      lines.push(`  ✗ ${escapeHtml(r.name)}: ${escapeHtml(r.error || 'sin respuesta')}`);
    }
  }
  lines.push(`<b>Asesores (2 h):</b> ${escalations.requested} solicitados · ${escalations.attended} atendidos (${escalations.attendanceRate}%) · ${escalations.stuckRequested} esperando`);
  if (escalations.undelivered || escalations.slaFailed) {
    lines.push(`  ⚠️ ${escalations.undelivered} sin entregar · ${escalations.slaFailed} re-alertas fallidas`);
  }
  const healthLine = health.status ? `Gemini ${health.status} (${health.latency || 0} ms)` : `Gemini sin datos`;
  const voiceLine = voice.ok ? 'voz OK' : `voz ${voice.status || 'sin respuesta'}`;
  const widgetLine = widget.ok ? 'widget OK' : `widget: ${escapeHtml((widget.problems || []).join(', ') || 'falla')}`;
  lines.push(`<b>Servicios:</b> ${widgetLine} · ${healthLine} · ${voiceLine}`);
  lines.push(`<b>Precios:</b> ${integrity.mismatches} diferencias de valor, ${integrity.unitMismatches} de unidad (de ${integrity.checked} SKU)`);
  if (report.action) lines.push(`<b>Qué corregir hoy:</b> ${escapeHtml(report.action)}`);
  lines.push('');
  lines.push(`<b>Envío:</b> ${escapeHtml(recipients.via)}`);
  return lines.join('\n');
}

function pickAction(report) {
  if (report.chat.passed < report.chat.total) return 'El chat no respondió bien: revisar /api/chat y la clave de Gemini.';
  if (report.escalations.undelivered > 0) return 'Hay solicitudes de asesor sin entregar: revisar Telegram/Twilio del equipo.';
  if (report.escalations.stuckRequested > 0) return 'Hay clientes esperando asesor: entrar al panel y tomar la conversación.';
  if (report.escalations.slaFailed > 0) return 'Fallaron re-alertas SLA: revisar /api/notify-escalation.';
  if (!report.widget.ok) return 'El widget no carga en unitecusadesign.com: revisar el snippet embebido.';
  if (report.integrity.mismatches > 0 || report.integrity.unitMismatches > 0) return 'Precios inconsistentes entre catálogo y bot: definir fuente de verdad.';
  if (report.chat.p50 > 8000) return 'El chat está lento (>8 s): revisar carga del modelo.';
  return '';
}

export default async function handler(req, res) {
  if (!authorized(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });

  const dryRun = String(req.query?.dryRun || '') === 'true';
  const force = String(req.query?.force || '') === 'true';
  const fullWidget = String(req.query?.full || '') === 'true';
  const now = bogotaNow();
  const quiet = !force && (now.hour < QUIET_TO || now.hour >= QUIET_FROM);
  const started = Date.now();

  const report = {
    source: 'unitec-chatbot',
    project: firebaseConfig.projectId,
    bogota: now,
    dryRun,
    quiet,
    status: 'green',
    chat: { ok: false, passed: 0, total: 0, p50: 0, max: 0, results: [], error: '' },
    escalations: { requested: 0, attended: 0, attendanceRate: 100, undelivered: 0, slaFailed: 0, stuckRequested: 0, staffNoShow: 0 },
    integrity: { ok: true, checked: 0, mismatches: 0, unitMismatches: 0, examples: [], unitExamples: [] },
    widget: { ok: false, problems: [] },
    health: { status: '', latency: 0 },
    voice: { ok: false, status: 0 },
    analytics: null,
    escalationHealth: null,
    recipients: { chatIds: [], via: 'sin destinatario' },
    telegram: null,
    missionControl: null,
    history: null,
    action: '',
  };

  const soft = async (fn) => {
    try { return { ok: true, value: await fn() }; } catch (err) { return { ok: false, error: String(err?.message || err) }; }
  };

  // ── Capas A + B en paralelo: sondas de chat y lectura de sesiones son independientes ──
  const [chat, sessions] = await Promise.all([
    soft(runChatProbes),
    soft(() => recentSessions(600)),
  ]);
  if (chat.ok) report.chat = chat.value;
  else report.chat.error = chat.error;

  if (sessions.ok) {
    report.escalations = await auditEscalations(sessions.value, 2);
    report.analytics = brandSnapshot(sessions.value, 24);
  } else {
    report.escalations.error = sessions.error;
  }

  // ── Integridad y servicios (capa C) ───────────────────────────────────────
  const [integrity, widget, sysHealth, voiceToken, escHealth] = await Promise.all([
    soft(priceIntegrity),
    soft(() => widgetHealth({ full: fullWidget })),
    soft(() => probe('/api/system-health', { timeoutMs: 12000 })),
    soft(() => probe('/api/xai-voice-token', { method: 'POST', body: { model: 'grok-voice-latest' }, timeoutMs: 15000 })),
    soft(readEscalationHealth),
  ]);

  if (integrity.ok) report.integrity = integrity.value;
  else report.integrity.error = integrity.error;
  if (widget.ok) report.widget = widget.value;
  else report.widget.problems = [widget.error];
  if (sysHealth.ok) report.health = { status: sysHealth.value.json?.status || 'sin datos', latency: sysHealth.value.json?.latency || 0 };
  else report.health = { status: 'sin respuesta', latency: 0 };
  if (voiceToken.ok) report.voice = { ok: voiceToken.value.ok && voiceToken.value.json?.ok !== false, status: voiceToken.value.status };
  if (escHealth.ok) report.escalationHealth = escHealth.value;

  // ── Severidad ─────────────────────────────────────────────────────────────
  const red = report.chat.passed < report.chat.total
    || report.escalations.undelivered > 0
    || report.escalations.stuckRequested > 0
    || report.escalations.slaFailed > 0
    || !report.widget.ok;
  const yellow = report.integrity.mismatches > 0
    || report.integrity.unitMismatches > 0
    || report.escalations.staffNoShow > 0
    || report.chat.p50 > 8000
    || (report.health.status && report.health.status !== 'up')
    || !report.voice.ok;
  report.status = red ? 'red' : yellow ? 'yellow' : 'green';
  report.action = pickAction(report);

  // ── Destinatarios y envío (capa D) ────────────────────────────────────────
  const recipients = await resolveRecipients().catch(() => ({ chatIds: [], via: 'sin destinatario' }));
  report.recipients = recipients;

  const shouldSend = recipients.chatIds.length > 0 && (!quiet || report.status === 'red');
  if (!dryRun && shouldSend) {
    const message = buildMessage(report);
    report.telegram = await sendTelegramTo(recipients.chatIds, message).catch((e) => ({ sent: false, error: String(e?.message || e) }));
  }

  // ── Push a Mission Control ────────────────────────────────────────────────
  const mcUrl = process.env.MC_INGEST_URL || '';
  if (!dryRun && mcUrl) {
    const payload = {
      source: 'unitec-chatbot',
      project: firebaseConfig.projectId,
      generatedAt: now.iso,
      dayKey: now.dayKey,
      status: report.status,
      chat: { passed: report.chat.passed, total: report.chat.total, p50: report.chat.p50, max: report.chat.max },
      escalations: report.escalations,
      integrity: report.integrity,
      services: { widget: report.widget.ok, gemini: report.health.status, voice: report.voice.ok },
      analytics: report.analytics,
      escalationHealth: report.escalationHealth,
      action: report.action,
    };
    try {
      const r = await fetch(mcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(process.env.MC_INGEST_TOKEN ? { Authorization: `Bearer ${process.env.MC_INGEST_TOKEN}` } : {}) },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(12000),
      });
      report.missionControl = { ok: r.ok, status: r.status, error: r.ok ? '' : (await r.text().catch(() => '')).slice(0, 200) };
    } catch (e) {
      report.missionControl = { ok: false, status: 0, error: String(e?.message || e) };
    }
  } else if (!mcUrl) {
    report.missionControl = { ok: false, skipped: 'MC_INGEST_URL no configurada' };
  }

  // ── Historial (bounded, sin PII) ──────────────────────────────────────────
  const historyEntry = {
    at: now.iso,
    dayKey: now.dayKey,
    hm: now.hm,
    status: report.status,
    chat: { passed: report.chat.passed, total: report.chat.total, p50: report.chat.p50 },
    escalations: {
      requested: report.escalations.requested,
      attended: report.escalations.attended,
      undelivered: report.escalations.undelivered,
      stuck: report.escalations.stuckRequested,
    },
    integrity: { mismatches: report.integrity.mismatches, unitMismatches: report.integrity.unitMismatches },
    services: { widget: report.widget.ok, gemini: report.health.status, voice: report.voice.ok },
    telegram: report.telegram ? { sent: !!report.telegram.sent, via: recipients.via } : null,
    missionControl: report.missionControl ? { ok: !!report.missionControl.ok } : null,
    durationMs: Date.now() - started,
  };
  if (!dryRun) {
    report.history = await writeMonitorHistory(historyEntry)
      .then(() => 'written')
      .catch((e) => `failed: ${e?.message || e}${e?.cause ? ` / ${e.cause.code || e.cause.message}` : ''}`);
  }
  report.historyEntry = historyEntry;
  report.durationMs = Date.now() - started;
  report.ok = true;

  return res.status(200).json(report);
}
