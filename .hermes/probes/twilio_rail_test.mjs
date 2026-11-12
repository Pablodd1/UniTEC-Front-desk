// Verifies the Twilio-only rail + that the Telegram alert ALWAYS carries the full detail block.
process.env.ADMIN_SECRET = 'local-test-secret';
process.env.TELEGRAM_BOT_TOKEN = '000000:local-test-bot-token';
process.env.TELEGRAM_CHAT_ID = '-1001234567890';
process.env.TWILIO_ACCOUNT_SID = 'AClocal';
process.env.TWILIO_AUTH_TOKEN = 'local-token';
process.env.TWILIO_PHONE_NUMBER = '+15550000000';
process.env.SENT_DM_API_KEY = 'should-never-be-used';

const ROOT = '/home/jasme/UniTEC-Front-desk';
let pass = 0, fail = 0;
const check = (n, c) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const calls = [];
globalThis.fetch = async (url, opts) => {
  calls.push({ url: String(url), body: opts?.body ? String(opts.body) : '' });
  return { ok: true, status: 200, json: async () => ({ sid: 'SMtest' }), text: async () => '' };
};

const { default: notifyEscalation } = await import(`${ROOT}/api/notify-escalation.js`);
const res = { statusCode: 200, headers: {}, body: null, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(j) { this.body = j; return this; }, end() { return this; } };

// deliberately NO name/phone/email/product -> the template must still show every field
await notifyEscalation(
  { method: 'POST', headers: { origin: 'https://unitec-front-desk.vercel.app' },
    body: { type: 'staff', message: 'necesito un asesor', sessionId: 'session_rail_test', phones: ['+17860000001', '+573000000002'] } },
  res
);

const tg = calls.find((c) => c.url.includes('api.telegram.org'));
const tgText = tg ? JSON.parse(tg.body).text : '';
const twilio = calls.filter((c) => c.url.includes('api.twilio.com'));
const sentdm = calls.filter((c) => c.url.includes('sent.dm'));

check('escalation accepted (200)', res.statusCode === 200);
check('Telegram rail called', Boolean(tg));
check('Twilio SMS rail called', twilio.length > 0);
check('Twilio SMS sent to BOTH staff phones', twilio.length === 2);
check('Sent.dm is NEVER called (provider removed)', sentdm.length === 0);
check('Twilio WhatsApp NOT fired when SMS succeeded', calls.filter((c) => c.url.includes('api.twilio.com') && c.body.includes('whatsapp')).length === 0);

console.log('\n--- Telegram alert detail block ---');
console.log(tgText);
console.log('--- end ---\n');
for (const label of ['Cliente:', 'Teléfono:', 'Correo:', 'Producto/intención:', 'Marca:', 'Esperando asesor desde:', 'Mensaje del cliente:', 'Conversación (últimos turnos):', 'Sesión:', 'Página:', 'Prioridad:']) {
  check(`telegram always includes "${label}"`, tgText.includes(label));
}
check('empty fields render "no indicado" (not a missing line)', tgText.includes('no indicado'));
check('empty transcript renders "sin turnos registrados"', tgText.includes('sin turnos registrados'));
check('signed staff link present', /https:\/\/[^\s"<]+\?staff=/.test(tgText));

// the audit trail must record the new rail
const audit = calls.find((c) => c.url.includes('/escalations'));
check('audit doc written', Boolean(audit));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
