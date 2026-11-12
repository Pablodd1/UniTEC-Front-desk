#!/usr/bin/env python3
# Sets up a THROWAWAY takeover session (id starts with verify- => excluded from every report)
# so the customer-side takeover UX can be exercised for real. Deleted again by teardown script.
import json, time, urllib.request, urllib.error

BASE = "https://unitec-front-desk.vercel.app"
cfg = json.loads(open("/home/jasme/UniTEC-Front-desk/firebase-applet-config.json", encoding="utf-8-sig").read())
PID, KEY = cfg["projectId"], cfg["apiKey"]
FS = f"https://firestore.googleapis.com/v1/projects/{PID}/databases/(default)/documents"
SID = "verify-takeover-1"
WANT = "index-B8mZ2hHp.js"

def req(url, data=None, headers=None, method=None):
    r = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(r, timeout=40) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")

# 1) wait for the new bundle
for i in range(40):
    st, body = req(BASE + "/")
    if WANT in body:
        print(f"bundle LIVE: {WANT} (~{i*5}s)")
        break
    time.sleep(5)
else:
    raise SystemExit("bundle did not flip")

tok = json.loads(urllib.request.urlopen(urllib.request.Request(
    f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={KEY}",
    data=json.dumps({"returnSecureToken": True}).encode(),
    headers={"Content-Type": "application/json"}), timeout=30).read())["idToken"]
H = {"Authorization": "Bearer " + tok, "Content-Type": "application/json"}
now = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())

doc = {"fields": {
    "id": {"stringValue": SID},
    "brandId": {"stringValue": "unitec"},
    "language": {"stringValue": "es"},
    "status": {"stringValue": "human_assigned"},
    "assignedTo": {"stringValue": "staff_001"},
    "createdAt": {"stringValue": now},
    "lastUpdated": {"stringValue": now},
    "source": {"stringValue": "web"},
    "ipAddress": {"stringValue": "unknown"},
    "topics": {"arrayValue": {"values": []}},
    "analytics": {"mapValue": {"fields": {
        "messageCount": {"integerValue": "4"},
        "userMessageCount": {"integerValue": "2"},
        "avgResponseTime": {"integerValue": "0"},
        "escalationCount": {"integerValue": "0"},
        "staffInteractions": {"integerValue": "0"},
        "productMentions": {"arrayValue": {"values": []}},
    }}},
}}
st, body = req(f"{FS}/conversations?documentId={SID}", json.dumps(doc).encode(), H)
print("session doc:", st, body[:400])

# a staff reply already in the transcript, to check the "[Staff] " prefix is gone for the customer
msg = {"fields": {
    "id": {"stringValue": "msg_teststaff1"},
    "role": {"stringValue": "staff"},
    "text": {"stringValue": "Prueba de asesor: este texto no debe salir con prefijo [Staff]"},
    "isStaff": {"booleanValue": True},
    "staffName": {"stringValue": "Nancy"},
    "timestamp": {"stringValue": now},
}}
st, body = req(f"{FS}/conversations/{SID}/messages?documentId=msg_teststaff1", json.dumps(msg).encode(), H)
print("staff msg    :", st, body[:120])
print("\nnow open the widget with localStorage unitec_chat_conversation_id_unitec =", SID)
