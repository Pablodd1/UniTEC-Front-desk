#!/usr/bin/env node
/**
 * scripts/mark-legacy-dispositions.mjs — one-time migration for mandatory disposition.
 *
 * Marks OLD completed urgent conversations as `dispositionStatus: "legacy"` so they are excluded
 * from conversion metrics WITHOUT being deleted or backfilled (client rule).
 *
 * "Old urgent" = terminal (completed / resolved) AND escalated as a human transfer
 * (escalationType === 'staff', or an SLA re-alert fired => slaStage present) AND no disposition
 * was ever recorded (no `disposition`, no `dispositionStatus`).
 *
 * Idempotent: re-running skips anything that already has a dispositionStatus.
 *
 * SAFETY: default is DRY-RUN (read-only). Pass --apply to actually write. Do NOT run --apply
 * against production Firestore without an explicit decision — say so in the report.
 *
 * Usage:
 *   node scripts/mark-legacy-dispositions.mjs            # dry-run: prints what WOULD change
 *   node scripts/mark-legacy-dispositions.mjs --apply    # writes dispositionStatus=legacy
 */

import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const firebaseConfig = require_('../firebase-applet-config.json');

const PROJECT = firebaseConfig.projectId;
const API_KEY = firebaseConfig.apiKey;
const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const APPLY = process.argv.includes('--apply');

async function auth() {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  if (!res.ok) throw new Error(`auth failed: ${res.status}`);
  const { idToken } = await res.json();
  return idToken;
}

const str = (v) => (v && typeof v === 'object' ? String(v.stringValue ?? '') : '');

async function main() {
  const idToken = await auth();
  const authHeaders = { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' };

  let pageToken = '';
  let scanned = 0;
  const toMark = [];
  const already = [];

  while (true) {
    const url = `${DOCS}/conversations?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await fetch(url, { headers: authHeaders });
    if (!res.ok) throw new Error(`list failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    for (const d of data.documents || []) {
      scanned += 1;
      const f = d.fields || {};
      const id = d.name.split('/').pop();
      const status = str(f.status);
      const dispStatus = str(f.dispositionStatus);
      const hasDisposition = !!f.disposition;
      const escalationType = str(f.escalationType);
      const slaStage = f.slaStage ? Number(f.slaStage.integerValue ?? f.slaStage.doubleValue ?? 0) : 0;

      if (dispStatus || hasDisposition) { already.push(id); continue; }

      const terminal = status === 'completed' || status === 'resolved';
      const wasUrgent = escalationType === 'staff' || slaStage > 0;
      if (terminal && wasUrgent) toMark.push(id);
    }
    pageToken = data.nextPageToken || '';
    if (!pageToken) break;
  }

  console.log(`scanned=${scanned} legacyCandidates=${toMark.length} alreadyDispositioned=${already.length} apply=${APPLY}`);

  if (APPLY) {
    const stamp = new Date().toISOString();
    let marked = 0;
    let failed = 0;
    for (const id of toMark) {
      const url = `${DOCS}/conversations/${id}?updateMask.fieldPaths=dispositionStatus&updateMask.fieldPaths=dispositionLegacyAt`;
      const r = await fetch(url, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          fields: {
            dispositionStatus: { stringValue: 'legacy' },
            dispositionLegacyAt: { stringValue: stamp },
          },
        }),
      });
      if (r.ok) marked += 1;
      else { failed += 1; console.error(`failed ${id}: ${r.status}`); }
    }
    console.log(`marked=${marked} failed=${failed}`);
  } else {
    console.log('DRY-RUN: nothing written. Pass --apply to write.');
    if (toMark.length) console.log(`sample: ${toMark.slice(0, 20).join('\n')}`);
  }
}

main().catch((err) => {
  console.error('migration failed:', err?.message || err);
  process.exit(1);
});
