// Local (no-network) verification of the signed staff link: token round-trip, tamper/expiry
// rejection, and that /api/notify-escalation actually ships the signed URL in the alert.
process.env.ADMIN_SECRET = 'local-test-secret';
process.env.TELEGRAM_BOT_TOKEN = '000000:local-test-bot-token';
process.env.TELEGRAM_CHAT_ID = '-1001234567890';

const ROOT = '/home/jasme/UniTEC-Front-desk';
const { signStaffToken, verifyStaffToken, staffUrl } = await import(`${ROOT}/api/_staff-token.js`);

let pass = 0, fail = 0;
const check = (name, cond) => { (cond ? pass++ : fail++); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

// 1) round trip
const sid = 'session_1791553254283_0mwcxw7v8';
const tok = signStaffToken(sid);
check('sign produces a token', typeof tok === 'string' && tok.includes('.'));
check('verify accepts its own token', verifyStaffToken(sid, tok).ok === true);
check('verify rejects token replayed on ANOTHER session', verifyStaffToken('session_other', tok).ok === false);
check('verify rejects tampered signature', verifyStaffToken(sid, tok.slice(0, -2) + 'xx').ok === false);
check('verify rejects garbage', verifyStaffToken(sid, 'not-a-token').ok === false);
check('url carries staff + session', staffUrl(sid).includes('/?staff=') && staffUrl(sid).includes(`session=${encodeURIComponent(sid)}`));

// 2) expired token (validly signed, exp in the past)
const expTok = signStaffToken(sid, -1);
check('expired-but-validly-signed token is rejected', verifyStaffToken(sid, expTok).ok === false);

// 3) notify-escalation ships the signed link (origin present => old code would have used it)
const calls = [];
globalThis.fetch = async (url, opts) => {
  calls.push({ url: String(url), body: opts?.body ? String(opts.body) : '' });
  return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
};
const { default: notifyEscalation } = await import(`${ROOT}/api/notify-escalation.js`);
const res = { statusCode: 200, headers: {}, body: null, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(j) { this.body = j; return this; }, end() { return this; } };
await notifyEscalation(
  { method: 'POST', headers: { origin: 'https://unitec-front-desk.vercel.app' }, body: { type: 'staff', message: 'Cliente pidió un asesor', sessionId: sid, customerName: 'Ana', customerPhone: '+573001112233' } },
  res
);
const tg = calls.find((c) => c.url.includes('api.telegram.org'));
const tgText = tg ? JSON.parse(tg.body).text : '';
const m = tgText.match(/https:\/\/[^\s"<]+\?staff=([^&"]+)&session=([^&"]+)/);
check('telegram alert carries a /?staff= link', Boolean(m));
check('the link token verifies for that session', m ? verifyStaffToken(decodeURIComponent(m[2]), decodeURIComponent(m[1])).ok === true : false);
check('alert still names the customer', tgText.includes('Ana'));
check('audit/conter write reached firestore', calls.some((c) => c.url.includes('firestore.googleapis.com')));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
