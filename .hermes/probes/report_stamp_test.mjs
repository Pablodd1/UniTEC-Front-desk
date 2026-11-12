// Proves the daily/Telegram report now stamps the day ONLY after a successful send, stores the
// delivery result, and leaves the day OPEN when delivery fails (no more silent no-show).
const ROOT = '/home/jasme/UniTEC-Front-desk';
let pass = 0, fail = 0;
const check = (n, c) => { (c ? pass++ : fail++); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const bogotaHour = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' })).getHours();
const todayBogota = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' })).toISOString().split('T')[0];

function makeFetch({ telegramOk, alreadyStamped }) {
  return async (url, opts) => {
    const u = String(url); const method = (opts?.method || 'GET').toUpperCase();
    const J = (o) => ({ ok: true, status: 200, json: async () => o, text: async () => JSON.stringify(o) });
    calls.push({ u, method, body: opts?.body ? String(opts.body) : '' });
    if (u.includes('identitytoolkit')) return J({ idToken: 'tok', expiresIn: '3600' });
    if (u.includes('/config/main') && method === 'GET') {
      return J({ fields: {
        telegramBotToken: { stringValue: '123:abc' },
        telegramChatId: { stringValue: '-1001' },
        telegramReportTime: { stringValue: `${bogotaHour()}:00` },
        ...(alreadyStamped ? { lastAnalyticsReportDate: { stringValue: todayBogota() } } : {}),
      } });
    }
    if (u.includes(':runQuery')) return J([]);                 // no sessions -> "no interactions" report
    if (u.includes('api.telegram.org')) return telegramOk ? J({ result: { message_id: 42 } }) : { ok: false, status: 400, json: async () => ({ description: 'chat not found' }), text: async () => 'chat not found' };
    return J({});
  };
}
let calls = [];
const res = () => ({ statusCode: 200, body: null, headers: {}, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(j) { this.body = j; return this; }, end() { return this; } });

const { default: handler } = await import(`${ROOT}/api/daily-analytics.js`);
const run = async (opts) => { calls = []; globalThis.fetch = makeFetch(opts); const r = res(); await handler({ query: {}, method: 'GET', headers: {} }, r); return r; };

// --- case 1: successful send -> stamps the day + stores the result -------------------------
let r = await run({ telegramOk: true, alreadyStamped: false });
const patch1 = calls.find((c) => c.method === 'PATCH' && c.u.includes('/config/main'));
const stored1 = patch1 ? JSON.parse(JSON.parse(patch1.body).fields.lastAnalyticsReport.stringValue) : null;
check('telegram called', calls.some((c) => c.u.includes('api.telegram.org')));
check('day stamped on success', Boolean(patch1) && patch1.body.includes('lastAnalyticsReportDate') && patch1.body.includes(todayBogota()));
check('delivery result stored (delivered:true + messageId)', Boolean(stored1) && stored1.delivered === true && stored1.telegram?.[0]?.messageId === 42);
check('response reports delivered:true', r.body?.delivered === true);

// --- case 2: already stamped today -> skipped, no PATCH, no telegram ----------------------
r = await run({ telegramOk: true, alreadyStamped: true });
check('second run skips (already sent today)', String(r.body?.message || '').includes('already sent today'));
check('no PATCH and no telegram on the skip path', !calls.some((c) => c.method === 'PATCH') && !calls.some((c) => c.u.includes('api.telegram.org')));

// --- case 3: delivery FAILS -> the day must stay OPEN ------------------------------------
r = await run({ telegramOk: false, alreadyStamped: false });
const patch3 = calls.find((c) => c.method === 'PATCH' && c.u.includes('/config/main'));
const stored3 = patch3 ? JSON.parse(JSON.parse(patch3.body).fields.lastAnalyticsReport.stringValue) : null;
check('failed send does NOT stamp the day', Boolean(patch3) && !patch3.body.includes('lastAnalyticsReportDate'));
check('failed send IS recorded (delivered:false + reason)', Boolean(stored3) && stored3.delivered === false && typeof stored3.telegram?.[0]?.error === 'string');
check('response reports delivered:false', r.body?.delivered === false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
