#!/usr/bin/env python3
# Is the new front-end actually in the served bundle?
import re, urllib.request

B = "https://unitec-front-desk.vercel.app"

def text(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "unitec-verify"}), timeout=40) as r:
        return r.read().decode("utf-8", "replace")

html = text(B + "/")
js_path = re.search(r"assets/index-[A-Za-z0-9_-]+\.js", html).group(0)
js = text(f"{B}/{js_path}")
print("served bundle:", js_path, f"({len(js)} bytes)")

needles = {
    "StaffReply view (composer placeholder)": "Escribe tu respuesta al cliente",
    "StaffReply header": "Atender conversaci\u00f3n",
    "staff-enter call": "/api/staff-enter",
    "session-exit beacon": "/api/session-exit",
    "Abandoned filter option": "Abandoned",
}
for label, needle in needles.items():
    print(f"  {'FOUND   ' if needle in js else 'MISSING '} {label}")

print("\nbundle contains the new staff/abandon code:", all(n in js for n in needles.values()))
