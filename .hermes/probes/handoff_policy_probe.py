#!/usr/bin/env python3
"""handoff_policy_probe.py — live verification of the 2026-10-15 handoff policy (server side).

POSTs to the DEPLOYED /api/chat with stream:true (the path that carries the brevity cap) and
asserts, per probe:
  · whether the server still flags an escalation (escalation intent detector), and
  · the exact reply text — in particular that the client's LITERAL training macro comes back
    COMPLETE (no '…' cut before "informándonos nombre completo y numero de contacto").
Then reads the Firestore turn docs the server wrote, so the check is against stored data, not
only against the HTTP body.

Read-only for Firestore; the /api/chat calls are ordinary turns on `diag-` sessions (the SLA
sweeps ignore diag-*).
"""
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

API = 'https://unitec-front-desk.vercel.app/api/chat'
REPO = Path(__file__).resolve().parents[2]
CFG = json.loads((REPO / 'firebase-applet-config.json').read_text(encoding='utf-8-sig'))
BASE = f'https://firestore.googleapis.com/v1/projects/{CFG["projectId"]}/databases/(default)/documents'

PROBES = [
    ('diag-hp-loc', 'tienen atencion en miami', False, 'pinned-completo', 'numero de contacto'),
    ('diag-hp-staff', 'Por favor, comunícame con un representante de ventas.', True, '', ''),
    ('diag-hp-price', '¿cuánto vale el piso deck?', False, '', ''),
]


def post_chat(session_id, message):
    body = json.dumps({'message': message, 'sessionId': session_id, 'brandId': 'unitec',
                       'language': 'es', 'stream': True, 'history': []}).encode()
    req = urllib.request.Request(API, data=body, headers={'Content-Type': 'application/json'})
    text, done = '', None
    with urllib.request.urlopen(req, timeout=90) as r:
        for raw in r:
            line = raw.decode('utf-8', 'replace').strip()
            if not line.startswith('data:'):
                continue
            try:
                obj = json.loads(line[5:].strip())
            except json.JSONDecodeError:
                continue
            if isinstance(obj, dict) and obj.get('done'):
                done = obj
                if obj.get('replace'):
                    text = obj['replace']
            elif isinstance(obj, dict) and 'delta' in obj:
                text += obj['delta']
    return text, (done or {})


results = []
for sid, msg, want_esc, css_check, must_contain in PROBES:
    try:
        text, done = post_chat(sid, msg)
    except Exception as e:  # noqa: BLE001
        results.append({'session': sid, 'message': msg, 'error': str(e)[:200]})
        continue
    esc = bool(done.get('escalation') or re.search(r'"escalation"\s*:', json.dumps(done)))
    row = {'session': sid, 'message': msg, 'escalation_expected': want_esc, 'escalation_seen': esc,
           'len': len(text), 'ends_with_ellipsis': text.rstrip().endswith('…'),
           'contains_required': (must_contain in text) if must_contain else None,
           'reply_tail': text[-180:].replace('\n', ' | ')}
    results.append(row)

print('=== /api/chat (deployed) ===')
ok = True
for r in results:
    if 'error' in r:
        ok = False
        print(f"  ERROR {r['session']}: {r['error']}")
        continue
    esc_ok = r['escalation_seen'] == r['escalation_expected']
    css_ok = (r['contains_required'] is not False)
    ok = ok and esc_ok and css_ok
    print(f"  {r['session']:<14} esc want={r['escalation_expected']} got={r['escalation_seen']} "
          f"{'OK' if esc_ok else 'FAIL'}  len={r['len']} ellipsis={r['ends_with_ellipsis']} "
          f"req={r['contains_required']} {'OK' if css_ok else 'FAIL'}")
    print(f"      tail: {r['reply_tail']}")

# ── what the server actually stored for the pinned-macro probe ──
tok = json.load(urllib.request.urlopen(urllib.request.Request(
    f'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={CFG["apiKey"]}',
    data=json.dumps({'returnSecureToken': True}).encode(),
    headers={'Content-Type': 'application/json'})))['idToken']


def get(url):
    return json.load(urllib.request.urlopen(urllib.request.Request(url, headers={'Authorization': f'Bearer {tok}'})))


print('\n=== Firestore turn docs (server recorder) ===')
for sid, *_ in PROBES:
    try:
        docs = get(f'{BASE}/conversations/{urllib.parse.quote(sid)}/messages?pageSize=20').get('documents', [])
    except Exception as e:  # noqa: BLE001
        print(f'  {sid}: read failed {e}')
        continue
    for d in docs:
        f = d.get('fields', {})
        role = (f.get('role') or {}).get('stringValue')
        text = (f.get('text') or {}).get('stringValue', '')
        print(f"  {sid:<14} {d['name'].rsplit('/', 1)[-1]:<24} {role:<5} len={len(text):<4} tail={text[-70:]!r}")

print('\nRESULT:', 'ALL PASS' if ok else 'FAILURES PRESENT')
