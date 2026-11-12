#!/usr/bin/env python3
# Independent smoke test + state cross-check (READ-ONLY except one diag chat probe, which is deleted
# again at the end). Run by the parent agent to verify the delegated reports.
import json, re, time, urllib.request, urllib.error

BASE = "https://unitec-front-desk.vercel.app"
cfg = json.loads(open("/home/jasme/UniTEC-Front-desk/firebase-applet-config.json", encoding="utf-8-sig").read())
PID, KEY = cfg["projectId"], cfg["apiKey"]
FS = f"https://firestore.googleapis.com/v1/projects/{PID}/databases/(default)/documents"
DIAG = f"diag-smoke-{int(time.time())}"

def req(url, data=None, headers=None, method=None, timeout=45):
    r = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    t0 = time.time()
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return resp.status, resp.read().decode("utf-8", "replace"), round(time.time() - t0, 2)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace"), round(time.time() - t0, 2)

print("=== 1) ENDPOINTS ===")
st, body, dt = req(BASE + "/")
hashes = re.findall(r"assets/index-[A-Za-z0-9_-]+\.js", body)
print(f"  GET /                    {st}  {dt}s  bundle={hashes}")
for path in ["/api/health", "/api/warm", "/api/system-health", "/api/widget-status", "/api/gemini-key", "/api/analytics"]:
    st, body, dt = req(BASE + path)
    print(f"  GET {path:24} {st}  {dt}s  {body[:150].replace(chr(10),' ')}")
st, body, dt = req(BASE + "/api/staff-enter?token=bogus&session=session_test")
print(f"  GET /api/staff-enter(bad)   {st}  {body[:90]}")
st, body, dt = req(BASE + "/api/abandon-sweep?dryRun=true")
print(f"  GET /api/abandon-sweep      {st}  {body[:120]}")
st, body, dt = req(BASE + "/api/session-exit",
                   json.dumps({"sessionId": "diag-smoke-1", "reason": "pagehide"}).encode(),
                   {"Content-Type": "application/json"})
print(f"  POST /api/session-exit      {st}  {body[:90]}")

print("\n=== 2) LIVE CHAT PROBE (benign wording, no alert keywords) ===")
st, body, dt = req(BASE + "/api/chat",
                   json.dumps({"message": "hola", "sessionId": DIAG}).encode(),
                   {"Content-Type": "application/json"})
print(f"  POST /api/chat  {st}  {dt}s")
print("  reply:", body[:280].replace("\n", " "))

print("\n=== 3) FIRESTORE STATE ===")
tok = json.loads(urllib.request.urlopen(urllib.request.Request(
    f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={KEY}",
    data=json.dumps({"returnSecureToken": True}).encode(),
    headers={"Content-Type": "application/json"}), timeout=30).read())["idToken"]
H = {"Authorization": "Bearer " + tok, "Content-Type": "application/json"}

def rq(structured):
    r = urllib.request.Request(FS + ":runQuery", data=json.dumps(structured).encode(), headers=H)
    return json.loads(urllib.request.urlopen(r, timeout=60).read())

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

rows = rq({"structuredQuery": {"from": [{"collectionId": "conversations"}],
                               "orderBy": [{"field": {"fieldPath": "lastUpdated"}, "direction": "DESCENDING"}],
                               "limit": 300}})
sessions = [{"id": r["document"]["name"].split("/")[-1],
             "f": {k: dec(v) for k, v in r["document"]["fields"].items()}} for r in rows if r.get("document")]
from collections import Counter
TEST = re.compile(r"^(diag|lat-test|verify|warm-check|secret-verify|post-fix|analytics-verify|abandon-test|staff-test)")
cut = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(time.time() - 86400))
recent = [s for s in sessions if str(s["f"].get("lastUpdated") or "") >= cut]
print(f"  newest-300 window: {len(sessions)} sessions; touched in last 24h: {len(recent)}")
print("  status histogram (newest 300):", dict(Counter(str(s['f'].get('status')) for s in sessions)))
real = [s for s in recent if not TEST.match(s["id"]) and int((s["f"].get("analytics") or {}).get("userMessageCount") or 0) >= 1]
print(f"  REAL conversations in last 24h (userMessageCount>=1, test ids excluded): {len(real)}")
for s in real[:8]:
    print(f"    {s['id'][:34]:34} {str(s['f'].get('status')):16} {str(s['f'].get('lastUpdated'))[:19]} "
          f"um={int((s['f'].get('analytics') or {}).get('userMessageCount') or 0)} last={str(s['f'].get('lastMessage'))[:45]!r}")
NEWFIELDS = ["staffNoticeAt", "exitAt", "exitReason", "hiddenAt", "abandonAlertedAt"]
print("  today's new fields present:", {k: sum(1 for s in sessions if s["f"].get(k)) for k in NEWFIELDS},
      "| analytics.abandonAlerts:", sum(1 for s in sessions if (s["f"].get("analytics") or {}).get("abandonAlerts")))
print("  SLA counters:", {"escalationCount": sum(1 for s in sessions if (s["f"].get("analytics") or {}).get("escalationCount")),
                          "slaRealerts": sum(1 for s in sessions if (s["f"].get("analytics") or {}).get("slaRealerts")),
                          "staffInteractions": sum(1 for s in sessions if (s["f"].get("analytics") or {}).get("staffInteractions"))})

esc = json.loads(urllib.request.urlopen(urllib.request.Request(f"{FS}/escalations?pageSize=100", headers=H), timeout=40).read())
edocs = [{k: dec(v) for k, v in d["fields"].items()} for d in esc.get("documents", [])]
print(f"\n  escalations ({len(edocs)} docs):")
for e in sorted(edocs, key=lambda x: str(x.get("createdAt"))):
    if not e.get("type"): continue
    print(f"    {str(e.get('createdAt'))[:19]} {str(e.get('type')):6} sess={str(e.get('sessionId'))[:30]:30} "
          f"delivered={e.get('delivered')} failed={e.get('failed')}")

print("\n=== 4) CLEANUP of the chat probe ===")
try:
    m = json.loads(urllib.request.urlopen(urllib.request.Request(f"{FS}/conversations/{DIAG}/messages?pageSize=100", headers=H), timeout=30).read())
    for d in m.get("documents", []):
        urllib.request.urlopen(urllib.request.Request("https://firestore.googleapis.com/v1/" + d["name"], headers=H, method="DELETE"), timeout=30)
    urllib.request.urlopen(urllib.request.Request(f"{FS}/conversations/{DIAG}", headers=H, method="DELETE"), timeout=30)
except urllib.error.HTTPError as e:
    print("  cleanup:", e.code)
st, _, _ = req(f"{FS}/conversations/{DIAG}", headers=H)
print(f"  probe session {DIAG} -> re-read {st} (404 = gone)")
