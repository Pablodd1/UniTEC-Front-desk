#!/usr/bin/env python3
"""find_miami_session.py — locate the real session where a customer asked about a Miami office.

Read-only. Pages ALL conversations, then fetches messages ONLY for sessions that had real
customer text (analytics.userMessageCount>0) and were updated on/after --since.
Prints the full chronological transcript for every hit.
"""
import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CFG = json.loads((REPO / 'firebase-applet-config.json').read_text(encoding='utf-8-sig'))
PROJECT = CFG['projectId']
API_KEY = CFG['apiKey']
BASE = f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents'

argv = sys.argv[1:]
TERMS = [t.lower() for t in (argv[argv.index('--terms') + 1].split(',') if '--terms' in argv else ['miami'])]
SINCE = argv[argv.index('--since') + 1] if '--since' in argv else '2026-10-01'


def log(*a):
    print(*a, flush=True)


def post(url, payload):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(),
                                headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def get(url, token):
    req = urllib.request.Request(url, headers={'Authorization': f'Bearer {token}'})
    with urllib.request.urlopen(req, timeout=60) as r:
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


def kind(i):
    if i.startswith('srv_'): return 'srv'
    if i.startswith('idle_'): return 'idle'
    if i.startswith(('escalation-', 'handoff-')): return 'sys'
    if i.startswith('msg_'): return 'staff'
    if i == 'welcome': return 'welcome'
    if re.fullmatch(r'\d{10,}', i): return 'client'
    return 'other'


auth = post(f'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={API_KEY}',
            {'returnSecureToken': True})
token = auth['idToken']

docs, page = [], None
while True:
    url = f'{BASE}/conversations?pageSize=300'
    if page:
        url += f'&pageToken={urllib.parse.quote(page)}'
    data = get(url, token)
    docs.extend(data.get('documents', []))
    page = data.get('nextPageToken')
    if not page:
        break
log(f'total sessions in store: {len(docs)}')

cand = []
for d in docs:
    sid = doc_id(d['name'])
    if re.match(r'^(diag|lat-test|analytics-verify|post-fix-check|warm-check|secret-verify|verify|final_|n2_|nancy_|test|probe|miami)', sid, re.I):
        continue
    f = fields(d)
    az = ((d.get('fields', {}).get('analytics') or {}).get('mapValue') or {}).get('fields', {})

    def n(k):
        x = val(az.get(k))
        return int(x) if isinstance(x, (int, float)) else 0
    upd = d.get('updateTime') or ''
    if (n('userMessageCount') > 0 or '--nogate' in argv) and upd >= SINCE:
        cand.append({'id': sid, 'upd': upd, 'fields': f, 'umc': n('userMessageCount'), 'esc': n('escalationCount'),
                     'mc': n('messageCount')})
cand.sort(key=lambda c: c['upd'], reverse=True)
log(f'candidates since {SINCE} with real customer text: {len(cand)}')

hits = []
scanned = 0
for c in cand:
    sid = c['id']
    try:
        msgs = get(f'{BASE}/conversations/{urllib.parse.quote(sid)}/messages?pageSize=300', token)
    except Exception as e:  # noqa: BLE001
        log(f'  ! {sid}: {e}')
        continue
    scanned += 1
    parsed = []
    for m in msgs.get('documents', []):
        mf = fields(m)
        parsed.append({'id': doc_id(m['name']), 'role': str(mf.get('role') or ''),
                       'text': str(mf.get('text') or ''), 'ts': str(mf.get('timestamp') or '')})
    parsed.sort(key=epoch_key)
    blob = '\n'.join(m['text'].lower() for m in parsed)
    if any(t in blob for t in TERMS):
        hits.append({**{k: c[k] for k in ('id', 'upd', 'umc', 'esc', 'mc')},
                     'status': c['fields'].get('status'), 'flowStage': c['fields'].get('flowStage'),
                     'phone': c['fields'].get('customerPhone') or '', 'msgs': parsed})
    if scanned % 25 == 0:
        log(f'  ...scanned {scanned}/{len(cand)} (hits={len(hits)})')

log(f'\nhits containing {TERMS}: {len(hits)}')
for h in hits:
    log('\n' + '=' * 100)
    log(f'SESSION {h["id"]}  status={h["status"]}  flowStage={h["flowStage"]}  phone={h["phone"]}')
    log(f'  updated={h["upd"]}  analytics: messageCount={h["mc"]} userMessageCount={h["umc"]} escalationCount={h["esc"]}')
    log(f'  docs: {len(h["msgs"])}')
    for m in h['msgs']:
        t = m['text'].replace('\n', ' | ')
        log(f'  [{m["ts"] or "-":<26}] {kind(m["id"]):<7} {m["role"]:<5} {m["id"][:30]:<30} {t[:320]}')

Path(REPO / '.hermes/probes/miami_hits.json').write_text(
    json.dumps(hits, ensure_ascii=False, indent=2), encoding='utf-8')
log('\njson -> .hermes/probes/miami_hits.json')
