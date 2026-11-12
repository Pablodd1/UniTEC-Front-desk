#!/usr/bin/env python3
# READ-ONLY: find the "Maria Lopez / 3243150877" conversation Nancy showed and dump its real transcript,
# to see (a) the takeover-notice loop, (b) whether the volunteered name/phone were ever stored.
import json, urllib.request, urllib.parse

cfg = json.loads(open("/home/jasme/UniTEC-Front-desk/firebase-applet-config.json", encoding="utf-8-sig").read())
PID, KEY = cfg["projectId"], cfg["apiKey"]
BASE = f"https://firestore.googleapis.com/v1/projects/{PID}/databases/(default)/documents"

def post(url, body):
    r = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(r, timeout=30).read())

def get(url, tok):
    r = urllib.request.Request(url, headers={"Authorization": "Bearer " + tok})
    with urllib.request.urlopen(r, timeout=40) as resp:
        return json.loads(resp.read())

def dec(v):
    if not isinstance(v, dict): return None
    for k, x in v.items():
        if k == "stringValue": return x
        if k == "integerValue": return int(x)
        if k == "booleanValue": return x
        if k == "nullValue": return None
        if k == "arrayValue": return [dec(i) for i in (x.get("values") or [])]
        if k == "mapValue": return {kk: dec(vv) for kk, vv in (x.get("fields") or {}).items()}
    return None

tok = post(f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={KEY}", {"returnSecureToken": True})["idToken"]

# 1) recent sessions (lastUpdated desc)
q = {"structuredQuery": {"from": [{"collectionId": "conversations"}],
                         "orderBy": [{"field": {"fieldPath": "lastUpdated"}, "direction": "DESCENDING"}],
                         "limit": 400}}
rows = json.loads(urllib.request.urlopen(urllib.request.Request(
    BASE + ":runQuery", data=json.dumps(q).encode(),
    headers={"Authorization": "Bearer " + tok, "Content-Type": "application/json"}), timeout=40).read())
sessions = [{"id": r["document"]["name"].split("/")[-1],
             "f": {k: dec(v) for k, v in r["document"]["fields"].items()}} for r in rows if r.get("document")]
print("recent sessions scanned:", len(sessions))

def hit(s):
    blob = " ".join(str(s["f"].get(k) or "") for k in ("lastMessage", "lastBody", "customerName", "customerPhone")).lower()
    return "maria" in blob or "3243150877" in blob

found = [s for s in sessions if hit(s)]
print("sessions matching 'maria' / '3243150877':", [(s["id"], s["f"].get("status"), s["f"].get("lastMessage", "")[:60]) for s in found])

# 2) also scan the newest ~40 sessions for ANY conversation whose lastMessage is the takeover notice
NOTICE = "ya está atendiendo esta conversación"
looped = [s for s in sessions[:60] if NOTICE in str(s["f"].get("lastMessage") or "")]
print("\nnewest sessions whose LAST message is the takeover notice:", len(looped))
for s in looped[:10]:
    a = s["f"].get("analytics") or {}
    print(f"  {s['id'][:34]:34} {s['f'].get('status'):16} lastUpd={str(s['f'].get('lastUpdated'))[:19]} "
          f"msgs={a.get('messageCount')} user={a.get('userMessageCount')} name={s['f'].get('customerName') or '—'} tel={s['f'].get('customerPhone') or '—'}")

# 3) full transcript of the first match
if found:
    sid = found[0]["id"]
    msgs = get(f"{BASE}/conversations/{urllib.parse.quote(sid)}/messages?pageSize=200", tok)
    docs = [{"id": d["name"].split("/")[-1], "f": {k: dec(v) for k, v in d["fields"].items()}} for d in msgs.get("documents", [])]
    docs.sort(key=lambda m: str(m["f"].get("timestamp") or ""))
    print(f"\n=== transcript of {sid} ({len(docs)} message docs) ===")
    for m in docs:
        print(f"  [{str(m['f'].get('timestamp'))[11:19]}] {m['f'].get('role'):5} {(m['f'].get('staffName') or ''):8} {str(m['f'].get('text'))[:110]}")
    n = sum(1 for m in docs if NOTICE in str(m["f"].get("text")))
    print(f"\ntakeover-notice docs in this conversation: {n}")
