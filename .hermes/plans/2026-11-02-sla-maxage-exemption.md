# Plan — SLA sweep: exempt human_requested from MAX_AGE skip + regression check (2026-11-02)

## Goal
Close the live bug from review 2026-11-02: a night-time escalation (quiet hours 21:00-07:00 Bogota)
becomes permanently orphaned because `MAX_AGE_MS` (6h, keyed on `lastUpdated`) skips it once daytime
resumes. Real case: session_1793508521136_9mtg8wna8 ("Pasto", escalated Sat 23:48 Bogota) — 30h+
waiting, slaStage never written, monitor permanently RED, Nancy gets red alerts every 2h.

Also re-verify the previously fixed issues are still intact (duplicate turns / duplicate alerts):
90s escalation dedupe, one-writer skipFirestore rule, idempotency in-flight-only guard, single
Twilio rail (Sent.dm removed).

## Exact change
File: api/staff-sla-sweep.js
- Line 132: `if (!lastUpdatedMs || now - lastUpdatedMs > MAX_AGE_MS) continue;`
  → keep the age cap but never apply it to `human_requested` sessions (they need closure regardless
  of age). `human_assigned` KEEPS the cap so the ~55 historical staff sessions from Jul-Sep are not
  suddenly re-processed/closed (panel numbers unchanged — client decision needed for that later).
- Header comment line 15 updated to match.
- No other files touched. Server-only; no bundle hash change.

## Verification
1. `node --check api/staff-sla-sweep.js` (syntax).
2. Unit test (no prod writes): import the handler with stubbed `globalThis.fetch` (skill pattern
   /tmp/verify_rail_dedup.mjs) — simulate listAllSessions returning the Pasto session (status
   human_requested, lastUpdated 30h old) + getDoc returning its fields; run `?dryRun=true&force=true`;
   assert plan contains alert:3 / notice:final / flag:staffNoShow and close path; also assert an
   OLD human_assigned session still gets skipped (cap intact) and quiet-hours still defer.
3. Regression greps (code-read, must all be present):
   - notify-escalation.js: 90s dedupe window (commit 990d73c logic) — still there.
   - ChatTab.tsx: staffAlertSentRef (alert once per conversation), skipFirestore on welcome/
     takeover/idle bubbles (one writer per turn).
   - chat.js: idempotency state machine (only 'in_flight' blocked; finished reprocessed).
   - notify-escalation.js: Sent.dm fully removed; Twilio is the only phone rail.
4. Deploy via git push (GitHub → Vercel auto-deploy).
5. Live verification (read-only):
   - Wait for next */5 cron run (~5-10 min): re-read session doc → expect slaStage=3,
     staffNoShow=true, lastSlaDelivery present (final staff alert + customer notice fire per
     ladder policy), then next run closes it: status=completed, closedBy=unattended_staff.
   - Monitor's next 2h run: escalations.stuck 1 → 0 (config/main.monitor.runs.last).
   - Note: the final SLA alert WILL reach the client's staff channels once (by design — the
     ladder exists to re-alert an unattended customer); the initial alert already fired Saturday.

## Risks
- One extra staff alert for the Pasto customer (intended; policy-compliant).
- No panel/UI change; no bundle change; chat path untouched.
- human_assigned cap unchanged → no mass closure of historical sessions.
