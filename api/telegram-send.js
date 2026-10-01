import { createRequire } from 'module';
const require_ = createRequire(import.meta.url);
const firebaseConfig = require_('../firebase-applet-config.json');

export function escapeHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function firestoreConfig() {
  try {
    const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true }),
    });
    if (!authRes.ok) return {};
    const { idToken } = await authRes.json();
    const projectId = firebaseConfig.projectId;
    const configRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/config/main`,
      { headers: { Authorization: `Bearer ${idToken}` } }
    );
    if (!configRes.ok) return {};
    const doc = await configRes.json();
    return doc.fields || {};
  } catch {
    return {};
  }
}

export async function sendTelegramAlert(message) {
  let botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  let chatId = process.env.TELEGRAM_CHAT_ID || '';

  const fields = await firestoreConfig();
  if (fields.telegramBotToken?.stringValue) botToken = fields.telegramBotToken.stringValue;
  if (fields.telegramChatId?.stringValue) chatId = fields.telegramChatId.stringValue;

  if (!botToken || !chatId) {
    return { sent: false, error: 'Telegram is not configured (bot token / chat id missing).' };
  }

  const tokens = botToken.split(',').map((t) => t.trim()).filter(Boolean);
  const chatIds = chatId.split(',').map((c) => c.trim()).filter(Boolean);
  const results = [];

  for (let i = 0; i < chatIds.length; i++) {
    const token = tokens[i] || tokens[0];
    if (!token) continue;
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatIds[i], text: message, parse_mode: 'HTML' }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await r.json().catch(() => ({}));
      results.push({ chatId: chatIds[i], ok: r.ok, error: r.ok ? undefined : (data.description || r.status) });
    } catch (e) {
      results.push({ chatId: chatIds[i], ok: false, error: e.message });
    }
  }

  const sent = results.some((r) => r.ok);

  const hermesToken = process.env.HERMES_ALERT_BOT_TOKEN || '';
  const hermesChat = process.env.HERMES_ALERT_CHAT_ID || '';
  if (hermesToken && hermesChat && !chatIds.includes(hermesChat)) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${hermesToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: hermesChat, text: message, parse_mode: 'HTML' }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await r.json().catch(() => ({}));
      results.push({ chatId: hermesChat, ok: r.ok, via: 'hermes', error: r.ok ? undefined : (data.description || r.status) });
    } catch (e) {
      results.push({ chatId: hermesChat, ok: false, via: 'hermes', error: e.message });
    }
  }

  const anySent = results.some((r) => r.ok);
  return { sent: anySent, results, error: anySent ? undefined : (results[0]?.error || 'Telegram send failed'), staffSent: sent };
}
