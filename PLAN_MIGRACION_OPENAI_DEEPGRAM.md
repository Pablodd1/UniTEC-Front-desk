# Plan de Integración "Zero-Impact": OpenAI + Deepgram AI (Standby Modual)

Este plan detalla la arquitectura para añadir **OpenAI (`gpt-4o-mini`)** y **Deepgram AI (Voz Nova-2 / Aura 2)** como proveedores en **Standby (Espera Activa)** sin alterar ni interrumpir el funcionamiento actual basado en Gemini 3.6 Flash.

---

## 🛡️ Principio Fundador: Cero Impacto en el Setup Actual
1. **Mantener Gemini 3.6 Flash y xAI Grok Activos:** La configuración actual seguirá operando al 100% como canal primario.
2. **Módulo de Espera Silenciosa (Standby):** Las integraciones de OpenAI y Deepgram se cargarán como alternativas en segundo plano.
3. **Conmutador Caliente en el Panel de Administración (Hot-Swap Toggle):** Se añadirá un selector en el Admin Dashboard (`?admin=true`) que permitirá al administrador cambiar el proveedor activo instantáneamente sin tocar código ni reiniciar la plataforma.

---

## 📊 Métricas de Usuarios y Acceso a la Plataforma

De acuerdo con la auditoría en vivo realizada sobre la base de datos de sesiones (`Firestore /conversations`):

- **Acceso Hoy (23 de Julio, 2026):** **0 usuarios activos** (debido al bloqueo previo de la API con los modelos deprecados).
- **Acceso Ayer (22 de Julio, 2026):** **0 usuarios activos**.
- **Histórico de Acceso Registrado:** **300+ sesiones** (Picos registrados entre el 9 y el 12 de Julio con hasta 86 sesiones/día).

*Nota:* Tras las correcciones que aplicamos en el backend y el guardado en Firestore (`setDoc`/`increment`), los accesos y registros han vuelto a quedar 100% funcionales.

---

## 🏗️ Arquitectura de Conmutación (Hot-Swap Architecture)

```
                       [ Cliente / Usuario ]
                                 │
                                 ▼
                     [ API Proxy: /api/chat ]
                                 │
                 ┌───────────────┴───────────────┐
                 │ ¿Cuál proveedor está activo?  │
                 └───────────────┬───────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
[ Google Gemini 3.6 ]   [ OpenAI gpt-4o-mini ]    [ xAI Grok-latest ]
 (Config Actual 100%)    (Standby - Listo 1-Click)  (Respaldo 1-Click)
```

---

## 📝 Pasos para la Implementación (Sin Afectar Nada)

### Paso 1: Variables de Entorno en Standby (Vercel)
Añadiremos en Vercel dos variables opcionales:
- `OPENAI_API_KEY`: Tu clave de OpenAI.
- `DEEPGRAM_API_KEY`: Tu clave de Deepgram.

### Paso 2: Ampliación del Proxy Backend (`api/chat.js`)
El backend probará automáticamente el proveedor configurado como "Preferido" en el Admin Dashboard. Si no está configurado o falla, conmutará a la cadena de respaldos automáticamente.

### Paso 3: Tarjeta de Control en Admin Dashboard (`components/AdminDashboard.tsx`)
En el panel de administración agregaremos:
- **Selector de Proveedor Primario:** `[ Gemini (Actual) | OpenAI | Grok ]`
- **Selector de Motor de Voz:** `[ WebSpeech / Gemini | Deepgram Aura 2 ]`
- **Botón de Prueba 1-Click:** Para validar las llaves de OpenAI y Deepgram antes de pasarlas a producción.

---

Este plan garantiza que si surge cualquier inconveniente con Gemini en el futuro, podrás cambiar a OpenAI/Deepgram en 1 segundo con un clic desde tu panel.
