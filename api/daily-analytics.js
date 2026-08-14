import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const firebaseConfig = require('../firebase-applet-config.json');

/** Format seconds into a human-readable string */
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return 'N/A';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/** Generate an AI executive summary with Gemini */
async function generateAIExecutiveSummary(sessions, metrics, apiKey) {
  if (!apiKey || sessions.length === 0) return '';

  const condensed = sessions.map(s => ({
    name: s.customerName || s.extractedData?.name || 'Anónimo',
    profession: s.extractedData?.profession || 'No especificada',
    intent: s.intentCategory || 'Consulta General',
    sentiment: s.sentimentScore > 0.3 ? 'Positivo' : s.sentimentScore < -0.3 ? 'Negativo' : 'Neutral',
    status: s.status,
    source: s.source,
    lastMessage: s.lastMessage || ''
  })).slice(0, 20);

  const metricsContext = `
- Usuarios Totales: ${metrics.total}
- Abandonaron en Saludo: ${metrics.abandonedAtGreeting}
- Abandonaron Parcialmente: ${metrics.abandonedPartial}
- Completaron: ${metrics.completed}
- Tasa de Conversión: ${metrics.conversionRate}%
- Tiempo Promedio de Conversación: ${metrics.avgDuration}
- Promedio de Mensajes por Usuario: ${metrics.avgMessages}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Eres el CTO de Unitec USA Design. Analiza estas métricas del chatbot y ofrece un resumen ejecutivo conciso de 2-3 frases en español, mencionando los puntos más críticos y una recomendación de acción inmediata para el equipo de ventas:\n\nMÉTRICAS:\n${metricsContext}\n\nINTERACCIONES RECIENTES:\n${JSON.stringify(condensed)}`
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
    console.error("Error generating executive summary:", e);
  }
  return '';
}

/** Build the HTML Telegram report (daily or weekly) */
function buildReportText(sessions, metrics, periodLabel, reportTime, isWeekly, googleAnalyticsVisits) {
  const icon = isWeekly ? '📋' : '📊';
  const periodType = isWeekly ? 'Semanal' : 'Diario';

  let text = `${icon} <b>Reporte ${periodType} de Chatbot</b>\n` +
             `📅 Período: <b>${periodLabel}</b>\n` +
             `⏰ Generado: <b>${reportTime} (COL)</b>\n\n`;

  // ── SECCIÓN 1: FLUJO DE USUARIOS ──────────────────────────
  const gaVisits = parseInt(googleAnalyticsVisits || '3188', 10) || 3188;
  const startedChatSessions = sessions.filter(s => (s.analytics?.messageCount || 0) > 0).length;
  const gaConversionRate = gaVisits > 0 ? ((startedChatSessions / gaVisits) * 100).toFixed(1) : '0.0';

  text += `🔀 <b>Flujo de Usuarios:</b>\n`;
  text += `┌─────────────────────────────────────────\n`;
  text += `│ 📈 Visitas Web (GA):          <b>${gaVisits.toLocaleString('es')}</b>\n`;
  text += `│ 👤 Cargas de Chatbot (Loads): <b>${metrics.total}</b>\n`;
  text += `│ 💬 Chats Iniciados:           <b>${startedChatSessions}</b> (${gaConversionRate}% conv. real)\n`;
  text += `│ 👋 Solo vieron el saludo:     <b>${metrics.abandonedAtGreeting}</b>\n`;
  text += `│ 🔄 Abandono parcial:          <b>${metrics.abandonedPartial}</b>\n`;
  text += `│ ✅ Completaron flujo:         <b>${metrics.completed}</b>\n`;
  text += `│ 🆘 Intervención humana:       <b>${metrics.humanRequested}</b>\n`;
  text += `└─────────────────────────────────────────\n\n`;

  // ── SECCIÓN 2: TASA DE CONVERSIÓN ─────────────────────────
  text += `📈 <b>Tasa de Conversión:</b>\n`;
  text += `• Completados / Total:   <b>${metrics.conversionRate}%</b>\n`;
  text += `• Respondieron algo:     <b>${metrics.responseRate}%</b> (${metrics.total - metrics.abandonedAtGreeting} de ${metrics.total})\n`;
  text += `• Solo saludo (no resp): <b>${metrics.greetingAbandonRate}%</b>\n\n`;

  // ── SECCIÓN 3: TIEMPOS PROMEDIO ───────────────────────────
  text += `⏱️ <b>Tiempos Promedio:</b>\n`;
  text += `• Hasta primer mensaje:  <b>${metrics.avgTimeToFirstMsg}</b>\n`;
  text += `• Hasta finalización:    <b>${metrics.avgCompletionTime}</b>\n`;
  text += `• Hasta abandono:        <b>${metrics.avgAbandonTime}</b>\n\n`;

  // ── SECCIÓN 4: INTERACCIONES ──────────────────────────────
  text += `💬 <b>Interacciones por Usuario:</b>\n`;
  text += `• Mensajes promedio/usuario: <b>${metrics.avgMessages}</b>\n`;
  text += `• Interacciones de UI (botones): <b>${metrics.totalUIInteractions}</b>\n\n`;

  // ── SECCIÓN 5: SENTIMIENTO ────────────────────────────────
  text += `🧠 <b>Sentimiento:</b>\n`;
  text += `🟢 Positivo: <b>${metrics.positive}</b> | 🟡 Neutral: <b>${metrics.neutral}</b> | 🔴 Negativo: <b>${metrics.negative}</b>\n\n`;

  // ── SECCIÓN 6: SEGMENTACIÓN POR FUENTE ───────────────────
  text += `📡 <b>Fuente de Ingreso:</b>\n`;
  text += `• 🌐 Web: <b>${metrics.sourceWeb}</b> | 📱 WhatsApp: <b>${metrics.sourceWhatsapp}</b> | 📞 Teléfono: <b>${metrics.sourcePhone}</b>\n\n`;

  // ── SECCIÓN 7: INTENCIONES TOP ────────────────────────────
  if (metrics.topIntents && metrics.topIntents.length > 0) {
    text += `🎯 <b>Principales Intenciones:</b>\n`;
    metrics.topIntents.forEach(([intent, count]) => {
      text += `  • ${intent}: <b>${count}</b>\n`;
    });
    text += '\n';
  }

  // ── SECCIÓN 8: HORA PICO ──────────────────────────────────
  if (metrics.peakHour) {
    text += `⚡ <b>Hora Pico:</b> <b>${metrics.peakHour}</b>\n\n`;
  }

  // ── SECCIÓN 9: ÚLTIMAS INTERACCIONES (max 5) ──────────────
  const recentSessions = sessions.slice(0, 5);
  if (recentSessions.length > 0) {
    text += `👥 <b>Últimas Interacciones:</b>\n`;
    recentSessions.forEach((s, i) => {
      const name = s.customerName || s.extractedData?.name || 'Anónimo';
      const phone = s.customerPhone || s.extractedData?.phone || 'N/A';
      const msg = (s.lastMessage || 'Sin mensajes').slice(0, 55);
      text += `  ${i + 1}. <b>${name}</b> (📞<code>${phone}</code>): <i>"${msg}…"</i>\n`;
    });
    text += '\n';
  }

  text += `🔗 <i>Panel Admin: https://unitec-front-desk.vercel.app/?admin=true</i>`;
  return text;
}

/** Compute all metrics from a list of parsed sessions */
function computeMetrics(sessions) {
  const total = sessions.length;
  if (total === 0) return null;

  const completed = sessions.filter(s => s.status === 'completed').length;
  const abandonedAtGreeting = sessions.filter(s => s.status === 'abandoned_at_greeting').length;
  const abandonedPartial = sessions.filter(s => s.status === 'abandoned').length;
  const humanRequested = sessions.filter(s => s.status === 'human_requested' || s.status === 'human_assigned').length;

  const conversionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0';
  const responseRate = total > 0 ? (((total - abandonedAtGreeting) / total) * 100).toFixed(1) : '0.0';
  const greetingAbandonRate = total > 0 ? ((abandonedAtGreeting / total) * 100).toFixed(1) : '0.0';

  // Time metrics
  const completedWithDuration = sessions.filter(s => s.status === 'completed' && s.duration > 0);
  const abandonedWithDuration = sessions.filter(s => (s.status === 'abandoned' || s.status === 'abandoned_at_greeting') && s.duration > 0);
  const withFirstMsgTime = sessions.filter(s => s.firstUserMessageAt && s.createdAt);

  const avgCompletionTime = completedWithDuration.length > 0
    ? formatDuration(completedWithDuration.reduce((sum, s) => sum + s.duration, 0) / completedWithDuration.length)
    : 'N/A';

  const avgAbandonTime = abandonedWithDuration.length > 0
    ? formatDuration(abandonedWithDuration.reduce((sum, s) => sum + s.duration, 0) / abandonedWithDuration.length)
    : 'N/A';

  const avgTimeToFirstMsg = withFirstMsgTime.length > 0
    ? formatDuration(Math.max(0, withFirstMsgTime.reduce((sum, s) => {
        return sum + (new Date(s.firstUserMessageAt).getTime() - new Date(s.createdAt).getTime()) / 1000;
      }, 0) / withFirstMsgTime.length))
    : 'N/A';

  // Avg messages per user
  const sessionsWithMsgs = sessions.filter(s => s.analytics?.messageCount > 0);
  const avgMessages = sessionsWithMsgs.length > 0
    ? (sessionsWithMsgs.reduce((sum, s) => sum + (s.analytics?.messageCount || 0), 0) / sessionsWithMsgs.length).toFixed(1)
    : '0';

  // UI interactions total
  const totalUIInteractions = sessions.reduce((sum, s) => sum + (s.uiInteractions || 0), 0);

  // Average duration overall
  const allWithDuration = sessions.filter(s => s.duration > 0);
  const avgDuration = allWithDuration.length > 0
    ? formatDuration(allWithDuration.reduce((sum, s) => sum + s.duration, 0) / allWithDuration.length)
    : 'N/A';

  // Sentiment
  let positive = 0, neutral = 0, negative = 0;
  sessions.forEach(s => {
    if (s.sentimentScore > 0.3) positive++;
    else if (s.sentimentScore < -0.3) negative++;
    else neutral++;
  });

  // Source segmentation
  const sourceWeb = sessions.filter(s => s.source === 'web').length;
  const sourceWhatsapp = sessions.filter(s => s.source === 'whatsapp').length;
  const sourcePhone = sessions.filter(s => s.source === 'phone').length;

  // Top intents
  const intentCounts = {};
  sessions.forEach(s => {
    const intent = s.intentCategory || 'General / Desconocido';
    intentCounts[intent] = (intentCounts[intent] || 0) + 1;
  });
  const topIntents = Object.entries(intentCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

  // Peak hour
  const hourlyCounts = {};
  sessions.forEach(s => {
    const hr = new Date(new Date(s.createdAt).toLocaleString('en-US', { timeZone: 'America/Bogota' })).getHours();
    hourlyCounts[hr] = (hourlyCounts[hr] || 0) + 1;
  });
  let peakHour = null, maxCount = 0;
  for (const [h, count] of Object.entries(hourlyCounts)) {
    if (count > maxCount) { maxCount = count; peakHour = parseInt(h, 10); }
  }
  const peakHourStr = peakHour !== null
    ? `${String(peakHour).padStart(2, '0')}:00 - ${String(peakHour + 1).padStart(2, '0')}:00 (${maxCount} sesiones)`
    : null;

  return {
    total, completed, abandonedAtGreeting, abandonedPartial, humanRequested,
    conversionRate, responseRate, greetingAbandonRate,
    avgCompletionTime, avgAbandonTime, avgTimeToFirstMsg, avgDuration,
    avgMessages, totalUIInteractions,
    positive, neutral, negative,
    sourceWeb, sourceWhatsapp, sourcePhone,
    topIntents, peakHour: peakHourStr
  };
}

/** Parse a Firestore REST API document into a flat session object */
function parseFirestoreDoc(doc) {
  const fields = doc.fields || {};

  const parseMap = (mapField) => {
    if (!mapField?.mapValue?.fields) return {};
    const result = {};
    for (const [key, val] of Object.entries(mapField.mapValue.fields)) {
      result[key] = val.stringValue ?? val.integerValue ?? val.doubleValue ?? val.booleanValue ?? '';
    }
    return result;
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
    firstUserMessageAt: fields.firstUserMessageAt?.stringValue || null,
    flowStage: fields.flowStage?.stringValue || 'greeted',
    customerName: fields.customerName?.stringValue || '',
    customerPhone: fields.customerPhone?.stringValue || '',
    customerEmail: fields.customerEmail?.stringValue || '',
    lastMessage: fields.lastMessage?.stringValue || '',
    intentCategory: fields.intentCategory?.stringValue || '',
    sentimentScore: parseFloat(
      fields.sentimentScore?.doubleValue ??
      fields.sentimentScore?.integerValue ??
      '0'
    ),
    duration: parseInt(fields.duration?.integerValue ?? fields.duration?.doubleValue ?? '0', 10),
    uiInteractions: parseInt(fields.uiInteractions?.integerValue ?? '0', 10),
    country: fields.country?.stringValue || '',
    city: fields.city?.stringValue || '',
    campaign: fields.campaign?.stringValue || '',
    topics,
    extractedData: parseMap(fields.extractedData),
    // Parse analytics sub-map with proper numeric types
    analytics: (() => {
      const af = fields.analytics?.mapValue?.fields || {};
      return {
        messageCount: parseInt(af.messageCount?.integerValue ?? af.messageCount?.doubleValue ?? '0', 10),
        userMessageCount: parseInt(af.userMessageCount?.integerValue ?? af.userMessageCount?.doubleValue ?? '0', 10),
        avgResponseTime: parseFloat(af.avgResponseTime?.doubleValue ?? af.avgResponseTime?.integerValue ?? '0'),
        escalationCount: parseInt(af.escalationCount?.integerValue ?? '0', 10),
        staffInteractions: parseInt(af.staffInteractions?.integerValue ?? '0', 10),
        productMentions: af.productMentions?.arrayValue?.values?.map(v => v.stringValue).filter(Boolean) || []
      };
    })()
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const apiKey = firebaseConfig.apiKey;
    const projectId = firebaseConfig.projectId;

    // 1. Authenticate anonymously
    const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true })
    });
    if (!authRes.ok) throw new Error(`Firebase Auth failed: ${await authRes.text()}`);
    const { idToken } = await authRes.json();

    // 2. Load config from Firestore
    const configPath = `projects/${projectId}/databases/(default)/documents/config/main`;
    const configRes = await fetch(`https://firestore.googleapis.com/v1/${configPath}`, {
      headers: { 'Authorization': `Bearer ${idToken}` }
    });

    let telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || '';
    let telegramChatId = process.env.TELEGRAM_CHAT_ID || '';
    let telegramReportTime = '09:00';
    let googleAnalyticsVisits = '3188';
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
      if (fields.telegramBotToken?.stringValue) telegramBotToken = fields.telegramBotToken.stringValue;
      if (fields.telegramChatId?.stringValue) telegramChatId = fields.telegramChatId.stringValue;
      if (fields.telegramReportTime?.stringValue) telegramReportTime = fields.telegramReportTime.stringValue;
      if (fields.googleAnalyticsVisits?.stringValue) googleAnalyticsVisits = fields.googleAnalyticsVisits.stringValue;
      if (fields.lastAnalyticsReportDate?.stringValue) lastAnalyticsReportDate = fields.lastAnalyticsReportDate.stringValue;
      if (fields.telegramAnalyticsPreferences?.mapValue?.fields) {
        const p = fields.telegramAnalyticsPreferences.mapValue.fields;
        analyticsPreferences = {
          includeTraffic: p.includeTraffic?.booleanValue ?? true,
          includeSentiment: p.includeSentiment?.booleanValue ?? true,
          includeIntents: p.includeIntents?.booleanValue ?? true,
          includeDemographics: p.includeDemographics?.booleanValue ?? true,
          includeAIExecutiveSummary: p.includeAIExecutiveSummary?.booleanValue ?? true
        };
      }
    }

    // 3. Time check (Colombia) & deduplication
    const isForce = req.query.force === 'true' || req.body?.force === true;
    const isWeekly = req.query.weekly === 'true' || req.body?.weekly === true;
    const nowBogota = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));

    if (!isForce) {
      const reportHour = parseInt(telegramReportTime.split(':')[0], 10);
      if (nowBogota.getHours() !== reportHour) {
        return res.status(200).json({ success: true, message: `Skipped: hour mismatch (current=${nowBogota.getHours()}, target=${reportHour})` });
      }
      const todayStr = nowBogota.toISOString().split('T')[0];
      if (lastAnalyticsReportDate === todayStr) {
        return res.status(200).json({ success: true, message: `Skipped: already sent today (${todayStr})` });
      }
      try {
        await fetch(`https://firestore.googleapis.com/v1/${configPath}?updateMask.fieldPaths=lastAnalyticsReportDate`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: { lastAnalyticsReportDate: { stringValue: todayStr } } })
        });
      } catch (dbErr) { console.warn("Failed to set lastAnalyticsReportDate:", dbErr); }
    }

    // 4. Fetch conversations from Firestore
    const queryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
    const convRes = await fetch(queryUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'conversations' }],
          orderBy: [{ field: { fieldPath: 'lastUpdated' }, direction: 'DESCENDING' }],
          limit: 500
        }
      })
    });
    if (!convRes.ok) throw new Error(`Failed to fetch conversations: ${await convRes.text()}`);

    const rawResults = await convRes.json();
    const allSessions = rawResults.map(r => r.document).filter(Boolean).map(parseFirestoreDoc);

    // 5. Filter by time window (24h daily, 7 days weekly)
    const windowMs = isWeekly ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const filteredSessions = allSessions.filter(s => {
      return (nowBogota.getTime() - new Date(s.lastUpdated).getTime()) <= windowMs;
    });

    // 6. Compute all metrics
    const metrics = computeMetrics(filteredSessions);

    let reportText = '';
    const dateLabel = isWeekly
      ? `${new Date(nowBogota.getTime() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('es-CO')} – ${nowBogota.toLocaleDateString('es-CO')}`
      : nowBogota.toLocaleDateString('es-CO');

    if (!metrics || filteredSessions.length === 0) {
      reportText = `📊 <b>Reporte ${isWeekly ? 'Semanal' : 'Diario'} de Chatbot</b>\n\n` +
                   `📅 <b>${dateLabel}</b>\n\n` +
                   `ℹ️ No se registraron interacciones en este período. ¡El sistema sigue operativo!`;
    } else {
      // AI Executive Summary
      let aiSummary = '';
      if (analyticsPreferences.includeAIExecutiveSummary) {
        const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
        aiSummary = await generateAIExecutiveSummary(filteredSessions, metrics, geminiKey);
      }

      reportText = buildReportText(filteredSessions, metrics, dateLabel, telegramReportTime, isWeekly, googleAnalyticsVisits);

      if (aiSummary) {
        reportText += `\n\n📝 <b>Resumen Ejecutivo (IA):</b>\n<i>${aiSummary}</i>`;
      }
    }

    // 7. Send to Telegram (supports multiple bots) — report delivery outcome
    const telegramResults = [];
    if (telegramBotToken && telegramChatId) {
      const botTokens = telegramBotToken.split(',').map(t => t.trim()).filter(Boolean);
      const chatIds = telegramChatId.split(',').map(id => id.trim()).filter(Boolean);

      for (let i = 0; i < chatIds.length; i++) {
        const chatId = chatIds[i];
        const token = botTokens[i] || botTokens[0];
        if (!token) continue;
        try {
          const tgUrl = `https://api.telegram.org/bot${token}/sendMessage`;
          const tgRes = await fetch(tgUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: reportText, parse_mode: 'HTML' })
          });
          const tgOk = tgRes.ok;
          const tgData = await tgRes.json().catch(() => ({}));
          telegramResults.push({ chatId, ok: tgOk, messageId: tgData?.result?.message_id, error: tgOk ? undefined : JSON.stringify(tgData).slice(0, 200) });
        } catch (tgErr) {
          console.error(`Telegram send failed for chat_id ${chatId}:`, tgErr);
          telegramResults.push({ chatId, ok: false, error: String(tgErr).slice(0, 200) });
        }
      }
    }

    // 8. Send email via Resend (if configured)
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'lidermarketingonline@espaciosimportados.com.co';
    if (RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: 'UniTEC AI Desk <onboarding@resend.dev>',
            to: [ADMIN_EMAIL],
            subject: `Reporte ${isWeekly ? 'Semanal' : 'Diario'} Chatbot - ${dateLabel}`,
            html: reportText.replace(/\n/g, '<br/>')
          })
        });
      } catch (emailErr) {
        console.error("Email send failed:", emailErr);
      }
    }

    return res.status(200).json({
      success: true,
      sessionsReported: filteredSessions.length,
      metrics: metrics || {},
      period: isWeekly ? 'weekly' : 'daily',
      telegram: telegramResults
    });

  } catch (error) {
    console.error("Daily/Weekly analytics error:", error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message || String(error) });
  }
}
