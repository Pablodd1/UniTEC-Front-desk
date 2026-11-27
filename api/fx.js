// GET /api/fx — USD/COP rate used to price Building Innovation in dollars.
//
// Why: Building Innovation sells the SAME list as UNITEC, whose prices are stored in COP.
// The Miami customer must see USD, and the number must be current and reproducible, not
// invented by the model. The rate lives in Firestore (config/main.fxRate) so every serverless
// instance agrees; it is refreshed at most every 12 h from an independent public source, and a
// stale rate is still returned (flagged) rather than blocking a quote.
//
// Response: { ok, rate, at, source, ageHours, stale }

import { getDoc, setDoc } from './_firestore-rest.js';

const SOURCE = 'open.er-api.com';
const TTL_HOURS = 12;
const MIN_RATE = 1000;   // sanity window for COP/USD; outside => treat the feed as broken
const MAX_RATE = 10000;
const MEM_TTL_MS = 10 * 60 * 1000;

let mem = { rate: null, at: '', source: '', fetchedAt: 0 };

const hoursSince = (iso) => {
  const t = Date.parse(iso || '');
  return Number.isFinite(t) ? (Date.now() - t) / 3600000 : Infinity;
};

async function fetchRate() {
  const r = await fetch(`https://${SOURCE}/v6/latest/USD`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`fx_http_${r.status}`);
  const d = await r.json();
  const rate = Number(d?.rates?.COP);
  if (!Number.isFinite(rate) || rate < MIN_RATE || rate > MAX_RATE) {
    throw new Error(`fx_implausible:${rate}`);
  }
  return { rate, at: new Date().toISOString(), source: `${SOURCE} (${d?.time_last_update_utc || ''})`.trim() };
}

/** Rate for quoting. Always resolves; returns null only if nothing is known at all. */
export async function getFxRate({ force = false } = {}) {
  if (!force && mem.rate && Date.now() - mem.fetchedAt < MEM_TTL_MS) return mem;

  let stored = null;
  try {
    const d = await getDoc('config/main');
    const f = d?.fields || {};
    const rate = Number(f.fxRate?.doubleValue ?? f.fxRate?.integerValue ?? 0) || null;
    stored = rate
      ? { rate, at: String(f.fxAt?.stringValue || ''), source: String(f.fxSource?.stringValue || '') }
      : null;
  } catch (e) {
    // Firestore unreachable: fall through to the public feed.
  }

  const fresh = stored && hoursSince(stored.at) < TTL_HOURS;
  if (fresh && !force) {
    mem = { ...stored, fetchedAt: Date.now() };
    return mem;
  }

  try {
    const live = await fetchRate();
    mem = { ...live, fetchedAt: Date.now() };
    setDoc('config/main', {
      fxRate: { doubleValue: live.rate },
      fxAt: { stringValue: live.at },
      fxSource: { stringValue: live.source },
    }, ['fxRate', 'fxAt', 'fxSource']).catch((e) => console.warn('[fx] persist failed:', e?.message));
    return mem;
  } catch (e) {
    console.warn('[fx] refresh failed:', e?.message || e);
    if (stored) {
      mem = { ...stored, fetchedAt: Date.now() };
      return mem;
    }
    return { rate: null, at: '', source: '', fetchedAt: Date.now() };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  const fx = await getFxRate({ force: String(req.query?.force || '') === '1' });
  const ageHours = fx.at ? Math.round(hoursSince(fx.at) * 10) / 10 : null;
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    ok: Boolean(fx.rate),
    rate: fx.rate,
    currency: 'COP per USD',
    at: fx.at || null,
    source: fx.source || null,
    ageHours,
    stale: fx.rate ? ageHours > TTL_HOURS : true,
  });
}
