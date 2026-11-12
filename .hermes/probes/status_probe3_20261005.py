#!/usr/bin/env python3
"""Scan sessions since Oct 3 (Bogota) for the transient-error bubble frequency."""
import json, urllib.request, urllib.error

UA = {'User-Agent': 'unitec-status-probe/1.0'}


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
    return None


q = {'structuredQuery': {
    'from': [{'collectionId': 'conversations'}],
    'where': {'fieldFilter': {
        'field': {'fieldPath': 'lastUpdated'},
        'op': 'GREATER_THAN_OR_EQUAL',
        'value': {'stringValue': '2026-10-03'}}},
    'limit': 300}}

s, t = req(f'{fs}:runQuery', method='POST', body=q, headers=H)
print('query:', s)
total = 0
errs = []
try:
    for row in json.loads(t):
        doc = row.get('document')
        if not doc:
            continue
        fld = {k: pv(v) for k, v in doc.get('fields', {}).items()}
        total += 1
        lm = str(fld.get('lastMessage') or '')
        if 'Ups, tuve un problema' in lm:
            errs.append((doc['name'].split('/')[-1], fld.get('lastUpdated')))
    print('sessions since 2026-10-03:', total)
    print('with transient-error lastMessage:', len(errs))
    for sid, lu in errs:
        print('  ', sid, lu)
except Exception as e:
    print('parse err', e, t[:300])
