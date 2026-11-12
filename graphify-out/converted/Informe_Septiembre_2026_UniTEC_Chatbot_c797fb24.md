<!-- converted from Informe_Septiembre_2026_UniTEC_Chatbot.xlsx -->

## Sheet: Resumen Septiembre
| UNITEC USA DESIGN — Chatbot Front Desk · Informe Septiembre 2026 |  |  |  |  |
| --- | --- | --- | --- | --- |
| Preparado por Hermes · Datos directos de Firestore (chatbot-bi-front-desk) · Zona horaria Colombia |  |  |  |  |
| Indicador | Valor |  | Nota |  |
| Sesiones ingresadas en septiembre | 275 | Creadas en sept (hora Bogotá). |  |  |
| Sin ninguna interacción (0 mensajes) | 119 | Abrieron el chat pero no se guardó ningún mensaje. (El panel los cuenta como "no conversaron"). |  |  |
| Panel: "interactuaron" (messageCount>0) | 156 | Así los cuenta el panel hoy — PERO este número está inflado. |  |  |
|   └ Solo saludo automático (usuario NO escribió nada) | 144 | El bot guarda su saludo "welcome" como 1 mensaje → parecen interactuados sin serlo. |  |  |
|   └ Con mensaje REAL escrito por el usuario | 12 | Sesiones con texto del cliente en el chat. |  |  |
|       └ De esas 12, son pruebas/diagnósticos del 02-sep | 9 | diag-test, lat-test, analytics-verify, post-fix-check, warm-check, secret-verify (trabajo técnico). |  |  |
| CONVERSACIONES REALES DE CLIENTES | 3 | Las únicas 3 interacciones genuinas de septiembre → hoja "Leads Reales". |  |  |
| Conclusión: de las 156 "interactuadas" que muestra el panel, solo 3 son personas reales que conversaron. Las 144 restantes son visitantes que abrieron el chat y se fueron sin escribir (el saludo automático se cuenta como mensaje). |  |  |  |  |
| KPI VISITAS WEB (GA) — POR QUÉ ESTÁ CONGELADO EN 3188 |  |  |  |  |
| 1) El número 3188 es un VALOR MANUAL: está como default en el panel ("Visitas Web (Google Analytics)") y en la config de reportes de Telegram. |  |  |  |  |
| 2) NO está conectado a Google Analytics real. En la base no existe el campo googleAnalyticsVisits (config/main), así que el sistema siempre muestra el default 3188. |  |  |  |  |
| 3) Por eso "nunca cambió": nadie lo actualizó y no hay integración con GA. |  |  |  |  |
| Solución A (inmediata): escribir el número real de visitas del mes en Ajustes → Reportes Telegram → "Visitas Web (GA)". |  |  |  |  |
| Solución B (automática): conectar la API real de Google Analytics 4 (existe measurementId G-4TYC7224J7 en el proyecto) para que el KPI se actualice solo. |  |  |  |  |
| Corrección recomendada (para que el panel diga la verdad): contar como "interacción real" solo sesiones con mensaje del usuario (userMessageCount ≥ 1), excluir el saludo automático, y etiquetar/eliminar las sesiones de prueba. |  |  |  |  |
## Sheet: Leads Reales (3)
| Las 3 conversaciones reales de septiembre — detalle completo |  |  |  |
| --- | --- | --- | --- |
| Transcripción íntegra cliente ↔ bot (mensajes duplicados de registro eliminados de esta vista) |  |  |  |
| Fecha (COL) | Cliente / Teléfono | Perfil | Qué pidió / resultado |
| 01-sep 09:49 | "Buenas días dónde están ubicados" · 📞 3224123398 | Otro | ¿Dónde están ubicados? → quiere hacer UN PEDIDO (Daniel Gómez) → pidió WhatsApp del equipo → recibió wa.me/573142332147. LEAD CON TELÉFONO. |
| Sesión: session_1788274178834_8bzediz0m |  |  |  |
| 02-sep 05:41 | Pedro Ocampo · sin teléfono | (no capturado) | Stock/disponibilidad de producto → pared de garaje e interior, 2,20×15 m (≈33 m²) → eligió WPC y pidió COSTO → el bot disparó cotización. LEAD DE COTIZACIÓN WPC (sin teléfono). |
| Sesión: session_1788345696198_i885fo6id |  |  |  |
| 03-sep 20:59 | Carlos Arturo Luna Beltrán · sin teléfono | Constructor | Consejos para una buena fachada (perfil: Constructor). LEAD DE PROYECTO (sin teléfono). |
| Sesión: session_1788487141526_iu81e5h5i |  |  |  |
| Nota: Pedro Ocampo y Carlos Luna NO dejaron teléfono (eligieron "Saltar"). Solo la primera sesión tiene celular → es el lead más valioso para seguimiento. |  |  |  |
## Sheet: Transcripciones
| Transcripciones íntegras de las 3 conversaciones reales |  |  |
| --- | --- | --- |
| CLIENTE = visitante · BOT = asistente · columna Texto sin duplicados |  |  |
| Hora | Quién | Mensaje |
| 2026-09-01 14:49:38 | BOT | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alternativas constructivas.

Mi nombre es Decky👷 y estaré por este medio acompañándote a recorrer nuestro portafolio de más de 500 productos y a escoger las mejores opciones constructivas alineadas a tu proyecto.

Antes de continuar quisiera conocerte. Cuéntame, ¿cómo te llamas? |
| 2026-09-01 14:50:16 | CLIENTE | Buenas días dónde están ubicados  |
| 2026-09-01 14:50:16 | BOT | ¡Un gusto conocerte, Buenas días dónde están ubicados! Cuéntame, ¿cuál es tu número telefónico? (Escribe "saltar" si prefieres no compartirlo) |
| 2026-09-01 14:50:37 | CLIENTE | 3224123398 |
| 2026-09-01 14:51:07 | CLIENTE | 6 |
| 2026-09-01 14:51:32 | CLIENTE | Nesecita un pedido  |
| 2026-09-01 14:51:32 | BOT | ¡Hola! Bienvenido a UNITEC USA DESIGN. Con mucho gusto te ayudamos a tramitar tu pedido.

Para asesorarte de la mejor manera y tomar tu pedido, ¿cuéntame qué productos necesitas o qué área deseas cubrir? Si tienes las medidas aproximadas en metros cuadrados (m²), nos servirá mucho para darte un estimado exacto.

También puedes escribirnos directamente a nuestro WhatsApp oficial para coordinar tu pedido con un asesor: [WhatsApp Oficial UNITEC](https://wa.me/573142332147) o comunicarte con nuestro ejecutivo [Camilo Andres Torres](https://wa.me/573104578337).

¿Con quién tengo el gusto de hablar? |
| 2026-09-01 14:52:48 | BOT | ¡Hola! Bienvenido a UNITEC USA DESIGN. Con mucho gusto te ayudamos a tramitar tu pedido.

Para asesorarte de la mejor manera y tomar tu pedido, ¿cuéntame qué productos necesitas o qué área deseas cubrir? Si tienes las medidas aproximadas en metros cuadrados (m²), nos servirá mucho para darte un estimado exacto.

También puedes escribirnos directamente a nuestro WhatsApp oficial para coordinar tu pedido con un asesor: [WhatsApp Oficial UNITEC](https://wa.me/573142332147) o comunicarte con nuestro ejecutivo [Camilo Andres Torres](https://wa.me/573104578337).

¿Con quién tengo el gusto de hablar? |
| 2026-09-01 14:52:48 | CLIENTE | Nesecita un pedido  |
| 2026-09-01 14:52:48 | CLIENTE | Daniel gomez  |
| 2026-09-01 14:53:08 | BOT | Ups, tuve un problema momentaneo con la conexion. Por favor envia tu mensaje de nuevo, estoy aqui para ayudarte! Si continua fallando, escribenos por WhatsApp: https://wa.me/573142332147 |
| 2026-09-01 14:53:19 | CLIENTE | Cual es tu guasap  |
| 2026-09-01 14:53:19 | BOT | ¡Hola! Puedes escribirnos directamente a nuestro número principal de WhatsApp:

[WhatsApp Oficial UNITEC](https://wa.me/573142332147) (+57 314 233 2147)

También te comparto el contacto directo de nuestros ejecutivos comerciales:

- [Camilo Andres Torres](https://wa.me/573104578337) - Ventas
- [Yuldor Stiven Avendaño](https://wa.me/573105769694) - Ejecutivo Comercial
- [Henderson Patrick Arroyave](https://wa.me/573202174854) - Ejecutivo Marketing

¿En qué producto o proyecto estás interesado para brindarte la mejor información? |
| 2026-09-01 14:54:33 | BOT | ¡Hola! Puedes escribirnos directamente a nuestro número principal de WhatsApp:

[WhatsApp Oficial UNITEC](https://wa.me/573142332147) (+57 314 233 2147)

También te comparto el contacto directo de nuestros ejecutivos comerciales:

- [Camilo Andres Torres](https://wa.me/573104578337) - Ventas
- [Yuldor Stiven Avendaño](https://wa.me/573105769694) - Ejecutivo Comercial
- [Henderson Patrick Arroyave](https://wa.me/573202174854) - Ejecutivo Marketing

¿En qué producto o proyecto estás interesado para brindarte la mejor información? |
| 2026-09-01 14:54:33 | CLIENTE | Cual es tu guasap  |
| 2026-09-01 15:02:26 | BOT | Señor/a, ¿aún continuas en línea? Si no hay respuesta en un minuto, cerraré la conversación. |
| Hora | Quién | Mensaje |
| 2026-09-02 10:41:36 | BOT | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alternativas constructivas.

Mi nombre es Decky👷 y estaré por este medio acompañándote a recorrer nuestro portafolio de más de 500 productos y a escoger las mejores opciones constructivas alineadas a tu proyecto.

Antes de continuar quisiera conocerte. Cuéntame, ¿cómo te llamas? |
| 2026-09-02 10:41:50 | CLIENTE | Pedro Ocampo  |
| 2026-09-02 10:41:50 | BOT | ¡Un gusto conocerte, Pedro Ocampo! Cuéntame, ¿cuál es tu número telefónico? (Escribe "saltar" si prefieres no compartirlo) |
| 2026-09-02 10:42:05 | CLIENTE | Saltar |
| 2026-09-02 10:42:22 | CLIENTE | 7 |
| 2026-09-02 10:42:22 | BOT | Perfecto, ahora para mí es mucho más fácil ayudarte con todo lo que me indicas que se ajuste a tus necesidades. ¿En qué puedo ayudarte hoy? |
| 2026-09-02 10:42:42 | CLIENTE | Quiero consultar el stock y disponibilidad de un producto. |
| 2026-09-02 10:42:42 | BOT | ¡Hola! Con gusto te ayudo a consultar el stock y la disponibilidad del producto que necesitas.

¿Podrías decirme qué producto, referencia o color estás buscando, y para qué ciudad o proyecto lo necesitas? Así podré brindarte la información exacta o conectarte directamente con uno de nuestros ejecutivos comerciales. |
| 2026-09-02 10:43:33 | CLIENTE | Para pared de un garaje  |
| 2026-09-02 10:43:33 | BOT | ¡Hola! Para la pared de un garaje tenemos opciones excelentes que soportan humedad, son altamente resistentes y le darán un cambio total a tu espacio sin necesidad de grandes obras.

Si es para el interior del garaje, te recomiendo el Foam Board UNITEC o nuestros paneles de pared WPC. Se instalan de forma rápida y limpia con adhesivo de montaje PegaTec, sin generar polvo y ofreciendo una excelente durabilidad.

Si se trata de la pared exterior o la fachada del garaje, la opción ideal es nuestra Fachada Deck UNITEC en tonos Marrón o Cedro, la cual brinda un diseño moderno, elegante y resistente a la intemperie.

Para ayudarte a calcular la cantidad de material y darte un estimado aproximado, ¿cuántos metros cuadrados (m²) tiene la pared que deseas renovar? Por cierto, ¿con quién tengo el gusto de hablar? |
| 2026-09-02 10:44:40 | CLIENTE | Para pared interior  |
| 2026-09-02 10:44:40 | BOT | ¡Excelente elección! Para paredes interiores tenemos opciones espectaculares que transforman cualquier espacio sin necesidad de obras complejas ni desorden.

Entre nuestras mejores alternativas destacan:

- Foam Board UNITEC: Paneles decorativos de acabado moderno que se instalan fácil y rápido con nuestro adhesivo de montaje PegaTec, sin generar polvo ni desorden.
- Paneles WPC para Interior: Aportan elegancia, calidez estilo madera y alta durabilidad, siendo además resistentes a la humedad y de cero mantenimiento.

¿Tienes las medidas en metros cuadrados (m²) o las dimensiones aproximadas de la pared que deseas renovar? Cuéntame y te ayudo a calcular lo que necesitas, o si prefieres, te puedo compartir el catálogo de diseños disponibles. |
| 2026-09-02 10:46:30 | CLIENTE | Las paredes tienen aproximadamente altura 2,20 metros por 15 metrosr |
| 2026-09-02 10:46:30 | BOT | Con esas medidas de 2,20 metros de alto por 15 metros de ancho, tienes un área aproximada de 33 metros cuadrados.

Para brindarte una estimación adecuada, ¿qué tipo de producto te gustaría instalar? Contamos con opciones como WPC Wall Panel para interiores o exteriores, Foam Board o revestimientos decorativos.

Ten en cuenta que el cálculo de piezas e inversión es un aproximado que varía según la referencia y el tamaño del panel seleccionado. 

Si deseas recibir una cotización detallada de inmediato con nuestro equipo de ventas, puedes escribirnos directamente a nuestro [WhatsApp Oficial](https://wa.me/573142332147) o comunicarte con nuestro asesor [Camilo Andres Torres](https://wa.me/573104578337).

¿Qué material o estilo tienes pensado para tu espacio? |
| 2026-09-02 10:47:46 | CLIENTE | En wpc, estaría bien,  costo |
| 2026-09-02 10:47:46 | BOT | 💰 He enviado tu solicitud de cotización a nuestro equipo de ventas. Un asesor te responderá en breve. Para atención inmediata, escríbenos por WhatsApp: https://wa.me/573142332147 |
| 2026-09-02 10:47:46 | BOT | ¡Excelente elección! El material WPC es ideal por su durabilidad, elegancia, resistencia 100% al agua y cero mantenimiento.

Para poder brindarte un costo aproximado de tu proyecto, ¿nos podrías indicar para qué área lo necesitas (fachada exterior, muro interior, deck) y cuántos metros cuadrados (m²) aproximadamente requieres?

Si deseas recibir la lista de precios y la cotización de forma inmediata con uno de nuestros ejecutivos comerciales, puedes dar clic directamente en el enlace de nuestro WhatsApp oficial:

[WhatsApp UNITEC](https://wa.me/573142332147)

O con nuestro asesor de ventas:
[Camilo Andres Torres](https://wa.me/573104578337)

¡Cuéntame sobre las medidas de tu espacio o el tipo de proyecto y con gusto te guío! |
| Hora | Quién | Mensaje |
| 2026-09-04 01:59:01 | BOT | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alternativas constructivas.

Mi nombre es Decky👷 y estaré por este medio acompañándote a recorrer nuestro portafolio de más de 500 productos y a escoger las mejores opciones constructivas alineadas a tu proyecto.

Antes de continuar quisiera conocerte. Cuéntame, ¿cómo te llamas? |
| 2026-09-04 01:59:56 | CLIENTE | Carlos Arturo Luna Beltrán  |
| 2026-09-04 01:59:56 | BOT | ¡Un gusto conocerte, Carlos Arturo Luna Beltrán! Cuéntame, ¿cuál es tu número telefónico? (Escribe "saltar" si prefieres no compartirlo) |
| 2026-09-04 02:00:27 | CLIENTE | Saltar |
| 2026-09-04 02:00:27 | BOT | ¡Perfecto! Por último, ¿Cuéntame a que te dedicas? Elige una opción:

1. Arquitecto
2. Constructor
3. Diseñador
4. Distribuidor
5. Mayorista
6. Cliente Final
7. Otro |
| 2026-09-04 02:01:07 | CLIENTE | Constructor |
| 2026-09-04 02:01:50 | CLIENTE | Consejos para una buena fachada |
| 2026-09-04 02:01:50 | BOT | ¡Hola! Bienvenido a UNITEC USA DESIGN.

¿Quieres una fachada que impacte y se mantenga impecable por años? Aquí tienes la mejor opción y consejos para tu proyecto:

✨ Fachada Deck Unitec Tonos Marrón y Cedro
Diseño natural, elegante y resistente al agua.
Instálala fácil y rápido con Pegatec para fijación de soporte y elementos mecánicos para exterior, sin necesidad de obras molestas ni mantenimiento constante.

💎 Ideal para quienes buscan un deck para fachadas con estética moderna, alta durabilidad y bajo mantenimiento.
Perfecta para renovar casas, locales comerciales o proyectos arquitectónicos.

📲 Escríbenos por nuestro [WhatsApp Oficial](https://wa.me/573142332147) o contacta a nuestro ejecutivo comercial [Camilo Andres Torres](https://wa.me/573104578337) y cotiza hoy tu fachada deck.

Dale a tu espacio una fachada que destaque desde el primer vistazo. ¿Te gustaría indicarme las medidas en metros cuadrados (m²) de tu área para darte una estimación aproximada? |
## Sheet: 12 con texto usuario
| Sesiones de septiembre con al menos 1 mensaje escrito por el usuario (12) |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- |
| 9 son pruebas técnicas del 02-sep (se pueden depurar/eliminar); 3 son clientes reales |  |  |  |  |  |
| Fecha (COL) | Sesión | Mensajes | Textos usuario | Cliente | Tipo |
| 2026-09-01 09:49 | session_1788274178834_8bzediz0m | 8 | Buenas días dónde están ubicados  | Buenas días dónde están ubicados 3224123398 | REAL |
| 2026-09-02 05:41 | session_1788345696198_i885fo6id | 13 | Pedro Ocampo  | Pedro Ocampo | REAL |
| 2026-09-02 10:13 | diag-test-1 | 1 | hola |  | PRUEBA TÉCNICA |
| 2026-09-02 10:16 | diag-test-2 | 1 | necesito una cotizacion de fachada deck |  | PRUEBA TÉCNICA |
| 2026-09-02 10:41 | lat-test-1 | 1 | hola |  | PRUEBA TÉCNICA |
| 2026-09-02 10:41 | lat-test-2 | 1 | hola |  | PRUEBA TÉCNICA |
| 2026-09-02 10:42 | lat-test-3 | 1 | hola |  | PRUEBA TÉCNICA |
| 2026-09-02 10:57 | analytics-verify-001 | 1 | hola test analytics |  | PRUEBA TÉCNICA |
| 2026-09-02 11:03 | post-fix-check | 1 | hola |  | PRUEBA TÉCNICA |
| 2026-09-02 11:24 | warm-check | 1 | hola |  | PRUEBA TÉCNICA |
| 2026-09-02 11:36 | secret-verify | 1 | hola |  | PRUEBA TÉCNICA |
| 2026-09-03 20:59 | session_1788487141526_iu81e5h5i | 5 | Carlos Arturo Luna Beltrán  | Carlos Arturo Luna Beltrán | REAL |
## Sheet: Log 156 sesiones
| Las 156 sesiones que el panel marca como "interactuadas" — registro completo |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- |
| 144 = solo saludo automático (sin texto del usuario) · 12 = con texto del usuario |  |  |  |  |  |
| Fecha (COL) | Sesión | msgCount | userMsgCount | Nombre | Último mensaje registrado |
| 2026-09-01 01:33 | session_1788244403277_8mf7a9klb | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 04:58 | session_1788256688150_brfh6jmto | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 05:00 | session_1788256809081_i3acz0phm | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 06:22 | session_1788261779806_xbfxu76ic | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 07:13 | session_1788264805973_ilsud46ms | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 08:00 | session_1788267646247_0uztg1yk1 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 09:25 | session_1788272735509_5cll2d99q | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 09:28 | session_1788272890763_o8itymq2f | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 09:36 | session_1788273405939_4jgl6bttu | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 09:49 | session_1788274178834_8bzediz0m | 16 | 8 | Buenas días dónde están ubicados | Señor/a, ¿aún continuas en línea? Si no hay respuesta en un minuto, ce |
| 2026-09-01 11:28 | session_1788280116711_a6ufiq88z | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 12:10 | session_1788282650874_r22atztwx | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 12:12 | session_1788282722747_cohgynlbo | 2 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 13:52 | session_1788288739111_oqnmu8wzm | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 14:44 | session_1788291864596_6fxap89ib | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 15:40 | session_1788295252743_kr0s9ufj2 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 15:42 | session_1788295322320_2fxam4940 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 16:27 | session_1788298038771_96z0g1mi3 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 17:49 | session_1788302989076_yxisp23x2 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 18:00 | session_1788303609679_bwa3xxyzq | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 18:08 | session_1788304108611_etzlds2fb | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 18:15 | session_1788304541770_247mwtba8 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 19:03 | session_1788307428335_mpdjbf77r | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 19:17 | session_1788308273174_mlk7ywl74 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 19:31 | session_1788309107765_gvo1zr9os | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 19:39 | session_1788309556347_l6g5d0pl3 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 19:46 | session_1788309993839_3m1zwrhe1 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 20:02 | session_1788310951735_onl5txnsu | 2 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 20:03 | session_1788310984171_l59a3ws8j | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 20:28 | session_1788312536552_fdq2sd8qr | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 20:59 | session_1788314358632_jfla3wit5 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 21:09 | session_1788314983103_mtl61g8z8 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 21:32 | session_1788316323103_eac8se0ed | 2 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 22:25 | session_1788319555893_k1epwqara | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 22:28 | session_1788319709216_hlpaehag8 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 22:39 | session_1788320381499_ssyu29cqk | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 22:45 | session_1788320748653_6zgqv6z03 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 22:54 | session_1788321277089_dbj6sxmmw | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 23:01 | session_1788321713954_4pdtn2hjt | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-01 23:07 | session_1788322072404_bf3kqm2h5 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 01:07 | session_1788329243083_7bsih898q | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 02:47 | session_1788335242120_dgry98kv6 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 04:45 | session_1788342350031_g5aqgrczd | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 05:02 | session_1788343376374_mwsng622q | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 05:17 | session_1788344264025_5zo3oakvr | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 05:41 | session_1788345696198_i885fo6id | 27 | 13 | Pedro Ocampo | ¡Excelente elección! El material WPC es ideal por su durabilidad, eleg |
| 2026-09-02 06:36 | session_1788349009948_1h47ssuf2 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 06:47 | session_1788349655417_sp98i7vmq | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 07:01 | session_1788350515612_l6b13u83h | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 07:53 | session_1788353621734_v3dhjtw6e | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 08:05 | session_1788354325813_cohcf67iy | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 08:14 | session_1788354861939_mrwuj3x58 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 08:18 | session_1788355126035_hsog9lsj2 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 08:40 | session_1788356442519_mc7jxuzzo | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 08:55 | session_1788357348353_0p5l06awp | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 10:11 | session_1788361914480_xraorcsvi | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 10:13 | session_1788362014591_6mgw72epy | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 10:13 | session_1788362014622_nlfvrpk0j | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 10:13 | diag-test-1 | 2 | 1 |  | hola |
| 2026-09-02 10:16 | diag-test-2 | 2 | 1 |  | necesito una cotizacion de fachada deck |
| 2026-09-02 10:19 | session_1788362353491_514v9p2k6 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 10:23 | session_1788362627128_fs04fn4z2 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 10:25 | session_1788362702189_8h4c1nzr5 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 10:25 | session_1788362742199_b01zsey8k | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 10:27 | session_1788362838408_4qcjzizi5 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 10:28 | session_1788362919745_q8u4l2s1r | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 10:28 | session_1788362921435_5ntujgeg7 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 10:31 | session_1788363069944_ta54iqfbm | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 10:31 | session_1788363070138_ma8txdcl1 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 10:31 | session_1788363101956_z71mm32ou | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 10:41 | lat-test-1 | 2 | 1 |  | hola |
| 2026-09-02 10:41 | lat-test-2 | 2 | 1 |  | hola |
| 2026-09-02 10:42 | lat-test-3 | 2 | 1 |  | hola |
| 2026-09-02 10:44 | session_1788363868691_pg86g6dhk | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 10:57 | analytics-verify-001 | 2 | 1 |  | hola test analytics |
| 2026-09-02 11:03 | post-fix-check | 2 | 1 |  | hola |
| 2026-09-02 11:03 | session_1788365027507_biqoeb7lr | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 11:04 | session_1788365085935_v9u8ukj4n | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 11:04 | session_1788365085991_3rblcy9v3 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 11:09 | session_1788365390654_shh1gsjzj | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 11:12 | session_1788365524900_pxv8rp6sd | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 11:24 | warm-check | 2 | 1 |  | hola |
| 2026-09-02 11:27 | session_1788366431176_qs6d2gbf2 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 11:27 | session_1788366431376_ms5jugj1i | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 11:36 | secret-verify | 2 | 1 |  | hola |
| 2026-09-02 12:53 | session_1788371595651_yighszdic | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 13:43 | session_1788374610687_xg8bk39ej | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 14:39 | session_1788377945848_8ybaxx979 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 14:41 | session_1788378073818_wjhvrxd80 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 14:46 | session_1788378408133_qb66dx66n | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 14:58 | session_1788379110265_tt4fsn9ht | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 15:00 | session_1788379227181_nclfyq1r7 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 17:37 | session_1788388635035_wqbw956zq | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 18:36 | session_1788392208139_fm3825nta | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 18:54 | session_1788393273089_7utz58hxt | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 18:57 | session_1788393435208_g1wwrmc5k | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 19:02 | session_1788393744941_kvbbfv0zo | 3 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 19:06 | session_1788393978248_22k0go6yd | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 19:34 | session_1788395674779_u6q8zl2gi | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 20:11 | session_1788397888292_9cnwpzqlr | 2 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 20:33 | session_1788399193350_86bw52p1a | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 20:56 | session_1788400602966_sop7l4isi | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 21:23 | session_1788402238924_htdcmih7r | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 21:27 | session_1788402477294_d40a3tr2w | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 22:11 | session_1788405079990_00l09lr16 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 22:43 | session_1788406981794_1jsuflg55 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 23:01 | session_1788408068734_sb9e1g1n4 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 23:08 | session_1788408511133_wmhrth542 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-02 23:37 | session_1788410222955_28oelwo4m | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 03:23 | session_1788423826702_j0jsbtint | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 04:02 | session_1788426134726_utd53324d | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 06:40 | session_1788435634345_hfkd7c6qa | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 07:23 | session_1788438206606_wite1rbkp | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 08:22 | session_1788441764481_0n0gsa31s | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 09:41 | session_1788446482975_426so3o9z | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 09:52 | session_1788447167560_it1xrq81v | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 11:42 | session_1788453733807_7jga0kohb | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 11:48 | session_1788454105478_8kv6lmmye | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 12:03 | session_1788455034704_y6m6lmx8e | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 12:10 | session_1788455417283_4yt0553ae | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 12:51 | session_1788457914200_stwxxy6kc | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 12:53 | session_1788458027210_olnhxfn3f | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 12:57 | session_1788458263831_hn2uhuway | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 13:20 | session_1788459624657_11pu43pt3 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 13:40 | session_1788460803134_a8ojb1jl5 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 13:43 | session_1788461019792_fhzue0gou | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 14:32 | session_1788463965118_0pqr8o6s6 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 14:47 | session_1788464829805_37oi91d5o | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 15:14 | session_1788466495479_w1grm0nvh | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 15:51 | session_1788468668283_y7mxwmfro | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 16:31 | session_1788471067436_n7ykiycft | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 16:37 | session_1788471421125_d0rw5hu76 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 18:29 | session_1788478148106_hys46nsux | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 18:32 | session_1788478324999_4l1con117 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 18:45 | session_1788479130331_slwhzgab3 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 19:22 | session_1788481330943_xtp9nwaxq | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 19:22 | session_1788481361014_5cioftoje | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 19:31 | session_1788481877861_m7mbjixro | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 19:37 | session_1788482236377_954sh3b3h | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 19:44 | session_1788482663930_4pvd97ozx | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 19:53 | session_1788483216588_hjvqyq7xl | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 19:57 | session_1788483434362_cunvuo84q | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 20:40 | session_1788486040269_2ieyt70cw | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 20:49 | session_1788486584848_oj7fqc8l2 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 20:59 | session_1788487141526_iu81e5h5i | 10 | 5 | Carlos Arturo Luna Beltrán | ¡Hola! Bienvenido a UNITEC USA DESIGN.

¿Quieres una fachada que impac |
| 2026-09-03 20:59 | session_1788487194592_74z5i0pfa | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 21:59 | session_1788490745060_6mgdvp0t3 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 22:01 | session_1788490919543_f52d7i1uc | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 22:20 | session_1788492009031_3s6sewwr1 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 22:25 | session_1788492333380_mn0iu5bb5 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 22:28 | session_1788492518015_93kgliku7 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-03 23:35 | session_1788496549089_tdkqpzg16 | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-04 00:35 | session_1788500119862_yk5hki1wq | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-04 01:17 | session_1788502632503_1xtepb1sq | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-04 06:54 | session_1788522888642_oypff3xrd | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |
| 2026-09-04 07:33 | session_1788525181111_8fc6ucdsw | 1 | 0 |  | Hola, 👋 Bienvenido a Unitec USA Design, tu aliado en soluciones y alte |