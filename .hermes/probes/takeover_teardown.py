#!/usr/bin/env python3
# Removes the two throwaway takeover sessions (messages subcollection FIRST, then the doc) and
# re-reads them to prove they are gone. Test ids only — production conversations untouched.
import json, urllib.request, urllib.error

cfg = json.loads(open("/home/jasme/UniTEC-Front-desk/firebase-applet-config.json", encoding="utf-8-sig").read())
PID, KEY = cfg["projectId"], cfg["apiKey"]
FS = f"https://firestore.googleapis.com/v1/projects/{PID}/databases/(default)/documents"
SIDS = ["verify-takeover-1", "verify-takeover-2"]

tok = json.loads(urllib.request.urlopen(urllib.request.Request(
    f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={KEY}",
    data=json.dumps({"returnSecureToken": True}).encode(),
    headers={"Content-Type": "application/json"}), timeout=30).read())["idToken"]
H = {"Authorization": "Bearer " + tok}

def call(url, method):
    r = urllib.request.Request(url, headers=H, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")[:200]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")[:200]

for sid in SIDS:
    msgs = json.loads(urllib.request.urlopen(urllib.request.Request(
        f"{FS}/conversations/{sid}/messages?pageSize=200", headers=H), timeout=30).read())
    names = [d["name"] for d in msgs.get("documents", [])]
    for n in names:
        st, _ = call("https://firestore.googleapis.com/v1/" + n, "DELETE")
        print(f"  del msg  {n.split('/')[-1]:22} -> {st}")
    st, _ = call(f"{FS}/conversations/{sid}", "DELETE")
    print(f"  del doc  {sid:22} -> {st}")
    st, body = call(f"{FS}/conversations/{sid}", "GET")
    print(f"  re-read  {sid:22} -> {st} (404 = gone)\n")
