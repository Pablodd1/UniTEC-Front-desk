# Mission Control — Step 1 completado: chatbot UNITEC USA

Verificado el 2026-10-22 contra el repo, Firestore y producción. Valores reales, no estimados.

---

## 1. Identidad del app

| Campo | Valor |
|---|---|
| Nombre | UNITEC USA DESIGN — Virtual AI Front Desk (multi-marca: `unitec` y `building`) |
| Repo | https://github.com/Pablodd1/UniTEC-Front-desk — **PÚBLICO**, rama `main`, último push 2026-10-22T20:05Z |
| Hosting | Vercel → https://unitec-front-desk.vercel.app |
| Embed en producción | https://www.unitecusadesign.com/ (widget servido desde el dominio Vercel) |
| Stack | React 19 + Vite (front), funciones serverless en `/api/*` (Node ESM) |
| Auth del repo | No requiere PAT: es público. Basta con dar acceso de lectura a `Pablodd1` o usar el repo tal cual. |

## 2. Dónde viven los datos

**Firebase / Firestore** — proyecto `chatbot-bi-front-desk` (GCP, Firestore nativo).

| Ruta | Contenido | Legible por la app (identidad anónima) |
|---|---|---|
| `conversations/{sessionId}` | 1 doc por sesión: marca, estado, embudo, `analytics.*`, nombre/teléfono del cliente | ✅ 200 OK |
| `conversations/{sessionId}/messages/{msgId}` | Turnos de la conversación (cliente / bot / asesor) | ✅ 200 OK |
| `escalations/{autoId}` | Auditoría de cada alerta: canales, `delivered[]`, `failed[]`, `anyDelivered` | ❌ **403 PERMISSION_DENIED** |
| `config/main` | Training, último reporte, config de Telegram | ✅ 200 OK |

Colecciones secundarias del panel: `crm_logs`, `call_recordings`, `calls`, `app_config` (gestionadas por `firestore.rules`).

**Campos que importan para Mission Control** (todos en `conversations`):
`brandId`, `status` (`active | human_requested | human_assigned | completed | abandoned*`),
`createdAt`, `lastUpdated`, `lastMessage`, `firstUserMessageAt`, `funnelStep`,
`customerName`, `customerPhone`, `extractedData.phone`,
`analytics.{messageCount, userMessageCount, avgResponseTime, escalationCount, slaRealerts, staffInteractions, slaBreaches, unattendedClosures}`,
`lastEscalationAt`, `lastEscalationDelivered[]`, `lastSlaDelivery.{ok,status,error,at}`, `slaStage`,
`staffNoShow`, `staffAlertPending`, `tgAlertMessageId`, `closedBy`.

## 3. API (base: https://unitec-front-desk.vercel.app)

| Endpoint | Método | Auth | Devuelve |
|---|---|---|---|
| `/api/analytics?from=ISO&to=ISO` | GET | pública | KPIs + embudo (agregados, sin PII) |
| `/api/health` | GET | pública | estado del contexto/memoria del bot |
| `/api/system-health` | GET | pública | Gemini up/degraded/down + latencia |
| `/api/anomalies` | GET | pública | última anomalía registrada |
| `/api/widget-status` | GET | pública | sitio, snippet del embed, iframe |
| `/api/chat` | POST | pública (rate limit 120/min por IP+sesión) | `{text, success}` |
| `/api/notify-escalation` | POST | pública | dispara Telegram + email + SMS y escribe auditoría |
| `/api/daily-analytics` | GET | cron; fuera de las 09:00 Bogotá responde "Skipped: hour mismatch" | informe ejecutivo (Gemini) + envío |
| `/api/staff-sla-sweep`, `/api/abandon-sweep`, `/api/lifecycle-sweep` | GET | `CRON_SECRET` si está definido en Vercel | barridos |

## 4. Acceso recomendado para Mission Control (elegir UNA)

- **Opción A (recomendada): endpoint de exportación.** Se agrega `/api/mission-control-export` protegido con
  un token propio; devuelve en un solo JSON: KPIs, embudo, sesiones de la ventana, salud de escalaciones
  y precio/integridad. Mission Control hace `GET` con `Authorization: Bearer <token>`. No recibe
  credenciales de Firebase y no ve PII. Requiere cargar una service account en Vercel (ver §7).
- **Opción B: service account de solo lectura.** JSON de service account (rol Viewer / Datastore Viewer)
  del proyecto `chatbot-bi-front-desk`, entregado al equipo de Mission Control para leer Firestore
  directamente, incluidas `escalations`. Es la única vía de leer la auditoría de escalaciones.
- **Opción C: solo API pública.** `GET /api/analytics` + `/api/health` + `/api/widget-status` sin
  credenciales. Da agregados y disponibilidad; no da sesiones, ni escalaciones, ni PII.

## 5. Los 5 números del resumen diario (con línea base real)

| # | Número | Fuente | Valor de hoy (2026-10-22, Bogotá) |
|---|---|---|---|
| 1 | Conversaciones reales (el cliente escribió) por marca | `analytics.userMessageCount > 0` | **10** UNITEC · **0** Building Innovation |
| 2 | Contactos capturados (nombre + teléfono) | `customerPhone` o `extractedData.phone` | **0** hoy · 29 histórico |
| 3 | Solicitudes de asesor y cuántas se atendieron | `escalationCount > 0`; `status: human_assigned`; `closedBy` | **1** solicitud hoy · 55 `human_assigned` · 101 `completed` |
| 4 | Entrega de alertas al equipo | `lastEscalationDelivered`, `lastSlaDelivery.ok`, `staffAlertPending` | 0 fallos registrados en las sesiones legibles |
| 5 | Abandono en el saludo (widget abierto sin conversación) | `status: abandoned_at_greeting` / total | **4.466 de 4.665 (95,7%)** |

Contexto del embudo (endpoint `/api/analytics`, acumulado): 4.649 sesiones, 173 interacciones reales
(3,72%), 29 contactos, 52 con asistencia humana, 5,2 mensajes de usuario por conversación.

Opcional 6: latencia del bot — `analytics.avgResponseTime` por sesión; sonda real de hoy: 2,25 s.

## 6. Reporte a Juan (CEO, Building Innovation)

- Necesito su **chat_id de Telegram** (o email) y si el resumen va diario 09:00 Bogotá o cada 2 h.
- **Aviso de datos**: en este proyecto `brandId=building` tiene **1 sola sesión** histórica contra 4.664
  de `unitec`. Si Building Innovation tiene su propio deploy/dominio, el reporte de Juan debe apuntar
  a ese proyecto; si no, su resumen saldría en cero.
- Formato propuesto (1 mensaje, sin jerga): conversaciones reales, contactos, solicitudes de asesor
  y cuántas se atendieron, fallos de alerta, y una línea de "qué corregir hoy".

## 7. Lo que necesito de ti (credenciales y datos)

1. **Service account de Firebase** (solo si eliges Opción A o B):
   Firebase Console → ⚙ Project settings → Service accounts → *Generate new private key* →
   descargar el JSON. Rol: Viewer / Datastore Viewer. **No subirlo al repo (es público).**
   Cargarlo en Vercel como variable `FIREBASE_SERVICE_ACCOUNT` (JSON en base64).
2. **Token de exportación**: una cadena aleatoria de 32+ caracteres para `MC_EXPORT_TOKEN`.
3. **Endpoint de ingesta de Mission Control**: URL + header de auth + esquema JSON esperado
   (o la ruta real de `nexus_ingest.py`; no existe en esta máquina, solo hay `~/video-mission-control`).
4. **chat_id / email de Juan** y frecuencia del reporte.
5. **Confirmar** si existe `CRON_SECRET` en las variables de Vercel (nombre, no valor) para que el
   monitor pueda invocar los barridos protegidos.

## 8. Hallazgos de seguridad (resolver antes de conectar nada externo)

1. **El repo es público** e incluye `firebase-applet-config.json` con el `apiKey` web y el `projectId`.
   Eso es normal en Firebase, pero aquí las reglas permiten que cualquiera con esa config se
   autentique anónimo y **lea todas las conversaciones y mensajes** (incluye nombre y teléfono:
   29 documentos con teléfono verificado). *Verificado: lectura 200 OK.*
2. **`config/main` es legible por esa misma identidad y contiene `telegramBotToken` y `telegramChatId`**
   (46 y 10 caracteres). Cualquiera con la config pública puede leer el token del bot de Telegram.
   Recomendación: mover el token a variables de entorno de Vercel y bloquear `config/main` a
   lectura de servidor; luego **rotar el token** con BotFather.
3. **`escalations` es escribir-pero-no-leer** para la identidad de la app (403 verificado): la
   auditoría de alertas existe pero es invisible. Por eso el monitor necesita service account o
   un rollup sin PII en un documento legible.
4. **`/api/analytics` es público** y devuelve el embudo completo. Son agregados, sin PII, pero
   conviene exigir token si Mission Control va a consumirlo.

Nada de esto se toca sin tu aprobación explícita, y el token de Telegram no se imprime ni se copia
a ningún archivo.
