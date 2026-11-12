# Mission Control ↔ Chatbot UniTEC / Building Innovation — contrato de integración

Estado: endpoint en producción y verificado el 2026-10-23.
No se necesita acceso a este repo ni a la base de datos. Solo este contrato.

## Opción A (recomendada) — Mission Control hace pull cada hora

    GET https://www.chatbuildinginnovation.us/api/mission-control-export?window=24
    Authorization: Bearer <MC_EXPORT_TOKEN>

- `window`: `24` (por defecto) o `168` (7 días). Cualquier otro valor cae en 24.
- Respuesta: `application/json`, ~9–12 KB, sin paginación.
- Códigos: `200` OK · `401` token inválido · `503` token no configurado en el servidor.
- Sin PII: no hay nombre, teléfono ni email de clientes. Solo agregados y conteos.
- Idempotente y de solo lectura: se puede llamar tantas veces como se quiera.

Ventaja: no hay secretos compartidos en el otro sentido, no hay acoplamiento a su esquema y
sobrevive a cambios internos. Si su scheduler falla, al reintentar obtiene el estado actual.

## Opción B — el chatbot hace push a Mission Control

    POST <MC_INGEST_URL>
    Authorization: Bearer <MC_INGEST_TOKEN>
    Content-Type: application/json

Cuerpo: el mismo objeto de la Opción A, más `action` (texto: "qué corregir hoy").
Se dispara cada 2 h al cerrar la corrida del monitor. Requiere que `MC_INGEST_URL` sea alcanzable
públicamente desde Vercel (hoy devuelve `fetch failed`).

## Forma de la respuesta (claves reales, verificadas)

```json
{
  "ok": true,
  "source": "unitec-chatbot",
  "project": "chatbot-bi-front-desk",
  "generatedAt": "2026-10-23T18:05:11.402Z",
  "bogota": { "iso": "...", "dayKey": "2026-10-23", "hm": "13:05", "hour": 13 },
  "windowHours": 24,
  "baseUrl": "https://www.chatbuildinginnovation.us",
  "status": "green",
  "kpis": {
    "totalSessions": 4649,
    "byBrand": {
      "unitec": {
        "sessions": 22, "realConversations": 18, "contacts": 0, "escalations": 3,
        "humanAssigned": 0, "completed": 8, "abandonedAtGreeting": 4, "avgUserMessages": 1.8
      }
    }
  },
  "funnel": {
    "total": 4649, "testsExcluded": 120,
    "steps": [
      { "step": "load", "label": "Sesión creada (widget abierto)", "reached": 4649, "pctOfTotal": 100, "droppedBefore": 0, "stoppedHere": 0 }
      // greeted, name, phone, profession, menu, engaged
    ]
  },
  "escalations": {
    "windowHours": 24,
    "requested": 3, "attended": 3, "attendanceRate": 100,
    "undelivered": 0, "undeliveredSessions": [],
    "slaFailed": 0, "slaFailedSessions": [],
    "stuckRequested": 0, "stuckSessions": [],
    "staffNoShow": 0, "unattendedClosed24h": 0
  },
  "escalationHealth": { "at": "...", "ok": true, "delivered": ["telegram", "email"], "failed": [], "failStreak": 0 },
  "priceIntegrity": { "ok": true, "source": "live", "checked": 293, "mismatches": 0, "unitMismatches": 0 },
  "services": { "widget": { "ok": true }, "gemini": "up", "voice": true },
  "monitor": { "last": { "at": "...", "status": "green", "chat": { "passed": 3, "total": 3, "p50": 2500 } }, "runs": [ /* últimas 12 */ ] },
  "slos": [
    { "id": "chat_probes", "label": "Sondas del chat en verde", "target": "100%", "actual": "3/3", "ok": true }
    // escalation_delivery, staff_attendance, stuck_queue, price_integrity
  ],
  "meta": { "durationMs": 4800, "note": "Agregados. Sin PII. Sesiones de prueba excluidas." }
}
```

## Definiciones (para que los números coincidan con el panel)

| Campo | Significado |
|---|---|
| `kpis.byBrand.<marca>.sessions` | sesiones activas en la ventana (`createdAt` dentro de la ventana) |
| `realConversations` | sesiones donde el cliente escribió al menos un mensaje (`analytics.userMessageCount > 0`) |
| `contacts` | sesiones con teléfono capturado (`customerPhone` o `extractedData.phone`) |
| `escalations` | sesiones con `analytics.escalationCount > 0` (pidieron asesor o cotización) |
| `humanAssigned` / `completed` | estado actual de la sesión |
| `abandonedAtGreeting` | abrieron el widget y nunca escribieron (estado `abandoned_at_greeting`) |
| `escalations.attendanceRate` | de las solicitudes de la ventana, cuántas quedaron atendidas |
| `escalations.stuckRequested` | siguen en `human_requested` hace más de 1 h (debería ser 0) |
| `escalations.unattendedClosed24h` | cerradas por el sweep como `unattended_staff` / `staff_inactive` |
| `slos[].ok` | `null` cuando aún no hay dato (no significa fallo) |

Ventana y zona horaria: los cálculos usan America/Bogota para el día, y la ventana es móvil
(últimas N horas), no "hoy".

Excluido siempre: sesiones de diagnóstico del monitor (`test-monitor-…`, `test-…`, `diag…`).
Por eso `funnel.testsExcluded` puede ser distinto de `kpis.totalSessions` si se comparan ventanas.

## Marca "building" (Building Innovation)

El mismo backend sirve las dos marcas. Aparecerá `kpis.byBrand.building` solo cuando el widget
esté instalado en https://www.building-innovation.us/ con:

    <script src="https://www.chatbuildinginnovation.us/building-chatbot.js"></script>

Mientras no esté instalado, `byBrand` no trae la clave `building` y el reporte de Juan sería cero.

## Reintentos y salud

- Si el endpoint devuelve 503, falta `MC_EXPORT_TOKEN` en el proyecto (no es un fallo de red).
- `generatedAt` permite detectar datos viejos: si tiene más de 3 h, alertar.
- `monitor.last.at` es la última corrida del watchdog (cada 2 h); si se atrasa más de 3 h, alertar.
