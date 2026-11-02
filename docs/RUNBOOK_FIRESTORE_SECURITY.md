# Runbook — Cierre de seguridad Firestore (reglas v3) — para aplicar UNA vez

Estado: archivo `firestore.rules.v3` listo y PROBADO contra el emulador local
(12/12 pruebas: el chat anónimo sigue funcionando, la puerta de escritura de `config/main` queda cerrada).

## Qué cambia (un solo cambio quirúrgico)

| Ruta | Antes | Ahora |
|---|---|---|
| `config/main` write | público (cualquiera podía sobrescribir precios, prompt, trainingData, telegramChatId) | solo autenticado (panel con login, o endpoints del servidor que firman con token) |
| `config/main` read | público | público (el widget lo necesita: precios, greeting, trainingData) |
| `conversations` / `messages` | público | SIN CAMBIO (el widget escribe anónimo por diseño — el plan de autenticar el widget es fase 2) |
| resto de colecciones | — | SIN CAMBIO |

## Cómo aplicarlo (comando exacto, en la máquina del owner)

    cd ~/UniTEC-Front-desk
    firebase deploy --only firestore:rules --project chatbot-bi-front-desk

## Rollback (si algo se rompiera — no debería, las reglas están probadas)

    git checkout firestore.rules && firebase deploy --only firestore:rules --project chatbot-bi-front-desk

## Verificación posterior (la hace Hermes, server-side)

1. `GET /api/chat` sigue en 200 y responde en <10 s.
2. Una conversación nueva del widget real se crea sin error (`conversations/<nuevo-id>` aparece en el store).
3. Probar que un POST anónimo a config/main desde afuera devuelve PERMISSION_DENIED.

## Qué queda abierto (fase 2, decisión del cliente)

- La LECTURA anónima de conversaciones (PII). Cerrarla exige que el widget inicie sesión anónima
  al cargar (cambio de código cliente) — plan separado, con pruebas, sin tocar la UI visible.
- Rate limiting por instancia (Upstash) — opcional.
