
import { BusinessConfig, QuickAction, Product } from './types';
import { FunctionDeclaration, Type } from "@google/genai";
import { Language } from './types';
import PRODUCTS_DATA from './products.json';

const getBrandId = () => {
  if (typeof window === 'undefined') return 'unitec';
  const brand = new URLSearchParams(window.location.search).get('brandId');
  if (brand === 'building' || brand === 'unitec') return brand;
  if (window.location.hostname.includes('buildinginnovation')) return 'building';
  return 'unitec';
};

const brandIdForPricing = getBrandId();

export const PRODUCTS = (PRODUCTS_DATA as any[]).map(p => ({
  ...p,
  price: brandIdForPricing === 'unitec' ? (p.price_cop || p.price) : (p.price_usd || p.price)
})) as Product[];

export const UNITEC_CONFIG: BusinessConfig = {
  name: "UNITEC USA DESIGN",
  tagline: "Importador Directo - Distribución Mayorista",
  contact: {
    whatsapp: "+57 314 233 2147",
    instagram: "@unitecusadesign",
    location: "Florida, USA (Stock Inmediato)"
  },
  promotions: [
    "Especial de Octubre: 20% de descuento en combos",
    "Precios especiales en Paneles Acrílicos"
  ],
  customGreeting: "¡Hola! Bienvenido a UNITEC USA DESIGN"
};

export const BUILDING_INNOVATION_CONFIG: BusinessConfig = {
  name: "BUILDING INNOVATION",
  tagline: "¡Diseñamos el futuro! / We design the future!",
  contact: {
    whatsapp: "+1 (786) 968-5783",
    instagram: "@building.innovation",
    location: "6120 NW 74th Ave, Doral, Miami, FL 33166"
  },
  promotions: [
    "Nuevos Paneles Tech-composite",
    "Semana de Innovación: Consultas gratuitas"
  ],
  customGreeting: "¡Hola! Bienvenido a Building Innovation. Soy tu asesor virtual. ¿En qué te puedo ayudar hoy? / Hello! How can I help you today?"
};

// Default export for initial load
export const BUSINESS_CONFIG = BUILDING_INNOVATION_CONFIG;

export const QUICK_ACTIONS: QuickAction[] = [
  { id: 'stock', title: 'Consultar Stock', message: 'Quiero consultar el stock y disponibilidad de un producto.', iconName: 'Box' },
  { id: 'quote', title: 'Cotizar', message: 'Quiero solicitar una cotización para un producto.', iconName: 'DollarSign' },
  { id: 'install', title: 'Instalación', message: 'Necesito información sobre cómo instalar un producto.', iconName: 'Hammer' },
  { id: 'general', title: 'Consulta General', message: 'Tengo una consulta general sobre sus productos y servicios.', iconName: 'MessageCircle' },
  { id: 'contact', title: 'Contactar Ventas', message: 'Por favor, comunícame con un representante de ventas.', iconName: 'BookOpen' },
  { id: 'shipping', title: 'Envíos', message: 'Me gustaría saber cuáles son las opciones de envío y tiempos de entrega.', iconName: 'Truck' },
  { id: 'specs', title: 'Ficha Técnica', message: 'Necesito las especificaciones técnicas de un producto.', iconName: 'FileText' },
  { id: 'returns', title: 'Devoluciones', message: '¿Cuál es su política de devoluciones y cambios?', iconName: 'RefreshCcw' },
  { id: 'discount', title: 'Descuento Mayorista', message: '¿Ofrecen descuentos para compras al por mayor?', iconName: 'Percent' },
];

// --- Tools Definition ---

const bookAppointmentTool: FunctionDeclaration = {
  name: "book_appointment",
  description: "Book an appointment or consultation and send confirmation via Email/SMS.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      customerName: { type: Type.STRING, description: "Name of the customer" },
      contactMethod: { type: Type.STRING, description: "Email or Phone number" },
      date: { type: Type.STRING, description: "Preferred date/time" },
      topic: { type: Type.STRING, description: "Reason for appointment (e.g., Wholesale Quote, Showroom Visit)" }
    },
    required: ["customerName", "contactMethod", "date"]
  }
};

const logToCrmTool: FunctionDeclaration = {
  name: "log_to_crm",
  description: "Log the interaction summary to the company CRM for sales tracking.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING, description: "Brief summary of the conversation" },
      sentiment: { type: Type.STRING, description: "Customer sentiment: Positive, Neutral, or Negative" },
      actionTaken: { type: Type.STRING, description: "What was done (e.g., Provided Quote, Scheduled Call)" }
    },
    required: ["summary", "sentiment"]
  }
};

const sendEmailTool: FunctionDeclaration = {
  name: "send_email",
  description: "Send an email to the customer with requested catalogs, PDFs, or product files.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      customerEmail: { type: Type.STRING, description: "Email address of the customer" },
      contentRequested: { type: Type.STRING, description: "What the customer requested (e.g., 'WPC Panel Catalog', 'Technical Sheet for SPC')" },
      message: { type: Type.STRING, description: "A short personalized message to include in the email body" }
    },
    required: ["customerEmail", "contentRequested"]
  }
};

const emailConversationToAdminTool: FunctionDeclaration = {
  name: "email_conversation_to_admin",
  description: "Send a full summary of the current conversation to the administrator for review and training purposes.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING, description: "A detailed summary of the conversation, including user needs, products discussed, and any quotes provided." },
      customerContact: { type: Type.STRING, description: "Customer's contact info if provided (email or phone)" }
    },
    required: ["summary"]
  }
};

const extractCustomerInfoTool: FunctionDeclaration = {
  name: "extract_customer_info",
  description: "Silently extract the customer's PII (Name, Phone, Email) and Intent from the conversation. Call this whenever you gather their contact details or identify their primary intent (Sales, Support, Escalation).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Customer's name" },
      phone: { type: Type.STRING, description: "Customer's phone number" },
      email: { type: Type.STRING, description: "Customer's email address" },
      intent: { type: Type.STRING, description: "Primary intent: 'Sales', 'Support', or 'Escalation'" }
    },
    required: ["intent"]
  }
};


const calculateShippingTool: FunctionDeclaration = {
  name: "calculate_shipping",
  description: "Calculate shipping and freight rates for products using the Walio API.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      destinationZip: { type: Type.STRING, description: "Zip code of the delivery address" },
      destinationCity: { type: Type.STRING, description: "City name of the delivery address" },
      destinationState: { type: Type.STRING, description: "State code of the delivery address (e.g. FL, NY)" },
      cartItems: {
        type: Type.ARRAY,
        description: "List of items in the cart to calculate shipping for",
        items: {
          type: Type.OBJECT,
          properties: {
            productId: { type: Type.STRING, description: "Product ID (e.g., 14031001)" },
            quantity: { type: Type.INTEGER, description: "Quantity of the product" }
          },
          required: ["productId", "quantity"]
        }
      }
    },
    required: ["destinationZip", "destinationCity", "destinationState", "cartItems"]
  }
};

const generateCheckoutPaymentLinkTool: FunctionDeclaration = {
  name: "generate_checkout_payment_link",
  description: "Generate a Stripe checkout payment link for the order.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      subtotal: { type: Type.NUMBER, description: "Subtotal of products (number)" },
      shippingCost: { type: Type.NUMBER, description: "Shipping cost (number)" },
      total: { type: Type.NUMBER, description: "Grand total = subtotal + shippingCost (number)" },
      customerName: { type: Type.STRING, description: "Name of the customer" },
      customerEmail: { type: Type.STRING, description: "Email address of the customer" },
      cartItems: {
        type: Type.ARRAY,
        description: "List of items in the cart",
        items: {
          type: Type.OBJECT,
          properties: {
            productId: { type: Type.STRING, description: "Product ID (e.g., 14031001)" },
            quantity: { type: Type.INTEGER, description: "Quantity of the product" }
          },
          required: ["productId", "quantity"]
        }
      }
    },
    required: ["subtotal", "shippingCost", "total", "customerName", "customerEmail", "cartItems"]
  }
};

const endConversationTool: FunctionDeclaration = {
  name: "end_conversation",
  description: "Call this tool to explicitly mark the conversation as completed when the user indicates they have no more questions, says goodbye, or explicitly ends the chat. This ensures the chat is properly saved and closed.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      reason: { type: Type.STRING, description: "Reason for ending the conversation (e.g. User said goodbye)" }
    },
    required: ["reason"]
  }
};

export const TOOLS = [bookAppointmentTool, logToCrmTool, sendEmailTool, emailConversationToAdminTool, extractCustomerInfoTool, calculateShippingTool, generateCheckoutPaymentLinkTool, endConversationTool];

// --- COMPLETE TRAINING DATASET ---
export const DEFAULT_TRAINING_DATA = `

================================================================================
DETAILED PRODUCT SPECIFICATIONS (EXTRACTED FROM FICHAS TECNICAS)
================================================================================

--- PRODUCT DATA: 01_FT_Piso_Deck.pdf ---
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
Piso Deck Exterior
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
01
El Piso en DECK Exterior es fabricado con madera plástica compuesta, su
excelente apariencia y características le otorgan alta resistencia ante
cualquier condición climática, un producto de bajo mantenimiento, con
tecnología perdura, especial para jardines, piscinas, terrazas y zonas
sociales. Disponible en los siguientes colores:
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Residencial: Piscinas, Patios exteriores, fincas.
Comercial: Hoteles, Cabañas, Salones a cielo abierto,
Glampings, Restaurantes exteriores.
Exterior: Principalmente orientado en su exterior, alta
resistencia a tráficos medianos.
1.Preparación de la superficie: Para la estructura portante
utilice perfil base WPC nivelados, y distanciados entre 30 y 45
cms máximo, nivélelos mediante calzas según sea necesario,
teniendo en cuenta una pendiente mínima del 2%.
2.Cortes: Realizar los cortes de longitud necesarios según
medidas en obra y fije las tablas lo antes posible.
3.Sujeción: El piso DECK debe tener una altura mínima de 2''
permitiendo un paso de aire continuo entre el piso y las
tablas, para los empalmes se tendrá que tener en cuenta un
doble perfil base con doble clip por cada encuentro de tabla
a lo ancho (14.08cm).
4.Acabados: Sigue las recomendaciones del fabricante con los
accesorios sugeridos en caso de ser necesarios.
5.Mantenimiento: Agua y jabón neutro para retirar el polvo
acumulado en el tiempo, cuando se considere necesario.
Herramienta: Flexómetro, sierra caladora, cinta métrica,
taladro, regla, lápiz, chazos y tornillos.
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Piso DECK exterior
290cm x 14.8cm
8.37 Kilogramos
Unidad
2.3 cm
-
PVC - Madera
China
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño

--- PRODUCT DATA: 02_FT_Piso_SPC.pdf ---
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
Piso SPC
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
02
Sistema de suelo SPC de núcleo rígido formado por una mezcla de polvo
de piedra (carbonato de calcio) y PVC virgen, con acabado decorativo
que imita madera o tonos naturales (avellana, gris cenizo, roble claro,
etc.). Incluye capa de desgaste UV resistente a rasguños, manchas y
humedad, proporcionando estabilidad dimensional y apariencia estética
de alta definición. Ideal tanto para residencias como locales comerciales.
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Espacios residenciales: salas, dormitorios, cocinas, baños y
lavanderías (100% resistente al agua)
Entornos comerciales: Oficinas, boutiques, cafés, hoteles,
salas de espera
Ámbitos institucionales: Guarderías, colegios, clínicas
1.Preparación de la superficie: Debe estar limpia, seca, plana y
estructuralmente sólida.
2.Cortes: Dejar expansiones de aproximadamente 6mm en
bordes. Cortar lamas con sierra o cúter.
3.Fijación: Instalación como sistema flotante: encaje lateral y
final de lamas con sistema clic, sin adherirse al subsuelo.
Mantener espaciador las paredes.
4.Acabados: Instalar los zócalos o molduras sin fijarlos al suelo,
cubriendo juntas de expansión. Undercut en marcos de puertas
para que la lama encaje por debajo.
5.Mantenimiento: Limpiar con escoba o aspiradora. Para
manchas, usar detergente suave y paño húmedo. Evitar el uso
de ceras, abrasivos, solventes o esponjas rugosas.
Herramienta: Regla métrica, cúter o sierra, bloque de golpeo o
maza de goma, barra de tracción, espaciadores 6mm (1/4''), nivel
de burbuja, aspiradora o cepillo, guantes.
Peso:
Espesor Tipo L / Espesor Tipo XL / Espesor Tipo XXL
Formato Tipo L / Formato Tipo XL / Formato Tipo XXL
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Piso SPC
122cm x 18,3cm / 122cm x 22,8cm / 152cm x 23cm
0,8 Kilogramos
Unidad
0,4 cm / 0,45 cm / 0,55 cm
Aproximadamente 8kg/m²
PVC (Policloruro de Vinilo)
China
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño

--- PRODUCT DATA: 03_FT_Lamina Marmol PVC.pdf ---
FICHA TÉCNICA
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
03
Lamina Mármol PVC
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Recepciones
Habitaciones
Centros de entrenamiento
Salas de estar
Baños
1.Preparación de la superficie: esta debe estar nivelada, libre de
material biótico, humedades y polvo.
2.Cortes: De acuerdo al área corte la primera pieza si es necesario
y nivela de manera correcta paralelo al piso para que iniciar
manera ascendente la instalación.
3.Sujeción: Agregamos adhesivo de montaje en la cara posterior
producto en O-H y puntos de seguridad en los vacíos.
4.Acabados: Repetimos el proceso dejando una dilatación entre
cada pieza mínima de 2mm y máxima de 5mm para cubrir la
superficie deseada.
5.Mantenimiento: La dilatación o la junta le damos el acabado
con boquilla acrílica de acuerdo al color de la referencia
elegida, limpiamos y retiramos excesos de polvo y listo.
Herramienta: Bisturí, regla metálica de 120cms, guantes y gafas
de seguridad, adhesivo de montaje. 
Lámina mármol es un decorativo en PVC, la marca UNITEC U.S.A. trae la
solución ideal para el revestimiento de paredes interiores, ya que ofrece
un valor estético único para hogares, oficinas y comercios. Sus
propiedades técnicas brindan un acabado de la más alta calidad.
Además, es de fácil lavado y resistente contra la humedad.
SOBRE EL PRODUCTO
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Lamina Marmol PVC
244cm x 122cm
19 Kilos
Unidad
0.3 cm
-
PVC (Policloruro de Vinilo)
China
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño

--- PRODUCT DATA: 04_FT_Pared PU ArqUnitec.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
Pared PU ArqUnitec
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
04
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Recepciones
Habitaciones
Centros de entrenamiento
Salas de estar
1.Preparación de la superficie: Esta debe estar nivelada, libre de
material bituminoso, humedades y polvo.
2.Cortes: Utiliza una sierra para cortar los paneles de PU Stone
según las medidas y formas necesarias. Asegúrate de seguir las
instrucciones del fabricante para un corte preciso.
3.Sujeción: Aplica un adhesivo recomendado por el fabricante en
la parte posterior de cada panel. Asegúrate de distribuir
uniformemente el adhesivo.
4.Acabados: Realiza cortes adicionales en los paneles según sea
necesario para ajustarse a las esquinas y bordes. Utiliza
molduras o accesorios específicos para dar un acabado
profesional.
5.Mantenimiento: 
En 
caso 
de 
ser 
necesario 
retirar 
la
acumulación de polvo con una manguera de jardín o agua a
presión no superior a los 100 PSI, adopta las medidas de
seguridad necesarias para evitar daños.
Herramienta: Sierra de corte, guantes y gafas de seguridad,
adhesivo de montaje.
PARED PU ARQUNITEC, más conocida como piedra sintética de
poliuretano o PU STONE, es un material para acabados constructivos de
uso interior y exterior. Es liviano, flexible y maleable, capaz de adaptarse
a cualquier superficie y ambiente, su apariencia logra imitar la piedra
natural en gran formato, permite conseguir espacios modernos, de lujo y
con alto diseño. Disponible en los siguientes colores:
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Pared PU ArqUnitec
120 cm x 60 cm
2,28 Kilos
Caja por 10 unidades
3 cm
-
Poliuretano
China

--- PRODUCT DATA: 05_FT_Paredes_Muroflex.pdf ---
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
05
Pared Muroflex
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
1.Preparación de la superficie: Verifica que el muro esté limpio,
seco y nivelado. Si hay imperfecciones, corrige con masilla y lija.
2.Cortes: Marca una línea base en la parte inferior para alinear la
primera lama. Corta las piezas con una sierra manual,
ingleteadora o caladora si necesitas empalmes.
3.Sujeción: Aplica adhesivo de montaje tipo poliuretano o
silicona neutra en zigzag por detrás de la lama.
4.Acabados: Revisa uniones, esquinas y nivelación. Usa perfiles
de remate si deseas un acabado más limpio en bordes y
esquinas.
5.Mantenimiento: Revisa uniones, esquinas y nivelación. Usa
perfiles de remate si deseas un acabado más limpio en bordes y
esquinas.
Herramienta: Metro, nivel, cúter o sierra, adhesivo de montaje o
tornillos, escuadra.
Panel decorativo fabricado con un compuesto de madera plástica (WPC),
que combina fibras de madera natural y polímeros plásticos reciclados.
Su diseño rotativo y modular permite crear texturas y efectos
tridimensionales, ideales para espacios modernos y sofisticados. Es
resistente al agua, al moho y a los cambios climáticos, siendo ideal para
interiores y exteriores bajo techo.
Revestimiento:
 Muros en salas, habitaciones, oficinas, locales comerciales.
Decoración:
 Paredes tipo cabecero, fondos de TV, pasillos o columnas.
Espacios de alto diseño con necesidad de estética cálida y
textura visual.
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Pared Muroflex
290 cm x 5 cm
1,33 Kgs por unidad / 32 Kgs por Caja
Caja por 24 unidades
1.8 cm
Aproximadamente – kg/m²
WPC
China
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño

--- PRODUCT DATA: 06_FT_Pared Uniflex.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
06
Pared Uniflex
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Paredes interiores
Fachadas exteriores
Remodelaciones comerciales
Construcción industrial
Proyectos institucionales
1.Preparación de la superficie: esta debe estar nivelada, libre de
material biótico, humedades y polvo.
2.Cortes: De acuerdo al área corte la primera pieza si es necesario
y nivela de manera correcta paralelo al piso para que iniciar
manera ascendente la instalación.
3.Sujeción: Agregamos adhesivo de montaje en la cara posterior
producto en “OH” y puntos de seguridad en los vacíos.
4.Acabados: Repetimos el proceso dejando una dilatación entre
cada pieza mínima de 2mm y máxima de 5mm para cubrir la
superficie deseada.
5.Mantenimiento: La dilatación o la junta le damos el acabado
con boquilla acrílica de acuerdo al color de la referencia
elegida, limpiamos y retiramos excesos de polvo y listo.
Herramienta: Bisturí, regla metálica de 120 cm, guantes y gafas
de seguridad, adhesivo de montaje.
Las paredes Uniflex son acabados decorativos flexibles hechos de tierra
modificada (MMC), caracterizadas por su materia prima principal (arena
de cuarzo, tela de rejilla alcalina, emulsión ecológica), moldeadas y
horneadas e irradiadas utilizando un sistema de peinado con control de
temperatura especialmente diseñado.
 Dado que tienen la apariencia de una baldosa al principio de su
nacimiento, se las conoce comúnmente como baldosas blandas.
Además, debido a su propio peso ligero, relativamente delgado, también
es relativamente conveniente para transportar.
Disponible en los siguientes colores:
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Pared Uniflex
120 x 60 cm
2,92 Kgs por unidad / 87.7 Kilos por caja
Caja por 30 unidades
0.2 cm
-
Resinas, cuarzos
China
Media
Noche
Gris
Cenizo
Antracita
Nieve
Textura
Latte
Beige
Oxido
Terracota
Citrino
Macadamia

--- PRODUCT DATA: 07.1_FT_Pared_acolchada PalmaTrigo.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
07.1
Pared acolchada Palma/Trigo
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Absorción acústica:
 Estudios de grabación, salas de reuniones, auditorios,
oficinas, salas de ensayo, etc.
Protección anti-colisión:
 Habitaciones infantiles, espacios terapéuticos o mobiliario
acolchado decorativo.
Diseño interior:
 Espaldar de cama, decoración de oficina.
1.Preparación de la superficie: La pared debe estar limpia, lisa,
seca y libre de polvo, grasa u hongos.
2.Cortes: Determine la distribución de los paneles sobre la
superficie. Marque las líneas guías con lápiz y nivel.
3.Fijación: Aplique adhesivo tipo montaje (no corrosivo) en
forma de “S” o puntos sobre la parte posterior del panel.
Presione firmemente contra la pared por al menos 30 segundos.
4.Acabados: Revise que no haya espacios entre paneles. Para
uniones visibles o esquinas, puede usar perfiles de terminación
o tapajuntas.
5.Mantenimiento: Limpie ocasionalmente con un paño seco o
levemente húmedo. Para suciedad adherida, use jabón neutro y
agua.
Herramienta: Cinta métrica, cúter o bisturí, nivel de burbuja,
adhesivo de montaje, guantes y paño seco.
Panel tapizado con forma decorativa (arcos redondeados, espiga)
fabricado con núcleo acústico de espuma de poliuretano de celda
abierta y cubierta de tela suave (terciopelo o microfibra). Su diseño
lúdico y cuidado lo hace ideal para entornos infantiles, salas lounge o
proyectos de interiorismo contemporáneo que requieren estética y
absorción acústica.
Peso:
Espesor PALMA     /      Espesor TRIGO
PALMA          /          TRIGO
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Pared Acolchada
295 cm x 60 cm  /  395 cm x 60 cm
5 mm  /   5,5 mm
Aproximadamente 15kg/m²
Cuero sintético de alta calidad y espuma de poliuretano
China
2 Kilos  /  2 Kilos
6 rollos  /  6 rollos

--- PRODUCT DATA: 07.2_FT_Pared  Acolchada Aurora.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
07.2
Pared acolchada Aurora
La Pared Acolchada Aurora es un revestimiento decorativo para
interiores que combina diseño contemporáneo, confort y funcionalidad.
Fabricada con núcleo de espuma de poliuretano y recubierta en cuero
sintético de alta calidad, aporta un acabado elegante, suave al tacto y de
alto impacto visual.
Su estructura acolchada contribuye a la absorción acústica, mejorando el
confort sonoro del espacio, mientras que su diseño volumétrico añade
profundidad y sofisticación. Es una solución ideal para destacar muros y
elevar el diseño en proyectos residenciales y comerciales.
Disponible en los siguientes colores:
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Pared Acolchada Aurora
295 cm x 50 cm
4 Kg
Caja por 10 Unidades
22 mm
Aproximadamente 15 kg/m²
Cuero sintético de alta calidad y espuma de poliuretano
China
Siena
Caoba
Vainilla
Diamante
Negro
Brillo Plata
Rocio
Floral
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Absorción acústica:
 Estudios de grabación, salas de reuniones, auditorios, oficinas,
salas de ensayo, etc.
Protección anti-colisión:
 Habitaciones infantiles, espacios terapéuticos o mobiliario
acolchado decorativo.
Diseño interior:
 Espaldar de cama, decoración de oficina.
1.Preparación de la superficie: La pared debe estar limpia, lisa, seca y
libre de polvo, grasa u hongos.
2.Cortes: Determine la distribución de los paneles sobre la superficie.
Marque las líneas guías con lápiz y nivel.
3.Fijación: Aplique adhesivo tipo montaje (no corrosivo) en forma de “S”
o puntos sobre la parte posterior del panel. Presione firmemente
contra la pared por al menos 30 segundos.
4.Acabados: Revise que no haya espacios entre paneles. Para uniones
visibles o esquinas, puede usar perfiles de terminación o tapajuntas.
5.Mantenimiento: Limpie ocasionalmente con un paño seco o
levemente húmedo. Para suciedad adherida, use jabón neutro y agua.
Herramienta: Cinta métrica, cúter o bisturí, nivel de burbuja, adhesivo
de montaje, guantes y paño seco.

--- PRODUCT DATA: 08_FT_Panel_PS_Interior.pdf ---
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
08
Panel PS Interior
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Residencial: Salas de estar, dormitorios.
Comercial: 
Oficinas, 
restaurantes, 
hoteles, 
espacios
comerciales.
Decoración de Eventos: Bodas, fiestas, exhibiciones.
Diseños Arquitectónico
1.Preparación de la superficie: debe de estar limpia y seca, libre
de polvo, material biótico y humedad.
2.Cortes: De acuerdo al área, optimice los cortes del producto
teniendo en cuenta su medida estándar.
3.Sujeción: Aplique adhesivo de montaje al respaldo del
producto en líneas horizontales cada 30 cms y conecta cada
pieza con su sistema machimbrado hasta cubrir la superficie
deseada.
4.Acabados: Sigue las recomendaciones del fabricante con los
accesorios sugeridos en caso de ser necesarios.
5.Mantenimiento: Agua y jabón neutro para retirar el polvo
acumulado en el tiempo, cuando se considere necesario.
Herramienta: Flexómetro, cortadora, regla aluminio y guantes.
El panel PS es un nuevo material de protección ambiental. Ideal para
pared hecho en PVC con insumos complementarios que lo hacen liviano
para facilitar el transporte y la manipulación. Vale la pena mencionar que
el panel de pared es fácil de instalar, adecuado para diseño de interiores.
Solo una persona puede completar la renovación de la habitación
interior. Color y forma diversos, cumple con los diferentes estilos de
diseño.  Disponibles en linea luxury, biselado y estuario.
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Panel PS
290cm x 12cm /   290cm x 15cm / 290cm x 16cm / 290cm x 30cm 
1.75 Kilogramos
Unidad
1.2 cm
Aproximadamente 0.65 g/cm3
PVC (Policloruro de Vinilo)
China

--- PRODUCT DATA: 09_FT_fachada_Deck.pdf ---
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
País de Origen:
Material Principal:
La Fachada DECK es un sistema de recubrimiento exterior diseñado para
revestir fachadas en proyectos residenciales, comerciales, institucionales
y campestres. Su diseño tipo listón imita la apariencia de la madera
natural, aportando un acabado moderno, elegante y arquitectónico.
Fabricada en PVC de alta resistencia, la Fachada DECK ofrece excelente
desempeño frente a la humedad, la radiación solar y los cambios
climáticos, proporcionando durabilidad, estabilidad dimensional y bajo
mantenimiento. Además de su valor estético, contribuye al aislamiento
térmico y a la protección de la estructura frente a las inclemencias del
tiempo. Disponible en los siguientes colores:
Fachada DECK
Fachada DECK
290 cm (largo) x 15 cm (ancho)
4.9 kilogramos por unidad
Unidad
1.5 cm
Aproximadamente 7 kg/m²
PVC (Policloruro de Vinilo)
China
Residencial: Fachadas, división de jardines, cerramientos y
espacios privados.
Comercial: Proyectos comerciales y diseños arquitectónicos
Espacios públicos: Parques, áreas de juego y proyectos
urbanos.
Herramienta: Flexómetro, cortadora, regla de aluminio y
guantes 
1.Preparación de la superficie: debe estar limpia, seca y libre
de polvo, material bituminoso y humedad.
2.Cortes: Realizar los cortes de acuerdo al área a cubrir,
optimizando el producto según su medida estándar.
3.Sujeción: La instalación puede realizarse sobre estructura
metálica, madera o directamente sobre pared.  El anclaje se
hace 
mediante 
tornillo 
en 
el 
riel 
de 
cada 
pieza,
aproximadamente cada 60 cm. Su geometría permite
ensamblar una pieza con otra para lograr un acabado
continuo y uniforme.
4.Acabados: Seguir las recomendaciones del fabricante y
utilizar los accesorios sugeridos cuando sea necesario.
5.Mantenimiento: Limpieza con agua y jabón neutro para
retirar el polvo acumulado con el paso del tiempo.
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
09
Nombre del Producto:
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño

--- PRODUCT DATA: 10_FT_Polifachada.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
País de Origen:
Material Principal:
Polifachada
Polifachada
3,8 m x 38 cm
4,25 Kilogramos
Unidad
2,5 cm
Aproximadamente 15 kg/m²
PVC (Policloruro de Vinilo)
China
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
10
Nombre del Producto:
SOBRE EL PRODUCTO
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
1.Preparación de la superficie: La estructura de soporte (muros
portantes o panelería) debe estar nivelada, firme y seca.
Verifique la correcta alineación de la perfilería antes de iniciar la
instalación.
2.Cortes: Determinar las líneas de fijación y ubicación de los
paneles. Cortar a medida utilizando herramientas adecuadas,
asegurando cortes rectos y precisos.
3.Fijación: Empezar por el primer panel en esquina o punto de
arranque. Fijar mediante tornillos autorroscantes en los puntos
indicados 
(fijación 
visible 
u 
oculta), 
respetando 
los
espaciamientos recomendados por el fabricante. Instalar los
paneles sucesivos encajando el lado macho en el hembra del
panel anterior.
4.Acabados: Colocar perfiles de terminación en remates, juntas y
esquinas. Revisar la correcta alineación y continuidad visual.
Sellar con silicona si aplica, según recomendaciones técnicas.
5.Mantenimiento: Limpiar regularmente con agua y jabón
neutro. Evitar productos abrasivos o corrosivos.
Herramienta: Cinta métrica, nivel láser o de burbuja, guantes,
taladro con broca adecuada, tornillos autorroscantes, listones o
perfiles metálicos de soporte, perfiles de terminación.
La Polifachada es un sistema de revestimiento arquitectónico para
fachadas exteriores, fabricado en PVC (Policloruro de Vinilo), diseñado
para ofrecer alta resistencia a la humedad, agentes atmosféricos e
insectos. Su configuración modular de listones verticales permite una
instalación eficiente sobre estructuras de soporte, aportando estabilidad,
durabilidad y un acabado contemporáneo con bajo mantenimiento.
Revestimiento exterior:
Fachadas ventiladas en edificios residenciales, comerciales,
industriales y prefabricados, casetas modulares, cámaras
frigoríficas, 
sectorización 
industrial 
y 
cerramientos
decorativos.

--- PRODUCT DATA: 11_FT_Lamina_Sintetica.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
11
Lámina Sintética
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Revestimiento: Muros en salas, habitaciones, oficinas y
locales comerciales
Decoración: Paredes tipo cabecero, fondos de TV, pasillos y
columnas
Espacios de alto diseño con necesidad de estética cálida y
textura visual
Proyectos con retroiluminación decorativa
1.Preparación de la superficie: Asegúrese de que la base esté
limpia, seca y firme. Puede utilizar madera, MDF o aluminio
como soporte.
2.Cortes: Marque las medidas sobre la lámina con cinta o
marcador suave y realice los cortes según el diseño requerido.
3.Fijación: Utilice adhesivo de montaje neutro o silicona
transparente para fijar la lámina. También puede atornillarse
desde atrás si se instala sobre estructura metálica o modular.
4.Acabados: Retire excedentes de adhesivo. Instale luces LED si
el diseño es retroiluminado.
5.Mantenimiento: Limpie con paño suave y detergente neutro.
Evite abrasivos o estropajos. No se recomienda exponer
directamente al fuego u objetos calientes.
Herramienta: Sierra circular o caladora, cinta métrica, nivel,
taladro, brochas, luz LED (si es retroiluminada), adhesivo de
montaje neutro o silicona transparente.
La Lámina Sintética es un revestimiento decorativo de alto impacto
visual, diseñado para simular la apariencia natural del ónix
retroiluminado. Fabricada en WPC, su superficie translúcida permite el
paso de la luz, generando un efecto luminoso elegante y sofisticado.
Gracias a su ligereza, resistencia y facilidad de manipulación, es una
solución ideal para proyectos de interiorismo que buscan acabados
modernos, cálidos y personalizados, especialmente en aplicaciones
decorativas con iluminación integrada.
Peso:
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Lámina Sintética
Piedra del Sol / Crema Selecta: 244 cm x 122 cm
0,6 cm
Aproximadamente 8 kg/m²
WPC
China
12 Kilogramos
Unidad
Espesor:
Formato:

--- PRODUCT DATA: 12_FT_Foam_Board.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
12
Foam Board
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Decoración de interiores
Acabados para proyectos comerciales
Impresión digital y serigrafía
Señalización y cartelería
Puntos de venta y exhibiciones
Manualidades y proyectos de arte
1.Preparación de la superficie: La superficie debe estar limpia,
seca, lisa y libre de polvo, material bituminoso o humedad.
2.Cortes: De acuerdo al área, optimice los cortes del producto
teniendo en cuenta su medida estándar. Realice cortes precisos
con bisturí o herramienta adecuada.
3.Sujeción: Aplique adhesivo de montaje para PVC en la pared o
en la cara posterior del Foam Board, utilizando un patrón en
zigzag o puntos uniformemente distribuidos.
4.Acabados: Siga las recomendaciones del fabricante y utilice los
accesorios sugeridos en caso de ser necesarios para lograr un
acabado limpio y profesional.
5.Mantenimiento: Limpie con agua y jabón neutro para retirar el
polvo acumulado con el tiempo, cuando sea necesario.
Herramienta: Flexómetro, bisturí o cúter, regla de aluminio y
guantes.
El Foam Board es un panel decorativo liviano y versátil, compuesto por
un núcleo de espuma de poliestireno de alta densidad, recubierto por
capas externas de acabado técnico y decorativo. Su estructura garantiza
rigidez, 
estabilidad 
dimensional 
y 
facilidad 
de 
manipulación,
convirtiéndolo en una solución ideal para aplicaciones de diseño interior,
exhibiciones, revestimientos decorativos y proyectos creativos.  
Disponible en múltiples líneas especializadas, diseñadas para responder
a diferentes conceptos estéticos y necesidades de diseño: Aurora Boreal,
Zen, Espejo, Gotas de Agua y Pastel.
Gracias a su bajo peso, fácil corte, rápida instalación y amplia variedad de
acabados, el Foam Board permite transformar superficies simples en
elementos de alto valor estético, manteniendo un excelente balance
entre diseño, funcionalidad y rendimiento.
Peso:
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Foam Board
244 cm x 122 cm
0.5 cm
Aproximadamente 0.55 g/cm³
PVC (Policloruro de Vinilo)
China
9.5 Kilogramos
Unidad
Formato:
Espesor:

--- PRODUCT DATA: 13_FT_Rollo Adhesivo Mármol.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
13
Rollo Adhesivo de Mármol
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Revestimientos: Cocinas, baños, salas, oficinas o como
backsplash
Cubiertas de mobiliario: Encimeras, zócalos y superficies
planas
Aplicaciones 
temporales 
o 
decorativas: 
Stands,
exhibiciones y remodelaciones rápidas
1.Preparación de la superficie: La superficie debe estar limpia,
seca, lisa y libre de polvo, grasa o humedad. Lijar ligeramente
superficies brillantes o acrílicas y retirar residuos con alcohol.
2.Cortes: Cortar el vinilo con precisión antes de retirar el liner
protector. Para esquinas, marcar con lápiz fino.
3.Sujeción: Retirar el papel protector gradualmente y aplicar
sobre la superficie con la mano o rodillo desde un extremo,
presionando hacia afuera para evitar burbujas de aire.
4.Acabados: Alinear bien las vetas entre tramos si aplica junta.
Recortar bordes sobrantes con cúter tras la fijación.
5.Mantenimiento: Limpiar con paño húmedo y jabón neutro.
Evitar productos abrasivos.
Herramienta: Cinta métrica, cúter, regla metálica, espátula o
rodillo de presión, paño seco, alcohol isopropílico para limpieza.
El Rollo Adhesivo Mármol es un revestimiento decorativo autoadhesivo
fabricado en vinilo PVC, diseñado para replicar el acabado visual del
mármol natural de forma práctica y económica. Su superficie ofrece un
efecto elegante y sofisticado, ideal para renovar espacios sin necesidad
de obras ni procesos complejos.
Gracias a su flexibilidad, bajo peso y fácil instalación, permite transformar
muros, mobiliario y superficies planas, proporcionando una solución
funcional para proyectos decorativos, remodelaciones rápidas y
aplicaciones temporales, con buena resistencia al uso diario y a la
humedad.
Disponible en 4 colores: Gris, Negro, Mármol T9 y Blanco. 
Peso:
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Rollo Adhesivo Mármol
300 cm x 60 cm
0,008 cm
Aproximadamente 8 kg/m²
Vinilo PVC
China
0,2 Kilogramos
Unidad
Formato:
Espesor:

--- PRODUCT DATA: 14_FT_Panel_WPC_Exterior.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
14
Panel WPC Exterior
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
El panel en WPC Exterior es fabricado con madera plástica compuesta
(WPC - Wood Plastic Composite) su excelente apariencia y características
le otorgan alta resistencia ante cualquier condición climática, un
producto de bajo mantenimiento que combina calidad y sostenibilidad,
con estética y funcionalidad. Disponible en los siguientes colores:
Residencial: Salas de estar, dormitorios.
Comercial: 
Oficinas, 
restaurantes, 
hoteles, 
espacios
comerciales.
Decoración de Eventos: Bodas, fiestas, exhibiciones.
Diseños Arquitectónico
1.Preparación de la superficie: debe de estar limpia y seca,
libre de polvo, material biótico y humedad.
2.Cortes: De acuerdo al área, optimice los cortes del producto
teniendo en cuenta su medida estándar.
3.Sujeción: Aplique adhesivo de montaje al respaldo del
producto en líneas horizontales cada 30 cms y conecta cada
pieza con su sistema machimbrado hasta cubrir la superficie
deseada.
4.Acabados: Sigue las recomendaciones del fabricante con los
accesorios sugeridos en caso de ser necesarios.
5.Mantenimiento: Agua y jabón neutro para retirar el polvo
acumulado en el tiempo, cuando se considere necesario.
Herramienta: Flexómetro, cortadora, regla aluminio y
guantes.
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Panel WPC exterior
 290 cm x 21.9 cm
10.6 Kg
Unidad
2.6 cm
-
WPC
China

--- PRODUCT DATA: 15_FT_Panel_WPC_Interior.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
15
Panel WPC Interior
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Panel decorativo interior fabricado en Wood-Plastic Composite (WPC),
con aspecto de madera y acabado en listones verticales. Ideal para
revestir muros con diseño contemporáneo y alta resistencia al agua,
insectos y humedad, con bajo mantenimiento y excelente desempeño
en espacios interiores.
Revestimiento: Mural decorativo en salas, recibidores,
zonas lounge, oficinas, restaurantes, hoteles y locales
comerciales
Espacios 
con 
humedad 
ocasional: 
Cocinas, 
baños,
lavanderías
Paredes de acento: fondos de muebles, divisiones con
estética vertical y moderna
1.Preparación de la superficie: La pared debe estar limpia, seca,
plana y libre de polvo o grasa.
2.Cortes: Marcar alineación con nivel y lápiz. Cortar paneles con
sierra para un ajuste preciso en esquinas o extremos.
3.Fijación: Dos clips por cada metro lineal; fijar los clips al
bastidor o pared primero y luego encajar los paneles.
4.Acabados: Colocar perfiles o molduras en remates, cubrir
juntas visibles y asegurar un alineado vertical perfecto entre
listones.
5.Mantenimiento: Limpiar con paño seco o húmedo. Para
manchas, usar detergente suave. Evitar abrasivos, solventes o
limpiadores agresivos que puedan dañar la superficie.
Herramienta: Cinta métrica, sierra circular o caladora, adhesivo
o clips metálicos, pistola de silicona, nivel, espaciadores, guantes
y gafas de protección.
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Panel WPC Interior
295cm x 16cm
3 Kilogramos
10 Piezas por caja
2,5cm
Aproximadamente 9kg/m²
PVC (Policloruro de Vinilo)
China

--- PRODUCT DATA: 16_FT_Panel_WPC_Interior_Redondo.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
16
Panel WPC Interior Redondo
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Revestimiento: Mural decorativo en salas, recibidores,
zonas lounge, oficinas, restaurantes, hoteles y locales
comerciales
Espacios 
con 
humedad 
ocasional: 
Cocinas, 
baños,
lavanderías
Paredes de acento: fondos de muebles, divisiones con
estética vertical y moderna
1.Preparación de la superficie: La pared debe estar limpia, seca,
plana y libre de polvo o grasa.
2.Cortes: Marcar alineación con nivel y lápiz. Cortar paneles con
sierra para un ajuste preciso en esquinas o extremos.
3.Fijación: Dos clips por cada metro lineal; fijar los clips al
bastidor o pared primero y luego encajar los paneles.
4.Acabados: Colocar perfiles o molduras en remates, cubrir
juntas visibles y asegurar un alineado vertical perfecto entre
listones.
5.Mantenimiento: Limpiar con paño seco o húmedo. Para
manchas, usar detergente suave. Evitar abrasivos, solventes o
limpiadores agresivos que puedan dañar la superficie.
Herramienta: Cinta métrica, sierra circular o caladora, adhesivo
o clips metálicos, pistola de silicona, nivel, espaciadores, guantes
y gafas de protección.
Panel decorativo interior de Composite de Madera-Plástico (WPC) con
perfil semi-redondo fluted, de diseño elegante y textura curva. Ideal
como revestimiento mural o de cielo en proyectos residenciales y
comerciales que buscan acabado moderno, resistente a humedad, libre
de mantenimiento y con estética cálida.
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Panel WPC Interior Redondo
295cm x 16cm
3 Kilogramos
10 Piezas por caja
2,5cm
Aproximadamente 9kg/m²
PVC (Policloruro de Vinilo)
China

--- PRODUCT DATA: 17_FT_Paneles_acolchados DuoBig  DuoSmall.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
17
Panel Acolchado DuoBig / DuoSmall
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Revestimiento: Mural en habitaciones infantiles, guarderías,
áreas lúdicas y salas temáticas.
Ambientes: Espacios comerciales y lounge que buscan
estética decorativa con funcionalidad acústica (cafés,
boutiques, salas de espera)
Otros: Espacios con necesidad moderada de control de
reverberación sin perder diseño
1.Preparación de la superficie: La pared debe estar limpia, seca
y libre de polvo, humedad o grasa.
2.Cortes: Marcar la disposición de los paneles sobre la pared
usando nivel y lápiz antes de iniciar la instalación.
3.Sujeción: Aplicar adhesivo tipo montaje en forma de “S” o
puntos en la parte posterior del panel. Presionar firmemente
contra la pared por al menos 30 segundos.
4.Acabados: Revisar alineación entre paneles y cubrir juntas
visibles con perfiles decorativos o tapajuntas si se requiere.
5.Mantenimiento: Limpiar con paño seco o ligeramente
húmedo. En caso de manchas, usar jabón neutro y agua. Evitar
solventes, lijas o productos abrasivos que dañen la tela.
Herramienta: Cinta métrica, cúter o bisturí, nivel o nivel de
burbuja, guantes, adhesivo de montaje o clips metálicos para
fijación, paño limpio.
El Panel Acolchado Duo Big y Duo Small es un sistema decorativo y
funcional diseñado para aportar confort acústico, suavidad visual y alto
valor estético a espacios interiores. Su geometría curva y modular genera
una lectura vertical continua que ayuda a reducir la reverberación sonora
y mejora el acondicionamiento acústico del ambiente.
Fabricado con núcleo de espuma de poliuretano y recubierto con cuero
sintético de alta calidad, el panel ofrece una textura uniforme,
envolvente y resistente. El espesor controlado de cada formato garantiza
un buen desempeño acústico sin sacrificar limpieza estética,
convirtiéndolo en una solución ideal para proyectos de interiorismo
contemporáneo que buscan calidez, control sonoro y diseño.
Disponible en 4 colores:
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Panel Acolchado
Duo Big: 120 cm x 40 cm /  Duo Small: 110 cm x 20 cm
0,5 Kilogramos (unidad)
Unidad
Duo Big: 3,5 cm / Duo Small: 2,5 cm
Aproximadamente 15 kg/m²
Cuero sintético de alta calidad y espuma de poliuretano
China
Azul
Fractal
Gris
Luminoso
Brillo Plata
Vainilla

--- PRODUCT DATA: 18.1_FT_Panel Acústico Tipo 1.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
18.1
Panel Acústico Tipo 1
El Panel Acústico Tipo 1 es un revestimiento decorativo acústico de
diseño ondulado tipo listón, desarrollado para mejorar la absorción
sonora y aportar profundidad visual a los espacios interiores. Su
geometría curva genera una lectura vertical continua que optimiza el
control de la reverberación y refuerza la continuidad arquitectónica del
ambiente.
Fabricado en MDF con respaldo acústico, combina estética tipo madera
con funcionalidad acústica, siendo ideal para proyectos contemporáneos
que buscan equilibrio entre diseño, confort sonoro y durabilidad. Su
acabado de listones “crisply aligned” ofrece un aspecto limpio, moderno
y sofisticado. 
Disponible en 4 colores: cedro, cedro madera, ebano y avellana.
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Revestimientos: Interiores en oficinas, salas de reuniones,
hoteles, residencias y restaurantes.
Espacios 
de 
difusión 
acústica: 
Teatros, 
salas 
de
conferencias, zonas lounge.
Paredes de acento: Detrás de sofás, áreas de trabajo y
murales decorativos.
1.Preparación de la superficie: La pared debe estar limpia, seca,
plana y libre de polvo o grasa.
2.Cortes: Marcar alineación con nivel y lápiz. Cortar paneles con
sierra para un ajuste preciso en esquinas o extremos.
3.Fijación: Dos clips por cada metro lineal; fijar los clips al
bastidor o pared primero y luego encajar los paneles.
4.Acabados: Colocar perfiles o molduras en remates, cubrir
juntas visibles y asegurar un alineado vertical perfecto entre
listones.
5.Mantenimiento: Limpiar con paño seco o húmedo. Para
manchas, usar detergente suave. Evitar abrasivos, solventes o
limpiadores agresivos que puedan dañar la superficie.
Herramienta: Cinta métrica, sierra circular o caladora, adhesivo
o clips metálicos, pistola de silicona, nivel, espaciadores, guantes
y gafas de protección.
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Panel Acústico Tipo 1
240 cm x 60 cm
5 Kilogramos
Unidad
1,4 cm
Aproximadamente 8 kg/m²
MDF + Fieltro negro
China

--- PRODUCT DATA: 18.2_FT_Panel Acústico Tipo 2.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
18.2
Panel Acústico Tipo 2
El Panel Acústico Tipo 2 es un revestimiento decorativo acústico
modular de geometría hexagonal, diseñado para optimizar la absorción y
difusión sonora en espacios interiores. Su textura tipo madera y relieve
tridimensional generan un alto impacto visual, al tiempo que
contribuyen al control de la reverberación y a la mejora del confort
acústico.
Fabricado en MDF con respaldo acústico, permite crear composiciones
precisas y personalizadas, adaptándose a diferentes configuraciones
arquitectónicas. Es una solución ideal para proyectos contemporáneos
que buscan combinar diseño, funcionalidad acústica y estética de alto
nivel.
Disponible en 4 colores: cedro, cedro madera, ebano y avellana.
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Revestimientos: Interiores en oficinas, salas de reuniones,
hoteles, residencias y restaurantes.
Espacios 
de 
difusión 
acústica: 
Teatros, 
salas 
de
conferencias, zonas lounge.
Paredes de acento: Detrás de sofás, áreas de trabajo y
murales decorativos.
1.Preparación de la superficie: La pared debe estar limpia, seca,
plana y libre de polvo o grasa.
2.Cortes: Marcar alineación con nivel y lápiz. Cortar paneles con
sierra para un ajuste preciso en esquinas o extremos.
3.Fijación: Dos clips por cada metro lineal; fijar los clips al
bastidor o pared primero y luego encajar los paneles.
4.Acabados: Colocar perfiles o molduras en remates, cubrir
juntas visibles y asegurar un alineado vertical perfecto entre
listones.
5.Mantenimiento: Limpiar con paño seco o húmedo. Para
manchas, usar detergente suave. Evitar abrasivos, solventes o
limpiadores agresivos que puedan dañar la superficie.
Herramienta: Cinta métrica, sierra circular o caladora, adhesivo
o clips metálicos, pistola de silicona, nivel, espaciadores, guantes
y gafas de protección.
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Panel Acústico Tipo 2
76 cm x 62 cm
3 Kilogramos
Unidad
1,8 cm
Aproximadamente 5 kg/m²
MDF + Fieltro negro
China

--- PRODUCT DATA: 18.3_FT_Panel Acústico Tipo 3.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
18.3
Panel Acústico Tipo 3
El Panel Acústico Tipo 3 es un revestimiento decorativo acústico de
formato vertical con patrón en espiga, diseñado para mejorar la
absorción y difusión sonora en espacios interiores. Su textura tipo
madera y relieve direccional aportan dinamismo visual y ritmo
arquitectónico, convirtiéndolo en un elemento protagónico del diseño
interior.
Fabricado en MDF con respaldo acústico, su diseño modular permite una
instalación precisa y composiciones continuas, optimizando el control
acústico sin sacrificar estética. Es una solución ideal para proyectos
contemporáneos que buscan equilibrio entre diseño, confort sonoro y
funcionalidad.
Disponible en 4 colores: cedro, cedro madera, ebano y avellana.
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Revestimientos: Interiores en oficinas, salas de reuniones,
hoteles, residencias y restaurantes.
Espacios 
de 
difusión 
acústica: 
Teatros, 
salas 
de
conferencias, zonas lounge.
Paredes de acento: Detrás de sofás, áreas de trabajo y
murales decorativos.
1.Preparación de la superficie: La pared debe estar limpia, seca,
plana y libre de polvo o grasa.
2.Cortes: Marcar alineación con nivel y lápiz. Cortar paneles con
sierra para un ajuste preciso en esquinas o extremos.
3.Fijación: Dos clips por cada metro lineal; fijar los clips al
bastidor o pared primero y luego encajar los paneles.
4.Acabados: Colocar perfiles o molduras en remates, cubrir
juntas visibles y asegurar un alineado vertical perfecto entre
listones.
5.Mantenimiento: Limpiar con paño seco o húmedo. Para
manchas, usar detergente suave. Evitar abrasivos, solventes o
limpiadores agresivos que puedan dañar la superficie.
Herramienta: Cinta métrica, sierra circular o caladora, adhesivo
o clips metálicos, pistola de silicona, nivel, espaciadores, guantes
y gafas de protección.
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Panel Acústico Tipo 3
125,9 cm x 56,6 cm
5 Kilogramos
Unidad
2,1 cm
Aproximadamente 7 kg/m²
MDF + Fieltro negro
China

--- PRODUCT DATA: 18.4_FT_Panel Acústico Tipo 4.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
18.4
Panel Acústico Tipo 4
El Panel Acústico Tipo 4 es un revestimiento decorativo acústico de
gran formato, diseñado con patrón en espiga continua que aporta
continuidad visual y alto desempeño acústico en muros arquitectónicos.
Su textura tipo madera y relieve lineal optimizan la absorción y difusión
sonora, mejorando el confort acústico del espacio.
Fabricado en MDF con respaldo acústico, su diseño vertical refuerza la
percepción de altura y orden, convirtiéndolo en una solución ideal para
proyectos contemporáneos que requieren control sonoro, estética
sofisticada y alto impacto visual.
Disponible en 4 colores: cedro, cedro madera, ebano y avellana.
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Revestimientos: Interiores en oficinas, salas de reuniones,
hoteles, residencias y restaurantes.
Espacios 
de 
difusión 
acústica: 
Teatros, 
salas 
de
conferencias, zonas lounge.
Paredes de acento: Detrás de sofás, áreas de trabajo y
murales decorativos.
1.Preparación de la superficie: La pared debe estar limpia, seca,
plana y libre de polvo o grasa.
2.Cortes: Marcar alineación con nivel y lápiz. Cortar paneles con
sierra para un ajuste preciso en esquinas o extremos.
3.Fijación: Dos clips por cada metro lineal; fijar los clips al
bastidor o pared primero y luego encajar los paneles.
4.Acabados: Colocar perfiles o molduras en remates, cubrir
juntas visibles y asegurar un alineado vertical perfecto entre
listones.
5.Mantenimiento: Limpiar con paño seco o húmedo. Para
manchas, usar detergente suave. Evitar abrasivos, solventes o
limpiadores agresivos que puedan dañar la superficie.
Herramienta: Cinta métrica, sierra circular o caladora, adhesivo
o clips metálicos, pistola de silicona, nivel, espaciadores, guantes
y gafas de protección.
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Panel Acústico Tipo 4
270 cm x 55,9 cm
5 Kilogramos
Unidad
2,1 cm
Aproximadamente 7 kg/m²
MDF + Fieltro negro
China

--- PRODUCT DATA: 18.5_FT_Panel Acústico Tipo 5.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
18.5
Panel Acústico Tipo 5
El Panel Acústico Tipo 5 es un revestimiento decorativo acústico de
formato vertical, compuesto por listones lineales con textura tipo
madera, diseñado para mejorar la absorción sonora y el control acústico
en espacios interiores. Su geometría continua aporta orden visual,
profundidad y continuidad arquitectónica, convirtiéndose en una
solución funcional y estética para muros de alto diseño.
Fabricado en MDF y montado sobre respaldo acústico, ofrece un
equilibrio ideal entre desempeño acústico, facilidad de instalación y
acabado contemporáneo, siendo apto para muros y cielos interiores.
Disponible en 4 colores: cedro, cedro madera, ebano y avellana.
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Revestimientos: Interiores en oficinas, salas de reuniones,
hoteles, residencias y restaurantes.
Espacios 
de 
difusión 
acústica: 
Teatros, 
salas 
de
conferencias, zonas lounge.
Paredes de acento: Detrás de sofás, áreas de trabajo y
murales decorativos.
1.Preparación de la superficie: La pared debe estar limpia, seca,
plana y libre de polvo o grasa.
2.Cortes: Marcar alineación con nivel y lápiz. Cortar paneles con
sierra para un ajuste preciso en esquinas o extremos.
3.Fijación: Dos clips por cada metro lineal; fijar los clips al
bastidor o pared primero y luego encajar los paneles.
4.Acabados: Colocar perfiles o molduras en remates, cubrir
juntas visibles y asegurar un alineado vertical perfecto entre
listones.
5.Mantenimiento: Limpiar con paño seco o húmedo. Para
manchas, usar detergente suave. Evitar abrasivos, solventes o
limpiadores agresivos que puedan dañar la superficie.
Herramienta: Cinta métrica, sierra circular o caladora, adhesivo
o clips metálicos, pistola de silicona, nivel, espaciadores, guantes
y gafas de protección.
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Panel Acústico Tipo 5
240 cm x 60 cm
2 Kilogramos
Unidad
1,6 cm
Aproximadamente 5 kg/m²
MDF + Fieltro negro
China

--- PRODUCT DATA: 18.6_FT_Panel Acústico Tipo 6.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
18.6
Panel Acústico Tipo 6
El Panel Acústico Tipo 6 es un revestimiento decorativo acústico tipo
listón de madera natural o laminada, montado sobre respaldo acústico
(fieltro PET o núcleo mineral/fibra). Su geometría ondulada genera una
superficie tridimensional que mejora la difusión acústica, reduce
reflexiones directas y optimiza la calidad del sonido en el espacio.
Su textura formada por listones crea variaciones rítmicas que aportan
profundidad visual y carácter contemporáneo, mientras que su formato
modular permite una instalación precisa y continua. Es una solución
funcional y estética para interiores que requieren alto desempeño
acústico y diseño arquitectónico.
Disponible en 4 colores: cedro mix avellana, madera mix avellana, cedro
mix ebano, madera mix ebano.
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Revestimientos: Interiores en oficinas, salas de reuniones,
hoteles, residencias y restaurantes.
Espacios 
de 
difusión 
acústica: 
Teatros, 
salas 
de
conferencias, zonas lounge.
Paredes de acento: Detrás de sofás, áreas de trabajo y
murales decorativos.
1.Preparación de la superficie: La pared debe estar limpia, seca,
plana y libre de polvo o grasa.
2.Cortes: Marcar alineación con nivel y lápiz. Cortar paneles con
sierra para un ajuste preciso en esquinas o extremos.
3.Fijación: Dos clips por cada metro lineal; fijar los clips al
bastidor o pared primero y luego encajar los paneles.
4.Acabados: Colocar perfiles o molduras en remates, cubrir
juntas visibles y asegurar un alineado vertical perfecto entre
listones.
5.Mantenimiento: Limpiar con paño seco o húmedo. Para
manchas, usar detergente suave. Evitar abrasivos, solventes o
limpiadores agresivos que puedan dañar la superficie.
Herramienta: Cinta métrica, sierra circular o caladora, adhesivo
o clips metálicos, pistola de silicona, nivel, espaciadores, guantes
y gafas de protección.
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Panel Acústico Tipo 6
116,1 cm x 120 cm
5 Kilogramos
Unidad
2,1 cm
Aproximadamente 7 kg/m²
MDF + Fieltro negro
China

--- PRODUCT DATA: 19_FT_Panel_Acrilico Mármol.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
19
Panel Acrilico de Mármol
SOBRE EL PRODUCTO
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Revestimiento de paredes y muros decorativos
Fondos para salas, recepciones y locales comerciales
Revestimiento de columnas e islas decorativas
Tableros retroiluminados
Señalética y elementos arquitectónicos
Mesones decorativos y aplicaciones interiores
1.Preparación de la superficie: Verifique que el muro esté seco,
limpio, liso y firme. En caso de irregularidades, realice un lijado
o relleno previo.
2.Corte del panel: Marque el contorno deseado directamente
sobre la parte posterior del panel y realice el corte con
herramientas adecuadas.
3.Sujeción: Aplique adhesivo de montaje o silicona neutra de
forma uniforme en la parte posterior del panel. Presione
firmemente 
contra 
el 
muro 
asegurando 
una 
correcta
adherencia.
4.Acabados: Verifique la nivelación. Selle bordes si el proyecto lo
requiere o instale perfiles decorativos en esquinas y uniones.
5.Mantenimiento: Limpie con paño seco o ligeramente húmedo.
No utilice productos abrasivos, ácidos o solventes. Evite
contacto directo con objetos calientes.
Herramienta: Nivel láser, adhesivo neutro o adhesivo de
montaje, cinta métrica, caladora de dientes finos, guantes, paño
suave.
El Panel Acrílico Mármol es un revestimiento decorativo de alto brillo
fabricado en resina acrílica de alta densidad, diseñado para reproducir
fielmente la estética del mármol natural con una solución más liviana,
resistente y fácil de instalar.
Su acabado translúcido y efecto profundo aportan elegancia,
luminosidad y sofisticación a los espacios, convirtiéndose en una
alternativa moderna al mármol o granito tradicional, ideal para proyectos
arquitectónicos y de diseño interior.
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Panel Acrílico Mármol
2,44 m x 1,22 m (Área por panel: 2,9 m²)
7 kg
Unidad
2 mm
Aproximadamente 9kg/m²
Acrílico
China

--- PRODUCT DATA: 20_FT_Listón WPC Exterior.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
20
Listón WPC Exterior
SOBRE EL PRODUCTO
RECOMENDACIONES DE INSTALACIÓN
VENTAJAS DEL PRODUCTO
Alta resistencia a la humedad, sol y cambios climáticos
No se pudre, no se oxida y no se astilla
Apariencia tipo madera natural
Bajo mantenimiento
Material sostenible y de larga vida útil
Ideal para uso arquitectónico exterior
Instalar sobre estructura nivelada y firme.
Utilizar tornillería y accesorios recomendados para WPC
exterior.
Dejar dilataciones entre piezas según condiciones climáticas
Uso de tornillo de acero inoxidable WPC exterior REF:
14122901.
El Listón WPC Exterior es un elemento arquitectónico fabricado en
Wood Plastic Composite (WPC), diseñado para aplicaciones exteriores
que requieren alta resistencia a la intemperie y una estética tipo madera
natural. Su composición combina fibras de madera y polímeros, logrando
un producto duradero, estable y de bajo mantenimiento, ideal para
fachadas, pérgolas, celosías y revestimientos decorativos exteriores.
Disponible en los siguientes colores:
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Listón WPC Exterior
Listón tipo tubular 5,60m (largo) x 6cm (ancho) x 4cm (alto)
8,8Kg
Unidad
6 mm
-
WPC (Wood Plastic Composite)
China
MANTENIMIENTO
Limpieza con agua y jabón neutro
No requiere barnices, selladores ni tratamientos especiales
USOS Y APLICACIONES
Fachadas exteriores
Muros decorativos
Pérgolas y parasoles
Cerramientos arquitectónicos
Proyectos residenciales y comerciales

--- PRODUCT DATA: 21_FT_Listón PVC Interior.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
21
Listón PVC Interior
SOBRE EL PRODUCTO
El Listón PVC Interior es un revestimiento decorativo arquitectónico
fabricado en PVC de alta calidad, diseñado para aplicaciones interiores
que requieren ligereza, resistencia a la humedad y bajo mantenimiento.
Su diseño tipo listón con acabado tipo madera permite crear superficies
continuas, modernas y elegantes, aportando orden visual y profundidad
a los espacios.
Es una solución ideal para proyectos de interiorismo residencial y
comercial, donde se busca una alternativa práctica a la madera natural,
sin los requerimientos de mantenimiento ni las limitaciones frente a la
humedad.
Disponible en los siguientes colores:
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Listón PVC Interior
Listón tipo sólido 2,90 m (largo) x 10 cm (ancho frente) x 5 cm (alto)
1,1 kg
Unidad
3 mm
-
PVC (Policloruro de Vinilo)
China
USOS Y APLICACIONES
Paredes decorativas
Revestimiento de columnas interiores
Proyectos residenciales y comerciales de diseño interior
GUÍA DE INSTALACIÓN
1.Preparación de la superficie: La pared debe estar seca, limpia, lisa y
nivelada. Si existen imperfecciones mayores, se recomienda resanar o
alisar previamente para garantizar una correcta alineación de los listones.
2.Trazado y cortes: Marque las líneas guía sobre el muro para asegurar una
instalación recta y continua. Corte los listones a la medida requerida
utilizando herramientas manuales o eléctricas adecuadas.
3.Fijación del listón: El listón PVC estructural puede fijarse de dos maneras:
4.Fijación mecánica (recomendada): Atornille el listón directamente a la
superficie o estructura de soporte, utilizando tornillos adecuados para PVC.
5.Fijación con adhesivo (uso interior): Aplique adhesivo de montaje en la
parte posterior del listón en forma de cordón o puntos uniformes y
presione firmemente contra el muro.
6.Instalación del KIT TAPONES: Una vez fijado el listón: Inserte los tapones
del KIT TAPONES LISTÓN PVC ESTRUCTURAL 10 CM en los extremos visibles
del perfil. Asegure el ajuste presionando suavemente hasta lograr un cierre
limpio y alineado. El uso de los tapones garantiza un acabado estético,
uniforme y seguro, además de proteger el interior del perfil.
7.Acabados: Revise la alineación final de los listones.  En esquinas o
terminaciones, puede complementar con perfiles decorativos si el diseño
lo requiere. No es necesario pintar ni sellar el producto.
Herramienta: Cinta métrica, nivel, sierra manual o eléctrica, taladro,
tornillos para PVC, adhesivo de montaje (opcional), martillo de goma,
KIT TAPONES LISTÓN PVC ESTRUCTURAL 10 CM, paño limpio.

--- PRODUCT DATA: 22_FT_Listón PVC Cielo Raso.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
22
Listón PVC Cielo Raso
SOBRE EL PRODUCTO
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Cielos rasos interiores en salas, oficinas y baños
Pasillos o recepciones
Aplicaciones decorativas en techos de bajo tráfico
1.Preparación de la superficie: Verifique que el cielo esté limpio
y nivelado. Use perfiles de soporte metálicos o de PVC para
asegurar la estructura.
2.Cortes: Tome medidas del área. Corte las piezas al largo
deseado, cuidando el acabado de los bordes.
3.Sujeción: Instale los perfiles guía en el perímetro. Luego
introduzca y fije los listones en los perfiles con tornillos o clips
de presión.
4.Acabados: Puede sellar juntas con silicona blanca o rematar con
perfiles decorativos para dar un acabado profesional.
5.Mantenimiento: Limpieza sencilla con paño húmedo. No
requiere pintura ni tratamientos especiales.
Herramienta: Cinta métrica, cúter o sierra, taladro, perfiles en U
o L.
El Listón PVC Cielo Raso es un elemento decorativo y funcional
diseñado para revestimiento de cielos rasos interiores. Su geometría
lineal aporta un acabado moderno y continuo, ideal para proyectos
residenciales y comerciales. Fabricado en PVC de alta calidad, es liviano,
resistente a la humedad y de fácil instalación, ofreciendo una alternativa
duradera frente a materiales tradicionales.
Disponible en los siguientes colores:
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Listón PVC Cielo Raso
7 kg
Unidad
2.5 mm
-
China
Perfil estructural hueco 2,90 m (largo) x 9 cm (ancho frente) x 5 cm (alto)
PVC (Policloruro de Vinilo)
VENTAJAS DEL PRODUCTO
Resistente a la humedad
No se oxida ni se pudre
Material liviano
Fácil limpieza
Bajo mantenimiento
Instalación rápida
Acabado tipo madera de alta estética

--- PRODUCT DATA: 23_FT_Cielo Raso Lamina PVC.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
23
Cielo Raso Lámina PVC
SOBRE EL PRODUCTO
La Lámina PVC para Cielo Raso es un sistema decorativo y funcional
para recubrimiento de techos interiores. Fabricada en PVC de alta
calidad, ofrece una solución liviana, resistente y de fácil instalación, ideal
para proyectos residenciales, comerciales e institucionales.
Disponible en acabados brillantes, mate, textura marmolizada,
amaderada, y colores exclusivos (bajo pedido).
Peso:
Calibre: 
Formato:
Embalaje:
Acabado:
País de Origen:
Material Principal:
Nombre del Producto:
Cielo Raso Lamina PVC
2.5 – 3 kg por unidad
Unidad
8.5 mm
Brillante / Mate (según referencia)
China
PVC (Policloruro de Vinilo)
USOS Y APLICACIONES
Cielos rasos residenciales
Oficinas y locales comerciales
Zonas húmedas (baños, cocinas, lavanderías)
Proyectos institucionales
30 cm (ancho) x 5,95 m (largo)
CARACTERISTICAS
Impermeable
Fácil de limpiar
Aislante térmico
Aislante acústico
Material liviano
Fácil instalación
Autoextinguible
Material reciclable
No contiene metales
No requiere mantenimiento
BENEFICIOS DEL PRODUCTO
Mejora la estética del espacio
Reduce costos de mantenimiento
Instalación rápida y limpia
Alta durabilidad
Resistente a la humedad y al moho
ACCESORIOS COMPATIBLES
Corniza PVC
Perimetral tipo F
Perimetral tipo U
Unión tipo H
Esquinero
        (Accesorios diseñados para garantizar una instalación estética y profesional)

--- PRODUCT DATA: 24_FT_Zocalo SPC.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
24
Zocalo SPC
SOBRE EL PRODUCTO
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Remate perimetral entre piso y muro
Proyectos residenciales y comerciales
Espacios interiores como salas, habitaciones, oficinas y
pasillos
Compatible con pisos SPC, laminados y otros pisos flotantes
1.Preparación de la superficie: El muro debe estar limpio, seco y
libre de polvo o grasa.
2.Cortes: Corte los zócalos a la medida requerida, cuidando los
ángulos en esquinas internas y externas.
3.Fijación: Aplique adhesivo de montaje en la parte posterior del
zócalo y presione firmemente contra el muro. No fijar al piso
para permitir la dilatación del revestimiento.
4.Acabados: Verifique alineación y continuidad. Selle juntas si el
diseño lo requiere.
5.Mantenimiento: Limpieza con paño húmedo y detergente
suave. No usar productos abrasivos.
Herramienta: Cinta métrica, sierra manual o ingleteadora,
adhesivo de montaje, espátula, paño limpio.
El Zócalo SPC (Stone Plastic Composite) es un accesorio arquitectónico
diseñado para brindar un acabado limpio, estético y funcional en la
unión entre pisos y muros. Fabricado con núcleo rígido SPC, ofrece alta
resistencia, estabilidad dimensional y durabilidad, siendo ideal para
proyectos residenciales y comerciales.
Su acabado tipo madera complementa perfectamente los pisos SPC y
otros revestimientos, aportando continuidad visual y protección
perimetral frente a golpes, humedad y desgaste diario.
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Zócalo SPC
240 cm x 7 cm
-
10 piezas por caja
13 mm
-
SPC (Stone Plastic Composite)
China

--- PRODUCT DATA: 25_FT_Lamina PVC Board.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
25
Lámina PVC Board
SOBRE EL PRODUCTO
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Publicidad y artes gráficas
Muebles para el hogar
Construcción liviana
Aplicación industrial
Material de acabados
1.Preparación de la superficie: La superficie debe estar limpia,
nivelada y libre de material bituminoso, humedad o polvo.
2.Cortes: Utilice una sierra adecuada para el corte de paneles de
PVC BOARD según las medidas y formas necesarias. Asegúrese
de seguir las recomendaciones del fabricante para obtener
cortes precisos.
3.Sujeción: Aplique un adhesivo recomendado por el fabricante
en la parte posterior de cada panel. Distribuya el adhesivo de
manera uniforme para asegurar una correcta fijación.
4.Acabados: Realice cortes adicionales si es necesario para
ajustar el panel a esquinas y bordes. Utilice molduras o
accesorios específicos para lograr un acabado profesional.
5.Mantenimiento: 
En 
caso 
de 
ser 
necesario, 
retire 
la
acumulación de polvo con una manguera de jardín o con agua
a presión no superior a 110 PSI, adoptando las medidas de
seguridad necesarias para evitar daños.
Herramienta: Sierra de corte, guantes y gafas de seguridad,
adhesivo de montaje.
Denominado comercialmente como PVC BOARD, es una lámina
fabricada en PVC espumado rígido, con acabado endurecido, superficie
suave y disponible en presentación brillante o mate. Gracias a su
estructura celular interna, ofrece una excelente combinación de ligereza,
resistencia y estabilidad dimensional, facilitando su manipulación, corte
e instalación.
Las láminas PVC BOARD pueden pintarse, imprimirse, laminarse, rutearse
y perforarse con facilidad, siendo ideales para aplicaciones de
modelismo, construcción liviana, mobiliario, señalización, ferias y
exposiciones. Es un material impermeable, autoextinguible, resistente a
vibraciones y a la humedad, lo que lo convierte en una alternativa
versátil y duradera para proyectos de interior y uso técnico.
Peso:
Espesor:
Formato:
Embalaje:
Densidad / Calibres disponibles:
País de Origen:
Material Principal:
Nombre del Producto:
PVC BOARD
244 cm x 122 cm
Unidad
0,3 cm
3 mm | 5 mm | 9 mm | 12 mm | 15 mm | 18 mm
PVC
China
5 Kilogramos

--- PRODUCT DATA: 26.1_FT_Cubierta Termoacustica UPVC Roma.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
26.1
Cubierta Termoacustica UPVC Roma 
USOS Y APLICACIONES
Lámina termoacústica fabricada en UPVC (cloruro de polivinilo no
plastificado) con perfil tipo teja romana, diseñada para cubrir y proteger
espacios reduciendo el ruido y el calor. Ofrece alta resistencia a la
intemperie, a la corrosión y a los rayos UV, garantizando durabilidad y
bajo mantenimiento.
Cubiertas residenciales estilo colonial
Techos de terrazas y patios
Proyectos arquitectónicos con estética de teja curva
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Cubierta Termoacustica UPVC 2,5mm Roma
11,80m - 1,05m (Ancho útil 98cm)
Unidad
Aproximadamente 1,40 g/cm3l
UPVC (Cloruro de Polivinilo no Plastificado)
China
COLORES DISPONIBLES
2.5MM
5 Kilogramos
2.5 mm
1.Preparación de la superficie: Instale una estructura de soporte metálica o de
madera, limpia, firme y nivelada. Verifique la correcta alineación y respete la
separación de correas según especificación técnica, garantizando una
pendiente adecuada para la evacuación del agua.
2.Corte: Marque las medidas requeridas sobre la lámina. Realice los cortes
utilizando tijera para lámina plástica o herramienta de disco fino, evitando
generar rebabas o deformaciones en el material.
3.Colocación: Coloque las láminas en sentido contrario a la dirección del viento
dominante, iniciando desde el alero hacia la cumbrera. Asegure el correcto
traslape lateral y longitudinal para evitar filtraciones.
4.Sujeción: Fije las láminas perforando previamente en la cresta de la teja. Utilice
tornillos autoperforantes con arandela de neopreno, sin sobreapretar,
permitiendo la dilatación térmica natural del UPVC.
5.Acabados: Instale remates, cumbreras y accesorios compatibles. Revise sellos y
puntos de unión para garantizar estanqueidad y continuidad estética.
6.Mantenimiento: Limpie periódicamente con agua y jabón neutro. Evite el uso
de productos químicos abrasivos. Inspeccione anualmente la fijación y el estado
general de la cubierta.
Recomendaciones importantes:
No caminar directamente sobre la lámina sin apoyo estructural.
Evitar instalaciones en condiciones climáticas extremas.
Respetar siempre las recomendaciones del fabricante para asegurar la
durabilidad y la garantía del producto.
GUÍA DE INSTALACIÓN
Herramienta: Taladro, broca para metal o madera, tornillos
autoperforantes con arandela de neopreno, cinta métrica,
tijera para lámina plástica o herramienta de disco fino,
guantes y gafas de seguridad.

--- PRODUCT DATA: 26.2_FT_Cubierta Termoacustica UPVC Blanca O.A.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
26.2
Cubierta Termoacustica UPVC Blanca O.A
USOS Y APLICACIONES
Lámina termoacústica de UPVC con perfil ondulado alto, diseñada para
cubrir grandes luces y ofrecer mayor resistencia estructural. Especial para
naves industriales y techos expuestos a altas cargas de viento.
Galpones y bodegas
Cubiertas industriales
Áreas de producción o almacenamiento
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Cubierta Termoacustica UPVC 2.5mm Blanca O.A
11,80m - 1,07m (Ancho útil 1m)
Unidad
Aproximadamente 1,40 g/cm3
UPVC (Cloruro de Polivinilo no Plastificado)
China
2.5MM
COLORES DISPONIBLES
5 Kilogramos
2.5 mm
1.Preparación de la superficie: Instale una estructura de soporte metálica o de
madera, limpia, firme y nivelada. Verifique la correcta alineación y respete la
separación de correas según especificación técnica, garantizando una
pendiente adecuada para la evacuación del agua.
2.Corte: Marque las medidas requeridas sobre la lámina. Realice los cortes
utilizando tijera para lámina plástica o herramienta de disco fino, evitando
generar rebabas o deformaciones en el material.
3.Colocación: Coloque las láminas en sentido contrario a la dirección del viento
dominante, iniciando desde el alero hacia la cumbrera. Asegure el correcto
traslape lateral y longitudinal para evitar filtraciones.
4.Sujeción: Fije las láminas perforando previamente en la cresta de la teja. Utilice
tornillos autoperforantes con arandela de neopreno, sin sobreapretar,
permitiendo la dilatación térmica natural del UPVC.
5.Acabados: Instale remates, cumbreras y accesorios compatibles. Revise sellos y
puntos de unión para garantizar estanqueidad y continuidad estética.
6.Mantenimiento: Limpie periódicamente con agua y jabón neutro. Evite el uso
de productos químicos abrasivos. Inspeccione anualmente la fijación y el estado
general de la cubierta.
Recomendaciones importantes:
No caminar directamente sobre la lámina sin apoyo estructural.
Evitar instalaciones en condiciones climáticas extremas.
Respetar siempre las recomendaciones del fabricante para asegurar la
durabilidad y la garantía del producto.
GUÍA DE INSTALACIÓN
Herramienta: Taladro, broca para metal o madera, tornillos
autoperforantes con arandela de neopreno, cinta métrica,
tijera para lámina plástica o herramienta de disco fino,
guantes y gafas de seguridad.

--- PRODUCT DATA: 26.3_FT_Cubierta Termoacustica UPVC Blanca O.B.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
26.3
Cubierta Termoacustica UPVC Blanca O.B
USOS Y APLICACIONES
Panel de UPVC con perfil de onda baja, idóneo para cubiertas
residenciales o comerciales donde se busque un acabado más discreto y
menor altura de onda.
Tejados de vivienda urbana
Cubiertas comerciales ligeras
Techos de pérgolas o corredores
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Cubierta Termoacustica UPVC 2.0mm Blanca O.B
11,80m - 1,13m (Ancho útil 1,5m)
Unidad
2.0 mm
Aproximadamente 1,40 g/cm3
UPVC (Cloruro de Polivinilo no Plastificado)
China
2.0MM
COLORES DISPONIBLES
5 Kilogramos
1.Preparación de la superficie: Instale una estructura de soporte metálica o de
madera, limpia, firme y nivelada. Verifique la correcta alineación y respete la
separación de correas según especificación técnica, garantizando una
pendiente adecuada para la evacuación del agua.
2.Corte: Marque las medidas requeridas sobre la lámina. Realice los cortes
utilizando tijera para lámina plástica o herramienta de disco fino, evitando
generar rebabas o deformaciones en el material.
3.Colocación: Coloque las láminas en sentido contrario a la dirección del viento
dominante, iniciando desde el alero hacia la cumbrera. Asegure el correcto
traslape lateral y longitudinal para evitar filtraciones.
4.Sujeción: Fije las láminas perforando previamente en la cresta de la teja. Utilice
tornillos autoperforantes con arandela de neopreno, sin sobreapretar,
permitiendo la dilatación térmica natural del UPVC.
5.Acabados: Instale remates, cumbreras y accesorios compatibles. Revise sellos y
puntos de unión para garantizar estanqueidad y continuidad estética.
6.Mantenimiento: Limpie periódicamente con agua y jabón neutro. Evite el uso
de productos químicos abrasivos. Inspeccione anualmente la fijación y el estado
general de la cubierta.
Recomendaciones importantes:
No caminar directamente sobre la lámina sin apoyo estructural.
Evitar instalaciones en condiciones climáticas extremas.
Respetar siempre las recomendaciones del fabricante para asegurar la
durabilidad y la garantía del producto.
GUÍA DE INSTALACIÓN
Herramienta: Taladro, broca para metal o madera, tornillos
autoperforantes con arandela de neopreno, cinta métrica,
tijera para lámina plástica o herramienta de disco fino,
guantes y gafas de seguridad.

--- PRODUCT DATA: 26.4_FT_Teja Termoacustica UPVC 2.5mm COLONIAL.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
26.4
Teja PVC Terracota Colonial 11,80*1.05 de 2,5mm
USOS Y APLICACIONES
Panel termoacústico en UPVC con perfil tipo teja colonial, ideal para
edificaciones que buscan un diseño clásico y aislamiento eficiente. Su
estructura multicapa reduce significativamente el ruido de impacto y la
temperatura interior.
Casas campestres y rurales
Centros recreativos
Cubiertas decorativas en climas cálidos
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Teja PVC Terracota Colonial 11,80*1.05 de 2,5mm
11,80m - 1,05m (Ancho útil 98cm)
5 Kilogramos
Unidad
2.5 mm
Aproximadamente 1,40 g/cm3
UPVC (Cloruro de Polivinilo no Plastificado)
China
2.5MM
COLORES DISPONIBLES
1.Preparación de la superficie: Instale una estructura de soporte metálica o de
madera, limpia, firme y nivelada. Verifique la correcta alineación y respete la
separación de correas según especificación técnica, garantizando una
pendiente adecuada para la evacuación del agua.
2.Corte: Marque las medidas requeridas sobre la lámina. Realice los cortes
utilizando tijera para lámina plástica o herramienta de disco fino, evitando
generar rebabas o deformaciones en el material.
3.Colocación: Coloque las láminas en sentido contrario a la dirección del viento
dominante, iniciando desde el alero hacia la cumbrera. Asegure el correcto
traslape lateral y longitudinal para evitar filtraciones.
4.Sujeción: Fije las láminas perforando previamente en la cresta de la teja. Utilice
tornillos autoperforantes con arandela de neopreno, sin sobreapretar,
permitiendo la dilatación térmica natural del UPVC.
5.Acabados: Instale remates, cumbreras y accesorios compatibles. Revise sellos y
puntos de unión para garantizar estanqueidad y continuidad estética.
6.Mantenimiento: Limpie periódicamente con agua y jabón neutro. Evite el uso
de productos químicos abrasivos. Inspeccione anualmente la fijación y el estado
general de la cubierta.
Recomendaciones importantes:
No caminar directamente sobre la lámina sin apoyo estructural.
Evitar instalaciones en condiciones climáticas extremas.
Respetar siempre las recomendaciones del fabricante para asegurar la
durabilidad y la garantía del producto.
GUÍA DE INSTALACIÓN
Herramienta: Taladro, broca para metal o madera, tornillos
autoperforantes con arandela de neopreno, cinta métrica,
tijera para lámina plástica o herramienta de disco fino,
guantes y gafas de seguridad.

--- PRODUCT DATA: 26.5_FT_Teja UPVC Tipo Zinc.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
26.5
Teja UPVC Tipo Zinc
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
La Teja UPVC Tipo Zinc es una solución innovadora y funcional para
cubiertas, diseñada para brindar protección, durabilidad y estética. Su
fabricación en cloruro de polivinilo no plastificado (UPVC) la hace
altamente resistente a la intemperie, corrosión y agentes químicos,
garantizando una larga vida útil. Gracias a su diseño y composición,
ofrece aislamiento térmico y acústico, además de ser impermeable y
liviana, lo que facilita su instalación y manipulación.
Residencial: Uso en cubiertas de salas de estar, dormitorios,
terrazas y patios.
Industrial y Comercial: Ideal para bodegas, almacenes,
fábricas y proyectos arquitectónicos modernos.
Espacios Públicos: Aplicable en invernaderos, establos y
refugios para ganado, protegiendo de la lluvia y el calor.
1.Medición y planificación: Determina el área donde se
instalarán las tejas y calcula la cantidad necesaria.
2.Corte y preparación: Usa una cortadora para ajustar las
tejas según las dimensiones requeridas.
3.Colocación: Superpón las tejas al menos 10 cm entre cada
una para garantizar una adecuada impermeabilidad.
4.Perforación: Realiza perforaciones con un taladro en los
puntos de fijación. Es recomendable perforar en la parte alta
de las ondas para evitar filtraciones.
5.Fijación: Usa tornillos auto perforantes con arandelas de
neopreno para asegurar las tejas sin afectar su dilatación
térmica.
6.Revisión: Asegúrate de que todas las uniones estén bien
ajustadas y no haya espacios abiertos que puedan generar
filtraciones o afectar la estabilidad de la estructura.
Herramienta: Flexómetro, cortadora, taladro, destornillador.
Peso:
Espesor:
Formato:
Embalaje:
Colores disponibles
País de Origen:
Material Principal:
Nombre del Producto:
Teja UPVC Tipo Zinc
305 cm x 93 cm
1.76 kg/m²
Unidad
0.8 mm
Blanca, Verde, Azul
UPVC (Cloruro de Polivinilo no Plastificado)
China
0.8MM
COLORES DISPONIBLES

--- PRODUCT DATA: 26.6_FT_Cubierta Acanalada UPV Blanca.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
26.6
Cubierta Acanalada UPV Blanca
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
La Cubierta Acanalada UPVC Blanca es una solución arquitectónica
para cubiertas y techos, fabricada en PVC alveolar de alta resistencia,
diseñada para ofrecer excelente aislamiento térmico y acústico, alta
durabilidad y resistencia a condiciones ambientales exigentes.
 Su diseño acanalado proporciona rigidez estructural, óptima evacuación
del agua y un acabado moderno y funcional, ideal para proyectos
residenciales, comerciales e industriales.
Cubiertas y techos
Bodegas y naves industriales
Terrazas y pérgolas
Áreas comerciales y residenciales
Estacionamientos y cubiertas livianas
1.Preparación de la estructura: Instalar sobre estructura metálica o de
madera firme, alineada y nivelada. Respetar una distancia máxima entre
correas de 1,20 m. Verificar pendiente mínima para correcta evacuación
del agua.
2.Corte de la lámina: Medir y marcar la longitud requerida. Cortar con sierra
manual o eléctrica de dientes finos. Retirar residuos del corte antes de la
instalación.
3.Colocación de la teja: Instalar las láminas en el sentido de la pendiente,
comenzando desde el alero hacia la cumbrera. Superponer las láminas
respetando el ancho efectivo (830 mm). Asegurar correcta alineación entre
ondas para evitar filtraciones.
4.Fijación: Perforar previamente la lámina en la cresta de la onda. Utilizar
tornillos con arandela y sello de neopreno para evitar filtraciones. No
sobreapretar los tornillos; permitir la dilatación térmica del material.
5.Accesorios y remates: Instalar cumbreras, remates laterales y accesorios
recomendados para cubiertas UPVC. Utilizar el Accesorio Cubierta
Acanalada UPVC – REF: 14082315 para una correcta fijación y sellado.
6.Revisión final: Verificar alineación, fijaciones y sellos. Asegurar que no
existan tensiones en las láminas.
7.Mantenimiento: Limpieza periódica con agua y jabón neutro. No usar
productos abrasivos, solventes ni elementos cortantes.
Herramienta: Taladro eléctrico, broca para PVC, tornillos
autorroscantes con arandela y sello de neopreno, cinta
métrica, nivel, sierra manual o eléctrica, guantes y gafas de
seguridad.
Peso:
Espesor:
Formato:
Embalaje:
Aislamiento acústico
País de Origen:
Material Principal:
Nombre del Producto:
Teja UPVC Tipo Zinc
5,5 – 6,0 kg por m² (estimado)
Unidad
10 mm
35 dB
UPVC (Cloruro de Polivinilo no Plastificado)
China
10MM
885mm (Ancho útil 883mm) / Altura de onda 40mm

--- PRODUCT DATA: 27_FT_Adhesivo de Montaje PEGATEC.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
27
Adhesivo de Montaje PEGATEC
Adhesivo profesional de alto rendimiento formulado para aplicaciones
interiores, diseñado para ofrecer una fuerte adherencia en múltiples
sustratos. Su fórmula especial permite un desempeño óptimo frente a
cambios de temperatura y condiciones de humedad, con propiedades
antihongos que prolongan la vida útil de las uniones. Ideal para trabajos
de instalación, fijación y reparación en proyectos de construcción,
carpintería y bricolaje.
Peso:
Presentaciones:
Formato:
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Adhesivo de Montaje PEGATEC
0,5 Kilogramos
Unidad
Pegatec Blanco – 395 ml  /  Pegatec Transparente – 300 ml 
-
Poliuretano
China
22 cm x 4 cm
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Instalación de molduras y zócalos.
Fijación de paneles decorativos y revestimientos.
Sellado y unión en carpintería interior.
Reparaciones rápidas en superficies de madera, PVC,
cerámica y metal.
1.Preparación de la superficie:  Limpie y seque las superficies.
Elimine polvo, grasa y partículas sueltas para asegurar una
correcta adherencia.
2.Cortes: Corte la boquilla del cartucho en un ángulo de 45° al
diámetro de cordón deseado. Coloque el cartucho en la pistola
aplicadora.
3.Fijación: Aplique el adhesivo en cordones o puntos uniformes
sobre la superficie. Presione firmemente las piezas a unir antes
de que forme piel.
4.Acabados: Retire el exceso de adhesivo con una espátula o
paño húmedo. Ajuste las piezas alineándolas correctamente.
5.Mantenimiento: Una vez curado, el adhesivo no requiere
mantenimiento. Para limpieza, utilice disolvente adecuado
antes del secado completo.

--- PRODUCT DATA: 28.1_FT_Iluminación Perfil Led.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
28.1
Iluminación Perfil Led
Barra de iluminación LED rígida de doble fila, luz blanco cálido, diseñada
para instalación en paneles WPC de interior. Proporciona una
iluminación uniforme y decorativa con bajo consumo energético.
Peso:
Espesor:
Presentaciones: 
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Iluminación Perfil Led
0,5 Kilogramos
Unidad
1,5 cm
-
LED
China
Barra Led 1: 50 cm x 1,5 cm / Barra Led 2: 70 cm x 1,5 cm / Barra Led 3: 120 cm x 1,5 cm
USOS Y APLICACIONES
Iluminación decorativa para interiores
Integración en paneles WPC o muebles
Resaltado de elementos arquitectónicos
GUÍA DE INSTALACIÓN
1.Preparación de la superficie: Asegúrese de que el panel WPC
o superficie esté limpia, seca y nivelada para la instalación de
los perfiles LED. 
2.Cortes: Mida y marque las posiciones de instalación. Si es
necesario, corte el perfil LED con herramienta adecuada para
aluminio.
3.Fijación: Monte el perfil en la superficie usando clips o
tornillos. Conecte el cableado al transformador respetando la
polaridad.
4.Acabados: Instale el difusor de policarbonato. Asegúrese de
que no haya cables sueltos.
5.Mantenimiento: Limpie con paño seco o ligeramente húmedo.
No use solventes. Verifique conexiones periódicamente.
Herramienta: Taladro, destornillador, cinta métrica, cutter,
guantes de seguridad.io.

--- PRODUCT DATA: 28.2_FT_Iluminación Transformador Perfil Led.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
28.2
Iluminación Transformador Perfil Led
Fuente de alimentación para perfiles LED, convierte corriente alterna a
corriente continua estabilizada para un funcionamiento seguro y
eficiente de las tiras o barras LED.
Peso:
Espesor:
Embalaje:
Espesor Tipo XL:
País de Origen:
Material Principal:
Nombre del Producto:
Iluminación Transformador Perfil Led
0,3 Kilogramos
Unidad
1,5 cm
3,5 mm
China
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Alimentación de perfiles LED
Iluminación arquitectónica
Proyectos residenciales y comerciales
1.Preparación de la superficie: Asegúrese de que el panel WPC
o superficie esté limpia, seca y nivelada para la instalación de
los perfiles LED. 
2.Cortes: Mida y marque las posiciones de instalación. Si es
necesario, corte el perfil LED con herramienta adecuada para
aluminio.
3.Fijación: Monte el perfil en la superficie usando clips o
tornillos. Conecte el cableado al transformador respetando la
polaridad.
4.Acabados: Instale el difusor de policarbonato. Asegúrese de
que no haya cables sueltos.
5.Mantenimiento: Limpie con paño seco o ligeramente húmedo.
No use solventes. Verifique conexiones periódicamente.
Herramienta: Taladro, destornillador, cinta métrica, cutter,
guantes de seguridad.io.
Presentación:
24V (voltios) - 60W (vatios) /  3,5 cm x 5,8 cm
Carcasa metálica / Componentes electrónicos internos

--- PRODUCT DATA: 28.3_FT_Iluminación Control Led.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
28.3
Control remoto táctil por radiofrecuencia para perfiles LED, permite
regular intensidad (Dimerizar - reducir o aumentar la intensidad de la
luz), encendido/apagado y efectos de iluminación.
Peso:
Espesor:
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Iluminación Control Led
0,2 Kilogramos
Unidad
2 cm
-
Carcasa metálica / Componentes electrónicos internos
China
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Control de perfiles LED en interiores
Ajuste 
de 
iluminación 
en 
proyectos 
residenciales 
y
comerciales
Integración en sistemas decorativos
1.Preparación: Verifique que la superficie esté limpia, seca y
nivelada antes de la instalación.
2.Medición y corte: Mida el área de instalación y realice los
cortes necesarios del perfil LED o accesorios según el diseño.
3.Fijación: Instale el perfil LED sobre la superficie utilizando clips,
tornillos o adhesivo recomendado.
4.Conexión eléctrica: Conecte el perfil LED al transformador y al
control LED, respetando polaridad y especificaciones eléctricas.
5.Prueba y acabado:  Verifique el correcto funcionamiento,
instale el difusor y asegure que no queden cables sueltos.
6.Mantenimiento: Limpie con paño seco o ligeramente húmedo.
No use productos abrasivos.
Presentación:
12 cm x 5 cm
Iluminación Control Led

--- PRODUCT DATA: 29.1_FT_Jardin Artificial Exterior.pdf ---
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
Jardín Artificial Exterior
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
29.1
El Jardín Artificial de Exterior está diseñado para revestir fachadas,
muros y superficies verticales, ofreciendo una apariencia natural con alta
resistencia a la intemperie, rayos UV y humedad. Es una solución
decorativa duradera, funcional y de bajo mantenimiento, ideal para
proyectos residenciales, comerciales y urbanos que buscan integrar
vegetación sin requerir riego, poda o cuidados constantes.
Disponible en 4 modelos: Pradera, Edén, Paraíso y Primavera.
USOS Y APLICACIONES
Residencial: Terrazas, balcones, muros decorativos exteriores.
Comercial: Fachadas, restaurantes, hoteles, locales
comerciales
Espacios públicos: Parques, áreas de juego, proyectos verdes
urbanos
Decoración de eventos: Stands, exhibiciones y
ambientaciones exteriores
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Jardín Artificial Exterior
50 × 50 cm
0,7 kg
Unidad suelta o caja x 30
1 mm
Aproximadamente 5 kg/m²
PVC (Policloruro de Vinilo)
China
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
GUÍA DE INSTALACIÓN
1.Preparación de la superficie: Debe estar limpia, seca y libre
de polvo, material biótico y humedad. Se recomienda pintar
con vinilo hidrófugo verde para mejor cubrimiento.
2.Cortes: Optimice los cortes según el área, teniendo en
cuenta el formato estándar del producto.
3.Sujeción: Fije el panel del jardín artificial con chazo y tornillo
en los ojales de cada pieza. También, si lo deseas, el panel
puede ser pegado a la pared con nuestro adhesivo de
montaje PEGATEC. Ensamble los paneles entre sí hasta cubrir
la superficie deseada.
4.Acabados: Siga las recomendaciones del fabricante y utilice
accesorios si es necesario.
5.Mantenimiento: Limpieza ocasional con agua y jabón neutro
para retirar polvo acumulado.
Herramienta: Flexómetro, bisturí, regla de aluminio, guantes.

--- PRODUCT DATA: 29.2_FT_Jardín Artificial Interior.pdf ---
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
Jardín Artificial Interior
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
29.2
El Jardín Artificial de Interior está diseñado para imitar la apariencia de
la vegetación natural, transformando muros y superficies verticales en
espacios verdes de alto impacto visual. Proporciona una solución
decorativa, duradera y libre de mantenimiento, ideal para interiores que
buscan una sensación de frescura, conexión natural y diseño
contemporáneo sin requerir riego ni poda.
Disponible en 3 modelos: Natural, Venecia y París. 
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Residencial: Salas de estar, dormitorios
Comercial: Oficinas, restaurantes, hoteles, espacios
comerciales
Decoración de eventos: Bodas, fiestas, exhibiciones
Espacios públicos: Parques, áreas de juego, proyectos verdes
urbanos
1.Preparación de la superficie: Debe estar limpia, seca y libre
de polvo, material biótico y humedad. Se recomienda pintar
con vinilo hidrófugo verde para mejor cubrimiento.
2.Cortes: Optimice los cortes según el área, teniendo en
cuenta el formato estándar del producto.
3.Sujeción: Fije el panel del jardín artificial con chazo y tornillo
en los ojales de cada pieza. También, si lo deseas, el panel
puede ser pegado a la pared con nuestro adhesivo de
montaje PEGATEC. Ensamble los paneles entre sí hasta cubrir
la superficie deseada.
4.Acabados: Siga las recomendaciones del fabricante y utilice
accesorios si es necesario.
5.Mantenimiento: Limpieza ocasional con agua y jabón neutro
para retirar polvo acumulado.
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
País de Origen:
Material Principal:
Nombre del Producto:
Jardín Artificial Interior
60 × 40 cm
0,7 kg
Unidad suelta o caja x 30
1 mm
Aproximadamente 5 kg/m²
PVC (Policloruro de Vinilo)
China
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
Herramienta: Flexómetro, bisturí, regla de aluminio, guantes.

--- PRODUCT DATA: 29.3_FT_Jardín Artificial Linea Moss.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
Jardín Artificial línea Moss
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
29.3
La Línea MOSS de jardines artificiales ofrece una estética orgánica y
contemporánea que transforma muros y superficies verticales en
espacios verdes suaves y envolventes, sin necesidad de riego ni poda.
Fabricados en PVC de alta calidad, estos paneles están diseñados para
uso interior y exterior protegido, con alta resistencia a la humedad, al
desgaste y a condiciones ambientales variables, conservando su color y
textura a lo largo del tiempo.
 Es una solución decorativa práctica, versátil y sostenible que combina
estética natural y funcionalidad arquitectónica.
Disponible en 2 modelos: Mini-Mossy y Mossy Pino Ciprés
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Residencial: Salas de estar, dormitorios, muros decorativos.
Comercial: Oficinas, restaurantes, hoteles, locales comerciales
Decoración de eventos: Bodas, fiestas, exhibiciones
Diseños arquitectónicos: Proyectos interiores y exteriores
protegidos
1.Preparación de la superficie: Debe estar limpia, seca y libre
de polvo, material biótico y humedad. Se recomienda pintar
con vinilo hidrófugo verde para mejor cubrimiento.
2.Cortes: Optimice los cortes según el área, teniendo en
cuenta el formato estándar del producto.
3.Sujeción: Fije el panel del jardín artificial con chazo y tornillo
en los ojales de cada pieza. También, si lo deseas, el panel
puede ser pegado a la pared con nuestro adhesivo de
montaje PEGATEC. Ensamble los paneles entre sí hasta cubrir
la superficie deseada.
4.Acabados: Siga las recomendaciones del fabricante y utilice
accesorios si es necesario.
5.Mantenimiento: Limpieza ocasional con agua y jabón neutro
para retirar polvo acumulado.
Peso:
Espesor:
Formato:
Embalaje:
Tipo de follaje:
País de Origen:
Material Principal:
Nombre del Producto:
Jardín Artificial  línea Moss 
50 × 50 cm
0,7 kg
Unidad suelta o caja x 30
Mini-Mossy 2,5 cm /  Mossy Pino Ciprés 3 cm
Mini-Mossy ( Fino, estilo musgo) 
Mossy Pino Ciprés (Ramas de ciprés o pino con follaje tupido)
PVC (Policloruro de Vinilo)
China
Herramienta: Flexómetro, bisturí, regla de aluminio, guantes.

--- PRODUCT DATA: 30.1_FT_Aluminio_Ferretero.pdf ---
FICHA TÉCNICA
SOBRE EL PRODUCTO
Aluminio Ferretero
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
30.1
El Aluminio Ferretero está diseñado para aplicaciones generales en
carpintería metálica, cerramientos, divisiones, cortinería, cielos rasos y
soluciones arquitectónicas livianas. Se caracteriza por su resistencia,
ligereza, durabilidad y versatilidad, siendo ideal tanto para proyectos
residenciales como comerciales, garantizando resistencia a la corrosión y
facilidad de mantenimiento.
Material
Aluminio extruido de alta calidad
Acabados: crudo, blanco, dorado, bronce y anodizados decorativos
USOS Y APLICACIONES
Divisiones interiores
Cielos rasos
Cortinería
Marcos livianos
Cerramientos
Estructuras decorativas
Proyectos comerciales y residenciales
CARACTERÍSTICAS TÉCNICAS
Material liviano y resistente
Alta durabilidad
Resistente a la corrosión
Fácil manipulación e instalación
No requiere mantenimiento constante
Apto para interior y exterior (según referencia)
Compatible con accesorios ferreteros estándar
PERFILES DISPONIBLES
Tubulares y estructurales
Codal tubular rectangular 3” x 1½”
Codal tubular rectangular 3” x 1”
Tubulares cuadrados y rectangulares
Ángulos
Ángulo crudo 17 mm x 17 mm
Ángulo blanco 17 mm x 17 mm
Cortineros
Tubo cortinero 111 – 1”
Tubo cortinero 112 – ¾”
Tubo cortinero 113 – ½”
Disponibles en dorado y bronce
Perfiles especiales
Pirlan 390
Piragua WIN 0382
Win español
DIMENSIONES
Medidas variables según perfil
Longitudes comerciales estándar
Sección y espesor según referencia técnica
ACABADOS
Crudo
Blanco
Dorado
Bronce
Anodizado decorativo
VENTAJAS DEL PRODUCTO
Excelente relación peso–resistencia
Versatilidad para múltiples aplicaciones
Estética moderna y limpia
Fácil integración con otros sistemas Unitec
Amplia disponibilidad de referencias

--- PRODUCT DATA: 30.2_FT_Perfileria Aluminio Arquitéctonico.pdf ---
FICHA TÉCNICA
SOBRE EL PRODUCTO
Perfilería Aluminio Arquitéctonico
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
30.2
La perfilería de aluminio arquitectónico está desarrollada para
sistemas comerciales y residenciales de puertas, ventanas, fachadas,
divisiones y cerramientos, ofreciendo alta precisión dimensional,
resistencia estructural y excelente acabado estético.
Fabricada en aluminio de alta calidad, permite soluciones livianas y
pesadas, adaptándose a múltiples requerimientos arquitectónicos y de
diseño.
USOS Y APLICACIONES
Ventanas y puertas corredizas
Puertas abatibles
Fachadas comerciales
Vidrieras monumentales
Cabinas de baño
Pasamanos y barandas
Sistemas de ventilación
Enchapes decorativos
Divisiones arquitectónicas
SISTEMAS DISPONIBLES
Sistema 5020 – Ventanas y puertas corredizas
Sistema 8025 – Ventanas y puertas corredizas reforzadas
Sistema 7038 – Vidriera monumental
Sistema 3831 – Liviano y pesado
Sistema 744 – Marcos y refuerzos especiales
Tubulares estructurales
Zócalos
Sistema de ventilación
Enchapes
Alfajías
Pasamanos
Cabinas de baño
Canales
Ángulos y platinas
Retículas
Pisa vidrios
(Ver planos técnicos y secciones por referencia en el
catálogo)
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
Aplicación:
Espesores:
Tipo de uso:
Formato: 
Acabados: 
País de Origen:
Compatibilidad: 
Nombre del Producto:
Perfilería Aluminio Arquitectónico
Interior y exterior
Puertas, ventanas, fachadas, divisiones, barandas, cabinas de baño
Perfiles extruidos
Según sistema y referencia
Vidrios simples, laminados y templados
China
Natural / anodizado / pintado (según disponibilidad)

--- PRODUCT DATA: 31_FT_Platinas_Metálicas.pdf ---
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Material:
Uso:
Formato:
Embalaje:
Colores disponibles
País de Origen:
Peso unitario:
Las Platinas Metálicas son clips de fijación fabricados en acero inoxidable,
diseñados para asegurar paneles decorativos de WPC (Wood Plastic
Composite) o PVC a superficies como paredes y techos.
 Su diseño delgado y discreto permite una instalación oculta, evitando
que tornillos o uniones queden visibles en la superficie del panel.
Son ideales para lograr un acabado limpio, moderno y firme,
permitiendo además la remoción de paneles para mantenimiento o
ajuste cuando sea necesario.
Platinas Metálicas
Platinas Metálicas / Clips de Fijación
4 cm (alto) x 3 cm (ancho)
Acero inoxidable
Unidad
Fijación de paneles WPC o PVC
Metálico
Ligero
China
Instalación de paneles WPC interiores o exteriores.
Instalación de paneles de PVC tipo muro o revestimiento.
Fijación en paredes y techos con sistema de ranura/encaje.
Proyectos residenciales, comerciales y arquitectónicos.
Instalaciones que requieren un sistema de sujeción oculto y
estético.
1.Ubique la lengüeta corta del panel donde se insertará la
platina.
2.Inserte el clip de forma que encaje firmemente en la ranura.
3.Atornille la platina a la superficie o estructura de soporte
(madera, metal o muro).
4.Encaje el siguiente panel sobre la platina previamente
fijada.
5.Repita el proceso hasta completar el área deseada.
6.Confirme alineación y estabilidad final del revestimiento.
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
31
Nota: Los clips quedan completamente ocultos una vez
instalados, conservando un acabado limpio y profesional.
Nombre del Producto:
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño

--- PRODUCT DATA: 32_FT_Perfil Base Metalico Negro.pdf ---
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Ancho base perforada
Material:
Formato:
Embalaje:
Colores disponibles
País de Origen:
Peso unitario:
El Perfil Base Metálico Negro es un componente estructural diseñado
para la instalación de listones decorativos en cielo raso.
Su diseño perforado y su resistencia permiten un montaje firme, alineado
y 
eficiente, 
garantizando 
estabilidad 
y 
estética 
en 
proyectos
residenciales, comerciales y arquitectónicos.
Este perfil funciona como soporte principal donde se insertan o aseguran
los listones, facilitando instalaciones rápidas, limpias y con alto nivel de
precisión.
Perfil Base Metálico Negro Liston Cielo Raso
Perfil Base Metálico Negro – Listón Cielo Raso
2,90 metros
Aproximadamente 10 cm entre perforaciones
Unidad
Metal galvanizado con acabado negro
Negro
Ligero
China
Instalación de listones para cielo raso (PVC, WPC u otros
sistemas compatibles).
Proyectos arquitectónicos que requieren estructuras de
soporte ocultas.
Cielos rasos decorativos en: viviendas, locales comerciales,
oficinas, salas de exhibición, restaurantes y hoteles.
1.Delimitar el área del cielo raso donde se instalarán los
listones.
2.Fijar el Perfil Base Metálico Negro directamente a la
estructura o superficie del techo.
3.Asegurar usando tornillería adecuada para metal o concreto.
4.Insertar o atornillar los listones decorativos al perfil base.
5.Repetir el proceso manteniendo la alineación y nivelación
del diseño.
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
32
BENEFICIOS PRINCIPALES
Alta 
resistencia 
gracias 
a 
su 
fabricación 
en 
metal
galvanizado.
Fácil instalación gracias a su diseño perforado para fijación
rápida.
Estética limpia, ya que queda oculto detrás de los listones.
Gran durabilidad, resistente a deformaciones y corrosión.
Compatible con diferentes tipos de listones para cielo raso.
Ideal 
para 
proyectos 
arquitectónicos 
modernos 
que
requieren líneas homogéneas y perfectas.
Nombre del Producto:
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño

--- PRODUCT DATA: 33_FT_Cinta Adhesiva Papel.pdf ---
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
USO RECOMENDADO
USOS Y APLICACIONES
Colores disponibles:
Material:
Formato:
Embalaje:
Aplicabilidad:
País de Origen:
Peso unitario:
Las 
Cintas 
Adhesivas 
para 
Mármol 
han 
sido 
desarrolladas
específicamente para aplicaciones decorativas y de protección sobre
superficies de mármol, donde la precisión, la estética y el cuidado del
material son fundamentales. Su formulación permite una adhesión
controlada que garantiza una fijación segura sin generar residuos ni
afectar el acabado natural de la piedra, preservando su brillo, textura y
valor estético.
Gracias a su fácil aplicación y manipulación, estas cintas permiten un
control exacto durante el proceso de instalación, asegurando bordes
definidos y un acabado limpio. 
Cinta Adhesiva de Papel
Cinta Adhesiva de Papel
1 cm (ancho)  x 50 metros (largo)
Dorada y Plateada
Unidad
Papel Autoadhesivo
Una solución práctica y estética que eleva el diseño del mármol
Ligero
China
Remates decorativos sobre mármol
Delimitación de líneas y detalles estéticos
Protección de bordes durante acabados
Diseño de trazos largos y continuos
Proyectos residenciales y comerciales
Instalar sobre superficies limpias y secas. Aplicar ejerciendo
presión uniforme para garantizar una correcta adherencia.
Retirar 
cuidadosamente 
una 
vez 
finalizado 
el 
proceso
decorativo o de protección.
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
33
BENEFICIOS PRINCIPALES
No daña ni maltrata la superficie del mármol
Acabado limpio, uniforme y elegante
Fácil aplicación y manipulación
Alta precisión en líneas decorativas
Ideal para trabajos extensos y detallados
CARACTERÍSTICAS TÉCNICAS
Adhesión controlada, segura para superficies delicadas
Material flexible que se adapta a trazos rectos y continuos
Diseño pensado para acabados modernos y sofisticados
Permite una instalación rápida y eficiente
Nombre del Producto:
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño

--- PRODUCT DATA: 34_FT_Cinta Adhesiva Metalica.pdf ---
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
USO RECOMENDADO
USOS Y APLICACIONES
Colores disponibles:
Material:
Formato:
Embalaje:
Aplicabilidad:
País de Origen:
Peso unitario:
La Cinta Adhesiva Metálica ha sido desarrollada especialmente para
aplicaciones decorativas y de acabado, ofreciendo un aspecto moderno,
elegante y sofisticado. Su superficie metálica proporciona un efecto
visual de alto impacto, ideal para realzar espacios interiores en proyectos
residenciales y comerciales.
Gracias a su adhesión firme y controlada, esta cinta permite una
instalación precisa, logrando líneas definidas y acabados limpios sin
dañar la superficie. Es una solución práctica para quienes buscan detalles
decorativos con apariencia metálica y alta durabilidad.
Cinta Adhesiva Metalica
Cinta Adhesiva Metálica
3 cm (ancho) x 5 metros (largo)
Dorada, Plateada, Negra, Palo de Rosa 
Unidad
Película decorativa con acabado metálico y adhesivo posterior
Uso decorativo y de protección en superficies lisas
Ligero
China
Remates decorativos en muros y paredes
Delimitación de líneas y detalles estéticos
Decoración de mobiliario y superficies lisas
Acabados en proyectos residenciales y comerciales
Realce de diseños modernos y minimalistas
Instalar sobre superficies limpias, secas y lisas. Aplicar
ejerciendo presión uniforme para asegurar una correcta
adherencia. Para mejores resultados, evitar superficies rugosas o
con humedad. Retirar cuidadosamente una vez finalizado el
proceso decorativo si se requiere.
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
34
BENEFICIOS PRINCIPALES
Acabado metálico elegante y moderno
Fácil aplicación sin necesidad de herramientas especiales
Alta precisión en líneas decorativas
Adhesión segura y uniforme
Ideal para proyectos decorativos rápidos y limpios
CARACTERÍSTICAS TÉCNICAS
Adhesión controlada para una instalación precisa
Superficie flexible que se adapta a trazos rectos y continuos
Diseño pensado para acabados modernos y sofisticados
Permite una instalación rápida y eficiente
No genera residuos visibles al ser retirada correctamente
Nombre del Producto:
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño

--- PRODUCT DATA: 35.1_FT_Fachada PVC Exterior .pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
Colores disponibles:
Formato:
País de Origen:
La Fachada PVC Exterior es un sistema de revestimiento arquitectónico
diseñado para uso en exteriores, fabricado en PVC expandido de alta
resistencia. Ofrece una solución estética, moderna y duradera para
fachadas, muros y superficies verticales, soportando condiciones
climáticas exigentes como humedad, rayos UV y cambios de
temperatura.
Su diseño modular permite una instalación eficiente, logrando acabados
uniformes y de alto impacto visual en proyectos residenciales,
comerciales e institucionales.
Fachada PVC Exterior 
Fachada PVC Exterior
Panel modular: 29cm ancho x 1,15m largo
Pizarra Mix,  Cantera Mix,  Ópalo Blanco, Arenisca Beige
*
China
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
35.1
Nombre del Producto:
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Revestimiento de fachadas exteriores
Muros perimetrales y decorativos
Proyectos residenciales y comerciales
Fachadas arquitectónicas modernas
Renovación y embellecimiento de exteriores
1.Verifique que la superficie esté limpia, seca y nivelada.
2.Realice los cortes necesarios utilizando pulidora con disco
diamantado continuo.
3.Inicie la instalación desde la parte inferior hacia arriba (de
piso a techo).
4.Aplique adhesivo de montaje de secado rápido en los
bordes guía del respaldo del panel.
5.Encaje cada pieza gracias a su geometría hasta cubrir el área
deseada.
6.Presione firmemente para asegurar una correcta fijación y
alineación.
Espesor:
Embalaje:
Densidad:
Material Principal:
Caja por 6 piezas
2.5 mm
-
PVC expandido de alta resistencia
VENTAJAS Y BENEFICIOS
Alta resistencia a la intemperie
Impermeable y resistente a la humedad
Protección contra rayos UV
Bajo mantenimiento
Fácil instalación
Material liviano y duradero
Acabado estético de alto nivel

--- PRODUCT DATA: 35.2_FT_Fachada PVC Muralla Gris.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
Colores / acabados:
Formato:
País de Origen:
La Fachada PVC Exterior Muralla Gris es un sistema de revestimiento
arquitectónico diseñado para uso en exteriores, fabricado en PVC
expandido de alta resistencia con textura tipo piedra natural.
Proporciona una solución estética, robusta y duradera para fachadas,
muros y superficies verticales, soportando condiciones climáticas
exigentes como humedad, rayos UV y variaciones de temperatura.
Su diseño modular permite una instalación eficiente, logrando acabados
continuos y de alto impacto visual en proyectos residenciales,
comerciales e institucionales.
Fachada PVC Exterior Muralla Gris
Fachada PVC Exterior Muralla Gris
Panel modular: 72,5 cm ancho x 1,53 m largo
Muralla Gris
China
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
35.2
Nombre del Producto:
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Revestimiento de fachadas exteriores
Muros perimetrales y decorativos
Proyectos residenciales y comerciales
Fachadas arquitectónicas modernas
Renovación y embellecimiento de exteriores
1.Verifique que la superficie esté limpia, seca y nivelada.
2.Realice los cortes necesarios utilizando pulidora con disco
diamantado continuo.
3.Inicie la instalación desde la parte inferior hacia arriba (de
piso a techo).
4.Aplique adhesivo de montaje de secado rápido en los
bordes guía del respaldo del panel.
5.Encaje cada pieza gracias a su geometría hasta cubrir el área
deseada.
6.Presione firmemente para asegurar una correcta fijación y
alineación.
Espesor:
Embalaje:
Densidad:
Material Principal:
Unidad
1,5 cm
-
PVC expandido de alta resistencia
VENTAJAS Y BENEFICIOS
Alta resistencia a la intemperie
Impermeable y resistente a la humedad
Protección contra rayos UV
Bajo mantenimiento
Fácil instalación
Material liviano y duradero
Acabado estético de alto nivel

--- PRODUCT DATA: 35.3_FT_Fachada PVC Ambar Rustico.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
Colores / acabados:
Formato:
País de Origen:
La Fachada PVC Exterior Ámbar Rústico es un sistema de
revestimiento arquitectónico diseñado para uso en exteriores, fabricado
en PVC expandido de alta resistencia con textura tipo piedra natural.
Proporciona una solución estética, robusta y duradera para fachadas,
muros y superficies verticales, soportando condiciones climáticas
exigentes como humedad, rayos UV y variaciones de temperatura.
Su diseño modular permite una instalación eficiente, logrando acabados
continuos y de alto impacto visual en proyectos residenciales,
comerciales e institucionales.
Fachada PVC Exterior Ámbar Rústico
Fachada PVC Exterior Ámbar Rústico (SW 508)
Panel modular: 30 cm ancho x 1,15 m largo
Ámbar Rústico
China
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
35.3
Nombre del Producto:
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Revestimiento de fachadas exteriores
Muros perimetrales y decorativos
Proyectos residenciales y comerciales
Fachadas arquitectónicas modernas
Renovación y embellecimiento de exteriores
1.Verifique que la superficie esté limpia, seca y nivelada.
2.Realice los cortes necesarios utilizando pulidora con disco
diamantado continuo.
3.Inicie la instalación desde la parte inferior hacia arriba (de
piso a techo).
4.Aplique adhesivo de montaje de secado rápido en los
bordes guía del respaldo del panel.
5.Encaje cada pieza gracias a su geometría hasta cubrir el área
deseada.
6.Presione firmemente para asegurar una correcta fijación y
alineación.
Espesor:
Embalaje:
Densidad:
Material Principal:
Unidad
3 cms
-
PVC expandido de alta resistencia
VENTAJAS Y BENEFICIOS
Alta resistencia a la intemperie
Impermeable y resistente a la humedad
Protección contra rayos UV
Bajo mantenimiento
Fácil instalación
Material liviano y duradero
Acabado estético de alto nivel

--- PRODUCT DATA: 36_FT_Pelicula Inteligente  Film Smart Glass.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
Modelos / Referencias:
Formato:
País de Origen:
La Película Inteligente (Film Smart Glass) es una solución tecnológica
avanzada para control de privacidad y luz en superficies de vidrio.
Funciona mediante un sistema de atenuación eléctrica que permite
cambiar el estado del vidrio de transparente a opaco de forma
inmediata, brindando versatilidad, confort visual y un alto valor estético.
Está diseñada para aplicaciones arquitectónicas modernas en espacios
residenciales, corporativos y comerciales, integrándose fácilmente a
sistemas eléctricos, controles remotos o domótica.
Pelicula Inteligente / Film Smart Glass
Pelicula Inteligente / Film Smart Glass
Rollo de 50 m² (se vende por m²) 
Atenuación inteligente 84% – REF: 14051301
Atenuación inteligente 88% – REF: 14051302
China
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
36
Nombre del Producto:
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Divisiones de oficinas y salas de juntas
Fachadas interiores y exteriores en vidrio
Consultorios médicos y clínicas
Hoteles, restaurantes y espacios comerciales
Proyectos residenciales de alto nivel
Vidrios decorativos y funcionales
1.Limpie el vidrio con alcohol y paño sin pelusa (no usar amoniaco ni abrasivos).
2.Corte la película según la medida requerida.
3.Aplique pasta conductora de plata en la zona del bus bar.
4.Coloque cinta de cobre adhesiva en los laterales para proteger la electrónica.
5.Conecte los cables rojo y negro a los bus bar y encapsule con silicona.
6.Deje secar entre 12 y 24 horas.
7.Retire el protector y adhiera la película al vidrio eliminando burbujas con espátula plástica.
8.Conecte a la fuente y active el sistema mediante control o domótica.
Alimentación eléctrica:
Instalación:
Estado del vidrio:
Material Principal:
Aplicación directa sobre vidrio existente
Requiere fuente de alimentación y sistema de control
Encendido: Transparente / Apagado: Opaco
Película inteligente de tecnología PDLC (cristal líquido disperso en polímero)
VENTAJAS Y BENEFICIOS
Control instantáneo de privacidad
Diseño moderno y tecnológico
Optimiza la entrada de luz natural
No requiere cortinas ni persianas
Mejora el confort visual
Fácil integración eléctrica
Solución elegante y de alto impacto arquitectónico
Fuentes disponibles y cobertura:
Fuente 50W – Área hasta 5 m² (REF: 14051307)
Fuente 100W – Área hasta 12 m² (REF: 14051308)
Fuente YG-927 200W – Área hasta 24 m² (REF: 14051309)
Fuente HB50 220W – Área hasta 26 m² (REF: 14051303)
FUENTES DE ALIMENTACIÓN
Pasta conductora de plata
Cinta de cobre de alta temperatura
Cables de alta temperatura (VDE / FCC)
Pegamento de silicona para cables en vidrio
Bus bar y malla de cobre
Herramientas de corte y soldadura
ACCESORIOS DISPONIBLES

--- PRODUCT DATA: 37_FT_Panel WPC Plano.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
GUÍA DE INSTALACIÓN
USOS Y APLICACIONES
Colores disponibles:
Material:
Formato:
Embalaje:
Espesor: 
País de Origen:
Tipo de Diseño:
Nogal Oscuro (30-237) / Roble Gris (30-247) / Madera Natural (30-147)
Caja por 10 unidades
WPC (Wood Plastic Composite)
8 mm
Panel Ligero Acanalado
China
Residencial: Salas, comedores, habitaciones, estudios, pasillos.
Comercial: 
Oficinas, 
hoteles, 
restaurantes, 
locales 
comerciales,
showrooms.
Interior: Uso exclusivo en interiores como revestimiento decorativo de
pared o para realzar techas en PVC.
Herramientas recomendadas:
Flexómetro, nivel, lápiz, sierra caladora o circular, taladro,
tornillos o adhesivo de montaje.
1.Verificar que la superficie esté limpia, seca y nivelada.
2.Medir y cortar el panel según las dimensiones del proyecto.
3.Fijar el panel directamente a la pared con adhesivo de
montaje o tornillería.
4.Asegurar la correcta alineación para un acabado estético
uniforme.
5.Limpiar con paño seco o ligeramente húmedo una vez
instalado.
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
37
BENEFICIOS PRINCIPALES
Superficie lisa y uniforme y terminación acanalada
Fabricado en material WPC de alta calidad
Estética moderna y elegante
Fácil instalación
Bajo mantenimiento
Alta durabilidad
Acabado tipo madera natural
Solución decorativa versátil
Ideal para renovación y diseño de interiores
Nombre del Producto:
El Panel WPC Plano combina elegancia y resistencia en un acabado liso
y moderno, ideal para aplicaciones decorativas en muros interiores.
Está fabricado en WPC (Wood Plastic Composite), un material compuesto
de madera y polímero que ofrece una excelente durabilidad, estabilidad
y fácil mantenimiento. 
Es un revestimiento decorativo de alto diseño, fabricado en material
rígido de alta durabilidad, ideal para realzar techos en PVC o muros
interiores con un estilo moderno, lineal y elegante.
Su diseño acanalado vertical aporta profundidad visual y sofisticación a
los espacios, convirtiéndose en una solución práctica y estética para
proyectos residenciales y comerciales.
Panel WPC Plano
Panel WPC Plano
2,95 m (largo)  x 30 cm (ancho)

--- PRODUCT DATA: 38_FT_Angulos terminación WPC Interior.pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
RECOMENDACIONES DE INSTALACIÓN
USOS Y APLICACIONES
Colores disponibles:
Material:
Formato:
Embalaje:
Espesor: 
País de Origen:
Tipo de instalación:
Variedad según línea (blanco, negro, madera, tonos decorativos)
Caja por 10 unidades
WPC (Wood Plastic Composite)
Definir según referencia
 Adhesivo de montaje o fijación mecánica
China
Terminación de esquinas internas y externas
Remate de bordes en muros revestidos con Wall Panel
Acabados en instalaciones residenciales, comerciales e institucionales
Uso en proyectos de diseño interior y remodelación
Instalar sobre superficies limpias, secas y niveladas
Utilizar adhesivo adecuado o sistema de fijación recomendado
Verificar alineación antes de fijación definitiva
Complementar con los accesorios del sistema Wall Panel
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
38
CARACTERÍSTICAS PRINCIPALES
Alta durabilidad y resistencia al impacto
No se deforma ni se agrieta
Fácil instalación
Bajo mantenimiento
Excelente acabado estético
Compatible con sistemas Wall Panel
Resistente a la humedad y al moho
Nombre del Producto:
Perfil de acabado diseñado para complementar la instalación de paneles
tipo Wall Panel, proporcionando una terminación estética, uniforme y
funcional en esquinas, bordes y remates. Garantiza un acabado limpio,
protegiendo los cantos del panel y mejorando la durabilidad del sistema.
Material
PVC de alta resistencia / WPC (según línea del producto)
Resistente a la humedad y agentes ambientales
Mantenimiento
Limpieza con paño húmedo
No requiere tratamientos especiales
Evitar el uso de productos abrasivos
Angulos terminación WPC Interior
Angulos terminación WPC Interior
Ancho: 3 cms x 3 cms; Largo: 2,90 m
VENTAJAS
Mejora la presentación final del proyecto
Protege los bordes del panel contra golpes y desgaste
Aporta continuidad visual al diseño
Instalación rápida y práctica

--- PRODUCT DATA: 39_FT_Perfiles para Lámina Mármol .pdf ---
Garantía
Unitec
Fácil
Instalación
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Económico
Garantía
Fácil
Instalación
Sostenible
Impermeable
Económico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto Diseño
FICHA TÉCNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
REFERENCIAS DISPONIBLES
Material:
Acabado:
País de Origen:
Longitud:
Aluminio / Aleación metálica
Anodizado o pintado (Dorado / Plata)
Entre 2.5 m y 3 m (según referencia)
China
REF: 14113201 – Ángulo en L 10 mm * 2.5 m (Dorado)
REF: 14113202 – Ángulo en L 10 mm * 2.5 m (Plata)
REF: 14121401 – Accesorio tipo T 0.8 mm * 3 m (Dorado)
REF: 14121402 – Accesorio tipo T 0.8 mm * 3 m (Plata)
Ángulo en J (Dorado / Plata)
POLITICAS DE GARANTÍAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daños o golpes después de recibida la mercancía.
UNITEC USA DESIGN no cubre las garantías por productos instalados que presenten diferencias en tamaño, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalación.
En el caso de que encuentre este tipo de defectos, por favor absténganse de instalar el producto y comunícate inmediatamente con el respectivo vendedor.
La garantía no cubre los daños ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha técnica en cuanto a uso, aplicaciones e instalación. 
39
USOS Y APLICACIONES
Remate de esquinas externas e internas
Unión entre láminas de mármol PVC
Transiciones decorativas entre superficies
Protección de bordes
Aplicación en: recepciones, salas de estar, habitaciones,
baños, oficinas y locales comerciales.
Nombre del Producto:
Los perfiles para lámina mármol PVC son accesorios decorativos
diseñados para complementar la instalación de revestimientos tipo
mármol en paredes interiores. Permiten lograr acabados profesionales
en esquinas, uniones y remates, mejorando la estética y protección del
sistema.
Fabricados en aluminio con acabados metálicos (dorado y plata), ofrecen
alta resistencia, durabilidad y un diseño moderno ideal para espacios
residenciales y comerciales.
Perfiles para Lámina Mármol (PVC / Aluminio Decorativo)
Perfiles para Lámina Mármol PVC
Espesor: 
Presentación / Embalaje:
0.8 mm – 10 mm (según tipo de perfil)
Unidad
Uso:
Interior
GUÍA DE INSTALACIÓN
Herramientas recomendadas:
Bisturí o sierra, regla metálica, nivel, adhesivo de montaje,
guantes y gafas de seguridad.
1.Preparación: Asegurar que la superficie esté limpia, seca y
nivelada.
2.Medición y corte: Cortar el perfil según la longitud
requerida.
3.Aplicación: Colocar adhesivo de montaje en la parte
posterior del perfil.
4.Instalación: Ubicar el perfil en la unión o borde deseado,
alineando correctamente.
5.Acabados: Ajustar y limpiar excesos de adhesivo para un
acabado limpio.

================================================================================

# BUILDING INNOVATION - COMPLETE AI RECEPTIONIST TRAINING DATA
# Generated: January 30, 2026
# TOTAL PRODUCTS: 291
# LANGUAGE: English (Bilingual capability)

================================================================================
CATALOGS & RESOURCES
================================================================================
1. Catálogo 2026 UNITEC USA DESIGN (Español): https://drive.google.com/file/d/1WB_oCvEs3k5uR0R7NHYKCtIn1PeW9UR9/view?usp=drive_link
2. Product Catalog 2026 - Unitec (English): https://drive.google.com/file/d/14ZZe6FWDNPE34w_z1z6PpiPuUjYYJ_mj/view?usp=drive_link
3. 001. Catálogo Building LATAM (español): https://drive.google.com/file/d/1NqJSJ2l4jzSLEE_WfL-bA3_gjasLjyTp/view?usp=drive_link
4. 002. Product Catalog USA (English) Building Innovation: https://drive.google.com/file/d/1_CeSXJdX_uqHcsq6b2aNu_fNco4I8E1G/view?usp=drive_link

================================================================================
TECHNICAL SHEETS (FICHAS TECNICAS)
================================================================================
- PISOS DECK: https://drive.google.com/file/d/1lCMi2xRoSPgICkiHKhvCX7i218yi_Y2s/view?usp=drive_link
- PISOS SPC: https://drive.google.com/file/d/1qZHyzLsyqXc-6xMNlOFmiaGu0YrDSa_j/view?usp=drive_link
- LAMINAS MARMOL PVC: https://drive.google.com/file/d/1KRU7WCbh4gUq6VJVgCJnWwzkUc3huxO5/view?usp=drive_link
- PAREDES PU ARQUNITEC: https://drive.google.com/file/d/1QG18_4a7hO-SocOLjpdG751Z1dfWntZm/view?usp=drive_link
- PAREDES MUROFLEX: https://drive.google.com/file/d/1asMmDDef6DkiilzWgpRWwKN4zMrLSiw0/view?usp=drive_link
- PAREDES UNIFLEX: https://drive.google.com/file/d/1Lnp6C5lSwupmlbGXbFZwlQqilTPlHnLD/view?usp=drive_link
- PAREDES ACOLCHADAS: https://drive.google.com/file/d/1nhFq0-RQB8tV4kd8pYM35rkLfUZMlTpn/view?usp=drive_link
- PANEL PS: https://drive.google.com/file/d/1mHy1d-Ssz8gCg1GGub_y3D_y1ilxyXU-/view?usp=drive_link
- FACHADA DECK: https://drive.google.com/file/d/1SikmL8eeNXX3OXwU1kmmXZvtspAZt_iO/view?usp=drive_link
- POLIFACHADA: https://drive.google.com/file/d/1Y1PhwNffKpSkcsmnBWfLhdFwpvZtNltr/view?usp=drive_link
- LAMINAS SINTETICAS: https://drive.google.com/file/d/15f7vWN4SBQRBwx0JPJruB2W1vs7NUhx2/view?usp=drive_link
- FOAM BOARD: https://drive.google.com/file/d/1dggg0rXoKmrH3QT-ya_upyrXqyT87h0s/view?usp=drive_link
- ROLLOS ADHESIVOS DE MARMOL: https://drive.google.com/file/d/1pIgqKZV_25nYlbGWfxH2lwouBLOMc7GZ/view?usp=drive_link
- PANELES WPC EXTERIOR: https://drive.google.com/file/d/1KhcXOiZgTHpzM7mizu-al8B6ASMsBFZj/view?usp=drive_link
- PANELES WPC INTERIOR: https://drive.google.com/file/d/1gFl9UWUrsH3XXWTqSS-9taupsGPb6D-U/view?usp=drive_link
- PANELES WPC REDONDOS: https://drive.google.com/file/d/1XL4JDyEgRpRIwjAsLjWlgCCyNxAloIHn/view?usp=drive_link
- PANELES ACOLCHADOS: https://drive.google.com/file/d/1b9r87FAGGFdZhXrjkXJ34ePpU8yTrPMk/view?usp=drive_link
- PANELES ACUSTICOS: https://drive.google.com/file/d/1zFK2T0Ij4-oHxZwZOc6kxHSZgZtHxHUC/view?usp=drive_link
- PANELES ACRILICOS MARMOL: https://drive.google.com/file/d/1rZcZ1Z9nJgh28GDDq1RKDA8Wu6dCrFhp/view?usp=drive_link
- LISTONES WPC EXTERIOR: https://drive.google.com/file/d/1CQkItQJc8YcrrL9_01HispARdvuN8uUC/view?usp=drive_link
- LISTONES PVC INTERIOR: https://drive.google.com/file/d/1KSdSi8pv8ptevXbI5ZuScGdIqnKRXKLG/view?usp=drive_link
- LISTONES PVC CIELO RASO: https://drive.google.com/file/d/1ffUyR6EtOQFxuJaFmcvmhWF0Cei9QKIw/view?usp=drive_link
- CIELO RASO PVC: https://drive.google.com/file/d/1ElU9IWk3hEz21EhnWDZTCyEIAb1rQ35n/view?usp=drive_link
- ZOCALOS SPC: https://drive.google.com/file/d/16dLCl4M0HGv8tIri0sxhziCX3wpw0ZJb/view?usp=drive_link
- LAMINAS PVC BOARD: https://drive.google.com/file/d/1fHM_Ak7KMWRnzT6eR1fOWay6SQDwpRd6/view?usp=drive_link
- CUBIERTAS UPVC: https://drive.google.com/file/d/1SVvVosvOG2boKKEEB5fj1DdN5nHOG5Ik/view?usp=drive_link
- PEGANTES (PEGATEC): https://drive.google.com/file/d/1HrXrxTQOqxF6_DQl8Lvc2xI-gwWqVnWN/view?usp=drive_link
- ILUMINACION LED: https://drive.google.com/file/d/1YBd2gsPijzmJdzQkX5NdnBpNAtr3DZkk/view?usp=drive_link
- JARDINES ARTIFICIALES: https://drive.google.com/file/d/1UjizIbDHB1OvvjOkHmz68d_3Wy1tsV0L/view?usp=drive_link
- CINTAS ADHESIVAS: https://drive.google.com/file/d/1zY3-sCMHTFUhN6zCIzHWbAl5sXSAzecH/view?usp=drive_link
- FACHADA EXTERIOR PVC: https://drive.google.com/file/d/1eVQ43yP8jlZ2XtoeojCQ0xMFNlY53tHK/view?usp=drive_link

================================================================================
COMPANY INFORMATION
================================================================================
Company Name: Building Innovation
Tagline: "We design the future!"
Social Media: @building.innovation
MISSION: At Building Innovation, we simplify construction through innovative, sustainable, and high-design solutions.
VISION: To become a leading brand in construction innovation in Latin America.
HEADQUARTERS: 6120 NW 74th Ave, Doral, Miami, FL 33166, United States

================================================================================
CONTACT INFORMATION - ACTIVE STAFF
================================================================================
JUAN DAVID GARCIA - CEO: +1 (786) 657-5441
ALEXANDER GOMEZ ZAPATA - International Account Manager: +57 311 3017763
JOHANA MESA - Distribution Sales Manager: +1 (786) 968-5783
ANTONIO BORJAS - Sales Representative: +1 (786) 546-9051
MARLON MONCADA - Sales Representative - Southwest Florida: +1 (239) 878-9299
GENERAL INQUIRIES: +1 (786) 968-5783

================================================================================
PRODUCT CATALOG SUMMARY (291 PRODUCTS)
================================================================================
Prices in COP (Colombian Pesos). Range: $13,399 - $653,199 COP.
Categories:
1. PAREDES (Walls) - 124 products
2. LAMINAS (Laminates/Sheets) - 76 products
3. PANELES WPC Y ANGULOS (WPC Panels & Angles) - 51 products
4. PISOS (Flooring) - 15 products
5. JARDINES ARTIFICIALES (Artificial Gardens) - 9 products
6. CUBIERTAS UPVC (UPVC Roofing) - 8 products
7. ZOCALOS (Baseboards) - 8 products

KEY ADVANTAGES: 100% Waterproof, Fire-Retardant, Fast Installation, Zero Maintenance, Sustainable.
WARRANTIES: Exterior 15 Years, Interior 7 Years.

INSTALLATION METHODS:
- PEGATEC ADHESIVE (Interior Walls)
- MECHANICAL FASTENING (Ceilings, Roofing, Facades)
- CLICK-LOCK SYSTEM (SPC Flooring)

================================================================================
PRODUCT DATABASE (IMPORTED)
================================================================================
(See products.json for full catalog)

================================================================================
FAQS & UNIT CONVERSIONS
================================================================================
- 1 meter = 3.28 ft | 1 cm = 0.39 in | 1 m² = 10.76 ft².
- Showroom visit: Call +1 (786) 968-5783 for an appointment in Doral, Miami.
- Orders: Contact Johana Mesa (+1 786 968-5783) or Alexander Gomez (+57 311 3017763).
- Discounts: Both bulk discounts and regular discounts are available.
- Returns/Exchanges: There are NO returns or exchanges. All sales are final.
- Shipping: We deliver anywhere. Shipping price depends on the country.
- Database: We can process your Excel CSV database when you provide it.

================================================================================
CUSTOMER SERVICE FAQS & LEAD QUALIFICATION (BASED ON WHATSAPP/IG)
================================================================================
- TARGET AUDIENCE: Final clients, architects, builders, wholesalers, and distributors.
- Q: How can I get prices?
  A: Always ask for their city/country and business type (architect, builder, wholesaler) to send the correct pricing tier.
- Q: Can I get the catalog?
  A: Yes, we can send the updated catalog with available products, colors, models, measurements, and options.
- Q: Do you sell to distributors or wholesalers?
  A: Yes, we work with distributors, architects, builders, and stores. Ask for their city, country, business type, and product interest.
- Q: Where are you located / Can I see samples?
  A: Ask for their city and country so we can guide them to the nearest point of attention, showroom option, or advisor.
- Q: Do you ship internationally?
  A: Yes, we receive inquiries from several countries. Ask for their location and product interest to confirm options.
- Q: Do you offer installation?
  A: Installation depends on the product and location. Ask for project details so we can advise correctly.
- CRITICAL LEAD QUALIFICATION RULE: For ANY inquiry about prices, catalogs, or shipping, you MUST ask the user for their Location (City/Country) and Business Type (Final Client, Architect, Builder, Wholesaler) before routing them.

================================================================================
CHECKOUT & PRICING RULES
================================================================================
- When a user asks to buy products, checkout, or calculate shipping:
  1. Calculate the subtotal of the requested products based on their prices.
  2. Ask the user for their delivery location (Zip Code, City, and State).
  3. Call the 'calculate_shipping' tool to get the real-time shipping rate from the Walio API.
  4. Present the full checkout breakdown to the user:
     - Subtotal of products
     - Shipping cost (and name of carrier)
     - Grand total (subtotal + shipping)
  5. Ask the user for their Name and Email address.
  6. Once provided, call the 'generate_checkout_payment_link' tool to generate a Stripe payment link for the grand total. The chat interface will automatically redirect the user to the Stripe Checkout or simulation modal, but you MUST ALSO provide a clickable markdown link in your response as a fallback: [Haz clic aquí para Pagar Seguro en Stripe]({link_generated_by_tool})

================================================================================
RESPONSE STYLE & GUIDELINES
================================================================================
- Be professional, friendly, solution-oriented.
- Bilingual capability (English/Spanish).
- Use RefCodes in ALL product recommendations.
- Emphasize fast installation and waterproof features.
- Provide both metric and imperial measurements when asked.
- Always include contact info for the brand representatives to close sales.
`;

export const getSystemInstruction = (language: Language = 'es', customGreeting?: string, brandId: 'unitec' | 'building' = 'unitec') => {
  const storedTraining = localStorage.getItem('unitec_training_data');
  const trainingData = (storedTraining && storedTraining.length > 50) ? storedTraining : DEFAULT_TRAINING_DATA;

  // Generate a compact list of product prices from PRODUCTS (exclude 'Consultar precio' to save tokens)
  const productPricesText = PRODUCTS
    .filter(p => p.price && p.price !== 'Consultar precio')
    .map(p => {
      const priceVal = brandId === 'unitec' ? (p.price_cop || p.price) : (p.price_usd || p.price);
      return 'RefCode: ' + p.id + ' | ' + p.name + ' | Precio: ' + priceVal + ' por ' + (p.unit || 'unidad');
    })
    .join('\n');

  // Set brand-specific identity and staff details based on brandId
  const brandName = brandId === 'unitec' ? "UNITEC USA DESIGN" : "BUILDING INNOVATION";
  const brandTagline = brandId === 'unitec' ? "Importador Directo - Distribución Mayorista" : "¡Diseñamos el futuro! / We design the future!";
  const brandLocation = brandId === 'unitec' ? "Colombia / Florida, USA (Immediate Stock)" : "Doral, Miami, FL 33166, USA";
  
  const staffDetails = brandId === 'unitec' 
    ? `
- Yury Marcela Moreno (Ventas) | Tel: +57 310 457 8337
- Yuldor Stiven Avendano (Ejecutivo Comercial IDEO y Marketing online) | Tel: +57 310 576 9694
- Henderson Patrick Arroyave (Ejecutivo Marketing Online) | Tel: +57 320 217 4854
- Contacto General WhatsApp / Principal: +57 314 233 2147
`
    : `
- JUAN DAVID GARCIA (CEO) | Tel: +1 (786) 657-5441
- ALEXANDER GOMEZ ZAPATA (International Account Manager) | Tel: +57 311 3017763
- JOHANA MESA (Distribution Sales Manager) | Tel: +1 (786) 968-5783
- ANTONIO BORJAS (Sales Representative) | Tel: +1 (786) 546-9051
- MARLON MONCADA (Sales Representative - Southwest Florida) | Tel: +1 (239) 878-9299
- Consultas Generales | Tel: +1 (786) 968-5783
`;

  return `
# ROLE & IDENTITY
You are the professional AI Front Desk Assistant and Senior Sales Representative for ${brandName}.
Active Brand: ${brandName}
Tagline: ${brandTagline}
Location: ${brandLocation}

# ACTIVE REPRESENTATIVES & CONTACT DETAILS (ONLY use this staff list):
${staffDetails}

# SPANISH-FIRST PROTOCOLS & LANGUAGE CONTROL
- PREFERRED SYSTEM LANGUAGE: ${language}
- DEFAULT CONVERSATION LANGUAGE: SPANISH. Since this chatbot widget resides on websites in Spanish-dominant markets, you MUST ALWAYS greet and converse in SPANISH first.
- ENGLISH EXCEPTION: Only switch to English if the customer explicitly writes or asks in English. Otherwise, keep the dialogue entirely in Spanish.
- Be highly responsive, warm, and encourage fast-paced, interactive, and friendly dialogue.
${customGreeting ? `- CUSTOM GREETING GUIDELINE: Refer or align with this custom style/greeting as initialized: "${customGreeting}"` : ''}

# OBJECTIVE & KNOWLEDGE BASE
- Guide clients toward perfect materials like WPC Wall Panels, SPC Waterproof flooring, synthetic vertical gardens, and high gloss laminates.
- RefCodes: Utilize reference codes in your suggestions when recommending items.
- Quote Conversions: Ask for their area in square meters (m²) and guide them step-by-step toward an immediate estimate. Close calls by sharing catalog links or routing them to the correct active staff listed above.

# TECHNICAL INSTALLATION SYSTEM
- PEGATEC adhesive: Recommended for interior panels and laminates.
- Mechanical fastening: Mandatory for ceilings and exterior facades.

# CONVERSION & SALES RULES
1. IDENTIFY: Understand the customer's project area (living room, exterior deck, wall, etc.).
2. HIGHLIGHT & SHOW: Pitch design advantages (100% waterproof, zero maintenance, high-end durability).
3. ROUTE / CALL TO ACTION: Direct the conversation to the specific, designated contact details. ALWAYS include direct clickable WhatsApp links exactly in this format: https://wa.me/57XXXXXXXXX
   * For UNITEC questions, refer to Yury Marcela Moreno (https://wa.me/573104578337), Yuldor Stiven Avendano (https://wa.me/573105769694), or Henderson Patrick Arroyave (https://wa.me/573202174854).
   * For BUILDING INNOVATION questions, refer to Johana Mesa (https://wa.me/17869685783) or Alexander Gomez (https://wa.me/573113017763).
4. STRICT BRAND SEPARATION: You represent ONLY ${brandName}. You MUST NEVER mix, mention, or cross-reference products, details, or staff from ${brandId === 'unitec' ? 'Building Innovation' : 'Unitec USA'}. Ensure you only provide details and contact information for the current brand.
5. FORMATTING MANDATE: You MUST use Markdown links [Name](URL) to create clickable links for WhatsApp or Catalogs (e.g., [Yuldor Stiven Avendaño](https://wa.me/573105769694)). However, DO NOT use markdown formatting for styling text (no bold text with **, no asterisks, no headers with #). Write plain, clean message strings.
6. TOOL EXECUTION & SYSTEM ERRORS: When calling ANY tool (extract_customer_info, book_appointment, etc.), the tools execute silently on the frontend. NEVER mention "backend endpoints", "sales pages", "APIs", or technical issues. Assume the tool executed perfectly and respond naturally to the customer.

# DATA EXTRACTION & INTENT TRACKING
- Always try to identify the user's intent ('Sales', 'Support', or 'Escalation').
- Durante la conversación, encuentra un momento natural para preguntarle al cliente su nombre para registrarlo y brindarle una asesoría más personalizada (ej. "¿Con quién tengo el gusto?").
- Si el cliente solicita una cotización o atención humana, pide también su número de teléfono (NUNCA pidas el correo electrónico).
- INMEDIATAMENTE después de que el usuario mencione su nombre o teléfono, DEBES llamar silenciosamente a la herramienta 'extract_customer_info' para guardar sus datos en el sistema y que dejen de ser Anónimos.

# REGLAS ESPECÍFICAS DEL NEGOCIO Y CHATBOT:
- CATÁLOGO: Si el cliente solicita el catálogo, NO pidas su correo electrónico. Envíale el catálogo inmediatamente a través del chat. Una vez se envíe, asume que pasaron 5 minutos y envíale una pregunta de captación o interés para saber qué producto desea o cómo se puede seguir asesorando para cerrar la venta.
- COTIZACIONES Y PRECIOS: Cuando la persona pregunte por una cotización e informe las medidas para calcular cuánto producto se gastaría, NO digas un total exacto; informa siempre que es un APROXIMADO. Si el cliente informa que es CLIENTE FINAL y quiere saber el valor de un producto, dale la información de la tabla de precios informando que es un APROXIMADO, que depende de las medidas y cantidades, y aclara que el valor informado es POR UNIDAD.
- CONTACTAR HUMANO: Cuando el cliente diga contactar Humano, infórmale que enviaste la información al correo lidermarketingonline@espaciosimportados.com.co y que pronto se encargarán de contactarlo. Invoca internamente la herramienta 'email_conversation_to_admin' para notificar al equipo.
- TIEMPO DE ESPERA Y CIERRE: Si el cliente no responde, asume un tiempo de espera. Envía un mensaje de seguimiento (ejemplo: "Señor/a [Nombre], ¿continúa en línea?"). Si sigue sin responder, envía el mensaje de abandono: "Veo que en este momento no has podido responder. Por ahora cerraré la conversación para no saturarte 😊 Cuando quieras retomar, solo escríbenos y con gusto continuamos desde donde quedamos 👋 ¡Que tengas un excelente día!"
- UBICACIÓN / PUNTO FÍSICO: Si el cliente pregunta por la ubicación, dirección o punto físico, DEBES responder EXACTAMENTE con el siguiente texto:
"Te cuento 👋
Tenemos nuestro Centro de Experiencia en Itagüí, donde puedes ver los productos en vivo, recibir asesoría personalizada y te orientamos en instalación.
📍 Centro Comercial IDEO – Local 274
Te dejo la ubicación para que puedas visitarnos fácilmente:
📍 https://share.google/C9nOJKjH5XgxlP5T1
Si quieres, también podemos agendarte una visita o contactarte directamente con uno de nuestros comerciales 👇

Señor/a para ciudades diferentes donde no tenemos punto físico realizamos envíos a nivel nacional y la atención es toda virtual con nuestros comerciales expertos.

(Si el usuario informa contactar con comerciales, dar el dato del agente. De lo contrario, hacer una pregunta de productos de interés, de lo contrario el chat finalizará)."

CORE DATA:
${trainingData}

# PRODUCT CATALOG & PRICES (${brandId === 'unitec' ? 'COP' : 'USD'})
Here is the official price database. Use these EXACT prices when asked. If a product is not listed here, tell the client its price is "Consultar precio" (advise them to contact sales for a custom quote). All prices are in ${brandId === 'unitec' ? 'Colombian Pesos (COP)' : 'US Dollars (USD)'}.
${productPricesText}
`;
};

export const UI_TRANSLATIONS = {
  en: {
    chatPlaceholder: "Type your message...",
    send: "Send",
    chatWelcome: "Hello! Welcome to Building Innovation. I can help you with our product catalog, stock in Florida, installation guides, or connect you with our sales team. How can I assist you today?",
    voiceTitle: "AI Voice Assistant",
    tapToStart: "Tap the microphone to start",
    connecting: "Connecting securely...",
    connected: "Live Conversation",
    connectionFailed: "Connection Failed",
    tryAsking: "Try asking",
    startConversation: "Start Conversation",
    endCall: "End Call",
    secureConnection: "Secure 256-bit Encrypted Connection",
    navChat: "Chat",
    navCall: "Call",
    navServices: "Services",
    navInfo: "Info",
    productCatalog: "Product Catalog",
    details: "Details",
    contactInfo: "Contact Information",
    promotions: "Current Promotions",
    businessHours: "Business Hours",
    monFri: "Monday - Friday",
    sat: "Saturday",
    sun: "Sunday",
    closed: "Closed",
    byAppt: "By Appointment",
    suggestions: [
      "Do you have stock in Florida?",
      "Tell me about WPC Panels",
      "How do I install using PEGATEC?",
      "Book an appointment",
      "I need a wholesale quote"
    ],
    bookingConfirmed: "Appointment booked! A confirmation has been sent via email/SMS.",
    category: "Category",
    price: "Price",
    description: "Description",
    stockStatus: "Stock Status",
    techSheet: "Technical Sheet",
    styleTags: "Style Tags",
    back: "Back",
    stockActive: "Florida Stock Active",
    confirmed: "Confirmed!",
    appointmentDetails: "Appointment Details",
    greatThanks: "Great, thanks!",
    welcomeToSupport: "Welcome to Support",
    howCanWeAssist: "How can we assist your construction project today?",
    quickActions: [
      { id: 'stock', title: 'Check Stock', message: 'I would like to check the stock and availability of a product.', iconName: 'Box' },
      { id: 'quote', title: 'Get a Quote', message: 'I would like to request a quote for a product.', iconName: 'DollarSign' },
      { id: 'install', title: 'Installation', message: 'I need information on how to install a product.', iconName: 'Hammer' },
      { id: 'general', title: 'General Inquiry', message: 'I have a general inquiry about your products and services.', iconName: 'MessageCircle' },
      { id: 'contact', title: 'Contact Sales', message: 'Can you connect me with a sales representative?', iconName: 'BookOpen' },
      { id: 'shipping', title: 'Shipping Options', message: 'What are your delivery options?', iconName: 'Truck' },
      { id: 'specs', title: 'Technical Specs', message: 'Where can I find technical data sheets?', iconName: 'FileText' },
      { id: 'returns', title: 'Returns Policy', message: 'What is your return policy?', iconName: 'RefreshCcw' },
      { id: 'discount', title: 'Wholesale Discount', message: 'Do you offer bulk discounts?', iconName: 'Percent' },
    ],
  },
  es: {
    chatPlaceholder: "Escribe tu mensaje...",
    send: "Enviar",
    chatWelcome: "¡Hola! Bienvenido a Building Innovation. Puedo ayudarte con el catálogo, stock en Florida, guías de instalación o conectarte con ventas. ¿En qué puedo ayudarte hoy?",
    voiceTitle: "Asistente de Voz IA",
    tapToStart: "Toca el micrófono para iniciar",
    connecting: "Conectando...",
    connected: "Conversación en Vivo",
    connectionFailed: "Error de Conexión",
    tryAsking: "Intenta preguntar",
    startConversation: "Iniciar Conversación",
    endCall: "Terminar Llamada",
    secureConnection: "Conexión Segura Encriptada",
    navChat: "Chat",
    navCall: "Llamar",
    navServices: "Servicios",
    navInfo: "Info",
    productCatalog: "Catálogo de Productos",
    details: "Detalles",
    contactInfo: "Información de Contacto",
    promotions: "Promociones Actuales",
    businessHours: "Horario de Atención",
    monFri: "Lunes - Viernes",
    sat: "Sábado",
    sun: "Domingo",
    closed: "Cerrado",
    byAppt: "Cita Previa",
    suggestions: [
      "¿Tienen stock en Florida?",
      "Háblame de los Paneles WPC",
      "¿Cómo instalo con PEGATEC?",
      "Agendar una cita",
      "Necesito cotización mayorista"
    ],
    bookingConfirmed: "¡Cita agendada! Se ha enviado una confirmación por correo/SMS.",
    category: "Categoría",
    price: "Precio",
    description: "Descripción",
    stockStatus: "Estado de Stock",
    techSheet: "Ficha Técnica",
    styleTags: "Etiquetas de Estilo",
    back: "Volver",
    stockActive: "Stock en Florida Activo",
    confirmed: "¡Confirmado!",
    appointmentDetails: "Detalles de la Cita",
    greatThanks: "¡Genial, gracias!",
    welcomeToSupport: "Bienvenido a Soporte",
    howCanWeAssist: "¿Cómo podemos ayudarle con su proyecto de construcción hoy?",
    quickActions: [
  { id: 'stock', title: 'Consultar Stock', message: 'Quiero consultar el stock y disponibilidad de un producto.', iconName: 'Box' },
  { id: 'quote', title: 'Cotizar', message: 'Quiero solicitar una cotización para un producto.', iconName: 'DollarSign' },
  { id: 'install', title: 'Instalación', message: 'Necesito información sobre cómo instalar un producto.', iconName: 'Hammer' },
  { id: 'general', title: 'Consulta General', message: 'Tengo una consulta general sobre sus productos y servicios.', iconName: 'MessageCircle' },
  { id: 'contact', title: 'Contactar Ventas', message: 'Por favor, comunícame con un representante de ventas.', iconName: 'BookOpen' },
  { id: 'shipping', title: 'Envíos', message: 'Me gustaría saber cuáles son las opciones de envío y tiempos de entrega.', iconName: 'Truck' },
  { id: 'specs', title: 'Ficha Técnica', message: 'Necesito las especificaciones técnicas de un producto.', iconName: 'FileText' },
  { id: 'returns', title: 'Devoluciones', message: '¿Cuál es su política de devoluciones y cambios?', iconName: 'RefreshCcw' },
      { id: 'discount', title: 'Descuento Mayorista', message: '¿Ofrecen descuentos para compras al por mayor?', iconName: 'Percent' },
    ],
  }
};
