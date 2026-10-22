# AGENTS.md — UniTEC Front Desk

**Binding rules for every agent working in this repository. These are mandatory, not advisory.**
Every task — feature, fix, refactor, dependency bump, copy change — MUST be executed with both
core skill sets loaded and applied:

1. **GitHub Open Code Review & Verification**
   (`code-review` + `autofix` from `coderabbitai/skills`)
2. **Modern Web Quality & React Best Practices**
   (`vercel-react-best-practices`, `vercel-composition-patterns`, `vercel-optimize`,
   `deploy-to-vercel`, `web-design-guidelines` from `vercel-labs/agent-skills`; `seo`,
   `performance`, `accessibility`, `core-web-vitals`, `web-quality-audit`, `best-practices`
   from `addyosmani/web-quality-skills`)

Skills live in `.agents/skills/` and are pinned in `skills-lock.json`.
**Do not hand-roll a review, a performance pass or an a11y pass when a skill covers it — load the skill.**

---

## 1. GitHub Open Code Review & Verification — ALWAYS

- **Pre-commit diff check.** Before every commit: `git diff --cached` and read it end to end.
  Nothing enters a commit that you have not read in its final staged form.
- **Zero secret exposure.** No API key, token, password, bearer string, connection string, service
  account blob or `.env` value may ever be staged. Runtime secrets live in the host's environment
  (Vercel env vars, `.env` which is gitignored) and are referenced by name only. If a secret is
  required, add a placeholder to `.env.example` — never the real value. If a secret is ever
  committed, treat it as compromised: rotate first, then purge history.
- **Security audit on every change that touches I/O.** Serverless routes (`/api/*`) MUST validate
  and bound their input, never interpolate user data into shell/SQL/paths, never return stack traces
  or internal identifiers, and must fail closed. Admin-only behaviour requires an explicit check
  (see `ADMIN_SECRET` usage in this repo). Verify CORS, rate limiting and error shapes on the
  changed route.
- **Build gates.** A change is not done until all of these pass locally, with real output:
  `npm run lint` · `npm test` · `npm run build`. Report the actual result. Never claim a green
  build you did not see, and never silence a warning to make a gate pass.
- **Clean commits.** One logical change per commit, imperative subject
  (`feat(area): …`, `fix(area): …`, `chore(area): …`), body explaining *why* and what was verified.
  No commented-out code, no debug `console.log`, no dead files, no unrelated reformatting.
- **Review before push.** For risky diffs, run the CodeRabbit review skill over the staged diff and
  resolve every blocking finding — or state explicitly why a finding is being declined.
- **Deployment truth.** This repo deploys by `git push` to the production branch (Vercel). After a
  push, verify the live artifact (served bundle name / live endpoint response) rather than assuming
  the deploy landed. Report what the live site actually serves.

## 2. Modern Web Quality & React Best Practices — ALWAYS

- **Waterfall elimination.** No sequential client fetch chains where one round trip would do:
  parallelise independent requests (`Promise.all`), prefetch on intent/hover, and stream or defer
  what is not needed for first paint. Any request added to the critical path MUST justify itself.
- **Bundle optimization.** Keep the initial bundle lean: route-level `React.lazy`/dynamic import for
  heavy views, no full-library imports when a named import exists, no new dependency that adds
  >10 kB gzip without an explicit reason recorded in the commit body. Re-check bundle output after
  every dependency change.
- **Technical SEO.** Every indexable URL has exactly one canonical, **with trailing slash**,
  matching the served URL: `<link rel="canonical" href="https://unitec-front-desk.vercel.app/path/" />`.
  Titles and meta descriptions are unique and descriptive; headings are hierarchical (one `h1`);
  `sitemap.xml` and `robots.txt` are valid, current and served with the correct content type;
  structured data (JSON-LD) is valid and matches the visible page. No `noindex` on a page meant to
  rank, never two URLs serving identical content without a canonical.
- **Accessibility — WCAG 2.2 AA minimum.** Semantic landmarks and elements before ARIA; every
  interactive element reachable and operable by keyboard with a visible focus ring; all images have
  meaningful `alt` (or `alt=""` when decorative); text contrast ≥ 4.5:1 (≥ 3:1 for large text);
  forms have real labels and announced errors; nothing depends on colour alone; motion respects
  `prefers-reduced-motion`; touch targets ≥ 24×24 px (2.5.8).
- **Core Web Vitals.** Target LCP < 2.5 s, INP < 200 ms, CLS < 0.1 in the field. Reserve layout
  space for media and async content, keep the main thread free of long tasks, and prefer CSS
  transforms/opacity for animation. A change that regresses any of these is a bug.
- **Design consistency.** Preserve the existing visual language (glass-card surfaces, palette,
  spacing scale, typography). No new visual pattern without a stated reason.

## 3. Automated error monitoring (Jev)

- `.github/workflows/jev-monitor.yml` audits the key routes every 6 hours, on push to
  `main`/`master`, and on demand. `scripts/jev-audit.mjs` classifies every failure with Jev
  (TypeSafe System One) in one parallel pass — `is_operational`, `severity`, `should_alert` — and
  notifies via Resend or a webhook only when the incident warrants it.
- Run it locally before blaming production: `node scripts/jev-audit.mjs` (add `TYPESAFE_API_KEY` to
  `.env` for Jev classification; without it the script runs its heuristic fallback and says so).
- `model: "jev-1"` **does not exist**. Valid ids: `jev-latest` (currently → `jev-1.13.0`),
  `jev-1.13.0` (pin when you tune thresholds), `jev-preview`. Log the `model` field the API returns.
- When you change a public route, update `ROUTES` in `scripts/jev-audit.mjs` — a route nobody
  watches is a route nobody fixes.

## 4. Repository context

- Stack: React + Vite (TypeScript) SPA, API routes in `api/` deployed as Vercel serverless
  functions. Firebase/Firestore backs the chat; Mission Control reads the analytics pipeline.
- Deploy: `git push origin main` → Vercel auto-deploy. There is no Vercel CLI token on this machine.
- Never touch production data stores from a task branch. Never commit `.env`, values from
  `firebase-applet-config.json`, or anything under `reports/` (audit artifacts are CI artifacts,
  not source).
