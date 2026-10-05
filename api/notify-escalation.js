// Unified escalation: fires Telegram + Email + WhatsApp + SMS simultaneously.
// Called when a user requests a quote, budget, price, or asks to talk to staff.

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const firebaseConfig = require('../firebase-applet-config.json');

// Persistencia de escalaciones: una alerta que nadie puede ver es una alerta que no existió.
import { addDoc, bumpCounter } from './_firestore-rest.js';

// --- CORS ---
function setCORS(res, req) {
  const ALLOWED = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  let origin = req.headers.origin || '';
  if (!origin && req.headers.referer) {
    try { origin = new URL(req.headers.referer).origin; } catch {}
  }
  if (ALLOWED.length > 0 && origin) {
    const ok = ALLOWED.some(a => {
      const ac = a.replace(/^https?:\/\//, '').toLowerCase();
      const oc = origin.replace(/^https?:\/\//, '').toLowerCase();
      return oc === ac || oc.endsWith('.' + ac);
    });
    if (!ok) { res.status(403).json({ error: 'Origin not allowed' }); return false; }
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return true;
}

// --- Firestore config fetch (shared telegram tokens) ---
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
  } catch {
    return {};
  }
}

// --- Channel: Telegram ---
async function sendTelegram(message) {
  let botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  let chatId = process.env.TELEGRAM_CHAT_ID || '';

  const fsConfig = await getFirestoreConfig();
  if (fsConfig.telegramBotToken?.stringValue) botToken = fsConfig.telegramBotToken.stringValue;
  if (fsConfig.telegramChatId?.stringValue) chatId = fsConfig.telegramChatId.stringValue;

  if (!botToken || !chatId) return { success: false, error: 'Telegram not configured' };

  const tokens = botToken.split(',').map(t => t.trim()).filter(Boolean);
  const chatIds = chatId.split(',').map(c => c.trim()).filter(Boolean);
  const results = [];

  for (let i = 0; i < chatIds.length; i++) {
    const token = tokens[i] || tokens[0];
    if (!token) continue;
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatIds[i], text: message, parse_mode: 'HTML' }),
        signal: AbortSignal.timeout(8000),
      });
      results.push({ chatId: chatIds[i], ok: r.ok });
    } catch (e) {
      results.push({ chatId: chatIds[i], ok: false, error: e.message });
    }
  }
  return { success: results.some(r => r.ok), details: results };
}

// --- Channel: Email (Resend) ---
async function sendEmail(subject, html) {
  const apiKey = process.env.RESEND_API_KEY || process.env.RESEND_KEY || process.env.VITE_RESEND_API_KEY || '';
  const adminEmail = process.env.ADMIN_EMAIL || 'lidermarketingonline@espaciosimportados.com.co';
  if (!apiKey) return { success: false, error: 'No Resend API key found in env' };

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: 'UniTEC AI Desk <onboarding@resend.dev>',
        to: [adminEmail],
        subject,
        html,
      }),
      signal: AbortSignal.timeout(8000),
    });
    return { success: r.ok, data: r.ok ? await r.json() : await r.text() };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// --- Channel: Twilio SMS ---
async function sendTwilioSMS(phones, text) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
  const authToken = process.env.TWILIO_AUTH_TOKEN || '';
  const twilioNumber = process.env.TWILIO_PHONE_NUMBER || '+18332164335';

  if (!accountSid || !authToken || !twilioNumber) {
    return { success: false, error: 'Twilio credentials or phone number missing' };
  }

  const phoneList = (Array.isArray(phones) ? phones : [phones])
    .map(p => {
      let clean = (p || '').trim();
      if (!clean.startsWith('+')) clean = '+' + clean.replace(/\D/g, '');
      return clean;
    })
    .filter(Boolean);

  const results = [];
  for (const phone of phoneList) {
    try {
      const formData = new URLSearchParams();
      formData.append('To', phone);
      formData.append('From', twilioNumber);
      formData.append('Body', text);

      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
        signal: AbortSignal.timeout(8000),
      });
      const data = await r.json();
      results.push({ phone, success: r.ok, sid: data.sid, error: data.message });
    } catch (e) {
      results.push({ phone, success: false, error: e.message });
    }
  }
  return { success: results.some(r => r.success), details: results };
}

// --- Channel: WhatsApp + SMS via Twilio ---
async function sendTwilioWhatsApp(phone, text) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
  const authToken = process.env.TWILIO_AUTH_TOKEN || '';
  const twilioNumber = process.env.TWILIO_PHONE_NUMBER || '';

  if (!accountSid || !authToken || !twilioNumber) {
    return { success: false, error: 'TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER not set' };
  }

  let p = (phone || '').trim();
  if (!p) return { success: false, error: 'No phone number provided' };
  if (!p.startsWith('+')) p = '+' + p.replace(/\D/g, '');

  try {
    const formData = new URLSearchParams();
    formData.append('To', `whatsapp:${p}`);
    formData.append('From', `whatsapp:${twilioNumber}`);
    formData.append('Body', text);

    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
      signal: AbortSignal.timeout(8000),
    });
    const data = await r.json();
    return { success: r.ok, sid: data.sid, data };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// --- Channel: WhatsApp + SMS via Sent.dm ---
async function sendWhatsAppAndSMS(phones, text) {
  const apiKey = (process.env.SENT_DM_API_KEY || '').trim();
  if (!apiKey) return { success: false, error: 'SENT_DM_API_KEY not set' };

  const phoneList = (Array.isArray(phones) ? phones : [phones])
    .map(p => {
      let clean = (p || '').trim();
      if (!clean.startsWith('+')) clean = '+' + clean.replace(/\D/g, '');
      return clean;
    })
    .filter(Boolean);

  if (phoneList.length === 0) return { success: false, error: 'No valid phone numbers' };

  try {
    const r = await fetch('https://api.sent.dm/v3/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: phoneList, text, channel: ['whatsapp', 'sms'] }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await r.json();
    return { success: r.ok || r.status === 202, data };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// --- Templates ---
function buildTelegramMessage(d) {
  const icon = d.type === 'quote' ? '💰' : d.type === 'staff' ? '🧑‍💼' : d.type === 'sla' ? '⏰' : '🚨';
  const typeLabel = d.type === 'quote' ? 'COTIZACIÓN' : d.type === 'staff' ? 'ASESOR HUMANO' : d.type === 'sla' ? 'SIN RESPUESTA — SLA' : 'ESCALAMIENTO';
  const lines = [
    `<b>${icon} ALERTA DE ESCALAMIENTO</b>`,
    ``,
    `<b>Tipo:</b> ${typeLabel}`,
    `<b>Cliente:</b> ${d.customerName || 'Desconocido'}`,
    `<b>Teléfono:</b> ${d.customerPhone || 'No indicado'}`,
  ];
  if (d.customerEmail) lines.push(`<b>Correo:</b> ${d.customerEmail}`);
  lines.push(``);
  lines.push(`<b>Mensaje:</b>`);
  lines.push(d.message ? d.message.substring(0, 500) : 'N/A');
  lines.push(``);
  lines.push(`<b>Marca:</b> ${d.brand || 'Desconocida'}`);
  lines.push(`<b>Sesión:</b> ${d.sessionId || 'N/A'}`);
  lines.push(`<b>Hora:</b> ${new Date(d.timestamp).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`);
  if (Array.isArray(d.transcript) && d.transcript.length) {
    lines.push('');
    lines.push('<b>Conversación (últimos turnos):</b>');
    d.transcript.slice(-6).forEach((t) => {
      const txt = String(t?.text || '').replace(/\s+/g, ' ').slice(0, 180);
      if (txt) lines.push(`${t?.role === 'user' ? '👤 Cliente' : '🤖 Bot'}: ${txt}`);
    });
  }
  if (d.product) lines.push('', `<b>Producto/intención:</b> ${d.product}`);
  if (d.waitingSince) lines.push(`<b>Esperando asesor desde:</b> ${new Date(d.waitingSince).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`);
  if (d.slaStage) lines.push(`<b>Re-alerta SLA:</b> etapa ${d.slaStage}`);
  if (d.pageUrl) lines.push(`<b>Página:</b> ${d.pageUrl}`);
  if (d.dashboardUrl) lines.push(`<a href="${d.dashboardUrl}">📋 Tomar el chat en el panel</a>`);
  return lines.join('\n');
}

function buildEmailHtml(d) {
  const color = d.priority === 'urgent' ? '#dc2626' : d.priority === 'high' ? '#ea580c' : '#ca8a04';
  const title = d.type === 'quote' ? '💰 Solicitud de cotización' : d.type === 'staff' ? '🧑‍💼 Cliente pidió un asesor' : d.type === 'sla' ? '⏰ Cliente esperando — sin respuesta' : '🚨 Escalamiento';
  return `<!DOCTYPE html><html><head><style>
  body{font-family:Arial,sans-serif;line-height:1.6;color:#333}
  .container{max-width:600px;margin:0 auto;padding:20px}
  .header{background:${color};color:#fff;padding:20px;border-radius:8px 8px 0 0}
  .content{background:#f9fafb;padding:20px;border:1px solid #e5e7eb}
  .footer{text-align:center;padding:20px;color:#6b7280;font-size:12px}
  .meta{margin-top:20px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280}
  </style></head><body><div class="container">
  <div class="header"><h2>${title}</h2></div>
  <div class="content">
  <p><strong>Cliente:</strong> ${d.customerName || 'Desconocido'}</p>
  <p><strong>Teléfono:</strong> ${d.customerPhone || 'No indicado'}</p>
  ${d.customerEmail ? `<p><strong>Correo:</strong> ${d.customerEmail}</p>` : ''}
  <p><strong>Marca:</strong> ${d.brand || 'Desconocida'}</p>
  <p><strong>Mensaje:</strong></p>
  <blockquote>${d.message || 'N/A'}</blockquote>
  ${Array.isArray(d.transcript) && d.transcript.length ? `<p><strong>Conversación:</strong></p><blockquote>${d.transcript.slice(-6).map((t) => `${t?.role === 'user' ? '👤 Cliente' : '🤖 Bot'}: ${String(t?.text || '').replace(/</g, '&lt;').slice(0, 200)}`).join('<br>')}</blockquote>` : ''}
  ${d.product ? `<p><strong>Producto/intención:</strong> ${d.product}</p>` : ''}
  ${d.waitingSince ? `<p><strong>Esperando asesor desde:</strong> ${new Date(d.waitingSince).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p>` : ''}
  ${d.slaStage ? `<p><strong>Re-alerta SLA:</strong> etapa ${d.slaStage}</p>` : ''}
  <div class="meta">
  <p>Sesión: ${d.sessionId || 'N/A'}</p>
  <p>Hora: ${new Date(d.timestamp).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p>
  ${d.dashboardUrl ? `<p><a href="${d.dashboardUrl}">Abrir panel</a></p>` : ''}
  </div>
  </div><div class="footer"><p>Recepción AI UniTEC — Escalamiento automático</p></div>
  </div></body></html>`;
}

function buildWhatsAppText(d) {
  const prefix = d.type === 'quote' ? '💰 COTIZACION' : d.type === 'staff' ? '🧑‍💼 PIDIO ASESOR' : d.type === 'sla' ? '⏰ SIN RESPUESTA' : '🔔 ALERTA';
  const lastUser = Array.isArray(d.transcript)
    ? [...d.transcript].reverse().find((t) => t?.role === 'user')?.text
    : '';
  const lines = [
    `${prefix} — ${d.customerName || 'Cliente'}`,
    `Msj: ${String(lastUser || d.message || 'N/A').replace(/\s+/g, ' ').slice(0, 200)}`,
    `Tel: ${d.customerPhone || 'no indicado'}`,
    `Sesion: ${d.sessionId || 'N/A'}`,
  ];
  if (d.waitingSince) lines.push(`Esperando desde: ${new Date(d.waitingSince).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota' })}`);
  if (d.slaStage) lines.push(`Re-alerta SLA etapa ${d.slaStage}`);
  return lines.join('\n');
}

// --- Persistence: audit doc + the counters the panels/reports read ---
async function recordEscalation(d, results, anySuccess) {
  const channels = Object.entries(results).map(([name, r]) => ({
    channel: name,
    ok: !!r?.success,
    error: r?.error ? String(r.error).slice(0, 160) : '',
  }));
  const delivered = channels.filter((c) => c.ok).map((c) => c.channel);
  const failed = channels.filter((c) => !c.ok).map((c) => c.channel);
  const stamp = new Date().toISOString();

  let auditId = null;
  try {
    auditId = await addDoc('escalations', {
      sessionId: d.sessionId || '',
      type: d.type || 'custom',
      priority: d.priority || 'high',
      customerName: d.customerName || '',
      customerPhone: d.customerPhone || '',
      customerEmail: d.customerEmail || '',
      brand: d.brand || '',
      message: String(d.message || '').replace(/\s+/g, ' ').slice(0, 300),
      pageUrl: d.pageUrl || '',
      waitingSince: d.waitingSince || stamp,
      channels, delivered, failed, anyDelivered: anySuccess,
      createdAt: stamp,
    });
  } catch (err) {
    console.error('[escalation] audit write failed:', err?.message || err);
  }

  let counter = null;
  if (d.sessionId) {
    // NOTE: counters live inside the nested `analytics` map — the mask must use the dotted path and
    // the body the nested mapValue, or the write is silently dropped.
    // SLA re-alerts are counted separately from first-time escalations, otherwise the ladder
    // inflates `escalationCount` and the "how many customers asked for a human" metric lies.
    const counterField = d.type === 'sla' ? 'analytics.slaRealerts' : 'analytics.escalationCount';
    counter = await bumpCounter(`conversations/${d.sessionId}`, counterField, {
      staffAlertPending: !anySuccess,
      lastEscalationAt: stamp,
      escalationType: d.type || 'custom',
      lastEscalationDelivered: delivered,
    });
  }
  return { auditId, counter, delivered, failed };
}

// --- Main handler ---
export default async function handler(req, res) {
  if (!setCORS(res, req)) return;
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const {
    type,          // 'quote' | 'staff' | 'custom'
    priority,      // 'low' | 'medium' | 'high' | 'urgent'
    customerName,
    customerPhone,
    customerEmail,
    message,
    brand,
    sessionId,
    adminPhone,    // override single target phone
    phones,        // array of target phones
    dashboardUrl,
    pageUrl,       // where the customer was chatting
    waitingSince,  // when the customer started waiting for a human
    transcript,    // [{role, text}] — last turns, so staff gets context not just the last line
    product,       // product/intent hint when the client can detect one
    slaStage,      // set by the staff-SLA sweep on re-alerts
  } = req.body || {};

  if (!type || !message) {
    return res.status(400).json({ error: 'Missing required fields: type, message' });
  }

  const d = {
    type, priority: priority || 'high',
    customerName, customerPhone, customerEmail,
    message, brand, sessionId,
    pageUrl, waitingSince, product, slaStage,
    transcript: Array.isArray(transcript) ? transcript.slice(-8) : null,
    dashboardUrl: dashboardUrl || (req.headers.origin ? `${req.headers.origin}/?admin=true${sessionId ? `&session=${encodeURIComponent(sessionId)}` : ''}` : ''),
    timestamp: new Date().toISOString(),
  };

  // Staff team list
  const ALL_STAFF_PHONES = [
    '+17869708366',  // Jasmel (Admin)
    '+573202174861', // Nancy
    '+573142332147', // Official WhatsApp / Admin
    '+573104578337', // Camilo
    '+573105769694', // Yuldor
    '+573202174854', // Henderson
    '+17869685783',  // Johana
    '+573113017763', // Alexander
  ];

  const targetPhones = phones || (adminPhone ? [adminPhone] : ALL_STAFF_PHONES);
  const primaryPhone = Array.isArray(targetPhones) ? targetPhones[0] : targetPhones;

  // Fire all channels in parallel: Telegram + Email + Twilio SMS + Twilio WhatsApp + Sent.dm
  const [telegram, email, twilioSms, twilioWa, whatsapp] = await Promise.allSettled([
    sendTelegram(buildTelegramMessage(d)),
    sendEmail(
      `[${d.priority.toUpperCase()}] ${d.type === 'quote' ? 'Solicitud de cotización' : d.type === 'staff' ? 'Cliente pidió un asesor' : d.type === 'sla' ? 'CLIENTE SIN RESPUESTA (SLA)' : 'Escalamiento'} — ${customerName || 'Cliente'}`,
      buildEmailHtml(d)
    ),
    sendTwilioSMS(targetPhones, buildWhatsAppText(d)),
    sendTwilioWhatsApp(primaryPhone, buildWhatsAppText(d)),
    sendWhatsAppAndSMS(targetPhones, buildWhatsAppText(d)),
  ]);

  const extract = (r) => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message };

  const results = {
    telegram: extract(telegram),
    email: extract(email),
    twilioSms: extract(twilioSms),
    twilioWhatsApp: extract(twilioWa),
    sentDmWhatsApp: extract(whatsapp),
  };

  const anySuccess = Object.values(results).some(r => r.success);

  // Persist BEFORE answering, and even when every channel failed: an undelivered alert must still
  // show up in the audit trail and in the session counters the monitors read.
  const persistence = await recordEscalation(d, results, anySuccess).catch((err) => {
    console.error('[escalation] persistence failed:', err?.message || err);
    return { error: String(err?.message || err) };
  });

  if (!anySuccess) {
    return res.status(500).json({ error: 'All notification channels failed', results, persistence });
  }

  return res.status(200).json({ success: true, results, persistence });
}
