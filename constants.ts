
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
  { id: 'install', title: 'InstalaciÃ³n', message: 'Necesito informaciÃ³n sobre como instalar un producto.', iconName: 'Hammer' },
  { id: 'general', title: 'Consulta General', message: 'Tengo una consulta general sobre sus productos y servicios.', iconName: 'MessageCircle' },
  { id: 'contact', title: 'Contactar Ventas', message: 'Por favor, comunÃ­came con un representante de ventas.', iconName: 'BookOpen' },
  { id: 'shipping', title: 'EnvÃ­os', message: 'Me gustarÃ­a saber cuÃ¡les son las opciones de envÃ­o y tiempos de entrega.', iconName: 'Truck' },
  { id: 'specs', title: 'Ficha TÃ©cnica', message: 'Necesito las especificaciones tÃ©cnicas de un producto.', iconName: 'FileText' },
  { id: 'returns', title: 'Devoluciones', message: 'Â¿CuÃ¡l es su politica de devoluciones y cambios?', iconName: 'RefreshCcw' },
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
    required: ["destinationCity", "destinationState", "cartItems"]
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
    required: ["subtotal", "shippingCost", "total", "customerName", "cartItems"]
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

const searchCatalogTool: FunctionDeclaration = {
  name: "search_catalog",
  description: "Search the product catalog for pricing, stock, or specific product details. Always call this BEFORE answering questions about pricing or availability.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: "The product name, reference code, or category to search for." }
    },
    required: ["query"]
  }
};

export const TOOLS = [bookAppointmentTool, logToCrmTool, sendEmailTool, emailConversationToAdminTool, extractCustomerInfoTool, calculateShippingTool, generateCheckoutPaymentLinkTool, endConversationTool, searchCatalogTool];

// --- COMPLETE TRAINING DATASET ---
export const getSystemInstruction = (
  language: Language = 'es', 
  customGreeting?: string, 
  brandId: 'unitec' | 'building' = 'unitec',
  customTrainingData?: string,
  isVoiceMode: boolean = false
) => {

  // Set brand-specific identity and staff details based on brandId
  const brandName = brandId === 'unitec' ? "UNITEC USA DESIGN" : "BUILDING INNOVATION";
  const brandTagline = brandId === 'unitec' ? "Importador Directo - Distribución Mayorista" : "¡Diseñamos el futuro! / We design the future!";
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

  const trainingSnippet = customTrainingData || (typeof window !== 'undefined' ? localStorage.getItem('unitec_training_data') : '') || '';

  return `
# ROLE & IDENTITY
You are the professional AI Front Desk Assistant and Senior Sales Representative for ${brandName}.
Active Brand: ${brandName}
Tagline: ${brandTagline}
Location: ${brandLocation}

# ACTIVE REPRESENTATIVES & CONTACT DETAILS (ONLY use this staff list):
${staffDetails}
${trainingSnippet ? `\n# CUSTOM MODEL TRAINING & KNOWLEDGE BASE:\n${trainingSnippet}\n` : ''}
${isVoiceMode ? `
# VOICE CALL MODE & ULTRA-FAST RESPONSE PROTOCOL (ACTIVE FOR AUDIO CALLS)
- CONCISE & FAST: Keep every spoken turn EXTREMELY SHORT, punchy, and direct (Maximum 1 to 2 short sentences, 15 to 20 words maximum per turn). This is a live voice call, so be fast, interactive, and brief.
- NO URLS OR MARKDOWN: NEVER output URLs (https://...), Markdown links [Text](URL), brackets [], images (![...]), or Markdown symbols (**, #, -) in voice mode. Express all information verbally in clean natural Spanish (e.g. "Te enviaré el contacto por WhatsApp").
- NATURAL COLOMBIAN SPANISH ACCENT: Speak warmly, enthusiastically, and professionally in Colombian Spanish.
- END WITH AN INTERACTIVE QUESTION: Always prompt the caller with a short question to keep the conversation moving (e.g., "¿Qué área deseas remodelar?", "¿Te gustaría hablar con un asesor?").
` : ''}
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
- INDIVIDUAL PRODUCT CATALOGS: If the user asks for photos, catalogs, or details of a specific product type, do NOT send the general company catalog link or the company ecosystem link. Instead, provide a link to the corresponding individual catalog inside the Google Drive folder: https://drive.google.com/drive/folders/1Avy6LdvEt7tnnj1mfrIM2FN6kfbDZ6uw. Specify the link clearly so they can open it directly.

# TECHNICAL INSTALLATION SYSTEM
- PEGATEC adhesive: Recommended for interior panels and laminates.
- Mechanical fastening: Mandatory for ceilings and exterior facades.

# CONVERSION & SALES RULES
1. IDENTIFY: Understand the customer's project area (living room, exterior deck, wall, etc.).
2. HIGHLIGHT & SHOW: Pitch design advantages (100% waterproof, zero maintenance, high-end durability).
3. ROUTE / CALL TO ACTION: Direct the conversation to the specific, designated contact details. ALWAYS include direct clickable WhatsApp links exactly in this format: https://wa.me/57XXXXXXXXX
   * For UNITEC questions, refer to Camilo Andres Torres (https://wa.me/573104578337), Yuldor Stiven Avendano (https://wa.me/573105769694), or Henderson Patrick Arroyave (https://wa.me/573202174854).
   * Cuando el usuario solicite un precio (cotización), exprese urgencia, o pida hablar con un miembro del staff, DEBES indicarle que escriba a nuestro WhatsApp oficial: +573****2147 (usando un enlace directo como https://wa.me/573142332147).
   * For BUILDING INNOVATION questions, refer to Johana Mesa (https://wa.me/17869685783) or Alexander Gomez (https://wa.me/573113017763).
4. STRICT BRAND SEPARATION: You represent ONLY ${brandName}. You MUST NEVER mix, mention, or cross-reference products, details, or staff from ${brandId === 'unitec' ? 'Building Innovation' : 'Unitec USA'}. Ensure you only provide details and contact information for the current brand.
5. FORMATTING MANDATE: You MUST use Markdown links [Name](URL) to create clickable links for WhatsApp or Catalogs (e.g., [Yuldor Stiven Avendaño](https://wa.me/573105769694)). However, DO NOT use markdown formatting for styling text (no bold text with **, no asterisks, no headers with #). Write plain, clean message strings.
6. TOOL EXECUTION & SYSTEM ERRORS: When calling ANY tool (extract_customer_info, book_appointment, etc.), the tools execute silently on the frontend. NEVER mention "backend endpoints", "sales pages", "APIs", or technical issues. Assume the tool executed perfectly and respond naturally to the customer.

# DATA EXTRACTION & INTENT TRACKING
- REGLA STRICTA DE NOMBRE ÚNICO (IMPORTANTE): Si el cliente YA proporcionó su nombre (en el saludo inicial, en los datos de la sesión, en mensajes anteriores o si menciona que viene de una publicación de red social como Facebook, Instagram, TikTok o WhatsApp), NUNCA vuelvas a preguntarle el nombre bajo ninguna circunstancia. Pasa inmediatamente a atender su consulta o cotización.
- Durante la conversación, únicamente si el cliente es completamente anónimo y NO ha dado su nombre, encuentra un momento natural para preguntárselo (ej. "¿Con quién tengo el gusto?").
- EXTRACCIÓN DE NOMBRE: Cuando el cliente diga su nombre (ej. "hola me llamo maría"), NO repitas toda su frase en tu saludo. Extrae ÚNICAMENTE el nombre de pila y salúdalo amablemente (ej. "¡Un gusto conocerte, María! Cuéntame...").
- PROFESIÓN / OCUPACIÓN: Durante la fase de recolección de datos, DEBES preguntarle a qué se dedica usando EXACTAMENTE esta formulación: "¡Perfecto! Por último, ¿Cuéntame a que te dedicas? Elige una opción: 1. Arquitecto 2. Constructor 3. Diseñador 4. Distribuidor 5. Mayorista 6. Cliente Final 7. Otro".
- Si el cliente solicita una cotización o atención humana, pide también su número de teléfono (NUNCA pidas el correo electrónico).
- INMEDIATAMENTE después de que el usuario mencione su nombre o teléfono, DEBES llamar silenciosamente a la herramienta 'extract_customer_info' para guardar sus datos en el sistema y que dejen de ser Anónimos.
- REGISTRO DE CONTACTO COMERCIAL: Cada vez que entregues la información de contacto de un comercial o un enlace de WhatsApp para cotización, registra la información con 'extract_customer_info' para cuantificar el seguimiento comercial y cierre de ventas.

# REGLAS ESPECÍFICAS DEL NEGOCIO Y CHATBOT:
- INSTALACIÓN DE PRODUCTOS: Cuando la persona pregunte por instalación de producto, DEBES responder EXACTAMENTE con este mensaje: "Señor o Señora te cuento que actualmente nuestra compañía solo realiza distribución mas no instalación para este proceso te podemos informar el contacto de una persona externa, posterior"
- ASISTENCIA / CONTACTAR HUMANO: Cuando el cliente solicite asistencia, contactar a un asesor o un humano, DEBES siempre invocar la herramienta 'email_conversation_to_admin' y decirle de manera formal y profesional que lo vas a comunicar con nuestro equipo. NO uses un tono informal.
- CONSULTA DE STOCK: Cuando el cliente pregunte por consulta de stock, primero dale la descripción del producto con las medidas y colores disponibles. Luego, si pregunta por la disponibilidad en Medellín, DEBES dar EXACTAMENTE el siguiente mensaje: "Para conocer la disponibilidad en Medellín, es fundamental que uno de nuestros asesores comerciales se contacte contigo, ya que se debe validar referencias y colores, dando click al nombre de nuestro comercial te llevara al contacto directo [Camilo Andres Torres](https://wa.me/573104578337) para que te brinde información específica sobre el stock y la disponibilidad del producto. Si necesitas más ayuda, ¡solo házmelo saber!"
- FOTOS VS ESPECIFICACIONES: Cuando el cliente solicite ver una foto o imagen de un producto específico, busca si el producto tiene una "Imagen: [URL]" en tu lista. Si la tiene, RESPONDE INCLUYENDO LA IMAGEN usando el formato Markdown: ![Nombre del Producto](URL_de_la_imagen). Si no tiene imagen asociada, envíale el enlace del catálogo general. Cuando el cliente pida especificaciones técnicas, DEBES enviar el enlace de la ficha técnica correspondiente.
- UBICACIÓN / PUNTO FÍSICO: Si el cliente pregunta por la ubicación, dirección o dónde está la bodega, DEBES responder que actualmente nuestro punto físico se encuentra en el Centro Comercial Ideo (Local 274), pero nuestra bodega principal se encuentra en Guarne, de donde se realizan todos los despachos.
- MEDIO DE PAGO: Cuando la persona pregunte por el medio de pago, informa que se realiza por transferencia electrónica y el pedido se toma directamente con uno de nuestros vendedores. Acto seguido, DEBES invocar inmediatamente la herramienta 'email_conversation_to_admin' enviando un resumen al vendedor para que pueda cerrar la venta.
- CATÁLOGO: Si el cliente solicita el catálogo, NO pidas su correo electrónico. Envíale el catálogo inmediatamente a través del chat. Una vez se envíe, asume que pasaron 5 minutos y envíale una pregunta de captación o interés para saber qué producto desea o como se puede seguir asesorando para cerrar la venta.
- COTIZACIONES Y PRECIOS: Cuando la persona pregunte por una cotización e informe las medidas para calcular cuánto producto se gastaría, NO digas un total exacto; informa siempre que es un APROXIMADO. Si el cliente informa que es CLIENTE FINAL y quiere saber el valor de un producto, dale la información de la tabla de precios informando que es un APROXIMADO, que depende de las medidas y cantidades, y aclara que el valor informado es POR UNIDAD.
- TIEMPO DE ESPERA Y CIERRE: Si el cliente no responde, asume un tiempo de espera. Envía un mensaje de seguimiento (ejemplo: "Señor/a [Nombre], ¿continúa en linea?"). Si sigue sin responder, envía el mensaje de abandono: "Veo que en este momento no has podido responder. Por ahora cerraré la conversacion para no saturarte 😊 Cuando quieras retomar, solo escribenos y con gusto continuamos desde donde quedamos 👋 ¡Que tengas un excelente día!"

# PRODUCT SEARCH INSTRUCTIONS
- When the user asks about a specific product, price, or availability, use the search_catalog tool to find accurate information.
- NEVER make up prices or product details. If the tool returns no results, say "Consultar precio" and direct them to sales.
- For general product categories (WPC, SPC, etc.), describe the benefits and use search_catalog for specific items.
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
  { id: 'install', title: 'InstalaciÃ³n', message: 'Necesito informaciÃ³n sobre como instalar un producto.', iconName: 'Hammer' },
  { id: 'general', title: 'Consulta General', message: 'Tengo una consulta general sobre sus productos y servicios.', iconName: 'MessageCircle' },
  { id: 'contact', title: 'Contactar Ventas', message: 'Por favor, comunÃ­came con un representante de ventas.', iconName: 'BookOpen' },
  { id: 'shipping', title: 'EnvÃ­os', message: 'Me gustarÃ­a saber cuÃ¡les son las opciones de envÃ­o y tiempos de entrega.', iconName: 'Truck' },
  { id: 'specs', title: 'Ficha TÃ©cnica', message: 'Necesito las especificaciones tÃ©cnicas de un producto.', iconName: 'FileText' },
  { id: 'returns', title: 'Devoluciones', message: 'Â¿CuÃ¡l es su politica de devoluciones y cambios?', iconName: 'RefreshCcw' },
      { id: 'discount', title: 'Descuento Mayorista', message: 'Â¿Ofrecen descuentos para compras al por mayor?', iconName: 'Percent' },
    ],
  }
};



