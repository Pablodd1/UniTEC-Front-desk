# UniTEC — alert link "no entra al chat" + abandono (detección y aviso)

Fecha: 2026-10-09 17:20 UTC (12:20 COL) · Repo `Pablodd1/UniTEC-Front-desk` (origin/main al día)
Estado: PLAN — sin editar código hasta aprobación.

## 1. Qué dijo el cliente (traducido a síntomas técnicos)
1. Le llegó una alerta (cotización / pidió asesor) y **al abrir el link o el número registrado no había
   usuario ni forma de entrar al chat**.
2. ¿Se puede **ver qué pasó cuando el usuario abandonó**?
3. ¿Podemos **avisar/marcar cuando abandonan** (cierra el computador o el teléfono)?

## 2. Evidencia EN VIVO (re-ejecutable)

Probe: `/home/jasme/UniTEC-Front-desk/.hermes/probes/abandon_alert_verify.py` (solo GETs, no escribe nada).

**A. La alerta SÍ salió, pero llegó sin identidad.**
`escalations` (4 docs, los 3 reales del cliente):
```
2026-10-09T17:18:17Z  staff  sess=session_1791553254283_0mwcxw7v8  tel=—  delivered=[telegram,twilioSms]  failed=[email,sentDmWhatsApp,twilioWhatsApp]
2026-10-09T16:52:55Z  staff  sess=session_1791553254283_0mwcxw7v8  tel=—  delivered=[telegram,twilioSms]  failed=[email,sentDmWhatsApp,twilioWhatsApp]
2026-10-08T16:50:17Z  quote  sess=session_1791478207471_zidogsjcp  tel=—  delivered=[telegram,twilioSms]  failed=[email,sentDmWhatsApp,twilioWhatsApp]
```
Las 3 sesiones **existen** y están `human_requested` / `human_assigned` (conversaciones reales: 16 y 3
mensajes de usuario). Pero **`customerPhone` va vacío** → la plantilla imprime
`Cliente: Desconocido / Teléfono: No indicado`.
Cobertura de identidad en TODO el store: `customerPhone` 28/4572 (0,6 %) · `customerName` 58/4572 (1,3 %).

**B. El link de la alerta cae en el MURO DE LOGIN (esta es la causa raíz del "no hay usuario").**
El link es `https://<origin>/?admin=true&session=<id>`. `App.tsx:303-311`: si `activeTab===ADMIN` y
`sessionStorage.unitec_local_admin !== 'true'` → renderiza `LoginScreen`, y el `?session=` se pierde.
Reproducido en navegador limpio (sesión nueva, sin sessionStorage):
- `/?admin=true&session=session_1791553254283_0mwcxw7v8` → **"Acceso Administrador / CREDENCIALES REQUERIDAS"**,
  `sessionStorage.unitec_local_admin = null`. Cero conversación, cero acción para entrar.
- El gate usa **`sessionStorage`**, que se borra al cerrar la pestaña y **no se comparte** con una pestaña
  abierta desde Telegram/WhatsApp → **el staff golpea el muro prácticamente SIEMPRE** al tocar el link.
- Contraste (prueba de que el deep link SÍ sirve una vez logueado): con login hecho, el mismo URL
  seleccionó correctamente dos sesiones distintas (la de `piso deck/70` con 33 msgs y la de
  `cotización/perfiles` con 8 msgs), y el historial carga en ~6-9 s.

**C. Aunque entren, no pueden buscar al cliente.** `ConversationMonitor.tsx:342-345` busca solo
`customerName` + `lastMessage`. **No busca por teléfono, correo ni transcripción.** El filtro de estado
tampoco tiene "abandoned" (solo active / human_requested / human_assigned / completed).

**D. El abandono SÍ se marca, pero nadie se entera y es inferido.**
`api/lifecycle-sweep.js` (cron `*/15`) escribió sobre el store: **4.423 `abandoned_at_greeting` + 13
`abandoned_at_name` = 4.436 / 4.572 sesiones abandonadas**. Nada avisa a nadie, no hay filtro ni KPI
accionable. Y el criterio es **idle > 15 min por `lastUpdated`**, no un evento de cierre: el temporizador
del widget (`ChatTab.tsx:362-447`, aviso a los 4 min + cierre a los 5) **solo corre con la pestaña abierta**;
si cierran el computador/teléfono no dispara nada, solo queda la inferencia a los 15 min.

## 3. Cambios propuestos

### Fix A — que el link de la alerta ABRA el chat (decisión requerida)
Opción recomendada **A1 — link de staff firmado, un solo toque**:
- `api/notify-escalation.js` firma el link: `/?staff=<token>&session=<id>` (HMAC con `ADMIN_SECRET`,
  TTL 24-48 h, alcance = ver/responder SOLO esa sesión).
- Nueva ruta mínima (p. ej. `api/staff-enter.js?token=…&session=…`) valida y devuelve una vista de
  respuesta de esa sesión (historial + caja de texto = `addMessage role:'staff'`), sin exponer el panel.
- No toca el gate del panel: el admin sigue pidiendo credenciales; el link solo habilita esa conversación.
- Alternativas: **A2** mantener el muro y solo cambiar `sessionStorage`→`localStorage` (login una vez por
  dispositivo) + aviso al staff de loguearse; **A3** página de "responder" con código corto de 6 dígitos
  enviado en la alerta.

### Fix B — identidad en la alerta (para que "haya usuario")
- Enviar `customerName/customerPhone` cuando existan (hoy van vacíos porque casi nunca se capturaron).
- Capturar nombre + WhatsApp **una sola vez, en el momento de intención** (cotización o "quiero asesor"),
  no al inicio; guardarlo en la sesión para que la alerta y el panel lo muestren.
- `ConversationMonitor`: buscar también por teléfono/correo (y opcional: transcripción).

### Fix C — abandono: marcar el cierre real + avisar
- **C1 (detección real de cierre)**: en `ChatTab.tsx`, `visibilitychange`→hidden + `pagehide` →
  `navigator.sendBeacon('/api/session-exit', {sessionId, brand, lastStage, dwellMs, hasContact})`.
  Nueva `api/session-exit.js` (beacon, sin CORS de navegación, escribe `exitAt/exitReason/lastStage` con
  merge). Con debounce para no marcar bloqueos de pantalla/cambio de app.
- **C2 (aviso)**: nuevo `type:'abandon'` en `api/notify-escalation.js` (reutiliza Telegram + raíl +
  audit `escalations` + re-alerta) y disparo desde `lifecycle-sweep.js` (o sweep propio): sesión con
  `userMessageCount ≥ 1` que abandona en etapa name/phone/profession/engaged, **una sola alerta** por
  sesión (`abandonAlertedAt`), horas de silencio 21:00-07:00 respetadas.
- Marca visible: opción "Abandoned" en el filtro del `ConversationMonitor` + columna de etapa.

## 4. Archivos que tocaría (solo tras aprobación)
`components/ChatTab.tsx` (beacon + captura de identidad) · `components/ConversationMonitor.tsx` (búsqueda
+ filtro) · `api/notify-escalation.js` (tipo abandon + identidad) · `api/lifecycle-sweep.js` (disparo) ·
`api/session-exit.js` (nuevo) · `vercel.json` (solo si se cambia el cron) · `firestore.rules` (si el
beacon escribe directo). Plan por etapas: A → B → C, cada una verificable en vivo.

## 6. DECISIONES APROBADAS (2026-10-09 17:2x UTC)
- Fix A = **A1 link firmado de un toque** (token HMAC con TTL; abre vista de respuesta SOLO para esa
  sesión; el panel conserva su contraseña). Descartadas A2 y A3.
- Fix C alcance = **toda sesión donde el cliente ESCRIBIÓ algo** (`userMessageCount ≥ 1`), incluye
  los que se van tras 1 mensaje; nombre/teléfono cuando existan. NO se avisa de greeting-only
  (serían ~4.400 avisos).
- Fix C velocidad = **beacon inmediato al cerrar pestaña/teléfono + sweep de respaldo cada 5 min**.

### Orden de entrega (cada etapa verificable en vivo, sin romper lo actual)
- **Etapa A — link firmado (desbloquea la queja 1).**
  `api/notify-escalation.js`: firmar `staffUrl = /?staff=<hmac>&session=<id>` (HMAC-SHA256 con
  `ADMIN_SECRET`, payload = sessionId + exp; TTL 48 h) y usarlo en Telegram/email/WhatsApp.
  `api/staff-enter.js` (NUEVO, `_`-free solo si necesita ruta): valida token, devuelve solo esa sesión
  (historial + POST de respuesta). `App.tsx`: reconocer `?staff=` y montar la vista de respuesta en
  lugar del panel. Sin tocar el gate del admin.
  Verificación: link firmado en pestaña limpia → historial + caja de respuesta; token vencido/alterado → 401.
- **Etapa B — identidad (que la alerta traiga "usuario").**
  `components/ChatTab.tsx`: pedir nombre + WhatsApp UNA vez en el momento de intención (cotización /
  quiero asesor) y persistirlo en la sesión; `notify-escalation.js` ya enviará `customerName/customerPhone`.
  `ConversationMonitor.tsx`: buscar también por teléfono/correo.
  Verificación: escalación de prueba → la alerta muestra nombre y teléfono.
- **Etapa C — abandono con cierre real + aviso.**
  `components/ChatTab.tsx`: `pagehide`/`visibilitychange→hidden` → `navigator.sendBeacon('/api/session-exit', …)`
  con debounce. `api/session-exit.js` (NUEVO): escribe `exitAt/exitReason/lastStage/dwellMs` (merge).
  `api/notify-escalation.js`: `type:'abandon'`. `api/lifecycle-sweep.js`: disparar UNA vez por sesión
  (`abandonAlertedAt`) cuando `userMessageCount ≥ 1` y abandona en etapa; teléfono en el raíl si hay contacto.
  `ConversationMonitor.tsx`: filtro "Abandoned". Cron: mantener `*/15` y añadir barrido ligero `*/5`, o
  subir el existente — a decidir al implementar según coste de lecturas.
  Verificación: cerrar pestaña a mitad → `exitAt` en segundos; al tick, UNA alerta; re-ejecutar no repite.

