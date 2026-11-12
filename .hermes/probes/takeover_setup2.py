#!/usr/bin/env python3
# Second throwaway takeover session — deliberately with NO advisor message, so the "brief ack"
# branch is not suppressed by the staff-just-wrote guard. Proves the customer is acknowledged
# instead of hearing the same paragraph again.
import json, time, urllib.request

cfg = json.loads(open("/home/jasme/UniTEC-Front-desk/firebase-applet-config.json", encoding="utf-8-sig").read())
PID, KEY = cfg["projectId"], cfg["apiKey"]
FS = f"https://firestore.googleapis.com/v1/projects/{PID}/databases/(default)/documents"
SID = "verify-takeover-2"

tok = json.loads(urllib.request.urlopen(urllib.request.Request(
    f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={KEY}",
    data=json.dumps({"returnSecureToken": True}).encode(),
    headers={"Content-Type": "application/json"}), timeout=30).read())["idToken"]
H = {"Authorization": "Bearer " + tok, "Content-Type": "application/json"}
now = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
doc = {"fields": {
    "id": {"stringValue": SID}, "brandId": {"stringValue": "unitec"}, "language": {"stringValue": "es"},
    "status": {"stringValue": "human_assigned"}, "assignedTo": {"stringValue": "staff_001"},
    "createdAt": {"stringValue": now}, "lastUpdated": {"stringValue": now}, "source": {"stringValue": "web"},
    "topics": {"arrayValue": {"values": []}},
    "analytics": {"mapValue": {"fields": {
        "messageCount": {"integerValue": "1"}, "userMessageCount": {"integerValue": "1"},
        "avgResponseTime": {"integerValue": "0"}, "escalationCount": {"integerValue": "0"},
        "staffInteractions": {"integerValue": "0"}, "productMentions": {"arrayValue": {"values": []}}}}},
}}
r = urllib.request.urlopen(urllib.request.Request(f"{FS}/conversations?documentId={SID}",
    data=json.dumps(doc).encode(), headers=H), timeout=30)
print("created", SID, r.status)
