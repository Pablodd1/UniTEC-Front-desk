// Secure endpoint: returns API keys ONLY to authenticated admin requests.
// Requires Authorization: Bearer <ADMIN_SECRET> header.
// The chatbot itself does NOT need this endpoint — it talks to /api/chat
// (secure server-side proxy). This endpoint exists only for the admin
// settings panel (which stores the key in browser localStorage).

export default async function handler(req, res) {
  // ---- CORS: Restrict to known origins ----
  const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  let origin = req.headers.origin || '';
  if (!origin && req.headers.referer) {
    try { origin = new URL(req.headers.referer).origin; } catch (e) { /* ignore */ }
  }

  if (ALLOWED_ORIGINS.length > 0) {
    const isAllowed = ALLOWED_ORIGINS.some(allowed => {
      if (!origin) return false;
      const a = allowed.replace(/^https?:\/\//, '').toLowerCase();
      const o = origin.replace(/^https?:\/\//, '').toLowerCase();
      return o === a || o.endsWith('.' + a);
    });
    if (!isAllowed) {
      return res.status(403).json({ error: `Origin "${origin || 'unknown'}" not allowed` });
    }
  }

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  // ---- AUTH (2026-09-02 security fix) ----
  // SECURITY: this endpoint previously returned raw GEMINI_API_KEY + Grok key
  // to ANY unauthenticated request (the origin check had a bypass when
  // ALLOWED_ORIGINS was unset/empty). That leaked live AI keys to the public
  // internet — anyone could drain quota (and is the likely cause of the
  // "chatbot not responding" outages from quota exhaustion).
  // Now requires the shared ADMIN_SECRET. The admin settings panel sends it
  // via Authorization header (it's stored in browser localStorage after admin
  // login — admins are the only legitimate consumers of raw keys).
  const adminSecret = process.env.ADMIN_SECRET || '';
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!adminSecret) {
    console.error('ADMIN_SECRET is not configured — refusing to serve API keys');
    return res.status(503).json({ error: 'Key service not configured.' });
  }
  if (!token || token !== adminSecret) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_BACKUP_KEY,
    process.env.GEMINI_BACKUP_KEY_2,
    process.env.OPENROUTER_API_KEY,
    process.env.OPENAI_API_KEY,
    process.env.API_KEY,
    process.env.VITE_GEMINI_API_KEY,
    process.env.VITE_API_KEY
  ].filter(Boolean);

  if (keys.length === 0) {
    return res.status(500).json({ error: 'API keys are missing or not configured on the server.' });
  }

  const validKey = keys[0];
  if (!validKey) {
    return res.status(503).json({ error: 'All configured API keys are suspended or invalid.' });
  }

  const groqKeys = [
    process.env.XAI_API_KEY,
    process.env.GROK_API_KEY,
    process.env.GROQ_API_KEY,
    process.env.VITE_XAI_API_KEY,
    process.env.VITE_GROK_API_KEY,
    process.env.VITE_GROQ_API_KEY
  ].filter(Boolean);

  return res.status(200).json({
    apiKey: validKey,
    keyHint: validKey.slice(-4),
    groqApiKey: groqKeys[0] || ''
  });
}
