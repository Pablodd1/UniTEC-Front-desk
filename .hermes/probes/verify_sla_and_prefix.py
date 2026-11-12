#!/usr/bin/env python3
# Verify two delegated claims: (a) how "[Staff] " text got into stored docs, (b) the silent SLA nudge.
import json, urllib.request, urllib.parse

cfg = json.loads(open("/home/jasme/UniTEC-Front-desk/firebase-applet-config.json", encoding="utf-8-sig").read())
PID, KEY = cfg["projectId"], cfg["apiKey"]
FS = f"https://firestore.googleapis.com/v1/projects/{PID}/databases/(default)/documents"

tok = json.loads(urllib.request.urlopen(urllib.request.Request(
    f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={KEY}",
    data=json.dumps({"returnSecureToken": True}).encode(),
    headers={"Content-Type": "application/json"}), timeout=30).read())["idToken"]
H = {"Authorization": "Bearer " + tok, "Content-Type": "application/json"}

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

def rq(q):
    r = urllib.request.Request(FS + ":runQuery", data=json.dumps(q).encode(), headers=H)
    return json.loads(urllib.request.urlopen(r, timeout=60).read())

# sessions carrying staffNudgedAt
rows = rq({"structuredQuery": {
    "from": [{"collectionId": "conversations"}],
    "where": {"fieldFilter": {"field": {"fieldPath": "staffNudgedAt"}, "op": "GREATER_THAN_OR_EQUAL",
                               "value": {"stringValue": "2000-01-01"}}},
    "limit": 50}})
nudged = [{"id": r["document"]["name"].split("/")[-1],
           "f": {k: dec(v) for k, v in r["document"]["fields"].items()}} for r in rows if r.get("document")]
print(f"=== sessions with staffNudgedAt: {len(nudged)} ===")
for s in nudged:
    a = s["f"].get("analytics") or {}
    print(f"  {s['id'][:34]:34} {str(s['f'].get('status')):16} nudgedAt={str(s['f'].get('staffNudgedAt'))[:19]} "
          f"staffNudges={a.get('staffNudges')} slaRealerts={a.get('slaRealerts')} lastUpd={str(s['f'].get('lastUpdated'))[:19]}")

# esc counts
esc = json.loads(urllib.request.urlopen(urllib.request.Request(f"{FS}/escalations?pageSize=100", headers=H), timeout=40).read())
types = {}
for d in esc.get("documents", []):
    t = str(dec(d["fields"].get("type")))
    types[t] = types.get(t, 0) + 1
print("\nescalations by type:", types, "(no 'sla' entry => the nudge never reached the handler)")

# inspect the newest nudged session's transcript for staff-prefix vs role=staff
if nudged:
    sid = sorted(nudged, key=lambda s: str(s["f"].get("lastUpdated")))[-1]["id"]
    m = json.loads(urllib.request.urlopen(urllib.request.Request(
        f"{FS}/conversations/{urllib.parse.quote(sid)}/messages?pageSize=200", headers=H), timeout=40).read())
    docs = [{k: dec(v) for k, v in d["fields"].items()} for d in m.get("documents", [])]
    role_staff = [d for d in docs if d.get("role") == "staff"]
    prefixed = [d for d in docs if str(d.get("text") or "").startswith("[Staff] ")]
    print(f"\nnewest nudged session {sid}: {len(docs)} docs | role='staff': {len(role_staff)} | text starts '[Staff] ': {len(prefixed)}")
    for d in prefixed:
        print(f"    role={d.get('role')} id={d.get('id')} {str(d.get('timestamp'))[:19]} {str(d.get('text'))[:60]!r}")
    for d in role_staff[:5]:
        print(f"    role=staff id={d.get('id')} {str(d.get('text'))[:60]!r}")
