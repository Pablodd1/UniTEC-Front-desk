import { getPrivacyMode } from './firestoreService';
import { db } from '../firebase';
import { collection, doc, setDoc, getDocs, getDoc, query, orderBy, onSnapshot, updateDoc, where, increment } from 'firebase/firestore';

// PRIVACY MODE: Set to true to disable all Firestore chat saving
// This ensures user conversations are NOT stored unless explicitly enabled


const logPrivacy = (action: string) => {
  if (getPrivacyMode()) {
    console.log(`[PRIVACY] Blocked: ${action} - Chat data not saved (privacy mode enabled)`);
  }
};

export interface ConversationMessage {
  id: string;
  role: 'user' | 'model' | 'staff';
  text: string;
  timestamp: string;
  isStaff?: boolean;
  staffName?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  intent?: string;
  entities?: string[];
}

export interface ConversationSession {
  id: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  status: 'active' | 'human_requested' | 'human_assigned' | 'completed' | 'abandoned';
  brandId: 'unitec' | 'building';
  language: 'en' | 'es';
  messages: ConversationMessage[];
  createdAt: string;
  lastUpdated: string;
  lastMessage?: string;
  assignedTo?: string;
  assignedToName?: string;
  intentCategory?: string;
  sentimentScore?: number;
  topics: string[];
  duration?: number;
  source: 'web' | 'phone' | 'whatsapp';
  userAgent?: string;
  ipAddress?: string;
  referrer?: string;
  pageUrl?: string;
  location?: string;
  timeOnSite?: number;
  visitCount?: number;
  extractedData?: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    projectType?: string;
    budget?: string;
    timeline?: string;
  };
  analytics?: {
    messageCount: number;
    avgResponseTime: number;
    escalationCount: number;
    productMentions: string[];
    staffInteractions: number;
  };
  tags?: string[];
  notes?: Array<{
    text: string;
    staffId: string;
    staffName: string;
    timestamp: string;
  }>;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'admin' | 'sales' | 'support';
  status: 'online' | 'offline' | 'busy';
  activeSessions: string[];
  totalHandled: number;
  avgRating: number;
}

export interface InterventionRequest {
  id: string;
  sessionId: string;
  requestedAt: string;
  resolvedAt?: string;
  status: 'pending' | 'accepted' | 'resolved' | 'timeout';
  requestedBy: 'user' | 'system' | 'staff';
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedStaffId?: string;
  notes?: string;
}

const COLLECTIONS = {
  sessions: 'conversations',
  messages: 'messages',
  staff: 'staff',
  interventions: 'interventions',
  analytics: 'analytics',
};

// Create a new conversation session
export const createConversation = async (
  brandId: 'unitec' | 'building',
  language: 'en' | 'es' = 'es',
  source: 'web' | 'phone' | 'whatsapp' = 'web',
  metadata?: { userAgent?: string; ipAddress?: string }
): Promise<string> => {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  if (getPrivacyMode()) {
    logPrivacy('createConversation');
    return sessionId; // Return ID but don't save to Firestore
  }
  
  const now = new Date().toISOString();
  
  const session: ConversationSession = {
    id: sessionId,
    status: 'active',
    brandId,
    language,
    messages: [],
    createdAt: now,
    lastUpdated: now,
    source,
    topics: [],
    ...metadata,
    analytics: {
      messageCount: 0,
      avgResponseTime: 0,
      escalationCount: 0,
      productMentions: [],
      staffInteractions: 0,
    },
  };

  await setDoc(doc(db, COLLECTIONS.sessions, sessionId), session);
  return sessionId;
};

// Add a message to a conversation
export const addMessage = async (
  sessionId: string,
  message: Omit<ConversationMessage, 'id' | 'timestamp'> & { id?: string }
): Promise<void> => {
  if (getPrivacyMode()) {
    logPrivacy('addMessage');
    return; // Don't save messages to Firestore
  }
  
  const messageId = message.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  
  const fullMessage: ConversationMessage = {
    ...message,
    id: messageId,
    timestamp: now,
  };

  await setDoc(
    doc(db, COLLECTIONS.sessions, sessionId, COLLECTIONS.messages, messageId),
    fullMessage
  );

  const sessionRef = doc(db, COLLECTIONS.sessions, sessionId);
  await updateDoc(sessionRef, {
    lastUpdated: now,
    lastMessage: message.text.substring(0, 200),
    'analytics.messageCount': increment(1),
  });
};

// Update session status
export const updateSessionStatus = async (
  sessionId: string,
  status: ConversationSession['status'],
  assignedTo?: string
): Promise<void> => {
  if (getPrivacyMode()) {
    logPrivacy('updateSessionStatus');
    return;
  }
  
  const update: any = {
    status,
    lastUpdated: new Date().toISOString(),
  };
  if (assignedTo) {
    update.assignedTo = assignedTo;
  }
  
  await updateDoc(doc(db, COLLECTIONS.sessions, sessionId), update);
};

// Request human intervention
export const requestIntervention = async (
  sessionId: string,
  reason: string,
  priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'
): Promise<string> => {
  const interventionId = `int_${Date.now()}`;
  
  if (getPrivacyMode()) {
    logPrivacy('requestIntervention');
    return interventionId; // Return ID but don't save
  }
  
  const now = new Date().toISOString();
  
  const intervention: InterventionRequest = {
    id: interventionId,
    sessionId,
    requestedAt: now,
    status: 'pending',
    requestedBy: 'user',
    reason,
    priority,
  };

  await setDoc(doc(db, COLLECTIONS.interventions, interventionId), intervention);
  
  // Update session status
  await updateSessionStatus(sessionId, 'human_requested');
  
  return interventionId;
};

// Accept intervention
export const acceptIntervention = async (
  interventionId: string,
  staffId: string
): Promise<void> => {
  if (getPrivacyMode()) {
    logPrivacy('acceptIntervention');
    return;
  }
  
  await updateDoc(doc(db, COLLECTIONS.interventions, interventionId), {
    status: 'accepted',
    assignedStaffId: staffId,
  });
  
  // Get session ID from intervention — direct doc lookup (avoid full collection scan)
  const intSnap = await getDoc(doc(db, COLLECTIONS.interventions, interventionId));
  
  if (intSnap.exists()) {
    const data = intSnap.data() as InterventionRequest;
    await updateSessionStatus(data.sessionId, 'human_assigned', staffId);
  }
};

// Get all conversations with optional filtering
export const getConversations = async (
  filters?: {
    status?: ConversationSession['status'];
    brandId?: 'unitec' | 'building';
    dateFrom?: string;
    dateTo?: string;
    assignedTo?: string;
  }
): Promise<ConversationSession[]> => {
  if (getPrivacyMode()) {
    logPrivacy('getConversations');
    return []; // Return empty array when privacy mode is on
  }
  
  let q = query(collection(db, COLLECTIONS.sessions), orderBy('lastUpdated', 'desc'));
  
  if (filters?.status) {
    q = query(q, where('status', '==', filters.status));
  }
  if (filters?.brandId) {
    q = query(q, where('brandId', '==', filters.brandId));
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as ConversationSession);
};

// Subscribe to real-time conversation updates
export const subscribeToConversations = (
  callback: (sessions: ConversationSession[]) => void
): (() => void) => {
  if (getPrivacyMode()) {
    logPrivacy('subscribeToConversations');
    callback([]); // Return empty immediately
    return () => {}; // No-op unsubscribe
  }
  
  const q = query(collection(db, COLLECTIONS.sessions), orderBy('lastUpdated', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const sessions = snapshot.docs.map(doc => doc.data() as ConversationSession);
    callback(sessions);
  }, (error) => {
    console.error('Error subscribing to conversations:', error);
  });
};

// Subscribe to a single conversation
export const subscribeToConversation = (
  sessionId: string,
  callback: (session: ConversationSession | null) => void
): (() => void) => {
  if (getPrivacyMode()) {
    logPrivacy('subscribeToConversation');
    callback(null); // Return null immediately
    return () => {}; // No-op unsubscribe
  }
  
  return onSnapshot(
    doc(db, COLLECTIONS.sessions, sessionId),
    (doc) => {
      if (doc.exists()) {
        callback(doc.data() as ConversationSession);
      } else {
        callback(null);
      }
    },
    (error) => {
      console.error(`Error subscribing to conversation ${sessionId}:`, error);
    }
  );
};

// Get messages for a session
export const getMessages = async (sessionId: string): Promise<ConversationMessage[]> => {
  if (getPrivacyMode()) {
    logPrivacy('getMessages');
    return []; // Return empty when privacy mode is on
  }
  
  const q = query(
    collection(db, COLLECTIONS.sessions, sessionId, COLLECTIONS.messages),
    orderBy('timestamp', 'asc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as ConversationMessage);
};

// Subscribe to messages in real-time
export const subscribeToMessages = (
  sessionId: string,
  callback: (messages: ConversationMessage[]) => void
): (() => void) => {
  if (getPrivacyMode()) {
    logPrivacy('subscribeToMessages');
    callback([]); // Return empty immediately
    return () => {}; // No-op unsubscribe
  }
  
  const q = query(
    collection(db, COLLECTIONS.sessions, sessionId, COLLECTIONS.messages),
    orderBy('timestamp', 'asc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => doc.data() as ConversationMessage);
    callback(messages);
  }, (error) => {
    console.error(`Error subscribing to messages for ${sessionId}:`, error);
  });
};

// Extract and update customer data from conversation
export const extractCustomerData = async (
  sessionId: string,
  data: ConversationSession['extractedData']
): Promise<void> => {
  if (getPrivacyMode()) {
    logPrivacy('extractCustomerData');
    return; // Don't save customer data
  }
  
  await updateDoc(doc(db, COLLECTIONS.sessions, sessionId), {
    extractedData: data,
    lastUpdated: new Date().toISOString(),
  });
};

// Update conversation analytics
export const updateAnalytics = async (
  sessionId: string,
  analytics: Partial<ConversationSession['analytics']>
): Promise<void> => {
  if (getPrivacyMode()) {
    logPrivacy('updateAnalytics');
    return; // Don't save analytics
  }
  
  await updateDoc(doc(db, COLLECTIONS.sessions, sessionId), {
    analytics: { ...analytics },
  });
};

// Get intervention requests
export const getInterventionRequests = async (
  status?: 'pending' | 'accepted' | 'resolved' | 'timeout'
): Promise<InterventionRequest[]> => {
  if (getPrivacyMode()) {
    logPrivacy('getInterventionRequests');
    return []; // Return empty when privacy mode is on
  }
  
  let q = query(collection(db, COLLECTIONS.interventions), orderBy('requestedAt', 'desc'));
  
  if (status) {
    q = query(q, where('status', '==', status));
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as InterventionRequest);
};

// Subscribe to intervention requests
export const subscribeToInterventions = (
  callback: (interventions: InterventionRequest[]) => void
): (() => void) => {
  if (getPrivacyMode()) {
    logPrivacy('subscribeToInterventions');
    callback([]); // Return empty immediately
    return () => {}; // No-op unsubscribe
  }
  
  const q = query(collection(db, COLLECTIONS.interventions), orderBy('requestedAt', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const interventions = snapshot.docs.map(doc => doc.data() as InterventionRequest);
    callback(interventions);
  }, (error) => {
    console.error('Error subscribing to interventions:', error);
  });
};

// Add a tag to a conversation
export const addConversationTag = async (sessionId: string, tag: string): Promise<void> => {
  if (getPrivacyMode()) {
    logPrivacy('addConversationTag');
    return; // Don't save tags
  }
  
  const sessionRef = doc(db, COLLECTIONS.sessions, sessionId);
  const session = await getDoc(sessionRef);
  
  if (session.exists()) {
    const data = session.data() as ConversationSession;
    const currentTags = data.tags || [];
    if (!currentTags.includes(tag)) {
      await updateDoc(sessionRef, {
        tags: [...currentTags, tag],
        lastUpdated: new Date().toISOString(),
      });
    }
  }
};

// Remove a tag from a conversation
export const removeConversationTag = async (sessionId: string, tag: string): Promise<void> => {
  if (getPrivacyMode()) {
    logPrivacy('removeConversationTag');
    return; // Don't modify tags
  }
  
  const sessionRef = doc(db, COLLECTIONS.sessions, sessionId);
  const session = await getDoc(sessionRef);
  
  if (session.exists()) {
    const data = session.data() as ConversationSession;
    const currentTags = data.tags || [];
    await updateDoc(sessionRef, {
      tags: currentTags.filter(t => t !== tag),
      lastUpdated: new Date().toISOString(),
    });
  }
};

// Add a private note to a conversation
export const addConversationNote = async (
  sessionId: string,
  note: { text: string; staffId: string; staffName: string }
): Promise<void> => {
  if (getPrivacyMode()) {
    logPrivacy('addConversationNote');
    return; // Don't save notes
  }
  
  const sessionRef = doc(db, COLLECTIONS.sessions, sessionId);
  const session = await getDoc(sessionRef);
  
  if (session.exists()) {
    const data = session.data() as ConversationSession;
    const currentNotes = data.notes || [];
    const newNote = {
      ...note,
      timestamp: new Date().toISOString(),
    };
    await updateDoc(sessionRef, {
      notes: [...currentNotes, newNote],
      lastUpdated: new Date().toISOString(),
    });
  }
};

// Update visitor info for a session
export const updateVisitorInfo = async (
  sessionId: string,
  info: {
    userAgent?: string;
    ipAddress?: string;
    referrer?: string;
    pageUrl?: string;
    location?: string;
    timeOnSite?: number;
    visitCount?: number;
  }
): Promise<void> => {
  if (getPrivacyMode()) {
    logPrivacy('updateVisitorInfo');
    return; // Don't save visitor info
  }
  
  await updateDoc(doc(db, COLLECTIONS.sessions, sessionId), {
    ...info,
    lastUpdated: new Date().toISOString(),
  });
};

// Assign session to staff member
export const assignSession = async (
  sessionId: string,
  staffId: string,
  staffName: string
): Promise<void> => {
  await updateDoc(doc(db, COLLECTIONS.sessions, sessionId), {
    assignedTo: staffId,
    assignedToName: staffName,
    status: 'human_assigned',
    lastUpdated: new Date().toISOString(),
  });
};

// Bulk update sessions
export const bulkUpdateSessions = async (
  sessionIds: string[],
  update: Partial<ConversationSession>
): Promise<void> => {
  const promises = sessionIds.map(id =>
    updateDoc(doc(db, COLLECTIONS.sessions, id), {
      ...update,
      lastUpdated: new Date().toISOString(),
    })
  );
  await Promise.all(promises);
};

// Get active staff members
export const getActiveStaff = async (): Promise<StaffMember[]> => {
  const q = query(collection(db, COLLECTIONS.staff), where('status', 'in', ['online', 'busy']));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as StaffMember);
};

// Subscribe to staff status changes
export const subscribeToStaff = (
  callback: (staff: StaffMember[]) => void
): (() => void) => {
  const q = query(collection(db, COLLECTIONS.staff), orderBy('status', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const staff = snapshot.docs.map(doc => doc.data() as StaffMember);
    callback(staff);
  }, (error) => {
    console.error('Error subscribing to staff:', error);
  });
};

// Update staff status
export const updateStaffStatus = async (
  staffId: string,
  status: StaffMember['status']
): Promise<void> => {
  await updateDoc(doc(db, COLLECTIONS.staff, staffId), { status });
};

// Get conversation metrics for analytics
export const getConversationMetrics = async (
  dateFrom?: string,
  dateTo?: string
): Promise<{
  total: number;
  active: number;
  completed: number;
  humanRequested: number;
  avgDuration: number;
  avgResponseTime: number;
  satisfactionRate: number;
}> => {
  let q = query(collection(db, COLLECTIONS.sessions), orderBy('createdAt', 'desc'));
  
  if (dateFrom) {
    q = query(q, where('createdAt', '>=', dateFrom));
  }
  if (dateTo) {
    q = query(q, where('createdAt', '<=', dateTo));
  }
  
  const snapshot = await getDocs(q);
  const sessions = snapshot.docs.map(doc => doc.data() as ConversationSession);
  
  const total = sessions.length;
  const active = sessions.filter(s => s.status === 'active').length;
  const completed = sessions.filter(s => s.status === 'completed').length;
  const humanRequested = sessions.filter(s => s.status === 'human_requested').length;
  
  const avgDuration = total > 0
    ? sessions.reduce((acc, s) => acc + (s.duration || 0), 0) / total
    : 0;
  
  const avgResponseTime = total > 0
    ? sessions.reduce((acc, s) => acc + (s.analytics?.avgResponseTime || 0), 0) / total
    : 0;
  
  // Calculate satisfaction based on sentiment (simple heuristic)
  const positiveSessions = sessions.filter(s => (s.sentimentScore || 0) > 0.3).length;
  const satisfactionRate = total > 0 ? (positiveSessions / total) * 100 : 0;
  
  return {
    total,
    active,
    completed,
    humanRequested,
    avgDuration,
    avgResponseTime,
    satisfactionRate,
  };
};

// Export collections for direct access
export { COLLECTIONS };




// Save AI-generated summary and Q&A pairs to a conversation
export const saveConversationSummary = async (
  sessionId: string,
  summary: string,
  qaPairs: Array<{ question: string; answer: string; category?: string }>
): Promise<void> => {
  if (getPrivacyMode()) {
    logPrivacy('saveConversationSummary');
    return;
  }
  await updateDoc(doc(db, COLLECTIONS.sessions, sessionId), {
    summary,
    qaPairs,
    summaryGeneratedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  });
};

// Get all completed sessions with summaries (for retraining analytics)
export const getSessionsWithSummaries = async (
  dateFrom?: string
): Promise<ConversationSession[]> => {
  if (getPrivacyMode()) {
    logPrivacy('getSessionsWithSummaries');
    return [];
  }
  let q = query(
    collection(db, COLLECTIONS.sessions),
    where('status', '==', 'completed'),
    orderBy('lastUpdated', 'desc')
  );
  if (dateFrom) {
    q = query(q, where('createdAt', '>=', dateFrom));
  }
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as ConversationSession);
};

// Fetch ALL sessions (any status) for backfill — no date filter, large limit
export const getAllSessionsForBackfill = async (): Promise<ConversationSession[]> => {
  if (getPrivacyMode()) {
    logPrivacy('getAllSessionsForBackfill');
    return [];
  }
  const q = query(
    collection(db, COLLECTIONS.sessions),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => d.data() as ConversationSession);
};

