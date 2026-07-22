/**
 * Sent.dm Unified Messaging Service (WhatsApp & SMS)
 * API Endpoint: https://api.sent.dm/v3/messages
 */

export interface SentDmResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  details?: any;
}

const DEFAULT_SENT_API_KEY = 'f313aa2c-9620-4d96-a5b3-4b2504353b1b';

export const getSentDmApiKey = (): string => {
  if (typeof window !== 'undefined') {
    const customKey = localStorage.getItem('unitec_sent_dm_key');
    if (customKey && customKey.trim()) return customKey.trim();
  }
  return (import.meta.env.VITE_SENT_DM_API_KEY || DEFAULT_SENT_API_KEY).trim();
};

/**
 * Sends a message via Sent.dm (WhatsApp and/or SMS)
 */
export const sendSentDmMessage = async (
  toPhone: string,
  messageText: string,
  channels: ('whatsapp' | 'sms')[] = ['whatsapp', 'sms']
): Promise<SentDmResponse> => {
  const apiKey = getSentDmApiKey();
  
  if (!apiKey) {
    return { success: false, error: 'Sent.dm API Key is missing.' };
  }

  // Format recipient phone number (+ prefix required)
  let cleanPhone = toPhone.trim();
  if (!cleanPhone.startsWith('+')) {
    cleanPhone = '+' + cleanPhone.replace(/\D/g, '');
  }

  try {
    // 1. Try serverless proxy /api/notify-whatsapp
    const proxyRes = await fetch('/api/notify-whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: cleanPhone,
        text: messageText,
        channels
      }),
      signal: AbortSignal.timeout(5000)
    });

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data.success) {
        return { success: true, messageId: data.data?.recipients?.[0]?.message_id || 'sent-dm-ok' };
      }
    }
  } catch (proxyErr) {
    console.warn('Serverless notify-whatsapp proxy failed, falling back to direct Sent.dm API:', proxyErr);
  }

  // 2. Direct client fallback
  try {
    const res = await fetch('https://api.sent.dm/v3/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: [cleanPhone],
        text: messageText,
        channel: channels
      }),
      signal: AbortSignal.timeout(6000)
    });

    const data = await res.json();
    if (res.status === 200 || res.status === 202) {
      const msgId = data.data?.recipients?.[0]?.message_id || 'sent-dm-queued';
      return { success: true, messageId: msgId };
    }

    return { 
      success: false, 
      error: data.error?.message || `Sent.dm error status ${res.status}`,
      details: data
    };
  } catch (e: any) {
    console.error('Sent.dm messaging exception:', e);
    return { success: false, error: e.message || 'Network error sending Sent.dm message' };
  }
};
