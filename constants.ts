
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
  customGreeting: "¡Hola! Bienvenido a UNITEC USA DESIGN",
  heroImage: "https://images.unsplash.com/photo-1541888081-309505f03d52?auto=format&fit=crop&q=80&w=1920",
  heroTitle: "UNITEC USA DESIGN",
  heroSubtitle: "Importador Directo - Distribución Mayorista de Materiales de Construcción",
  socialLinks: {
    facebook: "https://facebook.com",
    instagram: "https://instagram.com/unitecusadesign",
    linkedin: "https://linkedin.com"
  },
  navLinks: [
    { label: "Inicio", href: "/" },
    { label: "Catálogo", href: "#products" },
    { label: "Contacto", href: "#contact" }
  ]
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
  customGreeting: "¡Hola! Bienvenido a Building Innovation. Soy tu asesor virtual. ¿En qué te puedo ayudar hoy? / Hello! How can I help you today?",
  heroImage: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1920",
  heroTitle: "BUILDING INNOVATION",
  heroSubtitle: "¡Diseñamos el futuro! / We design the future! Premium Construction Materials",
  socialLinks: {
    facebook: "https://facebook.com",
    instagram: "https://instagram.com/building.innovation",
    linkedin: "https://linkedin.com"
  },
  navLinks: [
    { label: "Home", href: "/" },
    { label: "Products", href: "#products" },
    { label: "Contact Us", href: "#contact" }
  ]
};

// Default export for initial load
export const BUSINESS_CONFIG = BUILDING_INNOVATION_CONFIG;

export const QUICK_ACTIONS: QuickAction[] = [
  { id: 'stock', title: 'Consultar Stock', message: 'Quiero consultar el stock y disponibilidad de un producto.', iconName: 'Box' },
  { id: 'quote', title: 'Cotizar', message: 'Quiero solicitar una cotizaciÃ³n para un producto.', iconName: 'DollarSign' },
  { id: 'install', title: 'InstalaciÃ³n', message: 'Necesito informaciÃ³n sobre cÃ³mo instalar un producto.', iconName: 'Hammer' },
  { id: 'general', title: 'Consulta General', message: 'Tengo una consulta general sobre sus productos y servicios.', iconName: 'MessageCircle' },
  { id: 'contact', title: 'Contactar Ventas', message: 'Por favor, comunÃ­came con un representante de ventas.', iconName: 'BookOpen' },
  { id: 'shipping', title: 'EnvÃ­os', message: 'Me gustarÃ­a saber cuÃ¡les son las opciones de envÃ­o y tiempos de entrega.', iconName: 'Truck' },
  { id: 'specs', title: 'Ficha TÃ©cnica', message: 'Necesito las especificaciones tÃ©cnicas de un producto.', iconName: 'FileText' },
  { id: 'returns', title: 'Devoluciones', message: 'Â¿CuÃ¡l es su polÃ­tica de devoluciones y cambios?', iconName: 'RefreshCcw' },
  { id: 'discount', title: 'Descuento Mayorista', message: 'Â¿Ofrecen descuentos para compras al por mayor?', iconName: 'Percent' },
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
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
Piso Deck Exterior
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
01
El Piso en DECK Exterior es fabricado con madera plÃ¡stica compuesta, su
excelente apariencia y caracterÃ­sticas le otorgan alta resistencia ante
cualquier condiciÃ³n climÃ¡tica, un producto de bajo mantenimiento, con
tecnologÃ­a perdura, especial para jardines, piscinas, terrazas y zonas
sociales. Disponible en los siguientes colores:
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
Residencial: Piscinas, Patios exteriores, fincas.
Comercial: Hoteles, CabaÃ±as, Salones a cielo abierto,
Glampings, Restaurantes exteriores.
Exterior: Principalmente orientado en su exterior, alta
resistencia a trÃ¡ficos medianos.
1.PreparaciÃ³n de la superficie: Para la estructura portante
utilice perfil base WPC nivelados, y distanciados entre 30 y 45
cms mÃ¡ximo, nivÃ©lelos mediante calzas segÃºn sea necesario,
teniendo en cuenta una pendiente mÃ­nima del 2%.
2.Cortes: Realizar los cortes de longitud necesarios segÃºn
medidas en obra y fije las tablas lo antes posible.
3.SujeciÃ³n: El piso DECK debe tener una altura mÃ­nima de 2''
permitiendo un paso de aire continuo entre el piso y las
tablas, para los empalmes se tendrÃ¡ que tener en cuenta un
doble perfil base con doble clip por cada encuentro de tabla
a lo ancho (14.08cm).
4.Acabados: Sigue las recomendaciones del fabricante con los
accesorios sugeridos en caso de ser necesarios.
5.Mantenimiento: Agua y jabÃ³n neutro para retirar el polvo
acumulado en el tiempo, cuando se considere necesario.
Herramienta: FlexÃ³metro, sierra caladora, cinta mÃ©trica,
taladro, regla, lÃ¡piz, chazos y tornillos.
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
PaÃ­s de Origen:
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
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o

--- PRODUCT DATA: 02_FT_Piso_SPC.pdf ---
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
Piso SPC
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
02
Sistema de suelo SPC de nÃºcleo rÃ­gido formado por una mezcla de polvo
de piedra (carbonato de calcio) y PVC virgen, con acabado decorativo
que imita madera o tonos naturales (avellana, gris cenizo, roble claro,
etc.). Incluye capa de desgaste UV resistente a rasguÃ±os, manchas y
humedad, proporcionando estabilidad dimensional y apariencia estÃ©tica
de alta definiciÃ³n. Ideal tanto para residencias como locales comerciales.
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
Espacios residenciales: salas, dormitorios, cocinas, baÃ±os y
lavanderÃ­as (100% resistente al agua)
Entornos comerciales: Oficinas, boutiques, cafÃ©s, hoteles,
salas de espera
Ãmbitos institucionales: GuarderÃ­as, colegios, clÃ­nicas
1.PreparaciÃ³n de la superficie: Debe estar limpia, seca, plana y
estructuralmente sÃ³lida.
2.Cortes: Dejar expansiones de aproximadamente 6mm en
bordes. Cortar lamas con sierra o cÃºter.
3.FijaciÃ³n: InstalaciÃ³n como sistema flotante: encaje lateral y
final de lamas con sistema clic, sin adherirse al subsuelo.
Mantener espaciador las paredes.
4.Acabados: Instalar los zÃ³calos o molduras sin fijarlos al suelo,
cubriendo juntas de expansiÃ³n. Undercut en marcos de puertas
para que la lama encaje por debajo.
5.Mantenimiento: Limpiar con escoba o aspiradora. Para
manchas, usar detergente suave y paÃ±o hÃºmedo. Evitar el uso
de ceras, abrasivos, solventes o esponjas rugosas.
Herramienta: Regla mÃ©trica, cÃºter o sierra, bloque de golpeo o
maza de goma, barra de tracciÃ³n, espaciadores 6mm (1/4''), nivel
de burbuja, aspiradora o cepillo, guantes.
Peso:
Espesor Tipo L / Espesor Tipo XL / Espesor Tipo XXL
Formato Tipo L / Formato Tipo XL / Formato Tipo XXL
Embalaje:
Densidad:
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
Piso SPC
122cm x 18,3cm / 122cm x 22,8cm / 152cm x 23cm
0,8 Kilogramos
Unidad
0,4 cm / 0,45 cm / 0,55 cm
Aproximadamente 8kg/mÂ²
PVC (Policloruro de Vinilo)
China
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o

--- PRODUCT DATA: 03_FT_Lamina Marmol PVC.pdf ---
FICHA TÃ‰CNICA
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
03
Lamina MÃ¡rmol PVC
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
Recepciones
Habitaciones
Centros de entrenamiento
Salas de estar
BaÃ±os
1.PreparaciÃ³n de la superficie: esta debe estar nivelada, libre de
material biÃ³tico, humedades y polvo.
2.Cortes: De acuerdo al Ã¡rea corte la primera pieza si es necesario
y nivela de manera correcta paralelo al piso para que iniciar
manera ascendente la instalaciÃ³n.
3.SujeciÃ³n: Agregamos adhesivo de montaje en la cara posterior
producto en O-H y puntos de seguridad en los vacÃ­os.
4.Acabados: Repetimos el proceso dejando una dilataciÃ³n entre
cada pieza mÃ­nima de 2mm y mÃ¡xima de 5mm para cubrir la
superficie deseada.
5.Mantenimiento: La dilataciÃ³n o la junta le damos el acabado
con boquilla acrÃ­lica de acuerdo al color de la referencia
elegida, limpiamos y retiramos excesos de polvo y listo.
Herramienta: BisturÃ­, regla metÃ¡lica de 120cms, guantes y gafas
de seguridad, adhesivo de montaje. 
LÃ¡mina mÃ¡rmol es un decorativo en PVC, la marca UNITEC U.S.A. trae la
soluciÃ³n ideal para el revestimiento de paredes interiores, ya que ofrece
un valor estÃ©tico Ãºnico para hogares, oficinas y comercios. Sus
propiedades tÃ©cnicas brindan un acabado de la mÃ¡s alta calidad.
AdemÃ¡s, es de fÃ¡cil lavado y resistente contra la humedad.
SOBRE EL PRODUCTO
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
PaÃ­s de Origen:
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
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o

--- PRODUCT DATA: 04_FT_Pared PU ArqUnitec.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
Pared PU ArqUnitec
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
04
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
Recepciones
Habitaciones
Centros de entrenamiento
Salas de estar
1.PreparaciÃ³n de la superficie: Esta debe estar nivelada, libre de
material bituminoso, humedades y polvo.
2.Cortes: Utiliza una sierra para cortar los paneles de PU Stone
segÃºn las medidas y formas necesarias. AsegÃºrate de seguir las
instrucciones del fabricante para un corte preciso.
3.SujeciÃ³n: Aplica un adhesivo recomendado por el fabricante en
la parte posterior de cada panel. AsegÃºrate de distribuir
uniformemente el adhesivo.
4.Acabados: Realiza cortes adicionales en los paneles segÃºn sea
necesario para ajustarse a las esquinas y bordes. Utiliza
molduras o accesorios especÃ­ficos para dar un acabado
profesional.
5.Mantenimiento: 
En 
caso 
de 
ser 
necesario 
retirar 
la
acumulaciÃ³n de polvo con una manguera de jardÃ­n o agua a
presiÃ³n no superior a los 100 PSI, adopta las medidas de
seguridad necesarias para evitar daÃ±os.
Herramienta: Sierra de corte, guantes y gafas de seguridad,
adhesivo de montaje.
PARED PU ARQUNITEC, mÃ¡s conocida como piedra sintÃ©tica de
poliuretano o PU STONE, es un material para acabados constructivos de
uso interior y exterior. Es liviano, flexible y maleable, capaz de adaptarse
a cualquier superficie y ambiente, su apariencia logra imitar la piedra
natural en gran formato, permite conseguir espacios modernos, de lujo y
con alto diseÃ±o. Disponible en los siguientes colores:
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
PaÃ­s de Origen:
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
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
05
Pared Muroflex
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
1.PreparaciÃ³n de la superficie: Verifica que el muro estÃ© limpio,
seco y nivelado. Si hay imperfecciones, corrige con masilla y lija.
2.Cortes: Marca una lÃ­nea base en la parte inferior para alinear la
primera lama. Corta las piezas con una sierra manual,
ingleteadora o caladora si necesitas empalmes.
3.SujeciÃ³n: Aplica adhesivo de montaje tipo poliuretano o
silicona neutra en zigzag por detrÃ¡s de la lama.
4.Acabados: Revisa uniones, esquinas y nivelaciÃ³n. Usa perfiles
de remate si deseas un acabado mÃ¡s limpio en bordes y
esquinas.
5.Mantenimiento: Revisa uniones, esquinas y nivelaciÃ³n. Usa
perfiles de remate si deseas un acabado mÃ¡s limpio en bordes y
esquinas.
Herramienta: Metro, nivel, cÃºter o sierra, adhesivo de montaje o
tornillos, escuadra.
Panel decorativo fabricado con un compuesto de madera plÃ¡stica (WPC),
que combina fibras de madera natural y polÃ­meros plÃ¡sticos reciclados.
Su diseÃ±o rotativo y modular permite crear texturas y efectos
tridimensionales, ideales para espacios modernos y sofisticados. Es
resistente al agua, al moho y a los cambios climÃ¡ticos, siendo ideal para
interiores y exteriores bajo techo.
Revestimiento:
 Muros en salas, habitaciones, oficinas, locales comerciales.
DecoraciÃ³n:
 Paredes tipo cabecero, fondos de TV, pasillos o columnas.
Espacios de alto diseÃ±o con necesidad de estÃ©tica cÃ¡lida y
textura visual.
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
Pared Muroflex
290 cm x 5 cm
1,33 Kgs por unidad / 32 Kgs por Caja
Caja por 24 unidades
1.8 cm
Aproximadamente â€“ kg/mÂ²
WPC
China
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o

--- PRODUCT DATA: 06_FT_Pared Uniflex.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
06
Pared Uniflex
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
Paredes interiores
Fachadas exteriores
Remodelaciones comerciales
ConstrucciÃ³n industrial
Proyectos institucionales
1.PreparaciÃ³n de la superficie: esta debe estar nivelada, libre de
material biÃ³tico, humedades y polvo.
2.Cortes: De acuerdo al Ã¡rea corte la primera pieza si es necesario
y nivela de manera correcta paralelo al piso para que iniciar
manera ascendente la instalaciÃ³n.
3.SujeciÃ³n: Agregamos adhesivo de montaje en la cara posterior
producto en â€œOHâ€ y puntos de seguridad en los vacÃ­os.
4.Acabados: Repetimos el proceso dejando una dilataciÃ³n entre
cada pieza mÃ­nima de 2mm y mÃ¡xima de 5mm para cubrir la
superficie deseada.
5.Mantenimiento: La dilataciÃ³n o la junta le damos el acabado
con boquilla acrÃ­lica de acuerdo al color de la referencia
elegida, limpiamos y retiramos excesos de polvo y listo.
Herramienta: BisturÃ­, regla metÃ¡lica de 120 cm, guantes y gafas
de seguridad, adhesivo de montaje.
Las paredes Uniflex son acabados decorativos flexibles hechos de tierra
modificada (MMC), caracterizadas por su materia prima principal (arena
de cuarzo, tela de rejilla alcalina, emulsiÃ³n ecolÃ³gica), moldeadas y
horneadas e irradiadas utilizando un sistema de peinado con control de
temperatura especialmente diseÃ±ado.
 Dado que tienen la apariencia de una baldosa al principio de su
nacimiento, se las conoce comÃºnmente como baldosas blandas.
AdemÃ¡s, debido a su propio peso ligero, relativamente delgado, tambiÃ©n
es relativamente conveniente para transportar.
Disponible en los siguientes colores:
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
PaÃ­s de Origen:
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
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
07.1
Pared acolchada Palma/Trigo
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
AbsorciÃ³n acÃºstica:
 Estudios de grabaciÃ³n, salas de reuniones, auditorios,
oficinas, salas de ensayo, etc.
ProtecciÃ³n anti-colisiÃ³n:
 Habitaciones infantiles, espacios terapÃ©uticos o mobiliario
acolchado decorativo.
DiseÃ±o interior:
 Espaldar de cama, decoraciÃ³n de oficina.
1.PreparaciÃ³n de la superficie: La pared debe estar limpia, lisa,
seca y libre de polvo, grasa u hongos.
2.Cortes: Determine la distribuciÃ³n de los paneles sobre la
superficie. Marque las lÃ­neas guÃ­as con lÃ¡piz y nivel.
3.FijaciÃ³n: Aplique adhesivo tipo montaje (no corrosivo) en
forma de â€œSâ€ o puntos sobre la parte posterior del panel.
Presione firmemente contra la pared por al menos 30 segundos.
4.Acabados: Revise que no haya espacios entre paneles. Para
uniones visibles o esquinas, puede usar perfiles de terminaciÃ³n
o tapajuntas.
5.Mantenimiento: Limpie ocasionalmente con un paÃ±o seco o
levemente hÃºmedo. Para suciedad adherida, use jabÃ³n neutro y
agua.
Herramienta: Cinta mÃ©trica, cÃºter o bisturÃ­, nivel de burbuja,
adhesivo de montaje, guantes y paÃ±o seco.
Panel tapizado con forma decorativa (arcos redondeados, espiga)
fabricado con nÃºcleo acÃºstico de espuma de poliuretano de celda
abierta y cubierta de tela suave (terciopelo o microfibra). Su diseÃ±o
lÃºdico y cuidado lo hace ideal para entornos infantiles, salas lounge o
proyectos de interiorismo contemporÃ¡neo que requieren estÃ©tica y
absorciÃ³n acÃºstica.
Peso:
Espesor PALMA     /      Espesor TRIGO
PALMA          /          TRIGO
Embalaje:
Densidad:
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
Pared Acolchada
295 cm x 60 cm  /  395 cm x 60 cm
5 mm  /   5,5 mm
Aproximadamente 15kg/mÂ²
Cuero sintÃ©tico de alta calidad y espuma de poliuretano
China
2 Kilos  /  2 Kilos
6 rollos  /  6 rollos

--- PRODUCT DATA: 07.2_FT_Pared  Acolchada Aurora.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
07.2
Pared acolchada Aurora
La Pared Acolchada Aurora es un revestimiento decorativo para
interiores que combina diseÃ±o contemporÃ¡neo, confort y funcionalidad.
Fabricada con nÃºcleo de espuma de poliuretano y recubierta en cuero
sintÃ©tico de alta calidad, aporta un acabado elegante, suave al tacto y de
alto impacto visual.
Su estructura acolchada contribuye a la absorciÃ³n acÃºstica, mejorando el
confort sonoro del espacio, mientras que su diseÃ±o volumÃ©trico aÃ±ade
profundidad y sofisticaciÃ³n. Es una soluciÃ³n ideal para destacar muros y
elevar el diseÃ±o en proyectos residenciales y comerciales.
Disponible en los siguientes colores:
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
Pared Acolchada Aurora
295 cm x 50 cm
4 Kg
Caja por 10 Unidades
22 mm
Aproximadamente 15 kg/mÂ²
Cuero sintÃ©tico de alta calidad y espuma de poliuretano
China
Siena
Caoba
Vainilla
Diamante
Negro
Brillo Plata
Rocio
Floral
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
AbsorciÃ³n acÃºstica:
 Estudios de grabaciÃ³n, salas de reuniones, auditorios, oficinas,
salas de ensayo, etc.
ProtecciÃ³n anti-colisiÃ³n:
 Habitaciones infantiles, espacios terapÃ©uticos o mobiliario
acolchado decorativo.
DiseÃ±o interior:
 Espaldar de cama, decoraciÃ³n de oficina.
1.PreparaciÃ³n de la superficie: La pared debe estar limpia, lisa, seca y
libre de polvo, grasa u hongos.
2.Cortes: Determine la distribuciÃ³n de los paneles sobre la superficie.
Marque las lÃ­neas guÃ­as con lÃ¡piz y nivel.
3.FijaciÃ³n: Aplique adhesivo tipo montaje (no corrosivo) en forma de â€œSâ€
o puntos sobre la parte posterior del panel. Presione firmemente
contra la pared por al menos 30 segundos.
4.Acabados: Revise que no haya espacios entre paneles. Para uniones
visibles o esquinas, puede usar perfiles de terminaciÃ³n o tapajuntas.
5.Mantenimiento: Limpie ocasionalmente con un paÃ±o seco o
levemente hÃºmedo. Para suciedad adherida, use jabÃ³n neutro y agua.
Herramienta: Cinta mÃ©trica, cÃºter o bisturÃ­, nivel de burbuja, adhesivo
de montaje, guantes y paÃ±o seco.

--- PRODUCT DATA: 08_FT_Panel_PS_Interior.pdf ---
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
08
Panel PS Interior
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
Residencial: Salas de estar, dormitorios.
Comercial: 
Oficinas, 
restaurantes, 
hoteles, 
espacios
comerciales.
DecoraciÃ³n de Eventos: Bodas, fiestas, exhibiciones.
DiseÃ±os ArquitectÃ³nico
1.PreparaciÃ³n de la superficie: debe de estar limpia y seca, libre
de polvo, material biÃ³tico y humedad.
2.Cortes: De acuerdo al Ã¡rea, optimice los cortes del producto
teniendo en cuenta su medida estÃ¡ndar.
3.SujeciÃ³n: Aplique adhesivo de montaje al respaldo del
producto en lÃ­neas horizontales cada 30 cms y conecta cada
pieza con su sistema machimbrado hasta cubrir la superficie
deseada.
4.Acabados: Sigue las recomendaciones del fabricante con los
accesorios sugeridos en caso de ser necesarios.
5.Mantenimiento: Agua y jabÃ³n neutro para retirar el polvo
acumulado en el tiempo, cuando se considere necesario.
Herramienta: FlexÃ³metro, cortadora, regla aluminio y guantes.
El panel PS es un nuevo material de protecciÃ³n ambiental. Ideal para
pared hecho en PVC con insumos complementarios que lo hacen liviano
para facilitar el transporte y la manipulaciÃ³n. Vale la pena mencionar que
el panel de pared es fÃ¡cil de instalar, adecuado para diseÃ±o de interiores.
Solo una persona puede completar la renovaciÃ³n de la habitaciÃ³n
interior. Color y forma diversos, cumple con los diferentes estilos de
diseÃ±o.  Disponibles en linea luxury, biselado y estuario.
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
PaÃ­s de Origen:
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
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
PaÃ­s de Origen:
Material Principal:
La Fachada DECK es un sistema de recubrimiento exterior diseÃ±ado para
revestir fachadas en proyectos residenciales, comerciales, institucionales
y campestres. Su diseÃ±o tipo listÃ³n imita la apariencia de la madera
natural, aportando un acabado moderno, elegante y arquitectÃ³nico.
Fabricada en PVC de alta resistencia, la Fachada DECK ofrece excelente
desempeÃ±o frente a la humedad, la radiaciÃ³n solar y los cambios
climÃ¡ticos, proporcionando durabilidad, estabilidad dimensional y bajo
mantenimiento. AdemÃ¡s de su valor estÃ©tico, contribuye al aislamiento
tÃ©rmico y a la protecciÃ³n de la estructura frente a las inclemencias del
tiempo. Disponible en los siguientes colores:
Fachada DECK
Fachada DECK
290 cm (largo) x 15 cm (ancho)
4.9 kilogramos por unidad
Unidad
1.5 cm
Aproximadamente 7 kg/mÂ²
PVC (Policloruro de Vinilo)
China
Residencial: Fachadas, divisiÃ³n de jardines, cerramientos y
espacios privados.
Comercial: Proyectos comerciales y diseÃ±os arquitectÃ³nicos
Espacios pÃºblicos: Parques, Ã¡reas de juego y proyectos
urbanos.
Herramienta: FlexÃ³metro, cortadora, regla de aluminio y
guantes 
1.PreparaciÃ³n de la superficie: debe estar limpia, seca y libre
de polvo, material bituminoso y humedad.
2.Cortes: Realizar los cortes de acuerdo al Ã¡rea a cubrir,
optimizando el producto segÃºn su medida estÃ¡ndar.
3.SujeciÃ³n: La instalaciÃ³n puede realizarse sobre estructura
metÃ¡lica, madera o directamente sobre pared.  El anclaje se
hace 
mediante 
tornillo 
en 
el 
riel 
de 
cada 
pieza,
aproximadamente cada 60 cm. Su geometrÃ­a permite
ensamblar una pieza con otra para lograr un acabado
continuo y uniforme.
4.Acabados: Seguir las recomendaciones del fabricante y
utilizar los accesorios sugeridos cuando sea necesario.
5.Mantenimiento: Limpieza con agua y jabÃ³n neutro para
retirar el polvo acumulado con el paso del tiempo.
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
09
Nombre del Producto:
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o

--- PRODUCT DATA: 10_FT_Polifachada.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
PaÃ­s de Origen:
Material Principal:
Polifachada
Polifachada
3,8 m x 38 cm
4,25 Kilogramos
Unidad
2,5 cm
Aproximadamente 15 kg/mÂ²
PVC (Policloruro de Vinilo)
China
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
10
Nombre del Producto:
SOBRE EL PRODUCTO
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
1.PreparaciÃ³n de la superficie: La estructura de soporte (muros
portantes o panelerÃ­a) debe estar nivelada, firme y seca.
Verifique la correcta alineaciÃ³n de la perfilerÃ­a antes de iniciar la
instalaciÃ³n.
2.Cortes: Determinar las lÃ­neas de fijaciÃ³n y ubicaciÃ³n de los
paneles. Cortar a medida utilizando herramientas adecuadas,
asegurando cortes rectos y precisos.
3.FijaciÃ³n: Empezar por el primer panel en esquina o punto de
arranque. Fijar mediante tornillos autorroscantes en los puntos
indicados 
(fijaciÃ³n 
visible 
u 
oculta), 
respetando 
los
espaciamientos recomendados por el fabricante. Instalar los
paneles sucesivos encajando el lado macho en el hembra del
panel anterior.
4.Acabados: Colocar perfiles de terminaciÃ³n en remates, juntas y
esquinas. Revisar la correcta alineaciÃ³n y continuidad visual.
Sellar con silicona si aplica, segÃºn recomendaciones tÃ©cnicas.
5.Mantenimiento: Limpiar regularmente con agua y jabÃ³n
neutro. Evitar productos abrasivos o corrosivos.
Herramienta: Cinta mÃ©trica, nivel lÃ¡ser o de burbuja, guantes,
taladro con broca adecuada, tornillos autorroscantes, listones o
perfiles metÃ¡licos de soporte, perfiles de terminaciÃ³n.
La Polifachada es un sistema de revestimiento arquitectÃ³nico para
fachadas exteriores, fabricado en PVC (Policloruro de Vinilo), diseÃ±ado
para ofrecer alta resistencia a la humedad, agentes atmosfÃ©ricos e
insectos. Su configuraciÃ³n modular de listones verticales permite una
instalaciÃ³n eficiente sobre estructuras de soporte, aportando estabilidad,
durabilidad y un acabado contemporÃ¡neo con bajo mantenimiento.
Revestimiento exterior:
Fachadas ventiladas en edificios residenciales, comerciales,
industriales y prefabricados, casetas modulares, cÃ¡maras
frigorÃ­ficas, 
sectorizaciÃ³n 
industrial 
y 
cerramientos
decorativos.

--- PRODUCT DATA: 11_FT_Lamina_Sintetica.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
11
LÃ¡mina SintÃ©tica
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
Revestimiento: Muros en salas, habitaciones, oficinas y
locales comerciales
DecoraciÃ³n: Paredes tipo cabecero, fondos de TV, pasillos y
columnas
Espacios de alto diseÃ±o con necesidad de estÃ©tica cÃ¡lida y
textura visual
Proyectos con retroiluminaciÃ³n decorativa
1.PreparaciÃ³n de la superficie: AsegÃºrese de que la base estÃ©
limpia, seca y firme. Puede utilizar madera, MDF o aluminio
como soporte.
2.Cortes: Marque las medidas sobre la lÃ¡mina con cinta o
marcador suave y realice los cortes segÃºn el diseÃ±o requerido.
3.FijaciÃ³n: Utilice adhesivo de montaje neutro o silicona
transparente para fijar la lÃ¡mina. TambiÃ©n puede atornillarse
desde atrÃ¡s si se instala sobre estructura metÃ¡lica o modular.
4.Acabados: Retire excedentes de adhesivo. Instale luces LED si
el diseÃ±o es retroiluminado.
5.Mantenimiento: Limpie con paÃ±o suave y detergente neutro.
Evite abrasivos o estropajos. No se recomienda exponer
directamente al fuego u objetos calientes.
Herramienta: Sierra circular o caladora, cinta mÃ©trica, nivel,
taladro, brochas, luz LED (si es retroiluminada), adhesivo de
montaje neutro o silicona transparente.
La LÃ¡mina SintÃ©tica es un revestimiento decorativo de alto impacto
visual, diseÃ±ado para simular la apariencia natural del Ã³nix
retroiluminado. Fabricada en WPC, su superficie translÃºcida permite el
paso de la luz, generando un efecto luminoso elegante y sofisticado.
Gracias a su ligereza, resistencia y facilidad de manipulaciÃ³n, es una
soluciÃ³n ideal para proyectos de interiorismo que buscan acabados
modernos, cÃ¡lidos y personalizados, especialmente en aplicaciones
decorativas con iluminaciÃ³n integrada.
Peso:
Embalaje:
Densidad:
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
LÃ¡mina SintÃ©tica
Piedra del Sol / Crema Selecta: 244 cm x 122 cm
0,6 cm
Aproximadamente 8 kg/mÂ²
WPC
China
12 Kilogramos
Unidad
Espesor:
Formato:

--- PRODUCT DATA: 12_FT_Foam_Board.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
12
Foam Board
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
DecoraciÃ³n de interiores
Acabados para proyectos comerciales
ImpresiÃ³n digital y serigrafÃ­a
SeÃ±alizaciÃ³n y cartelerÃ­a
Puntos de venta y exhibiciones
Manualidades y proyectos de arte
1.PreparaciÃ³n de la superficie: La superficie debe estar limpia,
seca, lisa y libre de polvo, material bituminoso o humedad.
2.Cortes: De acuerdo al Ã¡rea, optimice los cortes del producto
teniendo en cuenta su medida estÃ¡ndar. Realice cortes precisos
con bisturÃ­ o herramienta adecuada.
3.SujeciÃ³n: Aplique adhesivo de montaje para PVC en la pared o
en la cara posterior del Foam Board, utilizando un patrÃ³n en
zigzag o puntos uniformemente distribuidos.
4.Acabados: Siga las recomendaciones del fabricante y utilice los
accesorios sugeridos en caso de ser necesarios para lograr un
acabado limpio y profesional.
5.Mantenimiento: Limpie con agua y jabÃ³n neutro para retirar el
polvo acumulado con el tiempo, cuando sea necesario.
Herramienta: FlexÃ³metro, bisturÃ­ o cÃºter, regla de aluminio y
guantes.
El Foam Board es un panel decorativo liviano y versÃ¡til, compuesto por
un nÃºcleo de espuma de poliestireno de alta densidad, recubierto por
capas externas de acabado tÃ©cnico y decorativo. Su estructura garantiza
rigidez, 
estabilidad 
dimensional 
y 
facilidad 
de 
manipulaciÃ³n,
convirtiÃ©ndolo en una soluciÃ³n ideal para aplicaciones de diseÃ±o interior,
exhibiciones, revestimientos decorativos y proyectos creativos.  
Disponible en mÃºltiples lÃ­neas especializadas, diseÃ±adas para responder
a diferentes conceptos estÃ©ticos y necesidades de diseÃ±o: Aurora Boreal,
Zen, Espejo, Gotas de Agua y Pastel.
Gracias a su bajo peso, fÃ¡cil corte, rÃ¡pida instalaciÃ³n y amplia variedad de
acabados, el Foam Board permite transformar superficies simples en
elementos de alto valor estÃ©tico, manteniendo un excelente balance
entre diseÃ±o, funcionalidad y rendimiento.
Peso:
Embalaje:
Densidad:
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
Foam Board
244 cm x 122 cm
0.5 cm
Aproximadamente 0.55 g/cmÂ³
PVC (Policloruro de Vinilo)
China
9.5 Kilogramos
Unidad
Formato:
Espesor:

--- PRODUCT DATA: 13_FT_Rollo Adhesivo MÃ¡rmol.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
13
Rollo Adhesivo de MÃ¡rmol
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
Revestimientos: Cocinas, baÃ±os, salas, oficinas o como
backsplash
Cubiertas de mobiliario: Encimeras, zÃ³calos y superficies
planas
Aplicaciones 
temporales 
o 
decorativas: 
Stands,
exhibiciones y remodelaciones rÃ¡pidas
1.PreparaciÃ³n de la superficie: La superficie debe estar limpia,
seca, lisa y libre de polvo, grasa o humedad. Lijar ligeramente
superficies brillantes o acrÃ­licas y retirar residuos con alcohol.
2.Cortes: Cortar el vinilo con precisiÃ³n antes de retirar el liner
protector. Para esquinas, marcar con lÃ¡piz fino.
3.SujeciÃ³n: Retirar el papel protector gradualmente y aplicar
sobre la superficie con la mano o rodillo desde un extremo,
presionando hacia afuera para evitar burbujas de aire.
4.Acabados: Alinear bien las vetas entre tramos si aplica junta.
Recortar bordes sobrantes con cÃºter tras la fijaciÃ³n.
5.Mantenimiento: Limpiar con paÃ±o hÃºmedo y jabÃ³n neutro.
Evitar productos abrasivos.
Herramienta: Cinta mÃ©trica, cÃºter, regla metÃ¡lica, espÃ¡tula o
rodillo de presiÃ³n, paÃ±o seco, alcohol isopropÃ­lico para limpieza.
El Rollo Adhesivo MÃ¡rmol es un revestimiento decorativo autoadhesivo
fabricado en vinilo PVC, diseÃ±ado para replicar el acabado visual del
mÃ¡rmol natural de forma prÃ¡ctica y econÃ³mica. Su superficie ofrece un
efecto elegante y sofisticado, ideal para renovar espacios sin necesidad
de obras ni procesos complejos.
Gracias a su flexibilidad, bajo peso y fÃ¡cil instalaciÃ³n, permite transformar
muros, mobiliario y superficies planas, proporcionando una soluciÃ³n
funcional para proyectos decorativos, remodelaciones rÃ¡pidas y
aplicaciones temporales, con buena resistencia al uso diario y a la
humedad.
Disponible en 4 colores: Gris, Negro, MÃ¡rmol T9 y Blanco. 
Peso:
Embalaje:
Densidad:
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
Rollo Adhesivo MÃ¡rmol
300 cm x 60 cm
0,008 cm
Aproximadamente 8 kg/mÂ²
Vinilo PVC
China
0,2 Kilogramos
Unidad
Formato:
Espesor:

--- PRODUCT DATA: 14_FT_Panel_WPC_Exterior.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
14
Panel WPC Exterior
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
El panel en WPC Exterior es fabricado con madera plÃ¡stica compuesta
(WPC - Wood Plastic Composite) su excelente apariencia y caracterÃ­sticas
le otorgan alta resistencia ante cualquier condiciÃ³n climÃ¡tica, un
producto de bajo mantenimiento que combina calidad y sostenibilidad,
con estÃ©tica y funcionalidad. Disponible en los siguientes colores:
Residencial: Salas de estar, dormitorios.
Comercial: 
Oficinas, 
restaurantes, 
hoteles, 
espacios
comerciales.
DecoraciÃ³n de Eventos: Bodas, fiestas, exhibiciones.
DiseÃ±os ArquitectÃ³nico
1.PreparaciÃ³n de la superficie: debe de estar limpia y seca,
libre de polvo, material biÃ³tico y humedad.
2.Cortes: De acuerdo al Ã¡rea, optimice los cortes del producto
teniendo en cuenta su medida estÃ¡ndar.
3.SujeciÃ³n: Aplique adhesivo de montaje al respaldo del
producto en lÃ­neas horizontales cada 30 cms y conecta cada
pieza con su sistema machimbrado hasta cubrir la superficie
deseada.
4.Acabados: Sigue las recomendaciones del fabricante con los
accesorios sugeridos en caso de ser necesarios.
5.Mantenimiento: Agua y jabÃ³n neutro para retirar el polvo
acumulado en el tiempo, cuando se considere necesario.
Herramienta: FlexÃ³metro, cortadora, regla aluminio y
guantes.
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
PaÃ­s de Origen:
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
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
15
Panel WPC Interior
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
Panel decorativo interior fabricado en Wood-Plastic Composite (WPC),
con aspecto de madera y acabado en listones verticales. Ideal para
revestir muros con diseÃ±o contemporÃ¡neo y alta resistencia al agua,
insectos y humedad, con bajo mantenimiento y excelente desempeÃ±o
en espacios interiores.
Revestimiento: Mural decorativo en salas, recibidores,
zonas lounge, oficinas, restaurantes, hoteles y locales
comerciales
Espacios 
con 
humedad 
ocasional: 
Cocinas, 
baÃ±os,
lavanderÃ­as
Paredes de acento: fondos de muebles, divisiones con
estÃ©tica vertical y moderna
1.PreparaciÃ³n de la superficie: La pared debe estar limpia, seca,
plana y libre de polvo o grasa.
2.Cortes: Marcar alineaciÃ³n con nivel y lÃ¡piz. Cortar paneles con
sierra para un ajuste preciso en esquinas o extremos.
3.FijaciÃ³n: Dos clips por cada metro lineal; fijar los clips al
bastidor o pared primero y luego encajar los paneles.
4.Acabados: Colocar perfiles o molduras en remates, cubrir
juntas visibles y asegurar un alineado vertical perfecto entre
listones.
5.Mantenimiento: Limpiar con paÃ±o seco o hÃºmedo. Para
manchas, usar detergente suave. Evitar abrasivos, solventes o
limpiadores agresivos que puedan daÃ±ar la superficie.
Herramienta: Cinta mÃ©trica, sierra circular o caladora, adhesivo
o clips metÃ¡licos, pistola de silicona, nivel, espaciadores, guantes
y gafas de protecciÃ³n.
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
Panel WPC Interior
295cm x 16cm
3 Kilogramos
10 Piezas por caja
2,5cm
Aproximadamente 9kg/mÂ²
PVC (Policloruro de Vinilo)
China

--- PRODUCT DATA: 16_FT_Panel_WPC_Interior_Redondo.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
16
Panel WPC Interior Redondo
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
Revestimiento: Mural decorativo en salas, recibidores,
zonas lounge, oficinas, restaurantes, hoteles y locales
comerciales
Espacios 
con 
humedad 
ocasional: 
Cocinas, 
baÃ±os,
lavanderÃ­as
Paredes de acento: fondos de muebles, divisiones con
estÃ©tica vertical y moderna
1.PreparaciÃ³n de la superficie: La pared debe estar limpia, seca,
plana y libre de polvo o grasa.
2.Cortes: Marcar alineaciÃ³n con nivel y lÃ¡piz. Cortar paneles con
sierra para un ajuste preciso en esquinas o extremos.
3.FijaciÃ³n: Dos clips por cada metro lineal; fijar los clips al
bastidor o pared primero y luego encajar los paneles.
4.Acabados: Colocar perfiles o molduras en remates, cubrir
juntas visibles y asegurar un alineado vertical perfecto entre
listones.
5.Mantenimiento: Limpiar con paÃ±o seco o hÃºmedo. Para
manchas, usar detergente suave. Evitar abrasivos, solventes o
limpiadores agresivos que puedan daÃ±ar la superficie.
Herramienta: Cinta mÃ©trica, sierra circular o caladora, adhesivo
o clips metÃ¡licos, pistola de silicona, nivel, espaciadores, guantes
y gafas de protecciÃ³n.
Panel decorativo interior de Composite de Madera-PlÃ¡stico (WPC) con
perfil semi-redondo fluted, de diseÃ±o elegante y textura curva. Ideal
como revestimiento mural o de cielo en proyectos residenciales y
comerciales que buscan acabado moderno, resistente a humedad, libre
de mantenimiento y con estÃ©tica cÃ¡lida.
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
Panel WPC Interior Redondo
295cm x 16cm
3 Kilogramos
10 Piezas por caja
2,5cm
Aproximadamente 9kg/mÂ²
PVC (Policloruro de Vinilo)
China

--- PRODUCT DATA: 17_FT_Paneles_acolchados DuoBig  DuoSmall.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
17
Panel Acolchado DuoBig / DuoSmall
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
Revestimiento: Mural en habitaciones infantiles, guarderÃ­as,
Ã¡reas lÃºdicas y salas temÃ¡ticas.
Ambientes: Espacios comerciales y lounge que buscan
estÃ©tica decorativa con funcionalidad acÃºstica (cafÃ©s,
boutiques, salas de espera)
Otros: Espacios con necesidad moderada de control de
reverberaciÃ³n sin perder diseÃ±o
1.PreparaciÃ³n de la superficie: La pared debe estar limpia, seca
y libre de polvo, humedad o grasa.
2.Cortes: Marcar la disposiciÃ³n de los paneles sobre la pared
usando nivel y lÃ¡piz antes de iniciar la instalaciÃ³n.
3.SujeciÃ³n: Aplicar adhesivo tipo montaje en forma de â€œSâ€ o
puntos en la parte posterior del panel. Presionar firmemente
contra la pared por al menos 30 segundos.
4.Acabados: Revisar alineaciÃ³n entre paneles y cubrir juntas
visibles con perfiles decorativos o tapajuntas si se requiere.
5.Mantenimiento: Limpiar con paÃ±o seco o ligeramente
hÃºmedo. En caso de manchas, usar jabÃ³n neutro y agua. Evitar
solventes, lijas o productos abrasivos que daÃ±en la tela.
Herramienta: Cinta mÃ©trica, cÃºter o bisturÃ­, nivel o nivel de
burbuja, guantes, adhesivo de montaje o clips metÃ¡licos para
fijaciÃ³n, paÃ±o limpio.
El Panel Acolchado Duo Big y Duo Small es un sistema decorativo y
funcional diseÃ±ado para aportar confort acÃºstico, suavidad visual y alto
valor estÃ©tico a espacios interiores. Su geometrÃ­a curva y modular genera
una lectura vertical continua que ayuda a reducir la reverberaciÃ³n sonora
y mejora el acondicionamiento acÃºstico del ambiente.
Fabricado con nÃºcleo de espuma de poliuretano y recubierto con cuero
sintÃ©tico de alta calidad, el panel ofrece una textura uniforme,
envolvente y resistente. El espesor controlado de cada formato garantiza
un buen desempeÃ±o acÃºstico sin sacrificar limpieza estÃ©tica,
convirtiÃ©ndolo en una soluciÃ³n ideal para proyectos de interiorismo
contemporÃ¡neo que buscan calidez, control sonoro y diseÃ±o.
Disponible en 4 colores:
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
Panel Acolchado
Duo Big: 120 cm x 40 cm /  Duo Small: 110 cm x 20 cm
0,5 Kilogramos (unidad)
Unidad
Duo Big: 3,5 cm / Duo Small: 2,5 cm
Aproximadamente 15 kg/mÂ²
Cuero sintÃ©tico de alta calidad y espuma de poliuretano
China
Azul
Fractal
Gris
Luminoso
Brillo Plata
Vainilla

--- PRODUCT DATA: 18.1_FT_Panel AcÃºstico Tipo 1.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
18.1
Panel AcÃºstico Tipo 1
El Panel AcÃºstico Tipo 1 es un revestimiento decorativo acÃºstico de
diseÃ±o ondulado tipo listÃ³n, desarrollado para mejorar la absorciÃ³n
sonora y aportar profundidad visual a los espacios interiores. Su
geometrÃ­a curva genera una lectura vertical continua que optimiza el
control de la reverberaciÃ³n y refuerza la continuidad arquitectÃ³nica del
ambiente.
Fabricado en MDF con respaldo acÃºstico, combina estÃ©tica tipo madera
con funcionalidad acÃºstica, siendo ideal para proyectos contemporÃ¡neos
que buscan equilibrio entre diseÃ±o, confort sonoro y durabilidad. Su
acabado de listones â€œcrisply alignedâ€ ofrece un aspecto limpio, moderno
y sofisticado. 
Disponible en 4 colores: cedro, cedro madera, ebano y avellana.
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
Revestimientos: Interiores en oficinas, salas de reuniones,
hoteles, residencias y restaurantes.
Espacios 
de 
difusiÃ³n 
acÃºstica: 
Teatros, 
salas 
de
conferencias, zonas lounge.
Paredes de acento: DetrÃ¡s de sofÃ¡s, Ã¡reas de trabajo y
murales decorativos.
1.PreparaciÃ³n de la superficie: La pared debe estar limpia, seca,
plana y libre de polvo o grasa.
2.Cortes: Marcar alineaciÃ³n con nivel y lÃ¡piz. Cortar paneles con
sierra para un ajuste preciso en esquinas o extremos.
3.FijaciÃ³n: Dos clips por cada metro lineal; fijar los clips al
bastidor o pared primero y luego encajar los paneles.
4.Acabados: Colocar perfiles o molduras en remates, cubrir
juntas visibles y asegurar un alineado vertical perfecto entre
listones.
5.Mantenimiento: Limpiar con paÃ±o seco o hÃºmedo. Para
manchas, usar detergente suave. Evitar abrasivos, solventes o
limpiadores agresivos que puedan daÃ±ar la superficie.
Herramienta: Cinta mÃ©trica, sierra circular o caladora, adhesivo
o clips metÃ¡licos, pistola de silicona, nivel, espaciadores, guantes
y gafas de protecciÃ³n.
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
Panel AcÃºstico Tipo 1
240 cm x 60 cm
5 Kilogramos
Unidad
1,4 cm
Aproximadamente 8 kg/mÂ²
MDF + Fieltro negro
China

--- PRODUCT DATA: 18.2_FT_Panel AcÃºstico Tipo 2.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
18.2
Panel AcÃºstico Tipo 2
El Panel AcÃºstico Tipo 2 es un revestimiento decorativo acÃºstico
modular de geometrÃ­a hexagonal, diseÃ±ado para optimizar la absorciÃ³n y
difusiÃ³n sonora en espacios interiores. Su textura tipo madera y relieve
tridimensional generan un alto impacto visual, al tiempo que
contribuyen al control de la reverberaciÃ³n y a la mejora del confort
acÃºstico.
Fabricado en MDF con respaldo acÃºstico, permite crear composiciones
precisas y personalizadas, adaptÃ¡ndose a diferentes configuraciones
arquitectÃ³nicas. Es una soluciÃ³n ideal para proyectos contemporÃ¡neos
que buscan combinar diseÃ±o, funcionalidad acÃºstica y estÃ©tica de alto
nivel.
Disponible en 4 colores: cedro, cedro madera, ebano y avellana.
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
Revestimientos: Interiores en oficinas, salas de reuniones,
hoteles, residencias y restaurantes.
Espacios 
de 
difusiÃ³n 
acÃºstica: 
Teatros, 
salas 
de
conferencias, zonas lounge.
Paredes de acento: DetrÃ¡s de sofÃ¡s, Ã¡reas de trabajo y
murales decorativos.
1.PreparaciÃ³n de la superficie: La pared debe estar limpia, seca,
plana y libre de polvo o grasa.
2.Cortes: Marcar alineaciÃ³n con nivel y lÃ¡piz. Cortar paneles con
sierra para un ajuste preciso en esquinas o extremos.
3.FijaciÃ³n: Dos clips por cada metro lineal; fijar los clips al
bastidor o pared primero y luego encajar los paneles.
4.Acabados: Colocar perfiles o molduras en remates, cubrir
juntas visibles y asegurar un alineado vertical perfecto entre
listones.
5.Mantenimiento: Limpiar con paÃ±o seco o hÃºmedo. Para
manchas, usar detergente suave. Evitar abrasivos, solventes o
limpiadores agresivos que puedan daÃ±ar la superficie.
Herramienta: Cinta mÃ©trica, sierra circular o caladora, adhesivo
o clips metÃ¡licos, pistola de silicona, nivel, espaciadores, guantes
y gafas de protecciÃ³n.
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
Panel AcÃºstico Tipo 2
76 cm x 62 cm
3 Kilogramos
Unidad
1,8 cm
Aproximadamente 5 kg/mÂ²
MDF + Fieltro negro
China

--- PRODUCT DATA: 18.3_FT_Panel AcÃºstico Tipo 3.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
18.3
Panel AcÃºstico Tipo 3
El Panel AcÃºstico Tipo 3 es un revestimiento decorativo acÃºstico de
formato vertical con patrÃ³n en espiga, diseÃ±ado para mejorar la
absorciÃ³n y difusiÃ³n sonora en espacios interiores. Su textura tipo
madera y relieve direccional aportan dinamismo visual y ritmo
arquitectÃ³nico, convirtiÃ©ndolo en un elemento protagÃ³nico del diseÃ±o
interior.
Fabricado en MDF con respaldo acÃºstico, su diseÃ±o modular permite una
instalaciÃ³n precisa y composiciones continuas, optimizando el control
acÃºstico sin sacrificar estÃ©tica. Es una soluciÃ³n ideal para proyectos
contemporÃ¡neos que buscan equilibrio entre diseÃ±o, confort sonoro y
funcionalidad.
Disponible en 4 colores: cedro, cedro madera, ebano y avellana.
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
Revestimientos: Interiores en oficinas, salas de reuniones,
hoteles, residencias y restaurantes.
Espacios 
de 
difusiÃ³n 
acÃºstica: 
Teatros, 
salas 
de
conferencias, zonas lounge.
Paredes de acento: DetrÃ¡s de sofÃ¡s, Ã¡reas de trabajo y
murales decorativos.
1.PreparaciÃ³n de la superficie: La pared debe estar limpia, seca,
plana y libre de polvo o grasa.
2.Cortes: Marcar alineaciÃ³n con nivel y lÃ¡piz. Cortar paneles con
sierra para un ajuste preciso en esquinas o extremos.
3.FijaciÃ³n: Dos clips por cada metro lineal; fijar los clips al
bastidor o pared primero y luego encajar los paneles.
4.Acabados: Colocar perfiles o molduras en remates, cubrir
juntas visibles y asegurar un alineado vertical perfecto entre
listones.
5.Mantenimiento: Limpiar con paÃ±o seco o hÃºmedo. Para
manchas, usar detergente suave. Evitar abrasivos, solventes o
limpiadores agresivos que puedan daÃ±ar la superficie.
Herramienta: Cinta mÃ©trica, sierra circular o caladora, adhesivo
o clips metÃ¡licos, pistola de silicona, nivel, espaciadores, guantes
y gafas de protecciÃ³n.
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
Panel AcÃºstico Tipo 3
125,9 cm x 56,6 cm
5 Kilogramos
Unidad
2,1 cm
Aproximadamente 7 kg/mÂ²
MDF + Fieltro negro
China

--- PRODUCT DATA: 18.4_FT_Panel AcÃºstico Tipo 4.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
18.4
Panel AcÃºstico Tipo 4
El Panel AcÃºstico Tipo 4 es un revestimiento decorativo acÃºstico de
gran formato, diseÃ±ado con patrÃ³n en espiga continua que aporta
continuidad visual y alto desempeÃ±o acÃºstico en muros arquitectÃ³nicos.
Su textura tipo madera y relieve lineal optimizan la absorciÃ³n y difusiÃ³n
sonora, mejorando el confort acÃºstico del espacio.
Fabricado en MDF con respaldo acÃºstico, su diseÃ±o vertical refuerza la
percepciÃ³n de altura y orden, convirtiÃ©ndolo en una soluciÃ³n ideal para
proyectos contemporÃ¡neos que requieren control sonoro, estÃ©tica
sofisticada y alto impacto visual.
Disponible en 4 colores: cedro, cedro madera, ebano y avellana.
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
Revestimientos: Interiores en oficinas, salas de reuniones,
hoteles, residencias y restaurantes.
Espacios 
de 
difusiÃ³n 
acÃºstica: 
Teatros, 
salas 
de
conferencias, zonas lounge.
Paredes de acento: DetrÃ¡s de sofÃ¡s, Ã¡reas de trabajo y
murales decorativos.
1.PreparaciÃ³n de la superficie: La pared debe estar limpia, seca,
plana y libre de polvo o grasa.
2.Cortes: Marcar alineaciÃ³n con nivel y lÃ¡piz. Cortar paneles con
sierra para un ajuste preciso en esquinas o extremos.
3.FijaciÃ³n: Dos clips por cada metro lineal; fijar los clips al
bastidor o pared primero y luego encajar los paneles.
4.Acabados: Colocar perfiles o molduras en remates, cubrir
juntas visibles y asegurar un alineado vertical perfecto entre
listones.
5.Mantenimiento: Limpiar con paÃ±o seco o hÃºmedo. Para
manchas, usar detergente suave. Evitar abrasivos, solventes o
limpiadores agresivos que puedan daÃ±ar la superficie.
Herramienta: Cinta mÃ©trica, sierra circular o caladora, adhesivo
o clips metÃ¡licos, pistola de silicona, nivel, espaciadores, guantes
y gafas de protecciÃ³n.
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
Panel AcÃºstico Tipo 4
270 cm x 55,9 cm
5 Kilogramos
Unidad
2,1 cm
Aproximadamente 7 kg/mÂ²
MDF + Fieltro negro
China

--- PRODUCT DATA: 18.5_FT_Panel AcÃºstico Tipo 5.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
18.5
Panel AcÃºstico Tipo 5
El Panel AcÃºstico Tipo 5 es un revestimiento decorativo acÃºstico de
formato vertical, compuesto por listones lineales con textura tipo
madera, diseÃ±ado para mejorar la absorciÃ³n sonora y el control acÃºstico
en espacios interiores. Su geometrÃ­a continua aporta orden visual,
profundidad y continuidad arquitectÃ³nica, convirtiÃ©ndose en una
soluciÃ³n funcional y estÃ©tica para muros de alto diseÃ±o.
Fabricado en MDF y montado sobre respaldo acÃºstico, ofrece un
equilibrio ideal entre desempeÃ±o acÃºstico, facilidad de instalaciÃ³n y
acabado contemporÃ¡neo, siendo apto para muros y cielos interiores.
Disponible en 4 colores: cedro, cedro madera, ebano y avellana.
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
Revestimientos: Interiores en oficinas, salas de reuniones,
hoteles, residencias y restaurantes.
Espacios 
de 
difusiÃ³n 
acÃºstica: 
Teatros, 
salas 
de
conferencias, zonas lounge.
Paredes de acento: DetrÃ¡s de sofÃ¡s, Ã¡reas de trabajo y
murales decorativos.
1.PreparaciÃ³n de la superficie: La pared debe estar limpia, seca,
plana y libre de polvo o grasa.
2.Cortes: Marcar alineaciÃ³n con nivel y lÃ¡piz. Cortar paneles con
sierra para un ajuste preciso en esquinas o extremos.
3.FijaciÃ³n: Dos clips por cada metro lineal; fijar los clips al
bastidor o pared primero y luego encajar los paneles.
4.Acabados: Colocar perfiles o molduras en remates, cubrir
juntas visibles y asegurar un alineado vertical perfecto entre
listones.
5.Mantenimiento: Limpiar con paÃ±o seco o hÃºmedo. Para
manchas, usar detergente suave. Evitar abrasivos, solventes o
limpiadores agresivos que puedan daÃ±ar la superficie.
Herramienta: Cinta mÃ©trica, sierra circular o caladora, adhesivo
o clips metÃ¡licos, pistola de silicona, nivel, espaciadores, guantes
y gafas de protecciÃ³n.
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
Panel AcÃºstico Tipo 5
240 cm x 60 cm
2 Kilogramos
Unidad
1,6 cm
Aproximadamente 5 kg/mÂ²
MDF + Fieltro negro
China

--- PRODUCT DATA: 18.6_FT_Panel AcÃºstico Tipo 6.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
18.6
Panel AcÃºstico Tipo 6
El Panel AcÃºstico Tipo 6 es un revestimiento decorativo acÃºstico tipo
listÃ³n de madera natural o laminada, montado sobre respaldo acÃºstico
(fieltro PET o nÃºcleo mineral/fibra). Su geometrÃ­a ondulada genera una
superficie tridimensional que mejora la difusiÃ³n acÃºstica, reduce
reflexiones directas y optimiza la calidad del sonido en el espacio.
Su textura formada por listones crea variaciones rÃ­tmicas que aportan
profundidad visual y carÃ¡cter contemporÃ¡neo, mientras que su formato
modular permite una instalaciÃ³n precisa y continua. Es una soluciÃ³n
funcional y estÃ©tica para interiores que requieren alto desempeÃ±o
acÃºstico y diseÃ±o arquitectÃ³nico.
Disponible en 4 colores: cedro mix avellana, madera mix avellana, cedro
mix ebano, madera mix ebano.
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
Revestimientos: Interiores en oficinas, salas de reuniones,
hoteles, residencias y restaurantes.
Espacios 
de 
difusiÃ³n 
acÃºstica: 
Teatros, 
salas 
de
conferencias, zonas lounge.
Paredes de acento: DetrÃ¡s de sofÃ¡s, Ã¡reas de trabajo y
murales decorativos.
1.PreparaciÃ³n de la superficie: La pared debe estar limpia, seca,
plana y libre de polvo o grasa.
2.Cortes: Marcar alineaciÃ³n con nivel y lÃ¡piz. Cortar paneles con
sierra para un ajuste preciso en esquinas o extremos.
3.FijaciÃ³n: Dos clips por cada metro lineal; fijar los clips al
bastidor o pared primero y luego encajar los paneles.
4.Acabados: Colocar perfiles o molduras en remates, cubrir
juntas visibles y asegurar un alineado vertical perfecto entre
listones.
5.Mantenimiento: Limpiar con paÃ±o seco o hÃºmedo. Para
manchas, usar detergente suave. Evitar abrasivos, solventes o
limpiadores agresivos que puedan daÃ±ar la superficie.
Herramienta: Cinta mÃ©trica, sierra circular o caladora, adhesivo
o clips metÃ¡licos, pistola de silicona, nivel, espaciadores, guantes
y gafas de protecciÃ³n.
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
Panel AcÃºstico Tipo 6
116,1 cm x 120 cm
5 Kilogramos
Unidad
2,1 cm
Aproximadamente 7 kg/mÂ²
MDF + Fieltro negro
China

--- PRODUCT DATA: 19_FT_Panel_Acrilico MÃ¡rmol.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
19
Panel Acrilico de MÃ¡rmol
SOBRE EL PRODUCTO
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
Revestimiento de paredes y muros decorativos
Fondos para salas, recepciones y locales comerciales
Revestimiento de columnas e islas decorativas
Tableros retroiluminados
SeÃ±alÃ©tica y elementos arquitectÃ³nicos
Mesones decorativos y aplicaciones interiores
1.PreparaciÃ³n de la superficie: Verifique que el muro estÃ© seco,
limpio, liso y firme. En caso de irregularidades, realice un lijado
o relleno previo.
2.Corte del panel: Marque el contorno deseado directamente
sobre la parte posterior del panel y realice el corte con
herramientas adecuadas.
3.SujeciÃ³n: Aplique adhesivo de montaje o silicona neutra de
forma uniforme en la parte posterior del panel. Presione
firmemente 
contra 
el 
muro 
asegurando 
una 
correcta
adherencia.
4.Acabados: Verifique la nivelaciÃ³n. Selle bordes si el proyecto lo
requiere o instale perfiles decorativos en esquinas y uniones.
5.Mantenimiento: Limpie con paÃ±o seco o ligeramente hÃºmedo.
No utilice productos abrasivos, Ã¡cidos o solventes. Evite
contacto directo con objetos calientes.
Herramienta: Nivel lÃ¡ser, adhesivo neutro o adhesivo de
montaje, cinta mÃ©trica, caladora de dientes finos, guantes, paÃ±o
suave.
El Panel AcrÃ­lico MÃ¡rmol es un revestimiento decorativo de alto brillo
fabricado en resina acrÃ­lica de alta densidad, diseÃ±ado para reproducir
fielmente la estÃ©tica del mÃ¡rmol natural con una soluciÃ³n mÃ¡s liviana,
resistente y fÃ¡cil de instalar.
Su acabado translÃºcido y efecto profundo aportan elegancia,
luminosidad y sofisticaciÃ³n a los espacios, convirtiÃ©ndose en una
alternativa moderna al mÃ¡rmol o granito tradicional, ideal para proyectos
arquitectÃ³nicos y de diseÃ±o interior.
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
Panel AcrÃ­lico MÃ¡rmol
2,44 m x 1,22 m (Ãrea por panel: 2,9 mÂ²)
7 kg
Unidad
2 mm
Aproximadamente 9kg/mÂ²
AcrÃ­lico
China

--- PRODUCT DATA: 20_FT_ListÃ³n WPC Exterior.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
20
ListÃ³n WPC Exterior
SOBRE EL PRODUCTO
RECOMENDACIONES DE INSTALACIÃ“N
VENTAJAS DEL PRODUCTO
Alta resistencia a la humedad, sol y cambios climÃ¡ticos
No se pudre, no se oxida y no se astilla
Apariencia tipo madera natural
Bajo mantenimiento
Material sostenible y de larga vida Ãºtil
Ideal para uso arquitectÃ³nico exterior
Instalar sobre estructura nivelada y firme.
Utilizar tornillerÃ­a y accesorios recomendados para WPC
exterior.
Dejar dilataciones entre piezas segÃºn condiciones climÃ¡ticas
Uso de tornillo de acero inoxidable WPC exterior REF:
14122901.
El ListÃ³n WPC Exterior es un elemento arquitectÃ³nico fabricado en
Wood Plastic Composite (WPC), diseÃ±ado para aplicaciones exteriores
que requieren alta resistencia a la intemperie y una estÃ©tica tipo madera
natural. Su composiciÃ³n combina fibras de madera y polÃ­meros, logrando
un producto duradero, estable y de bajo mantenimiento, ideal para
fachadas, pÃ©rgolas, celosÃ­as y revestimientos decorativos exteriores.
Disponible en los siguientes colores:
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
ListÃ³n WPC Exterior
ListÃ³n tipo tubular 5,60m (largo) x 6cm (ancho) x 4cm (alto)
8,8Kg
Unidad
6 mm
-
WPC (Wood Plastic Composite)
China
MANTENIMIENTO
Limpieza con agua y jabÃ³n neutro
No requiere barnices, selladores ni tratamientos especiales
USOS Y APLICACIONES
Fachadas exteriores
Muros decorativos
PÃ©rgolas y parasoles
Cerramientos arquitectÃ³nicos
Proyectos residenciales y comerciales

--- PRODUCT DATA: 21_FT_ListÃ³n PVC Interior.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
21
ListÃ³n PVC Interior
SOBRE EL PRODUCTO
El ListÃ³n PVC Interior es un revestimiento decorativo arquitectÃ³nico
fabricado en PVC de alta calidad, diseÃ±ado para aplicaciones interiores
que requieren ligereza, resistencia a la humedad y bajo mantenimiento.
Su diseÃ±o tipo listÃ³n con acabado tipo madera permite crear superficies
continuas, modernas y elegantes, aportando orden visual y profundidad
a los espacios.
Es una soluciÃ³n ideal para proyectos de interiorismo residencial y
comercial, donde se busca una alternativa prÃ¡ctica a la madera natural,
sin los requerimientos de mantenimiento ni las limitaciones frente a la
humedad.
Disponible en los siguientes colores:
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
ListÃ³n PVC Interior
ListÃ³n tipo sÃ³lido 2,90 m (largo) x 10 cm (ancho frente) x 5 cm (alto)
1,1 kg
Unidad
3 mm
-
PVC (Policloruro de Vinilo)
China
USOS Y APLICACIONES
Paredes decorativas
Revestimiento de columnas interiores
Proyectos residenciales y comerciales de diseÃ±o interior
GUÃA DE INSTALACIÃ“N
1.PreparaciÃ³n de la superficie: La pared debe estar seca, limpia, lisa y
nivelada. Si existen imperfecciones mayores, se recomienda resanar o
alisar previamente para garantizar una correcta alineaciÃ³n de los listones.
2.Trazado y cortes: Marque las lÃ­neas guÃ­a sobre el muro para asegurar una
instalaciÃ³n recta y continua. Corte los listones a la medida requerida
utilizando herramientas manuales o elÃ©ctricas adecuadas.
3.FijaciÃ³n del listÃ³n: El listÃ³n PVC estructural puede fijarse de dos maneras:
4.FijaciÃ³n mecÃ¡nica (recomendada): Atornille el listÃ³n directamente a la
superficie o estructura de soporte, utilizando tornillos adecuados para PVC.
5.FijaciÃ³n con adhesivo (uso interior): Aplique adhesivo de montaje en la
parte posterior del listÃ³n en forma de cordÃ³n o puntos uniformes y
presione firmemente contra el muro.
6.InstalaciÃ³n del KIT TAPONES: Una vez fijado el listÃ³n: Inserte los tapones
del KIT TAPONES LISTÃ“N PVC ESTRUCTURAL 10 CM en los extremos visibles
del perfil. Asegure el ajuste presionando suavemente hasta lograr un cierre
limpio y alineado. El uso de los tapones garantiza un acabado estÃ©tico,
uniforme y seguro, ademÃ¡s de proteger el interior del perfil.
7.Acabados: Revise la alineaciÃ³n final de los listones.  En esquinas o
terminaciones, puede complementar con perfiles decorativos si el diseÃ±o
lo requiere. No es necesario pintar ni sellar el producto.
Herramienta: Cinta mÃ©trica, nivel, sierra manual o elÃ©ctrica, taladro,
tornillos para PVC, adhesivo de montaje (opcional), martillo de goma,
KIT TAPONES LISTÃ“N PVC ESTRUCTURAL 10 CM, paÃ±o limpio.

--- PRODUCT DATA: 22_FT_ListÃ³n PVC Cielo Raso.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
22
ListÃ³n PVC Cielo Raso
SOBRE EL PRODUCTO
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
Cielos rasos interiores en salas, oficinas y baÃ±os
Pasillos o recepciones
Aplicaciones decorativas en techos de bajo trÃ¡fico
1.PreparaciÃ³n de la superficie: Verifique que el cielo estÃ© limpio
y nivelado. Use perfiles de soporte metÃ¡licos o de PVC para
asegurar la estructura.
2.Cortes: Tome medidas del Ã¡rea. Corte las piezas al largo
deseado, cuidando el acabado de los bordes.
3.SujeciÃ³n: Instale los perfiles guÃ­a en el perÃ­metro. Luego
introduzca y fije los listones en los perfiles con tornillos o clips
de presiÃ³n.
4.Acabados: Puede sellar juntas con silicona blanca o rematar con
perfiles decorativos para dar un acabado profesional.
5.Mantenimiento: Limpieza sencilla con paÃ±o hÃºmedo. No
requiere pintura ni tratamientos especiales.
Herramienta: Cinta mÃ©trica, cÃºter o sierra, taladro, perfiles en U
o L.
El ListÃ³n PVC Cielo Raso es un elemento decorativo y funcional
diseÃ±ado para revestimiento de cielos rasos interiores. Su geometrÃ­a
lineal aporta un acabado moderno y continuo, ideal para proyectos
residenciales y comerciales. Fabricado en PVC de alta calidad, es liviano,
resistente a la humedad y de fÃ¡cil instalaciÃ³n, ofreciendo una alternativa
duradera frente a materiales tradicionales.
Disponible en los siguientes colores:
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
ListÃ³n PVC Cielo Raso
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
FÃ¡cil limpieza
Bajo mantenimiento
InstalaciÃ³n rÃ¡pida
Acabado tipo madera de alta estÃ©tica

--- PRODUCT DATA: 23_FT_Cielo Raso Lamina PVC.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
23
Cielo Raso LÃ¡mina PVC
SOBRE EL PRODUCTO
La LÃ¡mina PVC para Cielo Raso es un sistema decorativo y funcional
para recubrimiento de techos interiores. Fabricada en PVC de alta
calidad, ofrece una soluciÃ³n liviana, resistente y de fÃ¡cil instalaciÃ³n, ideal
para proyectos residenciales, comerciales e institucionales.
Disponible en acabados brillantes, mate, textura marmolizada,
amaderada, y colores exclusivos (bajo pedido).
Peso:
Calibre: 
Formato:
Embalaje:
Acabado:
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
Cielo Raso Lamina PVC
2.5 â€“ 3 kg por unidad
Unidad
8.5 mm
Brillante / Mate (segÃºn referencia)
China
PVC (Policloruro de Vinilo)
USOS Y APLICACIONES
Cielos rasos residenciales
Oficinas y locales comerciales
Zonas hÃºmedas (baÃ±os, cocinas, lavanderÃ­as)
Proyectos institucionales
30 cm (ancho) x 5,95 m (largo)
CARACTERISTICAS
Impermeable
FÃ¡cil de limpiar
Aislante tÃ©rmico
Aislante acÃºstico
Material liviano
FÃ¡cil instalaciÃ³n
Autoextinguible
Material reciclable
No contiene metales
No requiere mantenimiento
BENEFICIOS DEL PRODUCTO
Mejora la estÃ©tica del espacio
Reduce costos de mantenimiento
InstalaciÃ³n rÃ¡pida y limpia
Alta durabilidad
Resistente a la humedad y al moho
ACCESORIOS COMPATIBLES
Corniza PVC
Perimetral tipo F
Perimetral tipo U
UniÃ³n tipo H
Esquinero
        (Accesorios diseÃ±ados para garantizar una instalaciÃ³n estÃ©tica y profesional)

--- PRODUCT DATA: 24_FT_Zocalo SPC.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
24
Zocalo SPC
SOBRE EL PRODUCTO
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
Remate perimetral entre piso y muro
Proyectos residenciales y comerciales
Espacios interiores como salas, habitaciones, oficinas y
pasillos
Compatible con pisos SPC, laminados y otros pisos flotantes
1.PreparaciÃ³n de la superficie: El muro debe estar limpio, seco y
libre de polvo o grasa.
2.Cortes: Corte los zÃ³calos a la medida requerida, cuidando los
Ã¡ngulos en esquinas internas y externas.
3.FijaciÃ³n: Aplique adhesivo de montaje en la parte posterior del
zÃ³calo y presione firmemente contra el muro. No fijar al piso
para permitir la dilataciÃ³n del revestimiento.
4.Acabados: Verifique alineaciÃ³n y continuidad. Selle juntas si el
diseÃ±o lo requiere.
5.Mantenimiento: Limpieza con paÃ±o hÃºmedo y detergente
suave. No usar productos abrasivos.
Herramienta: Cinta mÃ©trica, sierra manual o ingleteadora,
adhesivo de montaje, espÃ¡tula, paÃ±o limpio.
El ZÃ³calo SPC (Stone Plastic Composite) es un accesorio arquitectÃ³nico
diseÃ±ado para brindar un acabado limpio, estÃ©tico y funcional en la
uniÃ³n entre pisos y muros. Fabricado con nÃºcleo rÃ­gido SPC, ofrece alta
resistencia, estabilidad dimensional y durabilidad, siendo ideal para
proyectos residenciales y comerciales.
Su acabado tipo madera complementa perfectamente los pisos SPC y
otros revestimientos, aportando continuidad visual y protecciÃ³n
perimetral frente a golpes, humedad y desgaste diario.
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
ZÃ³calo SPC
240 cm x 7 cm
-
10 piezas por caja
13 mm
-
SPC (Stone Plastic Composite)
China

--- PRODUCT DATA: 25_FT_Lamina PVC Board.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
25
LÃ¡mina PVC Board
SOBRE EL PRODUCTO
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
Publicidad y artes grÃ¡ficas
Muebles para el hogar
ConstrucciÃ³n liviana
AplicaciÃ³n industrial
Material de acabados
1.PreparaciÃ³n de la superficie: La superficie debe estar limpia,
nivelada y libre de material bituminoso, humedad o polvo.
2.Cortes: Utilice una sierra adecuada para el corte de paneles de
PVC BOARD segÃºn las medidas y formas necesarias. AsegÃºrese
de seguir las recomendaciones del fabricante para obtener
cortes precisos.
3.SujeciÃ³n: Aplique un adhesivo recomendado por el fabricante
en la parte posterior de cada panel. Distribuya el adhesivo de
manera uniforme para asegurar una correcta fijaciÃ³n.
4.Acabados: Realice cortes adicionales si es necesario para
ajustar el panel a esquinas y bordes. Utilice molduras o
accesorios especÃ­ficos para lograr un acabado profesional.
5.Mantenimiento: 
En 
caso 
de 
ser 
necesario, 
retire 
la
acumulaciÃ³n de polvo con una manguera de jardÃ­n o con agua
a presiÃ³n no superior a 110 PSI, adoptando las medidas de
seguridad necesarias para evitar daÃ±os.
Herramienta: Sierra de corte, guantes y gafas de seguridad,
adhesivo de montaje.
Denominado comercialmente como PVC BOARD, es una lÃ¡mina
fabricada en PVC espumado rÃ­gido, con acabado endurecido, superficie
suave y disponible en presentaciÃ³n brillante o mate. Gracias a su
estructura celular interna, ofrece una excelente combinaciÃ³n de ligereza,
resistencia y estabilidad dimensional, facilitando su manipulaciÃ³n, corte
e instalaciÃ³n.
Las lÃ¡minas PVC BOARD pueden pintarse, imprimirse, laminarse, rutearse
y perforarse con facilidad, siendo ideales para aplicaciones de
modelismo, construcciÃ³n liviana, mobiliario, seÃ±alizaciÃ³n, ferias y
exposiciones. Es un material impermeable, autoextinguible, resistente a
vibraciones y a la humedad, lo que lo convierte en una alternativa
versÃ¡til y duradera para proyectos de interior y uso tÃ©cnico.
Peso:
Espesor:
Formato:
Embalaje:
Densidad / Calibres disponibles:
PaÃ­s de Origen:
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
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
26.1
Cubierta Termoacustica UPVC Roma 
USOS Y APLICACIONES
LÃ¡mina termoacÃºstica fabricada en UPVC (cloruro de polivinilo no
plastificado) con perfil tipo teja romana, diseÃ±ada para cubrir y proteger
espacios reduciendo el ruido y el calor. Ofrece alta resistencia a la
intemperie, a la corrosiÃ³n y a los rayos UV, garantizando durabilidad y
bajo mantenimiento.
Cubiertas residenciales estilo colonial
Techos de terrazas y patios
Proyectos arquitectÃ³nicos con estÃ©tica de teja curva
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
Cubierta Termoacustica UPVC 2,5mm Roma
11,80m - 1,05m (Ancho Ãºtil 98cm)
Unidad
Aproximadamente 1,40 g/cm3l
UPVC (Cloruro de Polivinilo no Plastificado)
China
COLORES DISPONIBLES
2.5MM
5 Kilogramos
2.5 mm
1.PreparaciÃ³n de la superficie: Instale una estructura de soporte metÃ¡lica o de
madera, limpia, firme y nivelada. Verifique la correcta alineaciÃ³n y respete la
separaciÃ³n de correas segÃºn especificaciÃ³n tÃ©cnica, garantizando una
pendiente adecuada para la evacuaciÃ³n del agua.
2.Corte: Marque las medidas requeridas sobre la lÃ¡mina. Realice los cortes
utilizando tijera para lÃ¡mina plÃ¡stica o herramienta de disco fino, evitando
generar rebabas o deformaciones en el material.
3.ColocaciÃ³n: Coloque las lÃ¡minas en sentido contrario a la direcciÃ³n del viento
dominante, iniciando desde el alero hacia la cumbrera. Asegure el correcto
traslape lateral y longitudinal para evitar filtraciones.
4.SujeciÃ³n: Fije las lÃ¡minas perforando previamente en la cresta de la teja. Utilice
tornillos autoperforantes con arandela de neopreno, sin sobreapretar,
permitiendo la dilataciÃ³n tÃ©rmica natural del UPVC.
5.Acabados: Instale remates, cumbreras y accesorios compatibles. Revise sellos y
puntos de uniÃ³n para garantizar estanqueidad y continuidad estÃ©tica.
6.Mantenimiento: Limpie periÃ³dicamente con agua y jabÃ³n neutro. Evite el uso
de productos quÃ­micos abrasivos. Inspeccione anualmente la fijaciÃ³n y el estado
general de la cubierta.
Recomendaciones importantes:
No caminar directamente sobre la lÃ¡mina sin apoyo estructural.
Evitar instalaciones en condiciones climÃ¡ticas extremas.
Respetar siempre las recomendaciones del fabricante para asegurar la
durabilidad y la garantÃ­a del producto.
GUÃA DE INSTALACIÃ“N
Herramienta: Taladro, broca para metal o madera, tornillos
autoperforantes con arandela de neopreno, cinta mÃ©trica,
tijera para lÃ¡mina plÃ¡stica o herramienta de disco fino,
guantes y gafas de seguridad.

--- PRODUCT DATA: 26.2_FT_Cubierta Termoacustica UPVC Blanca O.A.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
26.2
Cubierta Termoacustica UPVC Blanca O.A
USOS Y APLICACIONES
LÃ¡mina termoacÃºstica de UPVC con perfil ondulado alto, diseÃ±ada para
cubrir grandes luces y ofrecer mayor resistencia estructural. Especial para
naves industriales y techos expuestos a altas cargas de viento.
Galpones y bodegas
Cubiertas industriales
Ãreas de producciÃ³n o almacenamiento
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
Cubierta Termoacustica UPVC 2.5mm Blanca O.A
11,80m - 1,07m (Ancho Ãºtil 1m)
Unidad
Aproximadamente 1,40 g/cm3
UPVC (Cloruro de Polivinilo no Plastificado)
China
2.5MM
COLORES DISPONIBLES
5 Kilogramos
2.5 mm
1.PreparaciÃ³n de la superficie: Instale una estructura de soporte metÃ¡lica o de
madera, limpia, firme y nivelada. Verifique la correcta alineaciÃ³n y respete la
separaciÃ³n de correas segÃºn especificaciÃ³n tÃ©cnica, garantizando una
pendiente adecuada para la evacuaciÃ³n del agua.
2.Corte: Marque las medidas requeridas sobre la lÃ¡mina. Realice los cortes
utilizando tijera para lÃ¡mina plÃ¡stica o herramienta de disco fino, evitando
generar rebabas o deformaciones en el material.
3.ColocaciÃ³n: Coloque las lÃ¡minas en sentido contrario a la direcciÃ³n del viento
dominante, iniciando desde el alero hacia la cumbrera. Asegure el correcto
traslape lateral y longitudinal para evitar filtraciones.
4.SujeciÃ³n: Fije las lÃ¡minas perforando previamente en la cresta de la teja. Utilice
tornillos autoperforantes con arandela de neopreno, sin sobreapretar,
permitiendo la dilataciÃ³n tÃ©rmica natural del UPVC.
5.Acabados: Instale remates, cumbreras y accesorios compatibles. Revise sellos y
puntos de uniÃ³n para garantizar estanqueidad y continuidad estÃ©tica.
6.Mantenimiento: Limpie periÃ³dicamente con agua y jabÃ³n neutro. Evite el uso
de productos quÃ­micos abrasivos. Inspeccione anualmente la fijaciÃ³n y el estado
general de la cubierta.
Recomendaciones importantes:
No caminar directamente sobre la lÃ¡mina sin apoyo estructural.
Evitar instalaciones en condiciones climÃ¡ticas extremas.
Respetar siempre las recomendaciones del fabricante para asegurar la
durabilidad y la garantÃ­a del producto.
GUÃA DE INSTALACIÃ“N
Herramienta: Taladro, broca para metal o madera, tornillos
autoperforantes con arandela de neopreno, cinta mÃ©trica,
tijera para lÃ¡mina plÃ¡stica o herramienta de disco fino,
guantes y gafas de seguridad.

--- PRODUCT DATA: 26.3_FT_Cubierta Termoacustica UPVC Blanca O.B.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
26.3
Cubierta Termoacustica UPVC Blanca O.B
USOS Y APLICACIONES
Panel de UPVC con perfil de onda baja, idÃ³neo para cubiertas
residenciales o comerciales donde se busque un acabado mÃ¡s discreto y
menor altura de onda.
Tejados de vivienda urbana
Cubiertas comerciales ligeras
Techos de pÃ©rgolas o corredores
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
Cubierta Termoacustica UPVC 2.0mm Blanca O.B
11,80m - 1,13m (Ancho Ãºtil 1,5m)
Unidad
2.0 mm
Aproximadamente 1,40 g/cm3
UPVC (Cloruro de Polivinilo no Plastificado)
China
2.0MM
COLORES DISPONIBLES
5 Kilogramos
1.PreparaciÃ³n de la superficie: Instale una estructura de soporte metÃ¡lica o de
madera, limpia, firme y nivelada. Verifique la correcta alineaciÃ³n y respete la
separaciÃ³n de correas segÃºn especificaciÃ³n tÃ©cnica, garantizando una
pendiente adecuada para la evacuaciÃ³n del agua.
2.Corte: Marque las medidas requeridas sobre la lÃ¡mina. Realice los cortes
utilizando tijera para lÃ¡mina plÃ¡stica o herramienta de disco fino, evitando
generar rebabas o deformaciones en el material.
3.ColocaciÃ³n: Coloque las lÃ¡minas en sentido contrario a la direcciÃ³n del viento
dominante, iniciando desde el alero hacia la cumbrera. Asegure el correcto
traslape lateral y longitudinal para evitar filtraciones.
4.SujeciÃ³n: Fije las lÃ¡minas perforando previamente en la cresta de la teja. Utilice
tornillos autoperforantes con arandela de neopreno, sin sobreapretar,
permitiendo la dilataciÃ³n tÃ©rmica natural del UPVC.
5.Acabados: Instale remates, cumbreras y accesorios compatibles. Revise sellos y
puntos de uniÃ³n para garantizar estanqueidad y continuidad estÃ©tica.
6.Mantenimiento: Limpie periÃ³dicamente con agua y jabÃ³n neutro. Evite el uso
de productos quÃ­micos abrasivos. Inspeccione anualmente la fijaciÃ³n y el estado
general de la cubierta.
Recomendaciones importantes:
No caminar directamente sobre la lÃ¡mina sin apoyo estructural.
Evitar instalaciones en condiciones climÃ¡ticas extremas.
Respetar siempre las recomendaciones del fabricante para asegurar la
durabilidad y la garantÃ­a del producto.
GUÃA DE INSTALACIÃ“N
Herramienta: Taladro, broca para metal o madera, tornillos
autoperforantes con arandela de neopreno, cinta mÃ©trica,
tijera para lÃ¡mina plÃ¡stica o herramienta de disco fino,
guantes y gafas de seguridad.

--- PRODUCT DATA: 26.4_FT_Teja Termoacustica UPVC 2.5mm COLONIAL.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
26.4
Teja PVC Terracota Colonial 11,80*1.05 de 2,5mm
USOS Y APLICACIONES
Panel termoacÃºstico en UPVC con perfil tipo teja colonial, ideal para
edificaciones que buscan un diseÃ±o clÃ¡sico y aislamiento eficiente. Su
estructura multicapa reduce significativamente el ruido de impacto y la
temperatura interior.
Casas campestres y rurales
Centros recreativos
Cubiertas decorativas en climas cÃ¡lidos
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
Teja PVC Terracota Colonial 11,80*1.05 de 2,5mm
11,80m - 1,05m (Ancho Ãºtil 98cm)
5 Kilogramos
Unidad
2.5 mm
Aproximadamente 1,40 g/cm3
UPVC (Cloruro de Polivinilo no Plastificado)
China
2.5MM
COLORES DISPONIBLES
1.PreparaciÃ³n de la superficie: Instale una estructura de soporte metÃ¡lica o de
madera, limpia, firme y nivelada. Verifique la correcta alineaciÃ³n y respete la
separaciÃ³n de correas segÃºn especificaciÃ³n tÃ©cnica, garantizando una
pendiente adecuada para la evacuaciÃ³n del agua.
2.Corte: Marque las medidas requeridas sobre la lÃ¡mina. Realice los cortes
utilizando tijera para lÃ¡mina plÃ¡stica o herramienta de disco fino, evitando
generar rebabas o deformaciones en el material.
3.ColocaciÃ³n: Coloque las lÃ¡minas en sentido contrario a la direcciÃ³n del viento
dominante, iniciando desde el alero hacia la cumbrera. Asegure el correcto
traslape lateral y longitudinal para evitar filtraciones.
4.SujeciÃ³n: Fije las lÃ¡minas perforando previamente en la cresta de la teja. Utilice
tornillos autoperforantes con arandela de neopreno, sin sobreapretar,
permitiendo la dilataciÃ³n tÃ©rmica natural del UPVC.
5.Acabados: Instale remates, cumbreras y accesorios compatibles. Revise sellos y
puntos de uniÃ³n para garantizar estanqueidad y continuidad estÃ©tica.
6.Mantenimiento: Limpie periÃ³dicamente con agua y jabÃ³n neutro. Evite el uso
de productos quÃ­micos abrasivos. Inspeccione anualmente la fijaciÃ³n y el estado
general de la cubierta.
Recomendaciones importantes:
No caminar directamente sobre la lÃ¡mina sin apoyo estructural.
Evitar instalaciones en condiciones climÃ¡ticas extremas.
Respetar siempre las recomendaciones del fabricante para asegurar la
durabilidad y la garantÃ­a del producto.
GUÃA DE INSTALACIÃ“N
Herramienta: Taladro, broca para metal o madera, tornillos
autoperforantes con arandela de neopreno, cinta mÃ©trica,
tijera para lÃ¡mina plÃ¡stica o herramienta de disco fino,
guantes y gafas de seguridad.

--- PRODUCT DATA: 26.5_FT_Teja UPVC Tipo Zinc.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
26.5
Teja UPVC Tipo Zinc
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
La Teja UPVC Tipo Zinc es una soluciÃ³n innovadora y funcional para
cubiertas, diseÃ±ada para brindar protecciÃ³n, durabilidad y estÃ©tica. Su
fabricaciÃ³n en cloruro de polivinilo no plastificado (UPVC) la hace
altamente resistente a la intemperie, corrosiÃ³n y agentes quÃ­micos,
garantizando una larga vida Ãºtil. Gracias a su diseÃ±o y composiciÃ³n,
ofrece aislamiento tÃ©rmico y acÃºstico, ademÃ¡s de ser impermeable y
liviana, lo que facilita su instalaciÃ³n y manipulaciÃ³n.
Residencial: Uso en cubiertas de salas de estar, dormitorios,
terrazas y patios.
Industrial y Comercial: Ideal para bodegas, almacenes,
fÃ¡bricas y proyectos arquitectÃ³nicos modernos.
Espacios PÃºblicos: Aplicable en invernaderos, establos y
refugios para ganado, protegiendo de la lluvia y el calor.
1.MediciÃ³n y planificaciÃ³n: Determina el Ã¡rea donde se
instalarÃ¡n las tejas y calcula la cantidad necesaria.
2.Corte y preparaciÃ³n: Usa una cortadora para ajustar las
tejas segÃºn las dimensiones requeridas.
3.ColocaciÃ³n: SuperpÃ³n las tejas al menos 10 cm entre cada
una para garantizar una adecuada impermeabilidad.
4.PerforaciÃ³n: Realiza perforaciones con un taladro en los
puntos de fijaciÃ³n. Es recomendable perforar en la parte alta
de las ondas para evitar filtraciones.
5.FijaciÃ³n: Usa tornillos auto perforantes con arandelas de
neopreno para asegurar las tejas sin afectar su dilataciÃ³n
tÃ©rmica.
6.RevisiÃ³n: AsegÃºrate de que todas las uniones estÃ©n bien
ajustadas y no haya espacios abiertos que puedan generar
filtraciones o afectar la estabilidad de la estructura.
Herramienta: FlexÃ³metro, cortadora, taladro, destornillador.
Peso:
Espesor:
Formato:
Embalaje:
Colores disponibles
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
Teja UPVC Tipo Zinc
305 cm x 93 cm
1.76 kg/mÂ²
Unidad
0.8 mm
Blanca, Verde, Azul
UPVC (Cloruro de Polivinilo no Plastificado)
China
0.8MM
COLORES DISPONIBLES

--- PRODUCT DATA: 26.6_FT_Cubierta Acanalada UPV Blanca.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
26.6
Cubierta Acanalada UPV Blanca
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
La Cubierta Acanalada UPVC Blanca es una soluciÃ³n arquitectÃ³nica
para cubiertas y techos, fabricada en PVC alveolar de alta resistencia,
diseÃ±ada para ofrecer excelente aislamiento tÃ©rmico y acÃºstico, alta
durabilidad y resistencia a condiciones ambientales exigentes.
 Su diseÃ±o acanalado proporciona rigidez estructural, Ã³ptima evacuaciÃ³n
del agua y un acabado moderno y funcional, ideal para proyectos
residenciales, comerciales e industriales.
Cubiertas y techos
Bodegas y naves industriales
Terrazas y pÃ©rgolas
Ãreas comerciales y residenciales
Estacionamientos y cubiertas livianas
1.PreparaciÃ³n de la estructura: Instalar sobre estructura metÃ¡lica o de
madera firme, alineada y nivelada. Respetar una distancia mÃ¡xima entre
correas de 1,20 m. Verificar pendiente mÃ­nima para correcta evacuaciÃ³n
del agua.
2.Corte de la lÃ¡mina: Medir y marcar la longitud requerida. Cortar con sierra
manual o elÃ©ctrica de dientes finos. Retirar residuos del corte antes de la
instalaciÃ³n.
3.ColocaciÃ³n de la teja: Instalar las lÃ¡minas en el sentido de la pendiente,
comenzando desde el alero hacia la cumbrera. Superponer las lÃ¡minas
respetando el ancho efectivo (830 mm). Asegurar correcta alineaciÃ³n entre
ondas para evitar filtraciones.
4.FijaciÃ³n: Perforar previamente la lÃ¡mina en la cresta de la onda. Utilizar
tornillos con arandela y sello de neopreno para evitar filtraciones. No
sobreapretar los tornillos; permitir la dilataciÃ³n tÃ©rmica del material.
5.Accesorios y remates: Instalar cumbreras, remates laterales y accesorios
recomendados para cubiertas UPVC. Utilizar el Accesorio Cubierta
Acanalada UPVC â€“ REF: 14082315 para una correcta fijaciÃ³n y sellado.
6.RevisiÃ³n final: Verificar alineaciÃ³n, fijaciones y sellos. Asegurar que no
existan tensiones en las lÃ¡minas.
7.Mantenimiento: Limpieza periÃ³dica con agua y jabÃ³n neutro. No usar
productos abrasivos, solventes ni elementos cortantes.
Herramienta: Taladro elÃ©ctrico, broca para PVC, tornillos
autorroscantes con arandela y sello de neopreno, cinta
mÃ©trica, nivel, sierra manual o elÃ©ctrica, guantes y gafas de
seguridad.
Peso:
Espesor:
Formato:
Embalaje:
Aislamiento acÃºstico
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
Teja UPVC Tipo Zinc
5,5 â€“ 6,0 kg por mÂ² (estimado)
Unidad
10 mm
35 dB
UPVC (Cloruro de Polivinilo no Plastificado)
China
10MM
885mm (Ancho Ãºtil 883mm) / Altura de onda 40mm

--- PRODUCT DATA: 27_FT_Adhesivo de Montaje PEGATEC.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
27
Adhesivo de Montaje PEGATEC
Adhesivo profesional de alto rendimiento formulado para aplicaciones
interiores, diseÃ±ado para ofrecer una fuerte adherencia en mÃºltiples
sustratos. Su fÃ³rmula especial permite un desempeÃ±o Ã³ptimo frente a
cambios de temperatura y condiciones de humedad, con propiedades
antihongos que prolongan la vida Ãºtil de las uniones. Ideal para trabajos
de instalaciÃ³n, fijaciÃ³n y reparaciÃ³n en proyectos de construcciÃ³n,
carpinterÃ­a y bricolaje.
Peso:
Presentaciones:
Formato:
Embalaje:
Densidad:
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
Adhesivo de Montaje PEGATEC
0,5 Kilogramos
Unidad
Pegatec Blanco â€“ 395 ml  /  Pegatec Transparente â€“ 300 ml 
-
Poliuretano
China
22 cm x 4 cm
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
InstalaciÃ³n de molduras y zÃ³calos.
FijaciÃ³n de paneles decorativos y revestimientos.
Sellado y uniÃ³n en carpinterÃ­a interior.
Reparaciones rÃ¡pidas en superficies de madera, PVC,
cerÃ¡mica y metal.
1.PreparaciÃ³n de la superficie:  Limpie y seque las superficies.
Elimine polvo, grasa y partÃ­culas sueltas para asegurar una
correcta adherencia.
2.Cortes: Corte la boquilla del cartucho en un Ã¡ngulo de 45Â° al
diÃ¡metro de cordÃ³n deseado. Coloque el cartucho en la pistola
aplicadora.
3.FijaciÃ³n: Aplique el adhesivo en cordones o puntos uniformes
sobre la superficie. Presione firmemente las piezas a unir antes
de que forme piel.
4.Acabados: Retire el exceso de adhesivo con una espÃ¡tula o
paÃ±o hÃºmedo. Ajuste las piezas alineÃ¡ndolas correctamente.
5.Mantenimiento: Una vez curado, el adhesivo no requiere
mantenimiento. Para limpieza, utilice disolvente adecuado
antes del secado completo.

--- PRODUCT DATA: 28.1_FT_IluminaciÃ³n Perfil Led.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
28.1
IluminaciÃ³n Perfil Led
Barra de iluminaciÃ³n LED rÃ­gida de doble fila, luz blanco cÃ¡lido, diseÃ±ada
para instalaciÃ³n en paneles WPC de interior. Proporciona una
iluminaciÃ³n uniforme y decorativa con bajo consumo energÃ©tico.
Peso:
Espesor:
Presentaciones: 
Embalaje:
Densidad:
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
IluminaciÃ³n Perfil Led
0,5 Kilogramos
Unidad
1,5 cm
-
LED
China
Barra Led 1: 50 cm x 1,5 cm / Barra Led 2: 70 cm x 1,5 cm / Barra Led 3: 120 cm x 1,5 cm
USOS Y APLICACIONES
IluminaciÃ³n decorativa para interiores
IntegraciÃ³n en paneles WPC o muebles
Resaltado de elementos arquitectÃ³nicos
GUÃA DE INSTALACIÃ“N
1.PreparaciÃ³n de la superficie: AsegÃºrese de que el panel WPC
o superficie estÃ© limpia, seca y nivelada para la instalaciÃ³n de
los perfiles LED. 
2.Cortes: Mida y marque las posiciones de instalaciÃ³n. Si es
necesario, corte el perfil LED con herramienta adecuada para
aluminio.
3.FijaciÃ³n: Monte el perfil en la superficie usando clips o
tornillos. Conecte el cableado al transformador respetando la
polaridad.
4.Acabados: Instale el difusor de policarbonato. AsegÃºrese de
que no haya cables sueltos.
5.Mantenimiento: Limpie con paÃ±o seco o ligeramente hÃºmedo.
No use solventes. Verifique conexiones periÃ³dicamente.
Herramienta: Taladro, destornillador, cinta mÃ©trica, cutter,
guantes de seguridad.io.

--- PRODUCT DATA: 28.2_FT_IluminaciÃ³n Transformador Perfil Led.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
28.2
IluminaciÃ³n Transformador Perfil Led
Fuente de alimentaciÃ³n para perfiles LED, convierte corriente alterna a
corriente continua estabilizada para un funcionamiento seguro y
eficiente de las tiras o barras LED.
Peso:
Espesor:
Embalaje:
Espesor Tipo XL:
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
IluminaciÃ³n Transformador Perfil Led
0,3 Kilogramos
Unidad
1,5 cm
3,5 mm
China
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
AlimentaciÃ³n de perfiles LED
IluminaciÃ³n arquitectÃ³nica
Proyectos residenciales y comerciales
1.PreparaciÃ³n de la superficie: AsegÃºrese de que el panel WPC
o superficie estÃ© limpia, seca y nivelada para la instalaciÃ³n de
los perfiles LED. 
2.Cortes: Mida y marque las posiciones de instalaciÃ³n. Si es
necesario, corte el perfil LED con herramienta adecuada para
aluminio.
3.FijaciÃ³n: Monte el perfil en la superficie usando clips o
tornillos. Conecte el cableado al transformador respetando la
polaridad.
4.Acabados: Instale el difusor de policarbonato. AsegÃºrese de
que no haya cables sueltos.
5.Mantenimiento: Limpie con paÃ±o seco o ligeramente hÃºmedo.
No use solventes. Verifique conexiones periÃ³dicamente.
Herramienta: Taladro, destornillador, cinta mÃ©trica, cutter,
guantes de seguridad.io.
PresentaciÃ³n:
24V (voltios) - 60W (vatios) /  3,5 cm x 5,8 cm
Carcasa metÃ¡lica / Componentes electrÃ³nicos internos

--- PRODUCT DATA: 28.3_FT_IluminaciÃ³n Control Led.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
28.3
Control remoto tÃ¡ctil por radiofrecuencia para perfiles LED, permite
regular intensidad (Dimerizar - reducir o aumentar la intensidad de la
luz), encendido/apagado y efectos de iluminaciÃ³n.
Peso:
Espesor:
Embalaje:
Densidad:
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
IluminaciÃ³n Control Led
0,2 Kilogramos
Unidad
2 cm
-
Carcasa metÃ¡lica / Componentes electrÃ³nicos internos
China
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
Control de perfiles LED en interiores
Ajuste 
de 
iluminaciÃ³n 
en 
proyectos 
residenciales 
y
comerciales
IntegraciÃ³n en sistemas decorativos
1.PreparaciÃ³n: Verifique que la superficie estÃ© limpia, seca y
nivelada antes de la instalaciÃ³n.
2.MediciÃ³n y corte: Mida el Ã¡rea de instalaciÃ³n y realice los
cortes necesarios del perfil LED o accesorios segÃºn el diseÃ±o.
3.FijaciÃ³n: Instale el perfil LED sobre la superficie utilizando clips,
tornillos o adhesivo recomendado.
4.ConexiÃ³n elÃ©ctrica: Conecte el perfil LED al transformador y al
control LED, respetando polaridad y especificaciones elÃ©ctricas.
5.Prueba y acabado:  Verifique el correcto funcionamiento,
instale el difusor y asegure que no queden cables sueltos.
6.Mantenimiento: Limpie con paÃ±o seco o ligeramente hÃºmedo.
No use productos abrasivos.
PresentaciÃ³n:
12 cm x 5 cm
IluminaciÃ³n Control Led

--- PRODUCT DATA: 29.1_FT_Jardin Artificial Exterior.pdf ---
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
JardÃ­n Artificial Exterior
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
29.1
El JardÃ­n Artificial de Exterior estÃ¡ diseÃ±ado para revestir fachadas,
muros y superficies verticales, ofreciendo una apariencia natural con alta
resistencia a la intemperie, rayos UV y humedad. Es una soluciÃ³n
decorativa duradera, funcional y de bajo mantenimiento, ideal para
proyectos residenciales, comerciales y urbanos que buscan integrar
vegetaciÃ³n sin requerir riego, poda o cuidados constantes.
Disponible en 4 modelos: Pradera, EdÃ©n, ParaÃ­so y Primavera.
USOS Y APLICACIONES
Residencial: Terrazas, balcones, muros decorativos exteriores.
Comercial: Fachadas, restaurantes, hoteles, locales
comerciales
Espacios pÃºblicos: Parques, Ã¡reas de juego, proyectos verdes
urbanos
DecoraciÃ³n de eventos: Stands, exhibiciones y
ambientaciones exteriores
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
JardÃ­n Artificial Exterior
50 Ã— 50 cm
0,7 kg
Unidad suelta o caja x 30
1 mm
Aproximadamente 5 kg/mÂ²
PVC (Policloruro de Vinilo)
China
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
GUÃA DE INSTALACIÃ“N
1.PreparaciÃ³n de la superficie: Debe estar limpia, seca y libre
de polvo, material biÃ³tico y humedad. Se recomienda pintar
con vinilo hidrÃ³fugo verde para mejor cubrimiento.
2.Cortes: Optimice los cortes segÃºn el Ã¡rea, teniendo en
cuenta el formato estÃ¡ndar del producto.
3.SujeciÃ³n: Fije el panel del jardÃ­n artificial con chazo y tornillo
en los ojales de cada pieza. TambiÃ©n, si lo deseas, el panel
puede ser pegado a la pared con nuestro adhesivo de
montaje PEGATEC. Ensamble los paneles entre sÃ­ hasta cubrir
la superficie deseada.
4.Acabados: Siga las recomendaciones del fabricante y utilice
accesorios si es necesario.
5.Mantenimiento: Limpieza ocasional con agua y jabÃ³n neutro
para retirar polvo acumulado.
Herramienta: FlexÃ³metro, bisturÃ­, regla de aluminio, guantes.

--- PRODUCT DATA: 29.2_FT_JardÃ­n Artificial Interior.pdf ---
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
JardÃ­n Artificial Interior
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
29.2
El JardÃ­n Artificial de Interior estÃ¡ diseÃ±ado para imitar la apariencia de
la vegetaciÃ³n natural, transformando muros y superficies verticales en
espacios verdes de alto impacto visual. Proporciona una soluciÃ³n
decorativa, duradera y libre de mantenimiento, ideal para interiores que
buscan una sensaciÃ³n de frescura, conexiÃ³n natural y diseÃ±o
contemporÃ¡neo sin requerir riego ni poda.
Disponible en 3 modelos: Natural, Venecia y ParÃ­s. 
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
Residencial: Salas de estar, dormitorios
Comercial: Oficinas, restaurantes, hoteles, espacios
comerciales
DecoraciÃ³n de eventos: Bodas, fiestas, exhibiciones
Espacios pÃºblicos: Parques, Ã¡reas de juego, proyectos verdes
urbanos
1.PreparaciÃ³n de la superficie: Debe estar limpia, seca y libre
de polvo, material biÃ³tico y humedad. Se recomienda pintar
con vinilo hidrÃ³fugo verde para mejor cubrimiento.
2.Cortes: Optimice los cortes segÃºn el Ã¡rea, teniendo en
cuenta el formato estÃ¡ndar del producto.
3.SujeciÃ³n: Fije el panel del jardÃ­n artificial con chazo y tornillo
en los ojales de cada pieza. TambiÃ©n, si lo deseas, el panel
puede ser pegado a la pared con nuestro adhesivo de
montaje PEGATEC. Ensamble los paneles entre sÃ­ hasta cubrir
la superficie deseada.
4.Acabados: Siga las recomendaciones del fabricante y utilice
accesorios si es necesario.
5.Mantenimiento: Limpieza ocasional con agua y jabÃ³n neutro
para retirar polvo acumulado.
Peso:
Espesor:
Formato:
Embalaje:
Densidad:
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
JardÃ­n Artificial Interior
60 Ã— 40 cm
0,7 kg
Unidad suelta o caja x 30
1 mm
Aproximadamente 5 kg/mÂ²
PVC (Policloruro de Vinilo)
China
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
Herramienta: FlexÃ³metro, bisturÃ­, regla de aluminio, guantes.

--- PRODUCT DATA: 29.3_FT_JardÃ­n Artificial Linea Moss.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
JardÃ­n Artificial lÃ­nea Moss
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
29.3
La LÃ­nea MOSS de jardines artificiales ofrece una estÃ©tica orgÃ¡nica y
contemporÃ¡nea que transforma muros y superficies verticales en
espacios verdes suaves y envolventes, sin necesidad de riego ni poda.
Fabricados en PVC de alta calidad, estos paneles estÃ¡n diseÃ±ados para
uso interior y exterior protegido, con alta resistencia a la humedad, al
desgaste y a condiciones ambientales variables, conservando su color y
textura a lo largo del tiempo.
 Es una soluciÃ³n decorativa prÃ¡ctica, versÃ¡til y sostenible que combina
estÃ©tica natural y funcionalidad arquitectÃ³nica.
Disponible en 2 modelos: Mini-Mossy y Mossy Pino CiprÃ©s
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
Residencial: Salas de estar, dormitorios, muros decorativos.
Comercial: Oficinas, restaurantes, hoteles, locales comerciales
DecoraciÃ³n de eventos: Bodas, fiestas, exhibiciones
DiseÃ±os arquitectÃ³nicos: Proyectos interiores y exteriores
protegidos
1.PreparaciÃ³n de la superficie: Debe estar limpia, seca y libre
de polvo, material biÃ³tico y humedad. Se recomienda pintar
con vinilo hidrÃ³fugo verde para mejor cubrimiento.
2.Cortes: Optimice los cortes segÃºn el Ã¡rea, teniendo en
cuenta el formato estÃ¡ndar del producto.
3.SujeciÃ³n: Fije el panel del jardÃ­n artificial con chazo y tornillo
en los ojales de cada pieza. TambiÃ©n, si lo deseas, el panel
puede ser pegado a la pared con nuestro adhesivo de
montaje PEGATEC. Ensamble los paneles entre sÃ­ hasta cubrir
la superficie deseada.
4.Acabados: Siga las recomendaciones del fabricante y utilice
accesorios si es necesario.
5.Mantenimiento: Limpieza ocasional con agua y jabÃ³n neutro
para retirar polvo acumulado.
Peso:
Espesor:
Formato:
Embalaje:
Tipo de follaje:
PaÃ­s de Origen:
Material Principal:
Nombre del Producto:
JardÃ­n Artificial  lÃ­nea Moss 
50 Ã— 50 cm
0,7 kg
Unidad suelta o caja x 30
Mini-Mossy 2,5 cm /  Mossy Pino CiprÃ©s 3 cm
Mini-Mossy ( Fino, estilo musgo) 
Mossy Pino CiprÃ©s (Ramas de ciprÃ©s o pino con follaje tupido)
PVC (Policloruro de Vinilo)
China
Herramienta: FlexÃ³metro, bisturÃ­, regla de aluminio, guantes.

--- PRODUCT DATA: 30.1_FT_Aluminio_Ferretero.pdf ---
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
Aluminio Ferretero
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
30.1
El Aluminio Ferretero estÃ¡ diseÃ±ado para aplicaciones generales en
carpinterÃ­a metÃ¡lica, cerramientos, divisiones, cortinerÃ­a, cielos rasos y
soluciones arquitectÃ³nicas livianas. Se caracteriza por su resistencia,
ligereza, durabilidad y versatilidad, siendo ideal tanto para proyectos
residenciales como comerciales, garantizando resistencia a la corrosiÃ³n y
facilidad de mantenimiento.
Material
Aluminio extruido de alta calidad
Acabados: crudo, blanco, dorado, bronce y anodizados decorativos
USOS Y APLICACIONES
Divisiones interiores
Cielos rasos
CortinerÃ­a
Marcos livianos
Cerramientos
Estructuras decorativas
Proyectos comerciales y residenciales
CARACTERÃSTICAS TÃ‰CNICAS
Material liviano y resistente
Alta durabilidad
Resistente a la corrosiÃ³n
FÃ¡cil manipulaciÃ³n e instalaciÃ³n
No requiere mantenimiento constante
Apto para interior y exterior (segÃºn referencia)
Compatible con accesorios ferreteros estÃ¡ndar
PERFILES DISPONIBLES
Tubulares y estructurales
Codal tubular rectangular 3â€ x 1Â½â€
Codal tubular rectangular 3â€ x 1â€
Tubulares cuadrados y rectangulares
Ãngulos
Ãngulo crudo 17 mm x 17 mm
Ãngulo blanco 17 mm x 17 mm
Cortineros
Tubo cortinero 111 â€“ 1â€
Tubo cortinero 112 â€“ Â¾â€
Tubo cortinero 113 â€“ Â½â€
Disponibles en dorado y bronce
Perfiles especiales
Pirlan 390
Piragua WIN 0382
Win espaÃ±ol
DIMENSIONES
Medidas variables segÃºn perfil
Longitudes comerciales estÃ¡ndar
SecciÃ³n y espesor segÃºn referencia tÃ©cnica
ACABADOS
Crudo
Blanco
Dorado
Bronce
Anodizado decorativo
VENTAJAS DEL PRODUCTO
Excelente relaciÃ³n pesoâ€“resistencia
Versatilidad para mÃºltiples aplicaciones
EstÃ©tica moderna y limpia
FÃ¡cil integraciÃ³n con otros sistemas Unitec
Amplia disponibilidad de referencias

--- PRODUCT DATA: 30.2_FT_Perfileria Aluminio ArquitÃ©ctonico.pdf ---
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
PerfilerÃ­a Aluminio ArquitÃ©ctonico
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
30.2
La perfilerÃ­a de aluminio arquitectÃ³nico estÃ¡ desarrollada para
sistemas comerciales y residenciales de puertas, ventanas, fachadas,
divisiones y cerramientos, ofreciendo alta precisiÃ³n dimensional,
resistencia estructural y excelente acabado estÃ©tico.
Fabricada en aluminio de alta calidad, permite soluciones livianas y
pesadas, adaptÃ¡ndose a mÃºltiples requerimientos arquitectÃ³nicos y de
diseÃ±o.
USOS Y APLICACIONES
Ventanas y puertas corredizas
Puertas abatibles
Fachadas comerciales
Vidrieras monumentales
Cabinas de baÃ±o
Pasamanos y barandas
Sistemas de ventilaciÃ³n
Enchapes decorativos
Divisiones arquitectÃ³nicas
SISTEMAS DISPONIBLES
Sistema 5020 â€“ Ventanas y puertas corredizas
Sistema 8025 â€“ Ventanas y puertas corredizas reforzadas
Sistema 7038 â€“ Vidriera monumental
Sistema 3831 â€“ Liviano y pesado
Sistema 744 â€“ Marcos y refuerzos especiales
Tubulares estructurales
ZÃ³calos
Sistema de ventilaciÃ³n
Enchapes
AlfajÃ­as
Pasamanos
Cabinas de baÃ±o
Canales
Ãngulos y platinas
RetÃ­culas
Pisa vidrios
(Ver planos tÃ©cnicos y secciones por referencia en el
catÃ¡logo)
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
AplicaciÃ³n:
Espesores:
Tipo de uso:
Formato: 
Acabados: 
PaÃ­s de Origen:
Compatibilidad: 
Nombre del Producto:
PerfilerÃ­a Aluminio ArquitectÃ³nico
Interior y exterior
Puertas, ventanas, fachadas, divisiones, barandas, cabinas de baÃ±o
Perfiles extruidos
SegÃºn sistema y referencia
Vidrios simples, laminados y templados
China
Natural / anodizado / pintado (segÃºn disponibilidad)

--- PRODUCT DATA: 31_FT_Platinas_MetÃ¡licas.pdf ---
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
Material:
Uso:
Formato:
Embalaje:
Colores disponibles
PaÃ­s de Origen:
Peso unitario:
Las Platinas MetÃ¡licas son clips de fijaciÃ³n fabricados en acero inoxidable,
diseÃ±ados para asegurar paneles decorativos de WPC (Wood Plastic
Composite) o PVC a superficies como paredes y techos.
 Su diseÃ±o delgado y discreto permite una instalaciÃ³n oculta, evitando
que tornillos o uniones queden visibles en la superficie del panel.
Son ideales para lograr un acabado limpio, moderno y firme,
permitiendo ademÃ¡s la remociÃ³n de paneles para mantenimiento o
ajuste cuando sea necesario.
Platinas MetÃ¡licas
Platinas MetÃ¡licas / Clips de FijaciÃ³n
4 cm (alto) x 3 cm (ancho)
Acero inoxidable
Unidad
FijaciÃ³n de paneles WPC o PVC
MetÃ¡lico
Ligero
China
InstalaciÃ³n de paneles WPC interiores o exteriores.
InstalaciÃ³n de paneles de PVC tipo muro o revestimiento.
FijaciÃ³n en paredes y techos con sistema de ranura/encaje.
Proyectos residenciales, comerciales y arquitectÃ³nicos.
Instalaciones que requieren un sistema de sujeciÃ³n oculto y
estÃ©tico.
1.Ubique la lengÃ¼eta corta del panel donde se insertarÃ¡ la
platina.
2.Inserte el clip de forma que encaje firmemente en la ranura.
3.Atornille la platina a la superficie o estructura de soporte
(madera, metal o muro).
4.Encaje el siguiente panel sobre la platina previamente
fijada.
5.Repita el proceso hasta completar el Ã¡rea deseada.
6.Confirme alineaciÃ³n y estabilidad final del revestimiento.
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
31
Nota: Los clips quedan completamente ocultos una vez
instalados, conservando un acabado limpio y profesional.
Nombre del Producto:
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o

--- PRODUCT DATA: 32_FT_Perfil Base Metalico Negro.pdf ---
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
Ancho base perforada
Material:
Formato:
Embalaje:
Colores disponibles
PaÃ­s de Origen:
Peso unitario:
El Perfil Base MetÃ¡lico Negro es un componente estructural diseÃ±ado
para la instalaciÃ³n de listones decorativos en cielo raso.
Su diseÃ±o perforado y su resistencia permiten un montaje firme, alineado
y 
eficiente, 
garantizando 
estabilidad 
y 
estÃ©tica 
en 
proyectos
residenciales, comerciales y arquitectÃ³nicos.
Este perfil funciona como soporte principal donde se insertan o aseguran
los listones, facilitando instalaciones rÃ¡pidas, limpias y con alto nivel de
precisiÃ³n.
Perfil Base MetÃ¡lico Negro Liston Cielo Raso
Perfil Base MetÃ¡lico Negro â€“ ListÃ³n Cielo Raso
2,90 metros
Aproximadamente 10 cm entre perforaciones
Unidad
Metal galvanizado con acabado negro
Negro
Ligero
China
InstalaciÃ³n de listones para cielo raso (PVC, WPC u otros
sistemas compatibles).
Proyectos arquitectÃ³nicos que requieren estructuras de
soporte ocultas.
Cielos rasos decorativos en: viviendas, locales comerciales,
oficinas, salas de exhibiciÃ³n, restaurantes y hoteles.
1.Delimitar el Ã¡rea del cielo raso donde se instalarÃ¡n los
listones.
2.Fijar el Perfil Base MetÃ¡lico Negro directamente a la
estructura o superficie del techo.
3.Asegurar usando tornillerÃ­a adecuada para metal o concreto.
4.Insertar o atornillar los listones decorativos al perfil base.
5.Repetir el proceso manteniendo la alineaciÃ³n y nivelaciÃ³n
del diseÃ±o.
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
32
BENEFICIOS PRINCIPALES
Alta 
resistencia 
gracias 
a 
su 
fabricaciÃ³n 
en 
metal
galvanizado.
FÃ¡cil instalaciÃ³n gracias a su diseÃ±o perforado para fijaciÃ³n
rÃ¡pida.
EstÃ©tica limpia, ya que queda oculto detrÃ¡s de los listones.
Gran durabilidad, resistente a deformaciones y corrosiÃ³n.
Compatible con diferentes tipos de listones para cielo raso.
Ideal 
para 
proyectos 
arquitectÃ³nicos 
modernos 
que
requieren lÃ­neas homogÃ©neas y perfectas.
Nombre del Producto:
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o

--- PRODUCT DATA: 33_FT_Cinta Adhesiva Papel.pdf ---
FICHA TÃ‰CNICA
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
PaÃ­s de Origen:
Peso unitario:
Las 
Cintas 
Adhesivas 
para 
MÃ¡rmol 
han 
sido 
desarrolladas
especÃ­ficamente para aplicaciones decorativas y de protecciÃ³n sobre
superficies de mÃ¡rmol, donde la precisiÃ³n, la estÃ©tica y el cuidado del
material son fundamentales. Su formulaciÃ³n permite una adhesiÃ³n
controlada que garantiza una fijaciÃ³n segura sin generar residuos ni
afectar el acabado natural de la piedra, preservando su brillo, textura y
valor estÃ©tico.
Gracias a su fÃ¡cil aplicaciÃ³n y manipulaciÃ³n, estas cintas permiten un
control exacto durante el proceso de instalaciÃ³n, asegurando bordes
definidos y un acabado limpio. 
Cinta Adhesiva de Papel
Cinta Adhesiva de Papel
1 cm (ancho)  x 50 metros (largo)
Dorada y Plateada
Unidad
Papel Autoadhesivo
Una soluciÃ³n prÃ¡ctica y estÃ©tica que eleva el diseÃ±o del mÃ¡rmol
Ligero
China
Remates decorativos sobre mÃ¡rmol
DelimitaciÃ³n de lÃ­neas y detalles estÃ©ticos
ProtecciÃ³n de bordes durante acabados
DiseÃ±o de trazos largos y continuos
Proyectos residenciales y comerciales
Instalar sobre superficies limpias y secas. Aplicar ejerciendo
presiÃ³n uniforme para garantizar una correcta adherencia.
Retirar 
cuidadosamente 
una 
vez 
finalizado 
el 
proceso
decorativo o de protecciÃ³n.
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
33
BENEFICIOS PRINCIPALES
No daÃ±a ni maltrata la superficie del mÃ¡rmol
Acabado limpio, uniforme y elegante
FÃ¡cil aplicaciÃ³n y manipulaciÃ³n
Alta precisiÃ³n en lÃ­neas decorativas
Ideal para trabajos extensos y detallados
CARACTERÃSTICAS TÃ‰CNICAS
AdhesiÃ³n controlada, segura para superficies delicadas
Material flexible que se adapta a trazos rectos y continuos
DiseÃ±o pensado para acabados modernos y sofisticados
Permite una instalaciÃ³n rÃ¡pida y eficiente
Nombre del Producto:
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o

--- PRODUCT DATA: 34_FT_Cinta Adhesiva Metalica.pdf ---
FICHA TÃ‰CNICA
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
PaÃ­s de Origen:
Peso unitario:
La Cinta Adhesiva MetÃ¡lica ha sido desarrollada especialmente para
aplicaciones decorativas y de acabado, ofreciendo un aspecto moderno,
elegante y sofisticado. Su superficie metÃ¡lica proporciona un efecto
visual de alto impacto, ideal para realzar espacios interiores en proyectos
residenciales y comerciales.
Gracias a su adhesiÃ³n firme y controlada, esta cinta permite una
instalaciÃ³n precisa, logrando lÃ­neas definidas y acabados limpios sin
daÃ±ar la superficie. Es una soluciÃ³n prÃ¡ctica para quienes buscan detalles
decorativos con apariencia metÃ¡lica y alta durabilidad.
Cinta Adhesiva Metalica
Cinta Adhesiva MetÃ¡lica
3 cm (ancho) x 5 metros (largo)
Dorada, Plateada, Negra, Palo de Rosa 
Unidad
PelÃ­cula decorativa con acabado metÃ¡lico y adhesivo posterior
Uso decorativo y de protecciÃ³n en superficies lisas
Ligero
China
Remates decorativos en muros y paredes
DelimitaciÃ³n de lÃ­neas y detalles estÃ©ticos
DecoraciÃ³n de mobiliario y superficies lisas
Acabados en proyectos residenciales y comerciales
Realce de diseÃ±os modernos y minimalistas
Instalar sobre superficies limpias, secas y lisas. Aplicar
ejerciendo presiÃ³n uniforme para asegurar una correcta
adherencia. Para mejores resultados, evitar superficies rugosas o
con humedad. Retirar cuidadosamente una vez finalizado el
proceso decorativo si se requiere.
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
34
BENEFICIOS PRINCIPALES
Acabado metÃ¡lico elegante y moderno
FÃ¡cil aplicaciÃ³n sin necesidad de herramientas especiales
Alta precisiÃ³n en lÃ­neas decorativas
AdhesiÃ³n segura y uniforme
Ideal para proyectos decorativos rÃ¡pidos y limpios
CARACTERÃSTICAS TÃ‰CNICAS
AdhesiÃ³n controlada para una instalaciÃ³n precisa
Superficie flexible que se adapta a trazos rectos y continuos
DiseÃ±o pensado para acabados modernos y sofisticados
Permite una instalaciÃ³n rÃ¡pida y eficiente
No genera residuos visibles al ser retirada correctamente
Nombre del Producto:
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o

--- PRODUCT DATA: 35.1_FT_Fachada PVC Exterior .pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
Colores disponibles:
Formato:
PaÃ­s de Origen:
La Fachada PVC Exterior es un sistema de revestimiento arquitectÃ³nico
diseÃ±ado para uso en exteriores, fabricado en PVC expandido de alta
resistencia. Ofrece una soluciÃ³n estÃ©tica, moderna y duradera para
fachadas, muros y superficies verticales, soportando condiciones
climÃ¡ticas exigentes como humedad, rayos UV y cambios de
temperatura.
Su diseÃ±o modular permite una instalaciÃ³n eficiente, logrando acabados
uniformes y de alto impacto visual en proyectos residenciales,
comerciales e institucionales.
Fachada PVC Exterior 
Fachada PVC Exterior
Panel modular: 29cm ancho x 1,15m largo
Pizarra Mix,  Cantera Mix,  Ã“palo Blanco, Arenisca Beige
*
China
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
35.1
Nombre del Producto:
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
Revestimiento de fachadas exteriores
Muros perimetrales y decorativos
Proyectos residenciales y comerciales
Fachadas arquitectÃ³nicas modernas
RenovaciÃ³n y embellecimiento de exteriores
1.Verifique que la superficie estÃ© limpia, seca y nivelada.
2.Realice los cortes necesarios utilizando pulidora con disco
diamantado continuo.
3.Inicie la instalaciÃ³n desde la parte inferior hacia arriba (de
piso a techo).
4.Aplique adhesivo de montaje de secado rÃ¡pido en los
bordes guÃ­a del respaldo del panel.
5.Encaje cada pieza gracias a su geometrÃ­a hasta cubrir el Ã¡rea
deseada.
6.Presione firmemente para asegurar una correcta fijaciÃ³n y
alineaciÃ³n.
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
ProtecciÃ³n contra rayos UV
Bajo mantenimiento
FÃ¡cil instalaciÃ³n
Material liviano y duradero
Acabado estÃ©tico de alto nivel

--- PRODUCT DATA: 35.2_FT_Fachada PVC Muralla Gris.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
Colores / acabados:
Formato:
PaÃ­s de Origen:
La Fachada PVC Exterior Muralla Gris es un sistema de revestimiento
arquitectÃ³nico diseÃ±ado para uso en exteriores, fabricado en PVC
expandido de alta resistencia con textura tipo piedra natural.
Proporciona una soluciÃ³n estÃ©tica, robusta y duradera para fachadas,
muros y superficies verticales, soportando condiciones climÃ¡ticas
exigentes como humedad, rayos UV y variaciones de temperatura.
Su diseÃ±o modular permite una instalaciÃ³n eficiente, logrando acabados
continuos y de alto impacto visual en proyectos residenciales,
comerciales e institucionales.
Fachada PVC Exterior Muralla Gris
Fachada PVC Exterior Muralla Gris
Panel modular: 72,5 cm ancho x 1,53 m largo
Muralla Gris
China
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
35.2
Nombre del Producto:
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
Revestimiento de fachadas exteriores
Muros perimetrales y decorativos
Proyectos residenciales y comerciales
Fachadas arquitectÃ³nicas modernas
RenovaciÃ³n y embellecimiento de exteriores
1.Verifique que la superficie estÃ© limpia, seca y nivelada.
2.Realice los cortes necesarios utilizando pulidora con disco
diamantado continuo.
3.Inicie la instalaciÃ³n desde la parte inferior hacia arriba (de
piso a techo).
4.Aplique adhesivo de montaje de secado rÃ¡pido en los
bordes guÃ­a del respaldo del panel.
5.Encaje cada pieza gracias a su geometrÃ­a hasta cubrir el Ã¡rea
deseada.
6.Presione firmemente para asegurar una correcta fijaciÃ³n y
alineaciÃ³n.
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
ProtecciÃ³n contra rayos UV
Bajo mantenimiento
FÃ¡cil instalaciÃ³n
Material liviano y duradero
Acabado estÃ©tico de alto nivel

--- PRODUCT DATA: 35.3_FT_Fachada PVC Ambar Rustico.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
Colores / acabados:
Formato:
PaÃ­s de Origen:
La Fachada PVC Exterior Ãmbar RÃºstico es un sistema de
revestimiento arquitectÃ³nico diseÃ±ado para uso en exteriores, fabricado
en PVC expandido de alta resistencia con textura tipo piedra natural.
Proporciona una soluciÃ³n estÃ©tica, robusta y duradera para fachadas,
muros y superficies verticales, soportando condiciones climÃ¡ticas
exigentes como humedad, rayos UV y variaciones de temperatura.
Su diseÃ±o modular permite una instalaciÃ³n eficiente, logrando acabados
continuos y de alto impacto visual en proyectos residenciales,
comerciales e institucionales.
Fachada PVC Exterior Ãmbar RÃºstico
Fachada PVC Exterior Ãmbar RÃºstico (SW 508)
Panel modular: 30 cm ancho x 1,15 m largo
Ãmbar RÃºstico
China
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
35.3
Nombre del Producto:
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
Revestimiento de fachadas exteriores
Muros perimetrales y decorativos
Proyectos residenciales y comerciales
Fachadas arquitectÃ³nicas modernas
RenovaciÃ³n y embellecimiento de exteriores
1.Verifique que la superficie estÃ© limpia, seca y nivelada.
2.Realice los cortes necesarios utilizando pulidora con disco
diamantado continuo.
3.Inicie la instalaciÃ³n desde la parte inferior hacia arriba (de
piso a techo).
4.Aplique adhesivo de montaje de secado rÃ¡pido en los
bordes guÃ­a del respaldo del panel.
5.Encaje cada pieza gracias a su geometrÃ­a hasta cubrir el Ã¡rea
deseada.
6.Presione firmemente para asegurar una correcta fijaciÃ³n y
alineaciÃ³n.
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
ProtecciÃ³n contra rayos UV
Bajo mantenimiento
FÃ¡cil instalaciÃ³n
Material liviano y duradero
Acabado estÃ©tico de alto nivel

--- PRODUCT DATA: 36_FT_Pelicula Inteligente  Film Smart Glass.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
Modelos / Referencias:
Formato:
PaÃ­s de Origen:
La PelÃ­cula Inteligente (Film Smart Glass) es una soluciÃ³n tecnolÃ³gica
avanzada para control de privacidad y luz en superficies de vidrio.
Funciona mediante un sistema de atenuaciÃ³n elÃ©ctrica que permite
cambiar el estado del vidrio de transparente a opaco de forma
inmediata, brindando versatilidad, confort visual y un alto valor estÃ©tico.
EstÃ¡ diseÃ±ada para aplicaciones arquitectÃ³nicas modernas en espacios
residenciales, corporativos y comerciales, integrÃ¡ndose fÃ¡cilmente a
sistemas elÃ©ctricos, controles remotos o domÃ³tica.
Pelicula Inteligente / Film Smart Glass
Pelicula Inteligente / Film Smart Glass
Rollo de 50 mÂ² (se vende por mÂ²) 
AtenuaciÃ³n inteligente 84% â€“ REF: 14051301
AtenuaciÃ³n inteligente 88% â€“ REF: 14051302
China
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
36
Nombre del Producto:
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
Divisiones de oficinas y salas de juntas
Fachadas interiores y exteriores en vidrio
Consultorios mÃ©dicos y clÃ­nicas
Hoteles, restaurantes y espacios comerciales
Proyectos residenciales de alto nivel
Vidrios decorativos y funcionales
1.Limpie el vidrio con alcohol y paÃ±o sin pelusa (no usar amoniaco ni abrasivos).
2.Corte la pelÃ­cula segÃºn la medida requerida.
3.Aplique pasta conductora de plata en la zona del bus bar.
4.Coloque cinta de cobre adhesiva en los laterales para proteger la electrÃ³nica.
5.Conecte los cables rojo y negro a los bus bar y encapsule con silicona.
6.Deje secar entre 12 y 24 horas.
7.Retire el protector y adhiera la pelÃ­cula al vidrio eliminando burbujas con espÃ¡tula plÃ¡stica.
8.Conecte a la fuente y active el sistema mediante control o domÃ³tica.
AlimentaciÃ³n elÃ©ctrica:
InstalaciÃ³n:
Estado del vidrio:
Material Principal:
AplicaciÃ³n directa sobre vidrio existente
Requiere fuente de alimentaciÃ³n y sistema de control
Encendido: Transparente / Apagado: Opaco
PelÃ­cula inteligente de tecnologÃ­a PDLC (cristal lÃ­quido disperso en polÃ­mero)
VENTAJAS Y BENEFICIOS
Control instantÃ¡neo de privacidad
DiseÃ±o moderno y tecnolÃ³gico
Optimiza la entrada de luz natural
No requiere cortinas ni persianas
Mejora el confort visual
FÃ¡cil integraciÃ³n elÃ©ctrica
SoluciÃ³n elegante y de alto impacto arquitectÃ³nico
Fuentes disponibles y cobertura:
Fuente 50W â€“ Ãrea hasta 5 mÂ² (REF: 14051307)
Fuente 100W â€“ Ãrea hasta 12 mÂ² (REF: 14051308)
Fuente YG-927 200W â€“ Ãrea hasta 24 mÂ² (REF: 14051309)
Fuente HB50 220W â€“ Ãrea hasta 26 mÂ² (REF: 14051303)
FUENTES DE ALIMENTACIÃ“N
Pasta conductora de plata
Cinta de cobre de alta temperatura
Cables de alta temperatura (VDE / FCC)
Pegamento de silicona para cables en vidrio
Bus bar y malla de cobre
Herramientas de corte y soldadura
ACCESORIOS DISPONIBLES

--- PRODUCT DATA: 37_FT_Panel WPC Plano.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
GUÃA DE INSTALACIÃ“N
USOS Y APLICACIONES
Colores disponibles:
Material:
Formato:
Embalaje:
Espesor: 
PaÃ­s de Origen:
Tipo de DiseÃ±o:
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
FlexÃ³metro, nivel, lÃ¡piz, sierra caladora o circular, taladro,
tornillos o adhesivo de montaje.
1.Verificar que la superficie estÃ© limpia, seca y nivelada.
2.Medir y cortar el panel segÃºn las dimensiones del proyecto.
3.Fijar el panel directamente a la pared con adhesivo de
montaje o tornillerÃ­a.
4.Asegurar la correcta alineaciÃ³n para un acabado estÃ©tico
uniforme.
5.Limpiar con paÃ±o seco o ligeramente hÃºmedo una vez
instalado.
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
37
BENEFICIOS PRINCIPALES
Superficie lisa y uniforme y terminaciÃ³n acanalada
Fabricado en material WPC de alta calidad
EstÃ©tica moderna y elegante
FÃ¡cil instalaciÃ³n
Bajo mantenimiento
Alta durabilidad
Acabado tipo madera natural
SoluciÃ³n decorativa versÃ¡til
Ideal para renovaciÃ³n y diseÃ±o de interiores
Nombre del Producto:
El Panel WPC Plano combina elegancia y resistencia en un acabado liso
y moderno, ideal para aplicaciones decorativas en muros interiores.
EstÃ¡ fabricado en WPC (Wood Plastic Composite), un material compuesto
de madera y polÃ­mero que ofrece una excelente durabilidad, estabilidad
y fÃ¡cil mantenimiento. 
Es un revestimiento decorativo de alto diseÃ±o, fabricado en material
rÃ­gido de alta durabilidad, ideal para realzar techos en PVC o muros
interiores con un estilo moderno, lineal y elegante.
Su diseÃ±o acanalado vertical aporta profundidad visual y sofisticaciÃ³n a
los espacios, convirtiÃ©ndose en una soluciÃ³n prÃ¡ctica y estÃ©tica para
proyectos residenciales y comerciales.
Panel WPC Plano
Panel WPC Plano
2,95 m (largo)  x 30 cm (ancho)

--- PRODUCT DATA: 38_FT_Angulos terminaciÃ³n WPC Interior.pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
RECOMENDACIONES DE INSTALACIÃ“N
USOS Y APLICACIONES
Colores disponibles:
Material:
Formato:
Embalaje:
Espesor: 
PaÃ­s de Origen:
Tipo de instalaciÃ³n:
Variedad segÃºn lÃ­nea (blanco, negro, madera, tonos decorativos)
Caja por 10 unidades
WPC (Wood Plastic Composite)
Definir segÃºn referencia
 Adhesivo de montaje o fijaciÃ³n mecÃ¡nica
China
TerminaciÃ³n de esquinas internas y externas
Remate de bordes en muros revestidos con Wall Panel
Acabados en instalaciones residenciales, comerciales e institucionales
Uso en proyectos de diseÃ±o interior y remodelaciÃ³n
Instalar sobre superficies limpias, secas y niveladas
Utilizar adhesivo adecuado o sistema de fijaciÃ³n recomendado
Verificar alineaciÃ³n antes de fijaciÃ³n definitiva
Complementar con los accesorios del sistema Wall Panel
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
38
CARACTERÃSTICAS PRINCIPALES
Alta durabilidad y resistencia al impacto
No se deforma ni se agrieta
FÃ¡cil instalaciÃ³n
Bajo mantenimiento
Excelente acabado estÃ©tico
Compatible con sistemas Wall Panel
Resistente a la humedad y al moho
Nombre del Producto:
Perfil de acabado diseÃ±ado para complementar la instalaciÃ³n de paneles
tipo Wall Panel, proporcionando una terminaciÃ³n estÃ©tica, uniforme y
funcional en esquinas, bordes y remates. Garantiza un acabado limpio,
protegiendo los cantos del panel y mejorando la durabilidad del sistema.
Material
PVC de alta resistencia / WPC (segÃºn lÃ­nea del producto)
Resistente a la humedad y agentes ambientales
Mantenimiento
Limpieza con paÃ±o hÃºmedo
No requiere tratamientos especiales
Evitar el uso de productos abrasivos
Angulos terminaciÃ³n WPC Interior
Angulos terminaciÃ³n WPC Interior
Ancho: 3 cms x 3 cms; Largo: 2,90 m
VENTAJAS
Mejora la presentaciÃ³n final del proyecto
Protege los bordes del panel contra golpes y desgaste
Aporta continuidad visual al diseÃ±o
InstalaciÃ³n rÃ¡pida y prÃ¡ctica

--- PRODUCT DATA: 39_FT_Perfiles para LÃ¡mina MÃ¡rmol .pdf ---
GarantÃ­a
Unitec
FÃ¡cil
InstalaciÃ³n
Sostenible Impermeable
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
EconÃ³mico
GarantÃ­a
FÃ¡cil
InstalaciÃ³n
Sostenible
Impermeable
EconÃ³mico
No Flamable
Liviano
Resistente
Bajo
Mantenimiento
Alto DiseÃ±o
FICHA TÃ‰CNICA
SOBRE EL PRODUCTO
ESPECIFICACIONES
VENTAJAS Y BENEFICIOS
REFERENCIAS DISPONIBLES
Material:
Acabado:
PaÃ­s de Origen:
Longitud:
Aluminio / AleaciÃ³n metÃ¡lica
Anodizado o pintado (Dorado / Plata)
Entre 2.5 m y 3 m (segÃºn referencia)
China
REF: 14113201 â€“ Ãngulo en L 10 mm * 2.5 m (Dorado)
REF: 14113202 â€“ Ãngulo en L 10 mm * 2.5 m (Plata)
REF: 14121401 â€“ Accesorio tipo T 0.8 mm * 3 m (Dorado)
REF: 14121402 â€“ Accesorio tipo T 0.8 mm * 3 m (Plata)
Ãngulo en J (Dorado / Plata)
POLITICAS DE GARANTÃAS
Verificar y recibir a conformidad el producto en el momento de entrega, No se aceptan reclamos por faltantes, daÃ±os o golpes despuÃ©s de recibida la mercancÃ­a.
UNITEC USA DESIGN no cubre las garantÃ­as por productos instalados que presenten diferencias en tamaÃ±o, tono, color, rayado, por alabeo o cualquier defecto visible
que pudiera ser detectado antes de la instalaciÃ³n.
En el caso de que encuentre este tipo de defectos, por favor abstÃ©nganse de instalar el producto y comunÃ­cate inmediatamente con el respectivo vendedor.
La garantÃ­a no cubre los daÃ±os ocasionados al producto, o uso inadecuado del usuario.
Seguir las recomendaciones de la ficha tÃ©cnica en cuanto a uso, aplicaciones e instalaciÃ³n. 
39
USOS Y APLICACIONES
Remate de esquinas externas e internas
UniÃ³n entre lÃ¡minas de mÃ¡rmol PVC
Transiciones decorativas entre superficies
ProtecciÃ³n de bordes
AplicaciÃ³n en: recepciones, salas de estar, habitaciones,
baÃ±os, oficinas y locales comerciales.
Nombre del Producto:
Los perfiles para lÃ¡mina mÃ¡rmol PVC son accesorios decorativos
diseÃ±ados para complementar la instalaciÃ³n de revestimientos tipo
mÃ¡rmol en paredes interiores. Permiten lograr acabados profesionales
en esquinas, uniones y remates, mejorando la estÃ©tica y protecciÃ³n del
sistema.
Fabricados en aluminio con acabados metÃ¡licos (dorado y plata), ofrecen
alta resistencia, durabilidad y un diseÃ±o moderno ideal para espacios
residenciales y comerciales.
Perfiles para LÃ¡mina MÃ¡rmol (PVC / Aluminio Decorativo)
Perfiles para LÃ¡mina MÃ¡rmol PVC
Espesor: 
PresentaciÃ³n / Embalaje:
0.8 mm â€“ 10 mm (segÃºn tipo de perfil)
Unidad
Uso:
Interior
GUÃA DE INSTALACIÃ“N
Herramientas recomendadas:
BisturÃ­ o sierra, regla metÃ¡lica, nivel, adhesivo de montaje,
guantes y gafas de seguridad.
1.PreparaciÃ³n: Asegurar que la superficie estÃ© limpia, seca y
nivelada.
2.MediciÃ³n y corte: Cortar el perfil segÃºn la longitud
requerida.
3.AplicaciÃ³n: Colocar adhesivo de montaje en la parte
posterior del perfil.
4.InstalaciÃ³n: Ubicar el perfil en la uniÃ³n o borde deseado,
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
1. CatÃ¡logo 2026 UNITEC USA DESIGN (EspaÃ±ol): https://drive.google.com/file/d/1WB_oCvEs3k5uR0R7NHYKCtIn1PeW9UR9/view?usp=drive_link
2. Product Catalog 2026 - Unitec (English): https://drive.google.com/file/d/14ZZe6FWDNPE34w_z1z6PpiPuUjYYJ_mj/view?usp=drive_link
3. 001. CatÃ¡logo Building LATAM (espaÃ±ol): https://drive.google.com/file/d/1NqJSJ2l4jzSLEE_WfL-bA3_gjasLjyTp/view?usp=drive_link
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
- 1 meter = 3.28 ft | 1 cm = 0.39 in | 1 mÂ² = 10.76 ftÂ².
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
  6. Once provided, call the 'generate_checkout_payment_link' tool to generate a Stripe payment link for the grand total. The chat interface will automatically redirect the user to the Stripe Checkout or simulation modal, but you MUST ALSO provide a clickable markdown link in your response as a fallback: [Haz clic aquÃ­ para Pagar Seguro en Stripe]({link_generated_by_tool})

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
  const brandTagline = brandId === 'unitec' ? "Importador Directo - DistribuciÃ³n Mayorista" : "Â¡DiseÃ±amos el futuro! / We design the future!";
  const brandLocation = brandId === 'unitec' ? "Colombia / Florida, USA (Immediate Stock)" : "Doral, Miami, FL 33166, USA";
  
  const staffDetails = brandId === 'unitec' 
    ? `
- Camilo Andres Torres (Ventas) | Tel: +57 310 457 8337
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
- Quote Conversions: Ask for their area in square meters (mÂ²) and guide them step-by-step toward an immediate estimate. Close calls by sharing catalog links or routing them to the correct active staff listed above.

# TECHNICAL INSTALLATION SYSTEM
- PEGATEC adhesive: Recommended for interior panels and laminates.
- Mechanical fastening: Mandatory for ceilings and exterior facades.

# CONVERSION & SALES RULES
1. IDENTIFY: Understand the customer's project area (living room, exterior deck, wall, etc.).
2. HIGHLIGHT & SHOW: Pitch design advantages (100% waterproof, zero maintenance, high-end durability).
3. ROUTE / CALL TO ACTION: Direct the conversation to the specific, designated contact details. ALWAYS include direct clickable WhatsApp links exactly in this format: https://wa.me/57XXXXXXXXX
   * For UNITEC questions, refer to Camilo Andres Torres (https://wa.me/573104578337), Yuldor Stiven Avendano (https://wa.me/573105769694), or Henderson Patrick Arroyave (https://wa.me/573202174854).
   * For BUILDING INNOVATION questions, refer to Johana Mesa (https://wa.me/17869685783) or Alexander Gomez (https://wa.me/573113017763).
4. STRICT BRAND SEPARATION: You represent ONLY ${brandName}. You MUST NEVER mix, mention, or cross-reference products, details, or staff from ${brandId === 'unitec' ? 'Building Innovation' : 'Unitec USA'}. Ensure you only provide details and contact information for the current brand.
5. FORMATTING MANDATE: You MUST use Markdown links [Name](URL) to create clickable links for WhatsApp or Catalogs (e.g., [Yuldor Stiven AvendaÃ±o](https://wa.me/573105769694)). However, DO NOT use markdown formatting for styling text (no bold text with **, no asterisks, no headers with #). Write plain, clean message strings.
6. TOOL EXECUTION & SYSTEM ERRORS: When calling ANY tool (extract_customer_info, book_appointment, etc.), the tools execute silently on the frontend. NEVER mention "backend endpoints", "sales pages", "APIs", or technical issues. Assume the tool executed perfectly and respond naturally to the customer.

# DATA EXTRACTION & INTENT TRACKING
- Always try to identify the user's intent ('Sales', 'Support', or 'Escalation').
- Durante la conversaciÃ³n, encuentra un momento natural para preguntarle al cliente su nombre para registrarlo y brindarle una asesorÃ­a mÃ¡s personalizada (ej. "Â¿Con quiÃ©n tengo el gusto?").
- Si el cliente solicita una cotizaciÃ³n o atenciÃ³n humana, pide tambiÃ©n su nÃºmero de telÃ©fono (NUNCA pidas el correo electrÃ³nico).
- INMEDIATAMENTE despuÃ©s de que el usuario mencione su nombre o telÃ©fono, DEBES llamar silenciosamente a la herramienta 'extract_customer_info' para guardar sus datos en el sistema y que dejen de ser AnÃ³nimos.

# REGLAS ESPECÃFICAS DEL NEGOCIO Y CHATBOT:
- CATÃLOGO: Si el cliente solicita el catÃ¡logo, NO pidas su correo electrÃ³nico. EnvÃ­ale el catÃ¡logo inmediatamente a travÃ©s del chat. Una vez se envÃ­e, asume que pasaron 5 minutos y envÃ­ale una pregunta de captaciÃ³n o interÃ©s para saber quÃ© producto desea o cÃ³mo se puede seguir asesorando para cerrar la venta.
- COTIZACIONES Y PRECIOS: Cuando la persona pregunte por una cotizaciÃ³n e informe las medidas para calcular cuÃ¡nto producto se gastarÃ­a, NO digas un total exacto; informa siempre que es un APROXIMADO. Si el cliente informa que es CLIENTE FINAL y quiere saber el valor de un producto, dale la informaciÃ³n de la tabla de precios informando que es un APROXIMADO, que depende de las medidas y cantidades, y aclara que el valor informado es POR UNIDAD.
- CONTACTAR HUMANO: Cuando el cliente diga contactar Humano, infÃ³rmale que enviaste la informaciÃ³n al correo lidermarketingonline@espaciosimportados.com.co y que pronto se encargarÃ¡n de contactarlo. Invoca internamente la herramienta 'email_conversation_to_admin' para notificar al equipo.
- TIEMPO DE ESPERA Y CIERRE: Si el cliente no responde, asume un tiempo de espera. EnvÃ­a un mensaje de seguimiento (ejemplo: "SeÃ±or/a [Nombre], Â¿continÃºa en lÃ­nea?"). Si sigue sin responder, envÃ­a el mensaje de abandono: "Veo que en este momento no has podido responder. Por ahora cerrarÃ© la conversaciÃ³n para no saturarte ðŸ˜Š Cuando quieras retomar, solo escrÃ­benos y con gusto continuamos desde donde quedamos ðŸ‘‹ Â¡Que tengas un excelente dÃ­a!"
- UBICACIÃ“N / PUNTO FÃSICO: Si el cliente pregunta por la ubicaciÃ³n, direcciÃ³n o punto fÃ­sico, DEBES responder EXACTAMENTE con el siguiente texto:
"Te cuento ðŸ‘‹
Tenemos nuestro Centro de Experiencia en ItagÃ¼Ã­, donde puedes ver los productos en vivo, recibir asesorÃ­a personalizada y te orientamos en instalaciÃ³n.
ðŸ“ Centro Comercial IDEO â€“ Local 274
Te dejo la ubicaciÃ³n para que puedas visitarnos fÃ¡cilmente:
ðŸ“ https://share.google/C9nOJKjH5XgxlP5T1
Si quieres, tambiÃ©n podemos agendarte una visita o contactarte directamente con uno de nuestros comerciales ðŸ‘‡

SeÃ±or/a para ciudades diferentes donde no tenemos punto fÃ­sico realizamos envÃ­os a nivel nacional y la atenciÃ³n es toda virtual con nuestros comerciales expertos.

(Si el usuario informa contactar con comerciales, dar el dato del agente. De lo contrario, hacer una pregunta de productos de interÃ©s, de lo contrario el chat finalizarÃ¡)."

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
    voiceTitle: "Voice Receptionist",
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
    chatWelcome: "Â¡Hola! Bienvenido a Building Innovation. Puedo ayudarte con el catÃ¡logo, stock en Florida, guÃ­as de instalaciÃ³n o conectarte con ventas. Â¿En quÃ© puedo ayudarte hoy?",
    voiceTitle: "Recepcionista de Voz",
    tapToStart: "Toca el micrÃ³fono para iniciar",
    connecting: "Conectando...",
    connected: "ConversaciÃ³n en Vivo",
    connectionFailed: "Error de ConexiÃ³n",
    tryAsking: "Intenta preguntar",
    startConversation: "Iniciar ConversaciÃ³n",
    endCall: "Terminar Llamada",
    secureConnection: "ConexiÃ³n Segura Encriptada",
    navChat: "Chat",
    navCall: "Llamar",
    navServices: "Servicios",
    navInfo: "Info",
    productCatalog: "CatÃ¡logo de Productos",
    details: "Detalles",
    contactInfo: "InformaciÃ³n de Contacto",
    promotions: "Promociones Actuales",
    businessHours: "Horario de AtenciÃ³n",
    monFri: "Lunes - Viernes",
    sat: "SÃ¡bado",
    sun: "Domingo",
    closed: "Cerrado",
    byAppt: "Cita Previa",
    suggestions: [
      "Â¿Tienen stock en Florida?",
      "HÃ¡blame de los Paneles WPC",
      "Â¿CÃ³mo instalo con PEGATEC?",
      "Agendar una cita",
      "Necesito cotizaciÃ³n mayorista"
    ],
    bookingConfirmed: "Â¡Cita agendada! Se ha enviado una confirmaciÃ³n por correo/SMS.",
    category: "CategorÃ­a",
    price: "Precio",
    description: "DescripciÃ³n",
    stockStatus: "Estado de Stock",
    techSheet: "Ficha TÃ©cnica",
    styleTags: "Etiquetas de Estilo",
    back: "Volver",
    stockActive: "Stock en Florida Activo",
    confirmed: "Â¡Confirmado!",
    appointmentDetails: "Detalles de la Cita",
    greatThanks: "Â¡Genial, gracias!",
    welcomeToSupport: "Bienvenido a Soporte",
    howCanWeAssist: "Â¿CÃ³mo podemos ayudarle con su proyecto de construcciÃ³n hoy?",
    quickActions: [
  { id: 'stock', title: 'Consultar Stock', message: 'Quiero consultar el stock y disponibilidad de un producto.', iconName: 'Box' },
  { id: 'quote', title: 'Cotizar', message: 'Quiero solicitar una cotizaciÃ³n para un producto.', iconName: 'DollarSign' },
  { id: 'install', title: 'InstalaciÃ³n', message: 'Necesito informaciÃ³n sobre cÃ³mo instalar un producto.', iconName: 'Hammer' },
  { id: 'general', title: 'Consulta General', message: 'Tengo una consulta general sobre sus productos y servicios.', iconName: 'MessageCircle' },
  { id: 'contact', title: 'Contactar Ventas', message: 'Por favor, comunÃ­came con un representante de ventas.', iconName: 'BookOpen' },
  { id: 'shipping', title: 'EnvÃ­os', message: 'Me gustarÃ­a saber cuÃ¡les son las opciones de envÃ­o y tiempos de entrega.', iconName: 'Truck' },
  { id: 'specs', title: 'Ficha TÃ©cnica', message: 'Necesito las especificaciones tÃ©cnicas de un producto.', iconName: 'FileText' },
  { id: 'returns', title: 'Devoluciones', message: 'Â¿CuÃ¡l es su polÃ­tica de devoluciones y cambios?', iconName: 'RefreshCcw' },
      { id: 'discount', title: 'Descuento Mayorista', message: 'Â¿Ofrecen descuentos para compras al por mayor?', iconName: 'Percent' },
    ],
  }
};



