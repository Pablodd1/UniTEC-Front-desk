# CTO REPORT — UniTEC Front Desk Chatbot: Analytics, Incoming-User Data & Dashboard Data Analysis Page

**Date:** 2026-09-04 · **Auditor:** Hermes (CTO review) · **System:** https://unitec-front-desk.vercel.app (Vercel) · **Data store:** Firebase project `chatbot-bi-front-desk` (Firestore, root `conversations/` collection)

**Request:** Client (dashboard user) reports the data-analysis page is (1) missing information and (2) it is hard to find the people who requested things (quote / contact / catalog) — i.e., identify them and search them. Verify incoming-user tracking, the study of those users, cold-start behavior, and any misunderstanding; report findings and recommendations.

---

## 1. Executive Summary

The chat pipeline is **functionally healthy** (API up, keys valid, warm path OK, end-to-end chat works, server-side recording verified live). The client's complaints are **confirmed and root-caused**, and they are **data-model problems, not a cold-start problem**:

1. **The analytics dashboards are empty because the fields they display are never written.** Across the entire database (2,672 sessions), `intentCategory`, `sentimentScore`, and `topics` are populated on **0 sessions**; `customerName` on only **41 (1.5%)**, `customerPhone` on **25**, `customerEmail` on **0**. The server-side recorder (`recordChatTurn` in `/api/chat`) saves only message text + counters — it never performs the enrichment the dashboard and reports assume exist.
2. **"Hard to find those who requested stuff" is a search/identity gap.** There is **no search box on the Analytics page** (only month/day/time filters), and the Monitor's search matches only `customerName` / `lastMessage`, not phone, email, or transcript text. Because names/phones are captured on ~1.5% of sessions, quote requesters are effectively invisible/unnamed.
3. **Funnel and conversion numbers are structurally wrong.** 1,088 of 2,672 sessions (40%) are "welcome-only" (messageCount=1, zero user messages) yet are counted as started chats; only **87 sessions (3.3%) in the whole database ever contain a real user message**. 99.4% of sessions sit in `status=active` forever — sessions are never closed/abandoned server-side, so AHT, conversion, abandonment, and completion metrics are ~0 or meaningless.
4. **A double-recording race exists:** both the client SDK (`addMessage` in ChatTab's FULL-MEMORY effect) and the server (`recordChatTurn`) write the same turns to the same session with different IDs — verified duplicated message docs (epoch IDs + `srv_*` IDs with identical text) in recent real conversations, inflating message counts inconsistently.
5. **The daily analytics report has never auto-fired** — a timezone bug makes the cron always skip (`lastAnalyticsReportDate` absent). The "GA visits" KPI shown to the client is a hardcoded fallback `3188`, not real Google Analytics data.
6. Cold start is **fixed and verified** (`/api/warm` + 40s client timeout; live chat round-trip ~9s warm). Not the source of the complaint.

**Bottom line:** incoming traffic is tracked, but the *study* of users fails because enrichment, lifecycle, identity capture, and search were never completed server-side. Client is not wrong; the dashboard is showing a mostly-empty data model as if it were analytics.

---

## 2. Verification Method (all live)

- Code audit: `/api/chat` (recording), `conversationService.ts`, `AnalyticsDashboard.tsx`, `ConversationMonitor.tsx`, `AdminDashboard.tsx`, `daily-analytics.js`, `vercel.json`, `firestore.rules`, `ChatTab.tsx`.
- Live API checks: `/api/health`, `/api/warm`, `/api/system-health`, real 2-turn chat E2E.
- Live Firestore audit (anonymous REST, read + cleanup of test docs): full scan of `conversations/` (2,672 docs) and message subcollections, plus `interventions/` (2 docs) and `config/main`.

### Live health results
| Check | Result |
|---|---|
| `GET /api/health` | `{ok:true, healthy:true}` |
| `GET /api/warm` | `{warm:true, firebaseAuth:true}` |
| `GET /api/system-health` | `{status:"up", latency:265ms}` |
| `POST /api/chat` E2E (2 turns, Spanish) | 200, real business-rule answers (~9s first hit) |
| Server-side recording E2E | Doc created with `srv_u_/srv_b_` messages, `messageCount=2`, funnel fields ✓ (test doc removed after) |
| Key endpoint security | `/api/gemini-key` no longer leaks keys (verified fixed 2026-09-02) |

---

## 3. Database Reality (live snapshot, project `chatbot-bi-front-desk`)

**Volume (root `conversations/`): 2,672 docs** — Jul-2026: 1,037 · Aug-2026: 1,319 · Sep-2026: 311 (80 in last 24h, ~544 in last 7d).

| Field (per session doc) | Populated | % of 2,672 |
|---|---|---|
| `analytics.messageCount` map | 2,670 | 99.9% |
| `analytics.messageCount > 0` | 1,252 | 46.9% |
| `flowStage` | 1,939 | 72.6% |
| `firstUserMessageAt` (real user spoke) | 87 | **3.3%** |
| `customerName` | 41 | 1.5% |
| `customerPhone` | 25 | 0.9% |
| `customerEmail` | 0 | 0.0% |
| `extractedData` map | 41 | 1.5% |
| `intentCategory` | 0 | **0.0%** |
| `sentimentScore` | 0 | **0.0%** |
| `topics[]` | 0 | **0.0%** |
| `duration` (AHT source) | ~8 | 0.3% |

**Status distribution:** `active` 2,656 (99.4%) · `completed` 8 · `human_assigned` 6 · `human_requested` 0 · `abandoned` 0 · `abandoned_at_greeting` 0.
**Welcome-only sessions** (messageCount=1, userMessages=0): **1,088 (40.7%)** — these inflate every "started chat / converted" panel.
**Interventions collection:** 2 docs total (both accepted) → staff-alert queue effectively empty for analytics.
**Config (`config/main`):** telegram bot token + chat ID present; `googleAnalyticsVisits` **absent** (dashboards fall back to hardcoded 3,188); `lastAnalyticsReportDate` **absent** (daily report never succeeded).

---

## 4. Root-Cause Findings

### F1 — CRITICAL: The analytics page renders fields nobody ever writes (why the client sees "missing information")
`AnalyticsDashboard.tsx` computes Sentiment, Top Topics, Intents, "Cotizaciones/Ventas" leads, AHT, and CSV/JSON exports from `s.intentCategory`, `s.sentimentScore`, `s.topics[]`, `s.extractedData`, `s.customer*`, `s.duration`. The server recorder (`recordChatTurn`, api/chat.js lines 47–129) writes **only** `id,status,brandId,source,language,lastMessage,lastUpdated` + message docs + `analytics.messageCount/userMessageCount` + `firstUserMessageAt/createdAt/flowStage`. **No code path in the server ever sets intent, sentiment, topics, extractedData, or customer contact fields.** The result: sentiment/intent/topic sections are structurally always empty, the leads table shows "Anónimo / N/A", and exports contain blank columns. This is a data-model incompleteness, not a rendering bug.

### F2 — CRITICAL: "Chats iniciados" and conversion are inflated ~14x
Dashboard counts `startedChatSessions = messageCount>0` → **1,252**. But a "welcome" auto-message makes `messageCount=1` with **0 user messages** for 1,088 sessions. Real user-talking sessions: **87**. So "conversion rate" reported to the client (against GA visits 3,188, also hardcoded) is fiction. The today-panel ("Ingresaron hoy", "Intervenciones hoy") and funnel ("abandoned/completed") cannot produce correct values because sessions are never lifecycle-closed server-side.

### F3 — HIGH: Identity is captured nowhere reliable → "hard to find who requested stuff"
- Only the **client-side onboarding** (`ChatTab.tsx` extractCustomerData on name/phone/profession) writes `customerName`/`customerPhone`/`customerEmail` — and only when the browser SDK path succeeds and the user completes onboarding (server-side curl/proxy chats never get it). 96% of users never type → no identity. Email capture: **0 ever**.
- `extract_customer_info` AI tool is declared in constants/instructions but its results land in local React state; nothing persists `intent_category` to Firestore (0 rows).
- No server-side PII/intent extraction exists despite the system prompt telling the model to register contact info.
- **Search:** `AnalyticsDashboard` has **no search input at all**. `ConversationMonitor` search matches only `customerName || extractedData.name` and `lastMessage` (ConversationMonitor.tsx:340–345) — **no phone, email, or full-transcript search**. The analytics CSV lacks transcript content. So even when a requester exists, staff cannot find them by what they asked.

### F4 — HIGH: Daily/weekly analytics report never runs (cron timezone bug)
`vercel.json` schedules `/api/daily-analytics` at `0 9 * * *` = **09:00 UTC = 04:00 Bogotá**. The endpoint gates on `nowBogota.getHours() !== telegramReportTime(09:00)` → always "Skipped: hour mismatch" (verified live: `current=8, target=9`). `lastAnalyticsReportDate` is never stored → report has **never** auto-sent; only a manual `?force=true` call works. Same class of bug: `googleAnalyticsVisits` default `3188` is a stale hardcode presented to the client as "Visitas Web (GA)".

### F5 — HIGH: Double-recording corrupts counts on real conversations
When a real visitor chats, **two writers** persist the same turns: (a) client `conversationService.addMessage` (FULL-MEMORY effect, epoch IDs like `1788345762844`) and (b) server `recordChatTurn` (`srv_u_*`/`srv_b_*`). Verified in live sessions (`session_1788345696198…`: same user text stored as both `1788345762844` and `srv_u_1788345766975`; 27 stored docs with srv=10 + epoch=17 for ~17 logical messages). Counters inflate inconsistently (some turns 1×, some 2×) depending on which write wins — so even raw message stats are unreliable, and transcripts show duplicate bubbles.

### F6 — MEDIUM: Lifecycle/funnel never progresses
`updateSessionStatus` to `completed/abandoned/human_requested` is only called client-side (ChatTab end/unload paths, `requestIntervention`), and the server always re-writes `status:'active'` per turn. No server-side idle-timeout / abandonment / completion logic exists → AHT (`duration` never set), completion %, abandonment, and "interventions today" are ~0 forever. Staff-intervention funnel: `interventions/` has **2 rows**.

### F7 — LOW: Cleanliness
- `daily-analytics.js` parses docs lacking `duration`, `.analytics` numeric types etc. — tolerant, but output is mostly N/A given F1/F6.
- Older legacy per-user store (`users/{uid}/chatSessions`, used by migration & older "chats" tab) coexists with the root `conversations/` store — Admin Bandeja reads `conversations` but migration tooling still references the old store (possible source of "I saw it before, now it's gone" confusion).
- 4 docs missing `createdAt`; `source` mostly hardcoded `web` (phone/whatsapp flows not differentiated in new recorder).

---

## 5. Cold-Start & Misunderstanding Check (as requested)

- **Cold start: FIXED and verified.** `/api/warm` returns `{warm:true, firebaseAuth:true}`; warm cron `*/5` present in vercel.json (note: on Vercel Hobby, only one daily cron is permitted historically — verify the `*/5` cron is actually firing on the current plan; the endpoint itself works and the 40s client timeout covers rare cold hits). Live first-hit latency ~9s — not the client's reported issue.
- **Misunderstanding check:** The client's complaint is *not* a misunderstanding — the dashboard genuinely shows empty/aggregated panels while the raw conversation text exists and is searchable only by a staff person reading the Monitor list. The perceived "missing info" = fields never enriched (F1) + no search (F3). The perceived "can't find who requested stuff" = identity not captured + no phone/email/transcript search.

---

## 6. Recommendations (priority order)

### P0 — Make the server the single recorder + enrich every turn
1. **Disable/remove client-side duplicate writes** in `ChatTab.tsx` FULL-MEMORY effect & `addMessage` path once `/api/chat` recording is authoritative (keep server `recordChatTurn` as the only writer of message docs and counters). Backfill-dedupe existing doubled message docs (keep `srv_*`, drop matching epoch duplicates).
2. **Enrich server-side on each turn** in `/api/chat` (after the reply): lightweight regex + heuristic extraction of name/phone/email + a cheap Gemini one-shot (or keyword classifier) for `intentCategory` (cotizacion/staff/catalog/stock/instalacion…), `topics[]`, `sentimentScore`; PATCH the session doc (`customerName/Phone/Email`, `extractedData`, `intent`, `sentiment`). Store `firstUserMessageAt` (done) and a `quoteRequested`/`escalated` flag when the existing escalation detector fires (server already computes `isQuote/isStaff` but only returns it in the response — persist it and create an `interventions/` row).

### P0 — Make requesters findable (direct client ask)
3. **Add a real search box to the Analytics page** and widen Monitor search to include `customerPhone`, `customerEmail`, session id, and **full transcript text** (load message subcollection per filtered candidate; with ~2.7k sessions this is fine client-side).
4. **Add a "Leads / Solicitudes" view** (or extend the existing "Detalle de Cotizaciones y Contactos Comerciales" table) listing sessions with quote/staff/catalog intent: name, phone (click-to-call/WhatsApp), email, brand, date, request text, and deep-link to the conversation. Expose it in the daily report too.

### P1 — Fix lifecycle + funnel so numbers mean something
5. Server-side session lifecycle: on each `/api/chat` turn set/refresh `lastActiveAt`; add a scheduled sweeper (existing cron slot) that closes sessions idle >N minutes (`abandoned`), >24h without a user message after greeting (`abandoned_at_greeting`), and computes `duration`. Exclude welcome-only sessions from "started chats": define started = `userMessageCount ≥ 1` (87 real today). Add real GA: either Google Analytics 4 API read or explicit monthly manual entry stored in `config/main` (kill the 3,188 hardcode).

### P1 — Fix reports & notifications
6. Fix the daily/weekly report timezone gate (schedule cron at `14:00 UTC` = 09:00 Bogotá **or** compare UTC hours). Confirm `*/5` warm cron fires on the Vercel plan (upgrade to Pro if Hobby blocks it). Verify `lastAnalyticsReportDate` persists after a successful forced run.
7. Consider a backfill job over the 2,672 existing sessions to enrich intent/topics/identity from stored transcripts so the client sees populated analytics immediately (do not touch live prod data without explicit approval; run on a copy first).

### P2 — Hygiene
8. Differentiate `source` (web/phone/whatsapp) properly in the new recorder; keep legacy `users/{uid}/chatSessions` migration path clearly separated or finish migration; fix the 4 docs missing `createdAt`; dedupe message docs.

---

## 7. Evidence Handles (for verification)

- Repo: `/home/jasme/UniTEC-Front-desk` (main, HEAD b9cdd2b). Recorder: `api/chat.js:47-129`. Client writer: `ChatTab.tsx:189-211` + `conversationService.addMessage`.
- Live endpoints verified 2026-09-04 13:45–13:55 UTC.
- Firestore counts via anonymous REST scan (project `chatbot-bi-front-desk`), test docs `diag-*`/`verify-*` created and **deleted** after audit — no residue.
- Example duplicated-message session: `session_1788345696198_i885fo6id` (27 docs, srv=10/epoch=17, identical user text under both ID schemes).

---

*Prepared by Hermes CTO review. Full detail available; happy to walk through any finding or implement the P0 fixes.*
