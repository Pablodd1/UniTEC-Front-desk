import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const firebaseConfig = require('../firebase-applet-config.json');

async function generateAIExecutiveSummary(sessions, apiKey) {
  if (!apiKey || sessions.length === 0) return '';
  
  // Format details for the AI
  const condensed = sessions.map(s => ({
    name: s.customerName || s.extractedData?.name || 'Anónimo',
    profession: s.extractedData?.profession || 'No especificada',
    intent: s.intentCategory || 'Consulta General',
    sentiment: s.sentimentScore > 0.3 ? 'Positivo' : s.sentimentScore < -0.3 ? 'Negativo' : 'Neutral',
    lastMessage: s.lastMessage || ''
  })).slice(0, 20);

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Eres un director de tecnología (CTO) y analista de datos. A continuación tienes las interacciones de los clientes con el chatbot de Unitec USA Design de las últimas 24 horas:\n\n${JSON.stringify(condensed)}\n\nEscribe un resumen ejecutivo muy conciso de 2 o 3 frases en español. Describe los temas de interés recurrentes, si hay problemas o si todo va bien, y ofrece una recomendación rápida para el equipo de ventas.`
          }]
        }]
      })
    });

    if (response.ok) {
      const resData = await response.json();
      return resData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    } else {
      console.warn("Gemini API call failed:", await response.text());
    }
  } catch (e) {
    console.error("Error generating executive summary with Gemini:", e);
  }
  return '';
}

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
    let telegramReportTime = '09:00';
    let lastAnalyticsReportDate = '';
    let analyticsPreferences = {
      includeTraffic: true,
      includeSentiment: true,
      includeIntents: true,
      includeDemographics: true,
      includeAIExecutiveSummary: true
    };

    if (configRes.ok) {
      const configData = await configRes.json();
      const fields = configData.fields || {};
      
      if (fields.telegramBotToken?.stringValue) {
        telegramBotToken = fields.telegramBotToken.stringValue;
      }
      if (fields.telegramChatId?.stringValue) {
        telegramChatId = fields.telegramChatId.stringValue;
      }
      if (fields.telegramReportTime?.stringValue) {
        telegramReportTime = fields.telegramReportTime.stringValue;
      }
      if (fields.lastAnalyticsReportDate?.stringValue) {
        lastAnalyticsReportDate = fields.lastAnalyticsReportDate.stringValue;
      }
      if (fields.telegramAnalyticsPreferences?.mapValue?.fields) {
        const p = fields.telegramAnalyticsPreferences.mapValue.fields;
        analyticsPreferences = {
          includeTraffic: p.includeTraffic ? p.includeTraffic.booleanValue : true,
          includeSentiment: p.includeSentiment ? p.includeSentiment.booleanValue : true,
          includeIntents: p.includeIntents ? p.includeIntents.booleanValue : true,
          includeDemographics: p.includeDemographics ? p.includeDemographics.booleanValue : true,
          includeAIExecutiveSummary: p.includeAIExecutiveSummary ? p.includeAIExecutiveSummary.booleanValue : true
        };
      }
    }

    // 3. Time Check (Colombia Time - America/Bogota) & Deduplication
    const isForce = req.query.force === 'true' || req.body?.force === true;
    const nowBogota = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
    
    if (!isForce) {
      const reportHour = parseInt(telegramReportTime.split(':')[0], 10);
      const currentHour = nowBogota.getHours();
      
      if (currentHour !== reportHour) {
        return res.status(200).json({ 
          success: true, 
          message: `Skipped: current hour (${currentHour}) does not match target report hour (${reportHour}) in Colombia.` 
        });
      }

      const todayStr = nowBogota.toISOString().split('T')[0];
      if (lastAnalyticsReportDate === todayStr) {
        return res.status(200).json({ 
          success: true, 
          message: `Skipped: daily report already sent today (${todayStr}).` 
        });
      }

      // Record daily report timestamp in Firestore
      try {
        await fetch(`https://firestore.googleapis.com/v1/${configPath}?updateMask.fieldPaths=lastAnalyticsReportDate`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fields: {
              lastAnalyticsReportDate: { stringValue: todayStr }
            }
          })
        });
      } catch (dbErr) {
        console.warn("Failed to set lastAnalyticsReportDate:", dbErr);
      }
    }

    // 4. Fetch all conversations from Firestore REST API using runQuery
    const queryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
    const convRes = await fetch(queryUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'conversations' }],
          orderBy: [{ field: { fieldPath: 'lastUpdated' }, direction: 'DESCENDING' }],
          limit: 300
        }
      })
    });

    if (!convRes.ok) {
      const errText = await convRes.text();
      throw new Error(`Failed to fetch conversations: ${errText}`);
    }

    const results = await convRes.json();
    // runQuery returns an array of { document: {...} }, map it to match previous document array format
    const documents = results.map(r => r.document).filter(Boolean);

    // Parse Firestore REST API document format
    const parsedSessions = documents.map(doc => {
      const fields = doc.fields || {};
      
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

    // 5. Filter for sessions from the last 24 hours
    const last24hMs = 24 * 60 * 60 * 1000;
    const last24hSessions = parsedSessions.filter(s => {
      const updatedTime = new Date(s.lastUpdated).getTime();
      return (nowBogota.getTime() - updatedTime) <= last24hMs;
    });

    let reportText = '';
    let reportSubject = `Reporte de Analítica de Chatbot - ${nowBogota.toLocaleDateString('es-CO')}`;

    if (last24hSessions.length === 0) {
      reportText = `📊 <b>Reporte Diario de Chatbot</b>\n\nNo se registraron interacciones en las últimas 24 horas. ¡El sistema sigue operativo!`;
    } else {
      const totalNew = last24hSessions.length;
      const unitecCount = last24hSessions.filter(s => s.brandId === 'unitec').length;
      const buildingCount = last24hSessions.filter(s => s.brandId === 'building').length;
      const activeStatus = last24hSessions.filter(s => s.status === 'active').length;
      const completedStatus = last24hSessions.filter(s => s.status === 'completed').length;
      const interventionCount = last24hSessions.filter(s => s.status === 'human_requested' || s.status === 'human_assigned').length;

      reportText = `📊 <b>Reporte Diario de Chatbot</b>\n` +
                   `📅 Fecha: <b>${nowBogota.toLocaleDateString('es-CO')}</b>\n` +
                   `⏰ Hora de ejecución: <b>${telegramReportTime} (COL)</b>\n\n`;

      // MODULE: Traffic
      if (analyticsPreferences.includeTraffic) {
        // Traffic trends by hour
        const hourlyCounts = {};
        last24hSessions.forEach(s => {
          const bogotaTime = new Date(new Date(s.createdAt).toLocaleString('en-US', { timeZone: 'America/Bogota' }));
          const hr = bogotaTime.getHours();
          hourlyCounts[hr] = (hourlyCounts[hr] || 0) + 1;
        });

        let peakHour = -1;
        let maxCount = 0;
        for (const [h, count] of Object.entries(hourlyCounts)) {
          if (count > maxCount) {
            maxCount = count;
            peakHour = parseInt(h, 10);
          }
        }
        const peakHourStr = peakHour !== -1 ? `${peakHour.toString().padStart(2, '0')}:00 - ${(peakHour+1).toString().padStart(2, '0')}:00` : 'N/A';

        reportText += `📈 <b>Métricas de Tráfico:</b>\n` +
                     `• Nuevas Sesiones: <b>${totalNew}</b> (UNITEC: <b>${unitecCount}</b> | Building: <b>${buildingCount}</b>)\n` +
                     `• Activas: <b>${activeStatus}</b> | Completadas: <b>${completedStatus}</b> | Intervenidas: <b>${interventionCount}</b>\n` +
                     `• Hora Pico: <b>${peakHourStr}</b>\n\n`;
      }

      // MODULE: Sentiment
      if (analyticsPreferences.includeSentiment) {
        let positive = 0, neutral = 0, negative = 0;
        last24hSessions.forEach(s => {
          if (s.sentimentScore > 0.3) positive++;
          else if (s.sentimentScore < -0.3) negative++;
          else neutral++;
        });
        reportText += `🧠 <b>Análisis de Sentimiento:</b>\n` +
                     `🟢 Positivo: <b>${positive}</b> | 🟡 Neutral: <b>${neutral}</b> | 🔴 Negativo: <b>${negative}</b>\n\n`;
      }

      // MODULE: Intentions
      if (analyticsPreferences.includeIntents) {
        const intentCounts = {};
        last24hSessions.forEach(s => {
          const intent = s.intentCategory || 'General / Desconocido';
          intentCounts[intent] = (intentCounts[intent] || 0) + 1;
        });
        const topIntentsList = Object.entries(intentCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([intent, count]) => `  • ${intent}: <b>${count}</b>`)
          .join('\n');

        reportText += `🎯 <b>Principales Intenciones:</b>\n${topIntentsList || '  Ninguna registrada'}\n\n`;
      }

      // MODULE: Demographics
      if (analyticsPreferences.includeDemographics) {
        const profCounts = {};
        last24hSessions.forEach(s => {
          const prof = s.extractedData?.profession || 'No especificado';
          profCounts[prof] = (profCounts[prof] || 0) + 1;
        });
        const demographicsList = Object.entries(profCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([prof, count]) => `  • ${prof}: <b>${count}</b>`)
          .join('\n');

        reportText += `👥 <b>Perfil de Profesiones:</b>\n${demographicsList || '  Ninguno registrado'}\n\n`;
      }

      // MODULE: AI Executive Summary
      if (analyticsPreferences.includeAIExecutiveSummary) {
        const geminiKeyToUse = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
        const summary = await generateAIExecutiveSummary(last24hSessions, geminiKeyToUse);
        if (summary) {
          reportText += `📝 <b>Resumen Ejecutivo (IA):</b>\n<i>${summary}</i>\n\n`;
        }
      }

      // Add a small footer list of last interactions (limit to 5 for brevity)
      let customerListHtml = '';
      last24hSessions.slice(0, 5).forEach((s, idx) => {
        const name = s.customerName || s.extractedData?.name || 'Cliente Anónimo';
        const phone = s.customerPhone || s.extractedData?.phone || 'No provisto';
        const lastMsg = s.lastMessage || 'Sin mensajes';
        customerListHtml += `  ${idx + 1}. <b>${name}</b> (Tel: <code>${phone}</code>): <i>"${lastMsg.slice(0, 60)}..."</i>\n`;
      });

      if (customerListHtml) {
        reportText += `👥 <b>Últimas Interacciones:</b>\n${customerListHtml}\n`;
      }

      reportText += `🔗 <i>Acceda al Panel de Administración para ver más detalles.</i>`;
    }

    // 6. Dispatch to Telegram Group/Channel
    if (telegramBotToken && telegramChatId) {
      const chatIds = telegramChatId.split(',').map(id => id.trim()).filter(Boolean);
      for (const chatId of chatIds) {
        try {
          const telegramUrl = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
          await fetch(telegramUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: reportText,
              parse_mode: 'HTML'
            })
          });
        } catch (tgErr) {
          console.error(`Failed to send daily report to Telegram Chat ID ${chatId}:`, tgErr);
        }
      }
    }

    // 7. Dispatch Daily Email via Resend if API Key is configured
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'lidermarketingonline@espaciosimportados.com.co';
    if (RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`
          },
          body: JSON.stringify({
            from: 'UniTEC AI Desk <onboarding@resend.dev>',
            to: [ADMIN_EMAIL],
            subject: reportSubject,
            html: reportText.replace(/\n/g, '<br/>')
          }),
        });
      } catch (emailErr) {
        console.error("Failed to send daily report email:", emailErr);
      }
    }

    return res.status(200).json({ success: true, sessionsReported: last24hSessions.length });
  } catch (error) {
    console.error("Daily analytics execution error:", error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message || String(error) });
  }
}
