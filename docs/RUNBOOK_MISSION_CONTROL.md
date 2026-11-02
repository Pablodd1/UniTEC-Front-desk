# Runbook — Mission Control: la integración YA está lista; falta el lado de ellos

Contrato completo en `docs/MISSION_CONTROL_INTEGRATION.md` (endpoint verificado 2026-10-23).

Estado 2026-11-02 (verificado en vivo):
- Opción A (recomendada, PULL): `GET https://www.chatbuildinginnovation.us/api/mission-control-export?window=24`
  con `Authorization: Bearer <token>` responde 401 sin token y 200 con token → OPERATIVO.
- Opción B (PUSH): el monitor lo intenta cada 2 h, pero `MC_INGEST_URL` no está configurada en
  Vercel (log: `fetch failed`). Requiere que el equipo de Mission Control dé la URL de ingesta.

## Acción del cliente (una sola, cualquiera de las dos)

A) PULL (cero trabajo de nuestro lado): que Mission Control programe un fetch cada hora al
   endpoint de arriba con el token acordado. El token `MC_EXPORT_TOKEN` ya está en Vercel;
   solo hay que compartirlo por el canal seguro con su equipo.

B) PUSH: que Mission Control entregue la URL de ingesta (y token si lo piden). Se agregan a
   Vercel como `MC_INGEST_URL` y `MC_INGEST_TOKEN`, redeploy, y el push queda automático cada 2 h
   (reporte del monitor + action "qué corregir hoy").

## Verificación (la hace Hermes)

A) El log del endpoint muestra requests con token válido (o Mission Control confirma datos frescos).
B) `config/main.monitor.runs.last.missionControl.ok` pasa a `true` en la corrida siguiente al
   redeploy, y el reporte de Nancy deja de listar Mission Control como no conectado.
