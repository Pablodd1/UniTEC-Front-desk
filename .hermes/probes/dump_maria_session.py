#!/usr/bin/env python3
# READ-ONLY: why does the session show Anonymous/no phone although the customer typed name+phone?
import json, urllib.request

cfg = json.loads(open("/home/jasme/UniTEC-Front-desk/firebase-applet-config.json", encoding="utf-8-sig").read())
PID, KEY, SID = cfg["projectId"], cfg["apiKey"], "session_1791553254283_0mwcxw7v8"
BASE = f"https://firestore.googleapis.com/v1/projects/{PID}/databases/(default)/documents"

tok = json.loads(urllib.request.urlopen(urllib.request.Request(
    f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={KEY}",
    data=json.dumps({"returnSecureToken": True}).encode(),
    headers={"Content-Type": "application/json"}), timeout=30).read())["idToken"]
doc = json.loads(urllib.request.urlopen(urllib.request.Request(
    f"{BASE}/conversations/{SID}", headers={"Authorization": "Bearer " + tok}), timeout=30).read())
print("session fields:")
for k, v in sorted(doc.get("fields", {}).items()):
    inner = list(v.values())[0]
    print(f"  {k:26} {json.dumps(inner)[:160]}")
