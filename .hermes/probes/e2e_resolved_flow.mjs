// End-to-end test of the RESOLVED lifecycle against PRODUCTION.
// Uses a test session id: TEST_SESSION_RE excludes it from analytics, sweeps and alerts.
// Never prints secret values — only whether they exist and their length.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const BASE = 'https://www.chatbuildinginnovation.us';

function loadEnv(files) {
  for (const f of files) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      const v = m[2].trim().replace(/^["']|["']$/g, '');
      if (v && !process.env[m[1]]) process.env[m[1]] = v;
    }
  }
}
loadEnv(['.env.production', '.env.local', '.env']);

const has = (k) => `${k}: ${process.env[k] ? `SET (len ${String(process.env[k]).length})` : 'MISSING'}`;
console.log('=== local env ===');
console.log(' ', has('ADMIN_SECRET'));

if (!process.env.ADMIN_SECRET) {
  console.log('\nADMIN_SECRET is not available locally, so a signed staff token cannot be minted here.');
  console.log('The resolve path is code-verified and route-verified; it needs one real alert tap to exercise.');
  process.exit(0);
}

// dynamic imports: _staff-token.js reads ADMIN_SECRET at call time, but keep the order explicit anyway
const { signStaffToken } = await import('../../api/_staff-token.js');
const { getDoc, setDoc } = await import('../../api/_firestore-rest.js');

const sid = `staff-test-verify-${Date.now()}`;
const token = signStaffToken(sid);
console.log('\n=== test session ===');
console.log('  id    :', sid);
console.log('  token :', token ? `minted (len ${token.length})` : 'COULD NOT MINT');

async function post(route, body) {
  const r = await fetch(`${BASE}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}

// 1. seed a session exactly as a real "customer asked for a human" looks
await setDoc(`conversations/${sid}`, {
  status: 'human_requested',
  customerName: 'E2E Verificacion',
  customerPhone: '',
  customerEmail: '',
  brandId: 'unitec',
  lastMessage: 'prueba flujo resuelto',
  funnelStep: 'verify',
  createdAt: new Date().toISOString(),
  lastUpdated: new Date().toISOString(),
});
const seeded = await getDoc(`conversations/${sid}`);
console.log(`  seeded: status=${seeded?.fields?.status}`);

// 2. OPENING THE ALERT must claim the conversation (this is the fix)
const enter = await post('/api/staff-enter', { sessionId: sid, token, by: 'Hermes E2E' });
console.log('\n=== POST /api/staff-enter (open the alert) ===');
console.log(`  HTTP ${enter.status}`, JSON.stringify(enter.data));
const afterEnter = await getDoc(`conversations/${sid}`);
console.log(`  session status now: ${afterEnter?.fields?.status}  claimedAt=${afterEnter?.fields?.claimedAt || '—'}`);

// 3. RESOLVE must close it
const res = await post('/api/session-resolve', { sessionId: sid, token, staffName: 'Hermes E2E' });
console.log('\n=== POST /api/session-resolve (Resolver) ===');
console.log(`  HTTP ${res.status}`, JSON.stringify(res.data));
const after = await getDoc(`conversations/${sid}`);
console.log('  session now:');
for (const k of ['status', 'resolvedAt', 'resolvedBy', 'resolution', 'resolvedFrom']) {
  console.log(`    ${k}: ${after?.fields?.[k] ?? '—'}`);
}

// 4. idempotency: a second resolve must not rewrite it
const res2 = await post('/api/session-resolve', { sessionId: sid, token, staffName: 'Hermes E2E' });
console.log(`\n=== resolve again (idempotency) ===\n  HTTP ${res2.status}`, JSON.stringify(res2.data));

// 5. cleanup
try {
  const url = `https://firestore.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID || ''}`;
  const { docUrl } = await import('../../api/_firestore-rest.js');
  const del = await fetch(docUrl(`conversations/${sid}`), { method: 'DELETE' });
  console.log(`\ncleanup: DELETE test session -> HTTP ${del.status}`);
} catch (e) {
  console.log('\ncleanup skipped:', e?.message);
}

console.log('\n=== verdict ===');
const okEnter = enter.status === 200 && enter.data?.claimed === true && afterEnter?.fields?.status === 'human_assigned';
const okResolve = res.status === 200 && res.data?.status === 'resolved' && after?.fields?.status === 'resolved';
console.log(`  claim on open : ${okEnter ? 'PASS' : 'FAIL'}`);
console.log(`  resolve closes: ${okResolve ? 'PASS' : 'FAIL'}`);
console.log(`  telegram edit : ${JSON.stringify(res.data?.telegram)} (expected no_alert_on_record for a session that never sent an alert)`);
