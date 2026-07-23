# Guía de Flujo de Trabajo y Sistema Centinela AI

Esta guía explica el flujo de trabajo del **Centinela AI (Sentinel)**, la integración de notificaciones, y cómo monitorear y ajustar el comportamiento del chatbot a través del Panel de Administración (Admin Dashboard).

---

## 1. El Centinela AI (Sentinel)

El **Centinela AI** es un proceso en segundo plano diseñado para analizar de manera continua los datos, los resultados y las interacciones del chatbot. Su objetivo principal es asegurar un rendimiento óptimo, recordando el contexto de la memoria, detectando posibles problemas o caídas en la calidad de respuesta, y enviando reportes automatizados.

### ¿Cómo funciona?
- **Recopilación de Analíticas:** Diariamente, el sistema recopila información sobre las interacciones, las intenciones más populares (ej. ventas, preguntas frecuentes, soporte), el total de mensajes y las conversaciones con posibles fallos.
- **Análisis Ejecutivo:** Utilizando la Inteligencia Artificial (Gemini Pro), el Centinela procesa estos datos y redacta un "Resumen Ejecutivo". Este resumen extrae perspectivas clave, detecta patrones de error (por ejemplo, si los clientes se quedan atascados en algún punto) y recomienda áreas de mejora.
- **Alertas y Notificaciones:** El resumen y cualquier alerta crítica se envían automáticamente a través de los canales configurados (WhatsApp vía Sent.dm y reportes en Telegram).

---

## 2. Configuración y Notificaciones

El sistema cuenta con un sistema de notificaciones altamente confiable que utiliza **Sent.dm** como servicio principal y **Twilio** como respaldo. Además, se envían reportes a **Telegram**.

### Panel de Administración (Admin Dashboard)
Para acceder a los ajustes, navega a `https://tu-dominio.vercel.app/?admin=true` y accede a la sección de configuración.

#### Opciones Disponibles en el Panel:

1. **Pestaña "REPORTES TELEGRAM" (o TELEGRAM BOT):**
   - **Telegram Bot Token:** Aquí introduces el token proporcionado por BotFather en Telegram (ej. `123456789:ABCDefghIJKL...`).
   - **Telegram Chat IDs:** Los IDs numéricos de los chats, grupos o canales donde deseas recibir los reportes diarios y alertas. Puedes ingresar múltiples IDs separados por comas.
   - **Hora de Envío (Dispatch Hour):** Te permite configurar a qué hora del día (0-23) deseas recibir el reporte automático.
   - *Nota:* Una vez guardada la configuración, el cronograma en Vercel o el sistema interno despachará automáticamente los análisis ejecutivos a estos canales.

2. **Integración con Sent.dm (WhatsApp/SMS):**
   - En el Dashboard encontrarás una tarjeta dedicada a **"Sent.dm Integration"**.
   - **API Key:** Permite actualizar la clave de la API en tiempo real (la actual termina en `3b1b`).
   - **Destinatario:** Configura el número de destino para las alertas críticas (ej. `+573142332147`).
   - **Prueba de Conexión:** Puedes hacer clic en el botón de prueba para enviar un mensaje simulado y validar que el enrutamiento a través del proxy seguro está funcionando.

---

## 3. Monitoreo de Interacciones y Memoria (100%)

Para asegurar que el chatbot mantenga el 100% de la memoria y la calidad interactiva:

- **Sección de Analíticas (Insights):** Revisa regularmente las métricas generadas. El Centinela resalta "Menciones Clave" y "Temas Constantes". Si notas que los usuarios repiten muchas dudas, significa que la memoria base o el conocimiento del bot requiere actualización.
- **Visualización de Conversaciones:** En el panel de control, puedes observar las transcripciones. Si el chatbot muestra demoras o no responde, verifica las **Alertas de Sistema**.
- **Ajustes y Acomodación:** Basado en los reportes del Centinela, puedes volver al menú de **Ajustes del Sistema (Entrenamiento / Prompting)** para modificar el comportamiento, afinar la personalidad del bot, o inyectar nuevas reglas (por ejemplo, corregir respuestas específicas).

### Solución Rápida de Problemas (Troubleshooting)
- **El chatbot no responde o tarda mucho:**
  - El sistema tiene un mecanismo de "Timeout" de seguridad (6 a 7 segundos). Si la IA externa (Google Gemini) tarda más que eso, el chatbot emitirá un mensaje de respaldo para no dejar al usuario esperando.
  - Verifica en el Dashboard que la clave `GEMINI_API_KEY` (formato `AQ...`) esté activa y que no hayas excedido las cuotas de uso de Google Cloud.
- **Fallo en envío de WhatsApp:**
  - El flujo principal intenta usar **Sent.dm**. Si Sent.dm falla (por credenciales inválidas o indisponibilidad del servidor), automáticamente se intenta con **Twilio**. Todo esto queda registrado silenciosamente en los logs del servidor para no interrumpir al usuario.

---

## 4. Flujo Resumido para el Administrador
1. **Día a Día:** No es necesario intervenir manualmente en los chats. El chatbot atiende a los usuarios con todo su conocimiento.
2. **Revisión de Alertas:** Si ocurre algo urgente, recibirás un mensaje de WhatsApp gracias a la API de Sent.dm.
3. **Análisis Diario:** A la hora configurada, recibe tu reporte automático en Telegram.
4. **Mejora Continua:** Abre el Panel de Administración (Admin Dashboard), lee los hallazgos del Centinela, ajusta el entrenamiento y guarda los cambios para acomodar y mejorar el servicio de inmediato.
