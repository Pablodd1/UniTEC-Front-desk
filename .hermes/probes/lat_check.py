#!/usr/bin/env python3
"""Latency characterization: warm-instance check + streamed chat with x-diag stats."""
import json, time, urllib.request, urllib.error

UA = {'User-Agent': 'unitec-lat-check/1.0'}
WWW = 'https://www.chatbuildinginnovation.us'


def req(url, method='GET', body=None, headers=None, timeout=60, raw=False):
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


for i in (1, 2):
    t0 = time.time()
    s, t = req(WWW + '/api/warm')
    print(f'warm#{i}: {time.time()-t0:.2f}s hdr={t[:90]}')

t0 = time.time()
s, t = req(WWW + '/api/chat', method='POST',
           headers={'x-diag': '1'},
           body={'message': 'hola, ¿qué referencias de listón PVC manejan?',
                 'sessionId': 'diag-review-1005e', 'brandId': 'unitec', 'stream': True})
dt = time.time() - t0
print(f'chat(stream): {dt:.2f}s http={s} len={len(t)}')
# find dbg json in the SSE tail
idx = t.rfind('"dbg"')
print('dbg chunk:', t[max(0, idx-10):idx+320] if idx != -1 else 'none')
# sample text
m = t.find('"text"')
print('text sample:', t[:200].replace(chr(10), ' ')[:200])

with open('firebase-applet-config.json', 'rb') as f:
    cfg = json.loads(f.read().decode('utf-8-sig'))
s2, t2 = req(f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={cfg['apiKey']}",
             method='POST', body={'returnSecureToken': True})
tok = json.loads(t2)['idToken']
fs = f"https://firestore.googleapis.com/v1/projects/{cfg['projectId']}/databases/(default)/documents"
sdel, _ = req(f'{fs}/conversations/diag-review-1005e', method='DELETE',
              headers={'Authorization': f'Bearer {tok}'})
print('cleanup:', sdel)
