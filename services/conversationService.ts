// @ts-nocheck
import { getPrivacyMode } from './firestoreService';
import { db } from '../firebase';
import { collection, addDoc, getDocs, doc, updateDoc, query, orderBy, onSnapshot, getDoc, where, serverTimestamp } from 'firebase/firestore';


// --- OFFLINE-FIRST / FIREBASE API SUSPENSION RESILIENCY FALLBACK SYSTEM ---
const getLocalSessions = (): ConversationSession[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem('unitec_conversations_fallback');
    if (!raw || raw === '[]') return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
};

const saveLocalSessions = (sessions: ConversationSession[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem('unitec_conversations_fallback', JSON.stringify(sessions));
  } catch (e) {}
};

const getLocalInterventions = (): InterventionRequest[] => {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem('unitec_interventions_fallback') || '[]');
  } catch (e) {
    return [];
  }
};

const saveLocalInterventions = (ints: InterventionRequest[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem('unitec_interventions_fallback', JSON.stringify(ints));
  } catch (e) {}
};


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
  messages?: ConversationMessage[];
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
    profession?: string;
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
    return sessionId;
  }
  
  const now = new Date().toISOString();
  
  const session: ConversationSession = {
    id: sessionId,
    status: 'active',
    brandId,
    language,
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
    messages: []
  };

  // Offline fallback saving
  const local = getLocalSessions();
  local.unshift(session);
  saveLocalSessions(local);

  try {
    await setDoc(doc(db, COLLECTIONS.sessions, sessionId), session);
  } catch (e) {
    console.warn('Failed to write new conversation session to Firestore (key may be suspended):', e);
  }
  
  return sessionId;
};

// Add a message to a conversation
export const addMessage = async (
  sessionId: string,
  message: Omit<ConversationMessage, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
): Promise<void> => {
  if (getPrivacyMode()) {
    logPrivacy('addMessage');
    return;
  }
  
  const messageId = message.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  
  const fullMessage: ConversationMessage = {
    ...message,
    id: messageId,
    timestamp: message.timestamp || now,
  };

  // Update locally
  const local = getLocalSessions();
  const idx = local.findIndex(s => s.id === sessionId);
  if (idx !== -1) {
    if (!local[idx].messages) local[idx].messages = [];
    if (!local[idx].messages?.some(m => m.id === messageId)) {
      local[idx].messages?.push(fullMessage);
    }
    local[idx].lastUpdated = now;
    local[idx].lastMessage = message.text.substring(0, 200);
    if (local[idx].analytics) {
      local[idx].analytics.messageCount = (local[idx].analytics.messageCount || 0) + 1;
    }
    if (local[idx].status === 'completed' || local[idx].status === 'abandoned') {
      local[idx].status = 'active';
    }
    saveLocalSessions(local);
  }

  try {
    await setDoc(
      doc(db, COLLECTIONS.sessions, sessionId, COLLECTIONS.messages, messageId),
      fullMessage
    );
  } catch (e) {
    console.warn('Failed to write message to Firestore:', e);
  }

  try {
    const sessionRef = doc(db, COLLECTIONS.sessions, sessionId);
    const sessionSnap = await getDoc(sessionRef);
    const updatePayload: any = {
      lastUpdated: now,
      lastMessage: message.text.substring(0, 200),
      'analytics.messageCount': increment(1),
    };

    if (sessionSnap.exists()) {
      const sessionData = sessionSnap.data() as ConversationSession;
      if (sessionData.status === 'completed' || sessionData.status === 'abandoned') {
        updatePayload.status = 'active';
      }
    }

    await updateDoc(sessionRef, updatePayload);
  } catch (e) {
    console.warn('Failed to update session info in Firestore:', e);
  }
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
  
  const now = new Date().toISOString();
  const update: any = {
    status,
    lastUpdated: now,
  };
  if (assignedTo) {
    update.assignedTo = assignedTo;
  }

  // Update locally
  const local = getLocalSessions();
  const idx = local.findIndex(s => s.id === sessionId);
  if (idx !== -1) {
    local[idx].status = status;
    local[idx].lastUpdated = now;
    if (assignedTo) {
      local[idx].assignedTo = assignedTo;
    }
    saveLocalSessions(local);
  }

  try {
    if (status === 'completed' || status === 'abandoned') {
      try {
        const sessionRef = doc(db, COLLECTIONS.sessions, sessionId);
        const sessionSnap = await getDoc(sessionRef);
        if (sessionSnap.exists()) {
          const sessionData = sessionSnap.data() as ConversationSession;
          if (sessionData.createdAt && !sessionData.duration) {
            const startTime = new Date(sessionData.createdAt).getTime();
            const endTime = Date.now();
            update.duration = Math.floor((endTime - startTime) / 1000);
            
            // Update locally
            const l2 = getLocalSessions();
            const idx2 = l2.findIndex(s => s.id === sessionId);
            if (idx2 !== -1) {
              l2[idx2].duration = update.duration;
              saveLocalSessions(l2);
            }
          }
        }
      } catch (e) {
        console.error('Error calculating duration:', e);
      }
    }
    
    await updateDoc(doc(db, COLLECTIONS.sessions, sessionId), update);
  } catch (e) {
    console.warn('Failed to update session status in Firestore:', e);
  }
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
    return interventionId;
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

  // Save locally
  const localInts = getLocalInterventions();
  localInts.unshift(intervention);
  saveLocalInterventions(localInts);

  try {
    await setDoc(doc(db, COLLECTIONS.interventions, interventionId), intervention);
  } catch (e) {
    console.warn('Failed to request intervention in Firestore:', e);
  }
  
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
  
  // Update locally
  const localInts = getLocalInterventions();
  const idx = localInts.findIndex(i => i.id === interventionId);
  if (idx !== -1) {
    localInts[idx].status = 'accepted';
    localInts[idx].assignedStaffId = staffId;
    saveLocalInterventions(localInts);
    await updateSessionStatus(localInts[idx].sessionId, 'human_assigned', staffId);
  }

  try {
    await updateDoc(doc(db, COLLECTIONS.interventions, interventionId), {
      status: 'accepted',
      assignedStaffId: staffId,
    });
    
    const intSnap = await getDoc(doc(db, COLLECTIONS.interventions, interventionId));
    if (intSnap.exists()) {
      const data = intSnap.data() as InterventionRequest;
      await updateSessionStatus(data.sessionId, 'human_assigned', staffId);
    }
  } catch (e) {
    console.warn('Failed to accept intervention in Firestore:', e);
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

interface ActiveSubscription {
  type: 'conversations' | 'conversation' | 'messages' | 'interventions';
  sessionId?: string;
  callback: Function;
}

const activeSubs: ActiveSubscription[] = [];

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === 'unitec_conversations_fallback') {
      try {
        const local = JSON.parse(event.newValue || '[]');
        activeSubs.forEach(sub => {
          if (sub.type === 'conversations') {
            sub.callback(local);
          } else if (sub.type === 'conversation') {
            sub.callback(local.find((s: any) => s.id === sub.sessionId) || null);
          } else if (sub.type === 'messages') {
            const found = local.find((s: any) => s.id === sub.sessionId);
            sub.callback(found?.messages || []);
          }
        });
      } catch (e) {
        console.error('Failed to parse updated localStorage sessions:', e);
      }
    } else if (event.key === 'unitec_interventions_fallback') {
      try {
        const local = JSON.parse(event.newValue || '[]');
        activeSubs.forEach(sub => {
          if (sub.type === 'interventions') {
            sub.callback(local);
          }
        });
      } catch (e) {
        console.error('Failed to parse updated localStorage interventions:', e);
      }
    }
  });
}

// Subscribe to real-time conversation updates
export const subscribeToConversations = (
  callback: (sessions: ConversationSession[]) => void
): (() => void) => {
  if (getPrivacyMode()) {
    logPrivacy('subscribeToConversations');
    callback([]);
    return () => {};
  }
  
  // Return local storage fallback immediately
  callback(getLocalSessions());
  
  const subRecord: ActiveSubscription = { type: 'conversations', callback };
  activeSubs.push(subRecord);
  
  const q = query(collection(db, COLLECTIONS.sessions), orderBy('lastUpdated', 'desc'));
  
  let unsubSnapshot = () => {};
  try {
    unsubSnapshot = onSnapshot(q, (snapshot) => {
      const sessions = snapshot.docs.map(doc => doc.data() as ConversationSession);
      const local = getLocalSessions();
      const merged = [...sessions];
      local.forEach(l => {
        if (!merged.some(m => m.id === l.id)) {
          merged.push(l);
        }
      });
      merged.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
      saveLocalSessions(merged);
      callback(merged);
    }, (error) => {
      console.warn('Error subscribing to conversations, returning local sessions:', error);
      callback(getLocalSessions());
    });
  } catch (e) {
    console.warn('Failed to setup conversations snapshot subscription:', e);
  }
  
  return () => {
    unsubSnapshot();
    const idx = activeSubs.indexOf(subRecord);
    if (idx !== -1) activeSubs.splice(idx, 1);
  };
};

// Subscribe to a single conversation
export const subscribeToConversation = (
  sessionId: string,
  callback: (session: ConversationSession | null) => void
): (() => void) => {
  if (getPrivacyMode()) {
    logPrivacy('subscribeToConversation');
    callback(null);
    return () => {};
  }
  
  // Return local storage immediately
  const local = getLocalSessions();
  callback(local.find(s => s.id === sessionId) || null);
  
  const subRecord: ActiveSubscription = { type: 'conversation', sessionId, callback };
  activeSubs.push(subRecord);
  
  let unsubSnapshot = () => {};
  try {
    unsubSnapshot = onSnapshot(
      doc(db, COLLECTIONS.sessions, sessionId),
      (doc) => {
        if (doc.exists()) {
          callback(doc.data() as ConversationSession);
        } else {
          callback(null);
        }
      },
      (error) => {
        console.warn(`Error subscribing to conversation ${sessionId}:`, error);
        callback(getLocalSessions().find(s => s.id === sessionId) || null);
      }
    );
  } catch (e) {
    console.warn('Failed to setup single conversation snapshot:', e);
  }
  
  return () => {
    unsubSnapshot();
    const idx = activeSubs.indexOf(subRecord);
    if (idx !== -1) activeSubs.splice(idx, 1);
  };
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
    callback([]);
    return () => {};
  }
  
  // Return local storage messages immediately
  const localSessions = getLocalSessions();
  const found = localSessions.find(s => s.id === sessionId);
  if (found && found.messages) {
    callback(found.messages);
  }
  
  const subRecord: ActiveSubscription = { type: 'messages', sessionId, callback };
  activeSubs.push(subRecord);
  
  const q = query(
    collection(db, COLLECTIONS.sessions, sessionId, COLLECTIONS.messages),
    orderBy('timestamp', 'asc')
  );
  
  let unsubSnapshot = () => {};
  try {
    unsubSnapshot = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => doc.data() as ConversationMessage);
      const local = getLocalSessions();
      const idx = local.findIndex(s => s.id === sessionId);
      if (idx !== -1) {
        local[idx].messages = messages;
        saveLocalSessions(local);
      }
      callback(messages);
    }, (error) => {
      console.warn(`Error subscribing to messages for ${sessionId}:`, error);
      const local = getLocalSessions();
      const f = local.find(s => s.id === sessionId);
      if (f && f.messages) {
        callback(f.messages);
      }
    });
  } catch (e) {
    console.warn('Failed to setup messages snapshot:', e);
  }
  
  return () => {
    unsubSnapshot();
    const idx = activeSubs.indexOf(subRecord);
    if (idx !== -1) activeSubs.splice(idx, 1);
  };
};

// Extract and update customer data from conversation
export const extractCustomerData = async (
  sessionId: string,
  data: ConversationSession['extractedData']
): Promise<void> => {
  if (getPrivacyMode()) {
    logPrivacy('extractCustomerData');
    return;
  }
  
  const now = new Date().toISOString();
  const update: any = {
    extractedData: data,
    lastUpdated: now,
  };
  
  if (data?.name) update.customerName = data.name;
  if (data?.email) update.customerEmail = data.email;
  if (data?.phone) update.customerPhone = data.phone;

  // Update locally
  const local = getLocalSessions();
  const idx = local.findIndex(s => s.id === sessionId);
  if (idx !== -1) {
    local[idx].extractedData = data;
    local[idx].lastUpdated = now;
    if (data?.name) local[idx].customerName = data.name;
    if (data?.email) local[idx].customerEmail = data.email;
    if (data?.phone) local[idx].customerPhone = data.phone;
    saveLocalSessions(local);
  }

  try {
    await updateDoc(doc(db, COLLECTIONS.sessions, sessionId), update);
  } catch (e) {
    console.warn('Failed to update customer data in Firestore:', e);
  }
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
    callback([]);
    return () => {};
  }
  
  // Return local storage immediately
  callback(getLocalInterventions());
  
  const subRecord: ActiveSubscription = { type: 'interventions', callback };
  activeSubs.push(subRecord);
  
  const q = query(collection(db, COLLECTIONS.interventions), orderBy('requestedAt', 'desc'));
  
  let unsubSnapshot = () => {};
  try {
    unsubSnapshot = onSnapshot(q, (snapshot) => {
      const interventions = snapshot.docs.map(doc => doc.data() as InterventionRequest);
      saveLocalInterventions(interventions);
      callback(interventions);
    }, (error) => {
      console.warn('Error subscribing to interventions, using local fallback:', error);
      callback(getLocalInterventions());
    });
  } catch (e) {
    console.warn('Failed to setup interventions snapshot subscription:', e);
  }
  
  return () => {
    unsubSnapshot();
    const idx = activeSubs.indexOf(subRecord);
    if (idx !== -1) activeSubs.splice(idx, 1);
  };
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

// Fetch ALL sessions (any status) for backfill â€” no date filter, large limit
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









