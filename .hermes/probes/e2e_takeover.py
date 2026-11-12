#!/usr/bin/env python3
"""Find the session just created from my UI test; flip it to human_assigned to simulate takeover."""
import json, urllib.request, urllib.error, datetime

UA = {'User-Agent': 'unitec-e2e-takeover/1.0'}


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
    for k in ('stringValue', 'integerValue', 'booleanValue', 'doubleValue', 'nullValue'):
        if k in v:
            return v[k]
    if 'mapValue' in v:
        return {k2: pv(v2) for k2, v2 in v['mapValue'].get('fields', {}).items()}
    return None


now = datetime.datetime.now(datetime.timezone.utc)
cutoff = (now - datetime.timedelta(minutes=5)).strftime('%Y-%m-%dT%H:%M')
q = {'structuredQuery': {
    'from': [{'collectionId': 'conversations'}],
    'where': {'fieldFilter': {
        'field': {'fieldPath': 'lastUpdated'},
        'op': 'GREATER_THAN_OR_EQUAL',
        'value': {'stringValue': cutoff}}},
    'limit': 20}}
s, t = req(f'{fs}:runQuery', method='POST', body=q, headers=H)
target = None
for row in json.loads(t):
    doc = row.get('document')
    if not doc:
        continue
    fld = {k: pv(v) for k, v in doc.get('fields', {}).items()}
    lm = str(fld.get('lastMessage') or '')
    print(doc['name'].split('/')[-1], '| status', fld.get('status'), '| last:', lm[:70])
    if 'colores tiene el piso deck' in lm.lower():
        target = doc['name'].split('/')[-1]

print()
if not target:
    print('TARGET NOT FOUND')
else:
    print('TARGET:', target)
    s, t = req(f'{fs}/conversations/{target}?updateMask.fieldPaths=status', method='PATCH',
               body={'fields': {'status': {'stringValue': 'human_assigned'}}}, headers=H)
    print('PATCH ->', s)
    s, t = req(f'{fs}/conversations/{target}', headers=H)
    st = json.loads(t).get('fields', {}).get('status', {}).get('stringValue')
    print('verify status =', st)
