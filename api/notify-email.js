import { sendEmail } from './_email.js';
export default async function handler(req, res) {
  const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  let origin = req.headers.origin || '';
  if (!origin && req.headers.referer) {
    try {
      const refererUrl = new URL(req.headers.referer);
      origin = refererUrl.origin;
    } catch (e) {}
  }

  // Sin Origin = llamada servidor-a-servidor (curl): ese era el relay abierto.
  if (!origin) return res.status(403).json({ error: 'Origin required' });

  if (ALLOWED_ORIGINS.length > 0 && origin) {
    const isAllowed = ALLOWED_ORIGINS.some(allowed => {
      const allowedClean = allowed.replace(/^https?:\/\//, '').toLowerCase();
      const originClean = origin.replace(/^https?:\/\//, '').toLowerCase();
      return originClean === allowedClean || originClean.endsWith('.' + allowedClean);
    });

    if (!isAllowed) {
      return res.status(403).json({ error: `Origin "${origin}" not allowed` });
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { subject, html, to } = req.body;
  if (!subject || !html) {
    return res.status(400).json({ error: 'Missing subject or html parameter' });
  }

  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'lidermarketingonline@espaciosimportados.com.co';
  const recipient = to || ADMIN_EMAIL;

  // Cadena de remitentes (RESEND_API_KEY → RESEND_API_KEY_ALT). Ver api/_email.js.
  const result = await sendEmail({ subject, html, to: [recipient] });

  if (!result.success) {
    console.error('Resend API Error:', result.error, JSON.stringify(result.attempts || []));
    const missingKey = /No Resend API key found/.test(String(result.error || ''));
    return res.status(500).json({
      error: missingKey ? 'Email configuration is missing on the server.' : 'Failed to send Email',
      details: result.attempts && result.attempts.length ? result.attempts : { message: result.error },
    });
  }

  return res.status(200).json({ success: true, data: result.data, via: result.via });
}
