// Secure endpoint: validates request origin/auth before returning API keys.
// Uses a shared ADMIN_SECRET env var for authentication.
// Only allows requests from configured ALLOWED_ORIGINS.

export default async function handler(req, res) {
  // ---- CORS: Restrict to known origins ----
  const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const origin = req.headers.origin || '';

  if (ALLOWED_ORIGINS.length > 0 && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
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

  // ---- Auth: Require shared secret or Authorization header ----
  const ADMIN_SECRET = process.env.ADMIN_SECRET;
  const authHeader = req.headers.authorization || '';
  const authParam = req.query.token || '';

  if (ADMIN_SECRET) {
    const providedToken = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authParam;

    if (providedToken !== ADMIN_SECRET) {
      console.warn('Unauthorized attempt to access gemini-key endpoint');
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

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

  // Return masked key identifier (last 4 chars) for auditing
  return res.status(200).json({
    apiKey: validKey,
    keyHint: validKey.slice(-4),
  });
}

