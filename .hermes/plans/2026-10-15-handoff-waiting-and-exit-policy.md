# Plan — Política de hand-off: acompañar mientras se espera, seguir sirviendo, y cerrar con datos
**Fecha:** 2026-10-15 · **Repo:** `/home/jasme/UniTEC-Front-desk` · **Estado:** propuesta, SIN tocar código.
**Origen:** decisión del owner (2026-10-15) sobre el caso verificado `session_1784206195362_66m6riv6i`
(`references/2026-10-miami-false-escalation.md`).

## 1. Objetivo (lo que pidió el owner, literal)
1. Mientras se espera al asesor: un mensaje que diga que **se está contactando/avisando al staff**.
2. Si el cliente quiere otra cosa en el ínterin: decirle que **el bot sigue disponible y puede seguir
   conversando**.
3. A menos que suene a que **no quiere nada más** → despedirse con educación y dejar el
   **sitio web de la compañía** para más información.
4. Cuando el staff **entra al chat o llega al usuario**: guardar toda la interacción, dejar en la
   conversación un aviso educado de **"un asesor ya está atendiendo"**, **seguir grabando hasta que
   termine**, y al terminar **guardar los contadores y los datos** (panel/informe).

## 2. Máquina de estados (objetivo)

| estado | quién responde | qué ve el cliente | qué se escribe |
|---|---|---|---|
| `active` | bot | normal | todo (server recorder) |
| `human_requested` (esperando asesor) | **bot SIGUE respondiendo** (no re-alerta) | 1 aviso de hand-off con "sigo contigo" + WhatsApp + web | `escalationCount`, alerta 1 vez, `escalationAt`, aviso en el transcript |
| `human_assigned` (asesor en el chat) | **asesor** (bot en silencio) | 1 aviso "un asesor ya está atendiendo" + web; luego acuses cortos cada 3 min | todos los mensajes + `staffInteractions` por mensaje de asesor + `handoff-notice` en el transcript |
| `resolved` | nadie (terminal) | cierre educado del asesor + web | `resolvedAt/resolvedBy/resolution`, contadores, Telegram editado |
| `completed` (cierre del bot/político) | nadie (terminal) | despedida educada + web | `closedBy: bot_polite_exit`, `analytics.botClosed` |
| `completed` + `staffNoShow` (nadie llegó, cliente se fue) | nadie (terminal) | (ya no está) | `closedBy: unattended_staff`, `staffNoShow`, `analytics.unattendedClosures` |

Regla de oro que se mantiene: **un solo escritor por turno**; los avisos nuevos van al transcript con
id propio (`handoff-notice-<ts>`, `handoff-ack-<ts>`, `polite-exit-<ts>`) y `skipFirestore: false` para
que queden en el registro (hoy el aviso de takeover se pinta y NO se guarda: `ChatTab.tsx:809`).

## 3. Copys exactos (ES; EN espejo)

**A) Aviso de espera (reemplaza `ChatTab.tsx:578-580`)** — `human_requested`:
```
✅ Ya avisé a un asesor del equipo: te escribirá por aquí en breve.
Mientras tanto yo sigo contigo 🙂 Puedes seguirme preguntando por productos, precios o medidas
y te ayudo de una vez.
Si es urgente, WhatsApp: https://wa.me/573142332147 · Más información: https://www.unitecusadesign.com/
```

**B) Aviso de asesor en el chat (ajusta `ChatTab.tsx:805-807`)** — `human_assigned`:
```
🧑💼 Un asesor del equipo ya está atendiendo esta conversación: tu mensaje quedó registrado y te
responderá por aquí. No necesitas repetirlo 🙂 Más información: https://www.unitecusadesign.com/
```

**C) Despedida educada (nuevo, en la ruta de envío)**:
```
¡Con mucho gusto! Quedo atento cuando necesites 🙌
Puedes ver todo nuestro portafolio y contactar al equipo aquí: https://www.unitecusadesign.com/
o por WhatsApp: https://wa.me/573142332147
¡Que tengas un excelente día! 👋
```

**D) Escalera SLA (`api/staff-sla-sweep.js`)** — mismas etapas 2/5/10 min, copy ajustado: las líneas
del cliente añaden "si quieres seguir consultando algo, escríbeme y te ayudo de una vez" y el sitio
web; la etapa 3 mantiene el WhatsApp + `staffNoShow`.

**E) Cierre del asesor (`api/session-resolve.js:57-71`)** — añadir el sitio web a la línea de cierre.

## 4. Detección de "no quiere nada más" (nuevo `detectClosing()`)

Fuente única: `api/turn-text.js` (exportada), espejo en el cliente.
Dispara con frase explícita de cierre **y** sin señales de consulta:
- Frases: `no gracias`, `nada mas`, `nada más`, `eso es todo`, `es todo`, `ya esta`, `ya está`,
  `listo gracias`, `ok gracias`, `muchas gracias`, `bye`, `chao`, `chau`, `adios`, `adiós`,
  `hasta luego`, `nos vemos`, `gracias, eso es todo`.
- Guardas (todas obligatorias): mensaje ≤ 90 chars · sin `?` · sin palabras de producto/precio/dato
  (`precio, valor, cuánto, cuanto, medida, color, ref, dónde, donde, ubicación, cotiza, catálogo`) ·
  la conversación ya tuvo ≥1 respuesta del bot (no cerrar en el saludo).
- Si dispara: no se llama a la IA; se envía el copy C, `status=completed`, `closedBy=bot_polite_exit`,
  `bumpCounter(analytics.botClosed)`.

## 5. Cambios por archivo (líneas exactas)

1. `api/turn-text.js:54-57` — **quitar** `'atencion','atención'` de `STAFF_WORDS` (y evaluar
   `'contacto'`); `.`+ añadir `CLOSING_WORDS` + `export function detectClosing(message)`.
   Motivo: hoy "¿tienen atención en Miami?" escala (caso verificado).
2. `components/ChatTab.tsx:527` — mismo ajuste en `staffKeywords` (los dos lados en el MISMO commit).
3. `components/ChatTab.tsx:522-599` — copy A; `skipFirestore:false` en el aviso de hand-off; el bot
   NO deja de responder en `human_requested` (hoy ya responde: se documenta y se bloquea el re-alerta
   con `staffAlertSentRef`).
4. `components/ChatTab.tsx:~836` (antes de `sendMessageToGemini`) — `detectClosing(text)` → copy C +
   cierre; `return` antes de llamar a la IA.
5. `components/ChatTab.tsx:795-833` — copy B + escribir el aviso al transcript (`handoff-notice-<ts>`)
   y mantener el acuse espaciado 3 min.
6. `api/chat.js:456-465` — el cap de 360/700 chars **no recorta textos literales del cliente**: extraer
   los literales de `config/main.trainingData` (bloques "informarle al cliente lo siguiente:") y, si la
   respuesta empieza con uno de ellos, no aplicar el cap. Motivo: hoy el macro de Miami se corta antes
   de "…informándonos nombre completo y numero de contacto" (349 de 398 chars).
7. `api/staff-sla-sweep.js:28-31` — nueva constante `UNATTENDED_CLOSE_MIN = 60`: si sigue en
   `human_requested`/`human_assigned`, el cliente no escribe en 60 min y `slaStage>=3` → `status=completed`,
   `closedBy=unattended_staff`, `staffNoShow` se conserva, `bumpCounter(analytics.unattendedClosures)`.
   (No se toca `lifecycle-sweep.js`: sigue sin tocar `human_*`.)
8. `api/session-resolve.js:55-71` — sitio web en el cierre + asegurar `staffInteractions` y el
   `resolvedAt/resolvedBy`.
9. `components/ConversationMonitor.tsx:253-256` — además de `staffInteractions`, escribir
   `firstStaffReplyAt` y `analytics.staffWaitMs` (espera real del cliente: `claimedAt - escalationAt`).
10. `api/daily-analytics.js:512-513` — incluir `unattendedClosures`, `botClosed`, `staffWaitMs` en el
    informe y en el Excel.
11. `constants.ts:283-311` (pautas, regla 6 en `:298`) + `api/chat.js:234-289` (`BASE_FRONT_DESK`,
    regla 6 en `:255`) — nueva regla: "mientras un asesor está en camino SIGUES atendiendo otras
    consultas; si el cliente se despide, ciérrale con el sitio web; si un asesor ya está en el chat, no
    respondes".

## 6. Verificación (antes de decir "hecho")
- Probes en vivo (curl `/api/chat` + widget):
  1. `tienen atencion en miami` → 0 alertas, sin hand-off, macro **completo** (hasta "numero de contacto").
  2. `quiero hablar con un asesor` → 1 alerta, aviso A, y el bot **sigue** respondiendo la siguiente pregunta.
  3. `no gracias, eso es todo` → copy C + `status=completed` + `closedBy=bot_polite_exit` en el doc.
  4. Takeover simulado (`PATCH status=human_assigned`) → aviso B, mensaje guardado, IA en silencio,
     `handoff-notice` en el transcript.
  5. Cierre del asesor → `resolved` + contadores + Telegram editado.
- Store: leer los docs de cada sesión de prueba (contadores, transcript, status).
- Contadores: `escalationCount` · `staffInteractions` · `slaBreaches` · `unattendedClosures` · `botClosed`
  moviéndose; re-ejecutar el informe diario y comparar contra el día anterior.
- Deploy = `git push`; para cambios de cliente, verificar el hash del bundle servido vs `npm run build`.

## 7. Riesgos / rollback
- Cambiar palabras de escalamiento toca 2 archivos + 2 pautas → un solo commit y re-correr el checklist
  de escalamiento (precio = 0 alertas; "cotización formal" = 1 alerta).
- Falsos positivos del cierre político terminan conversaciones temprano → guardas de la §4 + muestra de
  10 conversaciones reales antes de declararlo estable.
- El cierre por no-show mueve los números del embudo → documentar el cambio esperado en el informe.
- Rollback: revertir el commit; ningún cambio es destructivo (solo updates de campos y docs nuevos).

## 8. Pendiente de confirmación (1 pregunta)
Durante `human_assigned` (asesor ya en el chat): ¿el bot queda **en silencio** (recomendado, el asesor
es el dueño) o también sigue respondiendo como en la espera?
