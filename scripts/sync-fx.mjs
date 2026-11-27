#!/usr/bin/env node
/**
 * Writes api/fx-default.json — the rate a cold serverless instance uses when Firestore has not
 * answered yet. Run before a deploy (or on a schedule) so a cold start never has to wait on the
 * network to price a product. The rate carries its date, which the bot quotes.
 */
import { writeFileSync } from 'node:fs';

const res = await fetch('https://open.er-api.com/v6/latest/USD');
if (!res.ok) throw new Error(`fx ${res.status}`);
const d = await res.json();
const rate = Number(d?.rates?.COP);
if (!Number.isFinite(rate) || rate < 1000 || rate > 10000) throw new Error(`implausible rate ${rate}`);
const payload = {
  rate,
  at: new Date().toISOString(),
  source: `open.er-api.com (${d?.time_last_update_utc || ''})`.trim(),
};
writeFileSync(new URL('../api/fx-default.json', import.meta.url), JSON.stringify(payload, null, 2) + '\n');
console.log('fx-default:', payload);
