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
 * @returns {Promise<{recorded:boolean, reason?:string}>}
 */
export async function recordChatTurn({ sessionId, userText, replyText, brand = 'unitec', stage, parentHost }) {
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

    // ── COMMIT 1: sesión (merge por updateMask) + docs de mensajes ──
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

    const writes = [
      { updateMask: { fieldPaths: sessionMask }, update: { name: docPath, fields: sessionFields } },
    ];

    if (userText) {
      writes.push({
        update: {
          name: `${docPath}/messages/srv_u_${ts}`,
          fields: {
            id: { stringValue: `srv_u_${ts}` },
            role: { stringValue: 'user' },
            text: { stringValue: String(userText).slice(0, 2000) },
            timestamp: { stringValue: now },
          },
        },
      });
    }
    if (replyText) {
      writes.push({
        update: {
          name: `${docPath}/messages/srv_b_${ts}`,
          fields: {
            id: { stringValue: `srv_b_${ts}` },
            role: { stringValue: 'model' },
            text: { stringValue: String(replyText).slice(0, 2000) },
            timestamp: { stringValue: now },
          },
        },
      });
    }

    const commitRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`, {
      method: 'POST', headers: auth, body: JSON.stringify({ writes }),
    });
    if (!commitRes.ok) return { recorded: false, reason: `commit_failed_${commitRes.status}` };

    // ── COMMIT 2: contadores atómicos ──
    if (userText) {
      await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`, {
        method: 'POST', headers: auth,
        body: JSON.stringify({
          writes: [
            {
              transform: {
                document: docPath,
                fieldTransforms: [
                  { fieldPath: 'analytics.messageCount', increment: { integerValue: replyText ? '2' : '1' } },
                  { fieldPath: 'analytics.userMessageCount', increment: { integerValue: '1' } },
                ],
              },
            },
          ],
        }),
      });
    }

    // ── COMMIT 3: campos de embudo que solo se escriben una vez (o avanzan) ──
    const oneTime = [];
    if (userText && !current.firstUserMessageAt) oneTime.push('firstUserMessageAt');
    if (!current.createdAt) oneTime.push('createdAt');
    if (userText && current.flowStage?.stringValue !== 'engaging') oneTime.push('flowStage');
    if (bestStage && stepIndex(bestStage) > stepIndex(currentFunnelStep)) oneTime.push('funnelStep');

    if (oneTime.length > 0) {
      const fields = {};
      if (oneTime.includes('firstUserMessageAt')) fields.firstUserMessageAt = { stringValue: now };
      if (oneTime.includes('createdAt')) fields.createdAt = { stringValue: now };
      if (oneTime.includes('flowStage')) fields.flowStage = { stringValue: 'engaging' };
      if (oneTime.includes('funnelStep')) fields.funnelStep = { stringValue: bestStage };
      const mask = oneTime.map((p) => `updateMask.fieldPaths=${p}`).join('&');
      await fetch(`${base}/conversations/${sessionId}?${mask}`, {
        method: 'PATCH', headers: auth, body: JSON.stringify({ fields }),
      }).catch(() => {});
    }

    return { recorded: true, funnelStep: bestStage || currentFunnelStep || null };
  } catch (e) {
    console.warn('recordChatTurn failed:', e?.message);
    return { recorded: false, reason: String(e?.message || e) };
  }
}

export { STEP_ORDER };
