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
  CHAT = 'chat',
  CALL = 'call',
  SERVICES = 'services',
  INFO = 'info',
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
}

// --- New Types for Advanced Features ---

export interface CrmLog {
  id: string;
  timestamp: string;
  customerName: string;
  summary: string;
  actionTaken: string;
  sentiment: 'Positive' | 'Neutral' | 'Negative';
}

export interface AppState {
  emergencyMode: boolean;
  maintenanceMode: boolean;
  crmLogs: CrmLog[];
}

export type VisualizerData = Uint8Array;

export type Language = 'en' | 'es';

export type VoiceProvider = 'gemini' | 'deepgram';

export type VoiceName = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr' | 'asteria-en' | 'luna-en' | 'orion-en' | 'arcas-en';