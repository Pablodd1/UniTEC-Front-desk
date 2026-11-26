/**
 * Server-side brand packs. The chat handler is shared by two companies; every fact that
 * belongs to ONE company lives here and is selected by brandId. Never add a company fact
 * to the shared part of the prompt.
 *
 * BUILDING INNOVATION: English-first, US customary units, USD.
 * UNITEC USA DESIGN:  Spanish-first, metric units, COP.
 *
 * Unknown-but-required facts (BI payment methods, BI shipping origin) are written as
 * "confirm with the sales team" on purpose — a wrong fact on a live sales bot is worse
 * than an honest hand-off.
 */

export const UNITS = {
  cm: (v) => v / 2.54,
  m: (v) => v * 3.28084,
  m2: (v) => v * 10.7639,
  kg: (v) => v * 2.20462,
  mm: (v) => v / 25.4,
  round: (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d,
};

/**
 * "Ancho: 122cm | Largo: 2.44m | Área: 2.9m² | Peso: 19kg | Espesor: 8mm"
 *  ->  "Width: 48 in (122cm) | Length: 8 ft (2.44m) | Area: 31.2 sq ft (2.9m²) | ..."
 * Conversion only: the metric original always stays in parentheses, so nothing is invented
 * and a customer can reconcile the number with the spec sheet.
 */
export function specsToImperial(specs = '') {
  if (!specs) return '';
  const label = {
    Ancho: 'Width', Largo: 'Length', 'Área': 'Area', Area: 'Area',
    Peso: 'Weight', Espesor: 'Thickness', Alto: 'Height', Diametro: 'Diameter',
    'Diámetro': 'Diameter', Calibre: 'Gauge',
  };
  return String(specs)
    .split('|')
    .map((part) => part.trim())
    .map((part) => {
      const m = part.match(/^([^:]+):\s*(.+)$/);
      if (!m) return part;
      const key = m[1].trim();
      const value = m[2].trim();
      const en = label[key] || key;
      const num = parseFloat(value.replace(',', '.'));
      if (!Number.isFinite(num)) return `${en}: ${value}`;
      // The unit is the token right after the number ("2.44m", "122cm", "2.9m²", "19kg").
      const um = value.match(/(\d)\s*(m²|m2|mt2|cm|mm|kg|lbs?|m|metros?|mts)(?=\s|$|\||\))/i);
      const unit = um ? um[2].toLowerCase() : '';
      let conv = '';
      if (unit === 'cm') conv = `${UNITS.round(UNITS.cm(num))} in`;
      else if (unit === 'mm') conv = `${UNITS.round(UNITS.mm(num), 2)} in`;
      else if (['m²', 'm2', 'mt2'].includes(unit)) conv = `${UNITS.round(UNITS.m2(num))} sq ft`;
      else if (unit === 'kg' || unit === 'lb' || unit === 'lbs') conv = `${UNITS.round(UNITS.kg(num))} lb`;
      else if (['m', 'metro', 'metros', 'mts'].includes(unit)) conv = `${UNITS.round(UNITS.m(num))} ft`;
      return conv ? `${en}: ${conv} (${value})` : `${en}: ${value}`;
    })
    .join(' | ');
}

/** A price that must never be invented. Empty / placeholder -> the bot says "Consultar precio". */
const UNKNOWN_PRICE = /consultar|n\/a|—|-|^$/i;

export function priceForBrand(p, brandId) {
  const raw = brandId === 'building'
    ? (p.price_usd || '')
    : (p.price_cop || p.price || '');
  const value = String(raw || '').trim();
  if (!value || UNKNOWN_PRICE.test(value)) return '';
  return value;
}

const BUILDING = {
  id: 'building',
  name: 'BUILDING INNOVATION',
  tagline: 'We design the future - Constructive solutions and alternatives',
  market: 'Doral, Miami, FL 33166, USA',
  showroom: '6120 NW 74th Ave, Doral, Miami, FL 33166',
  langLine: 'Greet and converse in ENGLISH first. Switch to Spanish only if the customer writes in Spanish, and then stay in Spanish.',
  unitsLine: 'US customary units: inches, feet, square feet, pounds. Currency: USD only. When you quote a measurement, give the imperial value first and put the metric original in parentheses.',
  areaLine: 'Ask for the project area in SQUARE FEET (sq ft), not square meters.',
  phone: '+1 (786) 968-5783',
  wa: 'https://wa.me/17869685783',
  staff: `- JOHANA MESA (Distribution Sales Manager) | Tel: +1 (786) 968-5783
- JUAN DAVID GARCIA (CEO) | Tel: +1 (786) 657-5441
- ANTONIO BORJAS (Sales Representative) | Tel: +1 (786) 546-9051
- MARLON MONCADA (Sales Representative - Southwest Florida) | Tel: +1 (239) 878-9299
- ALEXANDER GOMEZ ZAPATA (International Account Manager) | Tel: +57 311 3017763`,
  rules: `# BUSINESS RULES — BUILDING INNOVATION (THESE OVERRIDE ANY OTHER COMPANY DATA)
- INSTALLATION: Building Innovation distributes materials; it does not install. Answer exactly: "We distribute the materials and do not install; we can share the contact of an external installer."
- LOCATION / SHOWROOM: ${'6120 NW 74th Ave, Doral, Miami, FL 33166'}. That is the only address you may give.
- WAREHOUSE / SHIPPING ORIGIN: do NOT name a warehouse or dispatch city. Say the sales team confirms the shipping origin and lead time for the order. NEVER say Guarne, Medellín, Colombia or any UNITEC location.
- PAYMENT: do NOT state a payment method (no "transferencia electrónica", no card, no Zelle, no ACH). Say a sales representative will confirm the accepted payment options for the order, then hand off once, at the end.
- CURRENCY: quote prices in USD only, always as an APPROXIMATE value per unit that depends on measurements, quantity and reference. If the product has no USD price in the context, answer "Price on request" and offer the hand-off. NEVER quote a COP price.
- CATALOG: do not send a catalog link unless it appears in the context. NEVER send the UNITEC Canva link.
- STOCK: describe the product with measurements and colours, then say the sales team confirms availability of references and colours.
- If a customer asks for something that belongs to UNITEC (Colombian warehouse, COP prices, UNITEC catalog), answer that this is Building Innovation and offer the Building Innovation contact. Never mix the two companies.`,
};

const UNITEC = {
  id: 'unitec',
  name: 'UNITEC USA DESIGN',
  tagline: 'Importador Directo - Distribución Mayorista',
  market: 'Colombia / Florida, USA (Immediate Stock)',
  showroom: 'Centro Comercial Ideo, Local 274 - bodega principal en Guarne',
  langLine: 'Greet and converse in SPANISH first. Switch to English only if the customer writes in English, and then stay in English.',
  unitsLine: 'Metric units: centimetres, meters, square meters, kilograms. Currency: COP. USD only as a reference if the customer asks.',
  areaLine: 'Ask for the area in square meters (m²).',
  phone: '+57 314 233 2147',
  wa: 'https://wa.me/573142332147',
  staff: `- WhatsApp oficial de la compañía (ÚNICO canal para escalar): +57 314 233 2147 → https://wa.me/573142332147
- NUNCA compartas el número ni el enlace de WhatsApp de un asesor individual al escalar.`,
  rules: `# BUSINESS RULES — UNITEC USA DESIGN (THESE OVERRIDE ANY OTHER COMPANY DATA)
- INSTALACIÓN: responde exactamente "Señor o Señora te cuento que actualmente nuestra compañía solo realiza distribución mas no instalación para este proceso te podemos informar el contacto de una persona externa, posterior".
- UBICACIÓN: punto físico en Centro Comercial Ideo (Local 274); bodega principal en Guarne, de donde se realizan todos los despachos.
- MEDIO DE PAGO: transferencia electrónica; el pedido se toma con uno de nuestros vendedores.
- CATÁLOGO: solo si piden el catálogo COMPLETO: 📂 CATÁLOGO DE PRODUCTOS 2026 https://canva.link/l7fu4xk4lp5jed2
- STOCK (Medellín): describe el producto con medidas y colores, luego indica que un asesor debe validar referencias y colores con el WhatsApp oficial.
- PRECIOS: valores APROXIMADOS por unidad en COP, solo si los piden; si no está en la lista, "Consultar precio".
- Nunca menciones datos de Building Innovation (Doral, USD, su equipo).`,
};

export const brandPacks = { unitec: UNITEC, building: BUILDING };
export const brandPack = (brandId) => (brandId === 'building' ? BUILDING : UNITEC);
