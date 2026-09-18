import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const firebaseConfig = require('../firebase-applet-config.json');
import ExcelJS from 'exceljs';

/** Format seconds into a human-readable string */
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return 'N/A';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/**
 * Session ids de diagnóstico/prueba — el filtro vive en `_analytics-core.js`
 * para que el panel Mission Control y este informe excluyan EXACTAMENTE lo mismo.
 * (Antes cada superficie tenía su propia lista y los números divergían.)
 */
import { isTestSession, funnel, STEP_ORDER } from './_analytics-core.js';

/**
 * Keyword intent classification.
 * NOTE: intentCategory is never populated server-side (CTO audit 2026-09-04), so the
 * report derives intent from the LAST USER MESSAGE stored in the session (lastMessage).
 */
function classifyIntent(text) {
  const t = String(text || '').toLowerCase();
  if (/(cotiz|presupuesto|precio|quote|budget|cuanto cuesta|cuanto vale|cost|costo|valor)/.test(t)) return 'Cotización / Precio';
  if (/(asesor|humano|staff|agent|llamar|call|hablar con|atencion|atención)/.test(t)) return 'Atención humana / Staff';
  if (/(whatsapp|wa\.me|guasap|whats)/.test(t)) return 'WhatsApp / Contacto';
  if (/(stock|disponibilidad|disponible|disponibles|hay en|existencia)/.test(t)) return 'Stock / Disponibilidad';
  if (/(catalogo|catálogo|productos|lista|folio)/.test(t)) return 'Catálogo / Productos';
  if (/(instalac|instalador|montaje|instalación)/.test(t)) return 'Instalación';
  if (/(ubicad|donde estan|donde quedan|donde están|direccion|dirección|bodega|punto fisico|local)/.test(t)) return 'Ubicación';
  if (/(pedido|comprar|orden|factura|carrito)/.test(t)) return 'Pedido / Compra';
  if (/(envio|envío|despacho|entrega|domicilio)/.test(t)) return 'Envío / Entrega';
  if (/(pago|transferencia|medio de pago)/.test(t)) return 'Medio de pago';
  return 'Consulta general';
}

/** Generate an AI executive summary with Gemini */
async function generateAIExecutiveSummary(sessions, metrics, apiKey) {
  if (!apiKey || sessions.length === 0) return '';

  const condensed = sessions.map(s => ({
    name: s.customerName || s.extractedData?.name || 'Anónimo',
    profession: s.extractedData?.profession || 'No especificada',
    intent: classifyIntent(s.lastMessage || ''),
    sentiment: s.sentimentScore > 0.3 ? 'Positivo' : s.sentimentScore < -0.3 ? 'Negativo' : 'Neutral',
    status: s.status,
    source: s.source,
    lastMessage: s.lastMessage || ''
  })).slice(0, 20);

  const metricsContext = `
- Usuarios Totales (cargas): ${metrics.total}
- Interacciones REALES (escribieron): ${metrics.realInteractions}
- Solo saludo (abrieron y NO escribieron): ${metrics.welcomeOnly}
- Sin mensaje guardado: ${metrics.noMessage}
- Pruebas técnicas excluidas: ${metrics.testCount}
- Solicitudes de cotización/precio: ${metrics.quoteRequested}
- Tasa real (reales / cargas): ${metrics.responseRate}%
- Completaron flujo: ${metrics.completed}
- Intervención humana: ${metrics.humanRequested}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Eres el CTO de Unitec USA Design. Analiza estas métricas del chatbot y ofrece un resumen ejecutivo conciso de 2-3 frases en español, mencionando los puntos más críticos y una recomendación de acción inmediata para el equipo de ventas:\n\nMÉTRICAS:\n${metricsContext}\n\nINTERACCIONES RECIENTES (reales):\n${JSON.stringify(condensed)}`
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

/** Build a styled Excel workbook (Buffer) with the real analytics for the period */
async function buildDailyWorkbook(sessions, metrics, periodLabel, isWeekly) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'UniTEC AI Desk';
  const DARK = '1F4E78', GREEN = '1E7A46', AMBER = 'B45309', RED = 'B91C1C', GRAY = '475569';

  const headerStyle = (fill) => ({ font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }, alignment: { vertical: 'middle' } });

  // ── Hoja 1: Resumen ──
  const ws1 = wb.addWorksheet('Resumen', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws1.columns = [{ width: 42 }, { width: 12 }, { width: 80 }];
  ws1.getCell('A1').value = `UNITEC — Reporte ${isWeekly ? 'Semanal' : 'Diario'} Chatbot · ${periodLabel}`;
  ws1.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  ws1.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } };
  ws1.mergeCells('A1:C1');
  ws1.getRow(1).height = 26;
  ws1.getCell('A2').value = 'Métricas reales (solo sesiones donde el usuario escribió ≥1 mensaje; pruebas técnicas excluidas)';
  ws1.getCell('A2').font = { size: 9, italic: true, color: { argb: GRAY } };
  ws1.mergeCells('A2:C2');
  const rows = [
    ['Indicador', 'Valor', 'Nota'],
    ['Sesiones en el período (cargas chatbot)', metrics.total, 'Total de conversaciones creadas.'],
    ['Interacción REAL (usuario escribió)', metrics.realInteractions ?? 0, 'Base para conversión real.'],
    ['Abrieron y NO escribieron (solo saludo)', metrics.welcomeOnly ?? 0, 'El bot guardó su saludo automático.'],
    ['Sin mensaje guardado', metrics.noMessage ?? 0, 'Abrieron pero no se registró mensaje.'],
    ['Pruebas técnicas excluidas', metrics.testCount ?? 0, 'Sesiones diag/test del desarrollo.'],
    ['Solicitudes de cotización/precio', metrics.quoteRequested ?? 0, 'Detectadas por texto del usuario.'],
    ['Completaron flujo', metrics.completed, 'Status completed.'],
    ['Intervención humana', metrics.humanRequested, 'human_requested + human_assigned.'],
    ['Tasa reales / cargas (%)', metrics.responseRate ?? '0.0', 'Interacciones reales ÷ cargas.'],
    ['Msgs promedio usuario/chat real', metrics.avgMessages ?? '0', 'Solo interacciones reales.'],
    ['Tiempo hasta primer mensaje', metrics.avgTimeToFirstMsg, 'Primer mensaje del usuario.'],
  ];
  let r = 3;
  rows.forEach((row, i) => {
    row.forEach((v, c) => { ws1.getCell(r, c + 1).value = v; });
    if (i === 0) ws1.getRow(r).eachCell(cell => { cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } }; });
    else if (i === 2) ws1.getRow(r).eachCell(cell => { cell.font = { bold: true, color: { argb: RED } }; });
    else if (i === 3 || i === 4) ws1.getRow(r).eachCell(cell => { cell.font = { color: { argb: AMBER } }; });
    ws1.getRow(r).height = 18;
    r++;
  });

  // ── Hoja 2: Interacciones reales ──
  const ws2 = wb.addWorksheet('Interacciones reales', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws2.columns = [{ width: 16 }, { width: 28 }, { width: 18 }, { width: 22 }, { width: 14 }, { width: 70 }];
  ws2.getRow(1).values = ['Fecha (COL)', 'Sesión', 'Teléfono', 'Nombre', 'Intención', 'Último mensaje del usuario'];
  ws2.getRow(1).eachCell(cell => Object.assign(cell, { font: headerStyle(DARK).font, fill: headerStyle(DARK).fill }));
  const realSessions = sessions
    .filter(s => !isTestSession(s.id) && (s.analytics?.userMessageCount || 0) > 0)
    .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
  if (realSessions.length === 0) {
    ws2.getCell('A2').value = 'No hubo interacciones reales en el período.';
  } else {
    realSessions.forEach((s, i) => {
      const row = i + 2;
      const dt = new Date(s.createdAt);
      ws2.getCell('A' + row).value = dt.toLocaleString('es-CO', { timeZone: 'America/Bogota' });
      ws2.getCell('B' + row).value = s.id;
      ws2.getCell('C' + row).value = s.customerPhone || s.extractedData?.phone || '';
      ws2.getCell('D' + row).value = s.customerName || s.extractedData?.name || '';
      ws2.getCell('E' + row).value = classifyIntent(s.lastMessage || '');
      ws2.getCell('F' + row).value = (s.lastMessage || '').slice(0, 300);
      ws2.getRow(row).height = 30;
    });
  }

  // ── Hoja 3: Todas las sesiones ──
  const ws3 = wb.addWorksheet('Log sesiones', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws3.columns = [{ width: 16 }, { width: 30 }, { width: 12 }, { width: 10 }, { width: 12 }, { width: 20 }, { width: 70 }];
  ws3.getRow(1).values = ['Fecha (COL)', 'Sesión', 'Mensajes', 'Del usuario', 'Marca', 'Nombre', 'Último mensaje'];
  ws3.getRow(1).eachCell(cell => Object.assign(cell, { font: headerStyle(DARK).font, fill: headerStyle(DARK).fill }));
  sessions.slice(0, 500).forEach((s, i) => {
    const row = i + 2;
    const dt = new Date(s.createdAt);
    ws3.getCell('A' + row).value = dt.toLocaleString('es-CO', { timeZone: 'America/Bogota' });
    ws3.getCell('B' + row).value = s.id;
    ws3.getCell('C' + row).value = s.analytics?.messageCount || 0;
    ws3.getCell('D' + row).value = s.analytics?.userMessageCount || 0;
    ws3.getCell('E' + row).value = s.brandId || '';
    ws3.getCell('F' + row).value = s.customerName || s.extractedData?.name || '';
    ws3.getCell('G' + row).value = (s.lastMessage || '').slice(0, 300);
  });

  // ── Hoja 4: Embudo paso a paso (mismas cifras que el panel Mission Control) ──
  const fnl = metrics.funnel;
  if (fnl && fnl.steps) {
    const ws4 = wb.addWorksheet('Embudo', { views: [{ state: 'frozen', ySplit: 1 }] });
    ws4.columns = [{ width: 42 }, { width: 20 }, { width: 14 }, { width: 18 }, { width: 52 }];
    ws4.getRow(1).values = ['Paso del flujo', 'Sesiones que llegan', '% del total', 'Se detienen aquí', 'Qué significa'];
    ws4.getRow(1).eachCell(cell => Object.assign(cell, { font: headerStyle(DARK).font, fill: headerStyle(DARK).fill }));
    fnl.steps.forEach((st, i) => {
      const row = i + 2;
      ws4.getCell('A' + row).value = st.label;
      ws4.getCell('B' + row).value = st.reached;
      ws4.getCell('C' + row).value = st.pctOfTotal / 100;
      ws4.getCell('C' + row).numFmt = '0.00%';
      ws4.getCell('D' + row).value = st.stoppedHere;
      ws4.getCell('E' + row).value = st.step === 'engaged'
        ? 'Interacción efectiva: el usuario preguntó y recibió respuesta.'
        : st.step === 'load'
          ? 'Todas las sesiones creadas en el período (widget abierto).'
          : `Se quedaron en "${st.label}".`;
    });
    const noteRow = fnl.steps.length + 3;
    ws4.getCell('A' + noteRow).value = `Sesiones: ${fnl.total} · Escribieron: ${fnl.wroteSomething} · Interacción parcial: ${fnl.partialOnboarding} · Onboarding completo: ${fnl.completedOnboarding} · Conversación real: ${fnl.realConversations} · Pruebas excluidas: ${fnl.testsExcluded}`;
    ws4.getCell('A' + noteRow).font = { italic: true, size: 9 };
    ws4.getCell('A' + (noteRow + 1)).value = 'Los pasos del onboarding (nombre/teléfono/perfil) se registran ahora en el servidor. Los usuarios que escribieron y se fueron se cuentan desde su primera intervención.';
    ws4.getCell('A' + (noteRow + 1)).font = { italic: true, size: 9 };
  }

  // ── Hoja 5: Conversaciones reales (con contacto y etapa) ──
  const realConvs = sessions.filter(s => !isTestSession(s.id) && (s.analytics?.userMessageCount || 0) > 0);
  if (realConvs.length > 0) {
    const ws5 = wb.addWorksheet('Conversaciones reales', { views: [{ state: 'frozen', ySplit: 1 }] });
    ws5.columns = [{ width: 18 }, { width: 30 }, { width: 22 }, { width: 16 }, { width: 18 }, { width: 12 }, { width: 60 }];
    ws5.getRow(1).values = ['Fecha (COL)', 'Sesión', 'Nombre', 'Teléfono', 'Etapa alcanzada', 'Msgs usuario', 'Último mensaje'];
    ws5.getRow(1).eachCell(cell => Object.assign(cell, { font: headerStyle(DARK).font, fill: headerStyle(DARK).fill }));
    realConvs.slice(0, 500).forEach((s, i) => {
      const row = i + 2;
      const dt = new Date(s.createdAt);
      ws5.getCell('A' + row).value = dt.toLocaleString('es-CO', { timeZone: 'America/Bogota' });
      ws5.getCell('B' + row).value = s.id;
      ws5.getCell('C' + row).value = s.customerName || s.extractedData?.name || 'Anónimo';
      ws5.getCell('D' + row).value = s.customerPhone || s.extractedData?.phone || '';
      ws5.getCell('E' + row).value = s.funnelStep || '';
      ws5.getCell('F' + row).value = s.analytics?.userMessageCount || 0;
      ws5.getCell('G' + row).value = (s.lastMessage || '').slice(0, 300);
      ws5.getRow(row).height = 28;
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/** Send an attached Excel document to a Telegram chat */
async function sendTelegramDocument(botToken, chatId, filename, buffer, caption) {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('caption', caption || '');
  form.append('document', new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, messageId: data?.result?.message_id, error: res.ok ? undefined : JSON.stringify(data).slice(0, 200) };
}

/** Build the HTML Telegram report (daily or weekly) */
function buildReportText(sessions, metrics, periodLabel, reportTime, isWeekly, googleAnalyticsVisits) {
  const icon = isWeekly ? '📋' : '📊';
  const periodType = isWeekly ? 'Semanal' : 'Diario';

  let text = `${icon} <b>Reporte ${periodType} de Chatbot</b>\n` +
             `📅 Período: <b>${periodLabel}</b>\n` +
             `⏰ Generado: <b>${reportTime} (COL)</b>\n\n`;

  // ── SECCIÓN 1: FLUJO DE USUARIOS (métricas REALES) ────────
  // Visitas web reales (GA4): las escribe el cron /api/ga-visits en config/main.
  // Sin dato configurado NO se inventa una cifra (antes: 3.188 hardcodeado).
  const gaParsed = parseInt(String(googleAnalyticsVisits || ''), 10);
  const gaVisits = Number.isFinite(gaParsed) && gaParsed > 0 ? gaParsed : null;
  const realChats = metrics.realInteractions || 0;
  const loadRate = metrics.total > 0 ? ((realChats / metrics.total) * 100).toFixed(1) : '0.0';
  const gaConversionRate = gaVisits ? ((realChats / gaVisits) * 100).toFixed(2) : 'n/d';

  text += `🔀 <b>Flujo de Usuarios:</b>\n`;
  text += `┌─────────────────────────────────────────\n`;
  text += `│ 📈 Visitas Web (GA):          <b>${gaVisits ? gaVisits.toLocaleString('es') : 'sin dato'}</b>\n`;
  text += `│ 👤 Cargas de Chatbot (Loads): <b>${metrics.total}</b>\n`;
  text += `│ 💬 Interacción REAL (escribieron): <b>${realChats}</b>\n`;
  text += `│    └ ${loadRate}% de cargas · ${gaConversionRate}% de visitas GA\n`;
  text += `│ 👋 Abrieron, NO escribieron:  <b>${metrics.welcomeOnly ?? 0}</b> (solo saludo)\n`;
  text += `│ 📴 Sin mensaje guardado:      <b>${metrics.noMessage ?? 0}</b>\n`;
  text += `│ 🧪 Pruebas técnicas excluidas: <b>${metrics.testCount ?? 0}</b>\n`;
  text += `│ ✅ Completaron flujo:         <b>${metrics.completed}</b>\n`;
  text += `│ 🆘 Intervención humana:       <b>${metrics.humanRequested}</b>\n`;
  text += `└─────────────────────────────────────────\n\n`;

  // ── SECCIÓN 2: CONVERSIÓN REAL ────────────────────────────
  text += `📈 <b>Tasa de Conversión:</b>\n`;
  text += `• Reales / Cargas chatbot: <b>${loadRate}%</b> (${realChats} de ${metrics.total})\n`;
  text += `• Reales / Visitas GA:     <b>${gaConversionRate}%</b>\n`;
  text += `• Abandonaron en saludo:   <b>${metrics.abandonedAtGreeting}</b>\n`;
  text += `• Abandono parcial:        <b>${metrics.abandonedPartial}</b>\n\n`;

  // ── SECCIÓN 2.b: EMBUDO PASO A PASO ───────────────────────
  // Responde la pregunta del cliente: cuántos iniciaron, cuántos avanzaron parcialmente
  // y cuántos llegaron al final. Misma fuente que el panel (/api/_analytics-core.js).
  const fnl = metrics.funnel;
  if (fnl && fnl.steps) {
    text += `🪜 <b>Embudo del chatbot:</b>\n`;
    fnl.steps.forEach((st) => {
      const bar = '█'.repeat(Math.max(0, Math.round((st.pctOfTotal / 100) * 12)));
      const paso = st.step === 'engaged' ? '💬 Conversación real' : st.step === 'menu' ? '✅ Terminó el onboarding' : st.label;
      text += `  ${bar} <b>${st.reached}</b> — ${paso}`;
      if (st.step !== 'load') text += ` <i>(${st.pctOfTotal}%, −${st.droppedBefore} en el paso anterior)</i>`;
      text += `\n`;
    });
    if (fnl.wroteSomething !== undefined) {
      text += `  ↳ Escribieron: <b>${fnl.wroteSomething}</b> · Parcial: <b>${fnl.partialOnboarding}</b> · Onboarding completo: <b>${fnl.completedOnboarding}</b> · Conversación real: <b>${fnl.realConversations}</b>\n`;
    }
    text += `\n`;
  }

  // ── SECCIÓN 3: SOLICITUDES CLAVE ──────────────────────────
  text += `🎯 <b>Solicitudes detectadas (intención por mensaje):</b>\n`;
  const intents = (metrics.topIntents || []).slice(0, 5);
  if (intents.length === 0) {
    text += `  • Sin solicitudes con texto en el período\n`;
  } else {
    intents.forEach(([intent, count]) => {
      text += `  • ${intent}: <b>${count}</b>\n`;
    });
  }
  text += `  └ Cotización/Precio pedidos: <b>${metrics.quoteRequested ?? 0}</b>\n\n`;

  // ── SECCIÓN 4: TIEMPOS PROMEDIO ───────────────────────────
  text += `⏱️ <b>Tiempos Promedio:</b>\n`;
  text += `• Hasta primer mensaje:  <b>${metrics.avgTimeToFirstMsg}</b>\n`;
  text += `• Hasta finalización:    <b>${metrics.avgCompletionTime}</b>\n`;
  text += `• Prom. msgs usuario/chat real: <b>${metrics.avgMessages}</b>\n\n`;

  // ── SECCIÓN 5: SENTIMIENTO (solo si hay datos) ────────────
  if (metrics.sentimentAvailable) {
    text += `🧠 <b>Sentimiento:</b>\n`;
    text += `🟢 Positivo: <b>${metrics.positive}</b> | 🟡 Neutral: <b>${metrics.neutral}</b> | 🔴 Negativo: <b>${metrics.negative}</b>\n\n`;
  } else {
    text += `🧠 <b>Sentimiento:</b> No disponible (enriquecimiento pendiente)\n\n`;
  }

  // ── SECCIÓN 6: FUENTE DE INGRESO ──────────────────────────
  text += `📡 <b>Fuente de Ingreso:</b>\n`;
  text += `• 🌐 Web: <b>${metrics.sourceWeb}</b> | 📱 WhatsApp: <b>${metrics.sourceWhatsapp}</b> | 📞 Teléfono: <b>${metrics.sourcePhone}</b>\n\n`;

  // ── SECCIÓN 7: HORA PICO ──────────────────────────────────
  if (metrics.peakHour) {
    text += `⚡ <b>Hora Pico:</b> <b>${metrics.peakHour}</b>\n\n`;
  }

  // ── SECCIÓN 8: ÚLTIMAS INTERACCIONES REALES (max 5) ───────
  const recentReal = metrics.recentReal || [];
  if (recentReal.length > 0) {
    text += `👥 <b>Últimas Interacciones REALES:</b>\n`;
    recentReal.forEach((s, i) => {
      const name = s.name || 'Anónimo';
      const phone = s.phone || 'N/A';
      const msg = String(s.msg || 'Sin mensaje').slice(0, 50);
      text += `  ${i + 1}. <b>${name}</b> (📞<code>${phone}</code>): <i>"${msg}…"</i>\n`;
    });
    text += '\n';
  } else {
    text += `👥 <b>Últimas Interacciones:</b> No hubo interacciones reales en el período.\n\n`;
  }

  text += `🔗 <i>Panel Admin: https://unitec-front-desk.vercel.app/?admin=true</i>`;
  return text;
}

/** Compute all metrics from a list of parsed sessions (excludes diagnostic/test sessions) */
function computeMetrics(sessions) {
  const realSessions = sessions.filter(s => !isTestSession(s.id));
  const total = realSessions.length;
  if (total === 0) return null;

  const withUserMsg = realSessions.filter(s => (s.analytics?.userMessageCount || 0) > 0);
  const realInteractions = withUserMsg.length;
  const welcomeOnly = realSessions.filter(s =>
    (s.analytics?.messageCount || 0) > 0 && !(s.analytics?.userMessageCount || 0)).length;
  const noMessage = realSessions.filter(s => !(s.analytics?.messageCount || 0)).length;
  const testCount = sessions.length - realSessions.length;

  const completed = realSessions.filter(s => s.status === 'completed').length;
  const abandonedAtGreeting = realSessions.filter(s => s.status === 'abandoned_at_greeting').length;
  // Cualquier abandono con etapa (abandoned_at_name/phone/profession o el histórico 'abandoned')
  const abandonedPartial = realSessions.filter(s => s.status === 'abandoned' || /^abandoned_at_(name|phone|profession|menu|engaged)$/.test(String(s.status || ''))).length;
  const humanRequested = realSessions.filter(s => s.status === 'human_requested' || s.status === 'human_assigned').length;
  const quoteRequested = withUserMsg.filter(s => /(cotiz|presupuesto|precio|quote|budget|cuanto cuesta|cuanto vale|cost|costo|valor)/i.test(s.lastMessage || '')).length;

  const conversionRate = total > 0 ? ((realInteractions / total) * 100).toFixed(1) : '0.0';
  const responseRate = conversionRate;
  const greetingAbandonRate = total > 0 ? (((welcomeOnly + abandonedAtGreeting) / total) * 100).toFixed(1) : '0.0';

  // Time metrics
  const completedWithDuration = realSessions.filter(s => s.status === 'completed' && s.duration > 0);
  const abandonedWithDuration = realSessions.filter(s => (s.status === 'abandoned' || s.status === 'abandoned_at_greeting') && s.duration > 0);
  const withFirstMsgTime = realSessions.filter(s => s.firstUserMessageAt && s.createdAt);

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

  // Avg user messages per REAL interaction (messageCount field includes the auto-saved greeting — do not use it)
  const avgMessages = withUserMsg.length > 0
    ? (withUserMsg.reduce((sum, s) => sum + (s.analytics?.userMessageCount || 0), 0) / withUserMsg.length).toFixed(1)
    : '0';

  // UI interactions total
  const totalUIInteractions = realSessions.reduce((sum, s) => sum + (s.uiInteractions || 0), 0);

  // Average duration overall
  const allWithDuration = realSessions.filter(s => s.duration > 0);
  const avgDuration = allWithDuration.length > 0
    ? formatDuration(allWithDuration.reduce((sum, s) => sum + s.duration, 0) / allWithDuration.length)
    : 'N/A';

  // Sentiment — only meaningful when actually populated (it never is today: CTO audit 2026-09-04)
  const anySentiment = realSessions.some(s => s.sentimentScore !== undefined && s.sentimentScore !== null && s.sentimentScore !== 0);
  let positive = 0, neutral = 0, negative = 0;
  realSessions.forEach(s => {
    if (s.sentimentScore > 0.3) positive++;
    else if (s.sentimentScore < -0.3) negative++;
    else neutral++;
  });

  // Source segmentation
  const sourceWeb = realSessions.filter(s => s.source === 'web').length;
  const sourceWhatsapp = realSessions.filter(s => s.source === 'whatsapp').length;
  const sourcePhone = realSessions.filter(s => s.source === 'phone').length;

  // Top intents from last user message (intentCategory field is never populated server-side)
  const intentCounts = {};
  withUserMsg.forEach(s => {
    const intent = classifyIntent(s.lastMessage || '');
    intentCounts[intent] = (intentCounts[intent] || 0) + 1;
  });
  const topIntents = Object.entries(intentCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Peak hour
  const hourlyCounts = {};
  realSessions.forEach(s => {
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

  // Recent REAL interactions (sorted desc by lastUpdated — sessions arrive ordered desc already)
  const recentReal = withUserMsg.slice(0, 5).map(s => ({
    name: s.customerName || s.extractedData?.name || 'Anónimo',
    phone: s.customerPhone || s.extractedData?.phone || '',
    msg: s.lastMessage || ''
  }));

  return {
    total, realInteractions, welcomeOnly, noMessage, testCount,
    completed, abandonedAtGreeting, abandonedPartial, humanRequested, quoteRequested,
    conversionRate, responseRate, greetingAbandonRate,
    avgCompletionTime, avgAbandonTime, avgTimeToFirstMsg, avgDuration,
    avgMessages, totalUIInteractions,
    positive, neutral, negative, sentimentAvailable: anySentiment,
    sourceWeb, sourceWhatsapp, sourcePhone,
    topIntents, peakHour: peakHourStr, recentReal,
    // Embudo real (misma función que alimenta el panel Mission Control vía /api/analytics)
    funnel: funnel(sessions)
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
    // Personal/extra daily destinations — stored in separate config fields the client
    // dashboard never reads or displays (added 2026-09-04 so the owner also receives
    // the daily report without mixing credentials into the client's Telegram settings).
    let telegramBotTokenExtra = '';
    let telegramChatIdExtra = '';
    let telegramReportTime = '09:00';
    let googleAnalyticsVisits = '';
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
      if (fields.telegramBotTokenExtra?.stringValue) telegramBotTokenExtra = fields.telegramBotTokenExtra.stringValue;
      if (fields.telegramChatIdExtra?.stringValue) telegramChatIdExtra = fields.telegramChatIdExtra.stringValue;
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
    //    NOTE: vercel.json cron runs 0 14 * * * = 14:00 UTC = 09:00 COL (fixed timezone bug 2026-09-04)
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

    // 6. Compute all metrics (real interactions only; test sessions excluded)
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
      // AI Executive Summary (real interactions only)
      let aiSummary = '';
      if (analyticsPreferences.includeAIExecutiveSummary) {
        const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
        const realOnly = filteredSessions
          .filter(s => !isTestSession(s.id) && (s.analytics?.userMessageCount || 0) > 0)
          .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
        aiSummary = await generateAIExecutiveSummary(realOnly, metrics, geminiKey);
      }

      reportText = buildReportText(filteredSessions, metrics, dateLabel, telegramReportTime, isWeekly, googleAnalyticsVisits);

      if (aiSummary) {
        reportText += `\n\n📝 <b>Resumen Ejecutivo (IA):</b>\n<i>${aiSummary}</i>`;
      }
    }

    // 7. Build the daily Excel attachment (real analytics) and send to Telegram
    let excelBuffer = null;
    let excelFilename = `UniTEC_Chatbot_${isWeekly ? 'Semanal' : 'Diario'}_${dateLabel.replace(/\//g, '-')}.xlsx`;
    try {
      excelBuffer = metrics
        ? await buildDailyWorkbook(filteredSessions, metrics, dateLabel, isWeekly)
        : null;
    } catch (wbErr) {
      console.error('Excel build failed (report still sent as text):', wbErr);
    }

    const telegramResults = [];
    const telegramDocResults = [];
    // Combined delivery list: primary (client config) + extra (owner's personal chat).
    // Each extra entry carries its own bot token so no client credentials are mixed.
    const allDestinations = [];
    if (telegramBotToken && telegramChatId) {
      const botTokens = telegramBotToken.split(',').map(t => t.trim()).filter(Boolean);
      const chatIds = telegramChatId.split(',').map(id => id.trim()).filter(Boolean);
      for (let i = 0; i < chatIds.length; i++) {
        allDestinations.push({ chatId: chatIds[i], token: botTokens[i] || botTokens[0], kind: 'client' });
      }
    }
    if (telegramBotTokenExtra && telegramChatIdExtra) {
      const extraBots = telegramBotTokenExtra.split(',').map(t => t.trim()).filter(Boolean);
      const extraChats = telegramChatIdExtra.split(',').map(id => id.trim()).filter(Boolean);
      for (let i = 0; i < extraChats.length; i++) {
        allDestinations.push({ chatId: extraChats[i], token: extraBots[i] || extraBots[0], kind: 'extra' });
      }
    }

    for (const dest of allDestinations) {
      const { chatId, token } = dest;
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
      // Attach the Excel document right after the text report
      if (excelBuffer) {
        try {
          const docRes = await sendTelegramDocument(
            token, chatId, excelFilename, excelBuffer,
            `📎 ${isWeekly ? 'Reporte semanal' : 'Reporte diario'} ${dateLabel} — analítica real (Excel)`
          );
          telegramDocResults.push({ chatId, ...docRes });
        } catch (docErr) {
          console.error(`Telegram document send failed for chat_id ${chatId}:`, docErr);
          telegramDocResults.push({ chatId, ok: false, error: String(docErr).slice(0, 200) });
        }
      }
    }

    // 8. Send email via Resend (if configured) with the Excel attached
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'lidermarketingonline@espaciosimportados.com.co';
    let emailResult = { configured: !!RESEND_API_KEY, ok: false };
    if (RESEND_API_KEY) {
      try {
        const emailBody = {
          from: 'UniTEC AI Desk <onboarding@resend.dev>',
          to: [ADMIN_EMAIL],
          subject: `Reporte ${isWeekly ? 'Semanal' : 'Diario'} Chatbot - ${dateLabel}`,
          html: reportText.replace(/\n/g, '<br/>')
        };
        if (excelBuffer) {
          emailBody.attachments = [{
            filename: excelFilename,
            content: excelBuffer.toString('base64')
          }];
        }
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify(emailBody)
        });
        emailResult.ok = emailRes.ok;
        if (!emailRes.ok) emailResult.error = (await emailRes.text()).slice(0, 200);
        else emailResult.to = ADMIN_EMAIL;
      } catch (emailErr) {
        console.error("Email send failed:", emailErr);
        emailResult.error = String(emailErr).slice(0, 200);
      }
    }

    return res.status(200).json({
      success: true,
      sessionsReported: filteredSessions.length,
      metrics: metrics || {},
      period: isWeekly ? 'weekly' : 'daily',
      excelAttached: !!excelBuffer,
      telegram: telegramResults,
      telegramDocuments: telegramDocResults,
      email: emailResult
    });

  } catch (error) {
    console.error("Daily/Weekly analytics error:", error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message || String(error) });
  }
}
