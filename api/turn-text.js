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
