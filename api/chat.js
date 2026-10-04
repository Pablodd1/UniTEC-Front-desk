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
import { normalizeHistory, catalogReply, tightenReply, detectEscalation } from './turn-text.js';
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

// ── Build-time price map (embedded at deploy, zero runtime fetch) ──
const priceMap = require_('../public/price-map.json');

// ── Build-time catalog specs (embedded at deploy, zero runtime fetch) ──
// 245 products with exact specs from the 2026 catalog — the bot answers specs
// INLINE from this map instead of deflecting to Drive PDF links.
const catalogSpecs = require_('../public/catalog-specs.json');

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

// ── Price intent regex ──
const PRICE_INTENT_RE = /(precio|precios|vale|valor|costo|costar|cu[aá]nto|cuanto cuesta|cotiz|presupuesto|price|cost)/i;

// Exact price lookup from build-time map
function priceForProduct(productId) {
  return priceMap[productId] || null;
}

// ── Reads an upstream SSE stream (Gemini alt=sse or OpenAI-style) and forwards text deltas ──
async function readSseStream(body, extractDelta, onDelta, shouldStop) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const stats = { reads: 0, bytes: 0, events: 0, textLen: 0, finish: null, err: null };
  try {
    for (;;) {
      if (shouldStop && shouldStop()) { try { await reader.cancel(); } catch (_) {} stats.err = 'stopped_early'; return stats; }
      const { done, value } = await reader.read();
      if (done) return stats;
      stats.reads++; stats.bytes += value?.length || 0;
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
        stats.events++;
        stats.finish = obj?.candidates?.[0]?.finishReason || obj?.choices?.[0]?.finish_reason || stats.finish || null;
        const delta = extractDelta(obj);
        if (delta) { stats.textLen = (stats.textLen || 0) + delta.length; onDelta(delta); }
      }
    }
  } catch (e) {
    // upstream broke mid-stream — caller decides (partial text already forwarded stays)
    stats.err = e?.message || String(e);
    console.warn('readSseStream ended:', stats.err);
  }
  return stats;
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Idempotency-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // ── Rate limiting (per session + IP) ──
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  const sessionId = req.body?.sessionId || 'anonymous';
  const rateKey = `rate:${ip}:${sessionId}`;
  const now = Date.now();
  const rateData = global.rateCache?.get(rateKey) || { count: 0, windowStart: now };
  if (now - rateData.windowStart > 60000) { rateData.count = 0; rateData.windowStart = now; }
  rateData.count++;
  if (!global.rateCache) global.rateCache = new Map();
  global.rateCache.set(rateKey, rateData);
  if (rateData.count > 30) {
    return res.status(429).json({ error: 'Too many requests per minute', retryAfter: 60 });
  }

  // ── Idempotency — block ONLY a request that duplicates one still IN FLIGHT (double-click).
  // A repeat AFTER the previous one finished (user re-asks; client retries an empty stream)
  // MUST be processed again: blocking finished duplicates caused "no responde" reports —
  // re-asking the same question or the catalogue number returned 409 Duplicate for 5 minutes.
  const idemKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
  const idemCacheKey = `idem:${sessionId}:${idemKey || req.body?.message?.slice(0, 80)}`;
  if (!global.idemCache) global.idemCache = new Map();
  const idemPrev = global.idemCache.get(idemCacheKey);
  if (idemPrev && idemPrev.state === 'in_flight') {
    return res.status(409).json({ error: 'Duplicate request', duplicate: true });
  }
  const idemEntry = { state: 'in_flight', ts: Date.now() };
  global.idemCache.set(idemCacheKey, idemEntry);
  let idemCleanupScheduled = false;
  const idemMarkDone = () => {
    if (idemEntry.state !== 'done') idemEntry.state = 'done';
    if (idemCleanupScheduled) return;
    idemCleanupScheduled = true;
    setTimeout(() => {
      if (global.idemCache?.get(idemCacheKey) === idemEntry) global.idemCache.delete(idemCacheKey);
    }, 60 * 1000);
  };
  res.on('finish', idemMarkDone);
  res.on('close', idemMarkDone);

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

# CONTACTO OFICIAL PARA ESCALAR (EL ÚNICO PERMITIDO)
- WhatsApp oficial de la compañía: +57 314 233 2147 | https://wa.me/573142332147
- NUNCA entregues el número ni el enlace de WhatsApp de un asesor individual al escalar.

# PERSONALIDAD Y TONO (SIEMPRE — ES LO QUE MÁS NOTA EL CLIENTE):
- Eres "Decky", el asistente de recepción de UNITEC USA DESIGN: cálido, cercano, servicial y humano. Nunca robótico ni acartonado.
- Hablas como un buen asesor colombiano por WhatsApp: amable, natural, tuteando ("cuéntame", "con gusto", "claro que sí").
- Tu prioridad es AYUDAR de verdad con la información de la compañía que sí tienes (productos y medidas, usos, precios aproximados, ubicación, medios de pago, distribución): responde primero, pregunta después.
- Empatía real: si el cliente está apurado o no entiende algo, reconócelo con naturalidad y ofrécele la salida más simple.
- NUNCA hagas sentir al cliente que el chatbot solo sirve para remitirlo a un asesor: intenta resolver su consulta tú mismo.
- Cierra con un tono humano y UNA pregunta breve que ayude a avanzar.

# PAUTAS DE CONVERSACIÓN (OBLIGATORIAS — Novedades Chatbot 8):
1. NOMBRE: NO preguntes el nombre al inicio de la conversación. Usa un nombre SOLO si el cliente lo dio explícitamente ("me llamo X", "mi nombre es X", "soy X") o si lo escribió después de que se lo pidieras. NUNCA interpretes su primer mensaje como su nombre: si escribe "Piso deck", "Buenas días dónde están ubicados" o cualquier producto/necesidad, ESO ES SU CONSULTA — respóndela y no lo llames por ese texto.
2. UNA SOLA PREGUNTA POR MENSAJE. Nunca dos.
3. ORDEN DE CALIFICACIÓN (guía tú, sin interrogar): 1) producto → 2) cantidad o m² → 3) uso (residencial o comercial) → 4) perfil (cliente final, arquitecto, constructor, diseñador, distribuidor, mayorista) → 5) ubicación → 6) datos de contacto → 7) UN ÚNICO escalamiento al final.
4. NO REPITAS: si el cliente ya dijo algo (producto, m², uso, ubicación), no lo vuelvas a preguntar ni lo repitas como si fuera nuevo.
5. UN SOLO CAMINO: nunca entregues un contacto y al mismo tiempo sigas haciendo preguntas. Primero recopilas; al final entregas el contacto UNA sola vez.
6. PRIMERO RESUELVE: resuelve con la información disponible. Escala SOLO si (a) se requiere una cotización formal, (b) falta información que no tienes, o (c) el cliente pide hablar con una persona. No le preguntes al cliente con qué asesor desea hablar.
7. PRECIOS: solo si el cliente los pide. Informa siempre que es un VALOR APROXIMADO POR UNIDAD que depende de medidas, cantidades y referencia. Usa EXCLUSIVAMENTE los precios del bloque [LISTA DE PRECIOS] cuando venga en el contexto; si el producto no está allí di "Consultar precio" y ofrece pasar los datos al equipo comercial. PROHIBIDO inventar precios o rangos de precio.
8. CATÁLOGO Y ESPECIFICACIONES: responde las especificaciones DIRECTAMENTE del [SYSTEM CONTEXT] (medidas, espesor, peso, colores) — nunca inventes datos que no estén allí. Solo si el cliente pide explícitamente la ficha o el archivo del producto, envía su enlace; NUNCA el del Drive completo. Catálogo COMPLETO (solo si lo piden): 📂 CATÁLOGO DE PRODUCTOS 2026 https://canva.link/l7fu4xk4lp5jed2
9. BREVEDAD: máximo 2-3 frases, sin listas ni viñetas, tono natural de WhatsApp.

# REGLAS ESPECÍFICAS DEL NEGOCIO (RESPONDE EXACTAMENTE según estas reglas):
- INSTALACIÓN: Cuando pregunten por instalación de producto, responde EXACTAMENTE: "Señor o Señora te cuento que actualmente nuestra compañía solo realiza distribución mas no instalación para este proceso te podemos informar el contacto de una persona externa, posterior"
- UBICACIÓN / PUNTO FÍSICO: Si preguntan por la ubicación, dirección o dónde está la bodega, responde que el punto físico se encuentra en el Centro Comercial Ideo (Local 274), pero la bodega principal está en Guarne, de donde se realizan todos los despachos.
- MEDIO DE PAGO: Cuando pregunten por el medio de pago, informa que el pago se realiza por transferencia electrónica y el pedido se toma directamente con uno de nuestros vendedores.
- CONSULTA DE STOCK (Medellín): Si preguntan por disponibilidad en Medellín, primero da la descripción del producto con medidas y colores, y luego indica que para validar referencias y colores un asesor comercial debe contactarlo, compartiendo el WhatsApp oficial https://wa.me/573142332147.
- CATÁLOGO: Cuando pidan catálogo, NO pidas correo. Responde con las especificaciones del producto y haz UNA pregunta de interés; envía el enlace del producto solo si lo piden explícitamente. Solo si piden el catálogo COMPLETO: 📂 CATÁLOGO DE PRODUCTOS 2026 https://canva.link/l7fu4xk4lp5jed2
- COTIZACIÓN/PRECIOS: Informa valores APROXIMADOS solo si el cliente pide el precio, siempre POR UNIDAD y aclarando que depende de medidas y cantidades. Nunca inventes precios: si no está en [LISTA DE PRECIOS], responde "Consultar precio".
- ASESORÍA/HUMANO: Cuando pidan atención humana o asesoría, comunícate formalmente y entrega el WhatsApp oficial https://wa.me/573142332147 (una sola vez, al final).

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
    const GEMINI_GENCONFIGS = [
      { temperature: 0.7, maxOutputTokens: 300, thinkingConfig: { thinkingBudget: 0 } },
      { temperature: 0.7, maxOutputTokens: 300, thinkingConfig: { thinkingLevel: 'low' } },
      { temperature: 0.7, maxOutputTokens: 300 },
    ];
    const buildGeminiPayload = async (variant = 0) => {
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
        generationConfig: GEMINI_GENCONFIGS[Math.min(variant, GEMINI_GENCONFIGS.length - 1)]
      };

      // ── Context injection ──────────────────────────────────────────────────
      // 1) products matching the question (+ catalog specs INLINE so the bot
      //    answers specs directly instead of deflecting to Drive PDFs), and
      // 2) when the customer asks for a price, the rows of the client's authoritative list —
      //    the only prices the model is allowed to quote (always as an approximation).
      const blocks = [];
      const STOPWORDS = new Set(['que', 'qué', 'para', 'con', 'los', 'las', 'del', 'una', 'uno', 'por',
        'como', 'cómo', 'mas', 'más', 'me', 'mi', 'es', 'el', 'la', 'de', 'y', 'o', 'en', 'un', 'al',
        'se', 'lo', 'su', 'sus', 'valor', 'precio', 'precios', 'cuanto', 'cuánto', 'cuesta', 'vale',
        'quisiera', 'necesito', 'quiero', 'tienen', 'tiene', 'hay', 'the', 'and', 'for', 'how', 'much']);
      const deaccent = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const msgWords = deaccent(String(message).toLowerCase()).split(/[^a-z0-9áéíóúñ]+/)
        .filter((w) => w.length > 2 && !STOPWORDS.has(w));

      let products = [];
      let matched = [];
      if (msgWords.length) {
        try {
          products = await getProducts();
          // Score-based match: words weighted by length (rarer = more specific), so
          // "listón PVC cielo raso" ranks LISTON products above generic PVC láminas.
          const scored = [];
          for (const p of products) {
            const hay = deaccent(`${p.name || ''} ${p.id || ''} ${p.category || ''} ${p.catalog_use || ''}`).toLowerCase();
            let score = 0;
            for (const w of msgWords) if (hay.includes(w)) score += w.length;
            if (score > 0) scored.push([score, p]);
          }
          scored.sort((a, b) => b[0] - a[0]);
          matched = scored.slice(0, 6).map(([, p]) => p);
        } catch (e) {
          console.warn('Failed to load products:', e);
        }
      }

      if (matched.length > 0) {
            const productContext = matched.map((p) => {
              const price = brandId === 'unitec' ? (p.price_cop || p.price) : (p.price_usd || p.price);
              const bits = [
                `RefCode: ${p.id}`,
                p.name,
                `Precio: ${price} por ${p.unit || 'Unidad'}${p.price_approx ? ' (APROXIMADO)' : ''}`,
                `Stock: ${p.stock_status || 'Consultar'}`,
              ];
              // Inject catalog specs INLINE (replaces Drive PDF links)
              if (p.catalog_specs) bits.push(`ESPECIFICACIONES: ${p.catalog_specs}`);
              if (p.catalog_colors?.length) bits.push(`Colores: ${p.catalog_colors.join(', ')}`);
              if (p.catalog_use) bits.push(`Uso: ${p.catalog_use}`);
              if (p.pdf_tech_sheet) bits.push(`Ficha técnica: ${p.pdf_tech_sheet}`);
              if (p.image_url) bits.push(`Imagen: ${p.image_url}`);
              return '- ' + bits.join(' | ');
            }).join('\n');
            blocks.push(`[SYSTEM CONTEXT - Productos que coinciden con la consulta]:\n${productContext}\nREGLA CRÍTICA: Responde las especificaciones técnicas DIRECTAMENTE de los datos anteriores (medidas, espesor, peso, colores). NO redirijas a fichas técnicas de Drive. Si una especificación (por ejemplo el espesor) NO aparece en los datos anteriores, NO la inventes ni la supongas: di que ese dato no está publicado y ofrece confirmarlo con el equipo. Nunca mezcles especificaciones de productos distintos. Solo si el cliente pide explícitamente "la ficha técnica completa" o "el catálogo completo", entonces envía el enlace. Si el producto consultado no está en la lista, di "Consultar precio".`);
      }

      if (PRICE_INTENT_RE.test(String(message)) && matched.length) {
        try {
          // Reuse the top-scored matches; quote only rows present in the build-time price map
          const matchedProducts = matched;

          const priceLines = [];
          for (const p of matchedProducts) {
            const priceInfo = priceForProduct(p.id);
            if (priceInfo) {
              priceLines.push(`- ${p.name} (${p.subcategory || p.category || '—'}): ${priceInfo.price_cop} por ${priceInfo.unit} (APROXIMADO)`);
            }
          }
          if (priceLines.length > 0) {
            blocks.push(`[LISTA DE PRECIOS - LISTA MARKETING cliente final]:\n${priceLines.join('\n')}\nValores aproximados por unidad. Cita SOLO la fila del producto preguntado. Si no está en la lista, di "Consultar precio".`);
          }
        } catch (e) {
          console.warn('Failed to inject price list:', e);
        }
      }

      if (blocks.length > 0) {
        payload.contents = [
          ...contents.slice(0, -1),
          { role: 'user', parts: [{ text: `${message}\n\n${blocks.join('\n\n')}` }] }
        ];
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
      // Clean the final visible text so a capped reply never ends mid-word/mid-sentence.
      const cleanCut = (t) => {
        const cap = /https?:\/\//.test(t) ? 700 : 360;
        if (t.length <= cap) return t;
        const w = t.slice(0, cap);
        let cut = -1;
        for (let i = 0; i < w.length; i++) {
          const ch = w[i];
          if ((ch === '.' || ch === '!' || ch === '?' || ch === '…' || ch === '\n') && (i + 1 >= w.length || /\s/.test(w[i + 1]))) cut = i;
        }
        if (cut >= 120) return w.slice(0, cut + 1).trim();
        const sp = w.lastIndexOf(' ');
        return ((sp > 60 ? w.slice(0, sp) : w).trim()) + '…';
      };
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
      let dbgStats = null;

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
            dbgStats = await readSseStream(r.body, (j) => j.choices?.[0]?.delta?.content || '', (d) => { forward(d); anyText = true; }, capsHit);
          } else {
            for (const modelName of candidateModels) {
              if (anyText || capsHit()) break;
              let modelDone = false;
              for (let v = 0; v < GEMINI_GENCONFIGS.length && !modelDone; v++) {
                if (anyText || capsHit()) break; // mid-stream failure: keep the partial, never restart (would concat a second copy)
                const payload = await buildGeminiPayload(v);
                try {
                  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${apiKey}`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(25000)
                  });
                  if (!r.ok || !r.body) { sawError = `${modelName} v${v} ${r.status}: ${(await r.text().catch(() => '')).slice(0, 160)}`; continue; }
                  dbgStats = await readSseStream(r.body, (j) => (j.candidates?.[0]?.content?.parts || []).map(p => p?.text || '').join(''), (d) => { forward(d); anyText = true; }, capsHit);
                  if (dbgStats) { dbgStats.model = modelName; dbgStats.variant = v; }
                  sawError = sawError || (dbgStats && dbgStats.err ? `${modelName}: ${dbgStats.err}` : null);
                  modelDone = true;
                } catch (mErr) { sawError = `${modelName} v${v}: ${mErr?.message || String(mErr)}`; }
              }
              if (modelDone) break;
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

      const finalText = cleanCut(streamedText);
      if (clientSessionId && finalText && !finalText.includes('actualización de credenciales')) {
        const recorded = await recordChatTurn({ sessionId: clientSessionId, userText: message, replyText: finalText, brand: brandId, parentHost, latencyMs });
        if (recorded && recorded.recorded === false) {
          await alertAnomaly('REGISTRO_FALLIDO', recorded.reason || 'El turno se respondió pero no quedó guardado.', clientSessionId);
        }
      }

      // Price questions are NOT an escalation (Novedades Chatbot 8): the bot qualifies
      // first and escalates once, at the end. Shared detector — see turn-text.js.
      const { isEscalation, isQuote, isStaff } = detectEscalation(message);

      try {
        res.write(`data: ${JSON.stringify({
          done: true,
          text: finalText,
          success: true,
          ...(req.headers['x-diag'] ? { ms: latencyMs, dbg: { sawError, stats: dbgStats } } : {}),
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
          // candidateModels + GEMINI_GENCONFIGS are declared above (shared with the streaming
          // path). The variant loop turns off 3.x "thinking" so it cannot eat the whole
          // maxOutputTokens allowance (done that: finishReason MAX_TOKENS at ~24 chars).
          for (const modelName of candidateModels) {
            let modelDone = false;
            for (let v = 0; v < GEMINI_GENCONFIGS.length && !modelDone; v++) {
              const payload = await buildGeminiPayload(v);
              try {
                const apiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload),
                  signal: AbortSignal.timeout(12000)
                });

                if (!apiRes.ok) {
                  const errText = await apiRes.text();
                  console.warn(`Gemini model ${modelName} v${v} failed:`, errText.slice(0, 200));
                  lastErrorDetails = errText;
                  continue;
                }

                const data = await apiRes.json();
                const candidate = data.candidates?.[0];
                const part = candidate?.content?.parts?.[0];

                responseText = part?.text || '';
                if (responseText) { modelDone = true; break; }
              } catch (mErr) {
                console.warn(`Gemini model ${modelName} v${v} error:`, mErr.message);
                lastErrorDetails = mErr.message;
              }
            }
            if (modelDone) break;
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

          const { isEscalation, isQuote, isStaff } = detectEscalation(message);

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
// force rebuild Sun Oct  4 13:52:18 EDT 2026
