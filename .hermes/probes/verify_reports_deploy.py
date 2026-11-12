#!/usr/bin/env python3
# Post-deploy: the touched endpoints still behave, and the GA/report pending state is pinned down.
import json, urllib.request, urllib.error

BASE = "https://unitec-front-desk.vercel.app"

def call(path, timeout=60):
    try:
        with urllib.request.urlopen(urllib.request.Request(BASE + path), timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")

for path in ["/api/daily-analytics", "/api/ga-visits", "/api/health", "/api/warm",
             "/api/system-health", "/api/abandon-sweep?dryRun=true", "/api/staff-sla-sweep?dryRun=true"]:
    st, body = call(path)
    print(f"{path:36} {st}  {body[:150].replace(chr(10), ' ')}")
