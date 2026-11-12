# Plan — UniTEC Front Desk: escalaciones visibles, SLA de staff y paridad de voz

Fecha: 2026-10-05 · Repo: `/home/jasme/UniTEC-Front-desk` (live: `unitec-front-desk.vercel.app`)
Aprobación del owner: **"All please"** (fases A+D).
Evidencia base: `.hermes/probes/conversation_gap_audit.py` — 4.557 sesiones, 97 con texto real de
cliente, **52 terminan con el cliente hablando y sin respuesta**, `analytics.escalationCount = 0` en
**todas** las 4.523 sesiones reales, 30 `human_assigned`, 4.418 `abandoned_at_greeting`.

## Objetivo
Que ninguna conversación quede sin respuesta ni sin dueño: cada escalación se registra y se ve en
los monitores, el cliente sabe que un asesor viene, y si el asesor no llega el sistema insiste
solo (re-alerta + correo/Telegram + aviso al cliente) y deja rastro auditable.

## Fase A — visibilidad y registro (1 commit)
- `api/notify-escalation.js`: tras despachar los 5 canales, **persistir**: doc `escalations/{sessionId}_{ts}`
  con `{sessionId, type, priority, channelResults, payloadDigest, createdAt}` y en la sesión
  `analytics.escalationCount` (incremento real), `analytics.lastEscalationAt`, `analytics.escalationType`,
  `staffAlertPending: true`. Si fallan TODOS los canales, se registra igual (`ok:false`) → nunca más
  una alerta invisible.
- `components/ChatTab.tsx` (`checkAndTriggerWhatsAppAlert`): además del aviso, (1) `requestIntervention(...)`
  para que la sesión pase a `human_requested` (el monitor "staff solicitado" hoy no la ve) y
  (2) burbuja de acompañamiento **una vez por conversación**: "✅ Ya avisé a un asesor del equipo…".
- `api/turn-text.js`: sin cambios de política (una sola fuente ya existe).

## Fase B — SLA del asesor (`api/staff-sla-sweep.js`, cron `*/5`)
- Solo sesiones `human_requested` / `human_assigned` con actividad real y **< 6 h**.
- Etapas guardadas en la sesión (`slaStage`, `lastSlaAt`):
  - **T+2 min** sin toma: re-alerta (Telegram + correo) "SIN RESPUESTA 2 min" + transcript corto.
  - **T+5 min**: 2ª re-alerta (staff + owner) y aviso dentro del chat al cliente ("sigo pendiente, tu asesor está en camino").
  - **T+10 min**: se ofrece WhatsApp/teléfono explícito y se marca `staffNoShow: true` (medible).
- Nunca toca sesiones viejas ni ids de prueba (`TEST_ID_RE`), una alerta por etapa por sesión,
  `?dryRun=true` para inspeccionar el plan, protegido por `CRON_SECRET` (Bearer) cuando exista.
- Crons: añadir a `vercel.json` **sin** tocar los existentes.

## Fase C — paridad de voz y turnos fallidos
- Voz (`services/geminiService.ts`): respetar `human_assigned` (no responder si hay humano) y disparar
  la comprobación de escalación sobre el transcript de voz; etiquetar el turno como `channel: 'voice'`.
- `api/chat.js` + `api/_record-chat-turn.js`: grabar los turnos que **fallan** (429, cold start, todas
  las llaves caídas) con `deliveryStatus: 'failed'` + `failureReason`, sin retroceder el embudo.

## Fase D — alertas con contexto y telemetría
- El cliente envía contexto: últimos 6 turnos, intención, cantidades, URL de la página y "esperando desde".
- Plantillas Telegram/correo/WhatsApp reescritas con ese contexto (hoy: sólo el último mensaje, 200 chars en WA/SMS).
- `api/analytics.js` + `AnalyticsDashboard.tsx`: KPIs de escalaciones, esperando-asesor y SLA incumplido.

## Verificación (obligatoria, por fase)
1. `npm run lint` · `npm test` · `npm run build` → 0 errores.
2. `python3 .hermes/probes/conversation_gap_audit.py` antes/después (escalationCount debe dejar de ser 0).
3. E2E con sesión **etiquetada** `sla-test-*` (nunca datos de cliente) → verificar re-alertas y borrar la sesión (doc + subcolección, re-GET 404).
4. Nunca probar con `/api/daily-analytics?force=true` (envía al Telegram del cliente).
5. Bundle hash servido == hash local antes de declarar nada "en vivo".

## Riesgos / rollback
- Riesgo: bucle de alertas → mitigado con `slaStage` + ventana de 6 h + una alerta por etapa.
- Riesgo: escrituras REST a Firestore desde la función → mismo patrón que `lifecycle-sweep.js`.
- Rollback: rama `backup/pre-escalation-sla-<fecha>`; revert por commit (A, B, C+D son commits separados).
