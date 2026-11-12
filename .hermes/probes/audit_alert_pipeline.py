#!/usr/bin/env python3
# READ-ONLY audit of the UniTEC alerting pipeline (escalations collection + session SLA effects).
# Never prints the API key. No writes anywhere.
import json, urllib.request, urllib.parse, urllib.error, sys

REPO = "/home/jasme/UniTEC-Front-desk"
PROJECT = "chatbot-bi-front-desk"
DOCS = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"
AUTH = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp"

def load_api_key():
    with open(f"{REPO}/firebase-applet-config.json", encoding="utf-8-sig") as f:
        return json.load(f)["apiKey"]

def http(url, method="GET", body=None, token=None):
    data = None
    headers = {"Content-Type": "application/json"}
    if body is not None:
        data = json.dumps(body).encode()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read().decode()
    return json.loads(raw) if raw else {}

def signup(api_key):
    body = {"returnSecureToken": True}
    res = http(AUTH + f"?key={api_key}", "POST", body)
    return res.get("idToken")

def list_all(collection, token):
    out = []
    page_token = ""
    while True:
        url = f"{DOCS}/{collection}?pageSize=300"
        if page_token:
            url += "&pageToken=" + urllib.parse.quote(page_token)
        data = http(url, token=token)
        out.extend(data.get("documents", []))
        page_token = data.get("nextPageToken", "")
        if not page_token:
            break
    return out

def val(v):
    if v is None or not isinstance(v, dict):
        return None
    if "stringValue" in v: return v["stringValue"]
    if "integerValue" in v: return int(v["integerValue"])
    if "doubleValue" in v: return float(v["doubleValue"])
    if "booleanValue" in v: return v["booleanValue"]
    if "timestampValue" in v: return v["timestampValue"]
    if "nullValue" in v: return None
    if "arrayValue" in v: return [val(x) for x in v["arrayValue"].get("values", [])]
    if "mapValue" in v: return {k: val(x) for k, x in v["mapValue"].get("fields", {}).items()}
    return None

def fields_of(doc):
    return {k: val(v) for k, v in (doc.get("fields") or {}).items()}

def get_doc(path, token):
    url = f"{DOCS}/{path}"
    try:
        return fields_of(http(url, token=token))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise

def agg_count(token, where):
    body = {
        "structuredAggregationQuery": {
            "structuredQuery": {
                "from": [{"collectionId": "conversations"}],
                "where": where,
            },
            "aggregations": [{"count": {}}],
        }
    }
    res = http(f"{DOCS}:runAggregationQuery", "POST", body, token)
    if isinstance(res, list):
        res = res[0] if res else {}
    agg = res.get("result", {}).get("aggregateFields", {})
    first = list(agg.values())[0] if agg else None
    return int(first.get("integerValue", 0)) if isinstance(first, dict) else 0

def main():
    api_key = load_api_key()
    token = signup(api_key)
    if not token:
        print("FATAL: could not mint anonymous token")
        sys.exit(1)

    # ---- 1. escalations collection ----
    esc_docs = list_all("escalations", token)
    print(f"=== escalations collection: {len(esc_docs)} raw docs ===")
    rows = []
    for d in esc_docs:
        f = fields_of(d)
        rows.append((d.get("name", "").split("/")[-1], f))
    # sort by createdAt
    def ts(r):
        t = r[1].get("createdAt") or ""
        return t
    rows.sort(key=ts)

    real = [r for r in rows if r[1].get("type") is not None]
    skipped = [r for r in rows if r[1].get("type") is None]
    print(f"docs with a type (real escalations): {len(real)}")
    print(f"docs with NO type (rules-probe / null): {len(skipped)}  ids={[r[0] for r in skipped]}")
    print()

    print("=== PER-ESCALATION TABLE ===")
    channel_ok = {}
    channel_n = {}
    for did, f in real:
        channels = f.get("channels") or []
        delivered = f.get("delivered") or []
        failed = f.get("failed") or []
        print(f"id={did}")
        print(f"  createdAt={f.get('createdAt')}")
        print(f"  type={f.get('type')}  priority={f.get('priority')}  sessionId={f.get('sessionId')}")
        print(f"  delivered={delivered}")
        print(f"  failed={failed}")
        print(f"  anyDelivered={f.get('anyDelivered')}")
        for c in channels:
            if isinstance(c, dict):
                name = c.get("channel")
                print(f"    channel={name} ok={c.get('ok')} error={c.get('error')!r}")
                if name:
                    channel_n[name] = channel_n.get(name, 0) + 1
                    if c.get("ok"):
                        channel_ok[name] = channel_ok.get(name, 0) + 1
        print()
    print()

    print("=== PER-CHANNEL SUCCESS RATE (from stored channels[] arrays) ===")
    for name in sorted(channel_n):
        ok = channel_ok.get(name, 0)
        n = channel_n[name]
        print(f"  {name}: {ok}/{n} ok  ({100*ok//n if n else 0}%)")
    print()

    # ---- 3. referenced sessions ----
    print("=== REFERENCED SESSIONS ===")
    sessions = {}
    for did, f in real:
        sid = f.get("sessionId")
        if sid and sid not in sessions:
            doc = get_doc(f"conversations/{urllib.parse.quote(sid)}", token)
            sessions[sid] = doc
            if doc is None:
                print(f"  sessionId={sid}  -> MISSING (doc does not exist)  [escalation id={did}]")
            else:
                an = doc.get("analytics") or {}
                print(f"  sessionId={sid}  -> EXISTS  status={doc.get('status')!r}  "
                      f"escalationCount={an.get('escalationCount')} slaRealerts={an.get('slaRealerts')} "
                      f"staffInteractions={an.get('staffInteractions')} staffNoShow={doc.get('staffNoShow')} "
                      f"staffNudgedAt={doc.get('staffNudgedAt')!r}")
    print()

    # ---- 4. SLA counters across ALL sessions ----
    print("=== SLA-RELATED COUNTS ACROSS ALL conversations (aggregation) ===")
    def gt0(path):
        return {"fieldFilter": {"field": {"fieldPath": path}, "op": "GREATER_THAN", "value": {"integerValue": 0}}}
    def eq_true(path):
        return {"fieldFilter": {"field": {"fieldPath": path}, "op": "EQUAL", "value": {"booleanValue": True}}}
    def exists(path):
        return {"unaryFilter": {"op": "IS_NOT_NULL", "field": {"fieldPath": path}}}

    metrics = [
        ("analytics.slaRealerts > 0",        gt0("analytics.slaRealerts")),
        ("analytics.staffInteractions > 0",  gt0("analytics.staffInteractions")),
        ("analytics.escalationCount > 0",    gt0("analytics.escalationCount")),
        ("analytics.staffNudges > 0",        gt0("analytics.staffNudges")),
        ("analytics.slaBreaches > 0",        gt0("analytics.slaBreaches")),
        ("staffNoShow == true",              eq_true("staffNoShow")),
        ("staffNudgedAt exists",             exists("staffNudgedAt")),
    ]
    for label, where in metrics:
        try:
            n = agg_count(token, where)
            print(f"  {label}: {n}")
        except Exception as e:
            print(f"  {label}: ERROR {e}")

if __name__ == "__main__":
    main()
