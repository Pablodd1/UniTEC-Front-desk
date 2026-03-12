
import { BusinessConfig, QuickAction, ServiceOffering } from './types';
import { FunctionDeclaration, Type } from "@google/genai";
import { Language } from './types';

export const UNITEC_CONFIG: BusinessConfig = {
  name: "UNITEC USA DESIGN",
  tagline: "Direct Importer - Wholesale Distribution",
  contact: {
    whatsapp: "+57 314 233 2147",
    instagram: "@unitecusadesign",
    location: "Florida, USA (Immediate Stock Available)"
  },
  promotions: [
    "October Special: 20% off combo packages",
    "Special pricing on Acrylic Panels"
  ],
  customGreeting: "Welcome to UNITEC USA DESIGN. How can I help you with our wholesale construction materials today?"
};

export const BUILDING_INNOVATION_CONFIG: BusinessConfig = {
  name: "BUILDING INNOVATION",
  tagline: "We design the future!",
  contact: {
    whatsapp: "+1 (786) 968-5783",
    instagram: "@building.innovation",
    location: "6120 NW 74th Ave, Doral, Miami, FL 33166"
  },
  promotions: [
    "New Arrival: Tech-composite Panels",
    "Innovation Week: Free consultations"
  ],
  customGreeting: "Hello! Welcome to Building Innovation – where we design the future! I'm your virtual assistant. How can I help you with our innovative construction and architectural materials today?"
};

// Default export for initial load
export const BUSINESS_CONFIG = BUILDING_INNOVATION_CONFIG;

export const SERVICES: ServiceOffering[] = [
  {
    id: 'walls',
    name: 'Wall Panels & Facades',
    category: 'Interior/Exterior',
    description: 'Extensive collection including WPC, Polifachada, Muroflex, and PU Stone textures.',
    features: ['100% Waterproof', 'Stone & Wood Finishes', 'Easy Install', 'Zero Maintenance'],
    pricing: 'Starting from $20,299 COP'
  },
  {
    id: 'sheets',
    name: 'Decorative Laminates (Sheets)',
    category: 'Interior Design',
    description: 'Foam Board, Marble Sheets, and PVC Boards in high gloss and matte finishes.',
    features: ['Marble Look', 'Mirror Finishes', 'Pastel Tones', 'Aurora Boreal Line'],
    pricing: 'Sheets from $58,299 COP'
  },
  {
    id: 'roofing',
    name: 'UPVC Roofing (Cubiertas)',
    category: 'Structural',
    description: 'Thermo-acoustic roofing solutions, colonial tile styles, and zinc-type sheets.',
    features: ['Termoacustica', 'Corrosion Resistant', 'White/Terracotta/Blue', '15-Year Warranty'],
    pricing: 'Call for volume pricing'
  },
  {
    id: 'flooring',
    name: 'SPC Flooring & Decking',
    category: 'Flooring',
    description: 'Rigid core SPC for interiors and WPC Decking for exteriors.',
    features: ['Click-Lock SPC', 'Integrated iXPE', 'Exterior WPC Deck', 'Anti-slip'],
    pricing: 'SPC from $13,399 COP'
  },
  {
    id: 'gardens',
    name: 'Artificial Gardens',
    category: 'Decor',
    description: 'Vertical gardens for interior and exterior walls. Styles: Eden, Paris, Mossy.',
    features: ['UV Resistant', 'Realistic Foliage', 'Easy Mounting', 'Indoor/Outdoor'],
    pricing: 'From $25,799 COP'
  }
];

export const QUICK_ACTIONS: QuickAction[] = [
  { id: 'stock', title: 'Check Stock', message: 'Do you have the WPC Panels in stock in Florida?', iconName: 'Box' },
  { id: 'quote', title: 'Get a Quote', message: 'I need a price for 50 square meters of SPC Flooring.', iconName: 'DollarSign' },
  { id: 'install', title: 'Installation', message: 'How do I install the wall panels using adhesive?', iconName: 'Hammer' },
  { id: 'contact', title: 'Contact Sales', message: 'Can you connect me with a sales representative?', iconName: 'BookOpen' },
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

export const TOOLS = [bookAppointmentTool, logToCrmTool];

// --- COMPLETE TRAINING DATASET ---
export const DEFAULT_TRAINING_DATA = `
# BUILDING INNOVATION - COMPLETE AI RECEPTIONIST TRAINING DATA
# Generated: January 30, 2026
# Total Products: 291
# Language: English (Bilingual capability)

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
PRODUCT DATABASE (JSON)
================================================================================
[
  {
    "id": "WPC-001",
    "category": "Wall Panel",
    "name": "Roble Miel (Honey Oak)",
    "style_tags": ["Natural", "Campestre", "Warm", "Rustic"],
    "price_per_m2": 45.00,
    "description": "Premium WPC wall panel with deep wood grain texture. Waterproof and UV resistant.",
    "image_url": "https://yourdrive.com/image_roble.jpg",
    "pdf_tech_sheet": "https://yourdrive.com/spec_roble.pdf",
    "stock_status": "In Stock"
  },
  {
    "id": "MAR-002",
    "category": "Wall Sheet",
    "name": "Mármol Gris Industrial",
    "style_tags": ["Modern", "Industrial", "Minimalist"],
    "price_per_m2": 60.00,
    "description": "High-gloss marble-effect sheet for modern office environments.",
    "image_url": "https://yourdrive.com/image_marble.jpg",
    "pdf_tech_sheet": "https://yourdrive.com/spec_marble.pdf",
    "stock_status": "Limited"
  }
]

================================================================================
FAQS & UNIT CONVERSIONS
================================================================================
- 1 meter = 3.28 ft | 1 cm = 0.39 in | 1 m² = 10.76 ft².
- Showroom visit: Call +1 (786) 968-5783 for an appointment in Doral, Miami.
- Orders: Contact Johana Mesa (+1 786 968-5783) or Alexander Gomez (+57 311 3017763).

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

export const getSystemInstruction = (language: Language = 'en', customGreeting?: string) => {
  const storedTraining = localStorage.getItem('unitec_training_data');
  const trainingData = (storedTraining && storedTraining.length > 50) ? storedTraining : DEFAULT_TRAINING_DATA;

  return `
# ROLE
You are the "Senior Architectural Consultant & Digital Sales Strategist." You have a Master's in Interior Design and 15 years of experience in High-Conversion Digital Marketing (NLP/SPIN Selling).

# OBJECTIVE
Your goal is to guide clients toward the perfect wall cladding solution, "hook" them with visual and technical value, and close the sale by capturing leads or providing immediate quotes.

# KNOWLEDGE BASE & GROUNDING
- Use the attached JSON database as your ONLY source of truth for prices, stock, and specs.
- If a user asks for "Natural/Country/Campestre" styles: You MUST recommend warm wood tones (Oak, Teak, Walnut) and matte textures. NEVER recommend gray, marble, or industrial finishes for this specific style.
- You specialize in WALL products. If a user asks for walls, do not offer floor/decking products unless specifically asked for a full-room combo.
- Current Language Setting: ${language === 'en' ? 'ENGLISH' : 'SPANISH'}.
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

# GUARDRAILS
- Never hallucinate prices. Use the database.
- If a product is for "Floors," explicitly label it as such if you must suggest it.
- LANGUAGE ENFORCEMENT: The user has toggled the language to ${language === 'en' ? 'ENGLISH' : 'SPANISH'}. You MUST write ALL conversational text, answers, and questions strictly in ${language === 'en' ? 'English' : 'Spanish'}. Do not mix languages.

CORE KNOWLEDGE BASE (PRIORITY):
${trainingData}

TOOLS & CAPABILITIES:
1. BOOKING: Use 'book_appointment' for showroom visits or calls.
2. CRM LOGGING: Use 'log_to_crm' for leads, significant inquiries, or complaints.
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
  }
};
