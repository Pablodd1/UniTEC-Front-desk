import { db } from '../firebase';
import { collection, doc, updateDoc, setDoc, getDocs, query, where, orderBy } from 'firebase/firestore';

export interface TwilioCallRequest {
  to: string;  // Customer phone number
  from?: string; // Twilio phone number (from env)
  url?: string;  // TwiML URL for call handling
  statusCallback?: string;
  record?: boolean;
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

// Configuration interface
export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  isActive: boolean;
}

// Get Twilio config from environment or localStorage
export const getTwilioConfig = (): TwilioConfig => {
  const stored = localStorage.getItem('twilio_config');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse Twilio config:', e);
    }
  }
  
  return {
    accountSid: import.meta.env.VITE_TWILIO_ACCOUNT_SID || '',
    authToken: import.meta.env.VITE_TWILIO_AUTH_TOKEN || '',
    phoneNumber: import.meta.env.VITE_TWILIO_PHONE_NUMBER || '',
    isActive: !!import.meta.env.VITE_TWILIO_ACCOUNT_SID,
  };
};

// Save Twilio config
export const saveTwilioConfig = (config: TwilioConfig): void => {
  localStorage.setItem('twilio_config', JSON.stringify(config));
};

// Test Twilio connection
export const testTwilioConnection = async (config: TwilioConfig): Promise<boolean> => {
  if (!config.accountSid || !config.authToken) {
    return false;
  }
  
  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}.json`, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + btoa(`${config.accountSid}:${config.authToken}`),
      },
    });
    return response.ok;
  } catch (e) {
    return false;
  }
};

// Initiate a call to a customer
export const sendTwilioCall = async (
  phoneNumber: string,
  sessionId?: string,
  staffId?: string,
  staffName?: string
): Promise<{ success: boolean; callSid?: string; error?: string }> => {
  const config = getTwilioConfig();
  
  if (!config.isActive || !config.accountSid || !config.authToken || !config.phoneNumber) {
    return { success: false, error: 'Twilio not configured. Please add your Twilio credentials in Admin Dashboard.' };
  }
  
  try {
    // Create call record first
    const callId = `call_${Date.now()}`;
    const now = new Date().toISOString();
    
    const callRecord: TwilioCallRecord = {
      id: callId,
      sessionId: sessionId || 'unknown',
      to: phoneNumber,
      from: config.phoneNumber,
      status: 'initiated',
      direction: 'outbound',
      startedAt: now,
      staffId,
      staffName,
    };
    
    await setDoc(doc(db, 'calls', callId), callRecord);
    
    // Make the actual Twilio API call
    const formData = new URLSearchParams();
    formData.append('To', phoneNumber);
    formData.append('From', config.phoneNumber);
    formData.append('Url', `${window.location.origin}/api/twilio-voice`);
    formData.append('StatusCallback', `${window.location.origin}/api/twilio-status`);
    formData.append('StatusCallbackEvent', 'initiated ringing answered completed');
    formData.append('Record', 'true');
    
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Calls.json`,
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
      await updateDoc(doc(db, 'calls', callId), {
        status: 'failed',
        errorMessage: data.message || 'Unknown error',
        endedAt: new Date().toISOString(),
      });
      return { success: false, error: data.message || 'Failed to initiate call' };
    }
    
    // Update call record with Twilio SID
    await updateDoc(doc(db, 'calls', callId), {
      status: 'initiated',
    });
    
    return { success: true, callSid: data.sid };
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to initiate call' };
  }
};

// Handle incoming call (webhook handler for Twilio)
export const handleIncomingCall = async (callData: {
  CallSid: string;
  From: string;
  To: string;
  Direction: string;
}): Promise<void> => {
  const now = new Date().toISOString();
  
  const callRecord: TwilioCallRecord = {
    id: callData.CallSid,
    sessionId: 'inbound_' + callData.CallSid,
    to: callData.To,
    from: callData.From,
    status: 'in-progress',
    direction: 'inbound',
    startedAt: now,
  };
  
  await setDoc(doc(db, 'calls', callData.CallSid), callRecord);
  
  // Notify staff of incoming call
  await notifyIncomingCall(callData.From);
};

// Update call status from Twilio webhook
export const updateCallStatus = async (
  callSid: string,
  status: TwilioCallRecord['status'],
  duration?: number,
  recordingUrl?: string,
  price?: string
): Promise<void> => {
  const update: any = { status };
  
  if (duration) update.duration = duration;
  if (recordingUrl) update.recordingUrl = recordingUrl;
  if (price) update.price = price;
  if (status === 'completed' || status === 'failed' || status === 'busy' || status === 'no-answer') {
    update.endedAt = new Date().toISOString();
  }
  
  await updateDoc(doc(db, 'calls', callSid), update);
};

// Get call history
export const getCallHistory = async (sessionId?: string): Promise<TwilioCallRecord[]> => {
  const callsRef = collection(db, 'calls');
  let q = query(callsRef, orderBy('startedAt', 'desc'));
  
  if (sessionId) {
    q = query(q, where('sessionId', '==', sessionId));
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as TwilioCallRecord);
};

// Add call notes
export const addCallNotes = async (callId: string, notes: string): Promise<void> => {
  await updateDoc(doc(db, 'calls', callId), { notes });
};

// Generate TwiML for voice response
export const generateTwiML = (message: string = 'Thank you for calling. Please hold while we connect you to a representative.'): string => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${message}</Say>
  <Dial>
    <Number>${import.meta.env.VITE_TWILIO_FORWARD_NUMBER || ''}</Number>
  </Dial>
</Response>`;
};

// Helper function for incoming call notification
async function notifyIncomingCall(fromNumber: string): Promise<void> {
  try {
    await fetch('/api/notify-telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `📞 Incoming call from ${fromNumber}\n\nTime: ${new Date().toLocaleString()}`,
      }),
    });
  } catch (e) {
    console.error('Failed to notify incoming call:', e);
  }
}

