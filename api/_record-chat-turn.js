// api/_record-chat-turn.js
// Grabador compartido de turnos de chat (Firestore REST). SIN coste de IA.
// Lo usan /api/chat (turnos reales del asistente) y /api/record-turn (pasos del
// onboarding, que antes se quedaban solo en el navegador y no se registraban).
//
// Escribe, en una sola pasada:
//   · sesión: id/brandId/source/language/lastMessage/lastUpdated (+ status si procede)
//   · mensajes: un doc por turno (user/model)
//   · contadores: analytics.messageCount / analytics.userMessageCount
//   · embudo: firstUserMessageAt, flowStage y funnelStep (solo hacia adelante)

import { createRequire } from 'module';
import { STEP_ORDER, stepIndex, getFirestoreToken } from './_analytics-core.js';

const require_ = createRequire(import.meta.url);
const firebaseConfig = require_('../firebase-applet-config.json');

const PROTECTED_STATUSES = new Set(['human_requested', 'human_assigned']);

/**
 * Registra un turno.
 * @param {string} sessionId
 * @param {string} userText     texto del usuario (obligatorio para que cuente)
 * @param {string} [replyText]  respuesta del bot, si la hubo
 * @param {string} [brand]      'unitec' | 'building'
 * @param {string} [stage]      etapa del embudo alcanzada con ESTE turno (name|phone|profession|menu|engaged)
 * @param {number} [latencyMs]  ms desde el inicio del handler hasta tener la respuesta (Fase 3)
 * @returns {Promise<{recorded:boolean, reason?:string}>}
 */
export async function recordChatTurn({ sessionId, userText, replyText, brand = 'unitec', stage, parentHost, latencyMs, channel = 'text', deliveryStatus = 'ok' }) {
  if (!sessionId) return { recorded: false, reason: 'no_session' };
  try {
    const idToken = await getFirestoreToken();
    if (!idToken) return { recorded: false, reason: 'no_token' };

    const projectId = firebaseConfig.projectId;
    const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
    const auth = { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' };
    const now = new Date().toISOString();
    const ts = Date.now();
    const docPath = `projects/${projectId}/databases/(default)/documents/conversations/${sessionId}`;

    // ── Lectura previa: estado actual (para no pisar status de staff ni retroceder el embudo) ──
    let current = {};
    try {
      const docRes = await fetch(`${base}/conversations/${sessionId}`, { headers: auth });
      if (docRes.ok) {
        const doc = await docRes.json();
        current = doc.fields || {};
      }
    } catch { /* si falla, seguimos: los campos de una sola escritura se reintentan en el próximo turno */ }

    const currentStatus = current.status?.stringValue || '';
    const currentFunnelStep = current.funnelStep?.stringValue || '';
    const stepFromCounters = Number(current.analytics?.mapValue?.fields?.userMessageCount?.integerValue || 0) > 0 ? 'engaged' : '';

    // Status: nunca degradar una sesión atendida por el equipo.
    const statusFields = PROTECTED_STATUSES.has(currentStatus) ? {} : { status: { stringValue: 'active' } };

    // Etapa del turno: la explícita (onboarding) o la que dicta el número de mensajes
    // del usuario: 1º = name, 2º = phone, 3º = profession, 4º+ = engaged.
    const currentUserCount = Number(current.analytics?.mapValue?.fields?.userMessageCount?.integerValue || 0);
    const derivedStage = userText
      ? (currentUserCount === 0 ? 'name' : currentUserCount === 1 ? 'phone' : currentUserCount === 2 ? 'profession' : 'engaged')
      : '';
    const candidateStage = stage || derivedStage;
    const bestStage = [candidateStage, currentFunnelStep, stepFromCounters]
      .filter(Boolean)
      .sort((a, b) => stepIndex(b) - stepIndex(a))[0] || '';

    // ── ÚNICO COMMIT: sesión (merge por updateMask) + mensajes + contadores + embudo ──
    // Antes: lectura + 3 commits por turno → ahora lectura + 1 (menos round-trips → menos latencia).
    const oneTime = [];
    if (userText && !current.firstUserMessageAt) oneTime.push('firstUserMessageAt');
    if (!current.createdAt) oneTime.push('createdAt');
    if (userText && current.flowStage?.stringValue !== 'engaging') oneTime.push('flowStage');
    if (bestStage && stepIndex(bestStage) > stepIndex(currentFunnelStep)) oneTime.push('funnelStep');

    const sessionFields = {
      id: { stringValue: sessionId },
      ...statusFields,
      brandId: { stringValue: brand || 'unitec' },
      source: { stringValue: String(parentHost || '').includes('unitecusadesign') ? 'website' : 'web' },
      language: { stringValue: 'es' },
      lastMessage: { stringValue: String(userText || replyText || '').slice(0, 200) },
      lastUpdated: { stringValue: now },
    };
    const sessionMask = ['id', 'brandId', 'source', 'language', 'lastMessage', 'lastUpdated']
      .concat(PROTECTED_STATUSES.has(currentStatus) ? [] : ['status']);

    if (parentHost) {
      sessionFields.parentHost = { stringValue: String(parentHost).slice(0, 160) };
      sessionMask.push('parentHost');
    }

    // Campos de embudo de una sola escritura (o que avanzan) — fusionados en este commit.
    if (oneTime.includes('firstUserMessageAt')) { sessionFields.firstUserMessageAt = { stringValue: now }; sessionMask.push('firstUserMessageAt'); }
    if (oneTime.includes('createdAt')) { sessionFields.createdAt = { stringValue: now }; sessionMask.push('createdAt'); }
    if (oneTime.includes('flowStage')) { sessionFields.flowStage = { stringValue: 'engaging' }; sessionMask.push('flowStage'); }
    if (oneTime.includes('funnelStep')) { sessionFields.funnelStep = { stringValue: bestStage }; sessionMask.push('funnelStep'); }

    // Tiempo de respuesta (Fase 3): últimos ms + media móvil, calculados del estado previo leído.
    // IMPORTANTE: los campos del mapa `analytics` van ANIDADOS como mapValue; una clave plana
    // tipo 'analytics.x' NO coincide con el updateMask 'analytics.x' y se descarta en silencio
    // (verificado en producción: el commit se acepta pero el campo nunca aparece).
    if (Number.isFinite(latencyMs) && replyText) {
      const msRounded = Math.round(latencyMs);
      const analyticsFields = { lastResponseTimeMs: { integerValue: String(msRounded) } };
      sessionMask.push('analytics.lastResponseTimeMs');
      const prevAvg = Number(
        current.analytics?.mapValue?.fields?.avgResponseTime?.doubleValue ??
        current.analytics?.mapValue?.fields?.avgResponseTime?.integerValue ?? 0
      );
      const prevN = currentUserCount;
      const nextN = prevN + (userText ? 1 : 0);
      if (nextN > 0) {
        const nextAvg = (prevAvg * prevN + msRounded) / nextN;
        analyticsFields.avgResponseTime = { doubleValue: Math.round(nextAvg) };
        sessionMask.push('analytics.avgResponseTime');
      }
      sessionFields.analytics = { mapValue: { fields: analyticsFields } };
    }

    // Idempotencia: si el mismo texto ya se escribió en esta ventana de 5 s, no se duplica
    // el mensaje ni los contadores (el loop de voz reenvía el mismo turno 3-4 veces).
    let userDocId = '';
    if (userText) {
      const normText = String(userText).toLowerCase().replace(/\s+/g, ' ').trim();
      let h = 5381;
      for (let i = 0; i < normText.length; i++) h = ((h * 33) ^ normText.charCodeAt(i)) >>> 0;
      const bucket = Math.floor(Date.now() / 5000);
      const hasTurn = async (b) => {
        try {
          const r = await fetch(`${base}/conversations/${sessionId}/messages/srv_u_${b}_${h.toString(36)}`, { headers: auth });
          return r.ok;
        } catch { return false; }
      };
      // Ventana actual + anterior: evita el borde del bucket cuando el reintento cae 1 s después.
      if ((await hasTurn(bucket)) || (await hasTurn(bucket - 1))) return { ok: true, skipped: 'duplicate_turn' };
      userDocId = `srv_u_${bucket}_${h.toString(36)}`;
    }

    const writes = [
      { updateMask: { fieldPaths: sessionMask }, update: { name: docPath, fields: sessionFields } },
    ];

    if (userText) {
      writes.push({
        update: {
          name: `${docPath}/messages/${userDocId}`,
          fields: {
            id: { stringValue: userDocId },
            role: { stringValue: 'user' },
            text: { stringValue: String(userText).slice(0, 2000) },
            timestamp: { stringValue: now },
            channel: { stringValue: channel },
            // Marca los turnos que NO recibieron respuesta real (429, llaves caídas, error): sin esto
            // una conversación fallida era indistinguible de una que nunca ocurrió.
            ...(deliveryStatus !== 'ok' ? { deliveryStatus: { stringValue: deliveryStatus } } : {}),
          },
        },
      });
    }
    if (replyText) {
      const botFields = {
        id: { stringValue: `srv_b_${ts}` },
        role: { stringValue: 'model' },
        text: { stringValue: String(replyText).slice(0, 2000) },
        // +1ms: user and bot docs land in the same batch with identical timestamps, so Firestore
        // tie-breaks by document name and renders the reply ABOVE the question it answers.
        timestamp: { stringValue: new Date(new Date(now).getTime() + 1).toISOString() },
        channel: { stringValue: channel },
      };
      if (Number.isFinite(latencyMs)) botFields.latencyMs = { integerValue: String(Math.round(latencyMs)) };
      writes.push({ update: { name: `${docPath}/messages/srv_b_${ts}`, fields: botFields } });
    }

    // Contadores atómicos en el MISMO commit (solo turnos con texto de usuario).
    if (userText) {
      writes.push({
        transform: {
          document: docPath,
          fieldTransforms: [
            { fieldPath: 'analytics.messageCount', increment: { integerValue: replyText ? '2' : '1' } },
            { fieldPath: 'analytics.userMessageCount', increment: { integerValue: '1' } },
          ],
        },
      });
    }

    const commitRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`, {
      method: 'POST', headers: auth, body: JSON.stringify({ writes }),
    });
    if (!commitRes.ok) return { recorded: false, reason: `commit_failed_${commitRes.status}` };

    return { recorded: true, funnelStep: bestStage || currentFunnelStep || null };
  } catch (e) {
    console.warn('recordChatTurn failed:', e?.message);
    return { recorded: false, reason: String(e?.message || e) };
  }
}

export { STEP_ORDER };
