#!/usr/bin/env python3
"""Final review pass: 12h activity + third chat timing."""
import json, time, urllib.request, urllib.error, datetime

UA = {'User-Agent': 'unitec-final-pass/1.0'}
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


now = datetime.datetime.now(datetime.timezone.utc)
cutoff = (now - datetime.timedelta(hours=12)).strftime('%Y-%m-%dT%H:%M')
with open('firebase-applet-config.json', 'rb') as f:
    cfg = json.loads(f.read().decode('utf-8-sig'))
s, t = req(f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={cfg['apiKey']}",
           method='POST', body={'returnSecureToken': True})
tok = json.loads(t)['idToken']
H = {'Authorization': f'Bearer {tok}'}
fs = f"https://firestore.googleapis.com/v1/projects/{cfg['projectId']}/databases/(default)/documents"


def pv(v):
    for k in ('stringValue', 'integerValue', 'booleanValue', 'doubleValue'):
        if k in v:
            return v[k]
    return None


q = {'structuredQuery': {'from': [{'collectionId': 'conversations'}],
     'where': {'fieldFilter': {'field': {'fieldPath': 'lastUpdated'}, 'op': 'GREATER_THAN_OR_EQUAL',
     'value': {'stringValue': cutoff}}}, 'limit': 50}}
s, t = req(f'{fs}:runQuery', method='POST', body=q, headers=H)
rows = []
for row in json.loads(t):
    doc = row.get('document')
    if not doc:
        continue
    fld = {k: pv(v) for k, v in doc.get('fields', {}).items()}
    rows.append((doc['name'].split('/')[-1], fld))
rows.sort(key=lambda r: str(r[1].get('lastUpdated') or ''), reverse=True)
print(f'sessions updated in last 12h: {len(rows)}')
for sid, fld in rows[:12]:
    print(f"  {sid} {fld.get('lastUpdated')} status={fld.get('status')} last='{str(fld.get('lastMessage'))[:58]}'")

# third chat timing
t0 = time.time()
s2, t2 = req(WWW + '/api/chat', method='POST', body={
    'message': 'hola, ¿manejan paneles WPC para fachada?',
    'sessionId': 'diag-review-1005d', 'brandId': 'unitec'})
dt = time.time() - t0
print(f'chat probe#3: HTTP {s2} in {dt:.1f}s → {t2[:140]}')
req(f'{fs}/conversations/diag-review-1005d', method='DELETE', headers=H)
print('cleanup done')
