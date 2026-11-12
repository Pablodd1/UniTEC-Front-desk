#!/usr/bin/env python3
# Confirms the one-tap link will actually be SIGNED in production, and that the deployed
# verifier really runs the HMAC comparison (not just a format check).
import json, urllib.request, urllib.error

B = "https://unitec-front-desk.vercel.app"

def call(path, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(B + path, data=data,
                                 headers={"Content-Type": "application/json"} if data else {})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")

# ADMIN_SECRET configured? 401 = set (signing active) · 503 = missing (links would fall back to the login wall)
st, body = call("/api/gemini-key")
print(f"ADMIN_SECRET present (signing active)?  /api/gemini-key -> {st}")
print(f"   body: {body[:160]}")
print("   => 401 means ADMIN_SECRET is set, so staffUrl() signs the alert link.")

# well-formed but wrong signature => the deployed verifier must reject on the HMAC, not the format
st, body = call("/api/staff-enter", {"token": f"{int(__import__('time').time()*1000)+3600000}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
                                     "sessionId": "session_test"})
print(f"\nwell-formed + WRONG signature           staff-enter -> {st}  {body[:160]}")

# ...and the same body WITHOUT a session must not pass either
st, body = call("/api/staff-enter", {"token": "x.y"})
print(f"no sessionId                            staff-enter -> {st}  {body[:160]}")
