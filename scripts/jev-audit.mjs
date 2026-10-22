#!/usr/bin/env node
/**
 * scripts/jev-audit.mjs — Jev (TypeSafe System One) error monitor for UniTEC Front Desk.
 *
 * Audits the key public routes, asks Jev's System-1 model ONE parallel pass of three typed
 * questions per failure (is_operational, severity, should_alert) and dispatches a notification
 * through Resend or a webhook when the incident is worth waking someone up for.
 *
 *   node scripts/jev-audit.mjs                     # audit, human-readable
 *   node scripts/jev-audit.mjs --json              # machine-readable (CI artifact)
 *   BASE_URL=https://… node scripts/jev-audit.mjs  # override the target
 *   node scripts/jev-audit.mjs --heuristic         # force the offline classifier
 *
 * Exit codes: 0 = no hard errors, 1 = a required route is broken (CI gate), 2 = bad usage.
 *
 * Jev facts this file depends on (verified live 2026-09-24 against api.typesafe.ai):
 *   POST https://api.typesafe.ai/v1/systemone   Authorization: Bearer $TYPESAFE_API_KEY
 *   model ids: jev-latest (-> jev-1.13.0) | jev-1.13.0 | jev-preview      NOTE: "jev-1" is NOT valid
 *   question primitives: noul (yes/no probability) | choice (1 of N, <=255) | score (2-10 levels)
 *   response: { model, answers: { <id>: { type, noul|choice|score, probabilities, confidence } }, usage }
 *   $0.042 / MTok input, output free — a full audit pass costs well under a cent.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const arg = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
};

const BASE_URL = (arg('base-url', process.env.BASE_URL) || 'https://unitec-front-desk.vercel.app').replace(/\/+$/, '');
const TYPESAFE_API_KEY = process.env.TYPESAFE_API_KEY || '';
const TYPESAFE_MODEL = process.env.TYPESAFE_MODEL || 'jev-latest';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const WEBHOOK_URL = process.env.JEV_WEBHOOK_URL || process.env.WEBHOOK_URL || '';
const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL || '';
const NOTIFICATION_FROM = process.env.NOTIFICATION_FROM || 'Jev Monitor <onboarding@resend.dev>';
const TIMEOUT_MS = Number(process.env.JEV_TIMEOUT_MS || 15000);
const JSON_OUT = flag('json');
const FORCE_HEURISTIC = flag('heuristic') || !TYPESAFE_API_KEY;
const ALWAYS_NOTIFY = flag('notify-always');

/** Public routes worth watching. `required: false` = informational (SPA routes may 404 by design). */
const ROUTES = [
  { path: '/', name: 'homepage', required: true, expect: [200] },
  { path: '/categories', name: 'categories', required: false, expect: [200] },
  { path: '/products', name: 'products', required: false, expect: [200] },
  { path: '/contact', name: 'contact', required: false, expect: [200] },
  { path: '/sitemap.xml', name: 'sitemap.xml', required: false, expect: [200], type: /xml/i },
  { path: '/robots.txt', name: 'robots.txt', required: false, expect: [200], type: /text\/plain/i },
];

/** Body markers that mean "this page served an error", not "nice HTML". */
const ERROR_MARKERS = [
  /Application error/i, /Internal Server Error/i, /404: NOT_FOUND/i, /This Serverless Function has crashed/i,
  /FUNCTION_INVOCATION_(TIMEOUT|FAILED)/i, /DEPLOYMENT_NOT_FOUND/i, /ECONNREFUSED/i, /upstream connect error/i,
];

const SEVERITY_SCALE = ['cosmetic', 'minor', 'degrading', 'major', 'outage'];

// ── probing ────────────────────────────────────────────────────────────────
async function probe(route) {
  const url = `${BASE_URL}${route.path}`;
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'user-agent': 'jev-audit/1.0 (+unitec-front-desk)', accept: '*/*' },
    });
    const body = await res.text().catch(() => '');
    const type = res.headers.get('content-type') || '';
    const marker = ERROR_MARKERS.find((rx) => rx.test(body));
    return {
      ...route, url, status: res.status, ms: Date.now() - started,
      contentType: type, bytes: body.length,
      fingerprint: createHash('sha1').update(body).digest('hex').slice(0, 16),
      expectedStatus: route.expect.includes(res.status),
      expectedType: route.type ? route.type.test(type) : true,
      errorMarker: marker ? String(marker) : null,
      emptyBody: body.trim().length < 40,
      excerpt: body.replace(/\s+/g, ' ').slice(0, 400),
    };
  } catch (err) {
    return {
      ...route, url, status: 0, ms: Date.now() - started, contentType: '', bytes: 0,
      expectedStatus: false, expectedType: false, errorMarker: null, emptyBody: true,
      excerpt: `probe failed: ${err?.name === 'AbortError' ? `timeout after ${TIMEOUT_MS}ms` : String(err)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

const isBroken = (p) => !!p.errorMarker || p.status >= 500 || p.status === 0;
const isUnexpected = (p) => isBroken(p) || !!p.spaShell || !p.expectedStatus || !p.expectedType || p.emptyBody;

/**
 * A SPA catch-all answers 200 for routes that do not exist and serves the app shell — a 404 wearing
 * a 200. Anything whose body is byte-identical to the homepage is flagged so it cannot hide.
 */
function markSpaFallbacks(probes) {
  const shell = probes.find((p) => p.path === '/');
  if (!shell?.fingerprint) return;
  for (const p of probes) {
    if (p.path === '/' || isBroken(p)) continue;
    p.spaShell = p.status === 200 && p.fingerprint === shell.fingerprint;
  }
}

// ── heuristics (offline fallback / pre-classifier) ─────────────────────────
function heuristic(p) {
  if (!isUnexpected(p)) {
    return { is_operational: 0.05, severity: 0, should_alert: 0.05, source: 'heuristic' };
  }
  if (p.spaShell) {
    // The route exists as a URL but not as a page: the app shell answered instead of real content.
    return p.required
      ? { is_operational: 0.05, severity: 3, should_alert: 0.7, source: 'heuristic' }
      : { is_operational: 0.05, severity: 1, should_alert: 0.1, source: 'heuristic' };
  }
  const operational = p.status >= 500 || p.status === 0 || !!p.errorMarker ? 0.95 : 0.3;
  let severity = 0;
  if (p.status === 0) severity = 4;
  else if (p.status >= 500 || p.errorMarker) severity = 3;
  else if (p.emptyBody || !p.expectedType) severity = 2;
  else if (!p.expectedStatus) severity = p.required ? 3 : 1;
  if (p.required && severity > 0) severity = Math.min(4, severity + 1);
  const should_alert = severity >= 3 || (severity >= 2 && p.required) ? 0.9 : 0.15;
  return { is_operational: operational, severity, should_alert, source: 'heuristic' };
}

// ── Jev — one parallel pass, three typed questions ──────────────────────────
const JEV_QUESTIONS = {
  is_operational: {
    type: 'noul',
    instructions: 'Is this an operational or availability problem (server error, timeout, connection reset, crashed function) rather than a content, SEO or bot-behaviour issue?',
  },
  severity: {
    type: 'score',
    instructions: 'How severe is this for users and for the business right now, given how critical this route is?',
    criteria: SEVERITY_SCALE,
  },
  should_alert: {
    type: 'noul',
    instructions: 'Should this wake a human up right now, rather than wait for the next business-hours review?',
  },
};

function stateFor(p) {
  return [
    `Site: UniTEC Front Desk (${BASE_URL})`,
    `Route: ${p.path} (${p.name}) — ${p.required ? 'critical' : 'informational'} route`,
    `HTTP status: ${p.status || 'no response (timeout/connection error)'}`,
    `Latency: ${p.ms} ms`,
    `Content-Type: ${p.contentType || 'n/a'} | body: ${p.bytes} bytes | empty: ${p.emptyBody}`,
    `Expected status: ${p.expect.join('/')} (got ${p.status}) | expected content type: ${p.type ? p.type.source : 'any'}`,
    `Served the SPA app shell instead of a real page: ${p.spaShell ? 'YES — body is byte-identical to the homepage (a 404 wearing a 200)' : 'no'}`,
    `Error marker in body: ${p.errorMarker || 'none'}`,
    `Body excerpt: ${p.excerpt.slice(0, 300)}`,
  ].join('\n');
}

async function classifyWithJev(p) {
  const res = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: { authorization: `Bearer ${TYPESAFE_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: TYPESAFE_MODEL, state: stateFor(p), questions: JEV_QUESTIONS }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Jev HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const a = data.answers || {};
  const score = a.severity?.score ?? 0;
  return {
    is_operational: a.is_operational?.noul ?? null,
    severity: Number.isFinite(score) ? Math.round(score) : 0,
    severity_raw: Number.isFinite(score) ? score : null,
    severity_label: SEVERITY_SCALE[Math.min(4, Math.max(0, Math.round(score ?? 0)))],
    confidence: a.severity?.confidence ?? null,
    should_alert: a.should_alert?.noul ?? null,
    model: data.model || TYPESAFE_MODEL,
    input_tokens: data.usage?.input_tokens ?? null,
    source: 'jev',
  };
}

// ── notification ───────────────────────────────────────────────────────────
function alertBody(report) {
  const rows = report.incidents.map(
    (i) => `<li><b>${i.path}</b> — HTTP ${i.status || 'no response'} in ${i.ms} ms · ${i.verdict.severity_label} · operational ${fmt(i.verdict.is_operational)} · alert ${fmt(i.verdict.should_alert)}<br><code>${i.excerpt.slice(0, 200)}</code></li>`,
  ).join('');
  return {
    subject: `[Jev] ${report.incidents.length} incident(s) on ${report.base_url}`,
    html: `<h2>Jev audit — ${report.base_url}</h2>
<p>${report.checked} routes checked · ${report.errors} broken · ${report.missing} unexpected (informational)</p>
<ul>${rows}</ul>
<p>model: ${report.model} · ${report.duration_ms} ms · ${new Date(report.finished_at).toUTCString()}</p>`,
  };
}

const fmt = (v) => (v === null || v === undefined ? 'n/a' : Number(v).toFixed(2));

async function notify(report) {
  const { subject, html } = alertBody(report);
  const results = [];
  if (RESEND_API_KEY && NOTIFICATION_EMAIL) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: NOTIFICATION_FROM, to: [NOTIFICATION_EMAIL], subject, html }),
        signal: AbortSignal.timeout(15000),
      });
      const body = await res.text().catch(() => '');
      results.push({ channel: 'resend', ok: res.ok, status: res.status, detail: body.slice(0, 200) });
    } catch (err) {
      results.push({ channel: 'resend', ok: false, status: 0, detail: String(err) });
    }
  }
  if (WEBHOOK_URL) {
    try {
      const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ source: 'jev-audit', subject, report }),
        signal: AbortSignal.timeout(15000),
      });
      results.push({ channel: 'webhook', ok: res.ok, status: res.status, detail: '' });
    } catch (err) {
      results.push({ channel: 'webhook', ok: false, status: 0, detail: String(err) });
    }
  }
  if (!results.length) results.push({ channel: 'none', ok: false, status: 0, detail: 'no RESEND_API_KEY/NOTIFICATION_EMAIL and no webhook configured' });
  return results;
}

// ── main ───────────────────────────────────────────────────────────────────
async function main() {
  const started = Date.now();
  const probes = [];
  for (const route of ROUTES) probes.push(await probe(route));
  markSpaFallbacks(probes);

  const failures = probes.filter(isUnexpected);
  const incidents = [];
  const classifierNotes = [];

  for (const p of failures) {
    let verdict = heuristic(p);
    if (!FORCE_HEURISTIC) {
      try {
        verdict = await classifyWithJev(p);
      } catch (err) {
        classifierNotes.push(`Jev unavailable for ${p.path} (${String(err).slice(0, 120)}) — used heuristics`);
        verdict = { ...heuristic(p), source: 'heuristic-after-jev-error' };
      }
    }
    incidents.push({ ...p, verdict });
  }

  const report = {
    base_url: BASE_URL,
    started_at: new Date(started).toISOString(),
    finished_at: new Date().toISOString(),
    duration_ms: Date.now() - started,
    model: FORCE_HEURISTIC ? 'heuristic (no TYPESAFE_API_KEY)' : (incidents[0]?.verdict?.model || TYPESAFE_MODEL),
    checked: probes.length,
    errors: incidents.filter((i) => isBroken(i)).length,
    missing: failures.filter((p) => !isBroken(p)).length,
    alerts_triggered: 0,
    routes: probes,
    incidents,
    classifier_notes: classifierNotes,
    notifications: [],
  };

  const shouldNotify = incidents.some((i) => (i.verdict.should_alert ?? 0) >= 0.5) || ALWAYS_NOTIFY;
  if (shouldNotify && incidents.length) {
    report.notifications = await notify(report);
    report.alerts_triggered = report.notifications.filter((n) => n.ok).length;
  }

  if (JSON_OUT) {
    const out = arg('out', '');
    if (out) {
      const file = resolve(out);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify(report, null, 2));
    }
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    console.log(`\nJev audit · ${report.base_url}`);
    console.log(`classifier: ${report.model}${FORCE_HEURISTIC ? '  (heuristic mode — export TYPESAFE_API_KEY to use Jev)' : ''}\n`);
    for (const p of probes) {
      const mark = isBroken(p) ? 'BROKEN' : p.spaShell ? 'shell ' : isUnexpected(p) ? 'note  ' : 'ok    ';
      console.log(`  ${mark} ${String(p.status || '---').padEnd(4)} ${String(p.ms + 'ms').padEnd(8)} ${p.path}`);
    }
    if (incidents.length) {
      console.log('\nincidents:');
      for (const i of incidents) {
        console.log(`  ${i.path} → operational ${fmt(i.verdict.is_operational)} · severity ${i.verdict.severity_label} (${fmt(i.verdict.severity_raw)}) · alert ${fmt(i.verdict.should_alert)} [${i.verdict.source}]`);
      }
    }
    if (classifierNotes.length) console.log(`\nnotes: ${classifierNotes.join('; ')}`);
    if (shouldNotify && incidents.length) console.log(`notified: ${JSON.stringify(report.notifications)}`);
    console.log(`\n${report.checked} routes · ${report.errors} broken · ${report.missing} unexpected · ${report.duration_ms} ms\n`);
  }

  process.exit(report.errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`jev-audit failed: ${err?.stack || err}`);
  process.exit(2);
});
