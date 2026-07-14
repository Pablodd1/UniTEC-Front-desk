import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const firebaseConfig = require('../firebase-applet-config.json');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const apiKey = firebaseConfig.apiKey;
    const projectId = firebaseConfig.projectId;

    // 1. Sign in anonymously via Google Identity Toolkit REST API
    const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true })
    });

    if (!authRes.ok) {
      const errText = await authRes.text();
      throw new Error(`Firebase Auth failed: ${errText}`);
    }

    const { idToken } = await authRes.json();

    // 2. Fetch Shared Telegram Configuration from config/main Firestore document
    const configPath = `projects/${projectId}/databases/(default)/documents/config/main`;
    const configRes = await fetch(`https://firestore.googleapis.com/v1/${configPath}`, {
      headers: { 'Authorization': `Bearer ${idToken}` }
    });

    let telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || '';
    let telegramChatId = process.env.TELEGRAM_CHAT_ID || '';

    if (configRes.ok) {
      const configData = await configRes.json();
      if (configData.fields) {
        if (configData.fields.telegramBotToken?.stringValue) {
          telegramBotToken = configData.fields.telegramBotToken.stringValue;
        }
        if (configData.fields.telegramChatId?.stringValue) {
          telegramChatId = configData.fields.telegramChatId.stringValue;
        }
      }
    }

    if (!telegramBotToken || !telegramChatId) {
      console.warn("Telegram credentials not configured in Firestore config/main or environment variables.");
      return res.status(400).json({ error: 'Telegram configuration is missing.' });
    }

    // 3. Fetch all conversations from Firestore REST API
    // We fetch a list of conversations ordered by lastUpdated
    const conversationsUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/conversations?pageSize=300`;
    const convRes = await fetch(conversationsUrl, {
      headers: { 'Authorization': `Bearer ${idToken}` }
    });

    if (!convRes.ok) {
      const errText = await convRes.ok ? '' : await convRes.text();
      throw new Error(`Failed to fetch conversations: ${errText}`);
    }

    const convData = await convRes.json();
    const documents = convData.documents || [];

    // Parse documents into easy-to-use JS objects
    const parsedSessions = documents.map(doc => {
      const fields = doc.fields || {};
      
      // Helper to parse map values (extractedData / analytics)
      const parseMap = (mapField) => {
        if (!mapField || !mapField.mapValue || !mapField.mapValue.fields) return {};
        const resObj = {};
        const innerFields = mapField.mapValue.fields;
        for (const [key, val] of Object.entries(innerFields)) {
          resObj[key] = val.stringValue || val.integerValue || val.doubleValue || val.booleanValue || '';
        }
        return resObj;
      };

      const topics = fields.topics?.arrayValue?.values?.map(v => v.stringValue).filter(Boolean) || [];

      return {
        id: fields.id?.stringValue || doc.name.split('/').pop(),
        brandId: fields.brandId?.stringValue || 'unitec',
        status: fields.status?.stringValue || 'active',
        source: fields.source?.stringValue || 'web',
        language: fields.language?.stringValue || 'es',
        createdAt: fields.createdAt?.stringValue || new Date().toISOString(),
        lastUpdated: fields.lastUpdated?.stringValue || new Date().toISOString(),
        customerName: fields.customerName?.stringValue || '',
        customerPhone: fields.customerPhone?.stringValue || '',
        customerEmail: fields.customerEmail?.stringValue || '',
        lastMessage: fields.lastMessage?.stringValue || '',
        intentCategory: fields.intentCategory?.stringValue || '',
        sentimentScore: parseFloat(fields.sentimentScore?.doubleValue || fields.sentimentScore?.integerValue || '0'),
        topics,
        extractedData: parseMap(fields.extractedData),
        analytics: parseMap(fields.analytics)
      };
    });

    // 4. Filter for sessions from the last 24 hours
    const last24hMs = 24 * 60 * 60 * 1000;
    const now = new Date();
    const last24hSessions = parsedSessions.filter(s => {
      const updatedTime = new Date(s.lastUpdated).getTime();
      return (now.getTime() - updatedTime) <= last24hMs;
    });

    if (last24hSessions.length === 0) {
      // Send a ping confirming analytics scheduler is active but there was no activity
      const telegramUrl = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
      await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: `📊 <b>Reporte Diario de Chatbot (9:00 AM)</b>\n\nNo se registraron interacciones en las últimas 24 horas. ¡El sistema sigue funcionando correctamente!`,
          parse_mode: 'HTML'
        })
      });
      return res.status(200).json({ success: true, message: 'No sessions today, sent status check' });
    }

    // 5. Aggregate Analytics Metrics
    const totalNew = last24hSessions.length;
    const unitecCount = last24hSessions.filter(s => s.brandId === 'unitec').length;
    const buildingCount = last24hSessions.filter(s => s.brandId === 'building').length;
    
    const activeStatus = last24hSessions.filter(s => s.status === 'active').length;
    const completedStatus = last24hSessions.filter(s => s.status === 'completed').length;
    const interventionCount = last24hSessions.filter(s => s.status === 'human_requested' || s.status === 'human_assigned').length;

    // Sentiment breakdown
    let positive = 0, neutral = 0, negative = 0;
    last24hSessions.forEach(s => {
      if (s.sentimentScore > 0.3) positive++;
      else if (s.sentimentScore < -0.3) negative++;
      else neutral++;
    });

    // Customer logs list formatted for Telegram
    let customerListHtml = '';
    last24hSessions.slice(0, 15).forEach((s, idx) => {
      const name = s.customerName || s.extractedData?.name || 'Visitante Anónimo';
      const phone = s.customerPhone || s.extractedData?.phone || 'No provisto';
      const lastMsg = s.lastMessage || 'Sin mensajes';
      const brand = s.brandId === 'unitec' ? 'UNITEC' : 'BUILDING';
      
      customerListHtml += `${idx + 1}. <b>${name}</b> (${brand})\n` +
        `   📱 Tel: <code>${phone}</code>\n` +
        `   💬 Último: <i>"${lastMsg.slice(0, 120)}"</i>\n\n`;
    });

    // 6. Build the rich HTML report message
    const reportText = `📊 <b>Reporte Diario de Chatbot (9:00 AM)</b>\n` +
      `📅 Fecha: <b>${now.toLocaleDateString('es-CO')}</b>\n\n` +
      `📈 <b>Métricas de Interacción (Últimas 24h):</b>\n` +
      `• Nuevas Sesiones: <b>${totalNew}</b>\n` +
      `• UNITEC USA: <b>${unitecCount}</b>\n` +
      `• Building Innovation: <b>${buildingCount}</b>\n` +
      `• Activas: <b>${activeStatus}</b> | Completadas: <b>${completedStatus}</b>\n` +
      `• Intervenciones Humano: <b>${interventionCount}</b>\n\n` +
      `🧠 <b>Análisis de Sentimiento:</b>\n` +
      `🟢 Positivo: <b>${positive}</b> | 🟡 Neutral: <b>${neutral}</b> | 🔴 Negativo: <b>${negative}</b>\n\n` +
      `👥 <b>Últimas Interacciones de Clientes:</b>\n` +
      `${customerListHtml}` +
      `🔗 <i>Acceda al Panel de Administración para exportar el histórico detallado.</i>`;

    // 7. Dispatch to Telegram Group/Channel
    const telegramUrl = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
    const telegramRes = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: reportText,
        parse_mode: 'HTML'
      })
    });

    const telegramData = await telegramRes.json();

    if (!telegramRes.ok) {
      console.error("Telegram API response error:", telegramData);
      throw new Error(`Telegram send message failed: ${telegramData.description || 'Unknown error'}`);
    }

    return res.status(200).json({ success: true, sessionsReported: totalNew });
  } catch (error) {
    console.error("Daily analytics execution error:", error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message || String(error) });
  }
}
