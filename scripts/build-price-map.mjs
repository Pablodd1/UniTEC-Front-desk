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

// ── 1. read the sheet (auto-detect layout: NUEVO = CODIGO|DESCRIPCION|PRECIO) ──
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(SHEET_PATH);
const ws = wb.worksheets[0];
const num = (v) => {
  const n = typeof v === 'number' ? v : (v && typeof v === 'object' && typeof v.result === 'number' ? v.result : NaN);
  return Number.isFinite(n) ? n : NaN;
};
let layout = 'old';
{
  let c2n = 0, c3n = 0, seen = 0;
  ws.eachRow((row, idx) => {
    if (idx <= 3 || seen >= 15) return;
    if (Number.isFinite(num(row.getCell(2).value))) c2n++;
    if (Number.isFinite(num(row.getCell(3).value))) c3n++;
    seen++;
  });
  layout = c3n > c2n ? 'new' : 'old';
}
const sections = [];
let current = { name: 'GENERAL', items: [] };
ws.eachRow((row, idx) => {
  if (idx <= 2) return;
  const c1 = String(row.getCell(1).value ?? '').trim();
  const c2 = String(row.getCell(2).value ?? '').trim();
  if (layout === 'old') {
    const price = num(row.getCell(2).value);
    if (c1 && !Number.isFinite(price)) { current = { name: c1, items: [] }; sections.push(current); return; }
    if (!Number.isFinite(price)) return;
    current.items.push({ name: c1 || current.name, price: Math.round(price) });
    return;
  }
  if (c1 === 'CODIGO' && c2.toUpperCase().startsWith('DESCRIPC')) return;
  const price = num(row.getCell(3).value);
  if (!Number.isFinite(price)) {
    const sec = c1 || c2;
    if (sec) { current = { name: sec, items: [] }; sections.push(current); return; }
    return;
  }
  if (!c1 && !c2) return;
  current.items.push({ code: c1, name: c2 || current.name, price: Math.round(price) });
});
const rows = sections.flatMap((s) => s.items.map((i) => ({ ...i, section: s.name, toks: sig(i.name) })));
if (!rows.length) throw new Error('no priced rows parsed');
console.log(`layout: ${layout} · sections=${sections.length} · priced rows=${rows.length} · con codigo=${rows.filter((r) => r.code).length}`);

// índice por código: la hoja oct 2026 trae CODIGO == id del catálogo → matching EXACTO
const byCode = new Map();
for (const r of rows) {
  if (!r.code) continue;
  if (!byCode.has(r.code)) byCode.set(r.code, []);
  byCode.get(r.code).push(r);
}

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
const ambiguousIds = [];
const matchedRows = new Set();

for (const prod of products) {
  let row = null;
  const codeHits = byCode.get(String(prod.id || '')) || [];
  if (codeHits.length) {
    const prices = [...new Set(codeHits.map((r) => r.price))];
    if (prices.length > 1) { ambiguousIds.push(`${prod.id} (${prod.name}): ${codeHits.map((r) => `${r.price}@"${r.name}"`).join(' vs ')}`); continue; }
    row = codeHits[0];
  } else {
    const pt = sig(prod.name || '');
    if (!pt.length) { unmatchedProducts.push(prod.id); continue; }
    const hits = rows.filter((r) => r.toks.length && inOrder(r.toks, pt));
    if (!hits.length) { unmatchedProducts.push(prod.id); continue; }
    const best = Math.max(...hits.map((h) => h.toks.length));
    const top = hits.filter((h) => h.toks.length === best);
    const prices = [...new Set(top.map((t) => t.price))];
    if (prices.length > 1) { unmatchedProducts.push(prod.id); continue; }
    row = top[0];
  }
  priceMap[prod.id] = {
    price_cop: fmtCop(row.price),
    price_usd: prod.price_usd || 'Consultar precio',
    // was hardcoded 'Unidad': products.json is the curated catalog and carries the real
    // selling unit (Paquete / Package, Caja / Box, m2). Hardcoding it made every one of the
    // 303 mapped answers say "por Unidad" regardless of how the product actually sells.
    unit: prod.unit || 'Unidad',
    approx: true,
    source: `LISTA MARKETING ${row.section}`,
    row_name: row.name,
    row_price: row.price
  };
  matchedRows.add(row.name);
}

// ── 2b. curated pins — an explicit ref always beats a fuzzy sheet match ───────
// A generic sheet row like "CORNISA PVC" is an in-order token subset of every
// "CORNISA PVC <colour> AM10xx" product name, so the matcher above binds them all to
// one price. Anything pinned in scripts/price-overrides.json wins, and a pin also
// CREATES the entry when the sheet has no matching row at all.
const overridesPath = path.join(ROOT, 'scripts/price-overrides.json');
if (fs.existsSync(overridesPath)) {
  const ov = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
  let pinned = 0;
  for (const [ref, o] of Object.entries(ov.overrides || {})) {
    const price = Number(o.price_cop);
    if (!Number.isFinite(price)) { console.warn(`  override ${ref} skipped: price_cop not a number`); continue; }
    const prod = products.find((p) => String(p.id) === ref);
    if (!prod) { console.warn(`  override ${ref} skipped: ref not in products.json`); continue; }
    priceMap[ref] = {
      price_cop: fmtCop(price),
      price_usd: prod.price_usd || 'Consultar precio',
      unit: o.unit || prod.unit || 'Unidad',
      approx: true,
      source: o.source || 'OVERRIDE',
      row_name: o.note || prod.name,
      row_price: price,
      overridden: true,
    };
    pinned++;
  }
  console.log(`price-overrides.json: ${pinned} refs pinned`);
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

console.log(`\nAMBIGUOUS por codigo duplicado con precios distintos (${ambiguousIds.length}) — confirmar con el cliente:`);
ambiguousIds.forEach((l) => console.log('  ', l));

const unmatchedRows = rows.filter((r) => !matchedRows.has(r.name));
console.log(`\nSheet rows not used (${unmatchedRows.length}):`);
unmatchedRows.slice(0, 15).forEach((r) => console.log('  ', r.name, '→', fmtCop(r.price), `(${r.section})`));