import { getApiKey } from './geminiService';
import { db } from '../firebase';
import { getDoc, doc } from 'firebase/firestore';

export interface SystemStatus {
  overall: 'healthy' | 'degraded' | 'down';
  timestamp: string;
  services: {
    gemini: ServiceStatus;
    firebase: ServiceStatus;
    twilio: ServiceStatus;
    email: ServiceStatus;
    telegram: ServiceStatus;
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

interface ServiceStatus {
  status: 'up' | 'down' | 'degraded' | 'unknown';
  latency: number;
  lastChecked: string;
  error?: string;
}

export const getSystemStatus = async (): Promise<SystemStatus> => {
  void Date.now();
  
  const services = await Promise.all([
    checkGeminiStatus(),
    checkFirebaseStatus(),
    checkTwilioStatus(),
    checkEmailStatus(),
    checkTelegramStatus(),
  ]);
  
  const [gemini, firebase, twilio, email, telegram] = services;
  
  const statuses = [gemini.status, firebase.status, twilio.status, email.status, telegram.status];
  const hasDown = statuses.includes('down');
  const hasDegraded = statuses.includes('degraded');
  
  const overall = hasDown ? 'down' : hasDegraded ? 'degraded' : 'healthy';
  
  // Get basic metrics from localStorage for now
  const storedMetrics = localStorage.getItem('unitec_system_metrics');
  const metrics = storedMetrics ? JSON.parse(storedMetrics) : {
    totalConversations: 0,
    activeConversations: 0,
    pendingInterventions: 0,
    avgResponseTime: 0,
    errorRate: 0,
    uptime: 99.9,
  };
  
  return {
    overall,
    timestamp: new Date().toISOString(),
    services: { gemini, firebase, twilio, email, telegram },
    metrics,
  };
};

const checkGeminiStatus = async (): Promise<ServiceStatus> => {
  const start = Date.now();
  try {
    const apiKey = await getApiKey();
    if (!apiKey) {
      return { status: 'down', latency: 0, lastChecked: new Date().toISOString(), error: 'No API key configured' };
    }
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
      method: 'GET',
    });
    
    const latency = Date.now() - start;
    
    if (response.ok) {
      return { status: 'up', latency, lastChecked: new Date().toISOString() };
    } else {
      return { status: 'degraded', latency, lastChecked: new Date().toISOString(), error: `HTTP ${response.status}` };
    }
  } catch (e: any) {
    return { status: 'down', latency: Date.now() - start, lastChecked: new Date().toISOString(), error: e.message };
  }
};

const checkFirebaseStatus = async (): Promise<ServiceStatus> => {
  const start = Date.now();
  try {
    await getDoc(doc(db, 'test', 'connection'));
    return { status: 'up', latency: Date.now() - start, lastChecked: new Date().toISOString() };
  } catch (e: any) {
    if (e.message?.includes('offline') || e.message?.includes('network')) {
      return { status: 'down', latency: Date.now() - start, lastChecked: new Date().toISOString(), error: e.message };
    }
    // Permission denied means it's working but we don't have access
    return { status: 'up', latency: Date.now() - start, lastChecked: new Date().toISOString() };
  }
};

const checkTwilioStatus = async (): Promise<ServiceStatus> => {
  const start = Date.now();
  try {
    const config = localStorage.getItem('twilio_config');
    if (!config) {
      return { status: 'unknown', latency: 0, lastChecked: new Date().toISOString(), error: 'Not configured' };
    }
    
    const { accountSid, authToken } = JSON.parse(config);
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
      },
    });
    
    const latency = Date.now() - start;
    
    if (response.ok) {
      return { status: 'up', latency, lastChecked: new Date().toISOString() };
    } else {
      return { status: 'degraded', latency, lastChecked: new Date().toISOString(), error: `HTTP ${response.status}` };
    }
  } catch (e: any) {
    return { status: 'unknown', latency: Date.now() - start, lastChecked: new Date().toISOString(), error: e.message };
  }
};

const checkEmailStatus = async (): Promise<ServiceStatus> => {
  const start = Date.now();
  try {
    await fetch('/api/notify-email', {
      method: 'OPTIONS',
    });
    return { status: 'up', latency: Date.now() - start, lastChecked: new Date().toISOString() };
  } catch (e: any) {
    return { status: 'unknown', latency: Date.now() - start, lastChecked: new Date().toISOString(), error: e.message };
  }
};

const checkTelegramStatus = async (): Promise<ServiceStatus> => {
  const start = Date.now();
  try {
    await fetch('/api/notify-telegram', {
      method: 'OPTIONS',
    });
    return { status: 'up', latency: Date.now() - start, lastChecked: new Date().toISOString() };
  } catch (e: any) {
    return { status: 'unknown', latency: Date.now() - start, lastChecked: new Date().toISOString(), error: e.message };
  }
};

// Update system metrics
export const updateSystemMetrics = (metrics: Partial<SystemStatus['metrics']>): void => {
  const stored = localStorage.getItem('unitec_system_metrics');
  const current = stored ? JSON.parse(stored) : {
    totalConversations: 0,
    activeConversations: 0,
    pendingInterventions: 0,
    avgResponseTime: 0,
    errorRate: 0,
    uptime: 99.9,
  };
  
  const updated = { ...current, ...metrics };
  localStorage.setItem('unitec_system_metrics', JSON.stringify(updated));
};
