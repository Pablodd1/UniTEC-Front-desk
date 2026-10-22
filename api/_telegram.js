// api/_telegram.js — edit an alert that was already sent, plus the token lookup that goes with it.
//
// Why: an alert that stays "open" on the phone after the conversation is handled is the worst state
// this product has — the customer is attended and the advisor still sees a pending ticket. A Telegram
// message cannot be unsent, so the ONLY way to close it is to edit it in place.
//
// Token resolution deliberately mirrors notify-escalation (env first, then Firestore config/main), so
// one rule decides which bot speaks; several alerts are delivered by an array of bot tokens, so the
// edit retries across them until one accepts the message id.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const firebaseConfig = require('../firebase-applet-config.json');

async function resolveBotTokens() {
  let botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  if (!botToken) {
    try {
      const apiKey = firebaseConfig.apiKey;
      const projectId = firebaseConfig.projectId;
      const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnSecureToken: true }),
      });
      if (authRes.ok) {
        const { idToken } = await authRes.json();
        const cfgRes = await fetch(
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/config/main`,
          { headers: { Authorization: `Bearer ${idToken}` } }
        );
        if (cfgRes.ok) {
          const data = await cfgRes.json();
          if (data.fields?.telegramBotToken?.stringValue) botToken = data.fields.telegramBotToken.stringValue;
        }
      }
    } catch { /* fall through: no token means "cannot edit", never a thrown request */ }
  }
  return botToken ? botToken.split(',').map((t) => t.trim()).filter(Boolean) : [];
}

/**
 * Replace the text of an already-delivered alert. Best effort by design: a failure here must never
 * fail the staff action that triggered it (the conversation is already resolved on our side).
 * Returns { ok, noop? } or { ok:false, error }.
 */
export async function editTelegramMessage(chatId, messageId, text) {
  if (!chatId || !messageId) return { ok: false, error: 'missing_chat_or_message' };
  const tokens = await resolveBotTokens();
  if (!tokens.length) return { ok: false, error: 'telegram_not_configured' };

  let last = '';
  for (const token of tokens) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: Number(messageId),
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(8000),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data?.ok) return { ok: true };
      last = String(data?.description || `HTTP ${r.status}`);
      // Editing to the identical text is reported as an error by Telegram; treat it as success.
      if (/not modified/i.test(last)) return { ok: true, noop: true };
    } catch (e) {
      last = String(e?.message || e);
    }
  }
  return { ok: false, error: last };
}
