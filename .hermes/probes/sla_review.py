#!/usr/bin/env python3
"""Live checks for the new SLA/escalation stack: endpoint auth, dry-run plan, audit trail, sessions."""
import json, time, urllib.request, urllib.error, datetime

UA = {'User-Agent': 'unitec-sla-review/1.0'}
WWW = 'https://www.chatbuildinginnovation.us'


def req(url, method='GET', body=None, headers=None, timeout=60):
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


print('NOW:', datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'))

# 1) SLA sweep endpoint — auth behavior + dry-run (SAFE: never acts)
s, t = req(WWW + '/api/staff-sla-sweep?dryRun=true')
print(f'1) staff-sla-sweep?dryRun=true → HTTP {s}')
print('   body head:', t[:400].replace(chr(10), ' '))

# 2) chat re-timing (2nd probe today — warm check)
t0 = time.time()
s2, t2 = req(WWW + '/api/chat', method='POST', body={
    'message': 'hola, ¿de qué material es el piso deck?',
    'sessionId': 'diag-review-1005c', 'brandId': 'unitec'})
dt = time.time() - t0
print(f'2) chat probe#2: HTTP {s2} in {dt:.1f}s → {t2[:160]}')

# 3) Firestore: escalations audit + interventions + session fields
with open('firebase-applet-config.json', 'rb') as f:
    cfg = json.loads(f.read().decode('utf-8-sig'))
s3, t3 = req(f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={cfg['apiKey']}",
             method='POST', body={'returnSecureToken': True})
tok = json.loads(t3)['idToken']
H = {'Authorization': f'Bearer {tok}'}
fs = f"https://firestore.googleapis.com/v1/projects/{cfg['projectId']}/databases/(default)/documents"


def pv(v):
    for k in ('stringValue', 'integerValue', 'booleanValue', 'doubleValue', 'nullValue'):
        if k in v:
            return v[k]
    if 'arrayValue' in v:
        return [pv(x) for x in v['arrayValue'].get('values', [])]
    if 'mapValue' in v:
        return {k2: pv(v2) for k2, v2 in v['mapValue'].get('fields', {}).items()}
    return None


s4, t4 = req(f'{fs}/escalations?pageSize=5&orderBy=createdAt%20desc', headers=H)
try:
    docs = json.loads(t4).get('documents', []) or []
    print(f'3a) escalations collection: {len(docs)} latest docs')
    for d in docs:
        fld = {k: pv(v) for k, v in d.get('fields', {}).items()}
        print(f"    {fld.get('createdAt')} type={fld.get('type')} delivered={fld.get('delivered')} failed={fld.get('failed')} sess={str(fld.get('sessionId'))[:30]}")
except Exception as e:
    print('3a) escalations query:', t4[:200])

s5, t5 = req(f'{fs}/interventions?pageSize=5&orderBy=requestedAt%20desc', headers=H)
try:
    docs = json.loads(t5).get('documents', []) or []
    print(f'3b) interventions: {len(docs)} latest docs')
    for d in docs:
        fld = {k: pv(v) for k, v in d.get('fields', {}).items()}
        print(f"    {fld.get('requestedAt')} status={fld.get('status')} prio={fld.get('priority')} reason={str(fld.get('reason'))[:60]} sess={str(fld.get('sessionId'))[:30]}")
except Exception as e:
    print('3b) interventions query:', t5[:200])

# 3c) the session that flipped to human_assigned — full field read
sid = 'session_1791184426478_czbh4rw5t'
s6, t6 = req(f'{fs}/conversations/{sid}', headers=H)
try:
    d = json.loads(t6)
    fld = {k: pv(v) for k, v in d.get('fields', {}).items()}
    keep = ['status', 'lastUpdated', 'lastEscalationAt', 'escalationType', 'staffAlertPending', 'slaStage',
            'lastSlaAt', 'staffNoShow', 'staffNudgedAt', 'humanRequestedAt', 'flowStage']
    print('3c) session fields:')
    for k in keep:
        if k in fld:
            print(f'    {k} = {fld[k]}')
    an = fld.get('analytics') or {}
    print('    analytics:', {k: an.get(k) for k in ('escalationCount', 'slaRealerts', 'staffNudges', 'slaBreaches', 'userMessageCount') if k in an})
except Exception as e:
    print('3c) session read err', e, t6[:200])

# 4) cleanup the probe session
s7, _ = req(f'{fs}/conversations/diag-review-1005c', method='DELETE', headers=H)
print('4) cleanup diag-review-1005c ->', s7)
