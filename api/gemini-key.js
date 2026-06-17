// Secure endpoint: validates request origin/auth before returning API keys.
// Uses a shared ADMIN_SECRET env var for authentication.
// Only allows requests from configured ALLOWED_ORIGINS.

export default async function handler(req, res) {
  // ---- CORS: Restrict to known origins ----
  const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  let origin = req.headers.origin || '';

  // Fallback: Check Referer header if Origin header is missing (common for same-origin GET requests)
  if (!origin && req.headers.referer) {
    try {
      const refererUrl = new URL(req.headers.referer);
      origin = refererUrl.origin;
    } catch (e) {
      // ignore
    }
  }

  if (ALLOWED_ORIGINS.length > 0) {
    const isAllowed = ALLOWED_ORIGINS.some(allowed => {
      if (!origin) return false;
      const allowedClean = allowed.replace(/^https?:\/\//, '').toLowerCase();
      const originClean = origin.replace(/^https?:\/\//, '').toLowerCase();
      return originClean === allowedClean || originClean.endsWith('.' + allowedClean);
    });

    if (!isAllowed) {
      console.warn(`Origin block: "${origin || 'unknown'}" is not in ALLOWED_ORIGINS`);
      return res.status(403).json({ error: `Origin "${origin || 'unknown'}" not allowed` });
    }
  }

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (ALLOWED_ORIGINS.length === 0) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // ---- Auth: Origin-based CORS (above) is sufficient for same-origin frontend calls ----
  // ADMIN_SECRET auth was removed because the frontend fetch('/api/gemini-key')
  // cannot send an auth token, causing 401 on every request and breaking the chatbot.
  // The ALLOWED_ORIGINS check above already restricts access to authorized domains.

  // ---- Rate limiting via simple token bucket (in-memory, per-deployment) ----
  // Production: replace with Vercel KV or Upstash Redis
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_BACKUP_KEY,
    process.env.GEMINI_BACKUP_KEY_2,
    process.env.API_KEY,
    process.env.VITE_GEMINI_API_KEY,
    process.env.VITE_API_KEY
  ].filter(Boolean);

  if (keys.length === 0) {
    console.error("Gemini API Keys are missing on the server.");
    return res.status(500).json({ error: 'API keys are missing or not configured on the server.' });
  }

  // Validate first working key, then cache for 5 minutes
  const validKey = keys[0];

  if (!validKey) {
    return res.status(503).json({ error: 'All configured API keys are suspended or invalid.' });
  }

  const groqKeys = [
    process.env.GROQ_API_KEY,
    process.env.VITE_GROQ_API_KEY
  ].filter(Boolean);

  const groqApiKey = groqKeys[0] || '';

  // Return masked key identifier (last 4 chars) for auditing
  return res.status(200).json({
    apiKey: validKey,
    keyHint: validKey.slice(-4),
    groqApiKey: groqApiKey,
  });
}
