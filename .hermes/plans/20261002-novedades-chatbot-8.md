# UniTEC Front Desk — Novedades Chatbot 8 (client doc 2026-10-02) + October price list

Source asks: `~/Downloads/Novedades Chatbot 8.docx` (chat screenshots = evidence) and
`~/Downloads/LISTA DE PRECIOS OCTUBRE.xlsx` (141 rows, "LISTA MARKETING" = cliente final, COP/unit).

## Verified findings

| # | Client complaint | Root cause (evidence) | Fix |
|---|---|---|---|
| 1 | Bot calls the user by their first message ("¡Un gusto conocerte, Piso deck!") | `components/ChatTab.tsx:588` `bareName` accepts ANY 2-30 letter text when `looksLikeIntent()` is false; `INTENT_RE` (line 47) has no product words (`piso`, `deck`, `panel`, `fachada`…) so a bare product = "name" | delete bare-name capture; only explicit `me llamo/mi nombre es/soy X`; stoplist for `soy distribuidor`; add product words to INTENT_RE |
| 2 | Closes/escalates too fast, repeats questions, two paths at once ("escribe a Camilo" + more questions) | Prompt (`constants.ts:328-333`, `api/chat.js:172-186`) instructs routing to named advisors per question; no single-question rule, no qualification order | new PAUTAS block: qualify producto → m² → uso → perfil → ubicación → datos → ONE final escalation; 1 question per message; never open two paths |
| 3 | Gives an advisor's number, not the company's | both prompts hardcode `Camilo Andres Torres` + `wa.me/573104578337` in the escalation path; `constants.ts:330` has a half-masked literal | escalation = generic only `https://wa.me/573142332147` (+57 314 233 2147) |
| 4 | Wrong prices ($120.000-$180.000 for piso deck) | `public/products.json` (Jul 29) stale vs the October list (FACHADA DECK 60.000→45.500, PISO DECK EXTERIOR 75.000→78.000, unit mislabeled "Estiba / Pallet"); Firestore `trainingData` is a 87-char note, no price table | prices leave `products.json` (removed); single `public/precios-2026.json` built deterministically from the October sheet; injected ONLY on price intent, always "valor aproximado por unidad" |
| 5 | Sends the whole Drive catalog | `api/turn-text.js:30-36` `catalogReply()` returns the Drive folder URL for any "catálogo"; `constants.ts:319,352` point at the Drive folder | per-product ficha técnica + catálogo; full catalog = only `https://canva.link/l7fu4xk4lp5jed2` |
| 6 | "Problems adding new training" | `/api/training` POST replaces the whole blob with no history — live blob is 87 chars, earlier pautas are gone | pautas move into the versioned repo prompt; save keeps `trainingDataPrev` + append mode |
| 7 | Duplicates | scan of 40 live sessions / 32 messages: **zero duplicate message docs** (client `skipFirestore` on the bot msg + `savedMessageIds` dedup are working) → the duplication is conversational (repeated questions / dual path) → fixed by #2 | no code change needed for data; message dedup verified good |

## Files to touch
- `components/ChatTab.tsx` — name capture (#1)
- `constants.ts` — PAUTAS + catalog + escalation (#2,#3,#5)
- `api/chat.js` — BASE_FRONT_DESK pautas + price injection from the new table (#2,#3,#4)
- `api/turn-text.js` — catalogReply → Canva link (#5)
- `api/training.js` + `api/shared-training.js` — append/history on save (#6)
- `public/precios-2026.json` (new) + `public/products.json` (prices removed) (#4)
- `scripts/build-prices.mjs` (new, re-runnable, auditable: sheet → JSON with match report)

## Verification (must all pass)
1. `npm run lint` · `npm test` · `npm run build` (0 errors/0 warnings)
2. Live probes after deploy (bundle hash must flip first): "Piso deck" as first message → NO name greeting + a real answer; price question → ~78.000 aprox/unit; fachada deck → ~45.500; "catálogo" → Canva link; escalation wording → generic WhatsApp only; 3 turns → never two contact paths, never a repeated question
3. Latency probe (`scripts/latency_probe.py`) before/after
4. Probe sessions deleted afterwards (diag-* only; no quote wording that fires real alerts)
