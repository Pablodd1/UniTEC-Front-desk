# Runbook — "Visitas Web" con GA4 (Google Analytics 4) — acciones del cliente

El endpoint `/api/ga-visits` y el cron diario (13:00 UTC) YA existen en producción. Solo faltan
dos variables en Vercel. Hoy devuelve `{configured:false}` y el panel muestra "sin conectar".

## Paso 1 — crear la propiedad GA4 (si no existe)

1. Entrar a https://analytics.google.com con la cuenta Google del cliente.
2. Admin → Crear propiedad → nombre "UNITEC Chatbot" (o la que corresponda) → Crear.
3. Anotar el **ID de propiedad numérico** (Admin → Configuración de la propiedad:
   es un número, NO el "G-XXXXXX").

## Paso 2 — crear la cuenta de servicio

1. https://console.cloud.google.com → proyecto (o crear uno) → IAM y administración →
   Cuentas de servicio → Crear cuenta de servicio.
2. Nombre: `ga-reader`. Rol: **Lector de Analytics** (`roles/analytics.viewer`).
3. En la cuenta creada: Claves → Agregar clave → Crear clave nueva → JSON → se descarga un archivo.
4. En GA4: Admin → Acceso a la propiedad → agregar el email de la cuenta de servicio
   (`...@<proyecto>.iam.gserviceaccount.com`) con rol **Lector**.

## Paso 3 — variables en Vercel (consola → Proyecto → Settings → Environment Variables)

| Nombre | Valor |
|---|---|
| `GA4_PROPERTY_ID` | el ID numérico del Paso 1 |
| `GA_SERVICE_ACCOUNT_JSON` | TODO el contenido del JSON descargado en el Paso 2 (una sola línea, o base64) |

Desplegar de nuevo (Redeploy) para que las tomen las funciones.

## Verificación (la hace Hermes después)

1. `https://www.chatbuildinginnovation.us/api/ga-visits` → `{configured:true}`.
2. Al día siguiente (después del cron 13:00 UTC), `config/main.googleAnalyticsVisits` tiene datos
   y el panel "Visitas Web (GA)" deja de mostrar "sin conectar".
