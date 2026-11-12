<!-- converted from Informe_Embudo_Septiembre_2026_UniTEC.xlsx -->

## Sheet: Resumen Ejecutivo
| UNITEC USA DESIGN — Embudo real del chatbot · septiembre 2026 (1–15, hora Bogotá) |  |  |  |
| --- | --- | --- | --- |
| Indicador | Valor | Qué significa | Fiabilidad |
| Sesiones creadas | 1020 | Cada apertura del widget crea una sesión. | Verificado |
| Sesiones sin NINGÚN mensaje del usuario | 1012 | Abrieron y no escribieron (o su mensaje solo quedó en la caché del navegador). | Verificado |
|   · de esas, ni el saludo se guardó | 510 | messageCount = 0 en la sesión. | Verificado |
|   · de esas, solo el saludo del bot | 502 | El bot guardó su saludo; el usuario nunca escribió. | Verificado |
| Sesiones con mensaje REAL del usuario | 8 | 0.78% del total (subcolección de mensajes, no contadores). | Verificado |
|   · de esas, clientes reales | 7 | Excluye 1 sesión de prueba técnica. | Verificado |
| Conversaciones reales (4+ mensajes del usuario) | 6 | Interacción efectiva con el asistente. | Verificado |
| Escribieron 1 mensaje y se fueron | 2 | Abandono inmediato tras el primer mensaje. | Verificado |
| Teléfonos capturados (lo que el panel llama "cotizaciones/ventas") | 3 | El KPI de ventas del panel se calcula con este campo. | Verificado |
| Primer mensaje interpretado como "nombre" (bug corregido) | 2 | Preguntas reales guardadas como nombre del cliente. | Verificado |
| "Interactuaron" según el panel del cliente | 510 | El panel usa analytics.messageCount > 0: incluye el saludo del bot y mensajes solo presentes en la caché del navegador. | NO fiable |
| Tasa real de interacción | 0.8% | El panel muestra 50.0%. | Verificado |
| CÓMO LEER ESTOS NÚMEROS |  |  |  |
| 1) La interacción ES baja: de 1020 sesiones, 1012 (99.2%) no tienen ni un mensaje del usuario guardado. No es un problema de visualización. |  |  |  |
| 2) El panel exageraba: contaba 510 "interacciones" porque sumaba el saludo automático del bot y mensajes que solo existían en la caché del navegador. Reales: 8. |  |  |  |
| 3) El embudo por pasos (nombre → teléfono → perfil → menú) no se podía medir: esos pasos corrían solo en el navegador y no dejaban etapa registrada. Ya está corregido (se graba en el servidor desde hoy). |  |  |  |
| 4) Bug corregido: el primer mensaje del visitante se guardaba como su nombre. Casos detectados en la data: Buenas días dónde están ubicados | Hola, quiero saber el precio del piso SPC |  |  |  |
| 5) Con las correcciones desplegadas, el embudo por pasos y el abandono por paso quedan medibles desde ahora en adelante (el histórico no se puede reconstruir). |  |  |  |
## Sheet: Embudo Septiembre
| Embudo paso a paso — dónde se cae el usuario (datos verificados) |  |  |  |  |
| --- | --- | --- | --- | --- |
| Paso del flujo | Sesiones que llegan | % del total | Se detienen aquí | Qué significa |
| 1. Sesión creada (widget abierto) | 1020 | 100.00% | 0 | Todas las aperturas del período. |
| 2. El bot guardó su saludo | 510 | 50.00% | 510 | El panel lo contaba como "interacción": no lo es. |
| 3. El usuario escribió | 8 | 0.78% | 502 | Solo 8 de 1020. Aquí se pierde el 99% del tráfico. |
| 4. Llegó a conversación real (4+ mensajes) | 6 | 0.59% | 2 | Interacción efectiva con el asistente. |
| Nota metodológica | A partir del despliegue de hoy, cada sesión guarda su etapa (funnelStep) y su estado de abandono (abandoned_at_name / phone / profession / completed), así que el embudo por pasos será medible paso a paso. Para el histórico solo se puede distinguir "escribió" / "no escribió". |  |  |  |
## Sheet: Reconciliación Panel
| Panel del cliente vs. datos reales (Firestore) |  |  |  |
| --- | --- | --- | --- |
| KPI del panel | Panel | Real | Por qué difiere |
| Sesiones ingresadas | 974 | 1020 | Diferencia de rango de fechas/hora Bogotá y sesiones creadas después del informe. |
| Sesiones sin interacción | 473 | 1012 | Coincide en concepto: sesiones donde el widget no guardó mensaje del usuario. |
| Conversión / interactuaron | 501 | 8 | El panel cuenta analytics.messageCount > 0 (incluye el saludo del bot y la caché del navegador). |
| Cotizaciones / ventas | 3 | 3 | El KPI se calcula con extractedData.phone: son teléfonos capturados, no cotizaciones cerradas. |
| Asistencias humanas | 2 | 2 | Coincide (status human_assigned). |
| Tasa de conversión | 51.4% | 0.8% | Cambio de definición: interacción real = el usuario escribió. |
| Visitas web (GA) | 3188 | sin dato | Valor por defecto del código; Google Analytics nunca se conectó. |
## Sheet: Conversaciones Reales
| Las 8 sesiones con mensaje real del usuario |  |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Fecha (Bogotá) | ID sesión | Nombre capturado | Teléfono | Mensajes usuario | ¿Conversación real? | Primer mensaje | Tipo |
| 2026-09-01 09:49 | session_1788274178834_8bzediz0m | Buenas días dónde están ubicados | 3224123398 | 8 | Sí | Buenas días dónde están ubicados | CLIENTE REAL |
| 2026-09-02 05:41 | session_1788345696198_i885fo6id | Pedro Ocampo | — | 13 | Sí | Pedro Ocampo | CLIENTE REAL |
| 2026-09-03 20:59 | session_1788487141526_iu81e5h5i | Carlos Arturo Luna Beltrán | — | 5 | Sí | Carlos Arturo Luna Beltrán | CLIENTE REAL |
| 2026-09-06 05:11 | session_1788689492370_e0riaq9h8 | Manuel | — | 1 | No (1 mensaje y se fue) | Manuel | CLIENTE REAL |
| 2026-09-08 09:23 | session_1788877423875_b2qp32ytl | Johrladiz | 3206396036 | 5 | Sí | johrladiz | CLIENTE REAL |
| 2026-09-08 17:21 | session_1788906094683_a4k6ndx6g | En Bogotá | 3115895040 | 5 | Sí | En Bogotá | CLIENTE REAL |
| 2026-09-14 15:03 | session_1789416232703_9vclyxdjw | — | — | 4 | Sí | Hola | CLIENTE REAL |
| 2026-09-15 06:52 | session_1789473142785_yh1pcjpl6 | Quiero saber el precio del piso SPC | — | 1 | No (1 mensaje y se fue) | Hola, quiero saber el precio del piso SPC | PRUEBA TÉCNICA |
## Sheet: Transcripciones
| Transcripciones completas (lo que el bot y el cliente escribieron) |  |  |  |
| --- | --- | --- | --- |
| 2026-09-01 09:49 · session_1788274178834_8bzediz0m · nombre: Buenas días dónde están ubicados · tel: 3224123398 · 8 msgs del usuario |  |  |  |
| USUARIO | Buenas días dónde están ubicados |  |  |
| USUARIO | 3224123398 |  |  |
| USUARIO | 6 |  |  |
| USUARIO | Nesecita un pedido |  |  |
| USUARIO | Daniel gomez |  |  |
| USUARIO | Cual es tu guasap |  |  |
| USUARIO | Nesecita un pedido |  |  |
| USUARIO | Cual es tu guasap |  |  |
| BOT | ¡Un gusto conocerte, Buenas días dónde están ubicados! Cuéntame, ¿cuál es tu número telefónico? (Escribe "saltar" si prefieres no compartirlo) |  |  |
| BOT | ¡Hola! Bienvenido a UNITEC USA DESIGN. Con mucho gusto te ayudamos a tramitar tu pedido.

Para asesorarte de la mejor manera y tomar tu pedido, ¿cuéntame qué productos necesitas o qué área deseas cubrir? Si tienes las medidas aproximadas en metros cuadrados (m²), nos servirá mucho para darte un estimado exacto.

También puedes escribirnos directamente a nuestro WhatsApp oficial para coordinar tu pedido con un asesor: [WhatsApp Oficial UNITEC](https://wa.me/573142332147) o comunicarte con nuestro ejecutivo [Camilo Andres Torres](https://wa.me/573104578337).

¿Con quién tengo el gusto de hablar? |  |  |
| BOT | Ups, tuve un problema momentaneo con la conexion. Por favor envia tu mensaje de nuevo, estoy aqui para ayudarte! Si continua fallando, escribenos por WhatsApp: https://wa.me/573142332147 |  |  |
| BOT | ¡Hola! Puedes escribirnos directamente a nuestro número principal de WhatsApp:

[WhatsApp Oficial UNITEC](https://wa.me/573142332147) (+57 314 233 2147)

También te comparto el contacto directo de nuestros ejecutivos comerciales:

- [Camilo Andres Torres](https://wa.me/573104578337) - Ventas
- [Yuldor Stiven Avendaño](https://wa.me/573105769694) - Ejecutivo Comercial
- [Henderson Patrick Arroyave](https://wa.me/573202174854) - Ejecutivo Marketing

¿En qué producto o proyecto estás interesado para brindarte la mejor información? |  |  |
| BOT | Señor/a, ¿aún continuas en línea? Si no hay respuesta en un minuto, cerraré la conversación. |  |  |
| BOT | ¡Hola! Bienvenido a UNITEC USA DESIGN. Con mucho gusto te ayudamos a tramitar tu pedido.

Para asesorarte de la mejor manera y tomar tu pedido, ¿cuéntame qué productos necesitas o qué área deseas cubrir? Si tienes las medidas aproximadas en metros cuadrados (m²), nos servirá mucho para darte un estimado exacto.

También puedes escribirnos directamente a nuestro WhatsApp oficial para coordinar tu pedido con un asesor: [WhatsApp Oficial UNITEC](https://wa.me/573142332147) o comunicarte con nuestro ejecutivo [Camilo Andres Torres](https://wa.me/573104578337).

¿Con quién tengo el gusto de hablar? |  |  |
| BOT | ¡Hola! Puedes escribirnos directamente a nuestro número principal de WhatsApp:

[WhatsApp Oficial UNITEC](https://wa.me/573142332147) (+57 314 233 2147)

También te comparto el contacto directo de nuestros ejecutivos comerciales:

- [Camilo Andres Torres](https://wa.me/573104578337) - Ventas
- [Yuldor Stiven Avendaño](https://wa.me/573105769694) - Ejecutivo Comercial
- [Henderson Patrick Arroyave](https://wa.me/573202174854) - Ejecutivo Marketing

¿En qué producto o proyecto estás interesado para brindarte la mejor información? |  |  |
| BOT | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alternativas constructivas.

Mi nombre es Decky👷 y estaré por este medio acompañándote a recorrer nuestro portafolio de más de 500 productos y a escoger las mejores opciones constructivas alineadas a tu proyecto.

Antes de continuar quisiera conocerte. Cuéntame, ¿cómo te llamas? |  |  |
| 2026-09-02 05:41 · session_1788345696198_i885fo6id · nombre: Pedro Ocampo · tel: — · 13 msgs del usuario |  |  |  |
| USUARIO | Pedro Ocampo |  |  |
| USUARIO | Saltar |  |  |
| USUARIO | 7 |  |  |
| USUARIO | Quiero consultar el stock y disponibilidad de un producto. |  |  |
| USUARIO | Para pared de un garaje |  |  |
| USUARIO | Para pared interior |  |  |
| USUARIO | Las paredes tienen aproximadamente altura 2,20 metros por 15 metrosr |  |  |
| USUARIO | En wpc, estaría bien,  costo |  |  |
| USUARIO | Quiero consultar el stock y disponibilidad de un producto. |  |  |
| USUARIO | Para pared de un garaje |  |  |
| USUARIO | Para pared interior |  |  |
| USUARIO | Las paredes tienen aproximadamente altura 2,20 metros por 15 metrosr |  |  |
| USUARIO | En wpc, estaría bien,  costo |  |  |
| BOT | ¡Un gusto conocerte, Pedro Ocampo! Cuéntame, ¿cuál es tu número telefónico? (Escribe "saltar" si prefieres no compartirlo) |  |  |
| BOT | Perfecto, ahora para mí es mucho más fácil ayudarte con todo lo que me indicas que se ajuste a tus necesidades. ¿En qué puedo ayudarte hoy? |  |  |
| BOT | ¡Hola! Con gusto te ayudo a consultar el stock y la disponibilidad del producto que necesitas.

¿Podrías decirme qué producto, referencia o color estás buscando, y para qué ciudad o proyecto lo necesitas? Así podré brindarte la información exacta o conectarte directamente con uno de nuestros ejecutivos comerciales. |  |  |
| BOT | ¡Hola! Para la pared de un garaje tenemos opciones excelentes que soportan humedad, son altamente resistentes y le darán un cambio total a tu espacio sin necesidad de grandes obras.

Si es para el interior del garaje, te recomiendo el Foam Board UNITEC o nuestros paneles de pared WPC. Se instalan de forma rápida y limpia con adhesivo de montaje PegaTec, sin generar polvo y ofreciendo una excelente durabilidad.

Si se trata de la pared exterior o la fachada del garaje, la opción ideal es nuestra Fachada Deck UNITEC en tonos Marrón o Cedro, la cual brinda un diseño moderno, elegante y resistente a la intemperie.

Para ayudarte a calcular la cantidad de material y darte un estimado aproximado, ¿cuántos metros cuadrados (m²) tiene la pared que deseas renovar? Por cierto, ¿con quién tengo el gusto de hablar? |  |  |
| BOT | ¡Excelente elección! Para paredes interiores tenemos opciones espectaculares que transforman cualquier espacio sin necesidad de obras complejas ni desorden.

Entre nuestras mejores alternativas destacan:

- Foam Board UNITEC: Paneles decorativos de acabado moderno que se instalan fácil y rápido con nuestro adhesivo de montaje PegaTec, sin generar polvo ni desorden.
- Paneles WPC para Interior: Aportan elegancia, calidez estilo madera y alta durabilidad, siendo además resistentes a la humedad y de cero mantenimiento.

¿Tienes las medidas en metros cuadrados (m²) o las dimensiones aproximadas de la pared que deseas renovar? Cuéntame y te ayudo a calcular lo que necesitas, o si prefieres, te puedo compartir el catálogo de diseños disponibles. |  |  |
| BOT | Con esas medidas de 2,20 metros de alto por 15 metros de ancho, tienes un área aproximada de 33 metros cuadrados.

Para brindarte una estimación adecuada, ¿qué tipo de producto te gustaría instalar? Contamos con opciones como WPC Wall Panel para interiores o exteriores, Foam Board o revestimientos decorativos.

Ten en cuenta que el cálculo de piezas e inversión es un aproximado que varía según la referencia y el tamaño del panel seleccionado. 

Si deseas recibir una cotización detallada de inmediato con nuestro equipo de ventas, puedes escribirnos directamente a nuestro [WhatsApp Oficial](https://wa.me/573142332147) o comunicarte con nuestro asesor [Camilo Andres Torres](https://wa.me/573104578337).

¿Qué material o estilo tienes pensado para tu espacio? |  |  |
| BOT | ¡Excelente elección! El material WPC es ideal por su durabilidad, elegancia, resistencia 100% al agua y cero mantenimiento.

Para poder brindarte un costo aproximado de tu proyecto, ¿nos podrías indicar para qué área lo necesitas (fachada exterior, muro interior, deck) y cuántos metros cuadrados (m²) aproximadamente requieres?

Si deseas recibir la lista de precios y la cotización de forma inmediata con uno de nuestros ejecutivos comerciales, puedes dar clic directamente en el enlace de nuestro WhatsApp oficial:

[WhatsApp UNITEC](https://wa.me/573142332147)

O con nuestro asesor de ventas:
[Camilo Andres Torres](https://wa.me/573104578337)

¡Cuéntame sobre las medidas de tu espacio o el tipo de proyecto y con gusto te guío! |  |  |
| BOT | 💰 He enviado tu solicitud de cotización a nuestro equipo de ventas. Un asesor te responderá en breve. Para atención inmediata, escríbenos por WhatsApp: https://wa.me/573142332147 |  |  |
| BOT | ¡Hola! Con gusto te ayudo a consultar el stock y la disponibilidad del producto que necesitas.

¿Podrías decirme qué producto, referencia o color estás buscando, y para qué ciudad o proyecto lo necesitas? Así podré brindarte la información exacta o conectarte directamente con uno de nuestros ejecutivos comerciales. |  |  |
| BOT | ¡Hola! Para la pared de un garaje tenemos opciones excelentes que soportan humedad, son altamente resistentes y le darán un cambio total a tu espacio sin necesidad de grandes obras.

Si es para el interior del garaje, te recomiendo el Foam Board UNITEC o nuestros paneles de pared WPC. Se instalan de forma rápida y limpia con adhesivo de montaje PegaTec, sin generar polvo y ofreciendo una excelente durabilidad.

Si se trata de la pared exterior o la fachada del garaje, la opción ideal es nuestra Fachada Deck UNITEC en tonos Marrón o Cedro, la cual brinda un diseño moderno, elegante y resistente a la intemperie.

Para ayudarte a calcular la cantidad de material y darte un estimado aproximado, ¿cuántos metros cuadrados (m²) tiene la pared que deseas renovar? Por cierto, ¿con quién tengo el gusto de hablar? |  |  |
| BOT | ¡Excelente elección! Para paredes interiores tenemos opciones espectaculares que transforman cualquier espacio sin necesidad de obras complejas ni desorden.

Entre nuestras mejores alternativas destacan:

- Foam Board UNITEC: Paneles decorativos de acabado moderno que se instalan fácil y rápido con nuestro adhesivo de montaje PegaTec, sin generar polvo ni desorden.
- Paneles WPC para Interior: Aportan elegancia, calidez estilo madera y alta durabilidad, siendo además resistentes a la humedad y de cero mantenimiento.

¿Tienes las medidas en metros cuadrados (m²) o las dimensiones aproximadas de la pared que deseas renovar? Cuéntame y te ayudo a calcular lo que necesitas, o si prefieres, te puedo compartir el catálogo de diseños disponibles. |  |  |
| BOT | Con esas medidas de 2,20 metros de alto por 15 metros de ancho, tienes un área aproximada de 33 metros cuadrados.

Para brindarte una estimación adecuada, ¿qué tipo de producto te gustaría instalar? Contamos con opciones como WPC Wall Panel para interiores o exteriores, Foam Board o revestimientos decorativos.

Ten en cuenta que el cálculo de piezas e inversión es un aproximado que varía según la referencia y el tamaño del panel seleccionado. 

Si deseas recibir una cotización detallada de inmediato con nuestro equipo de ventas, puedes escribirnos directamente a nuestro [WhatsApp Oficial](https://wa.me/573142332147) o comunicarte con nuestro asesor [Camilo Andres Torres](https://wa.me/573104578337).

¿Qué material o estilo tienes pensado para tu espacio? |  |  |
| BOT | ¡Excelente elección! El material WPC es ideal por su durabilidad, elegancia, resistencia 100% al agua y cero mantenimiento.

Para poder brindarte un costo aproximado de tu proyecto, ¿nos podrías indicar para qué área lo necesitas (fachada exterior, muro interior, deck) y cuántos metros cuadrados (m²) aproximadamente requieres?

Si deseas recibir la lista de precios y la cotización de forma inmediata con uno de nuestros ejecutivos comerciales, puedes dar clic directamente en el enlace de nuestro WhatsApp oficial:

[WhatsApp UNITEC](https://wa.me/573142332147)

O con nuestro asesor de ventas:
[Camilo Andres Torres](https://wa.me/573104578337)

¡Cuéntame sobre las medidas de tu espacio o el tipo de proyecto y con gusto te guío! |  |  |
| BOT | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alternativas constructivas.

Mi nombre es Decky👷 y estaré por este medio acompañándote a recorrer nuestro portafolio de más de 500 productos y a escoger las mejores opciones constructivas alineadas a tu proyecto.

Antes de continuar quisiera conocerte. Cuéntame, ¿cómo te llamas? |  |  |
| 2026-09-03 20:59 · session_1788487141526_iu81e5h5i · nombre: Carlos Arturo Luna Beltrán · tel: — · 5 msgs del usuario |  |  |  |
| USUARIO | Carlos Arturo Luna Beltrán |  |  |
| USUARIO | Saltar |  |  |
| USUARIO | Constructor |  |  |
| USUARIO | Consejos para una buena fachada |  |  |
| USUARIO | Consejos para una buena fachada |  |  |
| BOT | ¡Un gusto conocerte, Carlos Arturo Luna Beltrán! Cuéntame, ¿cuál es tu número telefónico? (Escribe "saltar" si prefieres no compartirlo) |  |  |
| BOT | ¡Perfecto! Por último, ¿Cuéntame a que te dedicas? Elige una opción:

1. Arquitecto
2. Constructor
3. Diseñador
4. Distribuidor
5. Mayorista
6. Cliente Final
7. Otro |  |  |
| BOT | ¡Hola! Bienvenido a UNITEC USA DESIGN.

¿Quieres una fachada que impacte y se mantenga impecable por años? Aquí tienes la mejor opción y consejos para tu proyecto:

✨ Fachada Deck Unitec Tonos Marrón y Cedro
Diseño natural, elegante y resistente al agua.
Instálala fácil y rápido con Pegatec para fijación de soporte y elementos mecánicos para exterior, sin necesidad de obras molestas ni mantenimiento constante.

💎 Ideal para quienes buscan un deck para fachadas con estética moderna, alta durabilidad y bajo mantenimiento.
Perfecta para renovar casas, locales comerciales o proyectos arquitectónicos.

📲 Escríbenos por nuestro [WhatsApp Oficial](https://wa.me/573142332147) o contacta a nuestro ejecutivo comercial [Camilo Andres Torres](https://wa.me/573104578337) y cotiza hoy tu fachada deck.

Dale a tu espacio una fachada que destaque desde el primer vistazo. ¿Te gustaría indicarme las medid |  |  |
| BOT | ¡Hola! Bienvenido a UNITEC USA DESIGN.

¿Quieres una fachada que impacte y se mantenga impecable por años? Aquí tienes la mejor opción y consejos para tu proyecto:

✨ Fachada Deck Unitec Tonos Marrón y Cedro
Diseño natural, elegante y resistente al agua.
Instálala fácil y rápido con Pegatec para fijación de soporte y elementos mecánicos para exterior, sin necesidad de obras molestas ni mantenimiento constante.

💎 Ideal para quienes buscan un deck para fachadas con estética moderna, alta durabilidad y bajo mantenimiento.
Perfecta para renovar casas, locales comerciales o proyectos arquitectónicos.

📲 Escríbenos por nuestro [WhatsApp Oficial](https://wa.me/573142332147) o contacta a nuestro ejecutivo comercial [Camilo Andres Torres](https://wa.me/573104578337) y cotiza hoy tu fachada deck.

Dale a tu espacio una fachada que destaque desde el primer vistazo. ¿Te gustaría indicarme las medid |  |  |
| BOT | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alternativas constructivas.

Mi nombre es Decky👷 y estaré por este medio acompañándote a recorrer nuestro portafolio de más de 500 productos y a escoger las mejores opciones constructivas alineadas a tu proyecto.

Antes de continuar quisiera conocerte. Cuéntame, ¿cómo te llamas? |  |  |
| 2026-09-06 05:11 · session_1788689492370_e0riaq9h8 · nombre: Manuel · tel: — · 1 msgs del usuario |  |  |  |
| USUARIO | Manuel |  |  |
| BOT | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alternativas constructivas.

Mi nombre es Decky👷 y estaré por este medio acompañándote a recorrer nuestro portafolio de más de 500 productos y a escoger las mejores opciones constructivas alineadas a tu proyecto.

Antes de continuar quisiera conocerte. Cuéntame, ¿cómo te llamas? |  |  |
| 2026-09-08 09:23 · session_1788877423875_b2qp32ytl · nombre: Johrladiz · tel: 3206396036 · 5 msgs del usuario |  |  |  |
| USUARIO | johrladiz |  |  |
| USUARIO | 3206396036 |  |  |
| USUARIO | 2 |  |  |
| USUARIO | donde compro en colombia |  |  |
| USUARIO | donde compro en colombia |  |  |
| BOT | ¡Hola! En Colombia puedes visitarnos en nuestro punto físico ubicado en el Centro Comercial Ideo (Local 274). Ten en cuenta que nuestra bodega principal se encuentra en Guarne, desde donde realizamos todos los envíos y despachos a nivel nacional.

También puedes realizar tus pedidos o recibir asesoría directa comunicándote con nuestro equipo comercial a través de WhatsApp:

- [Camilo Andres Torres](https://wa.me/573104578337)
- [Yuldor Stiven Avendano](https://wa.me/573105769694)
- [Henderson Patrick Arroyave](https://wa.me/573202174854)

O escribirnos directamente a nuestra línea principal: [WhatsApp UNITEC](https://wa.me/573142332147)

¿En qué ciudad te encuentras y qué producto te gustaría cotizar hoy? |  |  |
| BOT | Señor/a, ¿aún continuas en línea? Si no hay respuesta en un minuto, cerraré la conversación. |  |  |
| BOT | Señor/a, ¿aún continuas en línea? Si no hay respuesta en un minuto, cerraré la conversación. |  |  |
| BOT | ¡Hola! En Colombia puedes visitarnos en nuestro punto físico ubicado en el Centro Comercial Ideo (Local 274). Ten en cuenta que nuestra bodega principal se encuentra en Guarne, desde donde realizamos todos los envíos y despachos a nivel nacional.

También puedes realizar tus pedidos o recibir asesoría directa comunicándote con nuestro equipo comercial a través de WhatsApp:

- [Camilo Andres Torres](https://wa.me/573104578337)
- [Yuldor Stiven Avendano](https://wa.me/573105769694)
- [Henderson Patrick Arroyave](https://wa.me/573202174854)

O escribirnos directamente a nuestra línea principal: [WhatsApp UNITEC](https://wa.me/573142332147)

¿En qué ciudad te encuentras y qué producto te gustaría cotizar hoy? |  |  |
| BOT | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alternativas constructivas.

Mi nombre es Decky👷 y estaré por este medio acompañándote a recorrer nuestro portafolio de más de 500 productos y a escoger las mejores opciones constructivas alineadas a tu proyecto.

Antes de continuar quisiera conocerte. Cuéntame, ¿cómo te llamas? |  |  |
| 2026-09-08 17:21 · session_1788906094683_a4k6ndx6g · nombre: En Bogotá · tel: 3115895040 · 5 msgs del usuario |  |  |  |
| USUARIO | En Bogotá |  |  |
| USUARIO | 3115895040 |  |  |
| USUARIO | 6 |  |  |
| USUARIO | Quiero solicitar una cotizaciÃ³n para un producto. |  |  |
| USUARIO | Quiero solicitar una cotizaciÃ³n para un producto. |  |  |
| BOT | ¡Perfecto! Por último, ¿Cuéntame a que te dedicas? Elige una opción:

1. Arquitecto
2. Constructor
3. Diseñador
4. Distribuidor
5. Mayorista
6. Cliente Final
7. Otro |  |  |
| BOT | Perfecto, ahora para mí es mucho más fácil ayudarte con todo lo que me indicas que se ajuste a tus necesidades. ¿En qué puedo ayudarte hoy? |  |  |
| BOT | ¡Hola! Bienvenido a UNITEC USA DESIGN. Con gusto te ayudamos con tu cotización.

¡Asesoría personalizada al instante, las 24 horas! 

¿Necesitas cotizar o conocer nuestros productos? No esperes más. Con nuestro chat de asesoría instantánea disponible 24/7, recibes atención personalizada en el momento que la necesites.

Al ingresar, podrás obtener:
Propuestas de producto a tu medida.
Cotizaciones detalladas con la información que nos proporciones.
Respuestas inmediatas de nuestro equipo experto.

Haz clic en el siguiente enlace para iniciar tu conversación directamente en WhatsApp y recibir tu propuesta hoy mismo: [WhatsApp Contacto Principal](https://wa.me/573142332147)

Para ir adelantando tu cotización por este medio, ¿me podrías decir tu nombre?

¿Qué producto tienes en mente y de cuántos metros cuadrados (m²) es tu proyecto aproximadamente? Por favor, compárteme también tu número de  |  |  |
| BOT | 💰 He enviado tu solicitud de cotización a nuestro equipo de ventas. Un asesor te responderá en breve. Para atención inmediata, escríbenos por WhatsApp: https://wa.me/573142332147 |  |  |
| BOT | Señor/a, ¿aún continuas en línea? Si no hay respuesta en un minuto, cerraré la conversación. |  |  |
| BOT | ¡Hola! Bienvenido a UNITEC USA DESIGN. Con gusto te ayudamos con tu cotización.

¡Asesoría personalizada al instante, las 24 horas! 

¿Necesitas cotizar o conocer nuestros productos? No esperes más. Con nuestro chat de asesoría instantánea disponible 24/7, recibes atención personalizada en el momento que la necesites.

Al ingresar, podrás obtener:
Propuestas de producto a tu medida.
Cotizaciones detalladas con la información que nos proporciones.
Respuestas inmediatas de nuestro equipo experto.

Haz clic en el siguiente enlace para iniciar tu conversación directamente en WhatsApp y recibir tu propuesta hoy mismo: [WhatsApp Contacto Principal](https://wa.me/573142332147)

Para ir adelantando tu cotización por este medio, ¿me podrías decir tu nombre?

¿Qué producto tienes en mente y de cuántos metros cuadrados (m²) es tu proyecto aproximadamente? Por favor, compárteme también tu número de  |  |  |
| BOT | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alternativas constructivas.

Mi nombre es Decky👷 y estaré por este medio acompañándote a recorrer nuestro portafolio de más de 500 productos y a escoger las mejores opciones constructivas alineadas a tu proyecto.

Antes de continuar quisiera conocerte. Cuéntame, ¿cómo te llamas? |  |  |
| 2026-09-14 15:03 · session_1789416232703_9vclyxdjw · nombre: — · tel: — · 4 msgs del usuario |  |  |  |
| USUARIO | Hola |  |  |
| USUARIO | 3204963611 |  |  |
| USUARIO | 4 |  |  |
| USUARIO | Por favor, comunÃ­came con un representante de ventas. |  |  |
| BOT | ¡Perfecto! Por último, ¿Cuéntame a que te dedicas? Elige una opción:

1. Arquitecto
2. Constructor
3. Diseñador
4. Distribuidor
5. Mayorista
6. Cliente Final
7. Otro |  |  |
| BOT | Perfecto, ahora para mí es mucho más fácil ayudarte con todo lo que me indicas que se ajuste a tus necesidades. ¿En qué puedo ayudarte hoy? |  |  |
| BOT | Ups, tuve un problema momentaneo con la conexion. Por favor envia tu mensaje de nuevo, estoy aqui para ayudarte! Si continua fallando, escribenos por WhatsApp: https://wa.me/573142332147 |  |  |
| BOT | Señor/a, ¿aún continuas en línea? Si no hay respuesta en un minuto, cerraré la conversación. |  |  |
| BOT | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alternativas constructivas.

Mi nombre es Decky👷 y estaré por este medio acompañándote a recorrer nuestro portafolio de más de 500 productos y a escoger las mejores opciones constructivas alineadas a tu proyecto.

Antes de continuar quisiera conocerte. Cuéntame, ¿cómo te llamas? |  |  |
| 2026-09-15 06:52 · session_1789473142785_yh1pcjpl6 · nombre: Quiero saber el precio del piso SPC · tel: — · 1 msgs del usuario |  |  |  |
| USUARIO | Hola, quiero saber el precio del piso SPC |  |  |
| BOT | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alternativas constructivas.

Mi nombre es Decky👷 y estaré por este medio acompañándote a recorrer nuestro portafolio de más de 500 productos y a escoger las mejores opciones constructivas alineadas a tu proyecto.

Antes de continuar quisiera conocerte. Cuéntame, ¿cómo te llamas? |  |  |
## Sheet: Hallazgos y Acciones
| Qué estaba mal, qué se corrigió y qué queda por hacer |  |  |  |
| --- | --- | --- | --- |
| # | Hallazgo | Estado | Detalle técnico |
| 1 | El primer mensaje del visitante se guardaba como su NOMBRE (onboarding). | CORREGIDO | Ahora se detecta intención: si el mensaje es una pregunta, se responde y el nombre se marca como "Cliente". |
| 2 | Los pasos del onboarding (nombre/teléfono/perfil) no dejaban etapa registrada: no había embudo. | CORREGIDO | Nuevo endpoint /api/record-turn (sin coste de IA) graba el turno y la etapa (funnelStep) en cada paso. |
| 3 | El panel contaba el saludo automático del bot (y mensajes solo de caché) como interacción. | CORREGIDO | Interacción = userMessageCount > 0. Tarjeta nueva "Solo saludo (bot)" y KPI "Contactos capturados". |
| 4 | Las sesiones nunca salían de "active": no existía abandono por paso ni sesiones cerradas. | CORREGIDO | Sweeper cada 15 min: abandoned_at_greeting / abandoned_at_name|phone|profession / completed. |
| 5 | Panel e informe calculaban con código distinto: sus cifras no podían coincidir. | CORREGIDO | Motor único api/_analytics-core.js + endpoint /api/analytics para el panel. |
| 6 | El informe diario no traía el embudo ni las conversaciones reales. | CORREGIDO | Sección de embudo en Telegram + hojas "Embudo" y "Conversaciones reales" en el Excel adjunto. |
| 7 | Errores de codificación (mojibake) en textos en español de la interfaz. | CORREGIDO | 55 líneas reparadas en constants.ts, App.tsx, AdminDashboard.tsx, retentionService.ts. |
| 8 | El onboarding obliga a 3 pasos antes de poder preguntar. | PENDIENTE | Recomendado: pedir solo el nombre y pedir teléfono/perfil después de la primera respuesta útil. |
| 9 | Visitas web (GA) fijas en 3.188: valor por defecto nunca conectado. | PENDIENTE | Cargar el dato real en Ajustes o conectar GA4 (measurementId G-4TYC7224J7). |
| 10 | El histórico no se puede reconstruir por pasos. | LIMITACIÓN | Jul–sep 2026 solo permite distinguir "escribió / no escribió". El embudo por pasos se mide desde hoy. |