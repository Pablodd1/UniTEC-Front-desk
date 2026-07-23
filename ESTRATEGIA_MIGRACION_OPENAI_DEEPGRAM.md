# Plan Estratégico de Desacoplamiento e Integración: OpenAI + Deepgram AI

Este documento presenta la arquitectura, investigación técnica y plan de implementación para eliminar la dependencia exclusiva de Google Gemini y transformar la plataforma **UniTEC Front Desk** en una arquitectura **Híbrida Multi-IA** con soporte nativo para **OpenAI** (Texto y Razonamiento) y **Deepgram AI** (Voz, Transcripción y Síntesis de Alta Velocidad).

---

## 1. Visión General de la Arquitectura Híbrida Multi-IA

Actualmente, el sistema utiliza un esquema de conmutación por error (Failover). Para evitar interrupciones por cambios en las políticas o modelos de cualquier proveedor, implementaremos una **cadena de proveedores independientes**:

```
[ Solicitud del Cliente (Texto / Voz) ]
               │
               ▼
┌──────────────────────────────────────────────┐
│       PROCESAMIENTO DE VOZ (Deepgram)       │
│  • Transcripción (STT): Nova-2               │
│  • Voz Sintética (TTS): Aura 2               │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│     ORQUESTADOR DE INTELIGENCIA DE TEXTO     │
│  1. Proveedor Primario: OpenAI (gpt-4o-mini) │
│  2. Respaldo 1: xAI Grok (grok-latest)       │
│  3. Respaldo 2: Google Gemini (3.6-flash)    │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
[ Respuesta Inmediata al Cliente + Registro Firestore ]
```

---

## 2. Investigación Técnica: OpenAI API (Texto y Razonamiento)

### ¿Por qué OpenAI?
- **Estabilidad de la API:** La API de Chat Completions de OpenAI (`/v1/chat/completions`) mantiene compatibilidad estándar y modelos de ciclo de vida prolongado.
- **Modelos recomendados:**
  - `gpt-4o-mini`: Ultra rápido, extremadamente económico y perfecto para la recepcionista virtual, ventas y preguntas frecuentes.
  - `gpt-4o`: Para análisis complejos de cotizaciones o requerimientos técnicos pesados.

### Especificaciones Técnicas del Payload

- **Endpoint:** `POST https://api.openai.com/v1/chat/completions`
- **Headers:**
  ```http
  Authorization: Bearer <OPENAI_API_KEY>
  Content-Type: application/json
  ```
- **Estructura del Payload:**
  ```json
  {
    "model": "gpt-4o-mini",
    "messages": [
      {
        "role": "system",
        "content": "Eres el recepcionista virtual de UNITEC USA Design..."
      },
      {
        "role": "user",
        "content": "Hola, ¿cuál es su horario de atención?"
      }
    ],
    "temperature": 0.7
  }
  ```

---

## 3. Investigación Técnica: Deepgram AI (Voz STT y TTS)

### ¿Por qué Deepgram?
Deepgram ofrece la menor latencia del mercado (~200ms) para conversión de voz a texto (STT) y de texto a voz (TTS), superando por amplio margen a la síntesis del navegador (WebSpeech) y a los modelos de voz tradicionales.

### A. Reconocimiento de Voz (Speech-to-Text - Nova-2)
- **Endpoint:** `POST https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=es`
- **Headers:**
  ```http
  Authorization: Token <DEEPGRAM_API_KEY>
  Content-Type: audio/wav (o audio/mp3)
  ```
- **Funcionamiento:** Envía el audio binario capturado por el micrófono y devuelve el texto transcrito con puntuación automática en menos de 200ms.

### B. Síntesis de Voz (Text-to-Speech - Aura 2)
- **Endpoint:** `POST https://api.deepgram.com/v1/speak?model=aura-2-thalia-en` (o voces en español)
- **Headers:**
  ```http
  Authorization: Token <DEEPGRAM_API_KEY>
  Content-Type: application/json
  ```
- **Payload:**
  ```json
  {
    "text": "¡Hola! Bienvenido a UNITEC USA Design. ¿En qué te puedo ayudar hoy?"
  }
  ```
- **Resultado:** Devuelve el archivo de audio en streaming listo para reproducir en las llamadas de la pestaña "Llamada Virtual".

---

## 4. Cambios a Realizar en el Panel de Administración (Admin Dashboard)

En la sección de ajustes del Admin Dashboard (`?admin=true`), añadiremos:

1. **Selector de Proveedor Principal de IA:**
   - Opción para elegir entre **OpenAI (Recomendado)**, **Google Gemini**, o **xAI Grok**.
2. **Tarjeta de Credenciales de OpenAI:**
   - Campo para ingresar `OPENAI_API_KEY` y probar conexión.
3. **Tarjeta de Credenciales de Deepgram:**
   - Campo para ingresar `DEEPGRAM_API_KEY` y probar síntesis de voz (TTS) y transcripción (STT).

---

## 5. Plan de Implementación Sugerido

1. **Paso 1:** Añadir los campos de credenciales de OpenAI y Deepgram en `api/chat.js` y `services/geminiService.ts`.
2. **Paso 2:** Configurar OpenAI (`gpt-4o-mini`) como el primer motor en la cadena de fallos.
3. **Paso 3:** Integrar Deepgram para las llamadas de voz en `components/CallTab.tsx`.
4. **Paso 4:** Actualizar el Panel de Administración para permitir cambiar de proveedor con un solo clic.
