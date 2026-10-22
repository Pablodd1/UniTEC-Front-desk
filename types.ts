export interface Product {
  id: string;
  category: string;
  subcategory?: string;
  collection?: string;
  name: string;
  style_tags: string[];
  price: string;
  price_cop?: string;
  price_usd?: string;
  unit?: string;
  items_per_box?: string;
  dimensions?: {
    latam: {
      width_cm: number;
      length_cm: number;
      thickness_mm: number;
    };
    usa: {
      width_in: number;
      length_ft: number;
      thickness_in: number;
    };
  };
  description: string;
  image_url: string;
  pdf_tech_sheet: string;
  stock_status: string;
}

export interface ServiceOffering {
  id: string;
  name: string;
  category: string;
  description: string;
  features: string[];
  pricing: string;
  image?: string;
}

export interface QuickAction {
  id: string;
  title: string;
  message: string;
  iconName: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  skipFirestore?: boolean;
}

export enum Tab {
  DASHBOARD = 'dashboard', 
  CHAT = 'chat',
  CALL = 'call',
  CALENDAR = 'calendar',
  SERVICES = 'services',
  INFO = 'info',
  ADMIN_SETTINGS = 'admin_settings',
  PRIVACY = 'privacy'
}

export interface EscalaConfig {
  apiKey: string;
  accountId: string;
  isActive: boolean;
}

export interface BusinessConfig {
  name: string;
  tagline: string;
  contact: {
    whatsapp: string;
    instagram: string;
    location: string;
  };
  promotions: string[];
  systemInstructionOverride?: string;
  customGreeting?: string;
  // Website Redesign Config
  heroImage?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    linkedin?: string;
  };
  navLinks?: Array<{ label: string; href: string }>;
}

export interface CrmLog {
  id: string;
  timestamp: string;
  customerName: string;
  summary: string;
  actionTaken: string;
  sentiment: 'Positive' | 'Neutral' | 'Negative';
  provider?: 'Internal' | 'Escala';
}

export interface CallRecording {
  id: string;
  name: string;
  timestamp: string;
  duration: string;
  blobUrl?: string;
  transcript?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  attendees: string[];
  status: 'confirmed' | 'pending';
}

export interface BillingInvoice {
  id: string;
  date: string;
  amount: number;
  tokens: number;
  status: 'Draft' | 'Sent' | 'Paid';
}

export interface UsageStats {
  totalTokens: number;
  chatTokens: number;
  voiceTokens: number;
  imageTokens: number;
  minutesUsed: number;
  apiCalls: number;
  limitTokens: number;
  limitMinutes: number;
  costEstimate: number;
  billingHistory: BillingInvoice[];
  dailyHistory: {
    date: string;
    tokens: number;
    calls: number;
    chats: number;
  }[];
  platformStats?: {
    web: number;
    phone: number;
    whatsapp: number;
  };
}

export type VisualizerData = Uint8Array;
export type Language = 'en' | 'es';
export type VoiceProvider = 'gemini';
export type VoiceName = string;

// ===== NEW: Conversation Tracking Types =====
export interface ConversationMessage {
  id: string;
  role: 'user' | 'model' | 'staff';
  text: string;
  timestamp: string;
  isStaff?: boolean;
  staffName?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  intent?: string;
  entities?: string[];
}

export interface ConversationSession {
  id: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  // 'resolved' = el asesor cerró la conversación (estado terminal). Sale de la cola de alertas; si el
  // cliente vuelve a escribir, el servicio la reactiva a 'active' igual que hace con 'completed'.
  status: 'active' | 'human_requested' | 'human_assigned' | 'resolved' | 'completed' | 'abandoned' | 'abandoned_at_greeting';
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: string;
  brandId: 'unitec' | 'building';
  language: 'en' | 'es';
  messages?: ConversationMessage[];
  createdAt: string;
  lastUpdated: string;
  lastMessage?: string;
  assignedTo?: string;
  assignedToName?: string;
  intentCategory?: string;
  sentimentScore?: number;
  topics: string[];
  duration?: number;
  source: 'web' | 'website' | 'phone' | 'whatsapp';
  userAgent?: string;
  ipAddress?: string;
  referrer?: string;
  pageUrl?: string;
  location?: string;
  timeOnSite?: number;
  visitCount?: number;
  extractedData?: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    projectType?: string;
    budget?: string;
    timeline?: string;
    profession?: string;
  };
  analytics?: {
    messageCount: number;
    avgResponseTime: number;
    escalationCount: number;
    productMentions: string[];
    staffInteractions: number;
  };
  tags?: string[];
  notes?: Array<{
    text: string;
    staffId: string;
    staffName: string;
    timestamp: string;
  }>;
  summary?: string;
  qaPairs?: Array<{
    question: string;
    answer: string;
    category?: string;
  }>;
  summaryGeneratedAt?: string;
}

export interface InterventionRequest {
  id: string;
  sessionId: string;
  requestedAt: string;
  resolvedAt?: string;
  status: 'pending' | 'accepted' | 'resolved' | 'timeout';
  requestedBy: 'user' | 'system' | 'staff';
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedStaffId?: string;
  notes?: string;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'admin' | 'sales' | 'support';
  status: 'online' | 'offline' | 'busy';
  activeSessions: string[];
  totalHandled: number;
  avgRating: number;
}

export interface SystemStatus {
  overall: 'healthy' | 'degraded' | 'down';
  timestamp: string;
  services: {
    gemini: ServiceHealth;
    firebase: ServiceHealth;
    twilio: ServiceHealth;
    email: ServiceHealth;
    telegram: ServiceHealth;
  };
  metrics: {
    totalConversations: number;
    activeConversations: number;
    pendingInterventions: number;
    avgResponseTime: number;
    errorRate: number;
    uptime: number;
  };
}

export interface ServiceHealth {
  status: 'up' | 'down' | 'degraded' | 'unknown';
  latency: number;
  lastChecked: string;
  error?: string;
}

export interface TwilioCallRecord {
  id: string;
  sessionId: string;
  to: string;
  from: string;
  status: 'initiated' | 'ringing' | 'in-progress' | 'completed' | 'failed' | 'busy' | 'no-answer';
  direction: 'outbound' | 'inbound';
  startedAt: string;
  endedAt?: string;
  duration?: number;
  recordingUrl?: string;
  price?: string;
  errorMessage?: string;
  staffId?: string;
  staffName?: string;
  notes?: string;
}

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  isActive: boolean;
}

export interface NotificationPayload {
  type: 'intervention_request' | 'intervention_accepted' | 'new_message' | 'call_ended' | 'system_alert';
  sessionId: string;
  customerName?: string;
  customerPhone?: string;
  message?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface ChatSession {
  id: string;
  timestamp: string;
  lastUpdated: string;
  messages: Message[];
  customerName: string;
  status: 'active' | 'human_assigned' | 'completed';
  extracted_pii?: { name?: string; phone?: string; email?: string };
  intent_category?: string;
  type?: 'chat' | 'call';
}

export interface DailyReport {
  date: string;
  totalConversations: number;
  totalMessages: number;
  humanHandoffs: number;
  aiCovered: number;
  topCategories: Record<string, number>;
  avgSentiment: number;
  generatedSummaries: string[];
}



export interface CartItem {
  product: Product;
  quantity: number;
}




