#!/usr/bin/env python3
"""Verify conversation_archives now contains the sweep's output."""
import json, urllib.request, urllib.error

UA = {'User-Agent': 'unitec-status-probe/1.0'}


def req(url, method='GET', body=None, headers=None, timeout=30):
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


s, t = req(f'{fs}/conversation_archives?pageSize=100', headers=H)
print('list conversation_archives:', s)
try:
    docs = json.loads(t).get('documents', []) or []
    print('archived docs:', len(docs))
    for d in docs[:8]:
        fld = {k: pv(v) for k, v in d.get('fields', {}).items()}
        keys = sorted(fld.keys())[:8]
        sid = fld.get('sessionId') or fld.get('conversationId') or d['name'].split('/')[-1]
        print('  ', d['name'].split('/')[-1], '| keys:', keys, '| sid:', sid)
except Exception as e:
    print('parse err:', e, t[:300])
