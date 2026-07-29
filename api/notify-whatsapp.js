export default async function handler(req, res) {
  // CORS Headers
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { to, text, channels } = req.body || {};

    if (!to || !text) {
      return res.status(400).json({ error: 'Missing required parameters: to and text' });
    }

    const apiKey = (process.env.SENT_DM_API_KEY || '').trim();

    let recipientList = Array.isArray(to) ? to : [to];
    recipientList = recipientList.map(phone => {
      let p = phone.trim();
      if (!p.startsWith('+')) p = '+' + p.replace(/\D/g, '');
      return p;
    });

    const targetChannels = Array.isArray(channels) && channels.length > 0 ? channels : ['whatsapp', 'sms'];

    const apiRes = await fetch('https://api.sent.dm/v3/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: recipientList,
        text: text,
        channel: targetChannels
      }),
      signal: AbortSignal.timeout(6000)
    });

    const responseData = await apiRes.json();

    if (apiRes.status === 200 || apiRes.status === 202) {
      return res.status(200).json({
        success: true,
        message: 'Message dispatched successfully via Sent.dm',
        data: responseData.data
      });
    }

    return res.status(apiRes.status).json({
      success: false,
      error: responseData.error?.message || 'Sent.dm API returned an error',
      details: responseData
    });
  } catch (error) {
    console.error('Error in notify-whatsapp serverless function:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal Server Error'
    });
  }
}
