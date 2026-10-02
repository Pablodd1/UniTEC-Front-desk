// Client sends Gemini-style { role, parts: [{ text }] }.
// Older server code only read h.text / h.content, so every follow-up
// turn arrived as a blank message and the model (or the provider) failed.

export function turnText(entry) {
  if (!entry) return '';
  if (typeof entry === 'string') return entry.trim();
  if (typeof entry.text === 'string' && entry.text.trim()) return entry.text;
  if (typeof entry.content === 'string' && entry.content.trim()) return entry.content;
  if (Array.isArray(entry.parts)) {
    const joined = entry.parts
      .map((part) => (typeof part === 'string' ? part : (part?.text || '')))
      .join('')
      .trim();
    if (joined) return joined;
  }
  return '';
}

export function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .map((entry) => ({
      role: entry?.role === 'model' || entry?.role === 'assistant' ? 'model' : 'user',
      text: turnText(entry),
    }))
    .filter((entry) => entry.text);
}

// The ONLY catalog link the client authorises for the COMPLETE catalog
// (Novedades Chatbot 8, 2026-10-02): the Drive folder is no longer sent.
export const CATALOG_URL = 'https://canva.link/l7fu4xk4lp5jed2';
export const CATALOG_LABEL = '📂 CATÁLOGO DE PRODUCTOS 2026';

// Does the message name a product/category? If so the catalogue is answered by the
// AI with that product's own ficha técnica + catalog, never the whole-catalog link.
const PRODUCT_HINT_RE = new RegExp(
  '(piso|deck|panel|pared|paredes|fachada|cubierta|teja|lamina|l[aá]mina|cielo|cornisa|liston|list[oó]n|' +
  'muroflex|uniflex|arqunitec|arqnitec|acolchad|acustic|m[aá]rmol|marmol|spc|wpc|pvc|ps\\b|foam|board|' +
  'policarbonato|jard[ií]n|jardin|led|zocalo|z[oó]calo|omega|vigueta|[aá]ngulo|angulo|caballete|perfil|' +
  'tornillo|clip|plastina|platinas|esquinero|cinta|adhesivo|pegat|transformador|control|referencia)', 'i');

export function catalogReply(message) {
  const text = String(message || '').toLowerCase();
  if (!/(cat[aá]logo|catalog|ficha t[eé]cnica)/.test(text)) return '';
  if (PRODUCT_HINT_RE.test(text)) return ''; // product named → the AI sends that product's catalog
  return `Claro. ${CATALOG_LABEL}: ${CATALOG_URL} ¿Qué producto te interesa? Te envío su catálogo y ficha técnica.`;
}

// ── Escalation intent (single source; was duplicated in both /api/chat paths) ──
// Per Novedades Chatbot 8 the bot must NOT treat a price question as an escalation: it
// qualifies first (producto → m² → uso → perfil → ubicación → datos) and escalates ONCE,
// at the end, to the company's generic WhatsApp. Prices/quotes alone no longer page a human.
const STAFF_WORDS = ['asesor', 'humano', 'staff', 'human', 'agent', 'llamar', 'call me',
  'telefono', 'teléfono', 'contacto', 'atencion', 'atención', 'whatsapp', 'speak to someone',
  'talk to someone', 'hablar con alguien', 'persona real'];
const QUOTE_WORDS = ['cotiz', 'presupuesto', 'quote', 'budget'];

export function detectEscalation(message) {
  const text = String(message || '').toLowerCase();
  const isStaff = STAFF_WORDS.some((kw) => text.includes(kw));
  const isQuote = QUOTE_WORDS.some((kw) => text.includes(kw));
  return { isEscalation: isStaff || isQuote, isQuote, isStaff };
}

export function tightenReply(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  const urls = raw.match(/https?:\/\/[^\s)]+/g) || [];
  let short = raw;
  const sentences = raw.split(/(?<=[.!?])\s+/).filter((s) => s.trim());
  if (sentences.length > 3 || raw.length > 320) {
    short = sentences.slice(0, 2).join(' ');
  }
  if (short.length > 280 && !urls.length) {
    short = short.slice(0, 277) + '...';
  }
  const firstUrl = urls[0];
  if (firstUrl && !short.includes(firstUrl)) {
    short = `${short} ${firstUrl}`.trim();
  }
  return short;
}
