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

// Context/memory watchdog: inspects each conversation size and fires Telegram/Email/WhatsApp
// alerts BEFORE the AI context fills up and slows or stops the bot. Fire-and-forget so it
// never adds latency to the user's chat response.
import { inspectConversation } from './health.js';
import { getSharedTraining } from './shared-training.js';
import { recordChatTurn } from './_record-chat-turn.js';
import { normalizeHistory, catalogReply, tightenReply } from './turn-text.js';
import { alertAnomaly } from './anomaly-alert.js';
import { createRequire } from 'module';
const require_ = createRequire(import.meta.url);
const firebaseConfig = require_('../firebase-applet-config.json');

// Shared training data from Firestore config/main — the dashboard's Training module
// writes here via /api/training; injecting it server-side makes training reach the bot
// on EVERY origin (including embedded widgets) without depending on browser localStorage.

// Cap transcript sent to the AI. Long conversations fill the context window and make the bot
// slow then unresponsive. Keeping the last ~30 turns preserves enough continuity while bound
// the request size (mirrors the voice-mode trim in geminiService.ts).
function trimHistory(history) {
  if (!Array.isArray(history)) return [];
  if (history.length <= 60) return history;
  return history.slice(-60);
}

// ── Canonical origin + product cache (server-side fetch; never the request origin — review fix) ──
const CANONICAL_ORIGIN = 'https://unitec-front-desk.vercel.app';
let productsCache = { data: null, fetchedAt: 0 };
const PRODUCTS_TTL_MS = 10 * 60 * 1000;
async function getProducts() {
  if (productsCache.data && Date.now() - productsCache.fetchedAt < PRODUCTS_TTL_MS) return productsCache.data;
  const r = await fetch(`${CANONICAL_ORIGIN}/products.json`);
  const data = await r.json();
  productsCache = { data, fetchedAt: Date.now() };
  return data;
}

// ── Reads an upstream SSE stream (Gemini alt=sse or OpenAI-style) and forwards text deltas ──
async function readSseStream(body, extractDelta, onDelta, shouldStop) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      if (shouldStop && shouldStop()) { try { await reader.cancel(); } catch (_) {} return; }
      const { done, value } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        let obj;
        try { obj = JSON.parse(payload); } catch (_) { continue; }
        const delta = extractDelta(obj);
        if (delta) onDelta(delta);
      }
    }
  } catch (e) {
    // upstream broke mid-stream — caller decides (partial text already forwarded stays)
    console.warn('readSseStream ended:', e?.message);
  }
}

export default async function handler(req, res) {
  const latencyStart = Date.now();
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
    const { message, history: rawHistory, instructions: clientInstructions, sessionId: clientSessionId, brandId = 'unitec', parentHost, stream: wantStream } = req.body;
    const origin = req.headers.origin || 'https://chatbuildinginnovation.us';
    if (!message) {
      return res.status(400).json({ error: 'Missing message in request body' });
    }

    const directCatalog = catalogReply(message);
    if (directCatalog) {
      if (clientSessionId) {
        await recordChatTurn({ sessionId: clientSessionId, userText: message, replyText: directCatalog, brand: brandId, parentHost }).catch(() => {});
      }
      return res.status(200).json({ text: directCatalog, success: true, direct: 'catalog' });
    }

    const history = trimHistory(normalizeHistory(rawHistory));

    // ── Shared training injection ──────────────────────────────────────
    // Merge the dashboard-managed training (config/main.trainingData) into the
    // system instructions so the bot follows the pautas on every origin.
    let instructions = clientInstructions || '';

    // ── SERVER-SIDE BASE FRONT-DESK GUARD (fix: "Nancy's info not generated") ──
    // The real client (ChatTab via sendMessageToGemini) always sends the full
    // base system prompt from constants.ts (unit/warehouse location, distribution-
    // only/no-install, payment method, Medellín-stock procedure, staff). But if
    // /api/chat is ever called WITHOUT that base prompt (a custom/embedded widget,
    // a stale bundle, a direct call), the model only gets the Firestore pautas and
    // answers EVERYTHING with Pauta 4 (generic 24/7 asesoría) — none of the front-desk
    // knowledge comes out. This guard re-injects the base front-desk knowledge
    // server-side so it is ALWAYS present, no matter how the chat is triggered.
    const BASE_FRONT_DESK = `# ROLE & IDENTITY
You are the professional AI Front Desk Assistant and Senior Sales Representative for UNITEC USA DESIGN (Importador Directo - Distribución Mayorista). Colombia / Florida, USA. Answer in Spanish first, switch to English only if the customer writes in English.

# ACTIVE REPRESENTATIVES & CONTACTS (ONLY use these staff):
- Camilo Andres Torres (Ventas) | Tel: +57 310 457 8337 | https://wa.me/573104578337
- Yuldor Stiven Avendano (Ejecutivo Comercial IDEO y Marketing online) | Tel: +57 310 576 9694 | https://wa.me/573105769694
- Henderson Patrick Arroyave (Ejecutivo Marketing Online) | Tel: +57 320 217 4854 | https://wa.me/573202174854
- Contacto General WhatsApp / Principal: +57 314 233 2147 | https://wa.me/573142332147

# REGLAS ESPECÍFICAS DEL NEGOCIO (RESPONDE EXACTAMENTE según estas reglas):
- INSTALACIÓN: Cuando pregunten por instalación de producto, responde EXACTAMENTE: "Señor o Señora te cuento que actualmente nuestra compañía solo realiza distribución mas no instalación para este proceso te podemos informar el contacto de una persona externa, posterior"
- UBICACIÓN / PUNTO FÍSICO: Si preguntan por la ubicación, dirección o dónde está la bodega, responde que el punto físico se encuentra en el Centro Comercial Ideo (Local 274), pero la bodega principal está en Guarne, de donde se realizan todos los despachos.
- MEDIO DE PAGO: Cuando pregunten por el medio de pago, informa que el pago se realiza por transferencia electrónica y el pedido se toma directamente con uno de nuestros vendedores.
- CONSULTA DE STOCK (Medellín): Si preguntan por disponibilidad en Medellín, primero da la descripción del producto con medidas y colores, y luego indica que para validar referencias y colores debe contactarse un asesor comercial, guiando a Camilo Andres Torres (https://wa.me/573104578337).
- CATÁLOGO: Cuando pidan catálogo, NO pidas correo. Envíalo y haz una pregunta de interés para continuar la venta.
- COTIZACIÓN/PRECIOS: Informa siempre valores APROXIMADOS por unidad, dependientes de medidas y cantidades.
- ASESORÍA/HUMANO: Cuando pidan atención humana o asesoría, comunícate formalmente y deriva al contacto de ventas.

# RESPONSE STYLE RULES (CRITICAL — ALWAYS FOLLOW):
- MAXIMUM 2-3 SHORT SENTENCES per response. NO EXCEPTIONS.
- Answer ONLY what was asked. Do NOT add unsolicited product lists, descriptions, or company info.
- NO bullet points, NO numbered lists, NO headers, NO bold text in responses.
- NEVER mention product names, prices, or services unless the customer specifically asks about them.
- Ask ONE follow-up question maximum, only if needed to help the customer.
- Keep responses SHORT, DIRECT, and CONVERSATIONAL like a real WhatsApp chat.

BAD EXAMPLE (NEVER DO THIS): "¡Hola! Somos importadores directos y distribuidores mayoristas de acabados arquitectónicos y decorativos. Contamos con Fachadas Deck, Cubiertas Termoacústicas, Foam Board, y mucho más. ¿En qué te podemos ayudar? Aquí tienes nuestra lista de productos: ✨ Fachada Deck..."

GOOD EXAMPLE: "¡Hola! ¿En qué producto te interesa?"`;

    // Has a real base prompt already been sent by the client? The full
    // getSystemInstruction from constants.ts always contains the bodega/location
    // rule and the role header. If either is present, we leave the client's
    // (richer) base prompt as-is and don't override it.
    const hasBase = instructions.includes('CENTRO COMERCIAL') ||
      instructions.includes('Guarne') ||
      instructions.includes('bodega principal');
    if (!hasBase && !instructions.includes('ROLE & IDENTITY')) {
      instructions = BASE_FRONT_DESK + '\n\n' + instructions;
    }

    // Response style guard — ensure style rules are ALWAYS present even if client
    // sends its own instructions that lack them.
    if (!instructions.includes('RESPONSE STYLE RULES')) {
      instructions += '\n\n# RESPONSE STYLE RULES (CRITICAL — ALWAYS FOLLOW):\n- MAXIMUM 2-3 SHORT SENTENCES per response. NO EXCEPTIONS.\n- Answer ONLY what was asked. Do NOT add unsolicited product lists, descriptions, or company info.\n- NO bullet points, NO numbered lists, NO headers, NO bold text in responses.\n- NEVER mention product names, prices, or services unless the customer specifically asks about them.\n- Ask ONE follow-up question maximum, only if needed to help the customer.\n- Keep responses SHORT, DIRECT, and CONVERSATIONAL like a real WhatsApp chat.';
    }

    try {
      const sharedTraining = await getSharedTraining();
      if (sharedTraining && sharedTraining.trim().length > 0 && !instructions.includes('[CUSTOM MODEL TRAINING]')) {
        instructions += `\n\n[CUSTOM MODEL TRAINING - FOLLOW THESE PAUTAS/RESPONSE GUIDELINES EXACTLY]:\n${sharedTraining}`;
      }
    } catch (e) {
      console.warn('Training injection skipped:', e?.message);
    }

    if (/color/.test(String(message).toLowerCase())) {
      instructions += '\n\n[ESTA PREGUNTA ES DE COLORES] Responde en UNA frase. Nombra como máximo 4 colores, o di que cambian según la referencia. No listes productos, precios ni la empresa. Cierra con una pregunta corta.';
    }

    // Context/memory watchdog — fire-and-forget async alert if the conversation is filling up.
    inspectConversation({ history: rawHistory || [], newMessage: message, brand: brandId })
      .catch(e => console.warn('ctx-health inspect failed:', e?.message));

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
      await alertAnomaly('SIN_LLAVE_IA', 'No hay API keys de IA en el servidor. El bot no puede responder.');
      return res.status(500).json({ error: 'No AI API keys configured on server.' });
    }

    let lastErrorDetails = null;

    // Builds the Gemini-native payload (shared by the streaming and non-streaming paths).
    const buildGeminiPayload = async () => {
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
        generationConfig: { temperature: 0.7, maxOutputTokens: 180 }
      };

      // ponytail: if message looks like a product query, inject matching products as context
      const productKeywords = ['precio', 'price', 'costo', 'cost', 'cuanto', 'how much', 'panel', 'piso', 'floor', 'wpc', 'spc', 'stock', 'disponibilidad', 'availability', 'catalogo', 'catalog'];
      const isProductQuery = productKeywords.some(kw => message.toLowerCase().includes(kw));

      if (isProductQuery) {
        try {
          const products = await getProducts();
          const lowerMsg = message.toLowerCase();
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
      return payload;
    };

    const candidateModels = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];

    // ═══ STREAMING PATH (stream:true) — SSE deltas as they arrive; non-stream path below is untouched ═══
    if (wantStream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      try { res.flushHeaders?.(); } catch (_) {}
      try { res.write(': open\n\n'); } catch (_) {}

      let streamedText = '';
      const hasUrl = () => /https?:\/\//.test(streamedText);
      const capsHit = () => streamedText.length >= (hasUrl() ? 700 : 360);
      const forward = (d) => {
        if (capsHit()) return; // silently stop the tail — keeps the displayed text close to today's tightened length
        streamedText += d;
        try { res.write(`data: ${JSON.stringify({ delta: d })}\n\n`); } catch (_) {}
      };

      const formattedMessages = [
        { role: 'system', content: instructions || '' },
        ...(history || []).map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.text || h.content || '' })),
        { role: 'user', content: message }
      ];

      let sawError = null;
      let anyText = false;

      for (const apiKey of keys) {
        if (anyText || capsHit()) break;
        const isXAI = apiKey.startsWith('xai-');
        const isOpenRouter = apiKey.startsWith('sk-or-') || apiKey.startsWith('sk-proj-');
        try {
          if (isXAI || isOpenRouter) {
            const sseUrl = isXAI ? 'https://api.x.ai/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
            const headers = isXAI
              ? { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
              : { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': origin || CANONICAL_ORIGIN, 'X-Title': 'UniTEC AI Desk' };
            const sseBody = { model: isXAI ? 'grok-latest' : 'google/gemini-3.6-flash', messages: formattedMessages, temperature: 0.7, stream: true };
            const r = await fetch(sseUrl, { method: 'POST', headers, body: JSON.stringify(sseBody), signal: AbortSignal.timeout(25000) });
            if (!r.ok || !r.body) { sawError = `${isXAI ? 'xAI' : 'OpenRouter'} ${r.status}: ${(await r.text().catch(() => '')).slice(0, 160)}`; continue; }
            await readSseStream(r.body, (j) => j.choices?.[0]?.delta?.content || '', (d) => { forward(d); anyText = true; }, capsHit);
          } else {
            const payload = await buildGeminiPayload();
            for (const modelName of candidateModels) {
              if (anyText || capsHit()) break;
              try {
                const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${apiKey}`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(25000)
                });
                if (!r.ok || !r.body) { sawError = `${modelName} ${r.status}: ${(await r.text().catch(() => '')).slice(0, 160)}`; continue; }
                await readSseStream(r.body, (j) => (j.candidates?.[0]?.content?.parts || []).map(p => p?.text || '').join(''), (d) => { forward(d); anyText = true; }, capsHit);
              } catch (mErr) { sawError = mErr?.message || String(mErr); }
            }
          }
        } catch (keyErr) { sawError = keyErr?.message || String(keyErr); }
      }

      const latencyMs = Date.now() - latencyStart;

      if (!streamedText) {
        // All providers failed before any delta → same fallback copy as the JSON path.
        const fallbackText = "¡Hola! Gracias por contactar a UNITEC USA Design. En este momento nuestra pasarela de Inteligencia Artificial se encuentra en actualización de credenciales. Para ser atendido inmediatamente por un asesor de ventas humano, por favor comunícate a nuestro WhatsApp oficial: https://wa.me/573142332147";
        forward(fallbackText);
        await alertAnomaly('BOT_SIN_RESPUESTA', sawError || 'Todas las llaves de IA fallaron (stream).', clientSessionId);
      }

      const finalText = streamedText;
      if (clientSessionId && finalText && !finalText.includes('actualización de credenciales')) {
        const recorded = await recordChatTurn({ sessionId: clientSessionId, userText: message, replyText: finalText, brand: brandId, parentHost, latencyMs });
        if (recorded && recorded.recorded === false) {
          await alertAnomaly('REGISTRO_FALLIDO', recorded.reason || 'El turno se respondió pero no quedó guardado.', clientSessionId);
        }
      }

      const lowerMsg = (message || '').toLowerCase();
      const escalationKeywords = [
        'cotiz', 'presupuesto', 'quote', 'budget',
        'precio', 'costo', 'valor', 'price', 'cost',
        'asesor', 'humano', 'staff', 'human', 'agent',
        'llamar', 'call me', 'telefono', 'contacto', 'atencion', 'atención',
        'whatsapp', 'speak to someone', 'talk to someone'
      ];
      const isEscalation = escalationKeywords.some(kw => lowerMsg.includes(kw));
      const isQuote = ['cotiz', 'presupuesto', 'quote', 'budget', 'precio', 'costo', 'valor', 'price', 'cost'].some(kw => lowerMsg.includes(kw));
      const isStaff = ['asesor', 'humano', 'staff', 'human', 'agent', 'llamar', 'call me', 'contacto', 'atencion', 'atención', 'speak to someone', 'talk to someone'].some(kw => lowerMsg.includes(kw));

      try {
        res.write(`data: ${JSON.stringify({
          done: true,
          text: finalText,
          success: true,
          ...(req.headers['x-diag'] ? { ms: latencyMs } : {}),
          ...(isEscalation && {
            escalation: {
              type: isQuote ? 'quote' : isStaff ? 'staff' : 'custom',
              priority: 'high',
              trigger: 'server_detected',
              originalMessage: message,
            }
          })
        })}\n\n`);
      } catch (_) {}
      try { res.end(); } catch (_) {}
      return;
    }

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
          const payload = await buildGeminiPayload();

          // candidateModels is declared above (shared with the streaming path)
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

        const latencyMs = Date.now() - latencyStart;

        if (responseText) {
          responseText = tightenReply(responseText);

          // Record this real chat turn server-side (messages + counters + funnel).
          // AWAITED (not fire-and-forget): Vercel kills pending promises when the
          // response returns, which silently dropped all recording otherwise.
          if (clientSessionId && !String(responseText).includes('actualización de credenciales')) {
            const recorded = await recordChatTurn({ sessionId: clientSessionId, userText: message, replyText: responseText, brand: brandId, parentHost, latencyMs });
            if (recorded && recorded.recorded === false) {
              await alertAnomaly('REGISTRO_FALLIDO', recorded.reason || 'El turno se respondió pero no quedó guardado.', clientSessionId);
            }
          }

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
            ...(req.headers['x-diag'] ? { ms: latencyMs } : {}),
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
    await alertAnomaly('BOT_SIN_RESPUESTA', lastErrorDetails || 'Todas las llaves de IA fallaron.', clientSessionId);

    return res.status(200).json({ text: fallbackText, success: true, isFallback: true, lastError: lastErrorDetails });
  } catch (error) {
    console.error("Proxy Chat Error:", error);
    await alertAnomaly('ERROR_CHAT', error?.message || String(error), req.body?.sessionId);
    return res.status(200).json({
      text: "¡Hola! Gracias por contactar a UNITEC USA Design. Para asistencia inmediata, comunícate a nuestro WhatsApp oficial: https://wa.me/573142332147",
      success: true,
      isFallback: true 
    });
  }
}
// force redeploy Thu Oct  1 07:11:47 AM CST 2026
