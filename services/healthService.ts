// getApiKey removed 2026-09-02: Gemini health is checked server-side via
// /api/system-health (the raw key no longer leaves the server).
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
  context: ContextStatus;
  metrics: {
    totalConversations: number;
    activeConversations: number;
    pendingInterventions: number;
    avgResponseTime: number;
    errorRate: number;
    uptime: number;
  };
}

// Live "memory" watchdog status: how full the AI context is and whether the bot is at risk.
export interface ContextStatus {
  healthy: boolean;
  level: 'healthy' | 'elevated' | 'warning' | 'critical';
  utilizedPct: number;
  usedTokens: number;
  contextBudgetTokens: number;
  peakConversationLength: number;
  calls: number;
  avgLatencyMs: number;
  recentLatencyMs: number;
  rates: { warn: number; crit: number };
  timestamp: string;
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

  // Live AI "memory" health from the /api/health watchdog endpoint
  const context = await getContextHealth();

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
    context,
    metrics,
  };
};

// Fetches the live context/memory watchdog data. Falls back to a neutral healthy state if
// the /api/health endpoint is unreachable (e.g. during cold start) so the dashboard still renders.
const getContextHealth = async (): Promise<ContextStatus> => {
  const fallback: ContextStatus = {
    healthy: true,
    level: 'healthy',
    utilizedPct: 0,
    usedTokens: 0,
    contextBudgetTokens: 1_000_000,
    peakConversationLength: 0,
    calls: 0,
    avgLatencyMs: 0,
    recentLatencyMs: 0,
    rates: { warn: 0, crit: 0 },
    timestamp: new Date().toISOString(),
  };
  try {
    const res = await fetch('/api/health', { cache: 'no-store' });
    if (!res.ok) return fallback;
    const data = await res.json();
    return {
      healthy: data.healthy !== false,
      level: data.level || 'healthy',
      utilizedPct: data.utilizedPct || 0,
      usedTokens: data.usedTokens || 0,
      contextBudgetTokens: data.contextBudgetTokens || 1_000_000,
      peakConversationLength: data.peakConversationLength || 0,
      calls: data.calls || 0,
      avgLatencyMs: data.avgLatencyMs || 0,
      recentLatencyMs: data.recentLatencyMs || 0,
      rates: data.rates || { warn: 0, crit: 0 },
      timestamp: data.timestamp || new Date().toISOString(),
    };
  } catch {
    return fallback;
  }
};

const checkGeminiStatus = async (): Promise<ServiceStatus> => {
  // 2026-09-02: the raw key no longer leaves the server (security fix — the
  // /api/gemini-key endpoint is now admin-only). Health is checked server-side
  // by /api/system-health, which returns status only, never the key.
  try {
    const response = await fetch('/api/system-health', { cache: 'no-store' });
    if (!response.ok) {
      return { status: 'degraded', latency: 0, lastChecked: new Date().toISOString(), error: `HTTP ${response.status}` };
    }
    const data = await response.json();
    return {
      status: data.status || 'down',
      latency: data.latency || 0,
      lastChecked: data.lastChecked || new Date().toISOString(),
      error: data.error
    };
  } catch (e: any) {
    return { status: 'down', latency: 0, lastChecked: new Date().toISOString(), error: e.message };
  }
};

const checkFirebaseStatus = async (): Promise<ServiceStatus> => {
  const start = Date.now();
  try {
    await getDoc(doc(db, 'test', 'connection'));
    return { status: 'up', latency: Date.now() - start, lastChecked: new Date().toISOString() };
  } catch (e: any) {
    if (e.message?.includes('offline') || e.message?.includes('network')) {
      return { status: 'degraded', latency: Date.now() - start, lastChecked: new Date().toISOString(), error: 'Firebase is offline. Local storage fallback is active.' };
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


