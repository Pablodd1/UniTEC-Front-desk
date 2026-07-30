import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

// --- Unified escalation: fires Telegram + Email + WhatsApp + SMS in one server call ---
export interface EscalationData {
  type: 'quote' | 'staff' | 'custom';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  message: string;
  brand?: string;
  sessionId?: string;
}

export const triggerEscalation = async (data: EscalationData): Promise<{ success: boolean; results?: any }> => {
  try {
    // Log to Firestore for audit trail
    await addDoc(collection(db, 'notifications'), {
      ...data,
      timestamp: new Date().toISOString(),
      source: 'unified_escalation',
      delivered: { telegram: false, email: false, whatsapp: false },
    }).catch(() => {});

    const res = await fetch('/api/notify-escalation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        priority: data.priority || 'high',
        dashboardUrl: `${window.location.origin}/admin`,
      }),
    });
    const json = await res.json();
    return { success: json.success !== false, results: json.results };
  } catch (e) {
    console.error('Escalation failed:', e);
    return { success: false };
  }
};

export interface NotificationPayload {
  type: 'intervention_request' | 'intervention_accepted' | 'new_message' | 'call_ended' | 'system_alert';
  sessionId: string;
  customerName?: string;
  customerPhone?: string;
  message?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  timestamp: string;
  metadata?: Record<string, any>;
}

// Send notification to staff via multiple channels
export const notifyStaff = async (payload: NotificationPayload): Promise<{ email: boolean; telegram: boolean }> => {
  const results = { email: false, telegram: false };
  
  // Log notification to Firestore for audit trail
  try {
    await addDoc(collection(db, 'notifications'), {
      ...payload,
      createdAt: new Date().toISOString(),
      delivered: { email: false, telegram: false },
    });
  } catch (e) {
    console.error('Failed to log notification:', e);
  }
  
  // Send email notification
  try {
    const emailHtml = generateEmailTemplate(payload);
    const emailResponse = await fetch('/api/notify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: generateEmailSubject(payload),
        html: emailHtml,
      }),
    });
    results.email = emailResponse.ok;
  } catch (e) {
    console.error('Failed to send email notification:', e);
  }
  
  // Send Telegram notification
  try {
    const telegramMessage = generateTelegramMessage(payload);
    const telegramResponse = await fetch('/api/notify-telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: telegramMessage }),
    });
    results.telegram = telegramResponse.ok;
  } catch (e) {
    console.error('Failed to send Telegram notification:', e);
  }
  
  return results;
};

// Specific helper for intervention requests
export const notifyStaffIntervention = async (
  sessionId: string,
  reason: string = 'Customer requested human assistance',
  priority: 'low' | 'medium' | 'high' | 'urgent' = 'high'
): Promise<void> => {
  await notifyStaff({
    type: 'intervention_request',
    sessionId,
    message: reason,
    priority,
    timestamp: new Date().toISOString(),
  });
};

// Notify when intervention is accepted
export const notifyInterventionAccepted = async (
  sessionId: string,
  staffName: string
): Promise<void> => {
  await notifyStaff({
    type: 'intervention_accepted',
    sessionId,
    message: `${staffName} has taken over the conversation`,
    priority: 'medium',
    timestamp: new Date().toISOString(),
  });
};

// Notify on new customer message when human is assigned
export const notifyNewMessage = async (
  sessionId: string,
  customerName: string,
  messagePreview: string
): Promise<void> => {
  await notifyStaff({
    type: 'new_message',
    sessionId,
    customerName,
    message: messagePreview,
    priority: 'medium',
    timestamp: new Date().toISOString(),
  });
};

// System alert notification
export const notifySystemAlert = async (
  message: string,
  priority: 'low' | 'medium' | 'high' | 'urgent' = 'high'
): Promise<void> => {
  await notifyStaff({
    type: 'system_alert',
    sessionId: 'system',
    message,
    priority,
    timestamp: new Date().toISOString(),
  });
};

// Generate email HTML template
function generateEmailTemplate(payload: NotificationPayload): string {
  const colors = {
    urgent: '#dc2626',
    high: '#ea580c',
    medium: '#ca8a04',
    low: '#16a34a',
  };
  
  const titles = {
    intervention_request: '🚨 Intervention Request',
    intervention_accepted: '✅ Intervention Accepted',
    new_message: '💬 New Message',
    call_ended: '📞 Call Ended',
    system_alert: '⚠️ System Alert',
  };
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${colors[payload.priority]}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .meta { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>${titles[payload.type]}</h2>
          <span class="badge">Priority: ${payload.priority.toUpperCase()}</span>
        </div>
        <div class="content">
          <p><strong>Session ID:</strong> ${payload.sessionId}</p>
          ${payload.customerName ? `<p><strong>Customer:</strong> ${payload.customerName}</p>` : ''}
          ${payload.message ? `<p><strong>Message:</strong> ${payload.message}</p>` : ''}
          <div class="meta">
            <p>Timestamp: ${new Date(payload.timestamp).toLocaleString()}</p>
            <p>View in Dashboard: <a href="${window.location.origin}/admin">Open Dashboard</a></p>
          </div>
        </div>
        <div class="footer">
          <p>UniTEC AI Front Desk - Automated Notification</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateEmailSubject(payload: NotificationPayload): string {
  const subjects = {
    intervention_request: `[${payload.priority.toUpperCase()}] Customer Needs Human Assistance`,
    intervention_accepted: `Staff Taking Over Conversation`,
    new_message: `New Message from ${payload.customerName || 'Customer'}`,
    call_ended: `Call Ended - Session ${payload.sessionId}`,
    system_alert: `[${payload.priority.toUpperCase()}] System Alert`,
  };
  return subjects[payload.type];
}

function generateTelegramMessage(payload: NotificationPayload): string {
  const icons = {
    intervention_request: '🚨',
    intervention_accepted: '✅',
    new_message: '💬',
    call_ended: '📞',
    system_alert: '⚠️',
  };
  
  const lines = [
    `<b>${icons[payload.type]} ${payload.type.replace('_', ' ').toUpperCase()}</b>`,
    ``,
    `<b>Priority:</b> ${payload.priority.toUpperCase()}`,
    `<b>Session:</b> ${payload.sessionId}`,
  ];
  
  if (payload.customerName) {
    lines.push(`<b>Customer:</b> ${payload.customerName}`);
  }
  
  if (payload.message) {
    lines.push(`<b>Message:</b> ${payload.message.substring(0, 200)}${payload.message.length > 200 ? '...' : ''}`);
  }
  
  lines.push(`<b>Time:</b> ${new Date(payload.timestamp).toLocaleString()}`);
  lines.push(`<a href="${window.location.origin}/admin">View Dashboard</a>`);
  
  return lines.join('\n');
}
