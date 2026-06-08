
import { BusinessConfig, QuickAction, Product } from './types';
import { FunctionDeclaration, Type } from "@google/genai";
import { Language } from './types';
import PRODUCTS_DATA from './products.json';

export const PRODUCTS = PRODUCTS_DATA as Product[];

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
  customGreeting: "¡Hola! Bienvenido a UNITEC USA DESIGN. ¿En qué te puedo ayudar hoy con nuestros materiales de construcción? / Hello! How can I help you today?"
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
  { id: 'stock', title: 'Consultar Stock', message: 'Cuéntame qué producto deseas consultar si tenemos en stock.', iconName: 'Box' },
  { id: 'quote', title: 'Cotizar', message: 'Dime, ¿qué producto deseas cotizar?', iconName: 'DollarSign' },
  { id: 'install', title: 'Instalación', message: 'Cuéntame de qué producto deseas saber la instalación.', iconName: 'Hammer' },
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

export const TOOLS = [bookAppointmentTool, logToCrmTool, sendEmailTool, emailConversationToAdminTool, extractCustomerInfoTool];

// --- COMPLETE TRAINING DATASET ---
export const DEFAULT_TRAINING_DATA = `
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
- When a user asks for a total, checkout, or shipping quote:
- ALWAYS ADD THIS DISCLAIMER: "Please note that the total is missing taxes and shipping cost to the closer port."
- You MUST NOT provide any fake shipping or Stripe/payment links, as we do not have an automated checkout.
- ALWAYS provide this contact number for checkout and final shipping calculations: +1 7866575441

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
4. STRICT BRAND SEPARATION: You represent ONLY ${brandName}. You MUST NEVER mix, mention, or cross-reference products, details, or staff from ${brandId === 'unitec' ? 'Building Innovation' : 'Unitec USA'}.
5. FORMATTING MANDATE: DO NOT use markdown formatting (no bold text with **, no asterisks, no headers with #) in your responses. Write plain, clean, real-time message strings that look exactly like a real human responding on a chat interface.
6. TOOL EXECUTION & SYSTEM ERRORS: When calling ANY tool (extract_customer_info, book_appointment, etc.), the tools execute silently on the frontend. NEVER mention "backend endpoints", "sales pages", "APIs", or technical issues. Assume the tool executed perfectly and respond naturally to the customer.

# DATA EXTRACTION & INTENT TRACKING
- Always try to identify the user's intent ('Sales', 'Support', or 'Escalation').
- If the user requests human intervention, a callback, or asks for a quote, politely ask for their name, phone number, and email.
- Once provided or identified, immediately call the 'extract_customer_info' tool to log this data silently to the system.

CORE DATA:
${trainingData}
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
      { id: 'stock', title: 'Check Stock', message: 'Do you have the WPC Panels in stock in Florida?', iconName: 'Box' },
      { id: 'quote', title: 'Get a Quote', message: 'I need a price for 50 square meters of SPC Flooring.', iconName: 'DollarSign' },
      { id: 'install', title: 'Installation', message: 'How do I install the wall panels using adhesive?', iconName: 'Hammer' },
      { id: 'contact', title: 'Contact Sales', message: 'Can you connect me with a sales representative?', iconName: 'BookOpen' },
      { id: 'shipping', title: 'Shipping Info', message: 'What are your shipping options and delivery times?', iconName: 'Truck' },
      { id: 'specs', title: 'Product Specs', message: 'Can I get the technical specifications for your products?', iconName: 'FileText' },
      { id: 'returns', title: 'Return Policy', message: 'What is your return and exchange policy?', iconName: 'RefreshCcw' },
      { id: 'discount', title: 'Bulk Discount', message: 'Do you offer discounts for bulk orders?', iconName: 'Percent' },
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
  { id: 'stock', title: 'Consultar Stock', message: 'Cuéntame qué producto deseas consultar si tenemos en stock.', iconName: 'Box' },
  { id: 'quote', title: 'Cotizar', message: 'Dime, ¿qué producto deseas cotizar?', iconName: 'DollarSign' },
  { id: 'install', title: 'Instalación', message: 'Cuéntame de qué producto deseas saber la instalación.', iconName: 'Hammer' },
  { id: 'contact', title: 'Contactar Ventas', message: 'Por favor, comunícame con un representante de ventas.', iconName: 'BookOpen' },
  { id: 'shipping', title: 'Envíos', message: 'Me gustaría saber cuáles son las opciones de envío y tiempos de entrega.', iconName: 'Truck' },
  { id: 'specs', title: 'Ficha Técnica', message: 'Necesito las especificaciones técnicas de un producto.', iconName: 'FileText' },
  { id: 'returns', title: 'Devoluciones', message: '¿Cuál es su política de devoluciones y cambios?', iconName: 'RefreshCcw' },
      { id: 'discount', title: 'Descuento Mayorista', message: '¿Ofrecen descuentos para compras al por mayor?', iconName: 'Percent' },
    ],
  }
};
