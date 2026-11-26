#!/usr/bin/env node
/**
 * audit-brand-data.mjs — "is the panel telling the truth, per company?"
 *
 * Read-only audit against the LIVE deployment. It checks the same endpoints the panel reads
 * (/api/sessions, /api/analytics, /api/escalations) and asserts:
 *
 *   1. every session is tagged unitec|building (an untagged row would show under UNITEC and
 *      silently pollute the Colombian panel),
 *   2. the panel's own counters agree: sum(byBrand) == total, and per-brand session counts from
 *      /api/sessions match /api/analytics for the same range,
 *   3. no company's last message contains the other company's facts (Guarne / Medellín /
 *      transferencia / Canva for BI; Doral / sq ft / USD-only for UNITEC),
 *   4. BUILDING INNOVATION never states a dollar amount while the USD price list is missing,
 *   5. every escalation is attributable to a brand and agrees with its session's brand.
 *
 * Usage:
 *   node scripts/audit-brand-data.mjs                # last 7 days
 *   BASE=http://localhost:4173 node scripts/... --days 30
 */
const BASE = process.env.BASE || 'https://unitec-front-desk.vercel.app';
const daysArg = Number(process.argv[process.argv.indexOf('--days') + 1] || 7);
const DAYS = Number.isFinite(daysArg) && daysArg > 0 ? daysArg : 7;

const bogota = (d) => d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
const from = bogota(new Date(Date.now() - (DAYS - 1) * 86400000));
const to = bogota(new Date());

const fails = [];
const warns = [];
const fail = (m) => fails.push(m);
const warn = (m) => warns.push(m);
const get = async (path) => {
  const r = await fetch(`${BASE}${path}`, { headers: { 'cache-control': 'no-cache' } });
  if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}`);
  return r.json();
};

// Content rules: things one company must never say about the other.
const LEAK = {
  building: [
    [/guarne/i, 'Guarne (UNITEC warehouse)'],
    [/medell[ií]n/i, 'Medellín'],
    [/centro comercial ideo/i, 'CC Ideo'],
    [/transferencia electr[oó]nica/i, 'UNITEC payment wording'],
    [/canva\.link/i, 'UNITEC catalog link'],
    [/\bCOP\b|pesos colombianos/i, 'COP mentioned'],
  ],
  unitec: [
    [/doral/i, 'Doral showroom'],
    [/square feet|sq\.? ?ft/i, 'imperial area'],
    [/building innovation/i, 'the other company'],
  ],
};
const USD_AMOUNT = /\$\s?\d[\d.,]*/;
const COP_AMOUNT = /\$\s?\d{1,3}(?:[.,]\d{3})+\s*(COP|pesos)?/i;

(async () => {
  console.log(`\nBrand data audit — ${BASE}\nrange ${from} .. ${to} (Bogotá days)\n`);

  // ── 1. sessions ────────────────────────────────────────────────────────────
  const s = await get(`/api/sessions?from=${from}&to=${to}&limit=2000`);
  const rows = Array.isArray(s.sessions) ? s.sessions : [];
  const byBrand = { unitec: 0, building: 0, untagged: 0 };
  for (const r of rows) {
    if (r.brandId === 'building') byBrand.building++;
    else if (r.brandId === 'unitec') byBrand.unitec++;
    else byBrand.untagged++;
  }
  console.log(`sessions: ${rows.length}  (unitec ${byBrand.unitec} · building ${byBrand.building} · untagged ${byBrand.untagged})`);
  if (!rows.length) fail('no sessions returned for the range — the panel would look empty');
  if (byBrand.untagged) fail(`${byBrand.untagged} untagged sessions would render under UNITEC`);

  for (const r of rows) {
    const brand = r.brandId === 'building' ? 'building' : 'unitec';
    const msg = String(r.lastMessage || '');
    for (const [re, label] of LEAK[brand]) {
      if (re.test(msg)) fail(`${brand} session ${r.id} last message leaks ${label}: "${msg.slice(0, 90)}"`);
    }
    if (brand === 'building' && USD_AMOUNT.test(msg)) {
      const m = msg.match(USD_AMOUNT)[0];
      fail(`building session ${r.id} quotes an amount (${m}) with no USD price list: "${msg.slice(0, 90)}"`);
    }
    if (brand === 'building' && COP_AMOUNT.test(msg)) {
      fail(`building session ${r.id} shows a COP-style amount: "${msg.slice(0, 90)}"`);
    }
    if (!r.lastMessage) warn(`session ${r.id} (${brand}) has no lastMessage — blank row in the monitor`);
    if (!r.lastUpdated) warn(`session ${r.id} (${brand}) has no lastUpdated — cannot sort by recency`);
  }

  // ── 2. panel counters ──────────────────────────────────────────────────────
  const a = await get(`/api/analytics?from=${from}&to=${to}`);
  const k = a.kpis || {};
  const ab = a.byBrand || {};
  console.log(`analytics: total ${k.total} · byBrand ${JSON.stringify(ab)}`);
  const sumBrands = Number(ab.unitec || 0) + Number(ab.building || 0);
  if (Number(k.total || 0) !== sumBrands) {
    fail(`panel counters disagree: kpis.total=${k.total} but byBrand sums to ${sumBrands}`);
  }
  if (Number(ab.unitec || 0) !== byBrand.unitec) {
    fail(`unitec count differs between endpoints: analytics ${ab.unitec} vs sessions ${byBrand.unitec}`);
  }
  if (Number(ab.building || 0) !== byBrand.building) {
    fail(`building count differs between endpoints: analytics ${ab.building} vs sessions ${byBrand.building}`);
  }

  // ── 3. alerts ──────────────────────────────────────────────────────────────
  const e = await get('/api/escalations?limit=100');
  const esc = Array.isArray(e.escalations) ? e.escalations : [];
  const sessionBrand = new Map(rows.map((r) => [r.id, r.brandId === 'building' ? 'building' : 'unitec']));
  let untagged = 0;
  for (const r of esc) {
    if (!r.brand) untagged++;
    const owner = sessionBrand.get(r.sessionId);
    if (r.brand && owner && r.brand !== owner) {
      fail(`alert ${r.id} claims brand ${r.brand} but its session ${r.sessionId} is ${owner}`);
    }
  }
  console.log(`alerts: ${esc.length} (without brand field: ${untagged})`);
  if (untagged) warn(`${untagged} alerts have no brand field — they fall back to their session, verify the session is in range`);

  // ── 4. source upload sanity ────────────────────────────────────────────────
  const prod = await (await fetch(`${BASE}/products.json`)).json();
  const usd = prod.filter((p) => /^\s*\$?\s*\d/.test(String(p.price_usd || ''))).length;
  const specs = prod.filter((p) => String(p.catalog_specs || '').trim()).length;
  console.log(`catalog: ${prod.length} SKUs · ${specs} with specs · ${usd} with a USD price`);
  if (!usd) warn('no SKU has a USD price: every Building Innovation quote must end in "price on request"');

  // ── report ─────────────────────────────────────────────────────────────────
  if (warns.length) { console.log('\nWARNINGS'); warns.forEach((w) => console.log('  ~ ' + w)); }
  if (fails.length) {
    console.log('\nFAILURES'); fails.forEach((f) => console.log('  ✗ ' + f));
    console.log(`\n${fails.length} failure(s). The panel would show wrong company data.`);
    process.exit(1);
  }
  console.log('\nPASS — every session, alert and counter is attributable to one company, and no company leaks the other.');
})().catch((err) => { console.error('audit error:', err.message); process.exit(2); });
