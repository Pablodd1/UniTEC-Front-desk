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
    const { text, model, apiKey: customKey } = req.body || {};
    const apiKey = customKey || process.env.DEEPGRAM_API_KEY;

    if (!text) {
      return res.status(400).json({ error: 'Missing text parameter' });
    }

    if (!apiKey) {
      return res.status(400).json({ error: 'DEEPGRAM_API_KEY not configured on server' });
    }

    // Clean markdown links, URLs, images, and formatting symbols before sending to TTS
    const cleanText = String(text)
      .replace(/!\[.*?\]\(.*?\)/g, '') // remove markdown images
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // replace markdown links with text only
      .replace(/https?:\/\/\S+/g, '') // remove raw URLs
      .replace(/[*_#~`]/g, '') // remove markdown formatting symbols
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) {
      return res.status(400).json({ error: 'Text empty after markdown sanitization' });
    }

    // Default to Deepgram Aura 2 model if not specified
    const selectedModel = model || 'aura-asteria-en';
    const dgUrl = `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(selectedModel)}&encoding=mp3`;

    const dgRes = await fetch(dgUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: cleanText })
    });

    if (!dgRes.ok) {
      const errText = await dgRes.text();
      console.error('Deepgram TTS API Error:', errText);
      return res.status(dgRes.status).json({ error: `Deepgram API error: ${errText}` });
    }

    const audioBuffer = await dgRes.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mp3');
    return res.status(200).send(Buffer.from(audioBuffer));
  } catch (error) {
    console.error('Deepgram TTS proxy exception:', error);
    return res.status(500).json({ error: error.message || 'Internal TTS Server Error' });
  }
}
