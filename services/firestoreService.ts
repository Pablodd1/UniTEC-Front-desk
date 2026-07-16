import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs, query, orderBy, deleteDoc, onSnapshot } from 'firebase/firestore';

// PRIVACY MODE: Set to true to disable all Firestore chat saving
// This ensures user conversations are NOT stored unless explicitly enabled
export const getPrivacyMode = (): boolean => {
  const stored = typeof window !== 'undefined' ? window.localStorage.getItem('unitec_privacy_mode') : null;
  // Default to FALSE — conversations are saved unless admin explicitly enables privacy mode
  return stored === 'true';
};

const logPrivacy = (action: string) => {
  if (getPrivacyMode()) {
    console.log(`[PRIVACY] Blocked: ${action} - Chat data not saved (privacy mode enabled)`);
  }
};

export interface AppConfig {
  escalaApiKey?: string;
  escalaAccountId?: string;
  escalaIsActive?: boolean;
  trainingData?: string;
  geminiApiKey?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  userId: string;
}

export interface CrmLog {
  id: string;
  timestamp: string;
  customerName: string;
  summary: string;
  actionTaken: string;
  sentiment: 'Positive' | 'Neutral' | 'Negative';
  provider?: 'Internal' | 'Escala';
  userId: string;
}

export interface CallRecording {
  id: string;
  name: string;
  timestamp: string;
  duration: string;
  blobUrl?: string;
  transcript?: string;
  userId: string;
}

export const getUserId = (): string | null => {
  return auth.currentUser?.uid || null;
};

// AppConfig
export const getAppConfig = async (): Promise<AppConfig | null> => {
  const userId = getUserId();
  if (!userId) return null;

  const path = `users/${userId}/config/main`;
  try {
    const docRef = doc(db, path);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as AppConfig;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const saveAppConfig = async (config: Partial<AppConfig>): Promise<void> => {
  const userId = getUserId();
  if (!userId) throw new Error("User not authenticated");

  const path = `users/${userId}/config/main`;
  try {
    const docRef = doc(db, path);
    await setDoc(docRef, { ...config, userId }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

// Shared global Telegram Config stored at root /config/main
export interface TelegramConfig {
  botToken: string;
  chatId: string;
  reportTime?: string;
  analyticsPreferences?: {
    includeTraffic: boolean;
    includeSentiment: boolean;
    includeIntents: boolean;
    includeDemographics: boolean;
    includeAIExecutiveSummary: boolean;
  };
}

export const getTelegramConfig = async (): Promise<TelegramConfig> => {
  const path = 'config/main';
  try {
    const docRef = doc(db, path);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        botToken: data.telegramBotToken || '',
        chatId: data.telegramChatId || '',
        reportTime: data.telegramReportTime || '09:00',
        analyticsPreferences: data.telegramAnalyticsPreferences || {
          includeTraffic: true,
          includeSentiment: true,
          includeIntents: true,
          includeDemographics: true,
          includeAIExecutiveSummary: true,
        }
      };
    }
  } catch (error) {
    console.error('Failed to get Telegram config:', error);
  }
  return { 
    botToken: '', 
    chatId: '', 
    reportTime: '09:00',
    analyticsPreferences: {
      includeTraffic: true,
      includeSentiment: true,
      includeIntents: true,
      includeDemographics: true,
      includeAIExecutiveSummary: true,
    }
  };
};

export const saveTelegramConfig = async (config: TelegramConfig): Promise<void> => {
  const path = 'config/main';
  try {
    const docRef = doc(db, path);
    await setDoc(docRef, {
      telegramBotToken: config.botToken,
      telegramChatId: config.chatId,
      telegramReportTime: config.reportTime || '09:00',
      telegramAnalyticsPreferences: config.analyticsPreferences || {
        includeTraffic: true,
        includeSentiment: true,
        includeIntents: true,
        includeDemographics: true,
        includeAIExecutiveSummary: true,
      }
    }, { merge: true });
  } catch (error) {
    console.error('Failed to save Telegram config:', error);
  }
};

// CrmLog
export const getCrmLogs = async (): Promise<CrmLog[]> => {
  const userId = getUserId();
  if (!userId) return [];

  const path = `users/${userId}/crmLogs`;
  try {
    const q = query(collection(db, path), orderBy('timestamp', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as CrmLog);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const addCrmLog = async (log: Omit<CrmLog, 'userId'>): Promise<void> => {
  const userId = getUserId();
  if (!userId) throw new Error("User not authenticated");

  const path = `users/${userId}/crmLogs/${log.id}`;
  try {
    const docRef = doc(db, path);
    await setDoc(docRef, { ...log, userId });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

// CallRecording
export const getCallRecordings = async (): Promise<CallRecording[]> => {
  const userId = getUserId();
  if (!userId) return [];

  const path = `users/${userId}/callRecordings`;
  try {
    const q = query(collection(db, path), orderBy('timestamp', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as CallRecording);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const addCallRecording = async (recording: Omit<CallRecording, 'userId'>): Promise<void> => {
  const userId = getUserId();
  if (!userId) throw new Error("User not authenticated");

  const path = `users/${userId}/callRecordings/${recording.id}`;
  try {
    const docRef = doc(db, path);
    await setDoc(docRef, { ...recording, userId });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const deleteCallRecording = async (recordingId: string): Promise<void> => {
  const userId = getUserId();
  if (!userId) throw new Error("User not authenticated");

  const path = `users/${userId}/callRecordings/${recordingId}`;
  try {
    const docRef = doc(db, path);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};


export interface ChatSession {
  id: string;
  timestamp: string;
  lastUpdated: string;
  messages: any[];
  userId: string;
  customerName?: string;
  status?: 'active' | 'human_assigned' | 'completed';
  assignedTo?: string | null;
  type?: 'chat' | 'call';
  duration?: string;
  extracted_pii?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  intent_category?: string;
}

export const getAllChatSessions = async (): Promise<ChatSession[]> => {
  if (getPrivacyMode()) {
    logPrivacy('getAllChatSessions');
    return []; // Return empty when privacy mode is on
  }
  
  const userId = getUserId();
  if (!userId) return [];
  const path = `users/${userId}/chatSessions`;
  try {
    const q = query(collection(db, path), orderBy('lastUpdated', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as ChatSession);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const saveChatSession = async (session: Omit<ChatSession, 'userId'>): Promise<void> => {
  if (getPrivacyMode()) {
    logPrivacy('saveChatSession');
    return; // Don't save chat sessions
  }
  
  const userId = getUserId();
  if (!userId) throw new Error("User not authenticated");
  const path = `users/${userId}/chatSessions/${session.id}`;
  try {
    const docRef = doc(db, path);
    await setDoc(docRef, { ...session, userId }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const subscribeToAllChatSessions = (callback: (sessions: ChatSession[]) => void): (() => void) => {
  if (getPrivacyMode()) {
    logPrivacy('subscribeToAllChatSessions');
    callback([]); // Return empty immediately
    return () => {}; // No-op unsubscribe
  }
  
  const userId = getUserId();
  if (!userId) return () => {};
  const path = `users/${userId}/chatSessions`;
  const q = query(collection(db, path), orderBy('lastUpdated', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const sessions = snapshot.docs.map(doc => doc.data() as ChatSession);
    callback(sessions);
  }, (error) => {
    console.error("Failed to subscribe to chat sessions", error);
  });
};

export const subscribeToChatSession = (sessionId: string, callback: (session: ChatSession | null) => void): (() => void) => {
  if (getPrivacyMode()) {
    logPrivacy('subscribeToChatSession');
    callback(null); // Return null immediately
    return () => {}; // No-op unsubscribe
  }
  
  const userId = getUserId();
  if (!userId) return () => {};
  const path = `users/${userId}/chatSessions/${sessionId}`;
  const docRef = doc(db, path);
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as ChatSession);
    } else {
      callback(null);
    }
  }, (error) => {
    console.error(`Failed to subscribe to session ${sessionId}`, error);
  });
};
