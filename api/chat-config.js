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

let cache = { name: DEFAULT_NAME, at: 0, brand: 'unitec' };
const TTL_MS = 60 * 1000;

const DEFAULT_BY_BRAND = { unitec: DEFAULT_NAME, building: 'IAgo' };

export async function resolveBotName({ force = false, brand = 'unitec' } = {}) {
  const fallback = DEFAULT_BY_BRAND[brand === 'building' ? 'building' : 'unitec'];
  if (!force && Date.now() - cache.at < TTL_MS && cache.name && cache.brand === brand) return cache.name;
  try {
    const token = await getFirestoreToken();
    const r = await fetch(`${DOCS}/config/main`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(6000),
    });
    if (r.ok) {
      const d = await r.json();
      const f = d?.fields || {};
      // Brand-specific override wins; the shared botName stays for UNITEC.
      const name = brand === 'building'
        ? String(f.botNameBuilding?.stringValue || f.botName?.stringValue || '').trim()
        : String(f.botName?.stringValue || '').trim();
      cache = { name: name || fallback, at: Date.now(), brand };
    }
  } catch (e) {
    console.warn('[chat-config] botName lookup failed:', e?.message || e);
  }
  return cache.name || fallback;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const brand = String(req.query?.brand || 'unitec') === 'building' ? 'building' : 'unitec';
  const botName = await resolveBotName({ force: String(req.query?.force || '') === '1', brand });
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
  return res.status(200).json({ botName, brand, source: brand === 'building' ? 'config/main.botNameBuilding' : 'config/main.botName' });
}
