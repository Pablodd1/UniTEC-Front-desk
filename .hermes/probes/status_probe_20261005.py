#!/usr/bin/env python3
"""Live status probe 2026-10-05: analytics + report pipeline + recording."""
import json, urllib.request, urllib.error, datetime, time

BASE = 'https://www.chatbuildinginnovation.us'
UA = {'User-Agent': 'unitec-status-probe/1.0'}


def req(url, method='GET', body=None, headers=None, timeout=40):
    h = dict(UA); h.update(headers or {})
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        h['Content-Type'] = 'application/json'
    r = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return resp.status, resp.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'replace')
    except Exception as e:
        return None, f'EXC: {e}'


now = datetime.datetime.now(datetime.timezone.utc)
bog = now - datetime.timedelta(hours=5)
print(f'== NOW {now:%Y-%m-%d %H:%M} UTC / {bog:%Y-%m-%d %H:%M} Bogota ==')

print('\n== API liveness ==')
for p in ['/api/warm', '/api/health', '/api/system-health']:
    s, t = req(BASE + p)
    print(f'{p}: {s} {t[:160]}')

print('\n== Analytics (last 7 Bogota days) ==')
frm = (bog.date() - datetime.timedelta(days=6)).isoformat()
to = bog.date().isoformat()
s, t = req(f'{BASE}/api/analytics?from={frm}&to={to}')
print(f'GET /api/analytics?from={frm}&to={to}: {s}')
try:
    a = json.loads(t)
    print('kpis:', json.dumps(a.get('kpis', {}))[:500])
    for day in (a.get('byDay') or [])[-7:]:
        print('  byDay:', json.dumps(day)[:160])
    rr = a.get('recentReal') or []
    print('recentReal:', len(rr))
    for r in rr[:6]:
        print('  real:', r.get('sessionId'), '|', r.get('lastUpdated') or r.get('createdAt'),
              '|', str(r.get('lastMessage'))[:70])
except Exception as e:
    print('parse error:', e, t[:300])

# ---------- Firestore ----------
print('\n== Firestore reads (anonymous) ==')
with open('firebase-applet-config.json', 'rb') as f:
    cfg = json.loads(f.read().decode('utf-8-sig'))
proj, key = cfg['projectId'], cfg['apiKey']
s, t = req(f'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={key}',
           method='POST', body={'returnSecureToken': True})
tok = None
try:
    tok = json.loads(t).get('idToken')
    print('anon signup:', s, 'token:', bool(tok))
except Exception as e:
    print('anon signup parse fail:', s, t[:200])

if tok:
    H = {'Authorization': f'Bearer {tok}'}
    fs = f'https://firestore.googleapis.com/v1/projects/{proj}/databases/(default)/documents'

    def pv(v):
        if 'stringValue' in v: return v['stringValue']
        if 'integerValue' in v: return int(v['integerValue'])
        if 'booleanValue' in v: return v['booleanValue']
        if 'doubleValue' in v: return float(v['doubleValue'])
        if 'mapValue' in v: return {k: pv(x) for k, x in v['mapValue'].get('fields', {}).items()}
        if 'arrayValue' in v: return [pv(x) for x in v['arrayValue'].get('values', [])]
        return None

    q = {'structuredQuery': {'from': [{'collectionId': 'conversations'}],
         'orderBy': [{'field': {'fieldPath': 'lastUpdated'}, 'direction': 'DESCENDING'}], 'limit': 12}}
    s, t = req(f'{fs}:runQuery', method='POST', body=q, headers=H)
    print('latest conversations query:', s)
    try:
        n = 0
        for row in json.loads(t):
            doc = row.get('document')
            if not doc:
                continue
            fld = {k: pv(v) for k, v in doc.get('fields', {}).items()}
            an = fld.get('analytics') or {}
            n += 1
            print(f"  {doc['name'].split('/')[-1]:30s} lastUpdated={fld.get('lastUpdated')} "
                  f"status={fld.get('status')} flow={fld.get('flowStage')} "
                  f"umc={an.get('userMessageCount')} mc={an.get('messageCount')} "
                  f"last='{str(fld.get('lastMessage'))[:45]}'")
        print('rows:', n)
    except Exception as e:
        print('conversations parse err:', e, t[:300])

    s, t = req(f'{fs}/config/main', headers=H)
    print('config/main GET:', s)
    try:
        fld = {k: pv(v) for k, v in json.loads(t).get('fields', {}).items()}
        print('  lastAnalyticsReportDate:', fld.get('lastAnalyticsReportDate'))
        print('  googleAnalyticsVisits:', fld.get('googleAnalyticsVisits'))
        td = fld.get('trainingData') or ''
        print('  trainingData: len', len(td), '|', str(td)[:90])
        print('  telegramChatId set:', bool(fld.get('telegramChatId')),
              '| extra set:', bool(fld.get('telegramChatIdExtra')))
    except Exception as e:
        print('config parse err:', e, t[:250])

    # ---- live chat probe (diag session, deleted after) ----
    print('\n== Live chat probe (diag session) ==')
    sid = 'diag-status-1005b'
    s, t = req(BASE + '/api/chat', method='POST',
               body={'message': 'hola, buenas tardes', 'sessionId': sid, 'brandId': 'unitec'})
    print('POST /api/chat:', s, t[:220].replace('\n', ' '))

    time.sleep(5)
    s, t = req(f'{fs}/conversations/{sid}', headers=H)
    print('session doc after chat:', s)
    try:
        fld = {k: pv(v) for k, v in json.loads(t).get('fields', {}).items()}
        an = fld.get('analytics') or {}
        print('  counters:', 'mc=', an.get('messageCount'), 'umc=', an.get('userMessageCount'),
              'lastUpdated=', fld.get('lastUpdated'))
    except Exception:
        pass

    s, t = req(f'{fs}/conversations/{sid}/messages?pageSize=50', headers=H)
    msgs = []
    try:
        msgs = json.loads(t).get('documents', []) or []
        print('messages found:', len(msgs))
    except Exception:
        print('messages list err', s, t[:150])

    for m in msgs:
        s2, _ = req('https://firestore.googleapis.com/v1/' + m['name'], method='DELETE', headers=H)
        print('  del msg:', s2)
    s2, _ = req(f'{fs}/conversations/{sid}', method='DELETE', headers=H)
    print('del session:', s2)
    s3, _ = req(f'{fs}/conversations/{sid}', headers=H)
    print('re-GET session (expect 404):', s3)
