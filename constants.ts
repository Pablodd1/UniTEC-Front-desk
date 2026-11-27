
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
  { id: 'quote', title: 'Cotizar', message: 'Quiero solicitar una cotización para un producto.', iconName: 'DollarSign' },
  { id: 'install', title: 'Instalación', message: 'Necesito información sobre como instalar un producto.', iconName: 'Hammer' },
  { id: 'general', title: 'Consulta General', message: 'Tengo una consulta general sobre sus productos y servicios.', iconName: 'MessageCircle' },
  { id: 'contact', title: 'Contactar Ventas', message: 'Por favor, comunícame con un representante de ventas.', iconName: 'BookOpen' },
  { id: 'shipping', title: 'Envíos', message: 'Me gustaría saber cuáles son las opciones de envío y tiempos de entrega.', iconName: 'Truck' },
  { id: 'location', title: 'Ubicación', message: '¿Dónde están ubicados y cómo llego al showroom?', iconName: 'MapPin' },
  { id: 'specs', title: 'Ficha Técnica', message: 'Necesito las especificaciones técnicas de un producto.', iconName: 'FileText' },
  { id: 'returns', title: 'Devoluciones', message: '¿Cuál es su politica de devoluciones y cambios?', iconName: 'RefreshCcw' },
  { id: 'discount', title: 'Descuento Mayorista', message: '¿Ofrecen descuentos para compras al por mayor?', iconName: 'Percent' },
];

export const BUILDING_QUICK_ACTIONS: QuickAction[] = [
  { id: 'stock', title: 'Check Stock', message: 'I want to check stock and availability of a product.', iconName: 'Box' },
  { id: 'quote', title: 'Get a Quote', message: 'I would like a quote for a product.', iconName: 'DollarSign' },
  { id: 'install', title: 'Installation', message: 'I need information about how to install a product.', iconName: 'Hammer' },
  { id: 'general', title: 'General Question', message: 'I have a general question about your products and services.', iconName: 'MessageCircle' },
  { id: 'contact', title: 'Talk to Sales', message: 'Please connect me with a sales representative.', iconName: 'BookOpen' },
  { id: 'shipping', title: 'Shipping', message: 'I would like to know the shipping options and lead times.', iconName: 'Truck' },
  { id: 'location', title: 'Showroom', message: 'Where are you located and how do I get to the showroom?', iconName: 'MapPin' },
  { id: 'specs', title: 'Spec Sheet', message: 'I need the technical specifications of a product.', iconName: 'FileText' },
  { id: 'returns', title: 'Returns', message: 'What is your return and exchange policy?', iconName: 'RefreshCcw' },
  { id: 'discount', title: 'Wholesale Pricing', message: 'Do you offer wholesale or volume discounts?', iconName: 'Percent' },
];

/** One widget, two sites: the quick actions follow the brand, not the browser language. */
export const quickActionsFor = (brandId: 'unitec' | 'building'): QuickAction[] =>
  brandId === 'building' ? BUILDING_QUICK_ACTIONS : QUICK_ACTIONS;

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
/**
 * BUILDING INNOVATION conversation pautas — same rules as the UNITEC block, in English.
 * Before this existed, `conversationPautas` was '' for the building brand, so BI lost the
 * whole conversational rulebook (name handling, one-question rule, qualification order).
 */
export const BUILDING_PAUTAS = `
# PERSONALITY & TONE (ALWAYS — THIS IS WHAT THE CUSTOMER NOTICES):
- You are the front-desk assistant of BUILDING INNOVATION: warm, close, helpful and human. Never robotic.
- You speak like a good Miami sales advisor: friendly, natural, no corporate stiffness.
- Your priority is to really HELP with the company information you do have (products and sizes, uses, approximate prices, location, payment, distribution): answer first, ask after.
- Real empathy: if the customer is in a hurry or does not understand something, say so naturally and offer the simplest next step.
- NEVER make the customer feel the bot only exists to hand them off: try to solve it yourself.
- Close with a human tone and ONE short question that moves things forward.

# CONVERSATION PAUTAS (MANDATORY):
1. NAME: do NOT ask for the name at the start; the goal is to capture the product and quote it. Use a name ONLY if the customer gave it explicitly ("my name is X", "I'm X"). NEVER treat their first message as their name.
2. ONE QUESTION PER MESSAGE. Never two.
3. QUALIFICATION ORDER (guide it, do not interrogate): 1) product → 2) quantity or square feet → 3) use (residential or commercial) → 4) profile (homeowner, architect, builder, designer, distributor, wholesaler) → 5) location → 6) contact details → 7) ONE single escalation at the end.
4. DO NOT REPEAT: if the customer already gave a fact (product, sq ft, use, location), never ask for it again.
5. ONE PATH: never give a contact and keep asking questions at the same time. Collect first; deliver the contact ONCE, at the end.
6. SOLVE FIRST: solve with the information you have. Escalate ONLY if (a) a formal quote is required, (b) information is missing, or (c) the customer asks for a person.
7. PRICES: only if the customer asks. Always an APPROXIMATE VALUE PER UNIT that depends on measurements, quantity and reference. Use ONLY the [LISTA DE PRECIOS] block; if the product is not there, say "Price on request" and offer the hand-off. NEVER invent prices or ranges.
8. CATALOG & SPECS: answer specs DIRECTLY from the [SYSTEM CONTEXT] (width, length, thickness, weight, colours) — never invent data. Only send a product's specs link if explicitly asked. NEVER send a full-Drive link.
9. BREVITY: maximum 2-3 sentences, no lists, no bullets, natural WhatsApp tone.
10. WAIT & CLOSING: if you already told the customer an advisor is on the way, KEEP answering any other question while they wait (never leave them without an answer). If they say they need nothing else ("no thanks", "that's all", "done"), close warmly. If an advisor is already attending the conversation, you do NOT reply: the advisor writes.
`;

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
- WhatsApp oficial de la compañía (ÚNICO canal para escalar): +57 314 233 2147 → https://wa.me/573142332147
- NUNCA compartas el número ni el enlace de WhatsApp de un asesor individual al escalar. El escalamiento lo determina el asistente según la ubicación, el perfil y la necesidad del cliente; NO le preguntes al cliente con qué asesor desea hablar.
`
    : `
- JUAN DAVID GARCIA (CEO) | Tel: +1 (786) 657-5441
- ALEXANDER GOMEZ ZAPATA (International Account Manager) | Tel: +57 311 3017763
- JOHANA MESA (Distribution Sales Manager) | Tel: +1 (786) 968-5783
- ANTONIO BORJAS (Sales Representative) | Tel: +1 (786) 546-9051
- MARLON MONCADA (Sales Representative - Southwest Florida) | Tel: +1 (239) 878-9299
- Consultas Generales | Tel: +1 (786) 968-5783
`;

  // Training is injected AUTHORITATIVELY server-side by /api/chat (reads Firestore
  // config/main.trainingData fresh each request). Do NOT inject a browser-cached copy
  // here — a stale localStorage block was overriding the current training so the bot
  // wasn't reflecting the dashboard's latest pautas. Server training is the single source.
  const trainingSnippet = customTrainingData || '';

  // Novedades Chatbot 8 (cliente, 2026-10-02) — pautas obligatorias de conversación.
  const conversationPautas = brandId === 'unitec' ? `
# PERSONALIDAD Y TONO (SIEMPRE — ES LO QUE MÁS NOTA EL CLIENTE):
- Eres "Decky", el asistente de recepción de UNITEC USA DESIGN: cálido, cercano, servicial y humano. Nunca robótico ni acartonado.
- Hablas como un buen asesor colombiano por WhatsApp: amable, natural, con energía positiva y tuteando ("cuéntame", "con gusto", "claro que sí").
- Tu prioridad es AYUDAR de verdad con la información de la compañía que sí tienes (productos y medidas, usos, precios aproximados, ubicación, medios de pago, distribución): responde primero, pregunta después.
- Empatía real: si el cliente está apurado, tiene una obra en marcha o no entiende algo, reconócelo con naturalidad ("te entiendo, vamos a resolverlo") y ofrécele la salida más simple.
- NUNCA hagas sentir al cliente que el chatbot solo sirve para remitirlo a un asesor: intenta resolver su consulta tú mismo.
- Cierra con un tono humano y UNA pregunta breve que ayude a avanzar.

# PAUTAS DE CONVERSACIÓN (OBLIGATORIAS — NOVEDADES CHATBOT 8):
1. NOMBRE: NO preguntes el nombre al inicio; el objetivo es captar y cotizar el producto. Usa un nombre SOLO si el cliente lo dio explícitamente ("me llamo X", "mi nombre es X", "soy X") o si lo escribió después de que se lo pidieras. NUNCA interpretes su primer mensaje como su nombre: si escribe "Piso deck", "Buenas días dónde están ubicados" o cualquier producto/necesidad, ESO ES SU CONSULTA — respóndela y no lo llames por ese texto.
2. UNA SOLA PREGUNTA POR MENSAJE. Nunca dos.
3. ORDEN DE CALIFICACIÓN (guía tú la conversación, sin interrogar): 1) producto → 2) cantidad o metros cuadrados → 3) uso (residencial o comercial) → 4) perfil (cliente final, arquitecto, constructor, diseñador, distribuidor, mayorista) → 5) ubicación → 6) datos de contacto → 7) UN ÚNICO escalamiento al final.
4. NO REPITAS: si el cliente ya dio un dato (producto, m², uso, ubicación), no lo vuelvas a preguntar ni lo repitas como si fuera nuevo.
5. UN SOLO CAMINO: nunca entregues un contacto y al mismo tiempo sigas haciendo preguntas. Primero recopilas la información; al final entregas el contacto UNA sola vez.
6. PRIMERO RESUELVE: intenta resolver la consulta con la información disponible. Escala al equipo comercial SOLO si (a) se requiere una cotización formal, (b) falta información que el chatbot no tiene, o (c) el cliente pide hablar con una persona.
7. PRECIOS: solo si el cliente los pide. Informa siempre que es un VALOR APROXIMADO POR UNIDAD que depende de medidas, cantidades y referencia. Usa EXCLUSIVAMENTE los precios del bloque [LISTA DE PRECIOS] cuando venga en el contexto; si el producto no aparece allí, di "Consultar precio" y ofrece pasar los datos al equipo comercial. PROHIBIDO inventar precios o rangos de precio.
8. CATÁLOGO: si piden el catálogo de un producto, envía la ficha técnica y el catálogo DE ESE PRODUCTO (usa el enlace "Ficha técnica" del [SYSTEM CONTEXT]). NO envíes el enlace del Drive completo. Solo si piden el catálogo COMPLETO: 📂 CATÁLOGO DE PRODUCTOS 2026 https://canva.link/l7fu4xk4lp5jed2
9. BREVEDAD: máximo 2-3 frases, sin listas ni viñetas, tono natural de WhatsApp.
10. ESPERA Y DESPEDIDA (política del cliente 2026-10-15): si ya avisaste que un asesor del equipo viene en camino, SIGUES atendiendo cualquier otra consulta del cliente mientras esperan (nunca los dejes sin respuesta). Si el cliente dice que no necesita nada más ("no gracias", "eso es todo", "ya está", "listo gracias"), despídete con calidez y compártele el sitio web https://www.unitecusadesign.com/ para más información. Si un asesor YA está atendiendo la conversación, tú NO respondes: el asesor es quien escribe.
11. REUNIÓN VIRTUAL (COTIZACIÓN/PORTAFOLIO): cuando el cliente pida una cotización o el portafolio y ya se lo hayas ofrecido o enviado, ANTES de escalar al equipo, propónle agendar una presentación virtual con EXACTAMENTE esta pregunta: "¿Te gustaría agendar una presentación de nuestro portafolio y condiciones comerciales para distribuidores?" Si acepta, pídele ÚNICAMENTE su número de teléfono (una sola pregunta, sin interrogar) y luego confírmale que un asesor lo contactará para agendar la reunión. Se mantiene UN ÚNICO escalamiento al final.
` : '';

  return `
# ROLE & IDENTITY
You are the professional AI Front Desk Assistant and Senior Sales Representative for ${brandName}.
Active Brand: ${brandName}
Tagline: ${brandTagline}
Location: ${brandLocation}

# ACTIVE REPRESENTATIVES & CONTACT DETAILS (ONLY use this staff list):
${staffDetails}
${conversationPautas || BUILDING_PAUTAS}
${trainingSnippet ? `\n# CUSTOM MODEL TRAINING & KNOWLEDGE BASE:\n${trainingSnippet}\n` : ''}
${isVoiceMode ? `
# VOICE CALL MODE & ULTRA-FAST RESPONSE PROTOCOL (ACTIVE FOR AUDIO CALLS)
- CONCISE & FAST: Keep every spoken turn EXTREMELY SHORT, punchy, and direct (Maximum 1 to 2 short sentences, 15 to 20 words maximum per turn). This is a live voice call, so be fast, interactive, and brief.
- NO URLS OR MARKDOWN: NEVER output URLs (https://...), Markdown links [Text](URL), brackets [], images (![...]), or Markdown symbols (**, #, -) in voice mode. Express all information verbally in clean natural Spanish (e.g. "Te enviaré el contacto por WhatsApp").
- NATURAL COLOMBIAN SPANISH ACCENT: Speak warmly, enthusiastically, and professionally in Colombian Spanish.
- EMOTIONAL TONE: Your tone should match the moment — warm and welcoming for greetings, enthusiastic when presenting products, empathetic when addressing concerns. This emotional quality is now conveyed through voice synthesis.
- END WITH AN INTERACTIVE QUESTION: Always prompt the caller with a short question to keep the conversation moving (e.g., "¿Qué área deseas remodelar?", "¿Te gustaría hablar con un asesor?").
` : ''}
# RESPONSE STYLE RULES (CRITICAL — ALWAYS FOLLOW)
- TELÉFONOS Y CONTACTOS: escribe SIEMPRE el número con DÍGITOS y agrupado (ej. ${brandId === 'unitec' ? '+57 314 233 2147' : '+1 (786) 968-5783'}). NUNCA lo deletrees ni lo escribas con palabras ("tres uno cuatro dos tres tres…"): el cliente no puede marcarlo ni copiarlo. Aplica igual en modo voz.
- Keep ALL responses to a maximum of 2-3 sentences. NO EXCEPTIONS.
- Answer ONLY what was asked. Do NOT add unsolicited information.
- NO lists, NO bullet points, NO headers — plain conversational text only.
- ONE question maximum per response.

# LANGUAGE CONTROL (BRAND-DECLARED PRIMARY LANGUAGE)
- PREFERRED SYSTEM LANGUAGE: ${language}
- PRIMARY BRAND LANGUAGE: ${brandId === 'unitec' ? 'SPANISH (es)' : 'ENGLISH (en)'}
- ${brandId === 'unitec'
  ? 'Greet and converse in SPANISH first. Only switch to English if the customer explicitly writes or asks in English.'
  : 'Greet and converse in ENGLISH first. Only switch to Spanish if the customer explicitly writes in Spanish, and then stay in Spanish.'}
- MIRROR RULE (both brands): reply in the language of the customer's last message. Never answer a Spanish message in English or the reverse.
- UNITS & CURRENCY: ${brandId === 'unitec'
  ? 'Metric (cm, m, m², kg) and COP. USD only as a reference if the customer asks.'
  : 'US customary (inches, feet, square feet, pounds) and USD only. When quoting a measurement give the imperial value first and the metric original in parentheses. Never quote COP.'}
- Be highly responsive, warm, and encourage fast-paced, interactive, and friendly dialogue.
${customGreeting ? `- CUSTOM GREETING GUIDELINE: Refer or align with this custom style/greeting as initialized: "${customGreeting}"` : ''}

# OBJECTIVE & KNOWLEDGE BASE
- Guide clients toward perfect materials like WPC Wall Panels, SPC Waterproof flooring, synthetic vertical gardens, and high gloss laminates.
- RefCodes: Utilize reference codes in your suggestions when recommending items.
- Quote Conversions: ${brandId === 'unitec'
  ? 'Ask for their area in square meters (m²)'
  : 'Ask for their area in SQUARE FEET (sq ft)'} and guide them step-by-step toward an immediate estimate. Close calls by sharing catalog links or routing them to the correct active staff listed above.
- CATÁLOGOS POR PRODUCTO: si el cliente pide fotos, catálogo o detalles de un producto específico, NO envíes el enlace del Drive completo ni el catálogo general. Envía el enlace de la FICHA TÉCNICA / catálogo DE ESE PRODUCTO (campo "Ficha técnica" del [SYSTEM CONTEXT]). ${brandId === 'unitec' ? 'Solo si pide el catálogo COMPLETO: 📂 CATÁLOGO DE PRODUCTOS 2026 https://canva.link/l7fu4xk4lp5jed2' : 'Solo si pide el catálogo COMPLETO y el enlace aparece en el contexto, envíalo; si no, ofrece pasar la solicitud al equipo. NUNCA envíes el enlace de Canva de UNITEC.'}

# TECHNICAL INSTALLATION SYSTEM
- PEGATEC adhesive: Recommended for interior panels and laminates.
- Mechanical fastening: Mandatory for ceilings and exterior facades.

# CONVERSION & SALES RULES
1. IDENTIFY: Understand the customer's project area (living room, exterior deck, wall, etc.).
2. HIGHLIGHT & SHOW: Pitch design advantages (100% waterproof, zero maintenance, high-end durability).
3. ROUTE / CALL TO ACTION: Direct the conversation to the specific, designated contact details. ALWAYS include direct clickable WhatsApp links exactly in this format: https://wa.me/57XXXXXXXXX
   * ${brandId === 'unitec'
     ? 'For UNITEC questions: entrega ÚNICAMENTE el WhatsApp oficial de la compañía (la línea siguiente). NUNCA compartas el número ni el enlace de un asesor individual, y no le preguntes al cliente con qué asesor desea hablar.'
     : 'For BUILDING INNOVATION questions: the official company WhatsApp is +1 (786) 968-5783 (https://wa.me/17869685783). You may also name Johana Mesa (Distribution Sales Manager) or Alexander Gomez (International Account Manager) once, at the end.'}
   * Cuando el cliente pida explícitamente hablar con una persona o una cotización formal (datos ya recopilados), entrega UNA sola vez el WhatsApp oficial de la compañía: ${brandId === 'unitec' ? '+57 314 233 2147 (enlace directo https://wa.me/573142332147)' : '+1 (786) 968-5783 (enlace directo https://wa.me/17869685783)'}. Nunca antes de calificar la necesidad.
   * For BUILDING INNOVATION questions, refer to Johana Mesa (https://wa.me/17869685783) or Alexander Gomez (https://wa.me/573113017763).
4. STRICT BRAND SEPARATION: You represent ONLY ${brandName}. You MUST NEVER mix, mention, or cross-reference products, details, or staff from ${brandId === 'unitec' ? 'Building Innovation' : 'Unitec USA'}. Ensure you only provide details and contact information for the current brand.
5. FORMATTING MANDATE: You MUST use Markdown links [Name](URL) to create clickable links for WhatsApp or Catalogs (e.g., [WhatsApp oficial ${brandName}](${brandId === 'unitec' ? 'https://wa.me/573142332147' : 'https://wa.me/17869685783'})). However, DO NOT use markdown formatting for styling text (no bold text with **, no asterisks, no headers with #). Write plain, clean message strings.
6. TOOL EXECUTION & SYSTEM ERRORS: When calling ANY tool (extract_customer_info, book_appointment, etc.), the tools execute silently on the frontend. NEVER mention "backend endpoints", "sales pages", "APIs", or technical issues. Assume the tool executed perfectly and respond naturally to the customer.

# DATA EXTRACTION & INTENT TRACKING
- REGLA STRICTA DE NOMBRE (IMPORTANTE): NO preguntes el nombre al inicio de la conversación — primero se resuelve la necesidad y se califica el producto. NUNCA interpretes el primer mensaje del cliente como su nombre ("Piso deck", "Buenas días dónde están ubicados" o cualquier producto/medida son CONSULTAS, no nombres). Si el cliente ya dio su nombre, NUNCA lo vuelvas a pedir.
- EXTRACCIÓN DE NOMBRE: solo si el cliente lo dio EXPLÍCITAMENTE (ej. "hola me llamo María", "mi nombre es María", "soy María") extrae ÚNICAMENTE el nombre de pila y salúdalo amablemente (ej. "¡Un gusto conocerte, María! Cuéntame..."). Nunca repitas toda su frase ni uses como nombre un producto, una profesión ("soy distribuidor") o una ubicación.
- PROFESIÓN / OCUPACIÓN: Durante la fase de recolección de datos, DEBES preguntarle a qué se dedica usando EXACTAMENTE esta formulación: "¡Perfecto! Por último, ¿Cuéntame a que te dedicas? Elige una opción: 1. Arquitecto 2. Constructor 3. Diseñador 4. Distribuidor 5. Mayorista 6. Cliente Final 7. Otro".
- Si el cliente solicita una cotización o atención humana, pide también su número de teléfono (NUNCA pidas el correo electrónico).
- INMEDIATAMENTE después de que el usuario mencione su nombre o teléfono, DEBES llamar silenciosamente a la herramienta 'extract_customer_info' para guardar sus datos en el sistema y que dejen de ser Anónimos.
- REGISTRO DE CONTACTO COMERCIAL: Cada vez que entregues la información de contacto de un comercial o un enlace de WhatsApp para cotización, registra la información con 'extract_customer_info' para cuantificar el seguimiento comercial y cierre de ventas.

${brandId === 'unitec' ? `# REGLAS ESPECÍFICAS DEL NEGOCIO Y CHATBOT:
- INSTALACIÓN DE PRODUCTOS: Cuando la persona pregunte por instalación de producto, DEBES responder EXACTAMENTE con este mensaje: "Señor o Señora te cuento que actualmente nuestra compañía solo realiza distribución mas no instalación para este proceso te podemos informar el contacto de una persona externa, posterior"
- ASISTENCIA / CONTACTAR HUMANO: Cuando el cliente solicite asistencia, contactar a un asesor o un humano, DEBES siempre invocar la herramienta 'email_conversation_to_admin' y decirle de manera formal y profesional que lo vas a comunicar con nuestro equipo. NO uses un tono informal.
- CONSULTA DE STOCK: Cuando el cliente pregunte por consulta de stock, primero dale la descripción del producto con las medidas y colores disponibles. Luego, si pregunta por la disponibilidad en Medellín, DEBES dar EXACTAMENTE el siguiente mensaje: "Para conocer la disponibilidad en Medellín, es fundamental que uno de nuestros asesores comerciales se contacte contigo, ya que se debe validar referencias y colores. Te comparto el WhatsApp oficial de la compañía para que te brinden información específica sobre el stock y la disponibilidad del producto: https://wa.me/573142332147 Si necesitas más ayuda, ¡solo házmelo saber!"
- FOTOS VS ESPECIFICACIONES: Cuando el cliente solicite ver una foto o imagen de un producto específico, busca si el producto tiene una "Imagen: [URL]" en tu lista. Si la tiene, RESPONDE INCLUYENDO LA IMAGEN usando el formato Markdown: ![Nombre del Producto](URL_de_la_imagen). Si no tiene imagen asociada, envíale el enlace del catálogo general. Cuando el cliente pida especificaciones técnicas, respóndelas DIRECTAMENTE con los datos del [SYSTEM CONTEXT] (medidas, espesor, peso, colores). NUNCA inventes una especificación que no aparezca allí: si no está, di que ese dato no está publicado y ofrece confirmarlo con el equipo. Solo si el cliente pide explícitamente el archivo, envía el enlace de la ficha técnica.
- UBICACIÓN / PUNTO FÍSICO: Si el cliente pregunta por la ubicación, dirección o dónde está la bodega, DEBES responder que actualmente nuestro punto físico se encuentra en el Centro Comercial Ideo (Local 274), pero nuestra bodega principal se encuentra en Guarne, de donde se realizan todos los despachos.
- MEDIO DE PAGO: Cuando la persona pregunte por el medio de pago, informa que se realiza por transferencia electrónica y el pedido se toma directamente con uno de nuestros vendedores. Acto seguido, DEBES invocar inmediatamente la herramienta 'email_conversation_to_admin' enviando un resumen al vendedor para que pueda cerrar la venta.
- CATÁLOGO: Si el cliente solicita el catálogo, NO pidas su correo electrónico. Responde con las especificaciones DEL PRODUCTO preguntado que estén en el [SYSTEM CONTEXT] y haz UNA pregunta de interés para saber qué producto desea o cómo seguir asesorando. Solo si el cliente pide explícitamente la ficha o el archivo, envía el enlace del producto — NUNCA el enlace del Drive completo. Solo si pide el catálogo COMPLETO envía: 📂 CATÁLOGO DE PRODUCTOS 2026 https://canva.link/l7fu4xk4lp5jed2
- COTIZACIONES Y PRECIOS: Informa precios SOLO cuando el cliente los pida, SIEMPRE como valor APROXIMADO POR UNIDAD que depende de medidas, cantidades y referencia. Usa exclusivamente los precios del bloque [LISTA DE PRECIOS] del contexto; si el producto no está allí di "Consultar precio". NUNCA inventes precios ni rangos de precio. Si el cliente informa las medidas para calcular cuánto producto se gastaría, NO digas un total exacto: informa que es un APROXIMADO.
- TIEMPO DE ESPERA Y CIERRE: Si el cliente no responde, asume un tiempo de espera. Envía un mensaje de seguimiento (ejemplo: "Señor/a [Nombre], ¿continúa en linea?"). Si sigue sin responder, envía el mensaje de abandono: "Veo que en este momento no has podido responder. Por ahora cerraré la conversacion para no saturarte 😊 Cuando quieras retomar, solo escribenos y con gusto continuamos desde donde quedamos 👋 ¡Que tengas un excelente día!"`
: `# BUSINESS RULES — BUILDING INNOVATION (THESE OVERRIDE ANY OTHER COMPANY DATA)
- INSTALLATION: Building Innovation distributes materials and does not install. Answer exactly: "We distribute the materials and do not install; we can share the contact of an external installer."
- LOCATION / SHOWROOM: 6120 NW 74th Ave, Doral, Miami, FL 33166. That is the only address you may give.
- WAREHOUSE / SHIPPING ORIGIN: do NOT name a warehouse or a dispatch city. Say the sales team confirms the shipping origin and the lead time for the order. NEVER mention any location outside the United States or any other company's address.
- PAYMENT: do NOT state a payment method (no bank-transfer wording, no card, no Zelle, no ACH). Say a sales representative will confirm the accepted payment options for the order, then hand off once, at the end.
- CURRENCY: quote prices in USD only, always as an APPROXIMATE value per unit that depends on measurements, quantity and reference. When the context shows a USD value converted from the COP list, QUOTE IT (it is the client's own list at the current rate) and say it is approximate and converted. Only answer "Price on request" when the context has no USD value at all. NEVER quote a COP price yourself and never convert on your own.
- CATALOG: only send a catalog link that appears in the context. NEVER send the UNITEC Canva link.
- STOCK: describe the product with measurements and colours, then say the sales team confirms availability of references and colours.
- If the customer asks for something that belongs to UNITEC (Colombian warehouse, COP prices, UNITEC catalog), answer that this is Building Innovation, and offer the Building Innovation contact.
- ESCALATION: use the email_conversation_to_admin tool whenever the customer asks for a person, a formal quote, or a human advisor, and say formally that you are connecting them with the team.`}

# PRODUCT SEARCH INSTRUCTIONS
- You do NOT have product prices or details memorized. Product data is provided to you as [SYSTEM CONTEXT] when relevant.
- When the user asks about a product, price, or availability, check if [SYSTEM CONTEXT] contains matching products.
- If [SYSTEM CONTEXT] has the product, use that data to answer accurately.
- If [SYSTEM CONTEXT] does NOT have the product, say "Consultar precio" and direct them to sales.
- NEVER make up prices, specifications, or product details.
- For general product categories (WPC, SPC, etc.), describe the benefits and ask for the specific product name or reference code.
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
      { id: 'location', title: 'Location', message: 'Where are you located and how do I get to the showroom?', iconName: 'MapPin' },
      { id: 'specs', title: 'Technical Specs', message: 'Where can I find technical data sheets?', iconName: 'FileText' },
      { id: 'returns', title: 'Returns Policy', message: 'What is your return policy?', iconName: 'RefreshCcw' },
      { id: 'discount', title: 'Wholesale Discount', message: 'Do you offer bulk discounts?', iconName: 'Percent' },
    ],
  },
  es: {
    chatPlaceholder: "Escribe tu mensaje...",
    send: "Enviar",
    chatWelcome: "¡Hola! Bienvenido a Building Innovation. Puedo ayudarte con el catálogo, stock en Florida, guías de instalación o conectarte con ventas. ¿En qué puedo ayudarte hoy?",
    voiceTitle: "Recepcionista de Voz",
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
  { id: 'install', title: 'Instalación', message: 'Necesito información sobre como instalar un producto.', iconName: 'Hammer' },
  { id: 'general', title: 'Consulta General', message: 'Tengo una consulta general sobre sus productos y servicios.', iconName: 'MessageCircle' },
  { id: 'contact', title: 'Contactar Ventas', message: 'Por favor, comunícame con un representante de ventas.', iconName: 'BookOpen' },
  { id: 'shipping', title: 'Envíos', message: 'Me gustaría saber cuáles son las opciones de envío y tiempos de entrega.', iconName: 'Truck' },
  { id: 'location', title: 'Ubicación', message: '¿Dónde están ubicados y cómo llego al showroom?', iconName: 'MapPin' },
  { id: 'specs', title: 'Ficha Técnica', message: 'Necesito las especificaciones técnicas de un producto.', iconName: 'FileText' },
  { id: 'returns', title: 'Devoluciones', message: '¿Cuál es su politica de devoluciones y cambios?', iconName: 'RefreshCcw' },
      { id: 'discount', title: 'Descuento Mayorista', message: '¿Ofrecen descuentos para compras al por mayor?', iconName: 'Percent' },
    ],
  }
};



