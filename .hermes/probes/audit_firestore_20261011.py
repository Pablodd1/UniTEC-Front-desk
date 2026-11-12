#!/usr/bin/env python3
"""Read-only Firestore audit of the UniTEC chatbot store (project chatbot-bi-front-desk).

Answers:
  1. Status histogram over ALL conversations + last-24h histogram (by `lastUpdated`).
  2. Real conversations (analytics.userMessageCount >= 1) in last 24h, list up to 10.
  3. Abandonment split (abandoned_at_greeting vs name/phone/profession), with the
     "0 user messages" distinction.
  4. Count of today's new fields: staffNoticeAt, exitAt, exitReason, hiddenAt,
     abandonAlertedAt, analytics.abandonAlerts.
  5. 3 newest real sessions -> dump message docs (role + text[:80] + timestamp).

READ-ONLY: only POST is the anonymous signUp for auth. No writes/PATCH/deletes.
"""
import json, sys, time, urllib.request, urllib.parse
from datetime import datetime, timedelta, timezone

CONFIG = "/home/jasme/UniTEC-Front-desk/firebase-applet-config.json"
PROJECT = "chatbot-bi-front-desk"
BASE = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"

# --- load config with utf-8-sig (BOM) ---
with open(CONFIG, "r", encoding="utf-8-sig") as f:
    cfg = json.load(f)
API_KEY = cfg["apiKey"]
assert API_KEY and not API_KEY.startswith("«"), "apiKey not read correctly"

def req(url, method="GET", body=None):
    headers = {"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"}
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(r, timeout=60) as resp:
        return json.loads(resp.read().decode())

def get_token():
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={API_KEY}"
    body = {"returnSecureToken": True}
    r = urllib.request.Request(url, data=json.dumps(body).encode(),
                               headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(r, timeout=60) as resp:
        return json.loads(resp.read().decode())["idToken"]

TOKEN = get_token()

# --- helpers ---
def sval(field, key):
    f = field.get(key) or {}
    for t in ("stringValue", "integerValue", "doubleValue", "booleanValue", "timestampValue"):
        if t in f:
            return f[t]
    return None

def nested_analytics(fields):
    a = fields.get("analytics", {}).get("mapValue", {}).get("fields", {})
    out = {}
    for k in ("messageCount","userMessageCount","escalationCount","staffInteractions",
              "avgResponseTime","abandonAlerts","slaRealerts","staffNudges","slaBreaches"):
        v = sval(a, k)
        out[k] = v if v is not None else 0
    return out

def parse_iso(s):
    if not s:
        return None
    s = str(s)
    try:
        # handle 'Z' and offsets
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None

TEST_PREFIX = ("diag-", "lat-test-", "verify-", "warm-check-", "secret-verify-",
               "abandon-test-", "staff-test-", "post-fix-check", "analytics-verify-")
def is_test(sid):
    return sid.startswith(TEST_PREFIX)

# --- page the whole conversations collection ---
sessions = []   # list of dicts
page_token = None
pages = 0
while True:
    url = BASE + "/conversations?pageSize=300"
    if page_token:
        url += "&pageToken=" + urllib.parse.quote(page_token)
    d = req(url)
    docs = d.get("documents", [])
    pages += 1
    for doc in docs:
        name = doc["name"].split("/")[-1]
        fields = doc.get("fields", {})
        an = nested_analytics(fields)
        sessions.append({
            "id": name,
            "status": sval(fields, "status") or "",
            "lastUpdated": sval(fields, "lastUpdated") or "",
            "lastMessage": sval(fields, "lastMessage") or "",
            "flowStage": sval(fields, "flowStage") or "",
            "userMessageCount": int(an.get("userMessageCount") or 0),
            "messageCount": int(an.get("messageCount") or 0),
            "analytics": an,
            "has": {k: (sval(fields, k) is not None) for k in
                    ("staffNoticeAt","exitAt","exitReason","hiddenAt","abandonAlertedAt")},
        })
    page_token = d.get("nextPageToken")
    if not page_token:
        break

print(f"PAGES={pages} TOTAL_SESSIONS={len(sessions)}")

# --- 1. status histograms ---
now = datetime.now(timezone.utc)
cutoff = now - timedelta(hours=24)

from collections import Counter
all_hist = Counter(s["status"] or "(none)" for s in sessions)
last24 = [s for s in sessions if (parse_iso(s["lastUpdated"]) or datetime.min.replace(tzinfo=timezone.utc)) >= cutoff]
last24_hist = Counter(s["status"] or "(none)" for s in last24)

print("\n=== 1a. STATUS HISTOGRAM (ALL sessions, incl. test) ===")
for k, v in all_hist.most_common():
    print(f"  {k}: {v}")
print(f"=== 1b. STATUS HISTOGRAM (last 24h by lastUpdated, incl. test) ===  n={len(last24)}")
for k, v in last24_hist.most_common():
    print(f"  {k}: {v}")

# non-test versions
real_all = [s for s in sessions if not is_test(s["id"])]
real_last24 = [s for s in last24 if not is_test(s["id"])]
print(f"--- non-test: all={len(real_all)}  last24={len(real_last24)} ---")
print("=== 1c. STATUS HISTOGRAM (ALL non-test) ===")
for k, v in Counter(s["status"] or "(none)" for s in real_all).most_common():
    print(f"  {k}: {v}")
print(f"=== 1d. STATUS HISTOGRAM (last 24h non-test) === n={len(real_last24)}")
for k, v in Counter(s["status"] or "(none)" for s in real_last24).most_common():
    print(f"  {k}: {v}")

# --- 2. real conversations last 24h ---
real_conv_24 = [s for s in last24 if not is_test(s["id"]) and s["userMessageCount"] >= 1]
real_conv_24.sort(key=lambda s: s["lastUpdated"], reverse=True)
print(f"\n=== 2. REAL CONVERSATIONS (userMessageCount>=1) in last 24h (non-test) === n={len(real_conv_24)}")
for s in real_conv_24[:10]:
    print(f"  {s['id']} | status={s['status']} | lastUpdated={s['lastUpdated']} | lastMessage={s['lastMessage'][:60]!r}")

# --- 3. abandonment split ---
ab = [s for s in sessions if s["status"].startswith("abandoned")]
ab_nt = [s for s in ab if not is_test(s["id"])]
ab_greet = [s for s in ab_nt if s["status"] == "abandoned_at_greeting"]
ab_late = [s for s in ab_nt if s["status"].startswith("abandoned_at_") and s["status"] != "abandoned_at_greeting"]
ab_greet_zero = [s for s in ab_greet if s["userMessageCount"] == 0]
ab_greet_with = [s for s in ab_greet if s["userMessageCount"] >= 1]
print(f"\n=== 3. ABANDONMENT (non-test) ===")
print(f"  total abandoned_*: {len(ab_nt)}  (all incl test: {len(ab)})")
print(f"  abandoned_at_greeting: {len(ab_greet)}  (0 user msgs: {len(ab_greet_zero)} | >=1 user msg: {len(ab_greet_with)})")
for k, v in Counter(s["status"] for s in ab_late).most_common():
    print(f"  {k}: {v}")
print(f"  abandoned name/phone/profession total: {len(ab_late)}")

# --- 4. new fields ---
print("\n=== 4. NEW FIELDS (today's fix) across ALL sessions (incl test) ===")
for k in ("staffNoticeAt","exitAt","exitReason","hiddenAt","abandonAlertedAt"):
    print(f"  {k}: {sum(1 for s in sessions if s['has'][k])}")
print(f"  analytics.abandonAlerts>0: {sum(1 for s in sessions if int(s['analytics'].get('abandonAlerts') or 0) > 0)}")
print("  --- non-test only ---")
for k in ("staffNoticeAt","exitAt","exitReason","hiddenAt","abandonAlertedAt"):
    print(f"  {k}: {sum(1 for s in real_all if s['has'][k])}")
print(f"  analytics.abandonAlerts>0: {sum(1 for s in real_all if int(s['analytics'].get('abandonAlerts') or 0) > 0)}")

# --- 5. 3 newest real sessions -> transcripts ---
real_all.sort(key=lambda s: s["lastUpdated"], reverse=True)
top3 = real_all[:3]
print(f"\n=== 5. 3 NEWEST REAL SESSIONS (non-test, userMessageCount>=1) ===")
for s in top3:
    print(f"\n--- session {s['id']} | status={s['status']} | lastUpdated={s['lastUpdated']} ---")
    url = BASE + f"/conversations/{s['id']}/messages?pageSize=200"
    try:
        md = req(url)
        msgs = md.get("documents", [])
    except Exception as e:
        print(f"  ERROR reading messages: {e}")
        continue
    rows = []
    for m in msgs:
        mf = m.get("fields", {})
        role = sval(mf, "role") or "?"
        text = sval(mf, "text") or sval(mf, "content") or ""
        ts = sval(mf, "timestamp") or sval(mf, "createdAt") or ""
        rows.append((ts, role, text, m["name"].split("/")[-1]))
    # sort by timestamp field (string ISO or numeric) - guard mixed types
    def tkey(r):
        t = r[0]
        if isinstance(t, (int, float)):
            return (0, float(t), "")
        tt = parse_iso(str(t))
        if tt:
            return (1, tt.timestamp(), "")
        return (2, 0, str(t))
    rows.sort(key=tkey)
    for ts, role, text, mid in rows:
        print(f"  [{mid}] {role}: {text[:80]!r}  ts={ts}")

print("\nDONE")
