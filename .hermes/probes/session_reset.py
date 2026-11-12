#!/usr/bin/env python3
"""List protected sessions; reset the two stuck TEST sessions to active so the bot resumes."""
import json, urllib.request, urllib.error

UA = {'User-Agent': 'unitec-session-reset/1.0'}
RESET_IDS = ['session_1791149452161_7a236inx0', 'session_1791184426478_czbh4rw5t']


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


# 1) List ALL sessions currently in human_requested / human_assigned
for status in ('human_assigned', 'human_requested'):
    q = {'structuredQuery': {
        'from': [{'collectionId': 'conversations'}],
        'where': {'fieldFilter': {
            'field': {'fieldPath': 'status'},
            'op': 'EQUAL',
            'value': {'stringValue': status}}},
        'limit': 40}}
    s, t = req(f'{fs}:runQuery', method='POST', body=q, headers=H)
    rows = []
    try:
        for row in json.loads(t):
            doc = row.get('document')
            if not doc:
                continue
            fld = doc.get('fields', {})
            rows.append((doc['name'].split('/')[-1], pv(fld.get('lastUpdated')), pv(fld.get('source')), pv(fld.get('lastMessage'))))
    except Exception as e:
        print('list err', e)
    rows.sort(key=lambda r: str(r[1] or ''), reverse=True)
    print(f'== {status}: {len(rows)}')
    for sid, lu, src, lm in rows:
        print(f"   {sid} {lu} src={src} last='{str(lm)[:60]}'")

# 2) Reset the two stuck test sessions to active (status field only)
print()
for sid in RESET_IDS:
    s, t = req(f'{fs}/conversations/{sid}?updateMask.fieldPaths=status', method='PATCH',
               body={'fields': {'status': {'stringValue': 'active'}}}, headers=H)
    print('PATCH', sid, '->', s)
    s, t = req(f'{fs}/conversations/{sid}', headers=H)
    try:
        st = json.loads(t).get('fields', {}).get('status', {}).get('stringValue')
        print('   verify status =', st)
    except Exception as e:
        print('   verify err', e)
