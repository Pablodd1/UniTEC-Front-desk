// POST /api/xai-voice-token — acuña un "client secret" EFÍMERO para Grok Voice 3.0.
//
// Por qué existe: el navegador no puede mandar headers en un WebSocket y la API key de xAI NUNCA debe
// viajar al cliente. xAI ofrece tokens efímeros de un solo uso (POST /v1/realtime/client_secrets);
// el navegador se conecta con el subprotocolo `xai-client-secret.<token>` y la key se queda en el server.
//
// Respuesta: { ok, token, expires_at, model, voice }
// Requiere XAI_API_KEY en el entorno (Vercel). Sin key → 503 con motivo explícito, y el cliente cae
// al motor anterior (Deepgram + Web Speech) sin romper la llamada.
export const config = { maxDuration: 30 };

import { getSharedTraining } from './shared-training.js';

const XAI_SECRETS_URL = 'https://api.x.ai/v1/realtime/client_secrets';
const DEFAULT_MODEL = 'grok-voice-latest';
const TOKEN_TTL_SECONDS = 300; // 5 min: sólo tiene que durar hasta que el navegador conecta

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    // No es un error del cliente: el llamador debe caer al motor anterior.
    return res.status(503).json({ ok: false, error: 'XAI_API_KEY not configured on server', fallback: true });
  }

  const body = req.body || {};
  const model = String(body.model || DEFAULT_MODEL);
  // reasoning 'none' => respuesta más rápida (no hay nada que razonar en una frase de recepción).
  const effort = body.effort === 'high' ? 'high' : 'none';

  try {
    const upstream = await fetch(XAI_SECRETS_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        expires_after: { seconds: TOKEN_TTL_SECONDS },
        model,
        reasoning: { effort },
      }),
      signal: AbortSignal.timeout(20000),
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      console.error('[xai-voice-token] upstream', upstream.status, text.slice(0, 300));
      return res.status(upstream.status === 401 ? 503 : upstream.status).json({
        ok: false,
        error: 'xai_token_failed',
        status: upstream.status,
        detail: text.slice(0, 300),
        fallback: true,
      });
    }

    let data = {};
    try { data = JSON.parse(text); } catch (_) { /* tolerar respuesta vacía */ }

    const token = data.value || data.client_secret?.value || data.token || '';
    if (!token) {
      return res.status(502).json({ ok: false, error: 'xai_token_empty', fallback: true });
    }

    // El training del panel viaja al navegador porque aquí NO hay inyección server-side: el WebSocket
    // va del browser directo a xAI, así que las instrucciones completas deben salir del cliente.
    let training = '';
    try { training = await getSharedTraining(); } catch (e) { console.warn('[xai-voice-token] training skip:', e?.message); }

    return res.status(200).json({
      ok: true,
      token,
      expires_at: data.expires_at || null,
      model,
      effort,
      voice: process.env.XAI_VOICE_ID || 'celeste',
      ttl: TOKEN_TTL_SECONDS,
      training,
    });
  } catch (err) {
    console.error('[xai-voice-token] exception:', err?.message || err);
    return res.status(502).json({ ok: false, error: 'xai_token_exception', detail: String(err?.message || err), fallback: true });
  }
}
