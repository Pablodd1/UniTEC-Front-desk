#!/usr/bin/env python3
"""Round 2: inspect Oct-4 error sessions + clean stale test sessions."""
import json, urllib.request, urllib.error

BASE = 'https://www.chatbuildinginnovation.us'
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
    if 'mapValue' in v:
        return {k2: pv(v2) for k2, v2 in v['mapValue'].get('fields', {}).items()}
    if 'arrayValue' in v:
        return [pv(x) for x in v['arrayValue'].get('values', [])]
    return None


print('== 1) Oct-4 error session messages ==')
sid = 'session_1791093088755_xes2yn10i'
s, t = req(f'{fs}/conversations/{sid}/messages?pageSize=50', headers=H)
print('messages:', s)
try:
    for m in json.loads(t).get('documents', []):
        fld = {k: pv(v) for k, v in m.get('fields', {}).items()}
        print('  ', fld.get('role'), '|', fld.get('timestamp'), '|', str(fld.get('text'))[:115])
except Exception as e:
    print('parse err', e, t[:200])

print('\n== 2) delete stale test sessions ==')
for tid in ['rate-test', 'idem-test']:
    s, t = req(f'{fs}/conversations/{tid}/messages?pageSize=100', headers=H)
    msgs = []
    try:
        msgs = json.loads(t).get('documents', []) or []
    except Exception:
        pass
    for m in msgs:
        s2, _ = req('https://firestore.googleapis.com/v1/' + m['name'], method='DELETE', headers=H)
        print('del msg', tid, s2)
    s2, _ = req(f'{fs}/conversations/{tid}', method='DELETE', headers=H)
    print('del session', tid, s2)
    s3, _ = req(f'{fs}/conversations/{tid}', headers=H)
    print('re-GET', tid, '(expect 404):', s3)
