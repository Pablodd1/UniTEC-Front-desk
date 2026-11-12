# UniTEC Front Desk vs the World — Deep Competitive Benchmark
Date: 2026-10-04 · Author: Hermes · Status: research (no code changed)

## Part 1 — Who WE are today (verified from repo, not guesses)

Channels
- Web chat widget (embeddable script: unitec-chatbot.js / building-chatbot.js)
- Browser AI voice calls (Gemini Live, real-time PCM audio, interruption handling, 6 voices)
- Outbound staff alerts: WhatsApp + SMS (Sent.dm primary, Twilio fallback), Telegram, email
- Inbound WhatsApp = human handoff via wa.me link only (bot does NOT live in WhatsApp)

Brain
- Gemini streaming; Spanish/English; persona "Decky"
- Trained on ~500 products (492 products.json, 245 catalog specs, 295 price-mapped), October price list
- No-invention rules, accent-insensitive matching, rate limiting, clean sentence truncation

Mission Control CRM (admin)
- Universal inbox (both brands), staff intervention (request/accept/clear), staff status/assignment
- Tags/notes, visitor info, conversation summaries + auto-archive (retention)
- Token usage + cost tracking, voice settings, catalog management, deploy hub

Analytics / Ops
- Daily + weekly analytics, GA visits, anomaly detection + alerts, API/system health monitors, warm keepalive

Commerce
- Product pages, cart, Stripe payment links, shipping calculator, quote/consult flow

Ownership & cost
- Own Firestore, own Vercel, own code. Cost = Gemini tokens + hosting. No per-seat / per-resolution / per-conversation fees.

## Part 2 — The World, in 4 tiers (2026 data)

Tier 1 — Enterprise AI agents
- Intercom Fin: $0.99 per resolution; ~76% avg resolution; 1M+ conversations/week; Fin Voice; native helpdesk
- Sierra: outcome pricing, ~$150K/yr entry + $50–200K setup; Agent OS; Ghostwriter builds agents from SOPs/transcripts; voice overtook text as primary channel; 40%+ of Fortune 50; chat/voice/email/SMS/WhatsApp/ChatGPT; 59 languages
- Decagon: $50K/yr platform + usage (median ~$386K/yr); AOPs = plain-English workflows; Watchtower auto-QA grades 100% of conversations; Voice 2.0 sub-second; takes real actions (refunds, updates)
- Ada: ~$30–40K/yr; multi-LLM; omnichannel
- eesel / Lindy: self-serve SMB tiers ($0.40/task; sub-$50/mo)
Common DNA: action layer (do, not just say), QA/monitoring, simulation before deploy, outcome pricing, omnichannel + voice, cross-channel memory

Tier 2 — SMB WhatsApp / omnichannel platforms (BSPs)
- Wati $39–59+/mo + Meta fees: shared inbox, no-code bot, Astra AI, broadcasts, Shopify/HubSpot/Zoho
- Zoko $35–50/mo + Meta fees: Shopify in-chat catalog, cart recovery, WhatsApp Pay, broadcasts, order updates
- Respond.io from $79/mo: WA/IG/FB/TikTok/email/webchat; AI reads text+images+audio; 30+ languages; CRM sync
- ManyChat from ~$15/mo: IG/Messenger/WA marketing automation, click-to-WA ads
- Others: Interakt $19–49, Gallabox $89, SleekFlow, Trengo, Yellow.ai (ent. ~$1K+/mo), BotPenguin $15
Common: official WA API (BSP), shared agent inbox, broadcast templates, 24h-window management, in-chat commerce, cart/quote recovery, no-code flows, human handoff

Tier 3 — SMB website chat / AI bot builders
- Tidio: Free–$24.17+; Lyro AI ~$0.50–0.65/conversation (67% solve claim; 50% guaranteed on Plus); Flows; multichannel; shared inbox
- Chatbase: $0–400/mo + message credits; train on site/PDF/Notion; deploy web/WhatsApp/IG/Messenger/Slack/email; helpdesk + voice + actions from $120 tier; 35+ selectable models
- SiteGPT $39–259; YourGPT $39+; BotPenguin $15
Common: upload content → bot in minutes; credit meters; branding-removal fees; self-serve KB management

Tier 4 — AI receptionists (voice/phone) — fast-growing category
- Aira $24.95–159.95/mo (per call); Ahoya $39+/mo (self-serve from URL, CRM webhook, SMS handoff); Newo $299/mo; CallAgentAI $45–225/mo; Smith.ai $97+ and Ruby $235+ (per-minute); RingCentral AIR + Intermedia AIR (bundled into phone systems; website+docs training; scheduling; AI-to-human transfer; 50+ languages)
Common: never miss a call, book appointments, CRM sync, live transfer, transcripts, after-hours coverage

LATAM-specific
- Botmaker: $149/249/499 USD/mo plans + WA BSP $149/mo (3K chats); à-la-carte add-ons (voice notes STT/TTS, in-chat calls, live translation, premium actions, CRM exchange)
- Zenvia: $130–845/mo software + channel packs; per-message WA/SMS rates; WhatsApp calling per-minute extra
- Ventiva.ai (Colombia): COP 390K/690K/1.35M per month + setup 420K/700K/1.4M; WA agent, lead qualification, Google Calendar booking, CRM integration, reactivation campaigns

Meta platform shift (important window)
- WhatsApp Business Calling API is live; Meta docs explicitly allow AI voicebots to answer WhatsApp calls; business-initiated calls need user permission; Twilio and others support the integration. Voice is coming TO WhatsApp.

## Part 3 — Head-to-head

WHERE WE'RE STRONGER THAN MOST (current edge)
1. True product grounding: 500 real products, real specs, real October prices, no-invention rules. SMB tools train on marketing pages and hallucinate specs; ours answers exact calibers.
2. Cost model: no per-resolution / per-conversation / per-seat meter. Only tokens (tracked in-app). Structural advantage at volume.
3. Colombian Spanish front-desk persona + escalation to the real team's WhatsApp with Telegram/email alerts.
4. Ops instrumentation beyond SMB norm: anomaly detection, health monitors, cost tracking, retention/archival, daily/weekly analytics.
5. Multi-brand single platform, full data ownership, no vendor lock-in.

PARITY (equivalent, different flavor)
- Human handoff: our Mission Control + interventions vs shared inboxes
- Voice AI: ours web-only vs theirs web+phone+WhatsApp
- Analytics: comparable for SMB scope
- Staff alerting: ours (Telegram/email/WA alerts) vs their in-app notifications

WHERE THEY HAVE WHAT WE DON'T (ranked for UniTEC)
1. [CRITICAL] Bot not inside WhatsApp. We only hand off with a wa.me link; Colombia runs on WhatsApp; every Tier-2 platform and all LATAM players live inside it. Fix: WhatsApp Cloud API webhook → reuse api/chat.js brain; reuse Sent.dm/Twilio rails to reply.
2. [HIGH] No phone / WhatsApp-call AI receptionist. Our voice is browser-only. Market: whole tier at $25–300/mo; Meta now allows AI bots on WhatsApp calls. Fix: Twilio WhatsApp Business Calling or SIP → Gemini Live.
3. [HIGH] No broadcast/campaign engine: no promos, no quote follow-ups, no reactivation, no cart/quote recovery. Core revenue feature of ManyChat/Wati/Zoko/Botmaker. Fix: template campaigns via Cloud API + Firestore contact lists; start with quote follow-up.
4. [HIGH] No permanent customer profile (resolve-customer rolled back). Session history exists; identity/preferences across visits don't. Fix: fix Vercel ESM issue, redeploy, key by phone/session.
5. [MEDIUM] No simulation/QA harness. Decagon Watchtower grades 100% of chats; Sierra/eesel simulate against past tickets. Fix: replay last N conversations against candidate prompt; auto-flag hallucination/tone/length.
6. [MEDIUM] No CSAT/surveys, no automated QA scoring. Fix: 1-tap rating at close, stored in analytics.
7. [MEDIUM] Text-first chat. Market: product cards, catalogs, images, files, voice notes in-chat (Zoko catalog; respond.io reads images/audio; Botmaker voice notes). Fix: product image cards + add-to-quote button; wire Deepgram STT for voice input.
8. [MEDIUM] Client-facing answer management. Market KB editors let owners fix answers without devs. Our training API exists but: store has only an 87-char note, endpoint unauthenticated, no friendly editor. Fix: admin training UI + auth.
9. [LOW] Instagram/Messenger DMs, breadth of languages (ES/EN vs 30–80+), native mobile SDKs, SMS-as-chat, SOC2-type certs.

SECURITY/GOVERNANCE (fix regardless)
- /api/training unauthenticated → anyone could overwrite training
- Admin credentials committed in README → rotate + remove from docs

## Part 4 — Verdict + roadmap

Position: We are ahead of the $99/mo SMB class on grounding, cost model and ownership; behind on channel reach (WhatsApp/voice) and lifecycle marketing (campaigns, memory) — which is exactly where the money is in Colombia.

Roadmap
P0: (1) WhatsApp inbound channel; (2) secure training endpoint + rotate credentials; load client training properly
P1: (3) quote follow-up + broadcast campaigns on WA; (4) permanent customer memory; (5) CSAT + auto-QA
P2: (6) WhatsApp/phone AI calls; (7) rich in-chat media; (8) admin KB editor + replay testing

Cost note: P0–P1 likely costs less than one year of respond.io Plus + WA fees, keeps data ownership, and we avoid the $0.50–0.99/resolution meter entirely.
