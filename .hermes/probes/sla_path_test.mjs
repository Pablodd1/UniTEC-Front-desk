// Local (no-network) check that the SLA alert payload is ACCEPTED by the escalation handler when it
// is called in-process — the path that replaced the silently-failing HTTP self-call.
process.env.ADMIN_SECRET = 'local-test-secret';
process.env.TELEGRAM_BOT_TOKEN = '000000:local-test-bot-token';
process.env.TELEGRAM_CHAT_ID = '-1001234567890';

const ROOT = '/home/jasme/UniTEC-Front-desk';
let pass = 0, fail = 0;
const check = (n, c) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const calls = [];
globalThis.fetch = async (url, opts) => {
  calls.push({ url: String(url), body: opts?.body ? String(opts.body) : '' });
  return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
};

const { callNotifyEscalation } = await import(`${ROOT}/api/_alert.js`);

// exactly the body api/staff-sla-sweep.js sendSlaAlert() builds
const slaBody = {
  type: 'sla',
  priority: 'high',
  customerName: 'Cliente Prueba',
  customerPhone: '',
  message: 'El cliente sigue esperando respuesta de un asesor.',
  brand: 'unitec',
  sessionId: 'session_test_sla',
  waitingSince: new Date().toISOString(),
  slaStage: 1,
  transcript: [{ role: 'user', text: 'Esperando asesor desde hace 3 min (etapa SLA 1).' }],
};

const r = await callNotifyEscalation(slaBody);
check('in-process call returns 200 (payload accepted, not 400)', r.statusCode === 200);
check('telegram rail was invoked', calls.some((c) => c.url.includes('api.telegram.org')));
check('audit doc written into `escalations`', calls.some((c) => c.url.includes('/escalations')));
check('slaRealerts counter bumped (not escalationCount)', calls.some((c) => c.body.includes('slaRealerts'))
  && !calls.some((c) => c.body.includes('escalationCount')));

// a deliberately broken payload must still be rejected, so the guard is real
const bad = await callNotifyEscalation({ sessionId: 'session_test_sla' });
check('payload without type/message is rejected (400)', bad.statusCode === 400);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
