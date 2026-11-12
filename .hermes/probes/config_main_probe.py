#!/usr/bin/env python3
# What is the alert/report config actually set to? Prints field NAMES and value lengths only —
# never a token or a chat id.
import json, urllib.request

cfg = json.loads(open("/home/jasme/UniTEC-Front-desk/firebase-applet-config.json", encoding="utf-8-sig").read())
PID, KEY = cfg["projectId"], cfg["apiKey"]
FS = f"https://firestore.googleapis.com/v1/projects/{PID}/databases/(default)/documents"

tok = json.loads(urllib.request.urlopen(urllib.request.Request(
    f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={KEY}",
    data=json.dumps({"returnSecureToken": True}).encode(),
    headers={"Content-Type": "application/json"}), timeout=30).read())["idToken"]
doc = json.loads(urllib.request.urlopen(urllib.request.Request(
    f"{FS}/config/main", headers={"Authorization": "Bearer " + tok}), timeout=30).read())

def dec(v):
    for k, x in v.items():
        if k == "stringValue": return x
        if k == "integerValue": return int(x)
        if k == "booleanValue": return x
        if k == "nullValue": return None
        if k == "arrayValue": return [dec(i) for i in (x.get("values") or [])]
        if k == "mapValue": return {kk: dec(vv) for kk, vv in (x.get("fields") or {}).items()}
    return None

f = {k: dec(v) for k, v in doc.get("fields", {}).items()}
print("=== config/main fields (name -> type/size, values hidden) ===")
for k in sorted(f):
    v = f[k]
    if isinstance(v, str):
        shown = f"{len(v)} chars" if any(t in k.lower() for t in ("token", "secret", "key", "chatid")) else repr(v)[:70]
    else:
        shown = repr(v)[:70]
    print(f"  {k:28} {shown}")

print("\n=== derived ===")
print("  daily report last sent        :", f.get("lastAnalyticsReportDate") or "NEVER RECORDED")
print("  telegram bot token configured :", bool(f.get("telegramBotToken")))
print("  client telegram chat id       :", "yes" if f.get("telegramChatId") else "no")
print("  owner telegram chat (extra)   :", "yes" if f.get("telegramChatIdExtra") else "no")
print("  GA visits stored              :", f.get("googleAnalyticsVisits", "ABSENT (= 'sin dato')"))
