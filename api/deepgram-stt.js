export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const apiKey = req.headers['authorization']?.replace(/^Bearer\s+|^Token\s+/i, '') || process.env.DEEPGRAM_API_KEY || 'b7a3b32ae544ca0840276c20767fcf177ff3deec';
    const language = req.query.language || 'es';
    const model = req.query.model || 'nova-2';

    if (!apiKey) {
      return res.status(400).json({ error: 'DEEPGRAM_API_KEY not configured on server' });
    }

    const dgUrl = `https://api.deepgram.com/v1/listen?model=${encodeURIComponent(model)}&smart_format=true&language=${encodeURIComponent(language)}`;

    const dgRes = await fetch(dgUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': req.headers['content-type'] || 'audio/wav'
      },
      body: req.body
    });

    if (!dgRes.ok) {
      const errText = await dgRes.text();
      console.error('Deepgram STT API Error:', errText);
      return res.status(dgRes.status).json({ error: `Deepgram STT error: ${errText}` });
    }

    const data = await dgRes.json();
    const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

    return res.status(200).json({ transcript, data, success: true });
  } catch (error) {
    console.error('Deepgram STT proxy exception:', error);
    return res.status(500).json({ error: error.message || 'Internal STT Server Error' });
  }
}
