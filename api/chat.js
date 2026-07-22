// Rate limiting memory map
const rateMap = new Map();
function isRateLimited(ip, limit = 60, windowMs = 60000) {
  const now = Date.now();
  const timestamps = (rateMap.get(ip) || []).filter(t => now - t < windowMs);
  if (timestamps.length >= limit) return true;
  timestamps.push(now);
  rateMap.set(ip, timestamps);
  return false;
}

export default async function handler(req, res) {
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(clientIp, 60, 60000)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute before sending another message.' });
  }
  // CORS Origin check
  const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  let origin = req.headers.origin || '';
  if (!origin && req.headers.referer) {
    try {
      const refererUrl = new URL(req.headers.referer);
      origin = refererUrl.origin;
    } catch (e) {
      // ignore
    }
  }

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
    // If no ALLOWED_ORIGINS set, echo request origin or wildcard for dev
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { message, history, instructions } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Missing message in request body' });
    }

    const keys = [
      process.env.OPENROUTER_API_KEY,
      process.env.OPENAI_API_KEY,
      process.env.GEMINI_API_KEY,
      process.env.GEMINI_BACKUP_KEY,
      process.env.API_KEY
    ].filter(Boolean);

    const apiKey = keys[0];
    if (!apiKey) {
      return res.status(500).json({ error: 'No AI API keys configured on server.' });
    }

    // Direct HTTP call to Gemini / OpenRouter API server-side
    const isOpenRouter = apiKey.startsWith('sk-or-') || apiKey.startsWith('sk-proj-');
    let responseText = '';

    if (isOpenRouter) {
      // OpenRouter / OpenAI format
      const formattedMessages = [
        { role: 'system', content: instructions || '' },
        ...(history || []).map(h => ({
          role: h.role === 'model' ? 'assistant' : 'user',
          content: h.text || h.content || ''
        })),
        { role: 'user', content: message }
      ];

      const apiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': origin || 'https://unitec-front-desk.vercel.app',
          'X-Title': 'UniTEC AI Desk'
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-001',
          messages: formattedMessages,
          temperature: 0.7,
        })
      });

      if (!apiRes.ok) {
        const errText = await apiRes.text();
        console.error("OpenRouter API error:", errText);
        return res.status(500).json({ error: 'AI Gateway Error', details: errText });
      }

      const data = await apiRes.json();
      responseText = data.choices?.[0]?.message?.content || '';
    } else {
      // Native Google Gemini REST API format
      const contents = [
        ...(history || []).map(h => ({
          role: h.role === 'model' ? 'model' : 'user',
          parts: [{ text: h.text || h.content || '' }]
        })),
        { role: 'user', parts: [{ text: message }] }
      ];

      const payload = {
        systemInstruction: instructions ? { parts: [{ text: instructions }] } : undefined,
        contents,
        generationConfig: { temperature: 0.7 }
      };

      const apiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!apiRes.ok) {
        const errText = await apiRes.text();
        console.error("Gemini Native API error:", errText);
        return res.status(500).json({ error: 'Gemini API Error', details: errText });
      }

      const data = await apiRes.json();
      responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    return res.status(200).json({ text: responseText, success: true });
  } catch (error) {
    console.error("Proxy Chat Error:", error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
