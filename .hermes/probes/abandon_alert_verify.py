#!/usr/bin/env python3
# READ-ONLY live verification for the UniTEC alert-link + abandonment complaint.
# Nothing is written. Only GETs against Firestore REST (anon token, same as the server).
import json, re, time, urllib.request, urllib.parse, urllib.error

ROOT = "/home/jasme/UniTEC-Front-desk"
cfg = json.loads(open(f"{ROOT}/firebase-applet-config.json", encoding="utf-8-sig").read())
PID, KEY = cfg["projectId"], cfg["apiKey"]
BASE = f"https://firestore.googleapis.com/v1/projects/{PID}/databases/(default)/documents"

def post(url, body):
    r = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(r, timeout=30).read())

def get(url, token):
    r = urllib.request.Request(url, headers={"Authorization": "Bearer " + token})
    with urllib.request.urlopen(r, timeout=40) as resp:
        return json.loads(resp.read())

def unwrap(v):
    if not isinstance(v, dict): return None
    for k, val in v.items():
        if k == "stringValue": return val
        if k == "integerValue": return int(val)
        if k == "doubleValue": return float(val)
        if k == "booleanValue": return val
        if k == "nullValue": return None
        if k == "timestampValue": return val
        if k == "arrayValue": return [unwrap(x) for x in (val.get("values") or [])]
        if k == "mapValue": return {kk: unwrap(vv) for kk, vv in (val.get("fields") or {}).items()}
    return None

def decode(doc):
    return {k: unwrap(v) for k, v in (doc.get("fields") or {}).items()}

tok = post(f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={KEY}",
           {"returnSecureToken": True})["idToken"]
print("auth ok (project", PID + ")")

# ---------- 1) recent escalations (the alerts the staff received) ----------
print("\n=== 1) ESCALATIONS (most recent 20, id-ordered) ===")
esc, token = [], None
for _ in range(3):
    q = f"{BASE}/escalations?pageSize=300" + (f"&pageToken={token}" if token else "")
    d = get(q, tok)
    esc += [(_decode := decode(x)) | {"_id": x["name"].rsplit("/", 1)[-1]} for x in d.get("documents", [])]
    token = d.get("nextPageToken")
    if not token: break
print("escalations docs:", len(esc))
for e in esc[-12:]:
    print(f"  {str(e.get('createdAt') or '?')[:19]}  type={str(e.get('type')):6}  sess={str(e.get('sessionId') or '')[:34]:34}  "
          f"tel={e.get('customerPhone') or '—'}  delivered={e.get('delivered')}  failed={e.get('failed')}")

# ---------- 2) do those escalation sessions exist, and in what state? ----------
print("\n=== 2) ESCALATION SESSIONS -> conversation doc state ===")
for e in esc[-12:]:
    sid = e.get("sessionId")
    if not sid:
        print("  (no sessionId) —", e.get("_id")); continue
    try:
        doc = decode(get(f"{BASE}/conversations/{urllib.parse.quote(sid)}", tok))
        a = doc.get("analytics") or {}
        print(f"  {sid[:34]:34} EXISTS status={doc.get('status'):16} userMsgs={a.get('userMessageCount')} "
              f"msgs={a.get('messageCount')} name={doc.get('customerName') or '—'} tel={doc.get('customerPhone') or '—'}")
    except urllib.error.HTTPError as ex:
        print(f"  {sid[:34]:34} MISSING (HTTP {ex.code}) — the alert points at a session that is not in the DB")

# ---------- 3) whole-store status histogram + abandonment evidence ----------
print("\n=== 3) SESSIONS: status histogram (paged full scan) ===")
sessions, token = [], None
for _ in range(40):
    q = f"{BASE}/conversations?pageSize=300" + (f"&pageToken={token}" if token else "")
    d = get(q, tok)
    sessions += [decode(x) | {"_id": x["name"].rsplit("/", 1)[-1]} for x in d.get("documents", [])]
    token = d.get("nextPageToken")
    if not token: break
from collections import Counter
hist = Counter(str(s.get("status") or "(none)") for s in sessions)
print("total sessions:", len(sessions))
for k, v in hist.most_common():
    print(f"  {k:22} {v}")

TEST = re.compile(r"^(diag|lat-test|verify|warm-check|secret-verify|post-fix|analytics-verify)")
def is_test(sid): return bool(TEST.match(sid or ""))

ab = [s for s in sessions if str(s.get("status","")).startswith("abandoned") and not is_test(s.get("_id",""))]
print("\nreal abandoned_* sessions:", len(ab))
print("most recent 15 abandoned (what happened when the user left):")
def ts(s): return s.get("lastUpdated") or s.get("createdAt") or ""
def idle_min(s):
    try:
        return round((time.time() - time.mktime(time.strptime(ts(s)[:19], "%Y-%m-%dT%H:%M:%S"))) / 60)
    except Exception: return None
for s in sorted(ab, key=ts)[-15:]:
    a = s.get("analytics") or {}
    print(f"  {s.get('_id','')[:26]:26} status={s.get('status'):24} lastUpd={ts(s)[:19]} "
          f"~{idle_min(s)}m ago  userMsgs={a.get('userMessageCount')} step={s.get('funnelStep') or '—'} "
          f"last='{(str(s.get('lastMessage') or ''))[:40]}'")

# ---------- 4) is the customer phone searchable on the session docs? ----------
have_phone = sum(1 for s in sessions if s.get("customerPhone"))
have_name = sum(1 for s in sessions if s.get("customerName"))
print(f"\n=== 4) identity coverage on session docs: customerPhone={have_phone}/{len(sessions)}  customerName={have_name}/{len(sessions)}")
print("\ndone.")
