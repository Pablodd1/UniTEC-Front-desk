# Plan — Lock /api/training (POST) behind ADMIN_SECRET

Date: 2026-10-05 · Repo: Pablodd1/UniTEC-Front-desk · Status: AWAITING APPROVAL

## Goal
Stop anyone from overwriting the bot's training (and spamming the team's Telegram with
"ENTRENAMIENTO ACEPTADO") through the unauthenticated `POST /api/training`. The admin
panel remains the only user-facing flow; it gains a one-time "clave de administración"
prompt that is stored per-browser.

## Current state (verified)
- `api/training.js` — NO auth on GET or POST; only consumer is AdminDashboard.tsx
  (GET line 233 to load, POST line 480 to save). No scripts/docs call it.
- `ADMIN_SECRET` already exists in Vercel env (used by /api/gemini-key) — reusable.
- No client-side secret mechanism exists today; the panel must get one small addition.

## Changes (2 files)

### 1) api/training.js — gate POST only
Before the `if (req.method === 'POST') {` body, insert:
```js
// SECURITY: admin-only. Mirrors /api/gemini-key (Bearer or ?token=; fail-closed
// when ADMIN_SECRET is absent so the endpoint never runs unprotected).
const adminSecret = process.env.ADMIN_SECRET || '';
if (!adminSecret) {
  return res.status(503).json({ ok: false, error: 'Training service not configured' });
}
const auth = String(req.headers.authorization || '');
const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
const token = bearer || String(req.query?.token || req.body?.token || '').trim();
if (!token || token !== adminSecret) {
  return res.status(401).json({ ok: false, error: 'Unauthorized' });
}
```
GET stays open (read-only; panel loads it without friction).

### 2) components/AdminDashboard.tsx — handleSaveTraining (~line 475)
- Read `localStorage.unitec_admin_secret`; send `Authorization: Bearer <secret>` when present.
- On `401`: `window.prompt('Clave de administración requerida…')` → store in localStorage →
  retry once automatically. Wrong stored secret → prompt again (overwrite on success).
- On final 401: message "Clave de administración inválida." (training text stays in the editor).
- Everything else (Telegram copy, statuses) unchanged.

## Verification (after deploy = git push)
1. Gate: `node --check api/training.js`, `npm run lint`, `npm test`, `npm run build`.
2. Live probe: POST /api/training (no auth) → expect 401 (was 200);
   wrong token → 401; GET → 200; training text length read back = unchanged (87 chars).
   Note: 503 instead of 401 means ADMIN_SECRET is missing in Vercel env (then it must be set).
3. Bundle hash flips; panel opens and the training tab still loads (GET).
4. Happy path (owner, once): save training from the panel → prompt appears → enter the
   ADMIN_SECRET value (Vercel → Settings → Environment Variables → ADMIN_SECRET) → save
   succeeds + Telegram alert. (Or rotate to a fresh value first — recommended if unsure.)

## Risks / rollback
- If staff loses the clave: re-enter on next save; value is in Vercel env (reveal or rotate).
- Rollback: revert commit — endpoint open again.
- NOT in this round (future): fail-closed ALLOWED_ORIGINS, CRON_SECRET for sweeps,
  gating /api/notify-escalation, /api/record-turn, /api/analytics, config/main rules redesign.
