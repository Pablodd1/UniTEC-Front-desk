#!/usr/bin/env python3
"""escalation_audit.py — every escalation-ack bubble in the store, with the user message that fired it.

Threaded full-store scan (read-only). For each session it pairs each `escalation-ack-*` /
`escalation-*` doc with the user message nearest in time (the turn that triggered it), so the
false-positive keywords are visible as data. Prints a keyword tally and the per-session table.
"""
import concurrent.futures as cf
import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CFG = json.loads((REPO / 'firebase-applet-config.json').read_text(encoding='utf-8-sig'))
P, K = CFG['projectId'], CFG['apiKey']
BASE = f'https://firestore.googleapis.com/v1/projects/{P}/databases/(default)/documents'


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


def doc_id(n):
    return n.rsplit('/', 1)[-1]


def ep(m):
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

KEYWORDS = ['cotiz', 'presupuesto', 'budget', 'quote', 'asesor', 'humano', 'human', 'agent', 'staff', 'llamar',
            'call me', 'speak to someone', 'talk to someone', 'hablar con alguien', 'persona real', 'whatsapp',
            'telefono', 'teléfono', 'contacto', 'atencion', 'atención', 'urgente', 'urgencia', 'emergencia']


def work(sid):
    try:
        msgs = get(f'{BASE}/conversations/{urllib.parse.quote(sid)}/messages?pageSize=300', tok)
    except Exception:
        return None
    parsed = [{'id': doc_id(m['name']), **fields(m)} for m in msgs.get('documents', [])]
    parsed = [{'id': p['id'], 'role': str(p.get('role') or ''), 'text': str(p.get('text') or ''),
               'ts': str(p.get('timestamp') or '')} for p in parsed]
    parsed.sort(key=ep)
    acks = [m for m in parsed if m['id'].startswith(('escalation-ack-', 'escalation-'))]
    if not acks:
        return None
    users = [m for m in parsed if m['role'] == 'user']
    rows = []
    for a in acks:
        ta = ep(a)
        before = [u for u in users if ep(u) <= ta + 1]
        trg = before[-1] if before else None
        rows.append({'ack_ts': a['ts'], 'trigger_text': (trg['text'] if trg else '(none before)')[:200],
                     'trigger_ts': (trg['ts'] if trg else ''), 'n_msgs': len(parsed)})
    return {'id': sid, 'acks': rows, 'first_ts': parsed[0]['ts'] if parsed else '', 'last_ts': parsed[-1]['ts'] if parsed else ''}


out = []
with cf.ThreadPoolExecutor(max_workers=24) as ex:
    for i, r in enumerate(ex.map(work, sessions), 1):
        if r:
            out.append(r)
        if i % 600 == 0:
            log(f'  {i}/{len(sessions)} (sessions with ack: {len(out)})')

kw_tally = {}
for r in out:
    for a in r['acks']:
        low = a['trigger_text'].lower()
        kws = [k for k in KEYWORDS if k in low]
        a['kws'] = kws
        for k in kws:
            kw_tally[k] = kw_tally.get(k, 0) + 1

log(f'\nsessions containing an escalation-ack/ escalation doc: {len(out)}')
log(f'total ack docs: {sum(len(r["acks"]) for r in out)}')
log('keyword tally on triggering user message: ' + json.dumps(dict(sorted(kw_tally.items(), key=lambda x: -x[1])), ensure_ascii=False))

log('\n--- per session ---')
for r in sorted(out, key=lambda x: (x['last_ts'] or ''), reverse=True):
    for a in r['acks']:
        log(f'{r["id"]:<38} ack={a["ack_ts"][:19]} trig="{a["trigger_text"][:90]}" kw={a["kws"]}')

Path(REPO / '.hermes/probes/escalation_ack_audit.json').write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding='utf-8')
log('\njson -> .hermes/probes/escalation_ack_audit.json')
