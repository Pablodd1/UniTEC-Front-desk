#!/usr/bin/env python3
"""store_scan_threaded.py — full-store message search (threaded) + recency map.

Every session in `conversations` is fetched along with its `messages` subcollection, in
parallel, and every doc whose text matches --regex is reported with its full session
transcript. Also prints the sessions whose newest message doc falls on/after --since.

Read-only (anonymous signUp + list/get).
"""
import concurrent.futures as cf
import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CFG = json.loads((REPO / 'firebase-applet-config.json').read_text(encoding='utf-8-sig'))
P, K = CFG['projectId'], CFG['apiKey']
BASE = f'https://firestore.googleapis.com/v1/projects/{P}/databases/(default)/documents'
argv = sys.argv[1:]
REGEX = argv[argv.index('--regex') + 1] if '--regex' in argv else r'atenci[oó]n en miami'
SINCE = argv[argv.index('--since') + 1] if '--since' in argv else '2026-10-13'


def log(*a):
    print(*a, flush=True)


def post(url, payload, token=None):
    h = {'Content-Type': 'application/json'}
    if token:
        h['Authorization'] = f'Bearer {token}'
    with urllib.request.urlopen(urllib.request.Request(url, data=json.dumps(payload).encode(), headers=h), timeout=60) as r:
        return json.load(r)


def get(url, token, tries=3):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'Authorization': f'Bearer {token}'}), timeout=60) as r:
                return json.load(r)
        except Exception:
            if i == tries - 1:
                raise
            import time; time.sleep(1 + i)


def val(v):
    if not isinstance(v, dict):
        return v
    for k in ('stringValue', 'integerValue', 'booleanValue', 'timestampValue', 'doubleValue'):
        if k in v:
            return int(v[k]) if k == 'integerValue' else v[k]
    return None


def fields(doc):
    return {k: val(v) for k, v in (doc.get('fields') or {}).items()}


def doc_id(name):
    return name.rsplit('/', 1)[-1]


def epoch_key(m):
    t = m.get('ts') or ''
    if t and not re.fullmatch(r'\d{10,13}', str(t)):
        try:
            return datetime.fromisoformat(str(t).replace('Z', '+00:00')).timestamp()
        except ValueError:
            pass
    digits = re.sub(r'\D', '', str(t)) or re.sub(r'\D', '', m.get('id') or '')
    return int(digits[:13]) / 1000 if len(digits) >= 13 else 0.0


tok = post(f'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={K}', {'returnSecureToken': True})['idToken']

sessions, page = [], None
while True:
    u = f'{BASE}/conversations?pageSize=300' + (f'&pageToken={urllib.parse.quote(page)}' if page else '')
    d = get(u, tok)
    sessions += [doc_id(x['name']) for x in d.get('documents', [])]
    page = d.get('nextPageToken')
    if not page:
        break
log(f'sessions: {len(sessions)}')

rx = re.compile(REGEX, re.I)
results, recent, errors = [], [], 0


def work(sid):
    try:
        msgs = get(f'{BASE}/conversations/{urllib.parse.quote(sid)}/messages?pageSize=300', tok)
    except Exception as e:  # noqa: BLE001
        return ('err', sid, str(e)[:60], None, None, None)
    parsed = []
    for m in msgs.get('documents', []):
        f = fields(m)
        parsed.append({'id': doc_id(m['name']), 'role': str(f.get('role') or ''),
                       'text': str(f.get('text') or ''), 'ts': str(f.get('timestamp') or '')})
    parsed.sort(key=epoch_key)
    blob = '\n'.join(m['text'] for m in parsed)
    newest = max((m['ts'] for m in parsed), default='')
    hit = bool(rx.search(blob))
    return ('ok', sid, None, parsed, newest, hit)


with cf.ThreadPoolExecutor(max_workers=24) as ex:
    for i, (st, sid, err, parsed, newest, hit) in enumerate(ex.map(work, sessions), 1):
        if st == 'err':
            errors += 1
        else:
            if hit:
                results.append({'id': sid, 'msgs': parsed, 'newest': newest})
            if newest and newest >= SINCE:
                recent.append({'id': sid, 'newest': newest, 'n': len(parsed)})
        if i % 400 == 0:
            log(f'  {i}/{len(sessions)} scanned (hits={len(results)}, recent={len(recent)}, err={errors})')

log(f'\nscanned {len(sessions)} sessions, errors {errors}')
log(f'regex {REGEX!r} hits: {len(results)}')
for h in results:
    log('\n' + '=' * 110)
    log(f'SESSION {h["id"]}  newest_msg={h["newest"]}  docs={len(h["msgs"])}')
    for m in h['msgs']:
        log(f'  [{m["ts"] or "-":<26}] {m["role"]:<5} {m["id"][:30]:<30} {m["text"][:300]}')

log(f'\nsessions with message activity since {SINCE}: {len(recent)}')
for r in sorted(recent, key=lambda x: x['newest'], reverse=True):
    log(f'  {r["id"]:<36} newest={r["newest"]} docs={r["n"]}')

Path(REPO / '.hermes/probes/scan_threaded_out.json').write_text(
    json.dumps({'hits': results, 'recent': recent, 'errors': errors}, ensure_ascii=False, indent=2), encoding='utf-8')
log('\njson -> .hermes/probes/scan_threaded_out.json')
