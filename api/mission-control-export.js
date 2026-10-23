// api/mission-control-export.js — un solo JSON para Mission Control. Sin PII, solo agregados.
//
// GET /api/mission-control-export?window=24
//   Authorization: Bearer <MC_EXPORT_TOKEN>        (o ?token=<MC_EXPORT_TOKEN>)
//   window: 24 (default) | 168  horas hacia atrás
//
// Devuelve: KPIs por marca, embudo, salud de escalaciones, integridad de precios, servicios,
// últimas corridas del monitor (config/main.monitor) y los SLO evaluados.
// No expone nombre, teléfono ni email de ningún cliente.

import { createRequire } from 'module';
import { getFirestoreToken, listAllSessions, funnel, bogotaDayKey } from './_analytics-core.js';
import {
  auditEscalations, priceIntegrity, readMonitorHistory, readEscalationHealth,
  brandSnapshot, bogotaNow, BASE_URL, probe,
} from './_monitor-core.js';

const require_ = createRequire(import.meta.url);
const firebaseConfig = require_('../firebase-applet-config.json');

function authorized(req) {
  const expected = process.env.MC_EXPORT_TOKEN || '';
  if (!expected) return { ok: false, reason: 'MC_EXPORT_TOKEN no configurado en el servidor' };
  const header = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim();
  // Acepta X-MC-Token (spec de Mission Control), Bearer, ?token= y el Bearer que inyecta Vercel Cron.
  const provided = String(req.headers?.['x-mc-token'] || '').trim() || header || String(req.query?.token || '').trim();
  const accepted = [expected, process.env.CRON_SECRET || ''].filter(Boolean);
  if (!provided || !accepted.includes(provided)) return { ok: false, reason: 'token inválido' };
  return { ok: true };
}

/** Clave de Resend tolerante a basura de copy-paste (comillas, espacios, guiones largos U+2014). */
function resendKey() {
  const raw = String(process.env.RESEND_API_KEY || process.env.RESEND_KEY || process.env.VITE_RESEND_API_KEY || '')
    .trim().replace(/^["']|["']$/g, '');
  const m = raw.match(/re_[A-Za-z0-9_-]+/);
  return m ? m[0] : raw.replace(/[^\x21-\x7E]/g, '');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  const auth = authorized(req);
  if (!auth.ok) return res.status(auth.reason.startsWith('MC_EXPORT_TOKEN') ? 503 : 401).json({ ok: false, error: auth.reason });

  // ?selftest=1 — diagnóstico de canales, protegido por el mismo token. Manda UN correo de prueba
  // al ADMIN_EMAIL y NO toca teléfonos ni al grupo de asesores.
  if (String(req.query?.selftest || '') === '1') {
    const apiKey = resendKey();
    const adminEmail = process.env.ADMIN_EMAIL || 'lidermarketingonline@espaciosimportados.com.co';
    const out = {
      ok: true,
      telegramConfigured: !!(process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_CHAT_ID),
      resendConfigured: !!apiKey,
      resendKeyLooksValid: /^re_[A-Za-z0-9_-]{16,}$/.test(apiKey),
      resendKeyLength: apiKey.length,
      adminEmail,
    };
    if (!apiKey) {
      out.ok = false;
      out.email = { ok: false, error: 'RESEND_API_KEY no configurada' };
      return res.status(200).json(out);
    }
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'UniTEC AI Desk <alertas@cedexx.net>',
          to: [adminEmail],
          subject: '[PRUEBA] Canal de email del monitor UniTEC',
          html: '<p>Prueba del canal de email del monitor. Si recibes esto, el canal funciona.</p>',
        }),
        signal: AbortSignal.timeout(12000),
      });
      const detail = await r.text().catch(() => '');
      out.email = { ok: r.ok, status: r.status, detail: detail.slice(0, 300) };
      out.ok = r.ok;
    } catch (err) {
      out.ok = false;
      out.email = { ok: false, error: String(err?.message || err) };
    }
    return res.status(200).json(out);
  }

  const windowHours = Number(req.query?.window) === 168 ? 168 : 24;

  try {
    const token = await getFirestoreToken();
    if (!token) return res.status(502).json({ ok: false, error: 'firestore auth failed' });

    const started = Date.now();
    const sessions = await listAllSessions(token);
    const real = sessions.filter((s) => !/^(diag|lat-test|analytics-verify|post-fix|warm-check|secret-verify|verify-|test-|review-|plan-)/i.test(s.id));

    const snapshot = brandSnapshot(real, windowHours);
    const escalations = await auditEscalations(real, windowHours);
    const [integrity, escHealth, monitor, widget] = await Promise.all([
      priceIntegrity(5),
      readEscalationHealth().catch(() => null),
      readMonitorHistory().catch(() => null),
      probe('/api/widget-status', { timeoutMs: 15000 }).then((r) => ({ ok: r.ok && r.json?.ok !== false, problems: r.json?.problems || [] })).catch(() => ({ ok: false, problems: ['sin respuesta'] })),
    ]);

    const slos = [
      { id: 'chat_probes', label: 'Sondas del chat en verde', target: '100%', actual: monitor?.last?.chat ? `${monitor.last.chat.passed}/${monitor.last.chat.total}` : 'sin datos', ok: monitor?.last?.chat ? monitor.last.chat.passed === monitor.last.chat.total : null },
      { id: 'escalation_delivery', label: 'Solicitudes de asesor entregadas', target: '100%', actual: escalations.undelivered === 0 ? '100%' : `${escalations.undelivered} sin entregar`, ok: escalations.undelivered === 0 },
      { id: 'staff_attendance', label: 'Atendidas en la ventana', target: '≥ 90%', actual: `${escalations.attendanceRate}%`, ok: escalations.attendanceRate >= 90 },
      { id: 'stuck_queue', label: 'Clientes esperando > 60 min', target: '0', actual: String(escalations.stuckRequested), ok: escalations.stuckRequested === 0 },
      { id: 'price_integrity', label: 'Precios catálogo vs bot', target: '0 diferencias', actual: `${integrity.mismatches} valor / ${integrity.unitMismatches} unidad`, ok: integrity.mismatches === 0 && integrity.unitMismatches === 0 },
    ];

    // ---- Push a Mission Control (esquema acordado) ----
    const todayKey = bogotaDayKey(new Date().toISOString());
    const dayOf = (s) => bogotaDayKey(s.lastUpdated || s.createdAt || '');
    const todays = real.filter((s) => dayOf(s) === todayKey);
    const userMsgs = (s) => Number(s.analytics?.userMessageCount ?? s.userMessageCount ?? 0) || 0;
    const withUser = (s) => userMsgs(s) > 0;
    const hasPhone = (s) => Boolean(String(s.customerPhone || s.extractedData?.phone || '').trim());
    const brandOf = (s) => (String(s.brand || s.brandId || 'unitec').toLowerCase().includes('build') ? 'building' : 'unitec');
    const todayReal = todays.filter(withUser);
    const realOnes = real.filter(withUser);
    const abandoned = real.filter((s) => Number(s.analytics?.messageCount ?? s.messageCount ?? 0) <= 1 && !withUser(s)).length;
    const mcPayload = {
      generatedAt: new Date().toISOString(),
      health: { status: widget.ok ? 'up' : 'down', latencyMs: monitor?.last?.latencyMs || 0, websiteUp: widget.ok, embedLoads: widget.ok },
      five_key_numbers: {
        real_conversations_today: {
          unitec: todayReal.filter((s) => brandOf(s) === 'unitec').length,
          building: todayReal.filter((s) => brandOf(s) === 'building').length,
          total_today: todayReal.length,
        },
        contacts_captured_phone: { today: todays.filter(hasPhone).length, all_time: real.filter(hasPhone).length },
        advisor_requests: {
          today: todays.filter((s) => Number(s.analytics?.escalationCount ?? s.escalationCount ?? 0) > 0).length,
          human_assigned: real.filter((s) => s.status === 'human_assigned').length,
          completed: real.filter((s) => s.status === 'completed').length,
        },
        alert_delivery: {
          failed_visible: escalations.undelivered || 0,
          escalations_collection_status: (escalations.undelivered || 0) === 0 ? 'OK' : 'DEGRADED',
        },
        greeting_abandonment: {
          abandoned,
          total_raw: real.length,
          rate_pct: real.length ? +((abandoned / real.length) * 100).toFixed(1) : 0,
        },
      },
      kpis: {
        total_sessions: real.length,
        real_interactions: realOnes.length,
        real_interaction_rate_pct: real.length ? +((realOnes.length / real.length) * 100).toFixed(2) : 0,
        avg_user_messages: realOnes.length ? +(realOnes.reduce((a, s) => a + userMsgs(s), 0) / realOnes.length).toFixed(1) : 0,
        contacts_captured: real.filter(hasPhone).length,
      },
      by_brand_all_time: real.reduce((acc, s) => { const b = brandOf(s); acc[b] = (acc[b] || 0) + 1; return acc; }, { unitec: 0, building: 0 }),
    };
    const mcTarget = process.env.MC_INGEST_URL || '';
    let mcPush = { attempted: false, skipped: true, reason: 'MC_INGEST_URL no configurado' };
    if (mcTarget) {
      mcPush = { attempted: true, ok: false };
      try {
        const pr = await fetch(mcTarget, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-MC-Token': process.env.MC_EXPORT_TOKEN || '' },
          body: JSON.stringify(mcPayload),
        });
        mcPush = { attempted: true, ok: pr.ok, status: pr.status };
      } catch (e) {
        mcPush = { attempted: true, ok: false, error: String(e).slice(0, 160) };
      }
    }

    return res.status(200).json({
      ok: true,
      source: 'unitec-chatbot',
      project: firebaseConfig.projectId,
      generatedAt: new Date().toISOString(),
      bogota: bogotaNow(),
      windowHours,
      baseUrl: BASE_URL(),
      status: monitor?.last?.status || null,
      kpis: {
        totalSessions: real.length,
        ...snapshot.byBrand.unitec ? { unitec: snapshot.byBrand.unitec } : {},
        ...snapshot.byBrand.building ? { building: snapshot.byBrand.building } : {},
        byBrand: snapshot.byBrand,
      },
      funnel: snapshot.funnel,
      escalations,
      escalationHealth: escHealth,
      priceIntegrity: integrity,
      services: { widget, gemini: monitor?.last?.services?.gemini || null, voice: monitor?.last?.services?.voice ?? null },
      monitor: { last: monitor?.last || null, runs: (monitor?.runs || []).slice(0, 12) },
      slos,
      missionControl: { push: mcPush, payload: mcPayload },
      meta: { durationMs: Date.now() - started, note: 'Agregados. Sin PII. Las sesiones de prueba del monitor están excluidas.' },
    });
  } catch (err) {
    console.error('[mission-control-export]', err?.message || err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
