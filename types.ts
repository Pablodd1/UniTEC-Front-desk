
export interface Product {
  id: string;
  category: string;
  subcategory?: string;
  collection?: string;
  name: string;
  style_tags: string[];
  price: string;
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
}

export enum Tab {
  DASHBOARD = 'dashboard', 
  CHAT = 'chat',
  CALL = 'call',
  CALENDAR = 'calendar',
  SERVICES = 'services',
  INFO = 'info',
  ADMIN_SETTINGS = 'admin_settings'
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
  }[];
}

export type VisualizerData = Uint8Array;
export type Language = 'en' | 'es';
export type VoiceProvider = 'gemini';
export type VoiceName = string;
