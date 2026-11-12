# Monitor del chatbot UniTEC — diseño (cada 2 h, reporte a Telegram)

Verificado contra el código y contra producción el 2026-10-22.

## Lo que YA existe (no duplicar)

| Pieza | Cadencia | Qué cubre | Dónde |
|---|---|---|---|
| staff-sla-sweep | */5 min | Re-alerta 2/5/10 min, aviso al cliente, `staffNoShow`, cierre por abandono a los 60 min, quiet hours Bogotá 21–07 | api/staff-sla-sweep.js |
| uptime-watchdog | */15 min (GitHub Actions) | Sitio + /api/health + /api/warm + bundle → issue + Telegram | .github/workflows/uptime-watchdog.yml |
| lifecycle-sweep | */15 min | Sesiones sin actividad | api/lifecycle-sweep.js |
| abandon-sweep | */5 min | Carrito/chat abandonado + alerta | api/abandon-sweep.js |
| daily-analytics | 14:00 UTC | Informe diario/semanal | api/daily-analytics.js |
| anomaly-alert | evento | Dedupe 10 min, Telegram | api/anomaly-alert.js |
| widget-status | manual | Sitio, snippet del embed, iframe | api/widget-status.js (SIN cron) |

Nadie hace hoy: prueba sintética de conversación, auditoría de entrega de escalaciones,
integridad de precios, ni reporte periódico de "está bueno / no está bueno".

## Brechas verificadas (no supuestas)

1. **La colección `escalations` es ilegible para la app**: consulta REST con el token anónimo
   → 403 PERMISSION_DENIED (conversations → 200). El rastro de auditoría de alertas existe,
   pero ningún monitor puede leerlo con la identidad actual.
2. **La escalación se dispara en el NAVEGADOR, no en /api/chat**: `human_requested` y
   `updateSessionStatus` viven en services/geminiService.ts:330, services/conversationService.ts:440
   y services/grokVoiceService.ts:182. Una prueba server-side de /api/chat valida IA + registro,
   pero NO valida aviso a asesores.
3. **Contradicción de precio real**, detectada con la sonda de hoy:
   products.json → SKU 14031001 "LAMINA PVC BLANCO BRILLANTE H-01-I" = **$ 29.000 / Paquete**
   price-map.json (usado por /api/chat) → mismo SKU = **$ 27.000 / Unidad**, `approx: true`
   El bot respondió "$27.000 por unidad" en 2,25 s. Hay que decidir la fuente de verdad antes de
   poner aserciones de precio.
4. **/api/widget-status no tiene cron**: si se rompe el snippet en el sitio, nadie se entera
   hasta que alguien lo abra a mano.

## Diseño: 4 capas en UN endpoint, cron cada 2 h

`api/chatbot-watch.js` — protegido con `CRON_SECRET`, `vercel.json` → `0 */2 * * *`.

### Capa A — Prueba funcional del chat (sintética, real)
3 sondas fijas contra `/api/chat`, `sessionId` con prefijo `test-monitor-` (coincide con
`TEST_ID_RE` de api/_analytics-core.js y de staff-sla-sweep.js → excluida del embudo, del
informe y del barrido SLA; no contamina métricas ni dispara alertas a asesores):

1. Precio/stock: "¿Cuánto cuesta la lámina PVC blanca brillante H-01-I?"
   assert: 200, `success:true`, latencia < 8 s, aparece el producto, aparece un precio, sin `isFallback`.
2. Especificaciones: "¿Qué medidas tiene esa lámina?" → assert: contiene 30 cm y 5.95 m.
3. Deflexión: "¿Hacen envíos a Medellín?" → assert: responde, no error, no texto vacío.

Costo: 3 llamadas × 12/día ≈ 36 turnos/día (centavos).

### Capa B — Escalaciones: se avisó y se atendió
Sobre `conversations` (legible, 200 OK verificado), ventana últimas 2 h + estado actual:
- `lastEscalationDelivered` vacío con `escalationCount > 0` → alerta no salió.
- `lastSlaDelivery.ok === false` → el escalón 2/5/10 falló (trae `error` y `status`).
- `staffAlertPending === true` → nadie recibió nada.
- `status === 'human_requested'` con `lastUpdated` > 60 min y `closedBy` vacío → el sweep está muerto.
- `staffNoShow === true` → nadie atendió en 10 min (esto es KPI, se reporta, no alarma).
- `closedBy: 'unattended_staff'` / `'staff_inactive'` en la ventana → conteo.
- `tgAlertMessageId` presente → prueba de que Telegram recibió la alerta.

Canario de entrega: `POST /api/notify-escalation` con `type:'custom'`, `phones:[<número de prueba>]`.
Hoy ese endpoint NO tiene dry-run: manda Telegram + email + SMS a 8 teléfonos. Decisión pendiente
(ver abajo).

### Capa C — "Está bueno" (integridad y disponibilidad)
- `checkWidget()` reutilizado de api/widget-status.js (sitio, snippet, iframe frameable).
- Integridad de precios: price-map vs products.json en los N SKU más consultados → diff, moneda, unidad.
- `/api/xai-voice-token` responde 200 con token → el canal de voz está vivo (previo al clon).
- `/api/system-health` → Gemini up/degraded/down.
- Latencia p50 de las sondas A → tendencia (si sube de 8 s, aviso).

### Capa D — Reporte Telegram
- Formato español, máx. 8 líneas: estado global (VERDE / AMARILLO / ROJO), sondas, escalaciones
  pendientes, fallos de entrega, precio/integridad, latencia.
- Frecuencia: SIEMPRE cada 2 h al chat del dueño (heartbeat: si no llega, algo se rompió).
- Fallos: además al chat del equipo.
- Quiet hours Bogotá 21–07: solo ROJO interrumpe.
- Histórico: bloque `monitor` dentro de `config/main` (últimas 24 corridas, JSON acotado) —
  sin colección nueva, sin reglas nuevas, sin PII.

## Cambios de código necesarios

1. `api/chatbot-watch.js` (nuevo, ~250 líneas) — capas A–D.
2. `vercel.json` — una entrada de cron `{ "path": "/api/chatbot-watch", "schedule": "0 */2 * * *" }`.
3. `api/notify-escalation.js` — `dryRun` opcional (solo si se elige canario seco) y escritura de
   un rollup `escalationHealth` en `config/main` (último resultado por canal, failStreak), porque
   `escalations` es ilegible. Sin PII: solo conteos y booleanos.
4. Opcional (`api/_analytics-core.js`): exportar un helper `readConversation(sessionId)` para no
   repetir el fetch REST en el monitor.

## Decisiones que necesito antes de escribir código

1. **Canario de escalación**: (a) seco cada 2 h — valida el pipeline y deja rollup, sin mandar nada;
   (b) real 1 vez/día 09:00 Bogotá a un solo número de prueba con prefijo [PRUEBA]; (c) ambos.
   Recomendado: (a) cada 2 h + (b) diario.
2. **Destino del heartbeat**: chat del dueño (`HERMES_ALERT_BOT_TOKEN`/`HERMES_ALERT_CHAT_ID`, ya
   soportado en api/telegram-send.js) o chat del equipo. Recomendado: dueño para el heartbeat,
   equipo solo para fallos.
3. **Fuente de verdad del precio**: products.json ($29.000/paquete) o price-map ($27.000/unidad).
   Sin esto la aserción de precio es inválida.
4. **Plan de Vercel**: hay 6 crons configurados; si el proyecto está en Hobby solo corren 2.
   Confirmar Pro antes de sumar el séptimo.
5. **Prueba E2E de navegador** (opcional): Playwright en GitHub Actions abriendo el embed real y
   verificando que la respuesta se pinta en el widget. No toca escalaciones (para no paginar al
   equipo). ¿La quieres en la Fase 2?

## SLOs propuestos (a confirmar, no medidos aún como línea base)

- Sondas A: 100% en verde, latencia < 8 s.
- Entrega de escalación: 100% con ≥1 canal OK.
- Sesiones `human_requested` > 60 min sin cerrar: 0.
- Atendidas en < 10 min: ≥ 90% de las solicitudes del día.
