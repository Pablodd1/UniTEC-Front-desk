# UniTEC — "estoy en un loop / tomo el chat y no me sale nada" (Nancy + cliente Maria)

Fecha: 2026-10-09 17:45 UTC (13:45 COL) · repo `Pablodd1/UniTEC-Front-desk` · estado: PLAN

## 0. El caso real (identificado)
Sesión `session_1791553254283_0mwcxw7v8` — cliente **Maria Lopez, +1 239-850-6544** (Miami).
Nancy la atendió a mano (6 mensajes `[Staff] …` de 13:19 a 13:30). Es la misma sesión de las dos
alertas de hoy (11:52 y 12:18 COL). Transcript real leído del store (46 docs).

## 1. Qué está roto — CONFIRMADO (código + datos vivos + capturas del cliente)

**A. El aviso de "un asesor ya está atendiendo" se repite en CADA mensaje del cliente → el "loop".**
`components/ChatTab.tsx`, rama `sessionStatus === 'human_assigned'`: agrega una burbuja
`{id:'handoff-'+Date.now(), text:'🧑💼 Un asesor del equipo ya está atendiendo…'}` en cada envío
(local, `skipFirestore: true`). En el store hay 1-2 avisos, pero el cliente lo ve tras CADA mensaje.
Evidencia: su propia captura — *"si es que cada que te hablo me sale eso"* — y el aviso repetido 4-5
veces en las imágenes de WhatsApp. Es exactamente el "repeat the same".

**B. La BANDEJA (Staff Intervention Center) NO muestra la conversación ni deja responder.**
`components/StaffIntervention.tsx` (líneas 150-211): el tile sólo tiene "Anonymous Customer",
`session_…`, el motivo y —en Pending— un botón "Take Over Conversation"; en Active sólo el texto
"You are handling this conversation". **No hay transcript, ni caja de respuesta, ni enlace para abrir
el chat.** ⇒ "lo tomé de inmediato y no me sale nada" es literalmente lo que hace esa pantalla; el
chat sólo se ve en MONITOR, y para llegar hay que buscar la sesión a mano (la búsqueda no incluía
teléfono hasta el commit de hoy). Evidencia: su video (11 fotogramas) + el código.

**C. El nombre y el teléfono que el cliente escribe DURANTE el takeover nunca se guardan.**
La rama `human_assigned` de ChatTab guarda el mensaje y hace `return` antes de cualquier extracción de
PII. Maria escribió "3243150877" y "mi nombre es Maria lopez" (13:29-13:30) y el doc de sesión sigue
**sin `customerName` ni `customerPhone`**. (Además, el teléfono web "+1 239-850-6544" que el bot
confirmó a las 13:42 tampoco quedó en el doc.) ⇒ "mira lo que me dice la cliente que dejó el teléfono".

**D. Al cliente le llegan los mensajes del asesor con el prefijo literal `[Staff] `.**
`ChatTab.tsx:303`: `text: `[Staff] ${m.text}``. Maria leyó "[Staff] Perfecto señora Maria ya te
escribo". Suena a máquina, justo lo contrario de "más amable".

**E. Métricas de staff muertas en esta sesión:** `analytics.staffInteractions = 0` con 6+ mensajes de
staff (hallazgo ya conocido, ahora confirmado en una sesión real). `staffNudges: 1`.

## 2. Cambios propuestos (cada uno verificable en vivo)

**A. Aviso polivalente en vez de loop**
1. El aviso de takeover sale **UNA vez por conversación**: ref + bandera persistida
   (`staffNoticeAt`), y si ya hay un mensaje con `slaNotice`/`handoff` en el transcript, no se repite
   (sobrevive recargas).
2. Después, cada mensaje del cliente durante el takeover recibe un **acuse breve, cordial y VARIADO**
   (3 redacciones rotando), con tope: nunca más de uno cada 3 min y nunca si el asesor acaba de
   escribir (los `[Staff]` recientes lo silencian).
3. Estado de espera (`human_requested`, bot aún activo): sin cambios de comportamiento; sólo se evita
   prometer tiempos.

**B. Entrada real al chat desde la BANDEJA**
- Botón **"Abrir conversación"** en cada tile → `?admin=true&session=<id>` (deep link ya soportado).
- Mostrar en el tile el **último mensaje** y nombre/teléfono cuando existan (hoy dice siempre
  "Anonymous Customer").

**C. Capturar la identidad dada durante el takeover**
- En la rama `human_assigned`, extraer nombre (`explicitName`) y teléfono (mismo regex del bloque
  `pendingPhoneRequest`) del texto entrante y persistirlo; disparar el aviso `type:'contact'` una vez.
- Endurecer `extractCustomerData`: quitar claves `undefined` antes de `updateDoc` (un campo undefined
  hace que `updateDoc` falle y el catch se lo come — por eso no se guarda el teléfono aunque el bot
  diga que sí). Verificar con una escritura real de prueba y re-lectura del doc.

**D. Quitar el `[Staff] ` para el cliente**: renderizar el mensaje del asesor como mensaje normal
(con etiqueta pequeña "Asesor" sólo en el panel, nunca en la vista del cliente).

**E. `analytics.staffInteractions`**: incrementarlo cuando el panel envía un mensaje de staff.

## 3. Archivos
`components/ChatTab.tsx` (A, C, D) · `components/StaffIntervention.tsx` (B) ·
`components/ConversationMonitor.tsx` (B, E) · `services/conversationService.ts` (C, E).

## 4. Verificación
- A: sesión de prueba en takeover → 4 mensajes del cliente ⇒ **un solo** aviso + acuses breves
  distintos, separados ≥3 min; recargar la página no re-muestra el aviso.
- B: tile de la BANDEJA → "Abrir conversación" abre la sesión correcta en MONITOR.
- C: escribir "mi nombre es X" y un número en takeover ⇒ `customerName`/`customerPhone` en el doc
  (re-lectura) + un aviso `contact`.
- D: el mensaje del asesor llega sin `[Staff] `.
- Borrar la sesión de prueba (doc + subcolección) al terminar. `tsc --noEmit` 0, build 0/0.
