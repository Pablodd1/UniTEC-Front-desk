#!/usr/bin/env python3
# Server-only deploy verification: the bundle hash does NOT change, so prove the deploy by the
# deleted route disappearing + the touched endpoints still behaving.
import json, time, urllib.request, urllib.error

BASE = "https://unitec-front-desk.vercel.app"

def call(path, payload=None, method=None, timeout=40):
    data = json.dumps(payload).encode() if payload is not None else None
    hdr = {"Content-Type": "application/json"} if data else {}
    req = urllib.request.Request(BASE + path, data=data, headers=hdr, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace")[:200]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")[:200]

print("waiting for the Sent.dm endpoint to disappear (POST /api/notify-whatsapp must become 404)...")
ok = False
for i in range(30):
    st, body = call("/api/notify-whatsapp", {})
    if st == 404:
        print(f"  -> 404 after ~{i*5}s  (deployment is live, endpoint removed)")
        ok = True
        break
    time.sleep(5)
if not ok:
    print(f"  still {st} after 150s — deploy may not have landed yet: {body}")

print("\n=== still-healthy checks ===")
for path in ["/api/health", "/api/warm", "/api/system-health", "/api/gemini-key", "/api/abandon-sweep?dryRun=true", "/api/staff-sla-sweep?dryRun=true"]:
    st, body = call(path)
    print(f"  GET {path:36} {st}  {body[:110]}")

st, body = call("/api/staff-enter?token=x&session=session_test")
print(f"  GET /api/staff-enter                       {st}  {body[:80]}")
st, body = call("/")
print(f"  GET /                                      {st}  bundle={__import__('re').findall(r'assets/index-[A-Za-z0-9_-]+\\.js', body)}")
