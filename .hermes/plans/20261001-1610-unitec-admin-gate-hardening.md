# UniTEC — admin gate auto-entry hole (found while verifying the Telegram-link fix)

Date: 2026-10-01
Status: FIX APPLIED TO WORKING TREE (uncommitted). NOT deployed — awaiting owner decision.

## Finding (verified live, not guessed)
- Visiting /admin or /?admin=true auto-opens the ADMIN PANEL with NO credentials on any browser.
- Mechanism (2 pre-existing layers):
  1. App.tsx (~line 73): every visitor is signed in ANONYMOUSLY (signInAnonymously) for Firestore access.
  2. components/LoginScreen.tsx useEffect: `onAuthStateChanged(auth, user => { if (user) onLogin(); })`
     auto-calls onLogin() for ANY user, incl. anonymous → sets sessionStorage.unitec_local_admin='true'
     — the exact flag the admin gate (App.tsx:303-311) checks → panel renders.
- Live repro: cleared `unitec_local_admin` + `unitec_show_admin` → reload /admin → flag back to 'true'
  and the panel re-opened by itself in ~1s. Customers' browsers carry the same anonymous session.

## Fix (one line, sitting in working tree)
- components/LoginScreen.tsx: `if (user) { onLogin(); }` → `if (user && !user.isAnonymous) { onLogin(); }`
- Credential form path (handleCredentialLogin) unchanged.

## Deploy (after approval)
1. git add components/LoginScreen.tsx
2. git commit -m "fix(security): admin auto-entry now requires a real (non-anonymous) user"
3. git push origin main        (Vercel auto-builds, ~1-2 min)
4. Verify in a fresh browser: /admin shows "Acceso Administrador" and it STAYS; credentials → panel.

## Revert
- git revert <commit> && git push

## Impact
- After deploy: staff must enter the panel credentials once per browser session (sessionStorage flag).
  Owner must confirm staff have the password — or share it — BEFORE this ships.
- Unknown visitors can no longer open the panel: conversations/PII no longer exposed to URL-guessers.

## Left as-is for now (pre-existing, separate hardening pass)
- Admin gate stays client-side; credentials hardcoded in the shipped bundle (see CTO_REVIEW_2026-10-01.md).
  True hardening = server-side auth checks on admin APIs + real Firebase Auth accounts.

## Related — shipped & live (commit 3ab2916, bundle index-DlH8M040.js)
- /admin routing repaired: vercel.json catch-all rewrite destination /index.html → /index
  (with cleanUrls:true, /index.html as a destination is ignored → every path URL 404'd).
- /admin pathname + ?session=<id> deep links supported; alert messages deep-link to the exact conversation.
