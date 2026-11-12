#!/usr/bin/env python3
"""
conversation_gap_audit.py — UniTEC Front Desk: ¿qué conversaciones quedaron sin respuesta
y qué turnos NO quedaron guardados?

Responde con datos, no impresiones, a las quejas del cliente:
  1. discontinuidad / mensajes sin respuesta  -> sesiones cuyo ÚLTIMO mensaje es del usuario
  2. interacciones no guardadas               -> ¿hay docs `srv_*` (grabador del servidor)?
  3. peticiones de asesor no monitoreadas     -> status human_requested / human_assigned
  4. material para evaluación                 -> transcripción completa por sesión

Uso:  python3 .hermes/probes/conversation_gap_audit.py [--limit 40] [--json out.json]
Sólo LEE (signUp anónimo + list/get). No escribe ni borra nada.
"""
import json
import re
import sys
from datetime import datetime
import urllib.parse
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CFG = json.loads((REPO / 'firebase-applet-config.json').read_text(encoding='utf-8-sig'))
PROJECT = CFG['projectId']
API_KEY = CFG['apiKey']
BASE = f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents'

argv = sys.argv[1:]
LIMIT = int(argv[argv.index('--limit') + 1]) if '--limit' in argv else 40
OUT = argv[argv.index('--json') + 1] if '--json' in argv else None


def post(url, payload):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(),
                                headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def get(url, token):
    req = urllib.request.Request(url, headers={'Authorization': f'Bearer {token}'})
    with urllib.request.urlopen(req, timeout=30) as r:
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
    """Robust ordering: ISO timestamp when present, else the epoch embedded in the doc id."""
    t = m.get('ts') or ''
    if t and not re.fullmatch(r'\d{10,13}', t):
        try:
            return datetime.fromisoformat(t.replace('Z', '+00:00')).timestamp()
        except ValueError:
            pass
    digits = re.sub(r'\D', '', t) or re.sub(r'\D', '', m.get('id') or '')
    if len(digits) >= 13:
        return int(digits[:13]) / 1000
    return 0.0


def main():
    auth = post(f'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={API_KEY}',
                {'returnSecureToken': True})
    token = auth['idToken']

    # listAllSessions equivalent: page through conversations, then sort by lastUpdated desc
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

    sessions = []
    for d in docs:
        f = fields(d)
        # counters live in the nested `analytics` map (top-level read returns 0 — that cost a wrong
        # conclusion once; never read messageCount at the top level again)
        az = ((d.get('fields', {}).get('analytics') or {}).get('mapValue') or {}).get('fields', {})

        def n(key):
            x = val(az.get(key))
            return int(x) if isinstance(x, (int, float)) else 0

        sessions.append({
            'id': doc_id(d['name']),
            'status': f.get('status') or 'active',
            'lastUpdated': str(f.get('lastUpdated') or ''),
            'messageCount': f.get('messageCount') or 0,
            'userMessageCount': f.get('userMessageCount') or 0,
            'mc': n('messageCount'),
            'umc': n('userMessageCount'),
            'esc': n('escalationCount'),
            'staffN': n('staffInteractions'),
            'avgMs': n('avgResponseTime'),
            'customerPhone': f.get('customerPhone') or '',
            'flowStage': f.get('flowStage') or '',
        })
    sessions.sort(key=lambda s: epoch_key({'ts': s['lastUpdated'], 'id': s['id']}), reverse=True)
    recent = sessions[:LIMIT]

    rows, srv_total, orphan_last_user, no_reply_after_user = [], 0, [], []
    for s in recent:
        try:
            msgs = get(f'{BASE}/conversations/{urllib.parse.quote(s["id"])}/messages?pageSize=200', token)
        except Exception as e:  # noqa: BLE001
            s['error'] = str(e)[:80]
            msgs = {}
        mdocs = msgs.get('documents', [])
        parsed = []
        for m in mdocs:
            mf = fields(m)
            parsed.append({'id': doc_id(m['name']), 'role': str(mf.get('role') or ''),
                           'text': str(mf.get('text') or '')[:400], 'ts': str(mf.get('timestamp') or '')})
        parsed.sort(key=epoch_key)

        def kind(i):
            if i.startswith('srv_'): return 'srv'
            if i.startswith('idle_'): return 'idle'
            if i.startswith(('escalation-', 'handoff-')): return 'sys'
            if i.startswith('msg_'): return 'staff'
            if i == 'welcome': return 'welcome'
            if re.fullmatch(r'\d{10,}', i): return 'client'
            return 'other'

        kinds = {}
        for m in parsed:
            kinds[kind(m['id'])] = kinds.get(kind(m['id']), 0) + 1
        srv = kinds.get('srv', 0)
        srv_total += srv
        users = [m for m in parsed if m['role'] == 'user']
        bots = [m for m in parsed if m['role'] == 'model']
        last_is_user = bool(parsed) and parsed[-1]['role'] == 'user'
        if users and not any(kind(m['id']) in ('srv', 'client', 'staff') for m in bots):
            no_reply_after_user.append(s)
        rows.append({**s, 'docs': len(parsed), 'user_docs': len(users), 'bot_docs': len(bots),
                     'srv_docs': srv, 'kinds': kinds, 'last_role': parsed[-1]['role'] if parsed else '-',
                     'last_is_user': last_is_user,
                     'last_user_text': (users[-1]['text'] if users else ''),
                     'last_bot_text': (bots[-1]['text'] if bots else ''),
                     'last_message_at': parsed[-1]['ts'] if parsed else ''})

    orphan_last_user = [r for r in rows if r['last_is_user']]
    staff_req = [r for r in rows if r['status'] in ('human_requested', 'human_assigned')]
    with_phone = [r for r in rows if r['customerPhone']]
    no_srv = [r for r in rows if r['user_docs'] and r['srv_docs'] == 0]

    print(f'\n=== UniTEC · auditoría de huecos · {len(recent)} sesiones más recientes de {len(sessions)} ===\n')
    print(f'{"sesión":<26} {"status":<16} {"msgs":>4} {"user":>4} {"bot":>3} {"srv":>3}  último   teléfono')
    for r in rows:
        print(f'{r["id"][:26]:<26} {r["status"]:<16} {r["docs"]:>4} {r["user_docs"]:>4} '
              f'{r["bot_docs"]:>3} {r["srv_docs"]:>3}  {r["last_role"]:<7} {r["customerPhone"][:14]}')

    print(f'\n--- resumen ---')
    real_rows = [r for r in sessions if not re.match(r'^(diag|lat-test|analytics-verify|post-fix-check|warm-check|secret-verify|verify|final_|n2_|nancy_|test)', r['id'], re.I)]
    print(f'sesiones totales en el store: {len(sessions)} (reales: {len(real_rows)})')
    print(f'  con interacción real (analytics.messageCount>0): {len([r for r in real_rows if r["mc"] > 0])}')
    print(f'  con texto de CLIENTE (analytics.userMessageCount>0): {len([r for r in real_rows if r["umc"] > 0])}')
    print(f'  con escalamiento registrado (analytics.escalationCount>0): {len([r for r in real_rows if r["esc"] > 0])}')
    print(f'  con actividad de staff registrada (staffInteractions>0): {len([r for r in real_rows if r["staffN"] > 0])}')
    print(f'  con teléfono capturado: {len([r for r in real_rows if r["customerPhone"]])}')
    print(f'sesiones con actividad de usuario en la ventana analizada: {len([r for r in rows if r["user_docs"]])}')
    print(f'docs del grabador del servidor (srv_*): {srv_total}')
    print(f'sesiones con texto de usuario pero CERO docs srv_: {len(no_srv)}')
    print(f'sesiones cuyo ÚLTIMO mensaje es del usuario (sin respuesta): {len(orphan_last_user)}')
    print(f'sesiones HUMAN REQUESTED/ASSIGNED: {len(staff_req)} -> {[ (r["id"][:20], r["status"], r["last_role"]) for r in staff_req ]}')
    print(f'sesiones con teléfono capturado: {len(with_phone)}')
    if no_srv:
        print('\n--- sesiones con texto de usuario sin grabación del servidor ---')
        for r in no_srv[:15]:
            print(f'  {r["id"][:34]:<34} status={r["status"]:<15} docs={r["docs"]:<3} user={r["user_docs"]:<2} '
                  f'msgCount={r["messageCount"]} userMsgCount={r["userMessageCount"]} last="{r["last_user_text"][:60]}"')
    if orphan_last_user:
        print('\n--- el cliente habló último y nadie respondió ---')
        for r in orphan_last_user[:15]:
            print(f'  {r["id"][:34]:<34} status={r["status"]:<15} tel={r["customerPhone"][:14]:<14} '
                  f'srv={r["srv_docs"]} último="{r["last_user_text"][:70]}"')

    if OUT:
        Path(OUT).write_text(json.dumps({'sessions': rows, 'totals': {
            'scanned': len(sessions), 'recent': len(recent), 'srv_docs': srv_total,
            'no_srv_sessions': len(no_srv), 'unanswered_last_user': len(orphan_last_user),
            'staff_requested': len(staff_req)}}, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f'\njson -> {OUT}')


if __name__ == '__main__':
    main()
