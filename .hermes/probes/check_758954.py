#!/usr/bin/env python3
"""Inspect session_1790960758954_vhf9jl2ke (bumped 16:21:46 today) + reset if it is a test session."""
import json, urllib.request, urllib.error

UA = {'User-Agent': 'unitec-check-758954/1.0'}
SID = 'session_1790960758954_vhf9jl2ke'


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


s, t = req(f'{fs}/conversations/{SID}', headers=H)
d = json.loads(t)
print('createTime', d.get('createTime'), '| updateTime', d.get('updateTime'))
fld = {k: pv(v) for k, v in d.get('fields', {}).items()}
print('status', fld.get('status'), '| source', fld.get('source'), '| lastUpdated', fld.get('lastUpdated'))
print('lastMessage:', str(fld.get('lastMessage'))[:150])
an = fld.get('analytics') or {}
print('analytics:', json.dumps(an)[:300])

s, t = req(f'{fs}/conversations/{SID}/messages?pageSize=100', headers=H)
docs = json.loads(t).get('documents', []) or []
rows = []
for m in docs:
    f2 = {k: pv(v) for k, v in m.get('fields', {}).items()}
    rows.append((m.get('createTime'), f2))
rows.sort(key=lambda r: str(r[0]))
print(f'-- {len(rows)} messages --')
for ct, f2 in rows:
    print(f"  ct={ct} ts={f2.get('timestamp')} {f2.get('role')}: {str(f2.get('text'))[:110]}")
