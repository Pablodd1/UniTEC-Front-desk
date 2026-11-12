#!/usr/bin/env python3
"""Outage triage: what did the client's recent test sessions experience?"""
import json, urllib.request, urllib.error, datetime

UA = {'User-Agent': 'unitec-outage-triage/1.0'}


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


cutoff = '2026-10-05T15:15'  # ~last hour
q = {'structuredQuery': {
    'from': [{'collectionId': 'conversations'}],
    'where': {'fieldFilter': {
        'field': {'fieldPath': 'lastUpdated'},
        'op': 'GREATER_THAN_OR_EQUAL',
        'value': {'stringValue': cutoff}}},
    'limit': 60}}

s, t = req(f'{fs}:runQuery', method='POST', body=q, headers=H)
rows = []
try:
    for row in json.loads(t):
        doc = row.get('document')
        if not doc:
            continue
        fld = {k: pv(v) for k, v in doc.get('fields', {}).items()}
        rows.append((doc['name'].split('/')[-1], fld))
except Exception as e:
    print('query err', e, t[:300])

rows.sort(key=lambda r: str(r[1].get('lastUpdated') or ''), reverse=True)
print(f'sessions updated since {cutoff}: {len(rows)}')
for sid, fld in rows[:20]:
    an = fld.get('analytics') or {}
    print(f"  {sid:34s} {fld.get('lastUpdated')} status={fld.get('status')} umc={an.get('userMessageCount')} mc={an.get('messageCount')} last='{str(fld.get('lastMessage'))[:55]}'")

print()
for sid, fld in rows[:2]:
    print(f'--- messages of {sid} ---')
    s, t = req(f'{fs}/conversations/{sid}/messages?pageSize=60', headers=H)
    msgs = []
    try:
        msgs = json.loads(t).get('documents', []) or []
    except Exception as e:
        print('  err', e)
    msgs.sort(key=lambda m: str(pv(m.get('fields', {}).get('timestamp', {})) or ''))
    for m in msgs:
        fld2 = {k: pv(v) for k, v in m.get('fields', {}).items()}
        print(f"  [{fld2.get('timestamp')}] {fld2.get('role')}: {str(fld2.get('text'))[:95]}")
