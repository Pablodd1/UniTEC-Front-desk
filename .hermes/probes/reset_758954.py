#!/usr/bin/env python3
"""Reset session_1790960758954_vhf9jl2ke to active + verify."""
import json, urllib.request, urllib.error

UA = {'User-Agent': 'unitec-reset-758954/1.0'}
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

s, t = req(f'{fs}/conversations/{SID}?updateMask.fieldPaths=status', method='PATCH',
           body={'fields': {'status': {'stringValue': 'active'}}}, headers=H)
print('PATCH ->', s)
s, t = req(f'{fs}/conversations/{SID}', headers=H)
st = json.loads(t).get('fields', {}).get('status', {}).get('stringValue')
prev = json.loads(t).get('fields', {}).get('analytics', {})
print('verify status =', st)
