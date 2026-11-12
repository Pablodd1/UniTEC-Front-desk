#!/usr/bin/env python3
"""Definitive probe: are the new rules for conversation_archives LIVE?"""
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
base = f"https://firestore.googleapis.com/v1/projects/{cfg['projectId']}/databases/(default)/documents"

doc_id = 'diag_rules_probe_delete_me'
url = f'{base}/conversation_archives?documentId={doc_id}'
body = {'fields': {'probe': {'stringValue': 'rules-check-2026-10-05'},
                   'diag': {'booleanValue': True}}}

s1, t1 = req(url, method='POST', body=body, headers=H)
print('CREATE in conversation_archives:', s1)
print('  response:', t1[:220])

if s1 == 200:
    s2, t2 = req(f'{base}/conversation_archives/{doc_id}', method='DELETE', headers=H)
    print('DELETE probe doc:', s2)
    s3, _ = req(f'{base}/conversation_archives/{doc_id}', headers=H)
    print('re-GET (expect 404):', s3)
    print('\n>>> RULES ARE LIVE: the new conversation_archives block is active.')
else:
    print('\n>>> RULES NOT ACTIVE YET: deploy still pending (expected if login only was run).')
