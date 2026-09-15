// POST /api/record-turn
// Registra un turno del usuario SIN llamar a la IA. Existe porque los 3 pasos del
// onboarding (nombre → teléfono → perfil) corrían solo en el navegador: se respondían
// con plantillas locales y se hacía `return` antes de tocar el servidor, así que esos
// mensajes no quedaban registrados en ninguna parte (y el panel los contaba como
// "sin interacción"). Con este endpoint la etapa del embudo y el mensaje quedan grabados.
//
// Body: { sessionId, userText, replyText?, brand?: 'unitec'|'building', stage?:
//         'name'|'phone'|'profession'|'menu'|'engaged' }

import { recordChatTurn } from './_record-chat-turn.js';
import { STEP_ORDER } from './_analytics-core.js';

// Rate limit simple por IP (mismo patrón que /api/chat)
const rateMap = new Map();
function isRateLimited(ip, limit = 120, windowMs = 60000) {
  const now = Date.now();
  const timestamps = (rateMap.get(ip) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= limit) return true;
  timestamps.push(now);
  rateMap.set(ip, timestamps);
  return false;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    if (isRateLimited(ip)) return res.status(429).json({ recorded: false, error: 'rate_limited' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { sessionId, userText, replyText, brand, stage } = body;

    if (!sessionId || typeof sessionId !== 'string' || sessionId.length > 80) {
      return res.status(400).json({ recorded: false, error: 'invalid_session' });
    }
    if (!userText && !replyText) {
      return res.status(400).json({ recorded: false, error: 'empty_turn' });
    }
    if (stage && !STEP_ORDER.includes(stage)) {
      return res.status(400).json({ recorded: false, error: 'invalid_stage' });
    }

    const result = await recordChatTurn({
      sessionId,
      userText: userText ? String(userText).slice(0, 2000) : '',
      replyText: replyText ? String(replyText).slice(0, 2000) : '',
      brand: brand === 'building' ? 'building' : 'unitec',
      stage,
    });

    return res.status(200).json(result);
  } catch (e) {
    console.error('record-turn error:', e);
    return res.status(500).json({ recorded: false, error: 'server_error' });
  }
}
