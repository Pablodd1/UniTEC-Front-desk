# Plan: UniTEC chat speed — "PENSANDO" latency reduction

Date: 2026-10-01 · Repo: ~/UniTEC-Front-desk (origin/main b279423) · Status: AWAITING APPROVAL (no code changed yet)

## Goal
Cut perceived chat wait time. Client complaint: "takes long when it's PENSANDO".

## Measured baseline (2026-10-01, live prod, read-mostly probes)
- Warm end-to-end /api/chat for "hola": 2.6s / 5.4s / 3.1s / 3.0s / 2.6s (median ~3.0s), product query 3.5s.
- Breakdown via catalog shortcut (no AI):
  - Function overhead: 0.14-0.16s (warm instance).
  - Firestore recording (recordChatTurn): +0.4-0.6s per turn (0.75/0.54/0.58 vs 0.15/0.16/0.13).
  - Training fetch (shared-training): ~0.3-0.7s whenever its 30s TTL cache misses — i.e. most real messages, since traffic is sparse; pays a fresh anonymous signUp each miss.
  - AI generation: 2.6-5.4s — dominant cost.
- Cold-start contribution: under test (15-min quiet probe running; /api/warm baseline warm = 0.37-0.40s).
- Client already renders progressive chunks (ChatTab accumulates `fullText` per generator chunk) — but the server returns one JSON blob at the end, so nothing streams today. No fake typewriter delay exists.

## Phase 1 — Streaming (biggest perceived win)
1. `api/chat.js`
   - Accept `stream: true` in the body (destructure near line ~90). If set, use SSE:
     - Gemini native: `:streamGenerateContent?alt=sse` per candidate model; OpenRouter/xAI: `stream: true`, parse `data:` lines.
     - Pipe text deltas as `data: {"delta":"..."}`; accumulate; early-stop accumulating at ~360 chars if no URL present.
     - At end: `await recordChatTurn(finalText)` (keep awaited), then `data: {"done":true, escalation?}`; `res.end()`.
     - Any provider failure before first chunk → next key/model; total failure → fallback text as a single delta + done (same copy as today, plus alertAnomaly).
   - Non-stream requests keep the EXACT current JSON path (zero risk for old clients).
2. `services/geminiService.ts` (lines ~127-175)
   - Send `stream: true`; if response content-type is `text/event-stream`, read with a ReadableStream reader and `yield` each delta; otherwise keep the current `proxyRes.json()` branch.
3. `components/ChatTab.tsx` — no changes needed; `PENSANDO` pill hides automatically once the first delta fills the bot bubble (condition at line ~1122).

## Phase 2 — Overhead trims (≈0.6-1.3s/message)
4. `api/shared-training.js` — TTL 30s → 300s; replace its private `firestoreToken()` with `getFirestoreToken()` from `_analytics-core.js` (1h cached) — lines 5-6, 8-20, 36.
5. `api/chat.js` (~line 300) — `products.json`: module-level cache (10 min TTL) + fetch from the CANONICAL origin (`https://unitec-front-desk.vercel.app`) instead of the request `origin` (also closes the SSRF flagged in the security review).
6. `api/chat.js` (~line 291) — `generationConfig.maxOutputTokens: 180` (bounds verbose tails; replies are capped ~280 chars anyway). Optional experiment: `thinkingConfig.thinkingBudget: 0` ONLY after verifying per-model acceptance live; skip silently if a model 400s.
7. `api/_record-chat-turn.js` (lines ~70-161) — round-trip reduction: fold the one-time funnel fields into commit #1 (state already known from the pre-read) and merge counters into one commit → read + 1 commit instead of read + 3 commits. Keep updateMask semantics and response shape identical.

## Phase 3 — Observability + first-message polish
8. Record `latencyMs` (handler start → reply ready) on the bot message doc + `analytics.avgResponseTime` (the dashboard already parses this field); expose `ms` in the response only when an `x-diag: 1` header is present.
9. `components/ChatTab.tsx` (~535) — don't block the chat call on `ensureSession()`: fire `createConversation` and the chat request in parallel (server recording creates the doc via updateMask merge anyway), pass the id via ref when ready. Saves ~0.3-1s on the first message.
10. Cold-start belt (owner-side): verify the `*/5` warm cron actually executes (Vercel dashboard shows cron logs; plan limits could silently reduce frequency). If unreliable, add an external pinger to `/api/warm`. Pending result of the 15-min probe.

## Verification
- tsc --noEmit + npm run build (bundle-hash deploy check per ops skill), git push (deploy = push only).
- `curl -N -X POST .../api/chat -H 'Content-Type: application/json' -d '{"message":"hola","stream":true}'` → incremental `data:` events.
- Non-stream path still returns JSON 200.
- Recording still lands (diag- session → messages + counters), then delete the diag docs.
- Re-run latency probe: target time-to-first-word ≤ 1.5s; full-reply total ≤ current; compare `avgResponseTime` after a day of traffic.

## Risks
- Streaming + fallback complexity → keep JSON path, per-provider try/catch, stream starts only after first successful chunk.
- Recording must complete before function end → awaited before `done` event (invisible, text already on screen).
- maxOutputTokens 180 might clip a legit long answer → raise to 220 if observed; aligned with client's short-reply brief.
- recordChatTurn refactor → keep response shape; verify with diag sessions before/after.

## Out of scope (security review, separate approval)
Firestore rules lockdown, origin/CRON auth, .env.production removal — see CTO_REVIEW_2026-10-01.md.
