// api/fish-tts.js — Fish Audio S2 Pro TTS proxy
// Primary TTS: superior Spanish quality + emotion control
// Falls back gracefully — caller (voiceService) handles failures

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
    const apiKey = customKey || process.env.FISH_AUDIO_API_KEY;

    if (!text) {
      return res.status(400).json({ error: 'Missing text parameter' });
    }

    if (!apiKey) {
      return res.status(400).json({ error: 'FISH_AUDIO_API_KEY not configured' });
    }

    // Clean markdown before TTS — same sanitization as deepgram-tts.js
    const cleanText = String(text)
      .replace(/!\[.*?\]\(.*?\)/g, '')        // remove markdown images
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // keep link text, drop URL
      .replace(/https?:\/\/\S+/g, '')          // remove raw URLs
      .replace(/[*_#~`]/g, '')                 // remove markdown symbols
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) {
      return res.status(400).json({ error: 'Text empty after sanitization' });
    }

    // s2.1-pro-free for dev, s2.1-pro for production
    const selectedModel = model || 's2.1-pro-free';

    const fishRes = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'model': selectedModel
      },
      body: JSON.stringify({
        text: cleanText,
        format: 'mp3',
        latency: 'normal'  // ponytail: balanced quality/speed
      }),
      signal: AbortSignal.timeout(8000)  // fail fast → caller falls back
    });

    if (!fishRes.ok) {
      const errText = await fishRes.text();
      console.error('Fish Audio TTS Error:', fishRes.status, errText.slice(0, 200));
      return res.status(fishRes.status).json({ error: `Fish Audio: ${errText.slice(0, 200)}` });
    }

    const audioBuffer = await fishRes.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mp3');
    return res.status(200).send(Buffer.from(audioBuffer));
  } catch (error) {
    console.error('Fish Audio TTS proxy exception:', error);
    return res.status(500).json({ error: error.message || 'Fish Audio TTS Server Error' });
  }
}
