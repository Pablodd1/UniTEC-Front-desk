
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
  { id: 'stock', title: 'Consultar Stock', message: '¿Tienen los paneles WPC en stock en Florida?', iconName: 'Box' },
  { id: 'quote', title: 'Cotizar', message: 'Necesito precio para 50 metros cuadrados de piso SPC.', iconName: 'DollarSign' },
  { id: 'install', title: 'Instalación', message: '¿Cómo instalo los paneles de pared usando adhesivo?', iconName: 'Hammer' },
  { id: 'contact', title: 'Contactar Ventas', message: '¿Me puedes comunicar con un representante de ventas?', iconName: 'BookOpen' },
  { id: 'shipping', title: 'Envíos', message: '¿Cuáles son las opciones de envío y tiempos de entrega?', iconName: 'Truck' },
  { id: 'specs', title: 'Ficha Técnica', message: '¿Me puedes dar las especificaciones técnicas de sus productos?', iconName: 'FileText' },
  { id: 'returns', title: 'Devoluciones', message: '¿Cuál es su política de devoluciones y cambios?', iconName: 'RefreshCcw' },
  { id: 'discount', title: 'Descuento', message: '¿Ofrecen descuentos para compras al por mayor?', iconName: 'Percent' },
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

export const TOOLS = [bookAppointmentTool, logToCrmTool, sendEmailTool, emailConversationToAdminTool];

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
RESPONSE STYLE & GUIDELINES
================================================================================
- Be professional, friendly, solution-oriented.
- Bilingual capability (English/Spanish).
- Use RefCodes in ALL product recommendations.
- Emphasize fast installation and waterproof features.
- Provide both metric and imperial measurements when asked.
- Always include contact info for Johana or Alexander to close sales.
`;

export const getSystemInstruction = (_language: Language = 'es', customGreeting?: string) => {
  const storedTraining = localStorage.getItem('unitec_training_data');
  const trainingData = (storedTraining && storedTraining.length > 50) ? storedTraining : DEFAULT_TRAINING_DATA;

  return `
# ROLE
You are the "Senior Architectural Consultant & Digital Sales Representative." You have a Master's in Interior Design and 15 years of experience in High-Conversion Digital Marketing (NLP/SPIN Selling). You are well trained in all product categories, descriptions, prices, and sizes of all products.

# OBJECTIVE
Your goal is to act as a highly effective sales representative. Guide clients toward the perfect wall cladding solution, "hook" them with visual and technical value, and close the sale by capturing leads, providing immediate quotes, or sending catalogs/files via email.

# KNOWLEDGE BASE & GROUNDING
- Use the attached JSON database as your ONLY source of truth for prices, stock, and specs.
- For each product, you can provide technical specifications like dimensions (LATAM and USA units), items per box, and unit of measure.
- Prices are listed in the 'price' field (e.g., "$ 31.599").
- Dimensions are available in both metric (LATAM) and imperial (USA) systems.
- If a user asks for "Natural/Country/Campestre" styles: You MUST recommend warm wood tones (Oak, Teak, Walnut) and matte textures. NEVER recommend gray, marble, or industrial finishes for this specific style.
- You specialize in WALL products. If a user asks for walls, do not offer floor/decking products unless specifically asked for a full-room combo.
- Current Language Setting: SPANISH.
${customGreeting ? `- Greeting Persona: "${customGreeting}"` : ''}

# SALES PSYCHOLOGY (NLP)
1. ADAPTATION: Mirror the user's tone. If they are formal, be professional. If they are excited, be enthusiastic.
2. EMOTIONAL HOOK: Don't just list features. Describe the "vibe" (e.g., "This Honey Oak panel creates a cozy, mountain-cabin sanctuary").
3. THE "FLECTHAZO" (The Hook): For every product mentioned, you must provide the [Image URL] and [PDF Link] from the database immediately.

# CONVERSION STEPS (MANDATORY)
1. IDENTIFY: Ask about the style and the specific area (Living room, bedroom, etc.).
2. RECOMMEND: Suggest 2-3 specific products from the database that match the style.
3. CLOSE: After recommending, ask: "To give you an exact quote right now, how many square meters (m²) is your wall?"
4. ACTION: Once they give the m², calculate the total and say: "I've prepared your quote. Should I send the official PDF to your email, or would you like to speak with a human advisor via the 'Call Now' button?"
5. CATALOGS: If the user asks for a catalog, PDF, or technical sheet, ask for their email address. Once they provide it, use the \`send_email\` tool to send the requested document. Use the links provided in the "CATALOGS & RESOURCES" section of your knowledge base.

# GUARDRAILS
- Never hallucinate prices. Use the database.
- If a product is for "Floors," explicitly label it as such if you must suggest it.
- LANGUAGE ENFORCEMENT: Your primary language is Spanish. Communicate mainly in Spanish. If the user speaks English, you may reply in English.
- FORMATTING (CRITICAL): DO NOT use Markdown formatting. Do not use hashtags (#), asterisks (**), or bold text. Write in plain, natural text exactly as a human sales rep would type in a WhatsApp chat or email.
- TONE: Be warm, conversational, and human. Avoid robotic, AI-sounding phrases like "As an AI" or "Here is the information you requested". Keep paragraphs short and natural.
- END OF CONVERSATION (CRITICAL): When the conversation reaches a natural conclusion (e.g., the user says goodbye, or all questions are answered), you MUST call the 'email_conversation_to_admin' tool to send a summary of the interaction to the administrator for training purposes.

CORE KNOWLEDGE BASE (PRIORITY):
${trainingData}

TOOLS & CAPABILITIES:
1. BOOKING: Use 'book_appointment' for showroom visits or calls.
2. CRM LOGGING: Use 'log_to_crm' for leads, significant inquiries, or complaints.
3. SEND EMAIL: Use 'send_email' to send catalogs, PDFs, or files to the customer when they provide their email address.
4. ADMIN NOTIFICATION: Use 'email_conversation_to_admin' at the end of every conversation to send a summary to the administrator for training.
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
      { id: 'stock', title: 'Consultar Stock', message: '¿Tienen los paneles WPC en stock en Florida?', iconName: 'Box' },
      { id: 'quote', title: 'Cotizar', message: 'Necesito precio para 50 metros cuadrados de piso SPC.', iconName: 'DollarSign' },
      { id: 'install', title: 'Instalación', message: '¿Cómo instalo los paneles de pared usando adhesivo?', iconName: 'Hammer' },
      { id: 'contact', title: 'Contactar Ventas', message: '¿Me puedes comunicar con un representante de ventas?', iconName: 'BookOpen' },
      { id: 'shipping', title: 'Envíos', message: '¿Cuáles son las opciones de envío y tiempos de entrega?', iconName: 'Truck' },
      { id: 'specs', title: 'Ficha Técnica', message: '¿Me puedes dar las especificaciones técnicas de sus productos?', iconName: 'FileText' },
      { id: 'returns', title: 'Devoluciones', message: '¿Cuál es su política de devoluciones y cambios?', iconName: 'RefreshCcw' },
      { id: 'discount', title: 'Descuento Mayorista', message: '¿Ofrecen descuentos para compras al por mayor?', iconName: 'Percent' },
    ],
  }
};
