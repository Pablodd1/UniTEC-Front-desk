#!/usr/bin/env python3
"""Verify price-map fix is live + bot answers kit tapones with its price."""
import json, urllib.request, urllib.error, time

BASE = 'https://www.chatbuildinginnovation.us'
UA = {'User-Agent': 'unitec-health-sweep/1.0'}


def req(url, method='GET', body=None, headers=None, timeout=45):
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


print('== served price-map ==')
s, t = req(BASE + '/price-map.json')
pm = json.loads(t)
print('entries:', len(pm))
print('14122904:', pm.get('14122904'))
print('14122895 present:', '14122895' in pm)

print('\n== live bot: kit tapones price ==')
sid = 'diag-kit-1005'
s, t = req(BASE + '/api/chat', method='POST',
           body={'message': '¿Cuánto vale el kit de tapones para el listón estructural?',
                 'sessionId': sid, 'brandId': 'unitec'})
try:
    r = json.loads(t).get('text', '')
except Exception:
    r = t[:250]
print('A:', r[:330])

print('\n== cleanup ==')
with open('firebase-applet-config.json', 'rb') as f:
    cfg = json.loads(f.read().decode('utf-8-sig'))
s, t = req(f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={cfg['apiKey']}",
           method='POST', body={'returnSecureToken': True})
tok = json.loads(t)['idToken']
H = {'Authorization': f'Bearer {tok}'}
fs = f"https://firestore.googleapis.com/v1/projects/{cfg['projectId']}/databases/(default)/documents"
time.sleep(3)
s, t = req(f'{fs}/conversations/{sid}/messages?pageSize=50', headers=H)
msgs = []
try:
    msgs = json.loads(t).get('documents', []) or []
except Exception:
    pass
for m in msgs:
    req('https://firestore.googleapis.com/v1/' + m['name'], method='DELETE', headers=H)
s, _ = req(f'{fs}/conversations/{sid}', method='DELETE', headers=H)
print('del session:', s)
s, _ = req(f'{fs}/conversations/{sid}', headers=H)
print('re-GET (expect 404):', s)
