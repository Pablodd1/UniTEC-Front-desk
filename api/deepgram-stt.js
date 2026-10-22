// POST /api/deepgram-stt — audio binario → transcripción (Deepgram Nova).
//
// POR QUÉ ESTE FIX (2026-10-18, "la llamada de voz no funciona"): el endpoint recibía el audio en
// `req.body`, pero Vercel sólo parsea JSON/urlencoded: el binario llegaba como `{}` y se reenviaba
// la cadena "[object Object]". Deepgram respondía 400 "failed to process audio: corrupt or
// unsupported data" — reproducido con el mp3 del propio TTS. Ahora se lee el stream CRUDO y se
// reenvía el Buffer, así que cualquier formato del navegador (webm/opus, ogg, mp4, wav, mp3) pasa
// intacto. Sin `bodyParser: false` esto no puede funcionar.
export const config = { api: { bodyParser: false }, maxDuration: 60 };

async function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  const chunks = [];
  try {
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  } catch (e) {
    console.warn('[stt] raw body read failed:', e?.message);
  }
  return Buffer.concat(chunks);
}

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
    const apiKey = req.headers['authorization']?.replace(/^Bearer\s+|^Token\s+/i, '') || process.env.DEEPGRAM_API_KEY;
    const language = req.query.language || 'es';
    const model = req.query.model || 'nova-2';

    if (!apiKey) {
      return res.status(400).json({ error: 'DEEPGRAM_API_KEY not configured on server' });
    }

    const audio = await readRawBody(req);
    if (!audio || audio.length < 400) {
      return res.status(400).json({ error: 'no_audio', received_bytes: audio ? audio.length : 0 });
    }

    const dgUrl = `https://api.deepgram.com/v1/listen?model=${encodeURIComponent(model)}` +
      `&smart_format=true&punctuate=true&language=${encodeURIComponent(language)}`;

    const dgRes = await fetch(dgUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': req.headers['content-type'] || 'audio/webm',
      },
      body: audio,
    });

    if (!dgRes.ok) {
      const errText = await dgRes.text();
      console.error('Deepgram STT API Error:', errText);
      return res.status(dgRes.status).json({ error: `Deepgram STT error: ${errText}`, bytes: audio.length });
    }

    const data = await dgRes.json();
    const alt = data.results?.channels?.[0]?.alternatives?.[0] || {};
    const transcript = alt.transcript || '';

    return res.status(200).json({
      transcript,
      confidence: alt.confidence ?? null,
      bytes: audio.length,
      success: true,
    });
  } catch (error) {
    console.error('Deepgram STT proxy exception:', error);
    return res.status(500).json({ error: error.message || 'Internal STT Server Error' });
  }
}
