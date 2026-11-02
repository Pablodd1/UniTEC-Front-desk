# CTO Review — UniTEC Front Desk (chatbot)

Date: 2026-11-02
Target: `~/UniTEC-Front-desk` @ origin/main `7f727e4` (clean, pulled; only untracked audit artifacts)
Scope: full repo + live prod probes (all read-only; one anonymous Firestore signUp for reads)
Live state sampled: /api/health, /api/analytics, config/main, monitor history, conversations status scan

---

## VERDICT

The bot itself is healthy and the ops stack is significantly better than the Oct 1 review: the 2-hourly chatbot-watch monitor runs reliably, the email rail finally works (Resend with verified domain cedexx.net), CRON_SECRET is applied, escalation dedupe and voice single-flight are in. BUT there is one live service-affecting bug (a customer who asked for a human on Saturday night has been silently abandoned by the SLA ladder, and Nancy now receives a RED alert every 2 hours because of it), the Mission Control push has never succeeded, GA4 is still unconnected, and most of the Oct 1 security findings remain open.

---

## LIVE FINDINGS (verified today)

### L1. SLA ladder orphans night-time escalations → RED-alert loop + abandoned customer (BUG, affects prod)

Verified live:
- Session `session_1793508521136_9mtg8wna8`: real customer, created 2026-11-01T04:48Z (23:48 Bogotá, Sat), last message "Pasto" (their city), escalation at 23:49 Bogotá, status `human_requested`. No phone captured. Still open 30+ hours later.
- `slaStage: null`, `staffNoShow: null` → the ladder NEVER acted on this session.
- Every daytime chatbot-watch run since has status RED (Nov 1 09:00 → Nov 2 07:00 Bogotá), each one sending Telegram to Nancy (chat 8897658040). ~10 red reports and counting, all caused by `escalations.stuck: 1`.

Root cause (code-read, `api/staff-sla-sweep.js`):
1. Quiet hours 21:00–07:00 Bogotá defer everything (line 151).
2. `MAX_AGE_MS = 6 * 60 * 60 * 1000` (line 37): sessions whose `lastUpdated` is >6h old are skipped entirely (line 132 `continue`).
3. An escalation arriving between 21:00 and ~01:00 Bogotá is >6h stale by the time quiet hours end at 07:00 → skipped on every subsequent run, forever. No re-alerts, no customer notice, no `close:unattended_staff`.

Fix (proposed, needs approval): exempt `human_requested`/`human_assigned` sessions from the MAX_AGE skip (they need closure regardless of age), or compute the cap from `waitingSince` (lastEscalationAt) instead of `lastUpdated`. Server-side only, no client change, no UI change.
Operational action today: staff should open that session (Mission Control / staff link) and answer the customer. The initial alert DID fire Saturday 23:49 — one alert went out — everything after was swallowed.

### L2. Mission Control push has NEVER succeeded (integration silently broken)

`config/main.monitor.runs`: `missionControl: {ok: false}` on EVERY run since the monitor went live (Oct 28). The owner asked for MC export; it is failing 100% of the time and nothing surfaces it except the raw history. MC_INGEST_URL / MC_INGEST_TOKEN are either unset or wrong on Vercel. (The daily report still reaches the client via Telegram — that rail is unaffected.)

### L3. GA4 still unconnected → "Visitas Web" shows "sin conectar (GA4)"

`googleAnalyticsVisits` absent from `config/main` (verified). `api/ga-visits.js` needs `GA4_PROPERTY_ID` + `GA_SERVICE_ACCOUNT_JSON` env on Vercel (service account from the client's GA4 property). The code and the 13:00 UTC cron already exist — this is a pure credential gap, owner action.

### L4. Security findings from the Oct 1 CTO review — still open (re-verified today)

- C1 Firestore open: unauth GET `config/main` → 200 (exposes telegramBotToken, telegramBotTokenExtra, chat ids, trainingData, monitor history) and unauth `conversations` list → 200 (customer PII). Not fixed.
- C2 `.env.production` still tracked in git (real DEEPGRAM/SENT_DM/TELEGRAM values). Not fixed.
- C3 `/api/chat` origin check still fail-open when `ALLOWED_ORIGINS` unset (code line 138: echo request origin / wildcard). Not fixed.
- C4 Admin gate still cosmetic: hardcoded `admin@unitecdesign.com` / `UnitecAdmin2026!` in the public bundle + sessionStorage flag. Not fixed.
- C5 unauth endpoints: `/api/training` still has no auth (only CORS header). `/api/daily-analytics?force=true` still has no auth. CRON_SECRET on sweeps: FIXED (applied Oct 28). `/api/analytics`: PII masking shipped (4a91033) — partial.
- H1 in-memory rate limiting: still per-instance (Upstash still pending).

### L5. SEO hygiene still broken (jev-audit "major" findings)

`/robots.txt` serves the SPA shell (HTML, verified today — `public/robots.txt` and `public/sitemap.xml` do not exist). `/products`, `/contact`, `/sitemap.xml` etc. all return the app shell. Fix: ship real `public/robots.txt` + `public/sitemap.xml`, true 404 for unknown paths. Zero risk to the chat.

---

## WHAT'S SOLID (verified today)

- Bot health: `/api/health` healthy (v2.1-styleguard). Chat probes 3/3 passing, p50 ~2.0–2.6s (from monitor runs). Gemini up, voice up, widget healthy, price integrity 0 mismatches (unit mismatches 0).
- Alert channels: Telegram + email + SMS all ALIVE now (channelHealth per run; email fixed with Resend sender chain + cedexx.net verified domain + Reply-To to sales inbox).
- Daily report: `lastAnalyticsReportDate = 2026-11-01` → ran yesterday; client Telegram 8897658040 + owner 7838956683.
- Monitor discipline: runs every 2h on schedule, one run per slot (dedupe works), quiet-hours yellow instead of red, probe sessions excluded from the funnel and from Firestore accumulation.
- Funnel data quality: current KPIs from /api/analytics — total 4681 sessions, 198 real interactions (4.23%), 31 contacts captured, 53 human-assisted, 416 test sessions excluded, avg 5.2 user messages per real conversation.
- Oct 1 H3 (first-message stale closure): current ChatTab uses `conversationIdRef`/`activeSessionId` → appears fixed; confirm with one first-message live test.

---

## UPGRADE OPPORTUNITIES (ranked by value)

1. WhatsApp Business API bot — the #1 competitive gap for the Colombian market. Meta now permits AI agents on the WhatsApp Business Calling API. Big project (Meta approval, number, new endpoints) but it would convert the biggest funnel leak: today every escalation exits to a wa.me link outside the system. Phase 1 (low risk): WhatsApp Cloud API INBOUND webhook = new endpoints only, chat path untouched.
2. Fix L1 + L2 + L3 — small, high urgency (see above).
3. Intent/product-category enrichment (server-side per turn, regex + cheap AI) → powers product-interest analytics below. Never shipped despite being in the Sep 4 audit. New fields only, non-breaking.
4. QA regression harness in GitHub Actions: run the 3 canonical probes (Piso deck, ¿cuánto vale…?, catálogo) + price sheet checks nightly against live, post results to owner Telegram. CI-only, zero prod risk, catches prompt/catalog regressions the same day.
5. CSAT post-conversation: one-tap rating bubble at close (new collection, optional widget change).
6. Customer profiles: re-enable `resolve-customer` once a Firebase service account is provisioned (graceful no-op without it).
7. Upstash Redis rate limiting (cross-instance; current is per-instance in-memory).
8. Voice escalation gap: `CallTab` still doesn't pass its sessionId into the escalation path → a spoken "quiero un asesor" pages nobody. Small fix.
9. Admin auth: gate `/api/analytics`, `/api/training`, `/api/notify-escalation`, force-report behind ADMIN_SECRET; panel sends the token. Medium effort, kills C4/C5.

---

## ANALYTICS THE CLIENT COULD HAVE (beyond the daily report + 2h monitor they already get)

1. Product interest ranking — which products/categories people actually ask about (from last-message intent + productMentions). Drives inventory and marketing. Needs #3 enrichment.
2. Quote funnel — asked price → gave phone → escalated → attended → closed, per week. Today only 31 contacts captured from 198 real conversations (15.7%) — that number is the headline KPI to track and improve.
3. Staff SLA scorecard — median time-to-first-human-response, no-show rate, unattended closures (from escalations + slaStage/staffNoShow fields, already recorded). Client currently has no visibility into whether staff actually answer the alerts.
4. Abandonment heatmap — by step AND by hour of day (Bogotá). Would quantify the 21:00–07:00 leak (the L1 customer is the human face of it).
5. Weekly availability report — from monitor.runs history: chat p50 latency, probe pass rate, channel availability, price integrity. Already measured every 2h; just needs a weekly rollup (small endpoint).
6. Busiest hours / day-of-week — from createdAt; tells the client when staff should actually be watching.

---

## WHAT WE MIGHT BE MISSING (things nobody is currently looking at)

- The RED-alert fatigue loop: Nancy is receiving a red alert every 2h from a single stuck session. The monitor is correct, but until L1 is fixed the client's ops channel is being desensitized.
- 2,361 sessions (50%) with zero messages: the widget creates sessions that never even record the greeting. Worth a focused look at why the greeting/session write doesn't happen for half of all opens — that's a measurement blind spot inside the biggest step of the funnel.
- No voice-escalation path (above) and no CSAT → two silent blind spots in "is the customer actually served?".
- Historic PII junk from the pre-fix onboarding bug (names like "Buenas días dónde están ubicados", phones like "gabriela, 3145259859") still in the store — flag before quoting any customer-list metrics.
- GitHub Actions uptime watchdog is throttled by GitHub on quiet repos (~1 run/8h, not 15 min) — the 2h monitor covers this now; don't promise 15-min uptime coverage to the client.


## STATUS RESUELTO 2026-11-02 (mismo día, por petición "go")

1. BUG ESCALACIÓN NOCTURNA — RESUELTO Y VERIFICADO EN VIVO. commit 9ab3798: human_requested
   exento del cap MAX_AGE. Sesión "Pasto" cerrada por la escalera: alert:3 entregado (200, ok:true,
   UN solo aviso), notice:final, staffNoShow:true, closedBy=unattended_staff. stuck ahora = 0 en
   5.097 sesiones → el monitor deja de reportar rojo. human_assigned conserva el cap (decisión
   pendiente para las ~55 históricas). Regresiones verificadas intactas: dedupe 90s, raíl único
   Twilio, staffAlertSentRef, skipFirestore, idempotencia in_flight.
2. SEO: public/robots.txt + public/sitemap.xml creados (dominio canónico www.chatbuildinginnovation.us).
3. FIRESTORE SECURITY: firestore.rules.v3 (write de config/main → autenticado) PROBADO 12/12 en
   emulador local (firestore+auth). PENDIENTE: que el owner ejecute el deploy (runbook en
   docs/RUNBOOK_FIRESTORE_SECURITY.md). Fase 2 (lectura de PII, auth del widget) documentada.
4. GA4: endpoint y cron ya existían; falta que el cliente genere propiedad + cuenta de servicio.
   Runbook con pasos exactos: docs/RUNBOOK_GA4_VISITS.md.
5. MISSION CONTROL: verificado en vivo — Opción A (pull) OPERATIVA (401 sin token, 200 con token);
   la integración depende del equipo de MC. Opción B necesita MC_INGEST_URL. Runbook:
   docs/RUNBOOK_MISSION_CONTROL.md.
