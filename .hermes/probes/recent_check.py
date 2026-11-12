#!/usr/bin/env python3
"""Check the last few minutes for new sessions (embed test)."""
import json, urllib.request, urllib.error, datetime

UA = {'User-Agent': 'unitec-recent-check/1.0'}


def req(url, method='GET', body=None, headers=None, timeout=40):
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
    if 'mapValue' in v:
        return {k2: pv(v2) for k2, v2 in v['mapValue'].get('fields', {}).items()}
    if 'arrayValue' in v:
        return [pv(x) for x in v['arrayValue'].get('values', [])]
    return None


now = datetime.datetime.now(datetime.timezone.utc)
cutoff = (now - datetime.timedelta(minutes=12)).strftime('%Y-%m-%dT%H:%M')
print('now:', now.strftime('%Y-%m-%dT%H:%M:%SZ'), 'cutoff:', cutoff)

q = {'structuredQuery': {
    'from': [{'collectionId': 'conversations'}],
    'where': {'fieldFilter': {
        'field': {'fieldPath': 'lastUpdated'},
        'op': 'GREATER_THAN_OR_EQUAL',
        'value': {'stringValue': cutoff}}},
    'limit': 30}}
s, t = req(f'{fs}:runQuery', method='POST', body=q, headers=H)
rows = []
for row in json.loads(t):
    doc = row.get('document')
    if not doc:
        continue
    fld = {k: pv(v) for k, v in doc.get('fields', {}).items()}
    rows.append((doc['name'].split('/')[-1], fld))
rows.sort(key=lambda r: str(r[1].get('lastUpdated') or ''), reverse=True)
print('sessions in window:', len(rows))
for sid, fld in rows[:8]:
    an = fld.get('analytics') or {}
    print(f"  {sid} {fld.get('lastUpdated')} src={fld.get('source')} umc={an.get('userMessageCount')} last='{str(fld.get('lastMessage'))[:60]}'")

print()
for sid, fld in rows[:3]:
    s, t = req(f'{fs}/conversations/{sid}/messages?pageSize=80', headers=H)
    msgs = json.loads(t).get('documents', []) or []
    print(f'--- {sid}: {len(msgs)} msgs ---')
    for m in msgs:
        f2 = {k: pv(v) for k, v in m.get('fields', {}).items()}
        print(f"  [{f2.get('timestamp')}] {f2.get('role')}: {str(f2.get('text'))[:90]}")
