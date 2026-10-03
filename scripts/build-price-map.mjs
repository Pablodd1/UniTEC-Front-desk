// scripts/build-price-map.mjs
// Builds a minimal build-time price lookup map from the October sheet
// Outputs: public/price-map.json  (id → { price_cop, price_usd, unit, approx: true })
//          public/price-catalog.json (for client-side catalog display if needed)
//
// Run: node scripts/build-price-map.mjs "/mnt/c/Users/jasme/Downloads/LISTA DE PRECIOS OCTUBRE.xlsx"
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';

const SHEET_PATH = process.argv[2] || '/mnt/c/Users/jasme/Downloads/LISTA DE PRECIOS OCTUBRE.xlsx';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const STOP = new Set(['DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'Y', 'CON', 'PARA', 'TIPO', 'THE']);
const fold = (t) => (t.length > 3 && t.endsWith('S') ? t.slice(0, -1) : t);
const norm = (s) => String(s || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
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
  if (idx <= 2) return;
  const desc = String(row.getCell(1).value ?? '').trim();
  const rawB = row.getCell(2).value;
  const price = typeof rawB === 'number' ? rawB
    : (rawB && typeof rawB === 'object' && typeof rawB.result === 'number' ? rawB.result : NaN);
  if (desc && !Number.isFinite(price)) { current = { name: desc, items: [] }; sections.push(current); return; }
  if (!Number.isFinite(price)) return;
  current.items.push({ name: desc || current.name, price: Math.round(price) });
});
const rows = sections.flatMap((s) => s.items.map((i) => ({ ...i, section: s.name, toks: sig(i.name) })));
if (!rows.length) throw new Error('no priced rows parsed');

// ── 2. read existing products.json for exact ID matching ─────────────────────
const productsPath = path.join(ROOT, 'products.json');
const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));

// Build a token map from products for matching
function inOrder(rowToks, productToks) {
  let i = 0;
  for (const t of productToks) if (t === rowToks[i]) i++;
  return i === rowToks.length;
}

const priceMap = {};
const unmatchedProducts = [];
const matchedRows = new Set();

for (const prod of products) {
  const pt = sig(prod.name || '');
  if (!pt.length) { unmatchedProducts.push(prod.id); continue; }
  const hits = rows.filter((r) => r.toks.length && inOrder(r.toks, pt));
  if (!hits.length) { unmatchedProducts.push(prod.id); continue; }
  const best = Math.max(...hits.map((h) => h.toks.length));
  const top = hits.filter((h) => h.toks.length === best);
  const prices = [...new Set(top.map((t) => t.price))];
  if (prices.length > 1) { unmatchedProducts.push(prod.id); continue; }
  const row = top[0];
  priceMap[prod.id] = {
    price_cop: fmtCop(row.price),
    price_usd: prod.price_usd || 'Consultar precio',
    unit: 'Unidad',
    approx: true,
    source: `LISTA MARKETING ${row.section}`,
    row_name: row.name,
    row_price: row.price
  };
  matchedRows.add(row.name);
}

// ── 3. write outputs ─────────────────────────────────────────────────────────
fs.writeFileSync(path.join(ROOT, 'public/price-map.json'), JSON.stringify(priceMap, null, 2) + '\n');
console.log(`price-map.json: ${Object.keys(priceMap).length} products mapped`);

const catalog = {};
for (const prod of products) {
  if (priceMap[prod.id]) {
    catalog[prod.id] = { ...priceMap[prod.id], name: prod.name, category: prod.category, subcategory: prod.subcategory };
  }
}
fs.writeFileSync(path.join(ROOT, 'public/price-catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
console.log(`price-catalog.json: ${Object.keys(catalog).length} entries`);

console.log(`\nUnmatched product IDs (${unmatchedProducts.length}):`);
unmatchedProducts.slice(0, 20).forEach((id) => console.log('  ', id));

const unmatchedRows = rows.filter((r) => !matchedRows.has(r.name));
console.log(`\nSheet rows not used (${unmatchedRows.length}):`);
unmatchedRows.slice(0, 15).forEach((r) => console.log('  ', r.name, '→', fmtCop(r.price), `(${r.section})`));