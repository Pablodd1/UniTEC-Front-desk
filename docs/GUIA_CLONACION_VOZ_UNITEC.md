# Guía de clonación de voz — UNITEC USA DESIGN (llamada de voz del chatbot)

Objetivo: crear la voz clonada del dueño en Grok Voice (xAI) y conectarla a la llamada de voz
del chatbot. Es un cambio de `voice_id`: misma latencia, mismo comportamiento, misma interfaz.

Tiempo total: 10–15 minutos (grabar toma 2, la plataforma tarda menos de 2).

---

## 1. Requisitos técnicos (esto define si el clon suena bien o suena a robot)

- **Micrófono:** USB o condensador de calidad. Los audífonos del celular sirven, pero el siseo
  se clona también.
- **Cuarto:** pequeño, con muebles/superficies suaves (sala, clóset con ropa, cuarto alfombrado).
  Un cuarto con paredes duras y vacío mete eco, y el eco queda en la voz clonada.
- **Silencio total:** apagar aire acondicionado, ventilador, nevera cercana, notificaciones.
  Todo ruido de fondo se reproduce en el clon.
- **Un solo hablante.** Sin música, sin segunda voz, sin efectos.
- **Filtro antipop / pop filter** si hay: las "p" y "b" salen como golpes sin filtro.
- **Duración:** máximo 120 segundos. Menos de 30 s pierde detalle. Objetivo: **1:50 – 1:55**.
- **Ubicación:** la función de voces personalizadas de xAI solo está disponible en Estados Unidos
  (excepto Illinois). La cuenta debe estar en esa región.
- **No se puede clonar desde un archivo de audio existente.** xAI exige grabar en vivo desde la
  consola y leer una frase de verificación: así confirma que la voz es del dueño y que hay
  consentimiento. No hay forma de saltarse ese paso.

---

## 2. Paso a paso en la consola (para el dueño de la voz)

1. Entrar a **https://console.x.ai** con la cuenta del equipo (la misma del API key `XAI_API_KEY`).
2. Ir a **Voice Library** (menú de la izquierda).
3. Clic en **Create custom voice** / **Crear voz personalizada**.
4. Poner el nombre: `UNITEC - Voz Principal` (queda dentro de las 30 voces gratis del equipo).
5. La consola pide leer una **frase de verificación** en voz alta, en vivo. Leerla tal cual, con
   el mismo micrófono que se va a usar para la toma. Esto confirma identidad y consentimiento.
6. Inicia la grabación y leer el guion de la sección 3 (una sola toma continua, menos de 2:00).
7. Al terminar, la plataforma procesa y entrega el modelo en menos de 2 minutos.
8. En la tarjeta de la voz nueva: menú de tres puntos (⋯) → **Copy Voice ID**.
9. Ese ID tiene **8 caracteres** (ejemplo: `nlbqfwie`). Enviarlo de vuelta — con eso se conecta.

Nota: si el resultado no convence, se puede borrar la voz y repetir la toma. No cuesta nada y no
hay límite de intentos; solo el límite de 30 voces guardadas al mismo tiempo.

---

## 3. Guion de grabación (español colombiano, ~1:52)

Leer **como si estuviera atendiendo una llamada real**, no como locutor de radio. Tono cálido,
tuteo cordial, sin apelativos cariñosos. Los `…` son pausas naturales de medio segundo; no hay
que contarlas, solo respirar.

### Bloque 1 — saludo y calificación (~25 s)

> ¡Hola, buenas tardes! Hablas con UNITEC USA DESIGN. ¿En qué te puedo ayudar hoy? … Claro que sí,
> con gusto. ¿Buscas lámina para cielo raso, panel WPC para pared, piso SPC, o cubierta para techo?
> … Perfecto. Trabajamos PVC, WPC y SPC, así que tenemos varias opciones según el espacio y el
> presupuesto.

### Bloque 2 — datos para cotizar (~30 s)

> Para cotizarte bien necesito tres datos: el área en metros cuadrados, si el techo es interior o
> exterior, y en qué ciudad está la obra. … Si el área te la dan en pies, no hay problema, yo hago
> la conversión. … ¿La instalación la haces tú, o necesitas que también te la cotice? … Perfecto,
> ya con eso tengo lo que necesito.

### Bloque 3 — precio, stock y envío (~30 s)

> Sobre el precio: la lámina de PVC blanca brillante está en veintinueve mil pesos la unidad, y la
> línea WPC depende del acabado. … Stock tenemos disponible en varias referencias; si confirmas
> hoy, mañana mismo sale despachado. … El envío lo cotizamos según la ciudad y el volumen, porque
> el material es liviano pero ocupa espacio. … Con gusto te armo la cotización por escrito y te la
> envío por WhatsApp.

### Bloque 4 — showroom y cierre (~25 s)

> Si prefieres ver las muestras, tenemos showroom en Miami, en la 6100 Northwest 74th Avenue, y la
> atención es con cita previa. … Yo te agendo para esta semana si quieres. … Listo, entonces quedo
> pendiente de tu confirmación. Muchas gracias por llamar a UNITEC, que tengas muy buen día.
> ¡Hasta luego!

**Control de tiempo:** si la toma pasa de 2:00, cortar la primera frase del Bloque 4
("Si prefieres ver las muestras…") y arrancar en "Tenemos showroom en Miami…". Si queda por
debajo de 1:40, repetir el Bloque 2 un poco más despacio.

---

## 4. Cómo leerlo (esto es lo que más afecta el resultado)

- Leer el guion **dos veces antes** en voz alta para no tropezar. Durante la grabación mirarlo
  solo de reojo: si suena leído, el clon va a sonar leído para siempre.
- Variar el ritmo: una frase rápida, una pausada, como en una llamada real.
- No sobre-articular ni "voz de presentador". El modelo copia la personalidad, no solo el timbre.
- Sonreír al hablar en el saludo y en el cierre: cambia el resultado.
- Si se equivoca, **no reiniciar la toma**: seguir hablando y repetir la frase con naturalidad.
  Una toma continua siempre suena mejor que una toma perfecta y tensa.
- Grabar 2 o 3 tomas y quedarse con la más natural, no con la más limpia.

---

## 5. Errores que arruinan el clon

| Error | Consecuencia |
|---|---|
| Grabar en cuarto con eco | El clon suena "en baño", se nota en cada llamada |
| Aire acondicionado o ventilador encendido | Zumbido permanente en todas las respuestas |
| Leer como locutor | El bot suena a anuncio, no a asesor |
| Tomar menos de 30 s | Timbre inestable, cambia entre frases |
| Hablar en inglés y usar el clon para español | El acento se mantiene; hay que grabar en el idioma principal |
| Grabar con audífonos Bluetooth | Compresión y cortes; el clon los reproduce |

---

## 6. Opcional: versión en inglés (segundo modelo aparte)

El clon conserva el acento del audio original. Si se quiere una voz en inglés con acento nativo,
hay que crear **otra** voz personalizada grabando este texto (~1:45), y se usará solo cuando el
cliente hable inglés:

> Hi, good afternoon! You've reached UNITEC USA DESIGN. How can I help you today? … Of course,
> happy to help. Are you looking for PVC ceiling panels, WPC wall panels, SPC flooring, or a
> roofing cover? … Great. We work with PVC, WPC and SPC, so we have a few options depending on the
> space and the budget. … To quote you properly I need three things: the area in square feet or
> square meters, whether the ceiling is interior or exterior, and the city where the job is
> located. … About pricing: the white glossy PVC panel is twenty-nine thousand pesos per unit, and
> the WPC line depends on the finish. … We have stock available on several references, and shipping
> is quoted by city and volume. … If you'd like to see the samples, we have a showroom in Miami, at
> 6100 Northwest 74th Avenue, by appointment only. … I'll send you the written quote on WhatsApp.
> Thank you for calling UNITEC, have a great day. Goodbye!

---

## 7. Qué enviar de vuelta

1. El **voice_id** de 8 caracteres de la voz en español (obligatorio).
2. El **voice_id** de la voz en inglés, solo si se grabó la sección 6.
3. Confirmación de que la cuenta de xAI es de Estados Unidos.

Con eso se configura la variable `XAI_VOICE_ID` en Vercel, se despliega y se verifica que la
sesión de voz negocie la voz nueva. El código ya está preparado: sin la variable sigue usando la
voz integrada `celeste`, así que no hay riesgo de dejar la llamada sin voz.
