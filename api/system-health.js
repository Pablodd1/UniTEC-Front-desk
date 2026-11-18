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

  // Configuración de canales de alerta (sin exponer secretos: sólo booleanos).
  // El panel marcaba Twilio como "Not configured" porque miraba localStorage; el SMS real sale
  // por Twilio y SÍ está configurado en el servidor.
  const channels = {
    sms: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER),
    telegram: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    email: !!(process.env.RESEND_API_KEY || process.env.RESEND_API_KEY_ALT),
    whatsapp: !!(process.env.SENT_DM_API_KEY || (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)),
  };

  if (keys.length === 0) {
    return res.status(200).json({ status: 'down', latency: 0, channels, error: 'No Gemini key configured on server', lastChecked: new Date().toISOString() });
  }

  const start = Date.now();
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${keys[0]}`,
      { signal: AbortSignal.timeout(10000) }
    );
    const latency = Date.now() - start;
    if (response.ok) {
      return res.status(200).json({ status: 'up', latency, channels, lastChecked: new Date().toISOString() });
    }
    return res.status(200).json({ status: 'degraded', latency, channels, error: `HTTP ${response.status}`, lastChecked: new Date().toISOString() });
  } catch (e) {
    return res.status(200).json({ status: 'down', latency: Date.now() - start, channels, error: e.message, lastChecked: new Date().toISOString() });
  }
}
