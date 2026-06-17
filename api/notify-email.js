export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
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

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'lidermarketingonline@espaciosimportados.com.co';
  const recipient = to || ADMIN_EMAIL;

  if (!RESEND_API_KEY) {
    console.error("Missing Resend API Key.");
    return res.status(500).json({ error: 'Email configuration is missing on the server.' });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'UniTEC AI Desk <onboarding@resend.dev>',
        to: [recipient],
        subject: subject,
        html: html
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Resend API Error:", data);
      return res.status(500).json({ error: 'Failed to send Email', details: data });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error sending Email:", error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
