#!/usr/bin/env python3
"""Current-state review of the updated UniTEC front desk chatbot (post-fixes)."""
import json, re, time, urllib.request, urllib.error, datetime

UA = {'User-Agent': 'unitec-review-current/1.0'}
APP = 'https://unitec-front-desk.vercel.app'
WWW = 'https://www.chatbuildinginnovation.us'


def req(url, method='GET', body=None, headers=None, timeout=60):
    h = dict(UA); h.update(headers or {})
    data = None
    if body is not None:
        data = json.dumps(body).encode(); h['Content-Type'] = 'application/json'
    r = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return resp.status, resp.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'replace')
    except Exception as e:
        return None, f'EXC: {e}'


print('NOW:', datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'))

# 1) Bundle hash on client domain + notice fix present in served bundle
s, t = req(WWW + '/')
m = re.search(r'assets/index-[A-Za-z0-9_-]+\.js', t)
bundle = m.group(0) if m else '?'
print('1) WWW bundle:', bundle, '(expect index-CGYedsnl.js)')
s2, t2 = req(f'{WWW}/{bundle.split("/")[-1] if False else bundle}')
s3, t3 = req(f'{WWW}/' + bundle)
notice = 'ya está atendiendo esta conversación' in t3
handoff = 'handoff-' in t3
print(f'   notice-fix in bundle: {notice} | handoff marker: {handoff}')
s4, t4 = req(APP + '/')
m4 = re.search(r'assets/index-[A-Za-z0-9_-]+\.js', t4)
print('   APP bundle:', m4.group(0) if m4 else '?')

# 2) Services
for name, path in [('warm', '/api/warm'), ('widget-status', '/api/widget-status'),
                   ('system-health', '/api/system-health'), ('anomalies', '/api/anomalies')]:
    s5, t5 = req(WWW + path)
    print(f'2) {name}: HTTP {s5} → {t5[:260]}')

# 3) Live chat probe (no escalation keywords) + timing + cleanup
t0 = time.time()
s6, t6 = req(WWW + '/api/chat', method='POST', body={
    'message': 'hola, ¿manejan el piso deck en color nogal?',
    'sessionId': 'diag-review-1005', 'brandId': 'unitec'})
dt = time.time() - t0
try:
    reply = json.loads(t6).get('text') or json.loads(t6).get('reply') or t6[:200]
except Exception:
    reply = t6[:200]
print(f'3) chat probe: HTTP {s6} in {dt:.1f}s → {str(reply)[:180]}')

# 4) Served price map spot check (updated today)
s7, t7 = req(WWW + '/price-map.json')
try:
    pm = json.loads(t7)
    kit = pm.get('14122904') or {}
    print(f'4) price-map: {len(pm)} entries | kit 14122904 = {kit.get("price_cop")} | legacy 14122895 present: {"14122895" in pm}')
except Exception as e:
    print('4) price-map check failed:', e, t7[:120])

# 5) Firestore: recent activity + reset sessions' status
with open('firebase-applet-config.json', 'rb') as f:
    cfg = json.loads(f.read().decode('utf-8-sig'))
s8, t8 = req(f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={cfg['apiKey']}",
             method='POST', body={'returnSecureToken': True})
tok = json.loads(t8)['idToken']
H = {'Authorization': f'Bearer {tok}'}
fs = f"https://firestore.googleapis.com/v1/projects/{cfg['projectId']}/databases/(default)/documents"


def pv(v):
    for k in ('stringValue', 'integerValue', 'booleanValue', 'doubleValue'):
        if k in v:
            return v[k]
    return None


now = datetime.datetime.now(datetime.timezone.utc)
cutoff = (now - datetime.timedelta(minutes=60)).strftime('%Y-%m-%dT%H:%M')
q = {'structuredQuery': {'from': [{'collectionId': 'conversations'}],
     'where': {'fieldFilter': {'field': {'fieldPath': 'lastUpdated'}, 'op': 'GREATER_THAN_OR_EQUAL',
     'value': {'stringValue': cutoff}}}, 'limit': 40}}
s9, t9 = req(f'{fs}:runQuery', method='POST', body=q, headers=H)
rows = []
for row in json.loads(t9):
    doc = row.get('document')
    if not doc:
        continue
    fld = {k: pv(v) for k, v in doc.get('fields', {}).items()}
    rows.append((doc['name'].split('/')[-1], fld))
rows.sort(key=lambda r: str(r[1].get('lastUpdated') or ''), reverse=True)
print(f'5) sessions updated in last 60 min: {len(rows)}')
for sid, fld in rows[:10]:
    print(f"   {sid} {fld.get('lastUpdated')} status={fld.get('status')} last='{str(fld.get('lastMessage'))[:55]}'")

print('   reset sessions status now:')
for sid in ['session_1791149452161_7a236inx0', 'session_1791184426478_czbh4rw5t', 'session_1790960758954_vhf9jl2ke']:
    s10, t10 = req(f'{fs}/conversations/{sid}', headers=H)
    try:
        st = json.loads(t10).get('fields', {}).get('status', {}).get('stringValue')
    except Exception:
        st = 'ERR'
    print(f'   {sid} → {st}')

# 6) cleanup review session
req(f'{fs}/conversations/diag-review-1005/messages?pageSize=50', headers=H)
sdel, _ = req(f'{fs}/conversations/diag-review-1005', method='DELETE', headers=H)
_, tcheck = req(f'{fs}/conversations/diag-review-1005', headers=H)
print('6) diag-review cleanup:', sdel, '(404 next =', 'yes' if '"error"' in tcheck or tcheck.strip().endswith('NOT_FOUND') or '404' in str(tcheck)[:200] else 'check', ')')
