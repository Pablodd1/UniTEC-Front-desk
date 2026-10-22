// scripts/build-prices.mjs
// Builds the SINGLE source of truth for UniTEC prices from the client's monthly sheet
// (LISTA DE PRECIOS <MES>.xlsx) and stamps it onto both catalog copies.
//
//   node scripts/build-prices.mjs "/mnt/c/Users/jasme/Downloads/LISTA DE PRECIOS OCTUBRE.xlsx"
//
// public/precios-2026.json  — the sheet verbatim (sections → items → price): the auditable snapshot.
//                             /api/chat injects THESE rows when a customer asks for a price.
// products.json             — catalog bundled into the app
// public/products.json      — catalog served to /api/chat for the product [SYSTEM CONTEXT]
//
// Matching rule (conservative, no invention):
//   a sheet row prices a product only when the row name is a TOKEN SUBSEQUENCE of the product
//   name (most specific row wins; two rows with different prices = ambiguous = no price).
//   everything else becomes "Consultar precio" — the old number is REMOVED rather than left
//   around to be quoted. Re-runnable every month with the new sheet.
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';

const SHEET_PATH = process.argv[2] || '/mnt/c/Users/jasme/Downloads/LISTA DE PRECIOS OCTUBRE.xlsx';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const STOP = new Set(['DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'Y', 'CON', 'PARA', 'THE']);
const fold = (t) => (t.length > 3 && t.endsWith('S') ? t.slice(0, -1) : t);
const norm = (s) => String(s || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
// keep single-digit tokens: "PANEL ACUSTICO TIPO 1..6" is only distinguishable by its number
const sig = (s) => norm(s).split(' ')
  .filter((t) => (t.length > 1 || /^\d$/.test(t)) && !STOP.has(t))
  .map(fold);
const fmtCop = (n) => '$ ' + Math.round(n).toLocaleString('es-CO');

// ── 1. read the sheet ────────────────────────────────────────────────────────
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(SHEET_PATH);
const ws = wb.worksheets[0];
const sections = [];
let current = { name: 'GENERAL', items: [] };
ws.eachRow((row, idx) => {
  if (idx <= 2) return; // title + header
  const desc = String(row.getCell(1).value ?? '').trim();
  const rawB = row.getCell(2).value;
  const price = typeof rawB === 'number' ? rawB
    : (rawB && typeof rawB === 'object' && typeof rawB.result === 'number' ? rawB.result : NaN);
  if (desc && !Number.isFinite(price)) { current = { name: desc, items: [] }; sections.push(current); return; }
  if (!Number.isFinite(price)) return;
  current.items.push({ name: desc || current.name, price: Math.round(price) });
});
const rows = sections.flatMap((s) => s.items.map((i) => ({ ...i, section: s.name, toks: sig(i.name) })));
if (!rows.length) throw new Error('no priced rows parsed — check the sheet layout');

const month = (path.basename(SHEET_PATH).match(/(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)/i) || [, 'ACTUAL'])[1].toUpperCase();
console.log(`sheet: ${path.basename(SHEET_PATH)} · sections=${sections.length} · priced rows=${rows.length} · month=${month}`);

// duplicate row names with different prices = a real ambiguity in the client's sheet
const byName = new Map();
for (const r of rows) {
  const k = r.toks.join(' ');
  if (!byName.has(k)) byName.set(k, []);
  byName.get(k).push(r);
}
const dupes = [...byName.entries()].filter(([, v]) => new Set(v.map((x) => x.price)).size > 1);
if (dupes.length) {
  console.log('\n!! sheet rows sharing a name with DIFFERENT prices (need client confirmation):');
  dupes.forEach(([k, v]) => console.log(`   ${k}: ${v.map((x) => `${x.price} @"${x.section}"`).join('  |  ')}`));
}

// ── 2. publish the snapshot ──────────────────────────────────────────────────
const snapshot = {
  source: path.basename(SHEET_PATH),
  listName: 'LISTA MARKETING (cliente final)',
  month, currency: 'COP', unit: 'Unidad',
  note: 'Valores APROXIMADOS por unidad. Dependen de medidas, cantidades y referencia. Informar SIEMPRE que es un aproximado.',
  sections: sections.map((s) => ({ name: s.name, items: s.items })),
};
fs.writeFileSync(path.join(ROOT, 'public/precios-2026.json'), JSON.stringify(snapshot, null, 2) + '\n');
console.log('wrote public/precios-2026.json');

// ── 3. token-subsequence match ───────────────────────────────────────────────
function inOrder(rowToks, productToks) { // every row token present in the product name, in order
  let i = 0;
  for (const t of productToks) if (t === rowToks[i]) i++;
  return i === rowToks.length;
}

function priceFor(product) {
  const pt = sig(product.name || '');
  if (!pt.length) return null;
  const hits = rows.filter((r) => r.toks.length && inOrder(r.toks, pt));
  if (!hits.length) return null;
  const best = Math.max(...hits.map((h) => h.toks.length));
  const top = hits.filter((h) => h.toks.length === best);
  const prices = [...new Set(top.map((t) => t.price))];
  if (prices.length > 1) return { ambiguous: top.map((t) => `'${t.name}'=${t.price}`).join(' vs ') };
  return { row: top[0] };
}

const catalogs = ['products.json', 'public/products.json'];
const report = { matched: [], unmatched: [], changed: [], ambiguous: [], brokenNames: [] };
for (const rel of catalogs) {
  const p = path.join(ROOT, rel);
  const products = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const prod of products) {
    const oldPrice = prod.price_cop || prod.price;
    const broken = !prod.name || /^nan$/i.test(String(prod.name));
    const res = broken ? null : priceFor(prod);
    if (!res || res.ambiguous) {
      prod.price = 'Consultar precio';
      prod.price_cop = 'Consultar precio';
      prod.price_usd = 'Consultar precio';
      prod.price_source = 'none';
      if (rel === catalogs[0]) {
        if (broken) report.brokenNames.push(prod.id);
        else if (res?.ambiguous) report.ambiguous.push(`${prod.name} ← ${res.ambiguous}`);
        else report.unmatched.push(prod.name);
      }
      continue;
    }
    const val = fmtCop(res.row.price);
    prod.price = val;
    prod.price_cop = val;
    prod.price_usd = 'Consultar precio';
    prod.price_approx = true;
    prod.price_source = `LISTA MARKETING ${month}`;
    prod.unit = 'Unidad';
    if (rel === catalogs[0]) {
      report.matched.push({ product: prod.name, row: res.row.name, section: res.row.section, price: res.row.price, was: oldPrice });
      if (oldPrice !== val) report.changed.push(`${prod.name}: ${oldPrice || '—'} → ${val}`);
    }
  }
  fs.writeFileSync(p, JSON.stringify(products, null, 2) + '\n');
  console.log(`updated ${rel}: ${products.length} products`);
}

console.log(`\nmatched=${report.matched.length} · changed=${report.changed.length} · consultar-precio=${report.unmatched.length} · ambiguous=${report.ambiguous.length} · broken-name=${report.brokenNames.length}`);
console.log('\n-- AMBIGUOUS (no price written; needs client confirmation) --');
report.ambiguous.slice(0, 15).forEach((l) => console.log('  ' + l));
console.log('\n-- price changes (first 30) --');
report.changed.slice(0, 30).forEach((l) => console.log('  ' + l));
console.log('\n-- matched families in use (unique sheet rows) --');
[...new Set(report.matched.map((m) => `${m.row} = ${fmtCop(m.price)}`))].sort().forEach((l) => console.log('  ' + l));
fs.mkdirSync(path.join(ROOT, '.hermes/plans'), { recursive: true });
fs.writeFileSync(path.join(ROOT, '.hermes/plans/price-match-report.json'),
  JSON.stringify({ month, generated: new Date().toISOString(), sheet: path.basename(SHEET_PATH), ...report }, null, 2) + '\n');
console.log('\nfull audit → .hermes/plans/price-match-report.json');
