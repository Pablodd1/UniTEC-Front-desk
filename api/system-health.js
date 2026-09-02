// /api/system-health — server-side health check for the admin dashboard.
// Checks Gemini model availability with the SERVER env key and returns ONLY
// status/latency — never the key itself. Created 2026-09-02 to replace the
// client-side check that required fetching the raw key from /api/gemini-key
// (which leaked it publicly before the endpoint was locked down).

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_BACKUP_KEY,
    process.env.VITE_GEMINI_API_KEY,
    process.env.API_KEY
  ].filter(Boolean);

  if (keys.length === 0) {
    return res.status(200).json({ status: 'down', latency: 0, error: 'No Gemini key configured on server', lastChecked: new Date().toISOString() });
  }

  const start = Date.now();
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${keys[0]}`,
      { signal: AbortSignal.timeout(10000) }
    );
    const latency = Date.now() - start;
    if (response.ok) {
      return res.status(200).json({ status: 'up', latency, lastChecked: new Date().toISOString() });
    }
    return res.status(200).json({ status: 'degraded', latency, error: `HTTP ${response.status}`, lastChecked: new Date().toISOString() });
  } catch (e) {
    return res.status(200).json({ status: 'down', latency: Date.now() - start, error: e.message, lastChecked: new Date().toISOString() });
  }
}
