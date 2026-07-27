import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const firebaseConfig = require('../firebase-applet-config.json');

export default async function handler(req, res) {
  const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  let origin = req.headers.origin || '';
  if (!origin && req.headers.referer) {
    try {
      const refererUrl = new URL(req.headers.referer);
      origin = refererUrl.origin;
    } catch (e) {}
  }

  if (ALLOWED_ORIGINS.length > 0 && origin) {
    const isAllowed = ALLOWED_ORIGINS.some(allowed => {
      const allowedClean = allowed.replace(/^https?:\/\//, '').toLowerCase();
      const originClean = origin.replace(/^https?:\/\//, '').toLowerCase();
      return originClean === allowedClean || originClean.endsWith('.' + allowedClean);
    });

    if (!isAllowed) {
      return res.status(403).json({ error: `Origin "${origin}" not allowed` });
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Missing message parameter' });
  }

  let telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || '';
  let telegramChatId = process.env.TELEGRAM_CHAT_ID || '';

  try {
    const apiKey = firebaseConfig.apiKey;
    const projectId = firebaseConfig.projectId;

    // 1. Sign in anonymously via Google Identity Toolkit REST API
    const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true })
    });

    if (authRes.ok) {
      const { idToken } = await authRes.json();

      // 2. Fetch Shared Telegram Configuration from config/main Firestore document
      const configPath = `projects/${projectId}/databases/(default)/documents/config/main`;
      const configRes = await fetch(`https://firestore.googleapis.com/v1/${configPath}`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });

      if (configRes.ok) {
        const configData = await configRes.json();
        const fields = configData.fields || {};
        
        if (fields.telegramBotToken?.stringValue) {
          telegramBotToken = fields.telegramBotToken.stringValue;
        }
        if (fields.telegramChatId?.stringValue) {
          telegramChatId = fields.telegramChatId.stringValue;
        }
      }
    }
  } catch (firestoreError) {
    console.error("Failed to load custom Telegram settings from Firestore, using environment fallbacks:", firestoreError);
  }

  if (!telegramBotToken || !telegramChatId) {
    console.error("Missing Telegram configuration (neither in Firestore nor in environment).");
    return res.status(500).json({ error: 'Telegram configuration is missing.' });
  }

  const botTokens = telegramBotToken.split(',').map(t => t.trim()).filter(Boolean);
  const chatIds = telegramChatId.split(',').map(id => id.trim()).filter(Boolean);
  const results = [];
  let atLeastOneSuccess = false;

  for (let i = 0; i < chatIds.length; i++) {
    const chatId = chatIds[i];
    const token = botTokens[i] || botTokens[0]; // Use matching token, or fallback to first
    
    if (!token) {
       results.push({ chatId, success: false, error: 'No bot token available for this chat ID' });
       continue;
    }
    
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML'
        }),
      });

      const data = await response.json();
      if (response.ok) {
        atLeastOneSuccess = true;
        results.push({ chatId, success: true, data });
      } else {
        console.error(`Telegram API Error for chat_id ${chatId}:`, data);
        results.push({ chatId, success: false, error: data });
      }
    } catch (error) {
      console.error(`Error sending Telegram message to chat_id ${chatId}:`, error);
      results.push({ chatId, success: false, error: error.message });
    }
  }

  if (atLeastOneSuccess) {
    return res.status(200).json({ success: true, results });
  } else {
    return res.status(500).json({ success: false, error: 'Failed to send to all chat IDs', results });
  }
}
