// Normaliza números de teléfono para SÍNTESIS DE VOZ.
//
// Problema real: el bot decía "…+57 314 233 2147…" y el TTS lo leía como una CANTIDAD
// ("quinientos setenta y tres mil ciento cuarenta y dos millones…") en lugar de dictar los dígitos.
// Al cliente le llegaba un número imposible de marcar.
//
// Regla: un teléfono se dicta dígito por dígito, con una pausa breve entre grupos.
// Se excluyen precios, refcodes y medidas para no romper otras cifras.

const MONEY_AFTER = /\b(pesos|d[oó]lares?|usd|cop|millones?|mil|metros?|m2|m²|kg|unidades?|productos?|d[ií]as?|horas?)\b/i;
const CODE_BEFORE = /\b(sku|ref|c[oó]digo|referencia|modelo|gu[ií]a|pedido)\s*[:#-]?\s*$/i;

export function phoneForSpeech(input) {
  if (input === null || input === undefined) return input;
  let text = String(input);

  // Una URL nunca se lee caracter por caracter.
  text = text.replace(/https?:\/\/\S+/gi, ' ').replace(/\bwww\.\S+/gi, ' ');
  // Correos: se dejan tal cual, pero sin que el TTS deletree el dominio.
  text = text.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, (m) => m.replace(/[@._-]/g, ' '));

  const CANDIDATE = /\+?\d[\d ().-]{5,}\d/g;

  text = text.replace(CANDIDATE, (match, offset, whole) => {
    const digits = match.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) return match; // precios cortos, códigos

    const before = whole.slice(Math.max(0, offset - 14), offset);
    const after = whole.slice(offset + match.length, offset + match.length + 14);
    if (/\$\s*$/.test(before)) return match; // $37.098
    if (CODE_BEFORE.test(before)) return match; // SKU 123456789
    if (MONEY_AFTER.test(after)) return match; // 1.250.000 pesos

    let groups = match.replace(/[()]/g, '').split(/[^\d]+/).filter(Boolean);
    const startsPlus = /^\s*\+/.test(match);
    const hasParens = /[()]/.test(match);

    // 1.250.000 / 37.098.500 → dinero, no teléfono.
    if (!startsPlus && !hasParens && groups.length >= 2 &&
        groups.slice(1).every((g) => g.length === 3) && /\./.test(match)) {
      return match;
    }

    const isPhone = startsPlus || hasParens || /[-\s]/.test(match) || digits.length >= 9;
    if (!isPhone) return match;

    // Sin separadores (3142332147) se agrupa 3-3-resto para dar pausas naturales.
    if (groups.length === 1 && groups[0].length >= 7) {
      const d = groups[0];
      groups = [d.slice(0, 3), d.slice(3, 6), d.slice(6)].filter(Boolean);
    }

    // Dictado: "más 5 7. 3 1 4. 2 3 3. 2 1 4 7"
    const spoken = groups.map((g) => g.split('').join(' ')).join('. ');
    const next = whole.slice(offset + match.length, offset + match.length + 1);
    const end = /[.,;:!?]/.test(next) ? ' ' : '. ';
    return `${startsPlus ? 'más ' : ''}${spoken}${end}`;
  });

  // paréntesis huérfanos que dejó el formateo del teléfono
  return text.replace(/\(\s*(\d)/g, '$1').replace(/(\d)\s*\)/g, '$1');
}

export default phoneForSpeech;
