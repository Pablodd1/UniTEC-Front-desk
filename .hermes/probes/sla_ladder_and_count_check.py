#!/usr/bin/env python3
# 1) Explain the /api/analytics total (4568) vs raw page count (4578) gap.
# 2) Prove the repaired SLA ladder actually PLANS an alert for a waiting customer (dryRun: sends nothing).
#    A synthetic session is created for the check and deleted immediately after.
import json, time, urllib.request, urllib.error, re

BASE = "https://unitec-front-desk.vercel.app"
cfg = json.loads(open("/home/jasme/UniTEC-Front-desk/firebase-applet-config.json", encoding="utf-8-sig").read())
PID, KEY = cfg["projectId"], cfg["apiKey"]
FS = f"https://firestore.googleapis.com/v1/projects/{PID}/databases/(default)/documents"
SID = "session_slaflow_probe_1"
# the exact regex api/_analytics-core.js uses to exclude test sessions from every KPI/report
TEST_ID_RE = re.compile(r"^(diag|lat-test|analytics-verify|post-fix|warm-check|secret-verify|verify-|test-|review-|plan-)", re.I)

def req(url, data=None, headers=None, method=None, timeout=60):
    r = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")

tok = json.loads(urllib.request.urlopen(urllib.request.Request(
    f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={KEY}",
    data=json.dumps({"returnSecureToken": True}).encode(),
    headers={"Content-Type": "application/json"}), timeout=30).read())["idToken"]
H = {"Authorization": "Bearer " + tok, "Content-Type": "application/json"}

# ---------- 1) the count gap ----------
ids, token = [], None
while True:
    url = f"{FS}/conversations?pageSize=300" + (f"&pageToken={token}" if token else "")
    d = json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=H), timeout=60).read())
    ids += [x["name"].split("/")[-1] for x in d.get("documents", [])]
    token = d.get("nextPageToken")
    if not token:
        break
tests = [i for i in ids if TEST_ID_RE.match(i)]
print(f"raw sessions paged           : {len(ids)}")
print(f"excluded as test sessions    : {len(tests)}  -> {sorted(tests)}")
print(f"count /api/analytics reports : {len(ids) - len(tests)}  (KPI 'total' excludes test ids)")
print(f"documented gap               : {len(ids) - 4568}")

# ---------- 2) SLA ladder dry run with a synthetic waiting customer ----------
now = time.time()
iso = lambda t: time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(t))
doc = {"fields": {
    "id": {"stringValue": SID}, "brandId": {"stringValue": "unitec"}, "language": {"stringValue": "es"},
    "status": {"stringValue": "human_requested"},
    "createdAt": {"stringValue": iso(now - 600)}, "lastUpdated": {"stringValue": iso(now)},
    "lastEscalationAt": {"stringValue": iso(now - 240)},   # pidio asesor hace 4 min
    "firstUserMessageAt": {"stringValue": iso(now - 900)},
    "lastMessage": {"stringValue": "necesito un asesor para cotizar"},
    "source": {"stringValue": "web"}, "ipAddress": {"stringValue": "unknown"},
    "topics": {"arrayValue": {"values": []}},
    "analytics": {"mapValue": {"fields": {
        "messageCount": {"integerValue": "4"}, "userMessageCount": {"integerValue": "2"},
        "escalationCount": {"integerValue": "1"}, "staffInteractions": {"integerValue": "0"},
        "avgResponseTime": {"integerValue": "0"}, "productMentions": {"arrayValue": {"values": []}}}}},
}}
print(f"\ncreating synthetic waiting session {SID} (deleted right after) ...")
st, body = req(f"{FS}/conversations?documentId={SID}", json.dumps(doc).encode(), H)
print("  create ->", st)

st, body = req(BASE + "/api/staff-sla-sweep?dryRun=true")
print(f"\nGET /api/staff-sla-sweep?dryRun=true -> {st}")
try:
    plan = json.loads(body)
    mine = [p for p in plan.get("plan", []) if p.get("session") == SID]
    print(f"  scanned={plan.get('scanned')} candidates={plan.get('candidates')} acted={plan.get('acted')}")
    print(f"  planned actions for the waiting session: {mine}")
    print("  LADDER REACHED ITS ALERT STEP:", bool(mine and any(a.startswith('alert:') for a in mine[0].get('actions', []))))
except Exception as e:
    print("  could not parse plan:", body[:200], e)

# ---------- cleanup ----------
msgs = json.loads(urllib.request.urlopen(urllib.request.Request(f"{FS}/conversations/{SID}/messages?pageSize=50", headers=H), timeout=30).read())
for m in msgs.get("documents", []):
    req("https://firestore.googleapis.com/v1/" + m["name"], method="DELETE")
req(f"{FS}/conversations/{SID}", method="DELETE")
st, _ = req(f"{FS}/conversations/{SID}", headers=H)
print(f"\ncleanup: {SID} re-read -> {st} (404 = gone)")
