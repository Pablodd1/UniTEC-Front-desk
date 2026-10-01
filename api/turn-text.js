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

export const CATALOG_URL = 'https://drive.google.com/drive/folders/1Avy6LdvEt7tnnj1mfrIM2FN6kfbDZ6uw';

export function catalogReply(message) {
  const text = String(message || '').toLowerCase();
  if (!/(cat[aá]logo|catalog)/.test(text)) return '';
  return `Claro. Aquí está el catálogo: ${CATALOG_URL} ¿Qué producto te interesa?`;
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
