
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
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  attendees: string[];
  status: 'confirmed' | 'pending';
}

export interface UsageStats {
  tokensUsed: number;
  tokensLimit: number;
  minutesUsed: number;
  minutesLimit: number;
  costEstimate: number;
}

export type VisualizerData = Uint8Array;

export type Language = 'en' | 'es';

export type VoiceProvider = 'gemini' | 'deepgram';

// Updated to allow any string for dynamic clones
export type VoiceName = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr' | 'asteria-en' | 'luna-en' | 'orion-en' | 'arcas-en' | string;
