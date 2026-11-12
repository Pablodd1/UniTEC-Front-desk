# CTO Review — UniTEC Front Desk (chatbot)

Date: 2026-10-01
Target: `~/UniTEC-Front-desk` @ origin/main `b279423` (local clone was 11 commits behind; pulled before review)
Scope: full repo (client + api/). All checks read-only — no production writes were made.
Model of record: deepseek-flash (Hermes).

---

## VERDICT

The chatbot works and the deploy pipeline is healthy, but the **production security posture has multiple critical, live issues** — the biggest being that the production Firestore database is readable without any authentication, exposing both Telegram bot tokens, the full training data, and every customer conversation. The admin gate is cosmetic (hardcoded credentials in the public JS bundle + a sessionStorage flag). Several endpoints accept unauthenticated writes/notifications that cost money or spam the client.

---

## CRITICAL — fix immediately

### C1. Firestore is wide open — LIVE VERIFIED
- `GET https://firestore.googleapis.com/v1/projects/chatbot-bi-front-desk/databases/(default)/documents/config/main` **without any auth → HTTP 200**. Fields visible: `telegramBotToken` (~46 chars), `telegramBotTokenExtra` (~46), `telegramChatId`, `telegramChatIdExtra`, `trainingData` (4.4 KB system prompt), timestamps, anomaly fields.
- `GET .../documents/conversations?pageSize=1` **without auth → HTTP 200** (customer PII: names, phones, message text).
- `firestore.rules` block: `match /config/main { allow read, write: if true; }` — read verified live; write not tested (avoided modifying prod) but governed by the same line — treat as open.
- Impact: (a) anyone can steal both Telegram bot tokens (client bot + owner's personal bot) → full bot takeover; (b) anyone can tamper with `trainingData` → the bot's answers to real customers can be manipulated (fake prices, scam links); (c) anyone can redirect `telegramChatId` → client alerts intercepted; (d) all customer conversations publicly readable.
- Repro: `curl -s "https://firestore.googleapis.com/v1/projects/chatbot-bi-front-desk/databases/(default)/documents/config/main" | head -c 300`

### C2. Secrets committed to git — `.env.production` is tracked
- Tracked since commit `aa1787e` (2026-07-31), still in HEAD. Contains **real values**: `DEEPGRAM_API_KEY`, `SENT_DM_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `VERCEL_OIDC_TOKEN` (expired). Stripe/Twilio/Gemini/OpenRouter/Groq entries in that file are empty.
- Repo `Pablodd1/UniTEC-Front-desk` is PRIVATE (checked) → reduced blast radius, but: rotate every real key in it, `git rm --cached .env.production`, and add `.env.production` to `.gitignore`.

### C3. `/api/chat` accepts any origin — LIVE VERIFIED
- `POST /api/chat` with `Origin: https://evil.example` → **HTTP 200** and `Access-Control-Allow-Origin: https://evil.example` echoed back. `ALLOWED_ORIGINS` is unset in production, so the origin check is a no-op (fail-open).
- Effect: any website can use the AI (quota drain — the same class of abuse that caused the historical "chatbot not responding" outages), and the attacker-controlled `origin` is used in a **server-side fetch** (`fetch(${origin}/products.json)`) on product queries → SSRF-ish vector + attacker-supplied data injected into the prompt for those sessions.
- Fix: set `ALLOWED_ORIGINS` on Vercel and fail closed; stop using the request Origin for server-side fetches (use the canonical site URL).

### C4. Admin gate is cosmetic
- `components/LoginScreen.tsx` hardcodes `admin@unitecdesign.com` / `UnitecAdmin2026!` in the shipped bundle; login just sets `sessionStorage.unitec_local_admin = 'true'` — trivially bypassable via DevTools, and the password itself is publicly retrievable from the JS.
- `App.tsx` gates the admin dashboard on that flag. Combined with C1, the panel is cosmetic. Rotate the password now; plan a real auth story (the anonymous-auth + open-rules architecture cannot enforce anything).

### C5. Unauthenticated endpoints that spend money / spam the client
- `POST /api/training` — no auth: anyone can rewrite the bot's training pautas for all customers and spam the team's Telegram ("ENTRENAMIENTO ACEPTADO").
- `POST /api/notify-escalation` — no auth, no session verification: fake escalations fire Telegram + email + Twilio SMS + WhatsApp + Sent.dm to 8 staff phone numbers (real money per message, fake leads).
- `GET /api/daily-analytics?force=true` — no auth; bypasses the hour/dedupe gates and sends the full report + Excel to the client's and owner's Telegram.
- `POST /api/record-turn` — no auth (rate limit is in-memory per instance): can pollute the analytics store the client's reports are built from.
- `GET /api/analytics` — public (CORS `*`) and returns customer names and last messages (20 most recent; phone numbers whenever captured).
- Cron endpoints (`lifecycle-sweep`, `ga-visits`, `warm`) lack a `CRON_SECRET`; `SWEEP_KEY` fails open when unset. Use Vercel's standard `CRON_SECRET` Bearer check.

---

## HIGH / MEDIUM

### H1. In-memory rate limiting everywhere (serverless = per-instance)
`/api/chat` (120/min), `/api/record-turn` (120/min) — resets on every cold start and runs per instance. Weak control for cost abuse; pair with C3 fix.

### H2. Analytics semantics stale after the one-step onboarding
`_record-chat-turn.js` derives `funnelStep` from message counts (1st=name, 2nd=phone, 3rd=profession). Since the 1-step onboarding (Sep 18), users no longer see those steps, so funnel labels and "abandonado en 'name'" reports are misleading. Relabel to message milestones or record only explicit stages.

### H3. First-message stale closure (minor bug)
In `ChatTab.tsx`, after `await ensureSession()` the handler still reads the React state `conversationId` (null on the very first message) for `extractCustomerData(...)` and `recordOnboardingTurn(...)` guards — so a name given in the first message can skip the PII save + funnel record. Use `activeSessionId`/`conversationIdRef.current` in those paths. (Server-side recording via /api/chat is unaffected.)

### H4. Failing-open origin checks in legacy endpoints
`notify-email`, `create-payment-link`, `calculate-shipping`, `notify-telegram`, `notify-escalation`, `chat`, `health` all use the `origin || '*'` fallback when ALLOWED_ORIGINS is empty. Fail closed instead (default to the production domains).

---

## LOW / HYGIENE

- Broken submodule gitlink `UniTEC-Front-desk` (mode 160000) committed with no `.gitmodules` — `git rm --cached UniTEC-Front-desk`.
- Helper modules not `_`-prefixed (`anomaly-alert.js`, `turn-text.js`, `telegram-send.js`) become pointless public functions; convention here is `_`-prefix.
- `services/geminiService.ts` starts with `@ts-nocheck` → the "tsc clean" signal doesn't cover it. `getApiKey()` is now dead code (no callers).
- `.firebaserc` points at a suspended project (`gen-lang-client-0316038422`); the live project is `chatbot-bi-front-desk`. Any `firebase deploy` from this repo targets the wrong project.
- `api/chat.js` has a `// force redeploy …` comment; local `.vercel/output` contains stale build artifacts (gitignored; clean up to avoid confusion).
- `tightenReply` silently truncates all AI replies to ≤2-3 sentences / 280 chars (URLs re-appended). Intended per client brief, but cutoff can clip price/quote content — worth a client conversation.
- `/api/anomalies` is public and has no client consumer yet (expected?).

---

## WHAT'S SOLID (verified)

- `/api/gemini-key` still refuses with 401 without `ADMIN_SECRET` (the Sep 2 fix holds — no regression).
- `/api/warm` live: `{firebaseAuth:true, widgetOk:true}`; `/api/system-health` → up; cold-start keep-alive + cron working.
- Server-side recording pipeline (`_record-chat-turn.js`) is the single recorder now; double-write and double-reply issues fixed client-side (`skipFirestore`).
- Single analytics engine (`_analytics-core.js`) consumed consistently by panel/report/cron.
- `tsc --noEmit` passes (twice, after pull); no secrets in client bundle beyond the admin password; mojibake fixes and the greeting-duplication fix are correct.

---

## RECOMMENDED ACTIONS (order)

1. TODAY (user action): rotate Telegram bot tokens (BotFather /revoke → update Vercel env + Firestore fields), Deepgram key, sent.dm key; change the admin password.
2. This week (code, plan-first): Firestore rules lockdown design (config/main read+write closed; conversations read restricted; keep widget writes via server endpoints), set ALLOWED_ORIGINS fail-closed, add CRON_SECRET to cron endpoints, gate admin endpoints (/api/analytics, /api/training, /api/notify-escalation, /api/daily-analytics force) behind ADMIN_SECRET or similar.
3. Git hygiene: remove `.env.production` from tracking + ignore; remove the submodule gitlink; fix `.firebaserc` project.
4. Analytics semantics + stale-closure fix (H2/H3).

## EVIDENCE (repro)

- Firestore unauth read: HTTP 200 (fields list only; secret values never printed).
- `/api/chat` evil-origin test: HTTP 200 + ACAO echo (one "hola" call, sent WITHOUT sessionId → nothing recorded in analytics).
- `/api/gemini-key` no-auth: 401. `/api/warm`: 200 firebaseAuth true. `/api/system-health`: up.
- Repo visibility: PRIVATE. `.env.production`: tracked, same content as HEAD.
- Note: two auxiliary verification commands (token-cache check; report-date fields) hit the terminal consent prompt and timed out — they did NOT run; nothing depends on them.
