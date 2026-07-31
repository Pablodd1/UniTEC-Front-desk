import { getTwilioConfig } from './twilioService';
import { sendSentDmMessage } from './sentDmService';

/**
 * Sends a WhatsApp / SMS message via Sent.dm (Primary) or Twilio API (Fallback) to the administrator.
 * 
 * @param messageText - The Spanish alert message to be sent.
 * @returns Object indicating success status and response or error details.
 */
export const sendTwilioWhatsApp = async (
  messageText: string
): Promise<{ success: boolean; messageSid?: string; error?: string }> => {
  // Nancy (staff) — Colombia +57 320 2174861
  const targetPhone = '+573202174861';

  // 1. Primary: Sent.dm Unified Messaging (WhatsApp + SMS)
  try {
    const sentDmRes = await sendSentDmMessage(targetPhone, messageText, ['whatsapp', 'sms']);
    if (sentDmRes.success) {
      return { success: true, messageSid: sentDmRes.messageId };
    }
    console.warn('Sent.dm primary dispatch failed, trying Twilio fallback:', sentDmRes.error);
  } catch (sentDmErr) {
    console.warn('Sent.dm error, falling back to Twilio:', sentDmErr);
  }

  // 2. Fallback: Twilio API
  const config = getTwilioConfig();
  if (!config.isActive || !config.accountSid || !config.authToken || !config.phoneNumber) {
    return { success: false, error: 'Both Sent.dm and Twilio services unavailable.' };
  }
  
  try {
    const to = 'whatsapp:' + targetPhone;
    let fromNumber = config.phoneNumber.trim();
    if (!fromNumber.startsWith('+') && !fromNumber.startsWith('whatsapp:')) {
      fromNumber = '+' + fromNumber;
    }
    const from = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`;
    
    const formData = new URLSearchParams();
    formData.append('To', to);
    formData.append('From', from);
    formData.append('Body', messageText);
    
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${config.accountSid}:${config.authToken}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      }
    );
    
    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.message || 'Failed to send WhatsApp message via Twilio' };
    }
    
    return { success: true, messageSid: data.sid };
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to send WhatsApp message' };
  }
};
