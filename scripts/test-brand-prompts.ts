// Regression test: the two brands must never share company data.
// Run: npx tsx scripts/test-brand-prompts.ts
import { getSystemInstruction } from '../constants';

const bi = getSystemInstruction('en', undefined, 'building');
const un = getSystemInstruction('es', undefined, 'unitec');

type Case = { name: string; text: string; must: string[]; mustNot: string[] };

const cases: Case[] = [
  {
    name: 'BUILDING INNOVATION prompt',
    text: bi,
    must: [
      'BUILDING INNOVATION',
      'Doral, Miami, FL 33166',
      '6120 NW 74th Ave',
      'ENGLISH first',
      'square feet',
      'USD only',
      '+1 (786) 968-5783',
      'QUALIFICATION ORDER',
    ],
    mustNot: [
      'Guarne',
      'Centro Comercial Ideo',
      '+57 314 233 2147',
      'canva.link',
      'transferencia electrónica',
      'SPANISH first',
      'Medellín',
      'Decky',
      'Importador Directo',
    ],
  },
  {
    name: 'UNITEC prompt',
    text: un,
    must: [
      'UNITEC USA DESIGN',
      'Guarne',
      'Centro Comercial Ideo',
      '+57 314 233 2147',
      'SPANISH first',
      'm²',
      'canva.link',
    ],
    mustNot: ['Doral, Miami', 'square feet', 'en_US', '+1 (786) 968-5783'],
  },
];

let failed = 0;
for (const c of cases) {
  const missing = c.must.filter((s) => !c.text.includes(s));
  const leaked = c.mustNot.filter((s) => c.text.includes(s));
  if (missing.length) { failed++; console.log(`FAIL ${c.name} — missing: ${missing.join(' | ')}`); }
  if (leaked.length) { failed++; console.log(`FAIL ${c.name} — leaked: ${leaked.join(' | ')}`); }
  if (!missing.length && !leaked.length) console.log(`PASS ${c.name} (${c.text.length} chars)`);
}

// Unit conversion must never invent: imperial + metric original.
// @ts-ignore — plain ESM module, no type declarations
import { specsToImperial } from '../api/brand-packs.js';
const conv = specsToImperial('Ancho: 122cm | Largo: 2.44m | Área: 2.9m² | Peso: 19kg | Espesor: 8mm');
console.log('CONV:', conv);
const convOk = /Width: 48 in \(122cm\)/.test(conv) && /Area: 31\.2 sq ft \(2\.9m²\)/.test(conv) && /Weight: 41\.9 lb \(19kg\)/.test(conv);
if (!convOk) { failed++; console.log('FAIL specsToImperial'); } else console.log('PASS specsToImperial');

process.exit(failed ? 1 : 0);
