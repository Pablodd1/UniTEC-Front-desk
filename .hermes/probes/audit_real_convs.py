#!/usr/bin/env python3
import json, urllib.request, urllib.parse
from collections import Counter
CONFIG = "/home/jasme/UniTEC-Front-desk/firebase-applet-config.json"
PROJECT = "chatbot-bi-front-desk"
BASE = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"
with open(CONFIG, encoding="utf-8-sig") as f:
    cfg = json.load(f)
API_KEY = cfg["apiKey"]
def get_token():
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={API_KEY}"
    r = urllib.request.Request(url, data=json.dumps({"returnSecureToken": True}).encode(),
                               headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(r, timeout=60) as resp:
        return json.loads(resp.read().decode())["idToken"]
TOKEN = get_token()
def req(url):
    r = urllib.request.Request(url, headers={"Authorization": "Bearer " + TOKEN})
    with urllib.request.urlopen(r, timeout=60) as resp:
        return json.loads(resp.read().decode())
def sval(field, key):
    f = field.get(key) or {}
    for t in ("stringValue","integerValue","doubleValue","booleanValue","timestampValue"):
        if t in f: return f[t]
    return None
def an(fields, k):
    a = fields.get("analytics", {}).get("mapValue", {}).get("fields", {})
    v = sval(a, k)
    return int(v) if v is not None else 0

TEST = ("diag-","lat-test-","verify-","warm-check-","secret-verify-","abandon-test-","staff-test-","post-fix-check","analytics-verify-")
def is_test(sid): return sid.startswith(TEST)

sessions = []
pt = None
while True:
    url = BASE + "/conversations?pageSize=300"
    if pt: url += "&pageToken=" + urllib.parse.quote(pt)
    d = req(url)
    for doc in d.get("documents", []):
        f = doc.get("fields", {})
        sessions.append({
            "id": doc["name"].split("/")[-1],
            "status": sval(f,"status") or "",
            "lastUpdated": sval(f,"lastUpdated") or "",
            "lastMessage": sval(f,"lastMessage") or "",
            "umc": an(f,"userMessageCount"),
            "mc": an(f,"messageCount"),
        })
    pt = d.get("nextPageToken")
    if not pt: break

real = [s for s in sessions if not is_test(s["id"]) and s["umc"] >= 1]
real.sort(key=lambda s: s["lastUpdated"], reverse=True)
print(f"TOTAL store-wide sessions with userMessageCount>=1 (non-test): {len(real)}")
print(f"By status:")
for k,v in Counter(s["status"] for s in real).most_common():
    print(f"  {k}: {v}")

print("\n=== NEWEST real sessions (non-test, umc>=1) with message docs ===")
for s in real[:8]:
    print(f"\n--- {s['id']} | status={s['status']} | lastUpdated={s['lastUpdated']} | umc={s['umc']} ---")
    try:
        md = req(BASE + f"/conversations/{s['id']}/messages?pageSize=200")
        msgs = md.get("documents", [])
    except Exception as e:
        print("  ERROR:", e); continue
    if not msgs:
        print("  (no message docs)")
        continue
    rows = []
    for m in msgs:
        mf = m.get("fields", {})
        rows.append((sval(mf,"timestamp") or "", sval(mf,"role") or "?", sval(mf,"text") or "", m["name"].split("/")[-1]))
    rows.sort(key=lambda r: str(r[0]))
    for ts, role, text, mid in rows:
        print(f"  [{mid}] {role}: {text[:70]!r}  ts={ts}")
