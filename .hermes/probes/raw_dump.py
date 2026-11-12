#!/usr/bin/env python3
"""Raw dump of client session docs + metadata. Is a reply missing? Live now?"""
import json, urllib.request, urllib.error, time

UA = {'User-Agent': 'unitec-raw-dump/1.0'}
SID = 'session_1791149452161_7a236inx0'


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
docbase = f"https://firestore.googleapis.com/v1/projects/{cfg['projectId']}/databases/(default)/documents"


def pv(v):
    for k in ('stringValue', 'integerValue', 'booleanValue', 'doubleValue', 'nullValue'):
        if k in v:
            return v[k]
    if 'mapValue' in v:
        return {k2: pv(v2) for k2, v2 in v['mapValue'].get('fields', {}).items()}
    if 'arrayValue' in v:
        return [pv(x) for x in v['arrayValue'].get('values', [])]
    return None


def dump(sid):
    s, t = req(f'{docbase}/conversations/{sid}', headers=H)
    d = json.loads(t)
    print(f"== conv {sid}")
    print(f"   createTime={d.get('createTime')}  updateTime={d.get('updateTime')}")
    fld = {k: pv(v) for k, v in d.get('fields', {}).items()}
    for k in ('status', 'source', 'lastUpdated', 'lastMessage', 'lastMessageAt', 'flowStage', 'welcomeSent'):
        if k in fld:
            print(f"   {k} = {str(fld[k])[:110]}")
    an = fld.get('analytics') or {}
    print(f"   analytics: {json.dumps(an)[:220]}")
    s, t = req(f'{docbase}/conversations/{sid}/messages?pageSize=100', headers=H)
    docs = json.loads(t).get('documents', []) or []
    print(f"   -- {len(docs)} message docs (raw metadata) --")
    rows = []
    for m in docs:
        f2 = {k: pv(v) for k, v in m.get('fields', {}).items()}
        rows.append((m.get('createTime'), m.get('updateTime'), m['name'].split('/')[-1], f2))
    rows.sort(key=lambda r: str(r[0]))
    for ct, ut, name, f2 in rows:
        print(f"   ct={ct} ut={ut}")
        print(f"     {name[:22]} | ts={f2.get('timestamp')} role={f2.get('role')} | {str(f2.get('text'))[:140]}")


dump(SID)
print()
print('sleeping 25s, checking for new activity...')
time.sleep(25)
s, t = req(f'{docbase}/conversations/{SID}', headers=H)
d = json.loads(t)
print('conv updateTime now:', d.get('updateTime'))
s, t = req(f'{docbase}/conversations/{SID}/messages?pageSize=100', headers=H)
docs2 = json.loads(t).get('documents', []) or []
print('message docs now:', len(docs2))
