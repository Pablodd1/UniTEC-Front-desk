#!/usr/bin/env python3
"""Live smoke-test of UniTEC front-desk HTTP surface (read-only + 2 safe probes)."""
import json, re, time, urllib.request, urllib.error

BASE = "https://unitec-front-desk.vercel.app"
results = []


def req(method, path, body=None, headers=None, timeout=30):
    url = BASE + path
    data = None
    h = {"User-Agent": "hermes-smoke-probe/1.0", "Accept": "application/json"}
    if headers:
        h.update(headers)
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        h["Content-Type"] = "application/json"
    r = urllib.request.Request(url, data=data, headers=h, method=method)
    t0 = time.time()
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            status = resp.status
            text = resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        status = e.code
        text = e.read().decode("utf-8", "replace")
    except Exception as e:
        return {"path": f"{method} {path}", "status": None, "latency": time.time() - t0,
                "snippet": f"EXC: {type(e).__name__}: {e}"}
    lat = time.time() - t0
    return {"path": f"{method} {path}", "status": status, "latency": lat, "snippet": text[:220].replace("\n", " ")}


def run(label, method, path, body=None):
    r = req(method, path, body)
    r["label"] = label
    results.append(r)
    print(f"[{r['status']}] {label}  ({r['latency']:.2f}s)")
    print(f"    {r['snippet']}")
    return r


# 1. GET / -> bundle hash
r = req("GET", "/", headers={"Accept": "text/html"})
m = re.search(r"assets/(index-[A-Za-z0-9_-]+\.js)", r.get("snippet", ""))
# snippet may be too short to contain script tag; re-fetch full if needed
bundle = None
if not m:
    full = req("GET", "/", headers={"Accept": "text/html"})
    m = re.search(r"assets/(index-[A-Za-z0-9_-]+\.js)", full.get("snippet", ""))
bundle = m.group(1) if m else None
r["label"] = "GET /"
r["bundle"] = bundle
results.append(r)
print(f"[{r['status']}] GET /  bundle={bundle}")

# 2. GET /api/health
run("GET /api/health", "GET", "/api/health")

# 3. GET /api/warm
run("GET /api/warm", "GET", "/api/warm")

# 4. GET /api/system-health
run("GET /api/system-health", "GET", "/api/system-health")

# 5. GET /api/widget-status
run("GET /api/widget-status", "GET", "/api/widget-status")

# 6. GET /api/gemini-key  (MUST be 401)
run("GET /api/gemini-key", "GET", "/api/gemini-key")

# 7. GET /api/analytics
run("GET /api/analytics", "GET", "/api/analytics")

# 8. GET /api/staff-enter?token=bogus&session=session_test (expect 401)
run("GET /api/staff-enter", "GET", "/api/staff-enter?token=bogus&session=session_test")

# 9. GET /api/abandon-sweep?dryRun=true
run("GET /api/abandon-sweep", "GET", "/api/abandon-sweep?dryRun=true")

# 10. POST /api/session-exit
run("POST /api/session-exit", "POST", "/api/session-exit",
    {"sessionId": "diag-smoke-1", "reason": "pagehide"})

# 11. POST /api/chat  (benign Spanish probe)
sid = f"diag-smoke-{int(time.time())}"
r = run("POST /api/chat", "POST", "/api/chat", {"message": "hola", "sessionId": sid})
r["chat_sid"] = sid

print("\n==== SUMMARY ====")
print(f"bundle served: {bundle}")
for r in results:
    print(f"{r.get('path','?'):40s} -> {r['status']}  ({r['latency']:.2f}s)")
print(f"chat sessionId: {sid}")
