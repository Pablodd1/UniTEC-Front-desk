import { getTwilioConfig } from './twilioService';

/**
 * Sends a WhatsApp message via Twilio API to the administrator.
 * 
 * @param messageText - The Spanish alert message to be sent.
 * @returns Object indicating success status and response or error details.
 */
export const sendTwilioWhatsApp = async (
  messageText: string
): Promise<{ success: boolean; messageSid?: string; error?: string }> => {
  const config = getTwilioConfig();
  
  if (!config.isActive || !config.accountSid || !config.authToken || !config.phoneNumber) {
    return { success: false, error: 'Twilio not active or not configured.' };
  }
  
  try {
    const to = 'whatsapp:+573142332147';
    
    // Clean up From number format
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
      return { success: false, error: data.message || 'Failed to send WhatsApp message' };
    }
    
    return { success: true, messageSid: data.sid };
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to send WhatsApp message' };
  }
};
