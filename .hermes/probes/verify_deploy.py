#!/usr/bin/env python3
# Post-deploy verification: bundle hash flip + the three new endpoints.
import json, time, urllib.request, urllib.error

BASE = "https://unitec-front-desk.vercel.app"
WANT = "index-CLz014BI.js"

def get(url, data=None, headers=None, method=None):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")

# 1) wait for the new bundle
print("waiting for bundle", WANT)
ok = False
for i in range(40):
    st, body = get(BASE + "/")
    if WANT in body:
        print(f"  bundle LIVE after ~{i*5}s (status {st})")
        ok = True
        break
    time.sleep(5)
if not ok:
    st, body = get(BASE + "/")
    import re
    print("  NOT flipped yet; serving:", re.findall(r"assets/index-[A-Za-z0-9_-]+\.js", body))
    raise SystemExit(1)

# 2) staff-enter must reject unsigned / wrong tokens
st, body = get(BASE + "/api/staff-enter?token=bogus&session=session_test", method="GET")
print(f"\nstaff-enter bad token      -> {st}  {body[:140]}")
st, body = get(BASE + "/api/staff-enter", data=json.dumps({"token": "x", "sessionId": "session_test"}).encode(),
               headers={"Content-Type": "application/json"})
print(f"staff-enter malformed      -> {st}  {body[:140]}")

# 3) abandon-sweep dry run (must write/send nothing)
st, body = get(BASE + "/api/abandon-sweep?dryRun=true")
print(f"\nabandon-sweep dryRun       -> {st}  {body[:400]}")

# 3b) staff-SLA sweep dry run: same scan, no sends/writes. Must not 500 after the in-process refactor.
st, body = get(BASE + "/api/staff-sla-sweep?dryRun=true")
print(f"\nstaff-sla-sweep dryRun     -> {st}  {body[:400]}")

# 4) session-exit must ignore test ids and never 500
st, body = get(BASE + "/api/session-exit", data=json.dumps({"sessionId": "verify-probe-1", "reason": "pagehide"}).encode(),
               headers={"Content-Type": "application/json"})
print(f"\nsession-exit test id       -> {st}  {body[:200]}")
st, body = get(BASE + "/api/session-exit", data=json.dumps({"sessionId": "nope/missing", "reason": "pagehide"}).encode(),
               headers={"Content-Type": "application/json"})
print(f"session-exit bad id        -> {st}  {body[:200]}")

# 5) the old unsigned admin link still serves the app shell (fallback path intact)
st, body = get(BASE + "/?admin=true&session=session_1791553254283_0mwcxw7v8")
print(f"\nlegacy admin link          -> {st}  shell={('<div id=\"root\"' in body) or ('id=\"root\"' in body)}")
print("\ndone.")
