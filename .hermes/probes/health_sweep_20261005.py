#!/usr/bin/env python3
"""Full live readiness sweep 2026-10-05 — 'is the bot taking clients right now?'"""
import json, urllib.request, urllib.error, time, re

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


print('== 1) core services ==')
for p in ['/api/warm', '/api/health', '/api/system-health', '/api/widget-status']:
    s, t = req(BASE + p)
    print(f'{p}: {s} {t[:160]}')

print('\n== 2) main site + bundle ==')
s, t = req(BASE + '/')
bundles = re.findall(r'assets/index-[A-Za-z0-9_-]+\.js', t)
print('main site:', s, '| bundle:', bundles[:2])

print('\n== 3) served ground data (what the bot answers from) ==')
s, t = req(BASE + '/products.json')
try:
    pj = json.loads(t)
    arr = pj if isinstance(pj, list) else (pj.get('products') or [])
    print('products:', len(arr))
    kit = [x for x in arr if str(x.get('id')) == '14122904']
    print('kit tapones 14122904 present:', bool(kit), '|', (kit[0].get('name', '') if kit else ''))
    nan = [x for x in arr if str(x.get('name', '')).strip().lower() in ('nan', '')]
    print('nan rows:', len(nan))
except Exception as e:
    print('products parse err:', e, t[:150])
s, t = req(BASE + '/price-map.json')
try:
    pm = json.loads(t)
    print('price-map entries:', len(pm) if hasattr(pm, '__len__') else '?',
          '| 14122904 ->', pm.get('14122904') if isinstance(pm, dict) else '?')
except Exception as e:
    print('price-map err:', s, t[:120])

print('\n== 4) anomaly monitor ==')
s, t = req(BASE + '/api/anomalies')
print('anomalies:', s, t[:280])

print('\n== 5) live chat probes (multi-turn, diag session) ==')
sid = 'diag-health-1005'
for msg in [
    'Hola, buenas tardes',
    '¿Cuánto vale el piso deck por unidad?',
    '¿Qué colores tiene la lámina mármol Alaska?',
    '¿Me podrías enviar el catálogo completo?',
]:
    t0 = time.time()
    s, t = req(BASE + '/api/chat', method='POST',
               body={'message': msg, 'sessionId': sid, 'brandId': 'unitec'})
    dt = round(time.time() - t0, 2)
    try:
        r = (json.loads(t) or {}).get('text', '')
    except Exception:
        r = t[:200]
    print(f'  [{dt}s | {s}] Q: {msg}')
    print(f'           A: {r[:330]}')
    time.sleep(1.5)

print('\n== 6) client site widget ==')
s, t = req('https://www.unitecusadesign.com/')
if s:
    refs = [x for x in ['unitec-front-desk', 'chatbuildinginnovation', 'embed=true', 'widget.js', 'chat'] if x in t]
    print('unitecusadesign.com:', s, '| refs found:', refs)
else:
    print('unitecusadesign.com:', s, t[:120])
s, t = req('https://unitec-front-desk.vercel.app/?embed=true&brandId=unitec')
print('embed url:', s, '| has app root:', ('<div id="root">' in t) or ('/assets/index-' in t))

print('\n== 7) Firestore: recording + latest real activity ==')
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


time.sleep(4)
s, t = req(f'{fs}/conversations/{sid}', headers=H)
try:
    fld = {k: pv(v) for k, v in json.loads(t).get('fields', {}).items()}
    an = fld.get('analytics') or {}
    print(f'diag session doc: {s} | mc={an.get("messageCount")} umc={an.get("userMessageCount")} lastUpdated={fld.get("lastUpdated")}')
except Exception:
    print('diag session read:', s, t[:160])

q = {'structuredQuery': {'from': [{'collectionId': 'conversations'}],
     'orderBy': [{'field': {'fieldPath': 'lastUpdated'}, 'direction': 'DESCENDING'}], 'limit': 6}}
s, t = req(f'{fs}:runQuery', method='POST', body=q, headers=H)
try:
    for row in json.loads(t):
        doc = row.get('document')
        if not doc or doc['name'].endswith(sid):
            continue
        fld = {k: pv(v) for k, v in doc.get('fields', {}).items()}
        an = fld.get('analytics') or {}
        print(f"  {doc['name'].split('/')[-1]:30s} {fld.get('lastUpdated')} umc={an.get('userMessageCount')} '{str(fld.get('lastMessage'))[:42]}'")
except Exception as e:
    print('latest list err', e, t[:150])

print('\n== 8) cleanup diag session ==')
s, t = req(f'{fs}/conversations/{sid}/messages?pageSize=100', headers=H)
msgs = []
try:
    msgs = json.loads(t).get('documents', []) or []
except Exception:
    pass
print('messages found:', len(msgs))
for m in msgs:
    req('https://firestore.googleapis.com/v1/' + m['name'], method='DELETE', headers=H)
s, _ = req(f'{fs}/conversations/{sid}', method='DELETE', headers=H)
print('del session:', s)
s, _ = req(f'{fs}/conversations/{sid}', headers=H)
print('re-GET (expect 404):', s)
