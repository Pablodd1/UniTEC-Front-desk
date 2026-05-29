import { UsageStats, BillingInvoice } from "../types";

/**
 * AI Power Usage Service (Enterprise SaaS Tier)
 * Calculates underlying costs vs client billing rates.
 */

const STORAGE_KEY = 'unitec_usage_metrics';

// RATES
const CLIENT_RATE_PER_1M_TOKENS = 0.25;  
const CLIENT_RATE_PER_VOICE_MIN = 0.05;  
const ACTUAL_COST_PER_1M_TOKENS = 0.075; 
const ACTUAL_COST_PER_VOICE_MIN = 0.01;  

const INITIAL_STATS: UsageStats = {
  totalTokens: 0,
  chatTokens: 0,
  voiceTokens: 0,
  imageTokens: 0,
  minutesUsed: 0,
  apiCalls: 0,
  limitTokens: 10000000,
  limitMinutes: 5000,
  costEstimate: 0,
  billingHistory: [],
  dailyHistory: [],
  platformStats: { web: 0, phone: 0, whatsapp: 0 }
};

export const getUsageStats = (): UsageStats => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return { ...INITIAL_STATS };
  
  try {
    const stats = JSON.parse(stored) as UsageStats;
    // Ensure all required fields exist
    stats.billingHistory = stats.billingHistory || [];
    stats.dailyHistory = stats.dailyHistory || [];
    stats.totalTokens = stats.totalTokens || 0;
    stats.minutesUsed = stats.minutesUsed || 0;
    stats.platformStats = stats.platformStats || { web: 0, phone: 0, whatsapp: 0 };
    
    // Calculate what the client owes
    stats.costEstimate = 
      (stats.totalTokens / 1000000) * CLIENT_RATE_PER_1M_TOKENS + 
      (stats.minutesUsed * CLIENT_RATE_PER_VOICE_MIN);
      
    return stats;
  } catch (e) {
    return { ...INITIAL_STATS };
  }
};

export const getProfitEstimate = (): number => {
  const stats = getUsageStats();
  const actualCost = 
    (stats.totalTokens / 1000000) * ACTUAL_COST_PER_1M_TOKENS + 
    (stats.minutesUsed * ACTUAL_COST_PER_VOICE_MIN);
  
  return stats.costEstimate - actualCost;
};

export const trackUsage = (update: Partial<Omit<UsageStats, 'costEstimate' | 'dailyHistory' | 'billingHistory'>>) => {
  const current = getUsageStats();
  const dateStr = new Date().toISOString().split('T')[0];
  
  const updated: UsageStats = {
    ...current,
    totalTokens: (current.totalTokens || 0) + (update.totalTokens || 0),
    chatTokens: (current.chatTokens || 0) + (update.chatTokens || 0),
    voiceTokens: (current.voiceTokens || 0) + (update.voiceTokens || 0),
    imageTokens: (current.imageTokens || 0) + (update.imageTokens || 0),
    minutesUsed: (current.minutesUsed || 0) + (update.minutesUsed || 0),
    apiCalls: (current.apiCalls || 0) + (update.apiCalls || 0),
  };

  const historyIndex = updated.dailyHistory.findIndex(h => h.date === dateStr);
  if (historyIndex > -1) {
    updated.dailyHistory[historyIndex].tokens += (update.totalTokens || 0);
    updated.dailyHistory[historyIndex].calls += (update.apiCalls || 0); // we use apiCalls as proxy for calls if undefined
    updated.dailyHistory[historyIndex].chats += 1; // mock increment
  } else {
    updated.dailyHistory.push({
      date: dateStr,
      tokens: update.totalTokens || 0,
      calls: update.apiCalls || 0,
      chats: 1
    });
    if (updated.dailyHistory.length > 30) updated.dailyHistory.shift();
  }
  
  // mock random platform increment
  if (updated.platformStats) {
      updated.platformStats.web += 1;
      if (Math.random() > 0.5) updated.platformStats.phone += 1;
      if (Math.random() > 0.8) updated.platformStats.whatsapp += 1;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
};

export const generateInvoice = (): BillingInvoice => {
  const stats = getUsageStats();
  const invoice: BillingInvoice = {
    id: `INV-${Date.now().toString().slice(-6)}`,
    date: new Date().toLocaleDateString(),
    amount: stats.costEstimate,
    tokens: stats.totalTokens,
    status: 'Draft'
  };
  
  const updatedStats = {
    ...stats,
    billingHistory: [invoice, ...(stats.billingHistory || [])]
  };
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedStats));
  return invoice;
};

export const resetUsage = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_STATS));
};
