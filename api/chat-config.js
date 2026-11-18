// GET /api/chat-config
// Nombre público del bot, configurable sin tocar código ni redeploy.
//
// Por qué existe: el administrador dejó en el campo de ENTRENAMIENTO la instrucción
// "cambia el saludo: mi nombre es Decky → IAgo UNITEC". Ese texto NO puede cambiar el saludo,
// porque el saludo del widget y la identidad del prompt eran cadenas fijas en el código
// (components/ChatTab.tsx y el BASE_FRONT_DESK de api/chat.js). Este endpoint expone
// `config/main.botName` para que cliente y servidor usen el mismo nombre.

import { getFirestoreToken, projectId } from './_analytics-core.js';

const DOCS = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
const DEFAULT_NAME = 'Decky';

let cache = { name: DEFAULT_NAME, at: 0 };
const TTL_MS = 60 * 1000;

export async function resolveBotName({ force = false } = {}) {
  if (!force && Date.now() - cache.at < TTL_MS && cache.name) return cache.name;
  try {
    const token = await getFirestoreToken();
    const r = await fetch(`${DOCS}/config/main`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(6000),
    });
    if (r.ok) {
      const d = await r.json();
      const name = String(d?.fields?.botName?.stringValue || '').trim();
      cache = { name: name || DEFAULT_NAME, at: Date.now() };
    }
  } catch (e) {
    console.warn('[chat-config] botName lookup failed:', e?.message || e);
  }
  return cache.name || DEFAULT_NAME;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const botName = await resolveBotName({ force: String(req.query?.force || '') === '1' });
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
  return res.status(200).json({ botName, source: 'config/main.botName' });
}
