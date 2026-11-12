#!/usr/bin/env python3
import json, urllib.request, urllib.parse
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

sid = "session_1791586929942_72y0qy8ty"
doc = req(BASE + "/conversations/" + sid)
print(json.dumps(doc.get("fields", {}), indent=1, ensure_ascii=False))
msgs = req(BASE + f"/conversations/{sid}/messages?pageSize=200")
print("MESSAGES COUNT:", len(msgs.get("documents", [])))
for m in msgs.get("documents", []):
    mf = m.get("fields", {})
    def sv(k):
        f = mf.get(k) or {}
        for t in ("stringValue","integerValue","doubleValue"):
            if t in f: return f[t]
        return None
    print("  ", m["name"].split("/")[-1], "| role=", sv("role"), "| text=", repr((sv("text") or "")[:60]))
