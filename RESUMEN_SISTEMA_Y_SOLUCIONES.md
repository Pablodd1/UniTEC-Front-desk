# Resumen Ejecutivo: Historial de Problemas, Soluciones y Plan de Voz Deepgram AI

Este documento preserva la memoria técnica del sistema, consolidando los fallos detectados en el pasado, sus causas raíz, las soluciones definitivas implementadas y la arquitectura propuesta para la llamada de voz con **Deepgram AI**.

---

## 1. Historial de Problemas y Soluciones Definitivas

| Problema Detectado | Causa Raíz Identificada | Solución Implementada | Estado |
| :--- | :--- | :--- | :---: |
| **Chatbot No Responde en Vivo (Errores 401/404)** | Google eliminó los modelos antiguos (`gemini-1.5-flash` y `gemini-2.0-flash-001`) de la API REST. | Actualización a **Gemini 3.6 Flash** + Failover automático a **xAI Grok (`grok-latest`)** + Auto-Descubrimiento Dinámico de modelos. | ✅ RESUELTO |
| **Pantalla Atascada en "Pensando..."** | El proxy `/api/chat` devolvía cadenas de texto simples, pero el frontend leía `chunk.text` (`undefined`), dejando el texto vacío. | Extractor inteligente en `ChatTab.tsx` y `geminiService.ts`: `typeof chunk === 'string' ? chunk : ...`. | ✅ RESUELTO |
| **Errores de Base de Datos (ReferenceError: setDoc)** | Faltaban las importaciones `setDoc` e `increment` en `conversationService.ts`. | Se agregaron las importaciones correctas de Firebase Firestore. | ✅ RESUELTO |
| **Advertencia de Tailwind CSS en Producción** | El sitio dependía de un `<script>` CDN en `index.html`. | Migración a PostCSS estático (`tailwind.config.js`, `postcss.config.js`, `index.css`). | ✅ RESUELTO |
| **Favicon 404** | El navegador no encontraba `favicon.ico`. | Se creó el archivo en la carpeta `public/`. | ✅ RESUELTO |

---

## 2. Diagnóstico del Sistema de Llamada de Voz Actual (`CallTab.tsx`)

### ¿Por qué la llamada de voz actual tiene fallas o latencia?
Actualmente, la pestaña de llamada virtual (`CallTab.tsx`) depende de las APIs nativas del navegador:
1. **`webkitSpeechRecognition` (Entrada de Voz):**
   - Se desconecta automáticamente tras 2 a 3 segundos de silencio.
   - Requiere permisos de micrófono repetitivos en móviles/Safari.
   - Tiene baja precisión con acentos o ruido de fondo.
2. **`window.speechSynthesis` (Salida de Voz):**
   - La voz suena robótica o inestable según el dispositivo del usuario.
   - Presenta latencias altas e inconsistentes antes de empezar a hablar.

---

## 3. Solución Propuesta: Integración de Deepgram AI para Voz (`CallTab.tsx`)

Para solucionar definitivamente la llamada de voz sin alterar la lógica de negocio ni la interfaz:

```
[ Usuario Habla en Llamada ]
              │
              ▼ (Audio Binario)
┌──────────────────────────────────────────────┐
│ 1. Deepgram Nova-2 (STT - Speech to Text)    │
│    • Transcripción ultra rápida (< 200ms)    │
│    • Alta precisión en español e inglés      │
└──────────────────────┬───────────────────────┘
                       │ (Texto Transcrito)
                       ▼
┌──────────────────────────────────────────────┐
│ 2. Backend /api/chat Proxy (Motor de IA)    │
│    • Genera la respuesta del recepcionista   │
└──────────────────────┬───────────────────────┘
                       │ (Texto de Respuesta)
                       ▼
┌──────────────────────────────────────────────┐
│ 3. Deepgram Aura 2 (TTS - Text to Speech)   │
│    • Genera audio de voz humana natural      │
│    • Reproducción inmediata en el navegador  │
└──────────────────────────────────────────────┘
```

### Ventajas de Deepgram para la Llamada:
- **Voz Humana Ultra-Natural:** Las voces de Deepgram Aura suenan como una recepcionista real.
- **Cero Cortes:** El reconocimiento de voz Nova-2 no se desconecta por silencios breves.
- **Respaldo Transparente:** Si no hay clave de Deepgram activa, la llamada conmuta automáticamente a la síntesis del navegador como respaldo.

---

## 4. Archivos a Crear / Modificar
1. **`api/deepgram-tts.js`**: Endpoint serverless proxy para sintetizar voz con Deepgram Aura 2 de forma segura.
2. **`api/deepgram-stt.js`**: Endpoint serverless proxy para transcribir audio con Deepgram Nova-2.
3. **`services/deepgramService.ts`**: Cliente en el frontend para gestionar la llamada y reproducción de audio.
4. **`components/CallTab.tsx`**: Actualización para conectar la interfaz con Deepgram cuando esté disponible.
