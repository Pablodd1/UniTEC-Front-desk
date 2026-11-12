#!/usr/bin/env python3
"""Dump ALL escalation audit docs raw (verify delivered/failed fields)."""
import json, urllib.request, urllib.error

UA = {'User-Agent': 'unitec-esc-dump/1.0'}


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

s, t = req(f'{fs}/escalations?pageSize=30', headers=H)
try:
    docs = json.loads(t).get('documents', []) or []
    print(f'escalations total fetched: {len(docs)}')
    for d in docs:
        print('----', d.get('name'))
        print(json.dumps(d.get('fields', {}), indent=1)[:1200])
except Exception as e:
    print('err', e, t[:300])

# also confirm sla_queue collection state
s, t = req(f'{fs}/sla_queue?pageSize=5', headers=H)
print('sla_queue:', t[:200] if s != 200 else ('empty' if '"documents"' not in t else t[:300]))
