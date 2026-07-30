// Unified escalation: fires Telegram + Email + WhatsApp + SMS simultaneously.
// Called when a user requests a quote, budget, price, or asks to talk to staff.

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const firebaseConfig = require('../firebase-applet-config.json');

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

// --- Channel: WhatsApp + SMS (Sent.dm) — tries WhatsApp first, falls back to SMS ---
async function sendWhatsAppAndSMS(phone, text) {
  const apiKey = (process.env.SENT_DM_API_KEY || '').trim();
  if (!apiKey) return { success: false, error: 'SENT_DM_API_KEY not set' };

  let p = phone.trim();
  if (!p.startsWith('+')) p = '+' + p.replace(/\D/g, '');

  // Try WhatsApp first
  try {
    const r = await fetch('https://api.sent.dm/v3/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: [p], text, channel: ['whatsapp'] }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await r.json();
    if (r.ok || r.status === 202) return { success: true, channel: 'whatsapp', data };
    console.warn('Sent.dm WhatsApp failed, trying SMS:', JSON.stringify(data?.error));
  } catch (e) {
    console.warn('Sent.dm WhatsApp error, trying SMS:', e.message);
  }

  // Fallback: SMS only (no template restriction)
  try {
    const r = await fetch('https://api.sent.dm/v3/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: [p], text, channel: ['sms'] }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await r.json();
    return { success: r.ok || r.status === 202, channel: 'sms', data };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// --- Templates ---
function buildTelegramMessage(d) {
  const icon = d.type === 'quote' ? '💰' : d.type === 'staff' ? '🧑‍💼' : '🚨';
  const lines = [
    `<b>${icon} ESCALATION ALERT</b>`,
    ``,
    `<b>Type:</b> ${d.type.toUpperCase()}`,
    `<b>Customer:</b> ${d.customerName || 'Unknown'}`,
    `<b>Phone:</b> ${d.customerPhone || 'Not provided'}`,
  ];
  if (d.customerEmail) lines.push(`<b>Email:</b> ${d.customerEmail}`);
  lines.push(``);
  lines.push(`<b>Message:</b>`);
  lines.push(d.message ? d.message.substring(0, 500) : 'N/A');
  lines.push(``);
  lines.push(`<b>Brand:</b> ${d.brand || 'Unknown'}`);
  lines.push(`<b>Session:</b> ${d.sessionId || 'N/A'}`);
  lines.push(`<b>Time:</b> ${new Date(d.timestamp).toLocaleString()}`);
  if (d.dashboardUrl) lines.push(`<a href="${d.dashboardUrl}">📋 Take over in Dashboard</a>`);
  return lines.join('\n');
}

function buildEmailHtml(d) {
  const color = d.priority === 'urgent' ? '#dc2626' : d.priority === 'high' ? '#ea580c' : '#ca8a04';
  const title = d.type === 'quote' ? '💰 Quote Request' : d.type === 'staff' ? '🧑‍💼 Staff Requested' : '🚨 Escalation';
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
  <p><strong>Customer:</strong> ${d.customerName || 'Unknown'}</p>
  <p><strong>Phone:</strong> ${d.customerPhone || 'Not provided'}</p>
  ${d.customerEmail ? `<p><strong>Email:</strong> ${d.customerEmail}</p>` : ''}
  <p><strong>Brand:</strong> ${d.brand || 'Unknown'}</p>
  <p><strong>Message:</strong></p>
  <blockquote>${d.message || 'N/A'}</blockquote>
  <div class="meta">
  <p>Session: ${d.sessionId || 'N/A'}</p>
  <p>Time: ${new Date(d.timestamp).toLocaleString()}</p>
  ${d.dashboardUrl ? `<p><a href="${d.dashboardUrl}">Open Dashboard</a></p>` : ''}
  </div>
  </div><div class="footer"><p>UniTEC AI Front Desk — Automated Escalation</p></div>
  </div></body></html>`;
}

function buildWhatsAppText(d) {
  return `🔔 *ESCALATION ALERT*\n\n` +
    `*Type:* ${d.type.toUpperCase()}\n` +
    `*Customer:* ${d.customerName || 'Unknown'}\n` +
    `*Phone:* ${d.customerPhone || 'Not provided'}\n` +
    `*Brand:* ${d.brand || 'Unknown'}\n\n` +
    `*Message:*\n${d.message ? d.message.substring(0, 300) : 'N/A'}\n\n` +
    `*Session:* ${d.sessionId || 'N/A'}\n` +
    `*Time:* ${new Date(d.timestamp).toLocaleString()}`;
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
    adminPhone,    // override target phone for WhatsApp/SMS
    dashboardUrl,
  } = req.body || {};

  if (!type || !message) {
    return res.status(400).json({ error: 'Missing required fields: type, message' });
  }

  const d = {
    type, priority: priority || 'high',
    customerName, customerPhone, customerEmail,
    message, brand, sessionId,
    dashboardUrl: dashboardUrl || (req.headers.origin ? `${req.headers.origin}/admin` : ''),
    timestamp: new Date().toISOString(),
  };

  const targetPhone = adminPhone || '+573142332147';

  // Fire all 4 channels in parallel
  const [telegram, email, whatsapp] = await Promise.allSettled([
    sendTelegram(buildTelegramMessage(d)),
    sendEmail(
      `[${d.priority.toUpperCase()}] ${d.type === 'quote' ? 'Quote Request' : d.type === 'staff' ? 'Staff Requested' : 'Escalation'} — ${customerName || 'Customer'}`,
      buildEmailHtml(d)
    ),
    sendWhatsAppAndSMS(targetPhone, buildWhatsAppText(d)),
  ]);

  const extract = (r) => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message };

  const results = {
    telegram: extract(telegram),
    email: extract(email),
    whatsapp: extract(whatsapp),
  };

  const anySuccess = Object.values(results).some(r => r.success);

  if (!anySuccess) {
    return res.status(500).json({ error: 'All notification channels failed', results });
  }

  return res.status(200).json({ success: true, results });
}
