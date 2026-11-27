// GET /api/brand-audit — daily guard that the panel tells the truth per company.
//
// Why: the dashboard is shared by UNITEC USA and BUILDING INNOVATION. A regression in brand
// tagging, counters or prompts is invisible until a customer sees the wrong warehouse or price.
// This route reads the SAME endpoints the panel reads, asserts the invariants, and alerts the
// team on Telegram when one breaks. Read-only: it never writes sessions or escalations.
//
// Cron: 0 10 * * * (05:00 Bogotá). Manual: GET /api/brand-audit?days=7&dry=1
//
// Invariants
//   1. every session is tagged unitec|building (untagged rows render under UNITEC)
//   2. analytics kpis.total == byBrand sum, and per-brand counts match /api/sessions
//   3. no company's last message contains the other company's facts
//   4. BUILDING INNOVATION never states a dollar amount (no USD price list exists yet)
//   5. every escalation is attributable to a brand and agrees with its session

import { brandPack } from './brand-packs.js';

const LEAK = {
  building: [
    [/guarne/i, 'Guarne (UNITEC warehouse)'],
    [/medell[ií]n/i, 'Medellín'],
    [/centro comercial ideo/i, 'CC Ideo'],
    [/transferencia electr[oó]nica/i, 'UNITEC payment wording'],
    [/canva\.link/i, 'UNITEC catalog link'],
  ],
  unitec: [
    [/doral/i, 'Doral showroom'],
    [/square feet|sq\.? ?ft/i, 'imperial area'],
    [/building innovation/i, 'the other company'],
  ],
};

const USD_AMOUNT = /\$\s?\d[\d.,]*/;
const COP_AMOUNT = /\$\s?\d{1,3}(?:[.,]\d{3})+\s*(COP|pesos)?/i;

const bogotaDay = (d) => d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN || '';
  const chat = process.env.TELEGRAM_CHAT_ID || '';
  if (!token || !chat) return { sent: false, why: 'telegram_env_missing' };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(8000),
    });
    return { sent: r.ok, status: r.status };
  } catch (e) {
    return { sent: false, why: String(e?.message || e) };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const days = Math.min(Math.max(parseInt(String(req.query?.days || '7'), 10) || 7, 1), 60);
  const dry = String(req.query?.dry || '') === '1';
  const selftest = String(req.query?.selftest || '') === '1';
  const proto = String(req.headers['x-forwarded-proto'] || 'https');
  const host = req.headers.host;
  const base = `${proto}://${host}`;
  const from = bogotaDay(new Date(Date.now() - (days - 1) * 86400000));
  const to = bogotaDay(new Date());

  // Proves the alert rail itself (credentials + delivery) without faking a failure.
  if (selftest) {
    const sent = await sendTelegram(`✅ SELF-TEST — brand audit alert rail OK.\n${base}\nNo failure was detected; this is a delivery check.`);
    return res.status(200).json({ ok: true, selftest: true, telegram: sent, generatedAt: new Date().toISOString() });
  }

  const fails = [];
  const warns = [];
  const get = async (path) => {
    const r = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}`);
    return r.json();
  };

  try {
    // 1. sessions
    const s = await get(`/api/sessions?from=${from}&to=${to}&limit=2000`);
    const rows = Array.isArray(s.sessions) ? s.sessions : [];
    const count = { unitec: 0, building: 0, untagged: 0 };
    for (const r of rows) {
      if (r.brandId === 'building') count.building++;
      else if (r.brandId === 'unitec') count.unitec++;
      else count.untagged++;
    }
    if (!rows.length) warns.push('no sessions in range (panel would look empty)');
    if (count.untagged) fails.push(`${count.untagged} untagged sessions would render under UNITEC`);

    for (const r of rows) {
      const brand = r.brandId === 'building' ? 'building' : 'unitec';
      const msg = String(r.lastMessage || '');
      if (!msg.trim()) { warns.push(`session ${r.id} has no lastMessage`); continue; }
      for (const [re, label] of LEAK[brand]) {
        if (re.test(msg)) fails.push(`${brand} session ${r.id} leaks ${label}: "${msg.slice(0, 80)}"`);
      }
      if (brand === 'building') {
        const withoutRate = msg.replace(/COP\s*(?:→|\/|-)\s*USD/gi, '');
        if (/\bCOP\b|pesos colombianos/i.test(withoutRate)) {
          fails.push(`building session ${r.id} mentions COP outside a conversion`);
        }
        if (USD_AMOUNT.test(msg) && !/convert|USD|approx/i.test(msg)) {
          fails.push(`building session ${r.id} quotes an amount with no stated basis`);
        }
        if (COP_AMOUNT.test(withoutRate)) {
          fails.push(`building session ${r.id} shows a COP-style amount`);
        }
      }
      if (!r.lastUpdated) warns.push(`session ${r.id} has no lastUpdated`);
    }

    // 2. panel counters
    const a = await get(`/api/analytics?from=${from}&to=${to}`);
    const total = Number(a?.kpis?.total || 0);
    const ab = a?.byBrand || {};
    const sum = Number(ab.unitec || 0) + Number(ab.building || 0);
    if (total !== sum) fails.push(`panel counters disagree: total ${total} vs byBrand sum ${sum}`);
    if (Number(ab.unitec || 0) !== count.unitec) fails.push(`unitec mismatch: analytics ${ab.unitec || 0} vs sessions ${count.unitec}`);
    if (Number(ab.building || 0) !== count.building) fails.push(`building mismatch: analytics ${ab.building || 0} vs sessions ${count.building}`);

    // 3. escalations
    const e = await get('/api/escalations?limit=100');
    const esc = Array.isArray(e.escalations) ? e.escalations : [];
    const owner = new Map(rows.map((r) => [r.id, r.brandId === 'building' ? 'building' : 'unitec']));
    let unbranded = 0;
    for (const r of esc) {
      if (!r.brand) unbranded++;
      const ob = owner.get(r.sessionId);
      if (r.brand && ob && r.brand !== ob) fails.push(`alert ${r.id} brand ${r.brand} but its session is ${ob}`);
    }
    if (unbranded) warns.push(`${unbranded} alerts have no brand field`);

    // 4. catalog reality: BI cannot quote while no SKU has a USD price
    let usd = 0; let skus = 0;
    try {
      const prod = await (await fetch(`${base}/products.json`, { signal: AbortSignal.timeout(12000) })).json();
      skus = Array.isArray(prod) ? prod.length : 0;
      usd = (prod || []).filter((p) => /^\s*\$?\s*\d/.test(String(p.price_usd || ''))).length;
      if (skus && !usd) warns.push('no SKU has a stored USD price — BI converts from the COP list at the /api/fx rate');
    } catch { warns.push('products.json unavailable'); }

    const summary = `${fails.length} failure(s), ${warns.length} warning(s) · ${days}d · unitec ${count.unitec} / building ${count.building} · ${skus} SKUs, ${usd} with USD`;
    let alert = { sent: false, why: 'no_failures' };
    if (fails.length && !dry) {
      alert = await sendTelegram(
        `🚨 BRAND AUDIT FAILED — ${brandPack('building').name} / ${brandPack('unitec').name}\n` +
        `${fails.length} problem(s) in the last ${days} days:\n` +
        fails.slice(0, 6).map((f) => `• ${f}`).join('\n') +
        `\n\nPanel: ${base}/?admin=true`
      );
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(fails.length ? 500 : 200).json({
      ok: !fails.length,
      range: { from, to, days },
      counts: count,
      alerts: esc.length,
      catalog: { skus, withUsdPrice: usd },
      failures: fails,
      warnings: warns,
      summary,
      telegram: alert,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[brand-audit] failed:', err?.message || err);
    return res.status(500).json({ ok: false, error: 'audit_failed', detail: String(err?.message || err) });
  }
}
