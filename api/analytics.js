// GET /api/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD
// Métricas del panel Mission Control. Usa el MISMO motor que /api/daily-analytics
// (api/_analytics-core.js) para que el panel y el informe diario no puedan divergir.
// Días en hora Bogotá (UTC-5), igual que el informe.

import { getFirestoreToken, listAllSessions, filterByBogotaRange, bogotaDayKey, funnel, isTestSession } from './_analytics-core.js';
import { dispositionBreakdown } from './_disposition.js';

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
  return 'Otros / General';
}


/** Conteo de etiquetas de conversación para el reporte (sales / support / complaint...). */
function tagBreakdown(sessions) {
  const counts = {};
  let tagged = 0;
  for (const s of sessions || []) {
    const list = Array.isArray(s.tags) ? s.tags : [];
    if (list.length) tagged++;
    for (const t of list) counts[t] = (counts[t] || 0) + 1;
  }
  const total = (sessions || []).length;
  return { counts, tagged, untagged: total - tagged, total };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const { from, to } = req.query || {};
    const idToken = await getFirestoreToken();
    if (!idToken) return res.status(503).json({ error: 'auth_unavailable' });

    let sessions = await listAllSessions(idToken);

    // ── "En vivo": NO depende del filtro de fechas ───────────────────────────
    // Activos ahora + resumen del día de HOY en Bogotá, calculados aquí para que el panel no tenga
    // que depender de la suscripción Firestore del navegador (llegaba tarde/incompleta: "no cuenta
    // en vivo"). Una sola lectura de Firestore sirve para todo el panel.
    const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const realAll = sessions.filter((s) => !isTestSession(s.id));
    const activeNow = realAll.filter((s) => s.status === 'active' || s.status === 'human_assigned').length;
    const todayList = realAll.filter((s) => bogotaDayKey(s.createdAt) === todayKey);
    const todayKpis = {
      day: todayKey,
      total: todayList.length,
      realInteractions: todayList.filter((s) => Number(s.analytics?.userMessageCount || 0) > 0).length,
      greetingOnly: todayList.filter((s) => Number(s.analytics?.messageCount || 0) > 0 && !Number(s.analytics?.userMessageCount || 0)).length,
      humanAssisted: todayList.filter((s) => s.status === 'human_requested' || s.status === 'human_assigned').length,
      avgUserMessages: todayList.length
        ? Number((todayList.reduce((n, s) => n + Number(s.analytics?.messageCount || 0), 0) / todayList.length).toFixed(1))
        : 0,
      byBrand: todayList.reduce((acc, s) => {
        const b = s.brandId || 'unitec';
        acc[b] = (acc[b] || 0) + 1;
        return acc;
      }, {}),
    };

    if (from || to) sessions = filterByBogotaRange(sessions, from, to);

    const real = sessions.filter((s) => !isTestSession(s.id));
    const withUser = real.filter((s) => Number(s.analytics?.userMessageCount || 0) > 0);

    // KPIs alineados con el informe diario
    const kpis = {
      total: real.length,
      realInteractions: withUser.length,
      realInteractionRate: real.length ? Number(((withUser.length / real.length) * 100).toFixed(2)) : 0,
      greetingOnly: real.filter((s) => Number(s.analytics?.messageCount || 0) > 0 && !Number(s.analytics?.userMessageCount || 0)).length,
      noMessage: real.filter((s) => !Number(s.analytics?.messageCount || 0)).length,
      testsExcluded: sessions.length - real.length,
      contactsCaptured: real.filter((s) => s.customerPhone || s.extractedData?.phone).length,
      humanAssisted: real.filter((s) => s.status === 'human_requested' || s.status === 'human_assigned').length,
      abandonedByStep: real.filter((s) => String(s.status).startsWith('abandoned')).length,
      avgUserMessages: withUser.length
        ? Number((withUser.reduce((n, s) => n + Number(s.analytics?.userMessageCount || 0), 0) / withUser.length).toFixed(1))
        : 0,
    };

    // Desgloses
    const byBrand = {};
    const bySource = {};
    const byHour = {};
    const intentCounts = {};
    real.forEach((s) => {
      byBrand[s.brandId || 'unitec'] = (byBrand[s.brandId || 'unitec'] || 0) + 1;
      bySource[s.source || 'web'] = (bySource[s.source || 'web'] || 0) + 1;
      const day = bogotaDayKey(s.createdAt);
      if (day) byHour[day.slice(0, 10)] = (byHour[day.slice(0, 10)] || 0) + 1;
    });
    withUser.forEach((s) => {
      const k = classifyIntent(s.lastMessage);
      intentCounts[k] = (intentCounts[k] || 0) + 1;
    });

    const recentReal = withUser
      .sort((a, b) => String(b.lastUpdated).localeCompare(String(a.lastUpdated)))
      .slice(0, 20)
      .map((s) => ({
        id: s.id,
        day: bogotaDayKey(s.createdAt),
        name: (() => { const v = String(s.customerName || s.extractedData?.name || '').trim(); return v ? v.slice(0, 1) + '***' : 'Anónimo'; })(),
        phone: (() => { const d = String(s.customerPhone || s.extractedData?.phone || '').replace(/\D/g, ''); return d ? '••••' + d.slice(-2) : ''; })(),
        step: s.funnelStep || '',
        status: s.status,
        userMessages: Number(s.analytics?.userMessageCount || 0),
        lastMessage: String(s.lastMessage || '').slice(0, 200),
        intent: classifyIntent(s.lastMessage),
      }));

    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      range: { from: from || null, to: to || null },
      activeNow,
      today: todayKey,
      todayKpis,
      kpis,
      funnel: funnel(sessions),
      byBrand,
      bySource,
      byDay: byHour,
      intents: Object.entries(intentCounts).sort((a, b) => b[1] - a[1]).slice(0, 12),
      // Seguimiento comercial: cuántas interacciones urgentes quedaron tipificadas y con qué resultado.
      dispositions: dispositionBreakdown(sessions),
      // Etiquetas operativas: volumen por etiqueta y cobertura del etiquetado.
      tags: tagBreakdown(sessions),
      recentReal,
    });
  } catch (e) {
    console.error('analytics error:', e);
    return res.status(500).json({ error: 'server_error', detail: String(e?.message || e) });
  }
}
