#!/usr/bin/env python3
# Checks what the takeover test actually persisted.
import json, urllib.request

cfg = json.loads(open("/home/jasme/UniTEC-Front-desk/firebase-applet-config.json", encoding="utf-8-sig").read())
PID, KEY, SID = cfg["projectId"], cfg["apiKey"], "verify-takeover-1"
FS = f"https://firestore.googleapis.com/v1/projects/{PID}/databases/(default)/documents"

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

tok = json.loads(urllib.request.urlopen(urllib.request.Request(
    f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={KEY}",
    data=json.dumps({"returnSecureToken": True}).encode(),
    headers={"Content-Type": "application/json"}), timeout=30).read())["idToken"]
H = {"Authorization": "Bearer " + tok}
g = lambda u: json.loads(urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=40).read())

doc = g(f"{FS}/conversations/{SID}")
f = {k: dec(v) for k, v in doc["fields"].items()}
print("=== session doc after the takeover test ===")
for k in ("status", "staffNoticeAt", "customerName", "customerPhone", "lastMessage"):
    print(f"  {k:16} {f.get(k)!r}")
print(f"  analytics        {f.get('analytics')}")

msgs = g(f"{FS}/conversations/{SID}/messages?pageSize=200")
docs = [{kk: dec(vv) for kk, vv in d["fields"].items()} for d in msgs.get("documents", [])]
docs.sort(key=lambda m: str(m.get("timestamp") or ""))
NOTICE = "ya está atendiendo esta conversación"
print(f"\n=== {len(docs)} message docs ===")
for m in docs:
    print(f"  {str(m.get('role')):5} {str(m.get('text'))[:95]}")
print("\nprefixed '[Staff] ' messages :", sum(1 for m in docs if str(m.get("text") or "").startswith("[Staff] ")))
print("takeover-notice docs        :", sum(1 for m in docs if NOTICE in str(m.get("text") or "")))
