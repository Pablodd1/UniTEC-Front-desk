// Rate limiting memory map
const rateMap = new Map();
function isRateLimited(ip, limit = 120, windowMs = 60000) {
  const now = Date.now();
  const timestamps = (rateMap.get(ip) || []).filter(t => now - t < windowMs);
  if (timestamps.length >= limit) return true;
  timestamps.push(now);
  rateMap.set(ip, timestamps);
  return false;
}

export default async function handler(req, res) {
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(clientIp, 120, 60000)) {
    return res.status(429).json({
      error: 'Too many requests. Please wait a moment.',
      retryAfter: 3
    });
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
    const { message, history, instructions, brandId = 'unitec' } = req.body;
    const origin = req.headers.origin || 'https://chatbuildinginnovation.us';
    if (!message) {
      return res.status(400).json({ error: 'Missing message in request body' });
    }

    const keys = [
      process.env.GEMINI_API_KEY,
      process.env.GROQ_API_KEY,
      process.env.XAI_API_KEY,
      process.env.GEMINI_BACKUP_KEY,
      process.env.GEMINI_BACKUP_KEY_2,
      process.env.OPENROUTER_API_KEY,
      process.env.OPENAI_API_KEY,
      process.env.API_KEY,
      process.env.VITE_GEMINI_API_KEY,
      process.env.VITE_API_KEY
    ].filter(Boolean);

    if (keys.length === 0) {
      return res.status(500).json({ error: 'No AI API keys configured on server.' });
    }

    let lastErrorDetails = null;

    for (const apiKey of keys) {
      try {
        const isOpenRouter = apiKey.startsWith('sk-or-') || apiKey.startsWith('sk-proj-');
        const isXAI = apiKey.startsWith('xai-');
        let responseText = '';

        if (isXAI) {
          const formattedMessages = [
            { role: 'system', content: instructions || '' },
            ...(history || []).map(h => ({
              role: h.role === 'model' ? 'assistant' : 'user',
              content: h.text || h.content || ''
            })),
            { role: 'user', content: message }
          ];

          const apiRes = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'grok-latest',
              messages: formattedMessages,
              temperature: 0.7
            }),
            signal: AbortSignal.timeout(12000)
          });

          if (!apiRes.ok) {
            const errText = await apiRes.text();
            console.warn(`xAI Grok key (${apiKey.slice(0, 7)}...) failed:`, errText);
            lastErrorDetails = errText;
            continue; // try next key
          }

          const data = await apiRes.json();
          responseText = data.choices?.[0]?.message?.content || '';
        } else if (isOpenRouter) {
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
              model: 'google/gemini-3.6-flash',
              messages: formattedMessages,
              temperature: 0.7,
            }),
            signal: AbortSignal.timeout(12000)
          });

          if (!apiRes.ok) {
            const errText = await apiRes.text();
            console.warn(`OpenRouter key (${apiKey.slice(0, 7)}...) failed:`, errText);
            lastErrorDetails = errText;
            continue; // try next key
          }

          const data = await apiRes.json();
          responseText = data.choices?.[0]?.message?.content || '';
        } else {
          // Native Google Gemini REST API — verified valid model IDs (July 2026)
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

          // ponytail: if message looks like a product query, inject matching products as context
          const productKeywords = ['precio', 'price', 'costo', 'cost', 'cuanto', 'how much', 'panel', 'piso', 'floor', 'wpc', 'spc', 'stock', 'disponibilidad', 'availability', 'catalogo', 'catalog'];
          const isProductQuery = productKeywords.some(kw => message.toLowerCase().includes(kw));
          
          if (isProductQuery) {
            try {
              const productsRes = await fetch(`${origin}/products.json`);
              const products = await productsRes.json();
              const lowerMsg = message.toLowerCase();
              
              // Extract potential product refs or names from message
              const words = lowerMsg.split(/\s+/);
              const matched = products.filter(p => {
                const pName = p.name.toLowerCase();
                const pId = p.id.toLowerCase();
                return words.some(w => w.length > 2 && (pName.includes(w) || pId.includes(w)));
              }).slice(0, 5);
              
              if (matched.length > 0) {
                const productContext = matched.map(p => 
                  `RefCode: ${p.id} | ${p.name} | Precio: ${brandId === 'unitec' ? (p.price_cop || p.price) : (p.price_usd || p.price)} por ${p.unit || 'unidad'} | Stock: ${p.stock_status || 'Consultar'}`
                ).join('\n');
                
                // Inject as system context
                const contextMsg = `\n\n[SYSTEM CONTEXT - Product data for this query]:\n${productContext}\nUse this data to answer. If the product is not listed, say "Consultar precio".`;
                payload.contents = [
                  ...contents.slice(0, -1),
                  { role: 'user', parts: [{ text: message + contextMsg }] }
                ];
              }
            } catch (e) {
              console.warn('Failed to inject product context:', e);
            }
          }

          // ponytail: ordered by preference — 3.6 is latest stable, then fallbacks
          const candidateModels = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
          for (const modelName of candidateModels) {
            try {
              const apiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(12000)
              });

              if (!apiRes.ok) {
                const errText = await apiRes.text();
                console.warn(`Gemini model ${modelName} failed:`, errText.slice(0, 200));
                lastErrorDetails = errText;
                continue;
              }

              const data = await apiRes.json();
              const candidate = data.candidates?.[0];
              const part = candidate?.content?.parts?.[0];
              
              responseText = part?.text || '';
              if (responseText) break;
            } catch (mErr) {
              console.warn(`Gemini model ${modelName} error:`, mErr.message);
              lastErrorDetails = mErr.message;
            }
          }
        }

        if (responseText) {
          // ponytail: server-side escalation intent detection — catches quote/staff requests
          // even if client-side keyword matching misses them
          const escalationKeywords = [
            'cotiz', 'presupuesto', 'quote', 'budget',
            'precio', 'costo', 'valor', 'price', 'cost',
            'asesor', 'humano', 'staff', 'human', 'agent',
            'llamar', 'call me', 'telefono', 'contacto', 'atencion', 'atención',
            'whatsapp', 'speak to someone', 'talk to someone'
          ];
          const lowerMsg = (message || '').toLowerCase();
          const isEscalation = escalationKeywords.some(kw => lowerMsg.includes(kw));
          const isQuote = ['cotiz', 'presupuesto', 'quote', 'budget', 'precio', 'costo', 'valor', 'price', 'cost'].some(kw => lowerMsg.includes(kw));
          const isStaff = ['asesor', 'humano', 'staff', 'human', 'agent', 'llamar', 'call me', 'contacto', 'atencion', 'atención', 'speak to someone', 'talk to someone'].some(kw => lowerMsg.includes(kw));

          return res.status(200).json({
            text: responseText,
            success: true,
            ...(isEscalation && {
              escalation: {
                type: isQuote ? 'quote' : isStaff ? 'staff' : 'custom',
                priority: 'high',
                trigger: 'server_detected',
                originalMessage: message,
              }
            })
          });
        }
      } catch (keyErr) {
        console.warn(`Error trying API key:`, keyErr);
        lastErrorDetails = keyErr.message;
      }
    }

    // Graceful Fallback: If all API keys fail or are expired (401), return a polite receptionist fallback response
    const fallbackText = "¡Hola! Gracias por contactar a UNITEC USA Design. En este momento nuestra pasarela de Inteligencia Artificial se encuentra en actualización de credenciales. Para ser atendido inmediatamente por un asesor de ventas humano, por favor comunícate a nuestro WhatsApp oficial: https://wa.me/573142332147";

    return res.status(200).json({ text: fallbackText, success: true, isFallback: true, lastError: lastErrorDetails });
  } catch (error) {
    console.error("Proxy Chat Error:", error);
    return res.status(200).json({ 
      text: "¡Hola! Gracias por contactar a UNITEC USA Design. Para asistencia inmediata, comunícate a nuestro WhatsApp oficial: https://wa.me/573142332147",
      success: true,
      isFallback: true 
    });
  }
}
