export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

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
    return res.status(404).json({ error: 'API keys are missing or not configured on the server.' });
  }

  // Fast validation check
  async function getWorkingKey() {
    for (const key of keys) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }] })
        });
        if (response.ok) {
          return key; // Found a working key
        } else {
          console.error(`Key validation failed with status: ${response.status}`);
        }
      } catch (error) {
        console.error('Network error validating key:', error);
      }
    }
    return null; // All keys failed
  }

  const validKey = await getWorkingKey();

  if (!validKey) {
    return res.status(503).json({ error: 'All configured API keys are suspended or invalid.' });
  }

  return res.status(200).json({ apiKey: validKey });
}