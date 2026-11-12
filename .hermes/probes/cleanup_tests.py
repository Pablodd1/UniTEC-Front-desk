#!/usr/bin/env python3
"""Delete my diagnostic/test sessions; verify each is gone."""
import json, urllib.request, urllib.error

UA = {'User-Agent': 'unitec-cleanup/1.0'}
IDS = [
    'session_1791217674463_zxpown0lh',   # notice E2E test
    'session_1791217088512_3xbp4yiqf',   # main-site test
    'session_1791217125755_lauvdkuxy',   # embed test
    'diag-outage-1005b',                 # outage probe
]


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

for sid in IDS:
    # delete messages first (ignore errors), then the session
    s, t = req(f'{fs}/conversations/{sid}/messages?pageSize=50', headers=H)
    try:
        docs = json.loads(t).get('documents', []) or []
        for m in docs:
            req(f"https://firestore.googleapis.com/v1/{m['name']}", method='DELETE', headers=H)
    except Exception:
        pass
    s, t = req(f'{fs}/conversations/{sid}', method='DELETE', headers=H)
    s2, t2 = req(f'{fs}/conversations/{sid}', headers=H)
    print(f'{sid}: delete={s} verify-after={s2} (404=gone)')
