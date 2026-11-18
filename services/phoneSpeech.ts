// Espejo de api/_phone-speech.js para el cliente (voz del navegador y TTS directo).
// El TTS leía "+57 314 233 2147" como una cifra ("quinientos setenta y tres mil…")
// en lugar de dictar los dígitos, y el cliente no podía marcar el número.

const MONEY_AFTER = /\b(pesos|d[oó]lares?|usd|cop|millones?|mil|metros?|m2|m²|kg|unidades?|productos?|d[ií]as?|horas?)\b/i;
const CODE_BEFORE = /\b(sku|ref|c[oó]digo|referencia|modelo|gu[ií]a|pedido)\s*[:#-]?\s*$/i;

export function phoneForSpeech(input: string): string {
  if (!input) return input;
  let text = String(input);

  text = text.replace(/https?:\/\/\S+/gi, ' ').replace(/\bwww\.\S+/gi, ' ');
  text = text.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, (m) => m.replace(/[@._-]/g, ' '));

  const CANDIDATE = /\+?\d[\d ().-]{5,}\d/g;

  text = text.replace(CANDIDATE, (match: string, offset: number, whole: string) => {
    const digits = match.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) return match;

    const before = whole.slice(Math.max(0, offset - 14), offset);
    const after = whole.slice(offset + match.length, offset + match.length + 14);
    if (/\$\s*$/.test(before)) return match;
    if (CODE_BEFORE.test(before)) return match;
    if (MONEY_AFTER.test(after)) return match;

    let groups = match.replace(/[()]/g, '').split(/[^\d]+/).filter(Boolean);
    const startsPlus = /^\s*\+/.test(match);
    const hasParens = /[()]/.test(match);

    if (!startsPlus && !hasParens && groups.length >= 2 &&
        groups.slice(1).every((g) => g.length === 3) && /\./.test(match)) {
      return match;
    }

    const isPhone = startsPlus || hasParens || /[-\s]/.test(match) || digits.length >= 9;
    if (!isPhone) return match;

    if (groups.length === 1 && groups[0].length >= 7) {
      const d = groups[0];
      groups = [d.slice(0, 3), d.slice(3, 6), d.slice(6)].filter(Boolean);
    }

    const spoken = groups.map((g) => g.split('').join(' ')).join('. ');
    const next = whole.slice(offset + match.length, offset + match.length + 1);
    const end = /[.,;:!?]/.test(next) ? ' ' : '. ';
    return `${startsPlus ? 'más ' : ''}${spoken}${end}`;
  });

  return text.replace(/\(\s*(\d)/g, '$1').replace(/(\d)\s*\)/g, '$1');
}

export default phoneForSpeech;
