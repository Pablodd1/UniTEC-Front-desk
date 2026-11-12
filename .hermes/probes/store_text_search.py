#!/usr/bin/env python3
"""store_text_search.py — exhaustive text search over EVERY message doc in the Firestore store.

Uses a collection-group query on `messages` (allDescendants) paged with limit/offset, so the
result does NOT depend on session date filters or analytics counters. Prints every doc whose
text matches the regex, plus its parent session id, then dumps that session's full transcript.
Read-only.
"""
import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CFG = json.loads((REPO / 'firebase-applet-config.json').read_text(encoding='utf-8-sig'))
PROJECT = CFG['projectId']
API_KEY = CFG['apiKey']
BASE = f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents'

PATTERN = sys.argv[1] if len(sys.argv) > 1 else 'atenci[oó]n en miami'


def log(*a):
    print(*a, flush=True)


def post(url, payload, token=None):
    h = {'Content-Type': 'application/json'}
    if token:
        h['Authorization'] = f'Bearer {token}'
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=h)
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.load(r)


def get(url, token):
    req = urllib.request.Request(url, headers={'Authorization': f'Bearer {token}'})
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.load(r)


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
    if len(digits) >= 13:
        return int(digits[:13]) / 1000
    return 0.0


auth = post(f'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={API_KEY}',
            {'returnSecureToken': True})
token = auth['idToken']

rx = re.compile(PATTERN, re.I)
seen, hits, total = set(), [], 0
offset = 0
PAGE = 300
while True:
    q = {'structuredQuery': {
        'from': [{'collectionId': 'messages', 'allDescendants': True}],
        'limit': PAGE, 'offset': offset}}
    res = post(f'{BASE}:runQuery', q, token)
    docs = [r['document'] for r in res if 'document' in r]
    if not docs:
        break
    for d in docs:
        total += 1
        name = d['name']
        f = fields(d)
        text = str(f.get('text') or '')
        parent = name.split('/documents/')[1].rsplit('/messages/', 1)[0]
        if rx.search(text):
            hits.append({'path': name, 'session': parent, 'id': doc_id(name), 'role': f.get('role'),
                         'text': text, 'ts': str(f.get('timestamp') or '')})
        seen.add(parent)
    offset += PAGE
    if offset % 3000 == 0:
        log(f'  scanned {total} message docs...')
log(f'scanned {total} message docs across {len(seen)} sessions; regex hits: {len(hits)}')

for h in hits:
    log(f'\n  HIT  session={h["session"]}  doc={h["id"]}  role={h["role"]}  ts={h["ts"]}')
    log(f'       text: {h["text"][:400].replace(chr(10), " | ")}')

sessions = sorted({h['session'] for h in hits})
for sid in sessions:
    log('\n' + '=' * 110)
    sdoc = get(f'{BASE}/{sid}', token)
    f = fields(sdoc)
    az = ((sdoc.get('fields', {}).get('analytics') or {}).get('mapValue') or {}).get('fields', {})

    def n(k):
        x = val(az.get(k))
        return int(x) if isinstance(x, (int, float)) else 0
    log(f'SESSION {sid}')
    log(f'  create={sdoc.get("createTime")} update={sdoc.get("updateTime")} status={f.get("status")} '
        f'flowStage={f.get("flowStage")} phone={f.get("customerPhone")} name={f.get("customerName")}')
    log(f'  analytics: msg={n("messageCount")} user={n("userMessageCount")} esc={n("escalationCount")}')
    msgs = get(f'{BASE}/{sid}/messages?pageSize=300', token)
    parsed = [{'id': doc_id(m['name']), **fields(m)} for m in msgs.get('documents', [])]
    parsed = [{'id': p['id'], 'role': str(p.get('role') or ''), 'text': str(p.get('text') or ''),
               'ts': str(p.get('timestamp') or '')} for p in parsed]
    parsed.sort(key=epoch_key)
    log(f'  message docs: {len(parsed)}')
    for m in parsed:
        log(f'  [{m["ts"] or "-":<26}] {m["role"]:<5} {m["id"][:30]:<30} {m["text"][:300].replace(chr(10), " | ")}')

Path(REPO / '.hermes/probes/store_text_hits.json').write_text(
    json.dumps({'pattern': PATTERN, 'docs_scanned': total, 'sessions_scanned': len(seen), 'hits': hits},
               ensure_ascii=False, indent=2), encoding='utf-8')
log('\njson -> .hermes/probes/store_text_hits.json')
