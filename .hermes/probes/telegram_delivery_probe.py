#!/usr/bin/env python3
# READ-ONLY delivery check: can the configured bot actually reach the configured chats?
# Uses Telegram getChat (sends NOTHING). The bot token is never printed.
import json, urllib.request, urllib.error

cfg = json.loads(open("/home/jasme/UniTEC-Front-desk/firebase-applet-config.json", encoding="utf-8-sig").read())
PID, KEY = cfg["projectId"], cfg["apiKey"]
FS = f"https://firestore.googleapis.com/v1/projects/{PID}/databases/(default)/documents"

tok = json.loads(urllib.request.urlopen(urllib.request.Request(
    f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={KEY}",
    data=json.dumps({"returnSecureToken": True}).encode(),
    headers={"Content-Type": "application/json"}), timeout=30).read())["idToken"]
doc = json.loads(urllib.request.urlopen(urllib.request.Request(
    f"{FS}/config/main", headers={"Authorization": "Bearer " + tok}), timeout=30).read())

def sval(fields, name):
    return ((fields.get(name) or {}).get("stringValue") or "")

F = doc.get("fields", {})
token = sval(F, "telegramBotToken")
chat = sval(F, "telegramChatId")
token_x = sval(F, "telegramBotTokenExtra")
chat_x = sval(F, "telegramChatIdExtra")

def get_chat(tok_, cid, label):
    # token deliberately kept out of any printed string
    url = f"https://api.telegram.org/bot{tok_}/getChat?chat_id={cid}"
    try:
        with urllib.request.urlopen(urllib.request.Request(url), timeout=20) as r:
            data = json.loads(r.read())
        res = data.get("result", {})
        title = res.get("title") or res.get("username") or res.get("first_name") or "(private)"
        print(f"  {label:26} ok={data.get('ok')}  type={res.get('type')}  name={title!r}")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")[:160].replace(tok_, "<token>")
        print(f"  {label:26} FAIL HTTP {e.code}  {body}")
    except Exception as e:
        print(f"  {label:26} FAIL {str(e).replace(tok_, '<token>')[:140]}")

print("=== Telegram reachability (getChat — no message is sent) ===")
print(f"bot token present: {bool(token)} ({len(token)} chars) · chatId present: {bool(chat)} ({len(chat)} chars)")
get_chat(token, chat, "client chat (daily report)")
if token_x and chat_x:
    print(f"extra bot present: {bool(token_x)} ({len(token_x)} chars) · extra chatId: {bool(chat_x)} ({len(chat_x)} chars)")
    get_chat(token_x, chat_x, "owner chat (extra)")
else:
    print("  owner/extra destination: NOT configured")
